'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { getMarketing, type MarketingData } from '@/server/queries/marketing'

export type MarketingResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const DENIED = 'No tienes permiso para gestionar marketing.'

async function refreshed(): Promise<MarketingResult<MarketingData>> {
  revalidatePath('/dashboard/marketing')
  return { ok: true, data: await getMarketing() }
}

/* ─── Campañas ────────────────────────────────────────────────────────────── */

const addCampaignSchema = z.object({
  name: z.string().trim().min(2).max(120),
  channel: z.enum(['whatsapp', 'email', 'sms', 'otro']).default('whatsapp'),
  message: z.string().trim().max(1000).default(''),
})

export async function addCampaign(
  input: z.input<typeof addCampaignSchema>,
): Promise<MarketingResult<MarketingData>> {
  try {
    const member = await requirePermission('marketing:write')
    const parsed = addCampaignSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase.from('marketing_campaigns').insert({
      org_id: member.orgId,
      name: parsed.data.name,
      channel: parsed.data.channel,
      message: parsed.data.message,
    })

    if (error) {
      console.error('[marketing] addCampaign', error)
      return fail('No se pudo crear la campaña.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/**
 * Arma la lista de destinatarios desde el directorio de clientes.
 *
 * Requiere `clientes:read` además de `marketing:write`: compartir la lista de
 * contactos es leer el directorio, y la RLS ya bloquea la lectura para quien
 * no tiene el permiso — el resultado sería una lista vacía con cara de
 * éxito, así que se rechaza explícito en vez de dejar que parezca un envío a
 * nadie.
 */
export async function generateRecipients(campaignId: string): Promise<MarketingResult<MarketingData>> {
  try {
    const member = await requirePermission('marketing:write')
    if (!z.uuid().safeParse(campaignId).success) return fail('Campaña inválida.')

    const supabase = await createClient()

    const { data: campaign } = await supabase
      .from('marketing_campaigns')
      .select('id, status')
      .eq('id', campaignId)
      .eq('org_id', member.orgId)
      .maybeSingle()

    if (!campaign) return fail('Esa campaña no pertenece a tu organización.')
    if (campaign.status !== 'borrador') return fail('Solo una campaña en borrador arma su lista.')

    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, phone')
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .neq('phone', '')
      .limit(500)

    if (clientsError || !clients) {
      console.error('[marketing] generateRecipients clients', clientsError)
      return fail('No se pudo leer el directorio de clientes.')
    }
    if (clients.length === 0) {
      return fail('No hay clientes con teléfono registrado. Añade teléfonos en Clientes.')
    }

    const rows = clients.map((c: { id: string; name: string; phone: string }) => ({
      campaign_id: campaignId,
      client_id: c.id,
      contact_name: c.name,
      contact_address: c.phone,
    }))

    const { error: insertError } = await supabase.from('marketing_recipients').insert(rows)
    if (insertError) {
      console.error('[marketing] generateRecipients insert', insertError)
      return fail('No se pudo armar la lista de destinatarios.')
    }

    const { error: countError } = await supabase
      .from('marketing_campaigns')
      .update({ audience_count: rows.length })
      .eq('id', campaignId)
      .eq('org_id', member.orgId)

    if (countError) {
      console.error('[marketing] generateRecipients count', countError)
      return fail('La lista se creó pero el conteo no se guardó.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/** Marca la campaña enviada: el transporte real es de `integraciones`. */
export async function markSent(campaignId: string): Promise<MarketingResult<MarketingData>> {
  try {
    const member = await requirePermission('marketing:write')
    if (!z.uuid().safeParse(campaignId).success) return fail('Campaña inválida.')

    const supabase = await createClient()
    const { data: campaign } = await supabase
      .from('marketing_campaigns')
      .select('id, status, audience_count')
      .eq('id', campaignId)
      .eq('org_id', member.orgId)
      .maybeSingle()

    if (!campaign) return fail('Esa campaña no pertenece a tu organización.')
    if (campaign.status === 'enviada') return fail('Esa campaña ya se envió.')
    if (campaign.status === 'cancelada') return fail('Esa campaña está cancelada.')
    if (campaign.audience_count === 0) return fail('Primero arma la lista de destinatarios.')

    const now = new Date().toISOString()
    const [{ error: campaignError }, { error: recipientsError }] = await Promise.all([
      supabase
        .from('marketing_campaigns')
        .update({ status: 'enviada', sent_at: now, sent_count: campaign.audience_count })
        .eq('id', campaignId)
        .eq('org_id', member.orgId),
      supabase
        .from('marketing_recipients')
        .update({ sent_at: now })
        .is('sent_at', null)
        .eq('campaign_id', campaignId),
    ])

    if (campaignError || recipientsError) {
      console.error('[marketing] markSent', campaignError, recipientsError)
      return fail('No se pudo marcar la campaña como enviada.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function cancelCampaign(campaignId: string): Promise<MarketingResult<MarketingData>> {
  try {
    const member = await requirePermission('marketing:write')
    if (!z.uuid().safeParse(campaignId).success) return fail('Campaña inválida.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('marketing_campaigns')
      .update({ status: 'cancelada' })
      .eq('id', campaignId)
      .eq('org_id', member.orgId)
      .in('status', ['borrador', 'programada'])

    if (error) {
      console.error('[marketing] cancelCampaign', error)
      return fail('No se pudo cancelar la campaña.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deleteCampaign(campaignId: string): Promise<MarketingResult<MarketingData>> {
  try {
    const member = await requirePermission('marketing:write')
    if (!z.uuid().safeParse(campaignId).success) return fail('Campaña inválida.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('marketing_campaigns')
      .delete()
      .eq('id', campaignId)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[marketing] deleteCampaign', error)
      return fail('No se pudo eliminar la campaña.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/* ─── Fidelización ────────────────────────────────────────────────────────── */

const addPointsSchema = z.object({
  clientId: z.string().uuid(),
  points: z.coerce.number().int().refine((n) => n !== 0, 'Los puntos no pueden ser cero.'),
  reason: z.string().trim().min(2).max(200),
})

export async function addPoints(
  input: z.input<typeof addPointsSchema>,
): Promise<MarketingResult<MarketingData>> {
  try {
    const member = await requirePermission('marketing:write')
    const parsed = addPointsSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', parsed.data.clientId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!client) return fail('Ese cliente no pertenece a tu organización.')

    const { error } = await supabase.from('loyalty_points').insert({
      org_id: member.orgId,
      client_id: parsed.data.clientId,
      points: parsed.data.points,
      reason: parsed.data.reason,
    })

    if (error) {
      console.error('[marketing] addPoints', error)
      return fail('No se pudo registrar el movimiento.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deletePoints(id: string): Promise<MarketingResult<MarketingData>> {
  try {
    const member = await requirePermission('marketing:write')
    if (!z.uuid().safeParse(id).success) return fail('Movimiento inválido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('loyalty_points')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[marketing] deletePoints', error)
      return fail('No se pudo eliminar el movimiento.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}
