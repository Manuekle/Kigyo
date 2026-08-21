'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import {
  DENTAL_CHART_KINDS, DENTAL_LAB_STATUSES, DENTAL_LAB_WORK_TYPES,
  TOOTH_CONDITIONS, TOOTH_SURFACES, TREATMENT_ITEM_STATUSES, TREATMENT_PLAN_STATUSES,
  todayIn,
} from '@/lib/domain'
import { getOdontologia, type OdontologiaData } from '@/server/queries/odontologia'

export type OdontoResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const DENIED = 'No tienes permiso para gestionar pacientes.'

async function refreshed(): Promise<OdontoResult<OdontologiaData>> {
  revalidatePath('/dashboard/pacientes')
  return { ok: true, data: await getOdontologia() }
}

/**
 * Las piezas válidas en notación FDI.
 *
 * El mismo rango que el check de la migración 45, escrito aquí para que el
 * error sea una frase y no un `check_violation`. Los dos, no uno: la base es
 * la que hace la regla verdadera y esta es la que la explica.
 */
const toothSchema = z.coerce.number().int().refine(
  (n) =>
    (n >= 11 && n <= 18) || (n >= 21 && n <= 28) ||
    (n >= 31 && n <= 38) || (n >= 41 && n <= 48) ||
    (n >= 51 && n <= 55) || (n >= 61 && n <= 65) ||
    (n >= 71 && n <= 75) || (n >= 81 && n <= 85),
  'Esa pieza no existe en la notación FDI.',
)

