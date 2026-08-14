'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { RESERVATION_STATUSES, ROOM_KINDS, ROOM_STATUSES } from '@/lib/domain'
import { getHoteleria, nightsBetween, type HoteleriaData } from '@/server/queries/hoteleria'

export type HoteleriaResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

/* ─── Rooms ────────────────────────────────────────────────────────────── */

const roomSchema = z.object({
  number: z.string().trim().min(1, 'Escribe el número de habitación.').max(20),
  kind: z.enum(ROOM_KINDS).default('Sencilla'),
  floor: z.coerce.number().int().min(-10).max(200).nullable().default(null),
  capacity: z.coerce.number().int().min(1).max(20).default(2),
  rateCents: z.coerce.number().int().min(0).default(0),
  amenities: z.string().trim().max(500).default(''),
  notes: z.string().trim().max(1000).default(''),
})

export async function createHabitacion(
  input: z.input<typeof roomSchema>,
): Promise<HoteleriaResult<HoteleriaData>> {
  try {
    const member = await requirePermission('hoteleria:write')
    const parsed = roomSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase.from('hotel_rooms').insert({
      org_id: member.orgId,
      number: parsed.data.number,
      kind: parsed.data.kind,
      floor: parsed.data.floor,
      capacity: parsed.data.capacity,
      rate_cents: parsed.data.rateCents,
      amenities: parsed.data.amenities,
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[hoteleria] createHabitacion', error)
      if (error.code === '23505') return fail('Ya existe una habitación con ese número.')
      return fail('No se pudo crear la habitación.')
    }

    revalidatePath('/dashboard/hoteleria')
    return { ok: true, data: await getHoteleria() }
  } catch {
    return fail('No tienes permiso para gestionar hotelería.')
  }
}

const updateRoomSchema = roomSchema.extend({ id: z.uuid() })

export async function updateHabitacion(
  input: z.input<typeof updateRoomSchema>,
): Promise<HoteleriaResult<HoteleriaData>> {
  try {
    const member = await requirePermission('hoteleria:write')
    const parsed = updateRoomSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('hotel_rooms')
      .update({
        number: parsed.data.number,
        kind: parsed.data.kind,
        floor: parsed.data.floor,
        capacity: parsed.data.capacity,
        rate_cents: parsed.data.rateCents,
        amenities: parsed.data.amenities,
        notes: parsed.data.notes,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[hoteleria] updateHabitacion', error)
      if (error.code === '23505') return fail('Ya existe una habitación con ese número.')
      return fail('No se pudo actualizar la habitación.')
    }

    revalidatePath('/dashboard/hoteleria')
    return { ok: true, data: await getHoteleria() }
  } catch {
    return fail('No tienes permiso para gestionar hotelería.')
  }
}

const roomStatusSchema = z.object({ id: z.uuid(), status: z.enum(ROOM_STATUSES) })

export async function setHabitacionStatus(
  input: z.input<typeof roomStatusSchema>,
): Promise<HoteleriaResult<HoteleriaData>> {
  try {
    const member = await requirePermission('hoteleria:write')
    const parsed = roomStatusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('hotel_rooms')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[hoteleria] setHabitacionStatus', error)
      return fail('No se pudo actualizar la habitación.')
    }

    revalidatePath('/dashboard/hoteleria')
    return { ok: true, data: await getHoteleria() }
  } catch {
    return fail('No tienes permiso para gestionar hotelería.')
  }
}

export async function deleteHabitacion(id: string): Promise<HoteleriaResult<HoteleriaData>> {
  try {
    const member = await requirePermission('hoteleria:write')
    if (!z.uuid().safeParse(id).success) return fail('Habitación desconocida.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('hotel_rooms')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[hoteleria] deleteHabitacion', error)
      return fail('No se pudo eliminar la habitación.')
    }

    revalidatePath('/dashboard/hoteleria')
    return { ok: true, data: await getHoteleria() }
  } catch {
    return fail('No tienes permiso para gestionar hotelería.')
  }
}

/* ─── Reservations ─────────────────────────────────────────────────────── */

