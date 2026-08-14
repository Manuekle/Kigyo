'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { getNotifPanel, type NotifPanelData } from '@/server/queries/notif-panel'

export type NotifResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const DENIED = 'No tienes permiso para gestionar las notificaciones.'

async function refreshed(): Promise<NotifResult<NotifPanelData>> {
  revalidatePath('/dashboard/notificaciones')
  return { ok: true, data: await getNotifPanel() }
}

const addRuleSchema = z.object({
  name: z.string().trim().min(2).max(80),
  kind: z.enum(['cita', 'vencimiento', 'renovacion']),
  daysBefore: z.coerce.number().int().min(0).max(90).default(1),
  channel: z.enum(['email', 'whatsapp']).default('email'),
})

/**
 * Crea una regla de recordatorio. Toda regla nace activa: quien la escribe
 * quiere que dispare, y desactivarla es un gesto explícito después.
 */
export async function addRule(
  input: z.input<typeof addRuleSchema>,
): Promise<NotifResult<NotifPanelData>> {
  try {
    const member = await requirePermission('notificaciones:write')
    const parsed = addRuleSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase.from('notification_rules').insert({
      org_id: member.orgId,
      name: parsed.data.name,
      kind: parsed.data.kind,
      days_before: parsed.data.daysBefore,
      channel: parsed.data.channel,
      enabled: true,
    })

    if (error) {
      console.error('[notif-panel] addRule', error)
      return fail('No se pudo crear la regla.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function toggleRule(id: string): Promise<NotifResult<NotifPanelData>> {
  try {
    const member = await requirePermission('notificaciones:write')
    if (!z.uuid().safeParse(id).success) return fail('Regla inválida.')

    const supabase = await createClient()
    const { data: current } = await supabase
      .from('notification_rules')
      .select('enabled')
      .eq('id', id)
      .eq('org_id', member.orgId)
      .maybeSingle()
    if (!current) return fail('Regla no encontrada.')

    const { error } = await supabase
      .from('notification_rules')
      .update({ enabled: !current.enabled })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[notif-panel] toggleRule', error)
      return fail('No se pudo cambiar la regla.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deleteRule(id: string): Promise<NotifResult<NotifPanelData>> {
  try {
    const member = await requirePermission('notificaciones:write')
    if (!z.uuid().safeParse(id).success) return fail('Regla inválida.')

    const supabase = await createClient()
    // `org_id` va explícito para que nadie pueda borrar por id lo que no es
    // de su empresa. La bitácora conserva la historia: `rule_id` queda null.
    const { error } = await supabase
      .from('notification_rules')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[notif-panel] deleteRule', error)
      return fail('No se pudo eliminar la regla.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}
