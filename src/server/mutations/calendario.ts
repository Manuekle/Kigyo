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
