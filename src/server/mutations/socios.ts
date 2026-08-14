'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import {
  CHECKIN_METHODS, CLASS_BOOKING_STATUSES, CLASS_STATUSES,
  MEMBER_STATUSES, PLAN_BILLINGS, SUBSCRIPTION_STATUSES,
} from '@/lib/domain'
import { getSocios, type SociosData } from '@/server/queries/socios'

export type SociosResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const DENIED = 'No tienes permiso para gestionar socios.'

/**
 * Cada escritura vuelve a leer la pantalla entera.
 *
 * El mismo patrón que hotelería y restaurante, y por la misma razón: casi todo
 * lo que se muestra aquí es derivado —- cuántos están al día, cuántos vencen
 * esta semana, cuánto cupo queda en una clase—, así que devolver solo la fila
 * tocada dejaría los contadores mintiendo hasta la siguiente recarga.
 */
async function refreshed(): Promise<SociosResult<SociosData>> {
  revalidatePath('/dashboard/socios')
  return { ok: true, data: await getSocios() }
}

/* ─── Socios ───────────────────────────────────────────────────────────── */

const memberSchema = z.object({
  fullName: z.string().trim().min(1, 'Escribe el nombre del socio.').max(160),
  documentId: z.string().trim().max(40).default(''),
  // Vacío se guarda como null, no como ''. «No lo preguntamos» y «no tiene
  // correo» son hechos distintos, y la columna tiene un check que exige
  // minúsculas: un '' pasaría y un 'A@B.com' no, que es la peor combinación.
  email: z.string().trim().toLowerCase().max(160).nullish(),
  phone: z.string().trim().max(40).default(''),
  birthDate: z.string().trim().nullish(),
  status: z.enum(MEMBER_STATUSES).default('Activo'),
  notes: z.string().trim().max(1000).default(''),
})