const reservationSchema = z.object({
  roomId: z.uuid('Elige la habitación.'),
  guestName: z.string().trim().min(2, 'Escribe el nombre del huésped.').max(160),
  guestDocument: z.string().trim().max(40).default(''),
  guestEmail: z.email('Escribe un correo válido.').max(160).toLowerCase().nullable().default(null),
  guestPhone: z.string().trim().max(40).default(''),
  guests: z.coerce.number().int().min(1).max(20).default(1),
  checkinOn: z.string().date(),
  checkoutOn: z.string().date(),
  nightlyRateCents: z.coerce.number().int().min(0).default(0),
  paidCents: z.coerce.number().int().min(0).default(0),
  channel: z.string().trim().max(80).default(''),
  notes: z.string().trim().max(1000).default(''),
})

export async function createReserva(
  input: z.input<typeof reservationSchema>,
): Promise<HoteleriaResult<HoteleriaData>> {
  try {
    const member = await requirePermission('hoteleria:write')
    const parsed = reservationSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    // Mirrors `reservations_nights_positive`. A same-day checkout is not a
    // stay, and the constraint would otherwise surface as an opaque error.
    if (parsed.data.checkoutOn <= parsed.data.checkinOn) {
      return fail('La salida debe ser al menos un día después de la entrada.')
    }

    const supabase = await createClient()
    const { data: room } = await supabase
      .from('hotel_rooms')
      .select('id, capacity, rate_cents')
      .eq('id', parsed.data.roomId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!room) return fail('Esa habitación no existe en tu organización.')
    if (parsed.data.guests > room.capacity) {
      return fail(`Esa habitación admite ${room.capacity} personas.`)
    }

    /**
     * Double booking.
     *
     * Two stays overlap when each starts before the other ends — and checkout
     * day is not a night, so the comparison is strict on both sides: a guest
     * leaving on the 10th and another arriving on the 10th is a normal
     * turnover, not a clash.
     */
    const { data: clash } = await supabase
      .from('reservations')
      .select('id, code, checkin_on, checkout_on')
      .eq('room_id', parsed.data.roomId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .not('status', 'in', '("Cancelada","No show","Check-out")')
      .lt('checkin_on', parsed.data.checkoutOn)
      .gt('checkout_on', parsed.data.checkinOn)
      .limit(1)
      .maybeSingle()

    if (clash) {
      return fail(
        `Esa habitación ya está reservada del ${clash.checkin_on} al ${clash.checkout_on}.`,
      )
    }

    const rate = parsed.data.nightlyRateCents > 0 ? parsed.data.nightlyRateCents : room.rate_cents
    const nights = nightsBetween(parsed.data.checkinOn, parsed.data.checkoutOn)
    const total = rate * nights

    if (parsed.data.paidCents > total) {
      return fail('El anticipo no puede superar el total de la reserva.')
    }

    const { error } = await supabase.from('reservations').insert({
      org_id: member.orgId,
      room_id: parsed.data.roomId,
      guest_name: parsed.data.guestName,
      guest_document: parsed.data.guestDocument,
      guest_email: parsed.data.guestEmail,
      guest_phone: parsed.data.guestPhone,
      status: 'Confirmada',
      guests: parsed.data.guests,
      checkin_on: parsed.data.checkinOn,
      checkout_on: parsed.data.checkoutOn,
      nightly_rate_cents: rate,
      total_cents: total,
      paid_cents: parsed.data.paidCents,
      channel: parsed.data.channel,
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[hoteleria] createReserva', error)
      return fail('No se pudo crear la reserva.')
    }

    revalidatePath('/dashboard/hoteleria')
    return { ok: true, data: await getHoteleria() }
  } catch {
    return fail('No tienes permiso para gestionar hotelería.')
  }
}

const updateReservationSchema = reservationSchema.extend({ id: z.uuid() })

export async function updateReserva(
  input: z.input<typeof updateReservationSchema>,
): Promise<HoteleriaResult<HoteleriaData>> {
  try {
    const member = await requirePermission('hoteleria:write')
    const parsed = updateReservationSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    if (parsed.data.checkoutOn <= parsed.data.checkinOn) {
      return fail('La salida debe ser al menos un día después de la entrada.')
    }

    const supabase = await createClient()
    const { data: room } = await supabase
      .from('hotel_rooms')
      .select('id, capacity, rate_cents')
      .eq('id', parsed.data.roomId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!room) return fail('Esa habitación no existe en tu organización.')
    if (parsed.data.guests > room.capacity) {
      return fail(`Esa habitación admite ${room.capacity} personas.`)
    }

    const { data: clash } = await supabase
      .from('reservations')
      .select('id, code, checkin_on, checkout_on')
      .eq('room_id', parsed.data.roomId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .neq('id', parsed.data.id)
      .not('status', 'in', '("Cancelada","No show","Check-out")')
      .lt('checkin_on', parsed.data.checkoutOn)
      .gt('checkout_on', parsed.data.checkinOn)
      .limit(1)
      .maybeSingle()

    if (clash) {
      return fail(
        `Esa habitación ya está reservada del ${clash.checkin_on} al ${clash.checkout_on}.`,
      )
    }

    const rate = parsed.data.nightlyRateCents > 0 ? parsed.data.nightlyRateCents : room.rate_cents
    const nights = nightsBetween(parsed.data.checkinOn, parsed.data.checkoutOn)
    const total = rate * nights

    if (parsed.data.paidCents > total) {
      return fail('El anticipo no puede superar el total de la reserva.')
    }

    const { error } = await supabase
      .from('reservations')
      .update({
        room_id: parsed.data.roomId,
        guest_name: parsed.data.guestName,
        guest_document: parsed.data.guestDocument,
        guest_email: parsed.data.guestEmail,
        guest_phone: parsed.data.guestPhone,
        guests: parsed.data.guests,
        checkin_on: parsed.data.checkinOn,
        checkout_on: parsed.data.checkoutOn,
        nightly_rate_cents: rate,
        total_cents: total,
        paid_cents: parsed.data.paidCents,
        channel: parsed.data.channel,
        notes: parsed.data.notes,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[hoteleria] updateReserva', error)
      return fail('No se pudo actualizar la reserva.')
    }

    revalidatePath('/dashboard/hoteleria')
    return { ok: true, data: await getHoteleria() }
  } catch {
    return fail('No tienes permiso para gestionar hotelería.')
  }
}

const reservationStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(RESERVATION_STATUSES),
  paidCents: z.coerce.number().int().min(0).nullable().default(null),
})

/**
 * Moves a reservation along, and keeps the room in step with it.
 *
 * Check-in occupies the room, check-out sends it to housekeeping rather than
 * straight back to available — a room is not sellable until it has been
 * cleaned, and a front desk that has to remember that will forget it.
 */
export async function setReservaStatus(
  input: z.input<typeof reservationStatusSchema>,
): Promise<HoteleriaResult<HoteleriaData>> {
  try {
    const member = await requirePermission('hoteleria:write')
    const parsed = reservationStatusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { data: reservation } = await supabase
      .from('reservations')
      .select('id, room_id, total_cents, paid_cents')
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!reservation) return fail('Esa reserva no existe en tu organización.')

    const paid = parsed.data.paidCents ?? reservation.paid_cents
    if (paid > reservation.total_cents) {
      return fail('Lo pagado no puede superar el total de la reserva.')
    }

    const { error } = await supabase
      .from('reservations')
      .update({ status: parsed.data.status, paid_cents: paid })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[hoteleria] setReservaStatus', error)
      return fail('No se pudo actualizar la reserva.')
    }

    const roomStatus =
      parsed.data.status === 'Check-in' ? 'Ocupada'
        : parsed.data.status === 'Check-out' ? 'Limpieza'
        : parsed.data.status === 'Cancelada' || parsed.data.status === 'No show' ? 'Disponible'
        : null

    if (roomStatus) {
      await supabase
        .from('hotel_rooms')
        .update({ status: roomStatus })
        .eq('id', reservation.room_id)
        .eq('org_id', member.orgId)
    }

    revalidatePath('/dashboard/hoteleria')
    return { ok: true, data: await getHoteleria() }
  } catch {
    return fail('No tienes permiso para gestionar hotelería.')
  }
}

