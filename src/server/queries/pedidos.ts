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
  /**
   * La factura que salió de este pedido, si ya salió.
   *
   * `invoices.sales_order_id` existe desde la migración 98 y nadie la leía ni
   * la escribía. Sin esto la pantalla no puede decir si un pedido ya está
   * facturado, y «Facturar» sería un botón que se puede pulsar dos veces sin
   * que nada en la lista lo desmienta.
   */
  invoice: { id: string; code: string | null; status: string } | null
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
  // Array y no objeto: la FK vive en `invoices`, así que desde este lado la
  // relación es uno-a-muchos aunque en la práctica sea una factura por pedido.
  // Facturar en dos tandas es algo que las empresas hacen, y el modelo no se
  // lo prohíbe — la pantalla enseña la primera viva.
  invoices: Array<{
    id: string
    code: string | null
    status: string
    deleted_at: string | null
  }> | null
}

const ORDER_COLUMNS = `
  id, code, client_id, client_name, quote_id, status, issued_on, due_on,
  payment_terms, shipping_address, notes,
  subtotal_cents, discount_cents, tax_cents, total_cents,
  items: sales_order_items (
    id, product_id, quote_item_id, description, quantity, unit,
    unit_price_cents, subtotal_cents
  ),
  invoices ( id, code, status, deleted_at )
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
    invoice: (() => {
      const live = (r.invoices ?? []).find((inv) => inv.deleted_at === null)
      return live ? { id: live.id, code: live.code, status: live.status } : null
    })(),
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

  const [ordersResult, quotesResult, convertedResult] = await Promise.all([
    supabase
      .from('sales_orders')
      .select(ORDER_COLUMNS)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('issued_on', { ascending: false })
      .limit(300),
    // Accepted quotes, of which the converted ones are removed below.
    //
    // Esto era una sola consulta con la exclusión dentro:
    //
    //     .not('id', 'in', supabase.from('sales_orders').select('quote_id')…)
    //
    // PostgREST no tiene subconsultas, y supabase-js no avisa: convierte el
    // builder a texto y manda `id=not.in.[object Object]`, que el servidor
    // rechaza con un 400. Como el error de *esta* consulta nunca se miraba
    // —solo el de `ordersResult`—, `quotes` quedaba en `[]` siempre, el botón
    // «Desde cotización» salía deshabilitado con el texto «No hay cotizaciones
    // aceptadas sin pedido todavía», y no había forma de crear un pedido desde
    // la interfaz. Con cero pedidos en la base, nadie lo había notado.
    supabase
      .from('quotes')
      .select('id, code, client, items: quote_items(quantity, unit_price_cents)')
      .eq('org_id', member.orgId)
      .eq('status', 'Aceptada')
      .is('deleted_at', null)
      .order('issued_on', { ascending: false })
      .limit(50),
    // Las cotizaciones ya consumidas, como columna suelta. Se cruza en
    // memoria porque es la única forma honesta de hacerlo con PostgREST, y
    // una lista de uuids es barata de traer.
    supabase
      .from('sales_orders')
      .select('quote_id')
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .neq('status', 'Cancelado')
      .not('quote_id', 'is', null)
      .limit(5000),
  ])

  if (ordersResult.error) {
    console.error('[pedidos] getPedidos', ordersResult.error)
    return { pedidos: [], total: 0, canWrite: false, quotes: [] }
  }

  // El error de esta consulta sí se mira ahora: una lista vacía por fallo y una
  // lista vacía porque no hay nada que convertir se ven igual en pantalla, y
  // eso es exactamente lo que escondió el bug de la subconsulta.
  if (quotesResult.error) console.error('[pedidos] getPedidos quotes', quotesResult.error)
  if (convertedResult.error) console.error('[pedidos] getPedidos converted', convertedResult.error)

  const converted = new Set(
    ((convertedResult.data ?? []) as Array<{ quote_id: string | null }>)
      .map((r) => r.quote_id)
      .filter((id): id is string => id !== null),
  )

  return {
    pedidos: (ordersResult.data as unknown as OrderRecord[]).map(toPedido),
    total: ordersResult.data.length,
    canWrite: can(member.permissions, 'pedidos:write'),
    quotes: (quotesResult.data ?? []).filter((q) => !converted.has(q.id)).map((q) => ({
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