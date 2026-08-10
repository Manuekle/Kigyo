import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { pageRange, rosterFor, totalOf, type Page, type RosterEntry } from './shared'

/**
 * The menu, the room, and what is being served right now.
 *
 * `menu_items` carries both a price and a cost because the one question a
 * kitchen actually asks of its menu is which dishes make money — a price list
 * on its own cannot answer it, and margin computed from a spreadsheet drifts
 * from the menu the moment either changes.
 */

export interface MenuItemRow {
  id: string
  name: string
  category: string
  description: string
  priceCents: number
  costCents: number
  prepMinutes: number | null
  allergens: string
  isAvailable: boolean
  /** Derived: gross margin as a percentage of price, null when price is zero. */
  marginPct: number | null
}

export interface TableRow {
  id: string
  label: string
  zone: string
  seats: number
  status: string
}

export interface OrderRow {
  id: string
  code: string | null
  tableId: string | null
  tableLabel: string
  waiterId: string | null
  status: string
  guests: number
  subtotalCents: number
  tipCents: number
  totalCents: number
  openedAt: string
  closedAt: string | null
  notes: string
  items: number
}

export interface OrderItemRow {
  id: string
  orderId: string
  menuItemId: string | null
  description: string
  quantity: number
  unitPriceCents: number
  notes: string
  position: number
}

export interface RestauranteData {
  pedidos: OrderRow[]
  pedidosTotal: number
  items: OrderItemRow[]
  menu: MenuItemRow[]
  mesas: TableRow[]
  roster: RosterEntry[]
  canWrite: boolean
}

interface MenuRecord {
  id: string
  name: string
  category: string
  description: string
  price_cents: number
  cost_cents: number
  prep_minutes: number | null
  allergens: string
  is_available: boolean
}

interface TableRecord {
  id: string
  label: string
  zone: string
  seats: number
  status: string
}

interface OrderRecord {
  id: string
  code: string | null
  table_id: string | null
  waiter_id: string | null
  status: string
  guests: number
  subtotal_cents: number
  tip_cents: number
  total_cents: number
  opened_at: string
  closed_at: string | null
  notes: string
}

interface ItemRecord {
  id: string
  order_id: string
  menu_item_id: string | null
  description: string
  quantity: number
  unit_price_cents: number
  notes: string
  position: number
}

const ORDER_COLUMNS = `id, code, table_id, waiter_id, status, guests, subtotal_cents,
   tip_cents, total_cents, opened_at, closed_at, notes`

function toOrder(
  row: OrderRecord,
  tableLabels: Map<string, string>,
  items: Map<string, number>,
): OrderRow {
  return {
    id: row.id,
    code: row.code,
    tableId: row.table_id,
    tableLabel: row.table_id ? tableLabels.get(row.table_id) ?? '' : '',
    waiterId: row.waiter_id,
    status: row.status,
    guests: row.guests,
    subtotalCents: row.subtotal_cents,
    tipCents: row.tip_cents,
    totalCents: row.total_cents,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    notes: row.notes,
    items: items.get(row.id) ?? 0,
  }
}

export async function getPedidosRestaurantePage(offset = 0): Promise<Page<OrderRow>> {
  const member = await requirePermission('restaurante:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const [ordersResult, { data: tableRows }] = await Promise.all([
    supabase
      .from('restaurant_orders')
      .select(ORDER_COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('opened_at', { ascending: false })
      .range(from, to),
    supabase
      .from('dining_tables')
      .select('id, label')
      .eq('org_id', member.orgId)
      .is('deleted_at', null),
  ])

  if (ordersResult.error) {
    console.error('[restaurante] getPedidosRestaurantePage', ordersResult.error)
    return { rows: [], total: 0 }
  }

  const rows = ordersResult.data as unknown as OrderRecord[]
  const { data: itemRows } = await supabase
    .from('restaurant_order_items')
    .select('id, order_id')
    .in('order_id', rows.map((r) => r.id))

  const counts = new Map<string, number>()
  for (const row of itemRows ?? []) {
    counts.set(row.order_id, (counts.get(row.order_id) ?? 0) + 1)
  }
  const labels = new Map((tableRows ?? []).map((t) => [t.id, t.label]))

  return {
    rows: rows.map((row) => toOrder(row, labels, counts)),
    total: totalOf(ordersResult.count, rows.length, from),
  }
}

export async function getRestaurante(): Promise<RestauranteData> {
  const member = await requirePermission('restaurante:read')
  const supabase = await createClient()

  const [ordersResult, menuResult, tablesResult, roster] = await Promise.all([
    supabase
      .from('restaurant_orders')
      .select(ORDER_COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('opened_at', { ascending: false })
      .range(...pageRange(0)),
    supabase
      .from('menu_items')
      .select('id, name, category, description, price_cents, cost_cents, prep_minutes, allergens, is_available')
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('category', { ascending: true })
      .limit(400),
    supabase
      .from('dining_tables')
      .select('id, label, zone, seats, status')
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('label', { ascending: true })
      .limit(200),
    rosterFor(supabase, member),
  ])

  if (ordersResult.error) {
    console.error('[restaurante] getRestaurante', ordersResult.error)
    return {
      pedidos: [], pedidosTotal: 0, items: [], menu: [], mesas: [],
      roster: [], canWrite: false,
    }
  }
  if (menuResult.error) console.error('[restaurante] menu', menuResult.error)
  if (tablesResult.error) console.error('[restaurante] tables', tablesResult.error)

  const rows = ordersResult.data as unknown as OrderRecord[]
  const tableRows = (tablesResult.data ?? []) as unknown as TableRecord[]
  const labels = new Map(tableRows.map((t) => [t.id, t.label]))

  const { data: itemData, error: itemError } = await supabase
    .from('restaurant_order_items')
    .select('id, order_id, menu_item_id, description, quantity, unit_price_cents, notes, position')
    .in('order_id', rows.map((r) => r.id))
    .order('position', { ascending: true })
    .limit(1000)

  if (itemError) console.error('[restaurante] items', itemError)

  const itemRows = (itemData ?? []) as unknown as ItemRecord[]
  const counts = new Map<string, number>()
  for (const row of itemRows) {
    counts.set(row.order_id, (counts.get(row.order_id) ?? 0) + 1)
  }

  return {
    pedidos: rows.map((row) => toOrder(row, labels, counts)),
    pedidosTotal: totalOf(ordersResult.count, rows.length),
    items: itemRows.map((row) => ({
      id: row.id,
      orderId: row.order_id,
      menuItemId: row.menu_item_id,
      description: row.description,
      quantity: row.quantity,
      unitPriceCents: row.unit_price_cents,
      notes: row.notes,
      position: row.position,
    })),
    menu: ((menuResult.data ?? []) as unknown as MenuRecord[]).map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      description: row.description,
      priceCents: row.price_cents,
      costCents: row.cost_cents,
      prepMinutes: row.prep_minutes,
      allergens: row.allergens,
      isAvailable: row.is_available,
      marginPct: row.price_cents > 0
        ? Math.round(((row.price_cents - row.cost_cents) / row.price_cents) * 100)
        : null,
    })),
    mesas: tableRows.map((row) => ({
      id: row.id,
      label: row.label,
      zone: row.zone,
      seats: row.seats,
      status: row.status,
    })),
    roster,
    canWrite: can(member.permissions, 'restaurante:write'),
  }
}