/* ─── Limpieza ─────────────────────────────────────────────────────────── */

const TASK_KINDS = ['Limpieza', 'Cambio de ropa', 'Revisión', 'Aseo profundo'] as const

const tareaSchema = z.object({
  roomId: z.uuid('Elige la habitación.'),
  assignedId: z.uuid().nullable().default(null),
  kind: z.enum(TASK_KINDS),
  scheduledOn: z.string().date('Elige una fecha.'),
  notes: z.string().trim().max(1000).default(''),
})

export async function createTareaLimpieza(
  input: z.input<typeof tareaSchema>,
): Promise<HoteleriaResult<HoteleriaData>> {
  try {
    const member = await requirePermission('hoteleria:write')
    const parsed = tareaSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { data: room } = await supabase
      .from('hotel_rooms')
      .select('id')
      .eq('id', parsed.data.roomId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!room) return fail('Esa habitación no existe en tu organización.')

    if (parsed.data.assignedId) {
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('id', parsed.data.assignedId)
        .is('deleted_at', null)
        .maybeSingle()
      if (!employee) return fail('Ese empleado no existe en tu organización.')
    }

    const { error } = await supabase.from('room_cleaning_tasks' as never).insert({
      room_id: parsed.data.roomId,
      assigned_id: parsed.data.assignedId,
      kind: parsed.data.kind,
      scheduled_on: parsed.data.scheduledOn,
      notes: parsed.data.notes,
    } as never)

    if (error) {
      console.error('[hoteleria] createTareaLimpieza', error)
      return fail('No se pudo crear la tarea de limpieza.')
    }

    revalidatePath('/dashboard/hoteleria')
    return { ok: true, data: await getHoteleria() }
  } catch {
    return fail('No tienes permiso para gestionar hotelería.')
  }
}

