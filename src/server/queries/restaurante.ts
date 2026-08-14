import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { cashDifferenceCents } from '@/lib/domain'
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

/** A booking. `orderId` is set once the party is seated and becomes a bill. */
export interface ReservationRow {
  id: string
  code: string | null
  tableId: string | null
  tableLabel: string
  guestName: string
  guestPhone: string
  partySize: number
  reservedAt: string
  status: string
  orderId: string | null
  notes: string
}

/** One line of a dish's recipe. `costCents` is the cost of `quantity`, not of one. */
export interface IngredientRow {
  id: string
  menuItemId: string
  name: string
  quantity: number
  unit: string
  costCents: number
}

export interface CashSessionRow {
  id: string
  code: string | null
  openedBy: string | null
  openedByName: string
  openedAt: string
  openingFloatCents: number
  closedAt: string | null
  countedCents: number | null
  expectedCents: number | null
  status: string
  notes: string
  /**
   * Counted minus (expected + float). Null while open — a session that has not
   * been counted has no difference, and rendering 0 would read as "it balanced".
   */
  differenceCents: number | null
  /** Orders attached to this session, so a closed arqueo can be traced. */
  orders: number
}

export interface DeliveryRow {
  id: string
  orderId: string
  orderCode: string | null
  courierId: string | null
  courierName: string
  address: string
  phone: string
  status: string
  feeCents: number
  totalCents: number
  dispatchedAt: string | null
  deliveredAt: string | null
  notes: string
}

export interface RestauranteData {
  pedidos: OrderRow[]
  pedidosTotal: number
  items: OrderItemRow[]
  menu: MenuItemRow[]
  mesas: TableRow[]
  reservas: ReservationRow[]
  /** Every recipe line for the menu above, grouped by the client. */
  insumos: IngredientRow[]
  cajas: CashSessionRow[]
  domicilios: DeliveryRow[]
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

