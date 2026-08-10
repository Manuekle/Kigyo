import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import {
  pageRange,
  projectsFor,
  rosterFor,
  totalOf,
  type Page,
  type ProjectRef,
  type RosterEntry,
} from './shared'

/**
 * Purchase requests and the orders they turn into, read through RLS.
 *
 * Both screens used to hold their own `useState` lists, and the chain between
 * them — "aprobar una requisición genera una OC" — existed only as a label.
 * `purchase_orders.purchase_request_id` has always been there; approving a
 * request now actually produces the order, and the order remembers where it
 * came from.
 */

export interface CompraItem {
  id: string
  productId: string | null
  description: string
  quantity: number
  unit: string
  unitCostCents: number
  position: number
}

export interface CompraRow {
  id: string
  code: string | null
  supplier: string
  projectId: string | null
  projectLabel: string | null
  ownerId: string | null
  ownerName: string | null
  category: string
  status: string
  urgency: string
  neededOn: string | null
  notes: string
  items: CompraItem[]
  totalCents: number
}

export interface OrdenItem {
  id: string
  description: string
  quantity: number
  unitPriceCents: number
  position: number
}

export interface OrdenRow {
  id: string
  code: string | null
  purchaseRequestId: string | null
  requestCode: string | null
  supplier: string
  projectId: string | null
  projectLabel: string | null
  status: string
  issuedOn: string
  dueOn: string | null
  notes: string
  items: OrdenItem[]
  totalCents: number
}

export interface ComprasData {
  compras: CompraRow[]
  /** Requisitions in the organization, of which `compras` is the first page. */
  comprasTotal: number
  ordenes: OrdenRow[]
  /** Orders in the organization, of which `ordenes` is the first page. */
  ordenesTotal: number
  roster: RosterEntry[]
  proyectos: ProjectRef[]
  productos: Array<{ id: string; sku: string; name: string; costCents: number; unit: string }>
  canWrite: boolean
  canReadOrders: boolean
}

interface RequestRecord {
  id: string
  code: string | null
  supplier: string
  project_id: string | null
  owner_id: string | null
  category: string
  status: string
  urgency: string
  needed_on: string | null
  notes: string
  employees: { full_name: string } | null
  projects: { code: string | null; name: string } | null
  purchase_request_items: Array<{
    id: string
    product_id: string | null
    description: string
    quantity: number
    unit: string
    unit_cost_cents: number
    position: number
  }> | null
}

interface OrderRecord {
  id: string
  code: string | null
  purchase_request_id: string | null
  supplier: string
  project_id: string | null
  status: string
  issued_on: string
  due_on: string | null
  notes: string
  projects: { code: string | null; name: string } | null
  purchase_requests: { code: string | null } | null
  purchase_order_items: Array<{
    id: string
    description: string
    quantity: number
    unit_price_cents: number
    position: number
  }> | null
}

const label = (p: { code: string | null; name: string } | null) =>
  p ? [p.code, p.name].filter(Boolean).join(' · ') : null

const REQUEST_COLUMNS = `id, code, supplier, project_id, owner_id, category, status, urgency,
   needed_on, notes,
   employees ( full_name ),
   projects ( code, name ),
   purchase_request_items ( id, product_id, description, quantity, unit, unit_cost_cents, position )`

const ORDER_COLUMNS = `id, code, purchase_request_id, supplier, project_id, status, issued_on,
   due_on, notes,
   projects ( code, name ),
   purchase_requests ( code ),
   purchase_order_items ( id, description, quantity, unit_price_cents, position )`

function toCompra(row: RequestRecord): CompraRow {
  const items = (row.purchase_request_items ?? [])
    .map((i) => ({
      id: i.id,
      productId: i.product_id,
      description: i.description,
      quantity: Number(i.quantity),
      unit: i.unit,
      unitCostCents: Number(i.unit_cost_cents),
      position: i.position,
    }))
    .sort((a, b) => a.position - b.position)

  return {
    id: row.id,
    code: row.code,
    supplier: row.supplier,
    projectId: row.project_id,
    projectLabel: label(row.projects),
    ownerId: row.owner_id,
    ownerName: row.employees?.full_name ?? null,
    category: row.category,
    status: row.status,
    urgency: row.urgency,
    neededOn: row.needed_on,
    notes: row.notes,
    items,
    totalCents: items.reduce((s, i) => s + Math.round(i.quantity * i.unitCostCents), 0),
  }
}