const tareaDoneSchema = z.object({ id: z.uuid(), done: z.boolean() })

export async function setTareaDone(
  input: z.input<typeof tareaDoneSchema>,
): Promise<HoteleriaResult<HoteleriaData>> {
  try {
    const member = await requirePermission('hoteleria:write')
    const parsed = tareaDoneSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase
      .from('room_cleaning_tasks' as never)
      .update({ done: parsed.data.done, done_on: parsed.data.done ? today : null } as never)
      .eq('id', parsed.data.id)

    if (error) {
      console.error('[hoteleria] setTareaDone', error)
      return fail('No se pudo actualizar la tarea de limpieza.')
    }

    revalidatePath('/dashboard/hoteleria')
    return { ok: true, data: await getHoteleria() }
  } catch {
    return fail('No tienes permiso para gestionar hotelería.')
  }
}

const tareaFechaSchema = z.object({
  id: z.uuid(),
  scheduledOn: z.string().date('Elige una fecha.'),
})

export async function setTareaFecha(
  input: z.input<typeof tareaFechaSchema>,
): Promise<HoteleriaResult<HoteleriaData>> {
  try {
    const member = await requirePermission('hoteleria:write')
    const parsed = tareaFechaSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('room_cleaning_tasks' as never)
      .update({ scheduled_on: parsed.data.scheduledOn } as never)
      .eq('id', parsed.data.id)

    if (error) {
      console.error('[hoteleria] setTareaFecha', error)
      return fail('No se pudo reprogramar la tarea de limpieza.')
    }

    revalidatePath('/dashboard/hoteleria')
    return { ok: true, data: await getHoteleria() }
  } catch {
    return fail('No tienes permiso para gestionar hotelería.')
  }
}

export async function deleteTarea(id: string): Promise<HoteleriaResult<HoteleriaData>> {
  try {
    const member = await requirePermission('hoteleria:write')
    if (!z.uuid().safeParse(id).success) return fail('Tarea desconocida.')

    const supabase = await createClient()
    const { error } = await supabase.from('room_cleaning_tasks' as never).delete().eq('id', id)

    if (error) {
      console.error('[hoteleria] deleteTarea', error)
      return fail('No se pudo eliminar la tarea de limpieza.')
    }

    revalidatePath('/dashboard/hoteleria')
    return { ok: true, data: await getHoteleria() }
  } catch {
    return fail('No tienes permiso para gestionar hotelería.')
  }
}