export async function createSocio(
  input: z.input<typeof memberSchema>,
): Promise<SociosResult<SociosData>> {
  try {
    const member = await requirePermission('socios:write')
    const parsed = memberSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    // `code` va ausente a propósito: el trigger `fitness_members_code` lo
    // genera (SOC-00001) cuando llega nulo o vacío.
    const { error } = await supabase.from('fitness_members').insert({
      org_id: member.orgId,
      full_name: parsed.data.fullName,
      document_id: parsed.data.documentId,
      email: parsed.data.email || null,
      phone: parsed.data.phone,
      birth_date: parsed.data.birthDate || null,
      status: parsed.data.status,
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[socios] createSocio', error)
      return fail('No se pudo crear el socio.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

const updateMemberSchema = memberSchema.extend({ id: z.uuid() })

export async function updateSocio(
  input: z.input<typeof updateMemberSchema>,
): Promise<SociosResult<SociosData>> {
  try {
    const member = await requirePermission('socios:write')
    const parsed = updateMemberSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('fitness_members')
      .update({
        full_name: parsed.data.fullName,
        document_id: parsed.data.documentId,
        email: parsed.data.email || null,
        phone: parsed.data.phone,
        birth_date: parsed.data.birthDate || null,
        status: parsed.data.status,
        notes: parsed.data.notes,
      })
      .eq('id', parsed.data.id)
      // El `org_id` va además de la política de RLS, no en su lugar: la
      // política ya impide tocar otra empresa, y este filtro hace que el
      // intento actualice cero filas en vez de apoyarse solo en ella.
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[socios] updateSocio', error)
      return fail('No se pudo actualizar el socio.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deleteSocio(id: string): Promise<SociosResult<SociosData>> {
  try {
    const member = await requirePermission('socios:write')
    if (!z.uuid().safeParse(id).success) return fail('Socio inválido.')

    const supabase = await createClient()
    // Borrado suave. Un socio con historial de pagos y entradas no debe
    // desaparecer de la contabilidad porque alguien lo quitó de la lista; para
    // «se fue del centro» está el estado «Retirado», que es otra cosa.
    const { error } = await supabase
      .from('fitness_members')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[socios] deleteSocio', error)
      return fail('No se pudo eliminar el socio.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/* ─── Planes ───────────────────────────────────────────────────────────── */

const planSchema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre del plan.').max(120),
  description: z.string().trim().max(500).default(''),
  priceCents: z.coerce.number().int().min(0).default(0),
  billing: z.enum(PLAN_BILLINGS).default('Mensual'),
  credits: z.coerce.number().int().min(1).max(1000).nullable().default(null),
  durationDays: z.coerce.number().int().min(1).max(3650).default(30),
  active: z.coerce.boolean().default(true),
})

/**
 * Los créditos solo significan algo en un bono.
 *
 * Una mensualidad con «10 créditos» es una contradicción que la pantalla
 * dejaría entrar y que después nadie sabría interpretar: ¿son diez entradas o
 * es un mes? Se limpia al guardar en vez de rechazarse, porque cambiar de
 * «Bono» a «Mensual» en el formulario deja el número ahí y no es un error del
 * usuario, es un campo que dejó de aplicar.
 */
function creditsFor(billing: string, credits: number | null): number | null {
  return billing === 'Bono' ? credits : null
}

export async function createPlan(
  input: z.input<typeof planSchema>,
): Promise<SociosResult<SociosData>> {
  try {
    const member = await requirePermission('socios:write')
    const parsed = planSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase.from('fitness_plans').insert({
      org_id: member.orgId,
      name: parsed.data.name,
      description: parsed.data.description,
      price_cents: parsed.data.priceCents,
      billing: parsed.data.billing,
      credits: creditsFor(parsed.data.billing, parsed.data.credits),
      duration_days: parsed.data.durationDays,
      active: parsed.data.active,
    })

    if (error) {
      console.error('[socios] createPlan', error)
      return fail('No se pudo crear el plan.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

const updatePlanSchema = planSchema.extend({ id: z.uuid() })

export async function updatePlan(
  input: z.input<typeof updatePlanSchema>,
): Promise<SociosResult<SociosData>> {
  try {
    const member = await requirePermission('socios:write')
    const parsed = updatePlanSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('fitness_plans')
      .update({
        name: parsed.data.name,
        description: parsed.data.description,
        price_cents: parsed.data.priceCents,
        billing: parsed.data.billing,
        credits: creditsFor(parsed.data.billing, parsed.data.credits),
        duration_days: parsed.data.durationDays,
        active: parsed.data.active,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[socios] updatePlan', error)
      return fail('No se pudo actualizar el plan.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deletePlan(id: string): Promise<SociosResult<SociosData>> {
  try {
    const member = await requirePermission('socios:write')
    if (!z.uuid().safeParse(id).success) return fail('Plan inválido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('fitness_plans')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[socios] deletePlan', error)
      return fail('No se pudo eliminar el plan.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/* ─── Membresías ───────────────────────────────────────────────────────── */

const subscriptionSchema = z.object({
  memberId: z.uuid('Elige un socio.'),
  planId: z.uuid('Elige un plan.'),
  startsOn: z.string().trim().min(1, 'Elige la fecha de inicio.'),
  paid: z.coerce.boolean().default(false),
})

/**
 * Vender una membresía.
 *
 * La vigencia y el precio se calculan aquí desde el plan, no se reciben del
 * navegador: son el objeto del cobro, y aceptarlos del cliente sería dejar que
 * cualquiera se venda un año por cero pesos. El nombre y el precio se *copian*
 * a la fila —- ver la migración 42—, así que subir el precio del plan mañana no
 * reescribe lo que este socio pagó hoy.
 */
export async function venderMembresia(
  input: z.input<typeof subscriptionSchema>,
): Promise<SociosResult<SociosData>> {
  try {
    const member = await requirePermission('socios:write')
    const parsed = subscriptionSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    // Ambas lecturas filtran por empresa: el socio y el plan tienen que ser de
    // aquí. Sin esto, un id adivinado de otra empresa vendería su plan.
    const [{ data: plan }, { data: socio }] = await Promise.all([
      supabase
        .from('fitness_plans')
        .select('id, name, price_cents, credits, duration_days')
        .eq('id', parsed.data.planId)
        .eq('org_id', member.orgId)
        .is('deleted_at', null)
        .maybeSingle(),
      supabase
        .from('fitness_members')
        .select('id')
        .eq('id', parsed.data.memberId)
        .eq('org_id', member.orgId)
        .is('deleted_at', null)
        .maybeSingle(),
    ])

    if (!plan) return fail('Ese plan no existe en esta empresa.')
    if (!socio) return fail('Ese socio no existe en esta empresa.')

    const starts = new Date(`${parsed.data.startsOn}T00:00:00`)
    if (Number.isNaN(starts.getTime())) return fail('La fecha de inicio no es válida.')
    const ends = new Date(starts)
    ends.setDate(ends.getDate() + plan.duration_days)

    const { error } = await supabase.from('fitness_subscriptions').insert({
      member_id: parsed.data.memberId,
      plan_id: plan.id,
      plan_name: plan.name,
      price_cents: plan.price_cents,
      starts_on: parsed.data.startsOn,
      ends_on: ends.toISOString().slice(0, 10),
      credits_left: plan.credits,
      status: 'Vigente',
      paid: parsed.data.paid,
    })

    if (error) {
      console.error('[socios] venderMembresia', error)
      return fail('No se pudo registrar la membresía.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

const subscriptionStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(SUBSCRIPTION_STATUSES),
  paid: z.coerce.boolean().optional(),
})

export async function actualizarMembresia(
  input: z.input<typeof subscriptionStatusSchema>,
): Promise<SociosResult<SociosData>> {
  try {
    await requirePermission('socios:write')
    const parsed = subscriptionStatusSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    // Sin `.eq('org_id')`: la tabla es hija y no tiene la columna. Su
    // aislamiento viene de la política que mira `fitness_members` del padre,
    // que es el contrato de `app.apply_child_rls`.
    const { error } = await supabase
      .from('fitness_subscriptions')
      .update({
        status: parsed.data.status,
        ...(parsed.data.paid === undefined ? {} : { paid: parsed.data.paid }),
      })
      .eq('id', parsed.data.id)

    if (error) {
      console.error('[socios] actualizarMembresia', error)
      return fail('No se pudo actualizar la membresía.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/* ─── Clases ───────────────────────────────────────────────────────────── */

const classSchema = z.object({
  name: z.string().trim().min(1, 'Escribe el nombre de la clase.').max(120),
  instructorId: z.uuid().nullable().default(null),
  startsAt: z.string().trim().min(1, 'Elige fecha y hora.'),
  durationMin: z.coerce.number().int().min(5).max(600).default(60),
  capacity: z.coerce.number().int().min(1).max(500).default(20),
  room: z.string().trim().max(80).default(''),
  status: z.enum(CLASS_STATUSES).default('Programada'),
  notes: z.string().trim().max(1000).default(''),
})

export async function createClase(
  input: z.input<typeof classSchema>,
): Promise<SociosResult<SociosData>> {
  try {
    const member = await requirePermission('socios:write')
    const parsed = classSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase.from('fitness_classes').insert({
      org_id: member.orgId,
      name: parsed.data.name,
      instructor_id: parsed.data.instructorId,
      starts_at: parsed.data.startsAt,
      duration_min: parsed.data.durationMin,
      capacity: parsed.data.capacity,
      room: parsed.data.room,
      status: parsed.data.status,
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[socios] createClase', error)
      return fail('No se pudo crear la clase.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

const updateClassSchema = classSchema.extend({ id: z.uuid() })

export async function updateClase(
  input: z.input<typeof updateClassSchema>,
): Promise<SociosResult<SociosData>> {
  try {
    const member = await requirePermission('socios:write')
    const parsed = updateClassSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('fitness_classes')
      .update({
        name: parsed.data.name,
        instructor_id: parsed.data.instructorId,
        starts_at: parsed.data.startsAt,
        duration_min: parsed.data.durationMin,
        capacity: parsed.data.capacity,
        room: parsed.data.room,
        status: parsed.data.status,
        notes: parsed.data.notes,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[socios] updateClase', error)
      return fail('No se pudo actualizar la clase.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deleteClase(id: string): Promise<SociosResult<SociosData>> {
  try {
    const member = await requirePermission('socios:write')
    if (!z.uuid().safeParse(id).success) return fail('Clase inválida.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('fitness_classes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[socios] deleteClase', error)
      return fail('No se pudo eliminar la clase.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/* ─── Reservas ─────────────────────────────────────────────────────────── */

const bookingSchema = z.object({
  classId: z.uuid('Elige una clase.'),
  memberId: z.uuid('Elige un socio.'),
})

/**
 * Reservar un cupo, o entrar en la lista de espera.
 *
 * El estado lo decide el servidor comparando reservas vivas contra el cupo, no
 * el navegador. Es la única forma de que dos personas reservando el último
 * lugar al mismo tiempo no obtengan las dos un «Reservada»: aquí la segunda
 * lee un conteo ya actualizado y cae en «En espera».
 *
 * No es un candado —- dos inserciones simultáneas todavía pueden pasar la
 * comprobación—, y eso está bien para un estudio de veinte cupos: el peor caso
 * es un cupo de más que el profesor resuelve en la puerta. Un candado de
 * verdad sería una transacción con `select … for update`, que cuesta más de lo
 * que este problema vale.
 */
export async function reservarClase(
  input: z.input<typeof bookingSchema>,
): Promise<SociosResult<SociosData>> {
  try {
    const member = await requirePermission('socios:write')
    const parsed = bookingSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    const { data: clase } = await supabase
      .from('fitness_classes')
      .select('id, capacity, status')
      .eq('id', parsed.data.classId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!clase) return fail('Esa clase no existe en esta empresa.')
    if (clase.status === 'Cancelada') return fail('Esa clase está cancelada.')

    const { data: socio } = await supabase
      .from('fitness_members')
      .select('id')
      .eq('id', parsed.data.memberId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!socio) return fail('Ese socio no existe en esta empresa.')

    const { count } = await supabase
      .from('fitness_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('class_id', parsed.data.classId)
      .not('status', 'in', '("En espera","Cancelada")')

    const status = (count ?? 0) >= clase.capacity ? 'En espera' : 'Reservada'

    const { error } = await supabase.from('fitness_bookings').insert({
      class_id: parsed.data.classId,
      member_id: parsed.data.memberId,
      status,
    })

    if (error) {
      console.error('[socios] reservarClase', error)
      // El índice único (class_id, member_id) de la migración 42.
      if (error.code === '23505') return fail('Ese socio ya tiene un cupo en esta clase.')
      return fail('No se pudo reservar el cupo.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

const bookingStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(CLASS_BOOKING_STATUSES),
})

export async function actualizarReserva(
  input: z.input<typeof bookingStatusSchema>,
): Promise<SociosResult<SociosData>> {
  try {
    await requirePermission('socios:write')
    const parsed = bookingStatusSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('fitness_bookings')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.id)

    if (error) {
      console.error('[socios] actualizarReserva', error)
      return fail('No se pudo actualizar la reserva.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/* ─── Entradas ─────────────────────────────────────────────────────────── */

const checkinSchema = z.object({
  memberId: z.uuid('Elige un socio.'),
  classId: z.uuid().nullable().default(null),
  method: z.enum(CHECKIN_METHODS).default('Manual'),
})

/**
 * Registrar una entrada, y descontar el bono si el plan es de créditos.
 *
 * La entrada se registra aunque la membresía esté vencida o no exista. El
 * centro decide en la puerta si deja pasar a alguien que debe; el software que
 * se lo impide obliga a llevar esa entrada en un cuaderno, y entonces el
 * registro deja de servir para nada. Lo que sí hace la pantalla es decirlo.
 */
export async function registrarEntrada(
  input: z.input<typeof checkinSchema>,
): Promise<SociosResult<SociosData>> {
  try {
    const member = await requirePermission('socios:write')
    const parsed = checkinSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    const { data: socio } = await supabase
      .from('fitness_members')
      .select('id')
      .eq('id', parsed.data.memberId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!socio) return fail('Ese socio no existe en esta empresa.')

    const { error } = await supabase.from('fitness_checkins').insert({
      member_id: parsed.data.memberId,
      class_id: parsed.data.classId,
      method: parsed.data.method,
    })

    if (error) {
      console.error('[socios] registrarEntrada', error)
      return fail('No se pudo registrar la entrada.')
    }

    // Descuento del bono, después de que la entrada quedó. Si esto falla, la
    // entrada sigue registrada y el crédito no se descontó — que es el error
    // barato de los dos: se corrige a mano, mientras que perder el registro de
    // quién entró no se corrige de ninguna forma.
    const { data: vigente } = await supabase
      .from('fitness_subscriptions')
      .select('id, credits_left')
      .eq('member_id', parsed.data.memberId)
      .eq('status', 'Vigente')
      .not('credits_left', 'is', null)
      .gt('credits_left', 0)
      .order('ends_on', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (vigente?.credits_left) {
      const left = vigente.credits_left - 1
      await supabase
        .from('fitness_subscriptions')
        .update({ credits_left: left, ...(left === 0 ? { status: 'Vencida' } : {}) })
        .eq('id', vigente.id)
    }

    return refreshed()
  } catch {
    return fail(DENIED)
  }
}