function toOrden(row: OrderRecord): OrdenRow {
  const items = (row.purchase_order_items ?? [])
    .map((i) => ({
      id: i.id,
      description: i.description,
      quantity: Number(i.quantity),
      unitPriceCents: Number(i.unit_price_cents),
      position: i.position,
    }))
    .sort((a, b) => a.position - b.position)

  return {
    id: row.id,
    code: row.code,
    purchaseRequestId: row.purchase_request_id,
    requestCode: row.purchase_requests?.code ?? null,
    supplier: row.supplier,
    projectId: row.project_id,
    projectLabel: label(row.projects),
    status: row.status,
    issuedOn: row.issued_on,
    dueOn: row.due_on,
    notes: row.notes,
    items,
    totalCents: items.reduce((s, i) => s + Math.round(i.quantity * i.unitPriceCents), 0),
  }
}

/** One page of requisitions, newest first. */
export async function getComprasPage(offset = 0): Promise<Page<CompraRow>> {
  const member = await requirePermission('compras:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('purchase_requests')
    .select(REQUEST_COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[compras] getComprasPage', error)
    return { rows: [], total: 0 }
  }

  return {
    rows: (data as unknown as RequestRecord[]).map(toCompra),
    total: totalOf(count, data.length, from),
  }
}

/** One page of purchase orders, newest first. */
export async function getOrdenesPage(offset = 0): Promise<Page<OrdenRow>> {
  const member = await requirePermission('compras:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('purchase_orders')
    .select(ORDER_COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('issued_on', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[compras] getOrdenesPage', error)
    return { rows: [], total: 0 }
  }

  return {
    rows: (data as unknown as OrderRecord[]).map(toOrden),
    total: totalOf(count, data.length, from),
  }
}

export async function getCompras(): Promise<ComprasData> {
  const member = await requirePermission('compras:read')
  const supabase = await createClient()

  const canReadProducts =
    member.modules.has('catalogos') && can(member.permissions, 'catalogos:read')

  const [requestsResult, ordersResult, roster, proyectos, productsResult] = await Promise.all([
    supabase
      .from('purchase_requests')
      .select(REQUEST_COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(...pageRange(0)),
    supabase
      .from('purchase_orders')
      .select(ORDER_COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('issued_on', { ascending: false })
      .range(...pageRange(0)),
    rosterFor(supabase, member),
    projectsFor(supabase, member),
    canReadProducts
      ? supabase
          .from('products')
          .select('id, sku, name, cost_cents, unit')
          .eq('org_id', member.orgId)
          .is('deleted_at', null)
          .eq('is_active', true)
          .order('name', { ascending: true })
          .limit(300)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (requestsResult.error) {
    console.error('[compras] getCompras', requestsResult.error)
    return {
      compras: [], comprasTotal: 0, ordenes: [], ordenesTotal: 0,
      roster: [], proyectos: [], productos: [],
      canWrite: false, canReadOrders: false,
    }
  }

  const compras = (requestsResult.data as unknown as RequestRecord[]).map(toCompra)
  const ordenes = ((ordersResult.data ?? []) as unknown as OrderRecord[]).map(toOrden)

  return {
    compras,
    comprasTotal: totalOf(requestsResult.count, compras.length),
    ordenes,
    ordenesTotal: totalOf(ordersResult.count, ordenes.length),
    roster,
    proyectos,
    productos: ((productsResult.data ?? []) as Array<{
      id: string; sku: string; name: string; cost_cents: number; unit: string
    }>).map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      costCents: Number(p.cost_cents),
      unit: p.unit,
    })),
    canWrite: can(member.permissions, 'compras:write'),
    // Same permission gates both routes (`ordenes-compra` maps to
    // `compras:read`), so this is always true here — kept explicit so the
    // client does not have to know that.
    canReadOrders: true,
  }
}
