import { createClient } from '@/lib/supabase/server'
import { can } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/session'
import { pageRange, totalOf, type Page } from '@/server/queries/shared'

export const ORDER_STATUSES = [
  'Borrador', 'Confirmado', 'En preparación', 'Despachado', 'Entregado', 'Cancelado',
] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export interface SalesOrderRow {
  id: string
  code: string | null
  clientName: string
  clientId: string | null
  quoteId: string | null
  status: OrderStatus
  issuedOn: string
  dueOn: string | null
  paymentTerms: string
  shippingAddress: string
  notes: string
  subtotalCents: number
  discountCents: number
  taxCents: number
  totalCents: number
  items: SalesOrderItem[]
}

export interface SalesOrderItem {
  id: string
  productId: string | null
  quoteItemId: string | null
  description: string
  quantity: number
  unit: string
  unitPriceCents: number
  subtotalCents: number
}

export interface QuoteOption {
  id: string
  code: string | null
  client: string
  totalCents: number
}

export interface PedidosData {
  pedidos: SalesOrderRow[]
  total: number
  canWrite: boolean
  /** Cotizaciones Aceptadas sin pedido activo — candidatas a convertir. */
  quotes: QuoteOption[]
}

type OrderRecord = {
  id: string
  code: string | null
  client_id: string | null
  client_name: string
  quote_id: string | null
  status: OrderStatus
  issued_on: string
  due_on: string | null
  payment_terms: string
  shipping_address: string
  notes: string
  subtotal_cents: number
  discount_cents: number
  tax_cents: number
  total_cents: number
  items: Array<{
    id: string
    product_id: string | null
    quote_item_id: string | null
    description: string
    quantity: number
    unit: string
    unit_price_cents: number
    subtotal_cents: number
  }>
}

const ORDER_COLUMNS = `
  id, code, client_id, client_name, quote_id, status, issued_on, due_on,
  payment_terms, shipping_address, notes,
  subtotal_cents, discount_cents, tax_cents, total_cents,
  items: sales_order_items (
    id, product_id, quote_item_id, description, quantity, unit,
    unit_price_cents, subtotal_cents
  )
`

function toPedido(r: OrderRecord): SalesOrderRow {
  return {
    id: r.id,
    code: r.code,
    clientName: r.client_name,
    clientId: r.client_id,
    quoteId: r.quote_id,
    status: r.status,
    issuedOn: r.issued_on,
    dueOn: r.due_on,
    paymentTerms: r.payment_terms,
    shippingAddress: r.shipping_address,
    notes: r.notes,
    subtotalCents: r.subtotal_cents,
    discountCents: r.discount_cents,
    taxCents: r.tax_cents,
    totalCents: r.total_cents,
    items: (r.items ?? []).map((i) => ({
      id: i.id,
      productId: i.product_id,
      quoteItemId: i.quote_item_id,
      description: i.description,
      quantity: i.quantity,
      unit: i.unit,
      unitPriceCents: i.unit_price_cents,
      subtotalCents: i.subtotal_cents,
    })),
  }
}

/** One page of orders, newest first. */
export async function getPedidosPage(offset = 0): Promise<Page<SalesOrderRow>> {
  const member = await requirePermission('pedidos:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('sales_orders')
    .select(ORDER_COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('issued_on', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[pedidos] getPedidosPage', error)
    return { rows: [], total: 0 }
  }

  return {
    rows: (data as unknown as OrderRecord[]).map(toPedido),
    total: totalOf(count, data.length, from),
  }
}

export async function getPedidos(): Promise<PedidosData> {
  const member = await requirePermission('pedidos:read')
  const supabase = await createClient()

  const [ordersResult, quotesResult] = await Promise.all([
    supabase
      .from('sales_orders')
      .select(ORDER_COLUMNS)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('issued_on', { ascending: false })
      .limit(300),
    // Quotes that can still become an order: accepted, not yet converted.
    // Without `clientes`, quotes still carry their textual client name, so
    // the selector works on the soft dependency alone.
    supabase
      .from('quotes')
      .select('id, code, client, items: quote_items(quantity, unit_price_cents)')
      .eq('org_id', member.orgId)
      .eq('status', 'Aceptada')
      .is('deleted_at', null)
      .not('id', 'in', supabase
        .from('sales_orders')
        .select('quote_id')
        .eq('org_id', member.orgId)
        .is('deleted_at', null)
        .not('status', 'eq', 'Cancelado'))
      .order('issued_on', { ascending: false })
      .limit(50),
  ])

  if (ordersResult.error) {
    console.error('[pedidos] getPedidos', ordersResult.error)
    return { pedidos: [], total: 0, canWrite: false, quotes: [] }
  }

  return {
    pedidos: (ordersResult.data as unknown as OrderRecord[]).map(toPedido),
    total: ordersResult.data.length,
    canWrite: can(member.permissions, 'pedidos:write'),
    quotes: (quotesResult.data ?? []).map((q) => ({
      id: q.id,
      code: q.code,
      client: q.client,
      totalCents: (q.items ?? []).reduce(
        (s, i) => s + Math.round(i.quantity * i.unit_price_cents),
        0,
      ),
    })),
  }
}