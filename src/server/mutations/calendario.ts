'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { EVENT_KINDS } from '@/lib/domain'
import { getCalendario, type CalendarioData } from '@/server/queries/calendario'

export type CalendarioResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const baseSchema = z.object({
  title: z.string().trim().min(2, 'El título es obligatorio.').max(200),
  kind: z.enum(EVENT_KINDS).default('Interna'),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }),
  location: z.string().trim().max(160).default(''),
  notes: z.string().trim().max(2000).default(''),
  /** The month the caller is looking at, so the reply matches the view. */
  monthIso: z.string().datetime({ offset: true }).nullable().default(null),
})

const updateSchema = baseSchema.extend({ id: z.uuid() })

/** Mirrors `calendar_events_range_ordered`, so the error is in Spanish. */
function rangeOrdered(startsAt: string, endsAt: string): boolean {
  return new Date(endsAt).getTime() > new Date(startsAt).getTime()
}

export async function createEvento(
  input: z.input<typeof baseSchema>,
): Promise<CalendarioResult<CalendarioData>> {
  try {
    const member = await requirePermission('calendario:write')
    const parsed = baseSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')
    if (!rangeOrdered(parsed.data.startsAt, parsed.data.endsAt)) {
      return fail('La reunión debe terminar después de empezar.')
    }

    const supabase = await createClient()
    const { error } = await supabase.from('calendar_events').insert({
      org_id: member.orgId,
      title: parsed.data.title,
      kind: parsed.data.kind,
      starts_at: parsed.data.startsAt,
      ends_at: parsed.data.endsAt,
      location: parsed.data.location,
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[calendario] createEvento', error)
      return fail('No se pudo agendar la reunión.')
    }

    revalidatePath('/dashboard/calendario')
    return { ok: true, data: await getCalendario(parsed.data.monthIso ?? undefined) }
  } catch {
    return fail('No tienes permiso para gestionar el calendario.')
  }
}

export async function updateEvento(
  input: z.input<typeof updateSchema>,
): Promise<CalendarioResult<CalendarioData>> {
  try {
    const member = await requirePermission('calendario:write')
    const parsed = updateSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')
    if (!rangeOrdered(parsed.data.startsAt, parsed.data.endsAt)) {
      return fail('La reunión debe terminar después de empezar.')
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('calendar_events')
      .update({
        title: parsed.data.title,
        kind: parsed.data.kind,
        starts_at: parsed.data.startsAt,
        ends_at: parsed.data.endsAt,
        location: parsed.data.location,
        notes: parsed.data.notes,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[calendario] updateEvento', error)
      return fail('No se pudo actualizar la reunión.')
    }

    revalidatePath('/dashboard/calendario')
    return { ok: true, data: await getCalendario(parsed.data.monthIso ?? undefined) }
  } catch {
    return fail('No tienes permiso para gestionar el calendario.')
  }
}

export async function deleteEvento(
  id: string,
  monthIso?: string,
): Promise<CalendarioResult<CalendarioData>> {
  try {
    const member = await requirePermission('calendario:write')
    if (!z.uuid().safeParse(id).success) return fail('Reunión desconocida.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('calendar_events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[calendario] deleteEvento', error)
      return fail('No se pudo eliminar la reunión.')
    }

    revalidatePath('/dashboard/calendario')
    return { ok: true, data: await getCalendario(monthIso) }
  } catch {
    return fail('No tienes permiso para gestionar el calendario.')
  }
}

/** Month navigation. The arrows used to be `disabled` with no month to go to. */
export async function fetchMonth(monthIso: string): Promise<CalendarioResult<CalendarioData>> {
  try {
    return { ok: true, data: await getCalendario(monthIso) }
  } catch {
    return fail('No tienes permiso para ver el calendario.')
  }
}

export type AttendeeResponse = 'Pendiente' | 'Aceptada' | 'Rechazada'

export interface CalendarioAttendee {
  id: string
  employeeId: string | null
  employeeName: string | null
  email: string | null
  response: AttendeeResponse
}

interface AttendeeRecord {
  id: string
  employee_id: string | null
  email: string | null
  response: AttendeeResponse
  employees: { full_name: string } | null
}

async function loadAttendees(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
): Promise<CalendarioAttendee[]> {
  const { data, error } = await supabase
    .from('calendar_attendees')
    .select('id, employee_id, email, response, employees ( full_name )')
    .eq('calendar_event_id', eventId)

  if (error) {
    console.error('[calendario] loadAttendees', error)
    return []
  }

  return ((data ?? []) as unknown as AttendeeRecord[]).map((a) => ({
    id: a.id,
    employeeId: a.employee_id,
    employeeName: a.employees?.full_name ?? null,
    email: a.email,
    response: a.response,
  }))
}

export async function fetchAttendance(
  eventId: string,
): Promise<CalendarioResult<CalendarioAttendee[]>> {
  try {
    await requirePermission('calendario:read')
    if (!z.uuid().safeParse(eventId).success) return fail('Reunión desconocida.')

    const supabase = await createClient()
    return { ok: true, data: await loadAttendees(supabase, eventId) }
  } catch {
    return fail('No tienes permiso para ver el calendario.')
  }
}

const addAttendeeSchema = z
  .object({
    calendarEventId: z.uuid(),
    employeeId: z.uuid().nullable().default(null),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Correo inválido.')
      .nullable()
      .default(null),
  })
  .refine((d) => Boolean(d.employeeId) !== Boolean(d.email), {
    message: 'Indica un empleado o un correo, no ambos.',
  })

export async function addAttendee(
  input: z.input<typeof addAttendeeSchema>,
): Promise<CalendarioResult<CalendarioAttendee[]>> {
  try {
    const member = await requirePermission('calendario:write')
    const parsed = addAttendeeSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase.from('calendar_attendees').insert({
      calendar_event_id: parsed.data.calendarEventId,
      employee_id: parsed.data.employeeId,
      email: parsed.data.email,
    })

    if (error) {
      console.error('[calendario] addAttendee', error)
      return fail('No se pudo agregar el asistente.')
    }

    revalidatePath('/dashboard/calendario')
    return { ok: true, data: await loadAttendees(supabase, parsed.data.calendarEventId) }
  } catch {
    return fail('No tienes permiso para gestionar el calendario.')
  }
}

const RESPONSES = ['Pendiente', 'Aceptada', 'Rechazada'] as const

export async function setAttendeeResponse(
  id: string,
  response: AttendeeResponse,
): Promise<CalendarioResult<null>> {
  try {
    const member = await requirePermission('calendario:write')
    if (!z.uuid().safeParse(id).success) return fail('Asistente desconocido.')
    const parsed = z.enum(RESPONSES).safeParse(response)
    if (!parsed.success) return fail('Respuesta inválida.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('calendar_attendees')
      .update({ response: parsed.data })
      .eq('id', id)

    if (error) {
      console.error('[calendario] setAttendeeResponse', error)
      return fail('No se pudo actualizar la asistencia.')
    }

    revalidatePath('/dashboard/calendario')
    return { ok: true, data: null }
  } catch {
    return fail('No tienes permiso para gestionar el calendario.')
  }
}

export async function removeAttendee(
  id: string,
): Promise<CalendarioResult<CalendarioAttendee[]>> {
  try {
    const member = await requirePermission('calendario:write')
    if (!z.uuid().safeParse(id).success) return fail('Asistente desconocido.')

    const supabase = await createClient()
    const { data: deleted, error } = await supabase
      .from('calendar_attendees')
      .delete()
      .eq('id', id)
      .select('calendar_event_id')
      .maybeSingle()

    if (error) {
      console.error('[calendario] removeAttendee', error)
      return fail('No se pudo quitar el asistente.')
    }
    if (!deleted) return fail('El asistente ya no está en el evento.')

    revalidatePath('/dashboard/calendario')
    return { ok: true, data: await loadAttendees(supabase, deleted.calendar_event_id) }
  } catch {
    return fail('No tienes permiso para gestionar el calendario.')
  }
}
