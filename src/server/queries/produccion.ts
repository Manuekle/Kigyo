import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import {
  allows, pageRange, rosterFor, totalOf,
  type Page, type RosterEntry, type Supabase,
} from './shared'
import type { Member } from '@/lib/auth/session'

/**
 * Production orders and the stages inside them.
 *
 * `quantity_scrap` is a first-class column rather than a note, because yield —
 * good units over units started — is the number a plant is actually run on,
 * and it cannot be derived from a quantity and a status.
 */

export interface ProductionRow {
  id: string
  code: string | null
  productId: string | null
  productLabel: string
  status: string
  quantityPlanned: number
  quantityDone: number
  quantityScrap: number
  unit: string
  line: string
  supervisorId: string | null
  startsOn: string | null
  dueOn: string | null
  completedAt: string | null
  costCents: number
  notes: string
}

export interface StageRow {
  id: string
  orderId: string
  name: string
  status: string
  quantityDone: number
  operatorId: string | null
  startedAt: string | null
  finishedAt: string | null
  position: number
}

export interface ProductRef {
  id: string
  sku: string
  name: string
}

export interface ProduccionData {
  ordenes: ProductionRow[]
  ordenesTotal: number
  etapas: StageRow[]
  productos: ProductRef[]
  roster: RosterEntry[]
  canWrite: boolean
}

interface ProductionRecord {
  id: string
  code: string | null
  product_id: string | null
  product_label: string
  status: string
  quantity_planned: number
  quantity_done: number
  quantity_scrap: number
  unit: string
  line: string
  supervisor_id: string | null
  starts_on: string | null
  due_on: string | null
  completed_at: string | null
  cost_cents: number
  notes: string
}

interface StageRecord {
  id: string
  order_id: string
  name: string
  status: string
  quantity_done: number
  operator_id: string | null
  started_at: string | null
  finished_at: string | null
  position: number
}

const COLUMNS = `id, code, product_id, product_label, status, quantity_planned, quantity_done,
   quantity_scrap, unit, line, supervisor_id, starts_on, due_on, completed_at, cost_cents, notes`

function toRow(row: ProductionRecord): ProductionRow {
  return {
    id: row.id,
    code: row.code,
    productId: row.product_id,
    productLabel: row.product_label,
    status: row.status,
    quantityPlanned: row.quantity_planned,
    quantityDone: row.quantity_done,
    quantityScrap: row.quantity_scrap,
    unit: row.unit,
    line: row.line,
    supervisorId: row.supervisor_id,
    startsOn: row.starts_on,
    dueOn: row.due_on,
    completedAt: row.completed_at,
    costCents: row.cost_cents,
    notes: row.notes,
  }
}

/** Catalogue entries, when the caller can read them. Same contract as `rosterFor`. */
async function productsFor(supabase: Supabase, member: Member, limit = 200): Promise<ProductRef[]> {
  if (!allows(member, 'catalogos:read')) return []

  const { data, error } = await supabase
    .from('products')
    .select('id, sku, name')
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('[produccion] productsFor', error)
    return []
  }
  return (data ?? []).map((r) => ({ id: r.id, sku: r.sku, name: r.name }))
}

export async function getOrdenesProduccionPage(offset = 0): Promise<Page<ProductionRow>> {
  const member = await requirePermission('produccion:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('production_orders')
    .select(COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[produccion] getOrdenesProduccionPage', error)
    return { rows: [], total: 0 }
  }

  const rows = data as unknown as ProductionRecord[]
  return { rows: rows.map(toRow), total: totalOf(count, rows.length, from) }
}

export async function getProduccion(): Promise<ProduccionData> {
  const member = await requirePermission('produccion:read')
  const supabase = await createClient()

  const [ordersResult, productos, roster] = await Promise.all([
    supabase
      .from('production_orders')
      .select(COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(...pageRange(0)),
    productsFor(supabase, member),
    rosterFor(supabase, member),
  ])

  if (ordersResult.error) {
    console.error('[produccion] getProduccion', ordersResult.error)
    return { ordenes: [], ordenesTotal: 0, etapas: [], productos: [], roster: [], canWrite: false }
  }

  const rows = ordersResult.data as unknown as ProductionRecord[]

  const { data: stageData, error: stageError } = await supabase
    .from('production_stages')
    .select('id, order_id, name, status, quantity_done, operator_id, started_at, finished_at, position')
    .in('order_id', rows.map((r) => r.id))
    .order('position', { ascending: true })
    .limit(500)

  if (stageError) console.error('[produccion] stages', stageError)

  return {
    ordenes: rows.map(toRow),
    ordenesTotal: totalOf(ordersResult.count, rows.length),
    etapas: ((stageData ?? []) as unknown as StageRecord[]).map((row) => ({
      id: row.id,
      orderId: row.order_id,
      name: row.name,
      status: row.status,
      quantityDone: row.quantity_done,
      operatorId: row.operator_id,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      position: row.position,
    })),
    productos,
    roster,
    canWrite: can(member.permissions, 'produccion:write'),
  }
}
