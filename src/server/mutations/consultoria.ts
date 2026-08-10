'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { CONSULTATION_CATEGORIES, CONSULTATION_STATUSES } from '@/lib/domain'
import { belongsToOrg } from '@/server/queries/shared'
import { getConsultoria, type ConsultoriaData } from '@/server/queries/consultoria'

export type ConsultoriaResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const createSchema = z.object({
  topic: z.string().trim().min(3, 'Describe el tema de la consulta.').max(200),
  requesterId: z.uuid().nullable().default(null),
  category: z.enum(CONSULTATION_CATEGORIES).default('Otro'),
  advisor: z.string().trim().max(120).default(''),
})

export async function createConsulta(
  input: z.input<typeof createSchema>,
): Promise<ConsultoriaResult<ConsultoriaData>> {
  try {
    const member = await requirePermission('consultoria:write')
    const parsed = createSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    if (!(await belongsToOrg(supabase, 'employees', parsed.data.requesterId, member.orgId))) {
      return fail('Esa persona no está en el equipo de tu organización.')
    }

    const { error } = await supabase.from('consultations').insert({
      org_id: member.orgId,
      topic: parsed.data.topic,
      requester_id: parsed.data.requesterId,
      category: parsed.data.category,
      advisor: parsed.data.advisor,
      status: 'Agendada',
    })

    if (error) {
      console.error('[consultoria] createConsulta', error)
      return fail('No se pudo registrar la consulta.')
    }

    revalidatePath('/dashboard/consultoria')
    return { ok: true, data: await getConsultoria() }
  } catch {
    return fail('No tienes permiso para gestionar consultoría.')
  }
}

const statusSchema = z.object({
  id: z.uuid(),
  status: z.enum(CONSULTATION_STATUSES),
  answer: z.string().trim().max(4000).optional(),
})

export async function setConsultaStatus(
  input: z.input<typeof statusSchema>,
): Promise<ConsultoriaResult<ConsultoriaData>> {
  try {
    const member = await requirePermission('consultoria:write')
    const parsed = statusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const patch: {
      status: (typeof CONSULTATION_STATUSES)[number]
      answer?: string
    } = { status: parsed.data.status }
    if (parsed.data.answer !== undefined) patch.answer = parsed.data.answer

    const supabase = await createClient()
    const { error } = await supabase
      .from('consultations')
      .update(patch)
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[consultoria] setConsultaStatus', error)
      return fail('No se pudo actualizar la consulta.')
    }

    revalidatePath('/dashboard/consultoria')
    return { ok: true, data: await getConsultoria() }
  } catch {
    return fail('No tienes permiso para gestionar consultoría.')
  }
}

const scheduleSchema = z.object({
  title: z.string().trim().min(3, 'El título de la sesión es obligatorio.').max(200),
  startsAt: z.string().datetime({ offset: true }),
  minutes: z.number().int().min(15).max(480).default(60),
  advisor: z.string().trim().max(120).default(''),
  /** Optional: links the session back to the consultation it answers. */
  consultationId: z.uuid().nullable().default(null),
})

/**
 * Book an advisory session.
 *
 * This used to push a row into a local array and toast "revisa el Calendario".
 * It writes a real `calendar_events` row of kind 'Consultoría' now, which is
 * what makes that sentence true — and it needs `calendario:write`, checked
 * here rather than assumed from `consultoria:write`, because they are
 * different modules and either can be switched off.
 */
export async function scheduleSesion(
  input: z.input<typeof scheduleSchema>,
): Promise<ConsultoriaResult<ConsultoriaData>> {
  try {
    const member = await requirePermission('consultoria:write')
    const parsed = scheduleSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    if (!member.modules.has('calendario')) {
      return fail('El módulo Calendario no está activo, así que la sesión no puede agendarse.')
    }
    // Not `requirePermission` a second time: that would throw and be reported
    // as "no tienes permiso para consultoría", which is the wrong module.
    if (!member.permissions.has('calendario:write')) {
      return fail('Tu rol no puede crear eventos en el calendario.')
    }

    const startsAt = new Date(parsed.data.startsAt)
    const endsAt = new Date(startsAt.getTime() + parsed.data.minutes * 60_000)

    const supabase = await createClient()
    const { error } = await supabase.from('calendar_events').insert({
      org_id: member.orgId,
      title: parsed.data.title,
      kind: 'Consultoría',
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      location: parsed.data.advisor ? `Con ${parsed.data.advisor}` : '',
    })

    if (error) {
      console.error('[consultoria] scheduleSesion', error)
      return fail('No se pudo agendar la sesión.')
    }

    // The consultation moves to "En curso" and remembers when it is being
    // looked at, so the two screens agree about what is scheduled.
    if (parsed.data.consultationId) {
      await supabase
        .from('consultations')
        .update({ scheduled_at: startsAt.toISOString(), status: 'En curso' })
        .eq('id', parsed.data.consultationId)
        .eq('org_id', member.orgId)
    }

    revalidatePath('/dashboard/consultoria')
    revalidatePath('/dashboard/calendario')
    return { ok: true, data: await getConsultoria() }
  } catch {
    return fail('No tienes permiso para gestionar consultoría.')
  }
}
