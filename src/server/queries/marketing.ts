import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { allows, scoped } from './shared'

/**
 * Marketing: campañas y fidelización.
 *
 * La campaña compone la pieza y arma la lista de destinatarios; el transporte
 * es de `integraciones` (WhatsApp/pasarela). La fidelización es un libro de
 * puntos por cliente: el saldo se calcula aquí, sumando el libro, para que no
 * exista una segunda copia que pueda disentir.
 */

export type CampaignChannel = 'whatsapp' | 'email' | 'sms' | 'otro'
export type CampaignStatus = 'borrador' | 'programada' | 'enviada' | 'cancelada'

export interface CampaignRow {
  id: string
  name: string
  channel: CampaignChannel
  message: string
  status: CampaignStatus
  scheduledFor: string | null
  sentAt: string | null
  audienceCount: number
  sentCount: number
  createdAt: string
}

export interface RecipientRow {
  id: string
  campaignId: string
  contactName: string
  contactAddress: string
  sentAt: string | null
}

export interface ClientRef {
  id: string
  name: string
}

export interface PointRow {
  id: string
  clientId: string
  clientName: string
  points: number
  reason: string
  createdAt: string
}

export interface BalanceRow {
  clientId: string
  clientName: string
  balance: number
}

export interface MarketingData {
  campaigns: CampaignRow[]
  recipients: RecipientRow[]
  clients: ClientRef[]
  points: PointRow[]
  balances: BalanceRow[]
  /** Campañas en borrador o programadas: el trabajo por delante. */
  activasCount: number
}

export async function getMarketing(): Promise<MarketingData> {
  const member = await requirePermission('marketing:read')
  const supabase = await createClient()

  const [campaignsResult, recipientsResult, clientsResult, pointsResult] = await Promise.all([
    scoped(supabase, member, 'marketing_campaigns')
      .select(
        'id, name, channel, message, status, scheduled_for, sent_at, ' +
          'audience_count, sent_count, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(200),
    // Hijos de campaña: el filtro de org viaja por el padre.
    supabase
      .from('marketing_recipients')
      .select('id, campaign_id, contact_name, contact_address, sent_at')
      .order('created_at', { ascending: true })
      .limit(500),
    allows(member, 'clientes:read')
      ? scoped(supabase, member, 'clients')
          .select('id, name')
          .is('deleted_at', null)
          .order('name', { ascending: true })
          .limit(200)
      : Promise.resolve({ data: [] }),
    scoped(supabase, member, 'loyalty_points')
      .select('id, client_id, points, reason, created_at, clients ( name )')
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const campaigns = ((campaignsResult.data ?? []) as unknown as {
    id: string
    name: string
    channel: CampaignChannel
    message: string
    status: CampaignStatus
    scheduled_for: string | null
    sent_at: string | null
    audience_count: number
    sent_count: number
    created_at: string
  }[]).map((r) => ({
    id: r.id,
    name: r.name,
    channel: r.channel,
    message: r.message,
    status: r.status,
    scheduledFor: r.scheduled_for,
    sentAt: r.sent_at,
    audienceCount: r.audience_count,
    sentCount: r.sent_count,
    createdAt: r.created_at,
  }))

  const recipients = ((recipientsResult.data ?? []) as unknown as {
    id: string
    campaign_id: string
    contact_name: string
    contact_address: string
    sent_at: string | null
  }[]).map((r) => ({
    id: r.id,
    campaignId: r.campaign_id,
    contactName: r.contact_name,
    contactAddress: r.contact_address,
    sentAt: r.sent_at,
  }))

  const pointRecords = ((pointsResult.data ?? []) as unknown as {
    id: string
    client_id: string
    points: number
    reason: string
    created_at: string
    clients: { name: string } | null
  }[])

  const points: PointRow[] = pointRecords.map((r) => ({
    id: r.id,
    clientId: r.client_id,
    clientName: r.clients?.name ?? '—',
    points: r.points,
    reason: r.reason,
    createdAt: r.created_at,
  }))

  // El saldo es la suma del libro, calculado aquí y en ninguna otra parte.
  const byClient = new Map<string, { name: string; balance: number }>()
  for (const p of points) {
    const entry = byClient.get(p.clientId) ?? { name: p.clientName, balance: 0 }
    entry.balance += p.points
    byClient.set(p.clientId, entry)
  }

  const balances: BalanceRow[] = [...byClient.entries()]
    .map(([clientId, e]) => ({ clientId, clientName: e.name, balance: e.balance }))
    .filter((b) => b.balance !== 0)
    .sort((a, b) => b.balance - a.balance)

  return {
    campaigns,
    recipients,
    clients: ((clientsResult.data ?? []) as unknown as { id: string; name: string }[]),
    points,
    balances,
    activasCount: campaigns.filter((c) => c.status === 'borrador' || c.status === 'programada').length,
  }
}
