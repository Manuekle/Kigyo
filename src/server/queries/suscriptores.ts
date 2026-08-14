import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { scoped } from './shared'

/**
 * Suscriptores: planes de servicio y quién está en cada uno.
 *
 * Un plan es la oferta: nombre, precio y descripción. Un suscriptor es un
 * cliente dentro de un plan con su estado de servicio — activo, suspendido o
 * cancelado — y la fecha en que se activó. Deliberadamente distinto de
 * `suscripciones` (cobro recurrente): aquí la pregunta es «¿está activo el
 * servicio y desde cuándo?», no «¿cuánto y cada cuánto cobra?».
 *
 * `plan_id` y `client_id` son opcionales: borrar un plan o un cliente no borra
 * el suscriptor — el servicio puede existir sin ficha comercial formal.
 */

export interface PlanRow {
  id: string
  name: string
  priceCents: number
  description: string | null
}

export interface SubscriberRow {
  id: string
  planId: string | null
  planName: string | null
  clientId: string | null
  name: string
  address: string | null
  phone: string | null
  status: string
  activatedOn: string
  notes: string | null
}

export interface SuscriptoresData {
  /** El catálogo de planes, para el selector de plan. */
  plans: PlanRow[]
  /** Suscriptores, por nombre. */
  subscribers: SubscriberRow[]
  /** Clientes vivos, para el selector de cliente. */
  clients: Array<{ id: string; name: string }>
  /** Cuántos suscriptores están activos. */
  activosCount: number
  /** Cuántos suscriptores están suspendidos. */
  suspendidosCount: number
}

interface PlanRecord {
  id: string
  name: string
  price_cents: number
  description: string | null
}

interface SubscriberRecord {
  id: string
  plan_id: string | null
  client_id: string | null
  name: string
  address: string | null
  phone: string | null
  status: string
  activated_on: string
  notes: string | null
  service_plans: { name: string } | null
}

function toSubscriberRow(row: SubscriberRecord): SubscriberRow {
  return {
    id: row.id,
    planId: row.plan_id,
    planName: row.service_plans?.name ?? null,
    clientId: row.client_id,
    name: row.name,
    address: row.address,
    phone: row.phone,
    status: row.status,
    activatedOn: row.activated_on,
    notes: row.notes,
  }
}

export async function getSuscriptores(): Promise<SuscriptoresData> {
  const member = await requirePermission('suscriptores:read')
  const supabase = await createClient()

  const [plansResult, subscribersResult, clientsResult] = await Promise.all([
    scoped(supabase, member, 'service_plans')
      .select('id, name, price_cents, description')
      .order('name', { ascending: true }),
    scoped(supabase, member, 'subscribers')
      .select(
        'id, plan_id, client_id, name, address, phone, status, activated_on, notes, ' +
          'service_plans ( name )',
      )
      .order('name', { ascending: true }),
    scoped(supabase, member, 'clients')
      .select('id, name')
      .is('deleted_at', null)
      .order('name', { ascending: true }),
  ])

  const plans = ((plansResult.data ?? []) as unknown as PlanRecord[]).map((row) => ({
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    description: row.description,
  }))

  const subscribers = ((subscribersResult.data ?? []) as unknown as SubscriberRecord[]).map(
    toSubscriberRow,
  )

  return {
    plans,
    subscribers,
    clients: (clientsResult.data ?? []) as unknown as Array<{ id: string; name: string }>,
    activosCount: subscribers.filter((s) => s.status === 'activo').length,
    suspendidosCount: subscribers.filter((s) => s.status === 'suspendido').length,
  }
}
