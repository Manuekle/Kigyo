import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { scoped } from './shared'

/**
 * Cobros recurrentes: planes y quién está en cada uno — el módulo
 * suscripciones.
 *
 * Un plan es la tarifa: nombre, precio y ciclo. Una suscripción es un cliente
 * dentro de un plan, con su fecha de inicio, su próxima renovación y el precio
 * que paga cuando negoció uno distinto al del plan. No factura por sí mismo:
 * es la lista de quién debe qué, y de dónde sale el siguiente cargo. La
 * factura se emite desde facturacion, con los datos de aquí como insumo.
 *
 * `plan_id` y `client_id` son opcionales: borrar un cliente o un plan no borra
 * la suscripción — la historia de lo que se cobró sobrevive con el precio que
 * ya tenía congelado.
 */

export interface PlanRow {
  id: string
  name: string
  priceCents: number
  cycle: string
  description: string | null
}

export interface SubRow {
  id: string
  planId: string | null
  planName: string | null
  clientId: string | null
  clientName: string | null
  status: string
  startedOn: string
  nextChargeOn: string | null
  priceCents: number | null
  notes: string | null
}

export interface SuscripcionesData {
  /** El catálogo de tarifas, para el selector de plan. */
  plans: PlanRow[]
  /** Suscripciones, por estado y renovación. */
  subs: SubRow[]
  /** Clientes vivos, para el selector de cliente. */
  clients: Array<{ id: string; name: string }>
  /** Cuántas suscripciones están activas. */
  activeCount: number
  /** Carga mensual de las activas, en centavos. */
  monthlyCents: number
}

interface PlanRecord {
  id: string
  name: string
  price_cents: number
  cycle: string
  description: string | null
}

interface SubRecord {
  id: string
  plan_id: string | null
  client_id: string | null
  status: string
  started_on: string
  next_charge_on: string | null
  price_cents: number | null
  notes: string | null
  subscription_plans: { name: string } | null
  clients: { name: string } | null
}

function toSubRow(row: SubRecord): SubRow {
  return {
    id: row.id,
    planId: row.plan_id,
    planName: row.subscription_plans?.name ?? null,
    clientId: row.client_id,
    clientName: row.clients?.name ?? null,
    status: row.status,
    startedOn: row.started_on,
    nextChargeOn: row.next_charge_on,
    priceCents: row.price_cents,
    notes: row.notes,
  }
}

export async function getSuscripciones(): Promise<SuscripcionesData> {
  const member = await requirePermission('suscripciones:read')
  const supabase = await createClient()

  const [plansResult, subsResult, clientsResult] = await Promise.all([
    scoped(supabase, member, 'subscription_plans')
      .select('id, name, price_cents, cycle, description')
      .order('name', { ascending: true }),
    scoped(supabase, member, 'subscriptions')
      .select(
        'id, plan_id, client_id, status, started_on, next_charge_on, price_cents, notes, ' +
          'subscription_plans ( name ), clients ( name )',
      )
      .order('status')
      .order('next_charge_on', { ascending: true, nullsFirst: false }),
    scoped(supabase, member, 'clients')
      .select('id, name')
      .is('deleted_at', null)
      .order('name', { ascending: true }),
  ])

  const plans = ((plansResult.data ?? []) as unknown as PlanRecord[]).map((row) => ({
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    cycle: row.cycle,
    description: row.description,
  }))

  const subs = ((subsResult.data ?? []) as unknown as SubRecord[]).map(toSubRow)

  // El ciclo vive en el plan, no en la fila: la suscripción solo congela su
  // precio cuando lo negocia distinto, así que el cálculo mensual cruza ambas.
  const planBy = new Map(plans.map((p) => [p.id, p]))

  const active = subs.filter((s) => s.status === 'activa')
  const monthlyCents = active.reduce((sum, s) => {
    const plan = s.planId ? planBy.get(s.planId) : undefined
    if (!plan || plan.cycle !== 'mensual') return sum
    return sum + (s.priceCents ?? plan.priceCents)
  }, 0)

  return {
    plans,
    subs,
    clients: (clientsResult.data ?? []) as unknown as Array<{ id: string; name: string }>,
    activeCount: active.length,
    monthlyCents,
  }
}