  const [
    ordersResult, menuResult, tablesResult, roster,
    reservationsResult, cashResult, deliveriesResult,
  ] = await Promise.all([
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
    supabase
      .from('restaurant_reservations')
      .select('id, code, table_id, guest_name, guest_phone, party_size, reserved_at, status, order_id, notes')
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      // Newest booking first: the list is read forwards from tonight, and a
      // service that starts at the reservations taken in March is unusable.
      .order('reserved_at', { ascending: false })
      .limit(200),
    supabase
      .from('cash_sessions')
      .select('id, code, opened_by, opened_at, opening_float_cents, closed_at, counted_cents, expected_cents, status, notes')
      .eq('org_id', member.orgId)
      .order('opened_at', { ascending: false })
      .limit(120),
    // Deliveries are children of orders, so the tenant filter rides on the
    // join rather than on a column this table does not have.
    supabase
      .from('restaurant_deliveries')
      .select(`id, order_id, courier_id, address, phone, status, fee_cents,
               dispatched_at, delivered_at, notes,
               restaurant_orders!inner ( code, total_cents, org_id )`)
      .eq('restaurant_orders.org_id', member.orgId)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  if (ordersResult.error) {
    console.error('[restaurante] getRestaurante', ordersResult.error)
    return {
      pedidos: [], pedidosTotal: 0, items: [], menu: [], mesas: [],
      reservas: [], insumos: [], cajas: [], domicilios: [],
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

  // Recipe lines for the menu that was just read. Scoped to those ids rather
  // than to the org, because `menu_item_ingredients` inherits its tenant
  // boundary from its parent and has no org_id of its own to filter on.
  const menuRows = (menuResult.data ?? []) as unknown as MenuRecord[]
  const { data: ingredientData, error: ingredientError } = menuRows.length > 0
    ? await supabase
        .from('menu_item_ingredients')
        .select('id, menu_item_id, name, quantity, unit, cost_cents')
        .in('menu_item_id', menuRows.map((m) => m.id))
        .order('name', { ascending: true })
        .limit(2000)
    : { data: [], error: null }

  if (ingredientError) console.error('[restaurante] ingredients', ingredientError)
  if (reservationsResult.error) console.error('[restaurante] reservations', reservationsResult.error)
  if (cashResult.error) console.error('[restaurante] cash', cashResult.error)
  if (deliveriesResult.error) console.error('[restaurante] deliveries', deliveriesResult.error)

  const cashRows = (cashResult.data ?? []) as unknown as Array<{
    id: string; code: string | null; opened_by: string | null; opened_at: string
    opening_float_cents: number; closed_at: string | null
    counted_cents: number | null; expected_cents: number | null
    status: string; notes: string
  }>

  // How many orders each session collected. Read once for every session on
  // screen rather than per row, which would be a query per card.
  const { data: sessionOrders } = cashRows.length > 0
    ? await supabase
        .from('restaurant_orders')
        .select('id, cash_session_id')
        .eq('org_id', member.orgId)
        .in('cash_session_id', cashRows.map((c) => c.id))
    : { data: [] }

  const ordersPerSession = new Map<string, number>()
  for (const row of sessionOrders ?? []) {
    if (!row.cash_session_id) continue
    ordersPerSession.set(row.cash_session_id, (ordersPerSession.get(row.cash_session_id) ?? 0) + 1)
  }

  const staff = new Map(roster.map((r) => [r.employeeId, r.fullName]))

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
    menu: menuRows.map((row) => ({
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
    reservas: ((reservationsResult.data ?? []) as unknown as Array<{
      id: string; code: string | null; table_id: string | null
      guest_name: string; guest_phone: string; party_size: number
      reserved_at: string; status: string; order_id: string | null; notes: string
    }>).map((row) => ({
      id: row.id,
      code: row.code,
      tableId: row.table_id,
      tableLabel: row.table_id ? labels.get(row.table_id) ?? '' : '',
      guestName: row.guest_name,
      guestPhone: row.guest_phone,
      partySize: row.party_size,
      reservedAt: row.reserved_at,
      status: row.status,
      orderId: row.order_id,
      notes: row.notes,
    })),
    insumos: ((ingredientData ?? []) as unknown as Array<{
      id: string; menu_item_id: string; name: string
      quantity: number; unit: string; cost_cents: number
    }>).map((row) => ({
      id: row.id,
      menuItemId: row.menu_item_id,
      name: row.name,
      quantity: row.quantity,
      unit: row.unit,
      costCents: row.cost_cents,
    })),
    cajas: cashRows.map((row) => ({
      id: row.id,
      code: row.code,
      openedBy: row.opened_by,
      openedByName: row.opened_by ? staff.get(row.opened_by) ?? '' : '',
      openedAt: row.opened_at,
      openingFloatCents: row.opening_float_cents,
      closedAt: row.closed_at,
      countedCents: row.counted_cents,
      expectedCents: row.expected_cents,
      status: row.status,
      notes: row.notes,
      // Computed here rather than stored: it is a subtraction of three columns
      // that are already on the row, and a fourth column would be a fourth
      // thing that can disagree with them.
      differenceCents: row.counted_cents !== null && row.expected_cents !== null
        ? cashDifferenceCents(row.counted_cents, row.expected_cents, row.opening_float_cents)
        : null,
      orders: ordersPerSession.get(row.id) ?? 0,
    })),
    domicilios: ((deliveriesResult.data ?? []) as unknown as Array<{
      id: string; order_id: string; courier_id: string | null
      address: string; phone: string; status: string; fee_cents: number
      dispatched_at: string | null; delivered_at: string | null; notes: string
      restaurant_orders: { code: string | null; total_cents: number } | null
    }>).map((row) => ({
      id: row.id,
      orderId: row.order_id,
      orderCode: row.restaurant_orders?.code ?? null,
      courierId: row.courier_id,
      courierName: row.courier_id ? staff.get(row.courier_id) ?? '' : '',
      address: row.address,
      phone: row.phone,
      status: row.status,
      feeCents: row.fee_cents,
      totalCents: row.restaurant_orders?.total_cents ?? 0,
      dispatchedAt: row.dispatched_at,
      deliveredAt: row.delivered_at,
      notes: row.notes,
    })),
    roster,
    canWrite: can(member.permissions, 'restaurante:write'),
  }
}
