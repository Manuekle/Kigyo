'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { getObra, type ObraData } from '@/server/queries/obra'
import type { Supabase } from '@/server/queries/shared'

export type ObraResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const DENIED = 'No tienes permiso para gestionar la obra.'

async function refreshed(): Promise<ObraResult<ObraData>> {
  revalidatePath('/dashboard/obra')
  return { ok: true, data: await getObra() }
}

/**
 * Rechaza un FK que no es de *esta* organización. RLS mira el `org_id` de la
 * fila propia; lo que la fila señala (presupuesto, capítulo) hay que
 * validarlo aquí, igual que `belongsToOrg` hace con sus tablas — solo que
 * las tablas de obra no tienen `deleted_at`.
 */
async function ownedByOrg(
  supabase: Supabase,
  table: 'obra_presupuestos' | 'obra_capitulos',
  id: string | null,
  orgId: string,
): Promise<boolean> {
  if (!id) return false
  const { data } = await supabase
    .from(table)
    .select('id')
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle()
  return Boolean(data)
}

/* ─── Presupuestos ───────────────────────────────────────────────────────── */

const money = z.coerce.number().min(0).max(999_999_999_999)

const addPresupuestoSchema = z.object({
  name: z.string().trim().min(2).max(120),
  client: z.string().trim().max(120).default(''),
  valorPresupuestado: money,
  fechaInicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fechaFin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function addPresupuesto(
  input: z.input<typeof addPresupuestoSchema>,
): Promise<ObraResult<ObraData>> {
  try {
    const member = await requirePermission('obra:write')
    const parsed = addPresupuestoSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase.from('obra_presupuestos').insert({
      org_id: member.orgId,
      name: parsed.data.name,
      client: parsed.data.client || null,
      estado: 'borrador',
      valor_presupuestado: parsed.data.valorPresupuestado,
      fecha_inicio: parsed.data.fechaInicio || null,
      fecha_fin: parsed.data.fechaFin || null,
    })

    if (error) {
      console.error('[obra] addPresupuesto', error)
      return fail('No se pudo crear el presupuesto.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

const ESTADOS = ['borrador', 'aprobado', 'en_ejecucion', 'cerrado'] as const

export async function setPresupuestoEstado(
  id: string,
  estado: string,
): Promise<ObraResult<ObraData>> {
  try {
    const member = await requirePermission('obra:write')
    if (!z.uuid().safeParse(id).success) return fail('Presupuesto inválido.')
    const parsed = z.enum(ESTADOS).safeParse(estado)
    if (!parsed.success) return fail('Estado inválido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('obra_presupuestos')
      .update({ estado: parsed.data })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[obra] setPresupuestoEstado', error)
      return fail('No se pudo cambiar el estado.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function setPresupuestoValor(
  id: string,
  valorPresupuestado: unknown,
): Promise<ObraResult<ObraData>> {
  try {
    const member = await requirePermission('obra:write')
    if (!z.uuid().safeParse(id).success) return fail('Presupuesto inválido.')
    const parsed = money.safeParse(valorPresupuestado)
    if (!parsed.success) return fail('Valor inválido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('obra_presupuestos')
      .update({ valor_presupuestado: parsed.data })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[obra] setPresupuestoValor', error)
      return fail('No se pudo actualizar el valor.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deletePresupuesto(id: string): Promise<ObraResult<ObraData>> {
  try {
    const member = await requirePermission('obra:write')
    if (!z.uuid().safeParse(id).success) return fail('Presupuesto inválido.')

    const supabase = await createClient()
    // El borrado es en cascada: capítulos, APU y avances se van con él.
    const { error } = await supabase
      .from('obra_presupuestos')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[obra] deletePresupuesto', error)
      return fail('No se pudo eliminar el presupuesto.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/* ─── Capítulos ──────────────────────────────────────────────────────────── */

const addCapituloSchema = z.object({
  presupuestoId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  valorPresupuestado: money,
})

export async function addCapitulo(
  input: z.input<typeof addCapituloSchema>,
): Promise<ObraResult<ObraData>> {
  try {
    const member = await requirePermission('obra:write')
    const parsed = addCapituloSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    if (!(await ownedByOrg(supabase, 'obra_presupuestos', parsed.data.presupuestoId, member.orgId))) {
      return fail('Ese presupuesto no pertenece a tu organización.')
    }

    // `orden` es el índice del capítulo: cuenta los que ya existen y va al
    // final, así el UI nunca tiene que pasar números.
    const { count } = await supabase
      .from('obra_capitulos')
      .select('id', { count: 'exact', head: true })
      .eq('presupuesto_id', parsed.data.presupuestoId)

    const { error } = await supabase.from('obra_capitulos').insert({
      org_id: member.orgId,
      presupuesto_id: parsed.data.presupuestoId,
      name: parsed.data.name,
      orden: count ?? 0,
      valor_presupuestado: parsed.data.valorPresupuestado,
    })

    if (error) {
      console.error('[obra] addCapitulo', error)
      return fail('No se pudo crear el capítulo.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deleteCapitulo(id: string): Promise<ObraResult<ObraData>> {
  try {
    const member = await requirePermission('obra:write')
    if (!z.uuid().safeParse(id).success) return fail('Capítulo inválido.')

    const supabase = await createClient()
    const { data: row } = await supabase
      .from('obra_capitulos')
      .select('presupuesto_id')
      .eq('id', id)
      .eq('org_id', member.orgId)
      .maybeSingle()

    if (!row) return fail('Capítulo no encontrado.')

    // Cascada: APU y avances se van con el capítulo.
    const { error } = await supabase
      .from('obra_capitulos')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[obra] deleteCapitulo', error)
      return fail('No se pudo eliminar el capítulo.')
    }

    // El presupuesto vuelve a sumar lo que queda.
    await supabase.rpc('obra_resync_presupuesto', {
      p_presupuesto_id: (row as { presupuesto_id: string }).presupuesto_id,
    })

    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/* ─── APU ────────────────────────────────────────────────────────────────── */

const addApuSchema = z.object({
  capituloId: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  unidad: z.string().trim().min(1).max(20).default('und'),
  cantidad: z.coerce.number().positive(),
  materiales: money,
  manoObra: money,
  equipo: money,
  transporte: money,
})

export async function addApu(input: z.input<typeof addApuSchema>): Promise<ObraResult<ObraData>> {
  try {
    const member = await requirePermission('obra:write')
    const parsed = addApuSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    if (!(await ownedByOrg(supabase, 'obra_capitulos', parsed.data.capituloId, member.orgId))) {
      return fail('Ese capítulo no pertenece a tu organización.')
    }

    const { error } = await supabase.from('obra_apu').insert({
      org_id: member.orgId,
      capitulo_id: parsed.data.capituloId,
      name: parsed.data.name,
      unidad: parsed.data.unidad,
      cantidad: parsed.data.cantidad,
      materiales: parsed.data.materiales,
      mano_obra: parsed.data.manoObra,
      equipo: parsed.data.equipo,
      transporte: parsed.data.transporte,
    })

    if (error) {
      console.error('[obra] addApu', error)
      return fail('No se pudo registrar la partida.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deleteApu(id: string): Promise<ObraResult<ObraData>> {
  try {
    const member = await requirePermission('obra:write')
    if (!z.uuid().safeParse(id).success) return fail('Partida inválida.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('obra_apu')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[obra] deleteApu', error)
      return fail('No se pudo eliminar la partida.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/* ─── Avances ────────────────────────────────────────────────────────────── */

const addAvanceSchema = z.object({
  capituloId: z.string().uuid(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  avance: z.coerce.number().min(0).max(100),
  valor: money,
  notas: z.string().trim().max(500).default(''),
})

/**
 * Registra un corte de avance. La función SQL actualiza capítulo y
 * presupuesto en la misma transacción: el último corte ES el ejecutado.
 */
export async function addAvance(input: z.input<typeof addAvanceSchema>): Promise<ObraResult<ObraData>> {
  try {
    const member = await requirePermission('obra:write')
    const parsed = addAvanceSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    if (!(await ownedByOrg(supabase, 'obra_capitulos', parsed.data.capituloId, member.orgId))) {
      return fail('Ese capítulo no pertenece a tu organización.')
    }

    const { error } = await supabase.rpc('obra_register_avance', {
      p_capitulo_id: parsed.data.capituloId,
      p_fecha: parsed.data.fecha,
      p_avance: parsed.data.avance,
      p_valor: parsed.data.valor,
      p_notas: parsed.data.notas || null,
    })

    if (error) {
      console.error('[obra] addAvance', error)
      return fail('No se pudo registrar el avance.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deleteAvance(id: string): Promise<ObraResult<ObraData>> {
  try {
    await requirePermission('obra:write')
    if (!z.uuid().safeParse(id).success) return fail('Avance inválido.')

    const supabase = await createClient()
    const { error } = await supabase.rpc('obra_delete_avance', { p_id: id })

    if (error) {
      console.error('[obra] deleteAvance', error)
      return fail('No se pudo eliminar el avance.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}