/** El paciente tiene que ser de esta empresa. Se comprueba en cada escritura. */
async function patientInOrg(
  supabase: Awaited<ReturnType<typeof createClient>>,
  patientId: string,
  orgId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('patients')
    .select('id')
    .eq('id', patientId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()
  return data !== null
}

/* ─── Odontograma ──────────────────────────────────────────────────────── */

const chartSchema = z.object({
  patientId: z.uuid('Elige un paciente.'),
  kind: z.enum(DENTAL_CHART_KINDS).default('Inicial'),
  chartedOn: z.string().trim().min(1, 'Elige la fecha.'),
  professionalId: z.uuid().nullable().default(null),
  notes: z.string().trim().max(1000).default(''),
})

export async function crearOdontograma(
  input: z.input<typeof chartSchema>,
): Promise<OdontoResult<OdontologiaData>> {
  try {
    const member = await requirePermission('pacientes:write')
    const parsed = chartSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    if (!(await patientInOrg(supabase, parsed.data.patientId, member.orgId))) {
      return fail('Ese paciente no existe en esta empresa.')
    }

    const { error } = await supabase.from('dental_charts').insert({
      org_id: member.orgId,
      patient_id: parsed.data.patientId,
      professional_id: parsed.data.professionalId,
      charted_on: parsed.data.chartedOn,
      kind: parsed.data.kind,
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[odontologia] crearOdontograma', error)
      return fail('No se pudo crear el odontograma.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

const findingSchema = z.object({
  chartId: z.uuid(),
  tooth: toothSchema,
  /** Vacío significa «la pieza entera», que es un hecho distinto de una cara. */
  surface: z.enum(TOOTH_SURFACES).nullable().default(null),
  condition: z.enum(TOOTH_CONDITIONS),
  notes: z.string().trim().max(500).default(''),
})

/**
 * Anota o corrige el hallazgo de una pieza.
 *
 * Un upsert y no un insert: marcar la 16 como cariada y después corregirla a
 * obturada es lo que pasa todo el tiempo en el sillón, y obligar a borrar
 * primero convierte una corrección en dos pasos que se olvidan a la mitad.
 *
 * La clave del conflicto es `(chart_id, tooth, surface)`, que es el `unique` de
 * la migración 45. El caso de la pieza entera —- `surface` nulo—- no lo cubre
 * ese índice, así que se resuelve leyendo primero: en Postgres dos nulos no
 * chocan y un `on conflict` no lo atraparía.
 */
export async function anotarPieza(
  input: z.input<typeof findingSchema>,
): Promise<OdontoResult<OdontologiaData>> {
  try {
    await requirePermission('pacientes:write')
    const parsed = findingSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { chartId, tooth, surface, condition, notes } = parsed.data

    // La fila que ya existe para esta pieza y esta cara, si la hay. Se busca
    // con `is` cuando la cara es nula porque `eq(null)` no encuentra nada.
    const existing = surface === null
      ? await supabase
          .from('dental_chart_teeth')
          .select('id')
          .eq('chart_id', chartId)
          .eq('tooth', tooth)
          .is('surface', null)
          .maybeSingle()
      : await supabase
          .from('dental_chart_teeth')
          .select('id')
          .eq('chart_id', chartId)
          .eq('tooth', tooth)
          .eq('surface', surface)
          .maybeSingle()

    const { error } = existing.data
      ? await supabase
          .from('dental_chart_teeth')
          .update({ condition, notes })
          .eq('id', existing.data.id)
      : await supabase
          .from('dental_chart_teeth')
          .insert({ chart_id: chartId, tooth, surface, condition, notes })

    if (error) {
      console.error('[odontologia] anotarPieza', error)
      return fail('No se pudo anotar la pieza.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function borrarHallazgo(id: string): Promise<OdontoResult<OdontologiaData>> {
  try {
    await requirePermission('pacientes:write')
    if (!z.uuid().safeParse(id).success) return fail('Hallazgo inválido.')

    const supabase = await createClient()
    // Borrado real: un hallazgo mal tecleado no es historia clínica, es un
    // error de captura. El odontograma completo sí se conserva —- uno por
    // levantamiento, ver la migración 45—- que es donde vive la historia.
    const { error } = await supabase.from('dental_chart_teeth').delete().eq('id', id)

    if (error) {
      console.error('[odontologia] borrarHallazgo', error)
      return fail('No se pudo borrar el hallazgo.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/* ─── Planes de tratamiento ────────────────────────────────────────────── */

const planSchema = z.object({
  patientId: z.uuid('Elige un paciente.'),
  professionalId: z.uuid().nullable().default(null),
  proposedOn: z.string().trim().min(1, 'Elige la fecha.'),
  notes: z.string().trim().max(1000).default(''),
})

export async function crearPlan(
  input: z.input<typeof planSchema>,
): Promise<OdontoResult<OdontologiaData>> {
  try {
    const member = await requirePermission('pacientes:write')
    const parsed = planSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    if (!(await patientInOrg(supabase, parsed.data.patientId, member.orgId))) {
      return fail('Ese paciente no existe en esta empresa.')
    }

    const { error } = await supabase.from('treatment_plans').insert({
      org_id: member.orgId,
      patient_id: parsed.data.patientId,
      professional_id: parsed.data.professionalId,
      proposed_on: parsed.data.proposedOn,
      notes: parsed.data.notes,
      status: 'Propuesto',
    })

    if (error) {
      console.error('[odontologia] crearPlan', error)
      return fail('No se pudo crear el plan.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

const planStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(TREATMENT_PLAN_STATUSES),
})

export async function cambiarEstadoPlan(
  input: z.input<typeof planStatusSchema>,
): Promise<OdontoResult<OdontologiaData>> {
  try {
    const member = await requirePermission('pacientes:write')
    const parsed = planStatusSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('treatment_plans')
      .update({
        status: parsed.data.status,
        // La fecha de aceptación se sella al aceptar y no se borra después:
        // pasar a «En curso» o «Terminado» no deshace que el paciente dijo que
        // sí el 4 de marzo, que es el dato que respalda el cobro.
        ...(parsed.data.status === 'Aceptado'
          ? { accepted_on: todayIn(member.orgTimezone) }
          : {}),
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[odontologia] cambiarEstadoPlan', error)
      return fail('No se pudo actualizar el plan.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

const planItemSchema = z.object({
  planId: z.uuid(),
  tooth: toothSchema.nullable().default(null),
  surface: z.enum(TOOTH_SURFACES).nullable().default(null),
  procedure: z.string().trim().min(1, 'Escribe el procedimiento.').max(200),
  productId: z.uuid().nullable().default(null),
  priceCents: z.coerce.number().int().min(0).max(1_000_000_00).default(0),
})

/**
 * Agrega un procedimiento al plan.
 *
 * Cuando viene de un producto del catálogo, el precio se lee de ahí y no del
 * navegador —- lo mismo que en el punto de venta—- y se copia a la línea: subir
 * la tarifa el mes que viene no debe reescribir lo que se le prometió a este
 * paciente hoy. Sin producto, el precio es el que se teclee: media clínica
 * cotiza a ojo y negárselo la deja fuera.
 */
export async function agregarProcedimiento(
  input: z.input<typeof planItemSchema>,
): Promise<OdontoResult<OdontologiaData>> {
  try {
    const member = await requirePermission('pacientes:write')
    const parsed = planItemSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    const { data: plan } = await supabase
      .from('treatment_plans')
      .select('id')
      .eq('id', parsed.data.planId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!plan) return fail('Ese plan no existe en esta empresa.')

    let priceCents = parsed.data.priceCents
    if (parsed.data.productId) {
      const { data: product } = await supabase
        .from('products')
        .select('id, price_cents')
        .eq('id', parsed.data.productId)
        .eq('org_id', member.orgId)
        .is('deleted_at', null)
        .maybeSingle()
      if (!product) return fail('Ese procedimiento no está en el catálogo de esta empresa.')
      priceCents = product.price_cents
    }

    // `sort` al final de lo que ya hay, para que el plan se lea en el orden en
    // que se pensó y no en el que la base decida devolverlo.
    const { count } = await supabase
      .from('treatment_plan_items')
      .select('id', { count: 'exact', head: true })
      .eq('plan_id', plan.id)

    const { error } = await supabase.from('treatment_plan_items').insert({
      plan_id: plan.id,
      tooth: parsed.data.tooth,
      surface: parsed.data.surface,
      procedure: parsed.data.procedure,
      product_id: parsed.data.productId,
      price_cents: priceCents,
      sort: count ?? 0,
    })

    if (error) {
      console.error('[odontologia] agregarProcedimiento', error)
      return fail('No se pudo agregar el procedimiento.')
    }
    // El total del plan lo recalcula el trigger de la migración 45.
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

const itemStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(TREATMENT_ITEM_STATUSES),
  professionalId: z.uuid().nullable().default(null),
})

export async function cambiarEstadoProcedimiento(
  input: z.input<typeof itemStatusSchema>,
): Promise<OdontoResult<OdontologiaData>> {
  try {
    const member = await requirePermission('pacientes:write')
    const parsed = itemStatusSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('treatment_plan_items')
      .update({
        status: parsed.data.status,
        // La fecha se pone al marcar hecho y se limpia si se deshace: a
        // diferencia de la aceptación del plan, esto sí es reversible — un
        // procedimiento marcado por error no ocurrió.
        done_on: parsed.data.status === 'Hecho'
          ? todayIn(member.orgTimezone)
          : null,
        ...(parsed.data.professionalId ? { professional_id: parsed.data.professionalId } : {}),
      })
      .eq('id', parsed.data.id)

    if (error) {
      console.error('[odontologia] cambiarEstadoProcedimiento', error)
      return fail('No se pudo actualizar el procedimiento.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function borrarProcedimiento(id: string): Promise<OdontoResult<OdontologiaData>> {
  try {
    await requirePermission('pacientes:write')
    if (!z.uuid().safeParse(id).success) return fail('Procedimiento inválido.')

    const supabase = await createClient()
    const { error } = await supabase.from('treatment_plan_items').delete().eq('id', id)

    if (error) {
      console.error('[odontologia] borrarProcedimiento', error)
      return fail('No se pudo borrar el procedimiento.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/* ─── Laboratorio dental ───────────────────────────────────────────────── */

const labSchema = z.object({
  patientId: z.uuid('Elige un paciente.'),
  labName: z.string().trim().max(160).default(''),
  workType: z.enum(DENTAL_LAB_WORK_TYPES).default('Corona'),
  tooth: toothSchema.nullable().default(null),
  sentOn: z.string().trim().min(1, 'Elige la fecha de envío.'),
  dueOn: z.string().trim().nullish(),
  costCents: z.coerce.number().int().min(0).max(1_000_000_00).default(0),
  notes: z.string().trim().max(1000).default(''),
})

export async function enviarALaboratorio(
  input: z.input<typeof labSchema>,
): Promise<OdontoResult<OdontologiaData>> {
  try {
    const member = await requirePermission('pacientes:write')
    const parsed = labSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    if (!(await patientInOrg(supabase, parsed.data.patientId, member.orgId))) {
      return fail('Ese paciente no existe en esta empresa.')
    }

    const { error } = await supabase.from('dental_lab_orders').insert({
      org_id: member.orgId,
      patient_id: parsed.data.patientId,
      lab_name: parsed.data.labName,
      work_type: parsed.data.workType,
      tooth: parsed.data.tooth,
      sent_on: parsed.data.sentOn,
      due_on: parsed.data.dueOn || null,
      cost_cents: parsed.data.costCents,
      notes: parsed.data.notes,
      status: 'Enviado',
    })

    if (error) {
      console.error('[odontologia] enviarALaboratorio', error)
      return fail('No se pudo registrar el envío.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

const labStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(DENTAL_LAB_STATUSES),
})

export async function cambiarEstadoLaboratorio(
  input: z.input<typeof labStatusSchema>,
): Promise<OdontoResult<OdontologiaData>> {
  try {
    const member = await requirePermission('pacientes:write')
    const parsed = labStatusSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('dental_lab_orders')
      .update({
        status: parsed.data.status,
        // «Recibido» es lo que apaga la alarma de vencimiento, así que la fecha
        // se sella aquí y se limpia si vuelve a salir por reproceso — un
        // trabajo que se devolvió al laboratorio está afuera otra vez.
        received_on: parsed.data.status === 'Recibido'
          ? todayIn(member.orgTimezone)
          : null,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[odontologia] cambiarEstadoLaboratorio', error)
      return fail('No se pudo actualizar el trabajo.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}
