import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { allows, pageRange, totalOf, type Page, type Supabase } from './shared'
import type { Member } from '@/lib/auth/session'

/**
 * Orders that arrived from the public storefront, and the coupons that priced
 * them.
 *
 * Distinct from `tienda`, which is the internal catalogue-and-cart an employee
 * uses to raise an order against the company. This is what a customer bought:
 * it has a shipping address, a courier, a payment state and a return. Folding
 * the two together would mean every internal requisition carried a tracking
 * number field it would never use.
 */

export interface OnlineOrderRow {
  id: string
  code: string | null
  clientId: string | null
  customerName: string
  customerEmail: string | null
  customerPhone: string
  status: string
  shippingMethod: string
  shippingAddress: string
  shippingCity: string
  trackingCode: string
  subtotalCents: number
  shippingCents: number
  discountCents: number
  totalCents: number
  couponCode: string
  placedAt: string
  shippedAt: string | null
  deliveredAt: string | null
  notes: string
  items: number
}

export interface OrderItemRow {
  id: string
  orderId: string
  productId: string | null
  description: string
  quantity: number
  unitPriceCents: number
  position: number
}

export interface CouponRow {
  id: string
  code: string
  percentOff: number | null
  amountOffCents: number | null
  minTotalCents: number
  maxUses: number | null
  usedCount: number
  startsOn: string | null
  expiresOn: string | null
  isActive: boolean
}

export interface ProductRef {
  id: string
  sku: string
  name: string
  priceCents: number
}

export interface EcommerceData {
  pedidos: OnlineOrderRow[]
  pedidosTotal: number
  items: OrderItemRow[]
  cupones: CouponRow[]
  productos: ProductRef[]
  canWrite: boolean
}

interface OrderRecord {
  id: string
  code: string | null
  client_id: string | null
  customer_name: string
  customer_email: string | null
  customer_phone: string
  status: string
  shipping_method: string
  shipping_address: string
  shipping_city: string
  tracking_code: string
  subtotal_cents: number
  shipping_cents: number
  discount_cents: number
  total_cents: number
  coupon_code: string
  placed_at: string
  shipped_at: string | null
  delivered_at: string | null
  notes: string
}

interface ItemRecord {
  id: string
  order_id: string
  product_id: string | null
  description: string
  quantity: number
  unit_price_cents: number
  position: number
}

interface CouponRecord {
  id: string
  code: string
  percent_off: number | null
  amount_off_cents: number | null
  min_total_cents: number
  max_uses: number | null
  used_count: number
  starts_on: string | null
  expires_on: string | null
  is_active: boolean
}

const ORDER_COLUMNS = `id, code, client_id, customer_name, customer_email, customer_phone,
   status, shipping_method, shipping_address, shipping_city, tracking_code,
   subtotal_cents, shipping_cents, discount_cents, total_cents, coupon_code,
   placed_at, shipped_at, delivered_at, notes`

function toOrder(row: OrderRecord, items: Map<string, number>): OnlineOrderRow {
  return {
    id: row.id,
    code: row.code,
    clientId: row.client_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    status: row.status,
    shippingMethod: row.shipping_method,
    shippingAddress: row.shipping_address,
    shippingCity: row.shipping_city,
    trackingCode: row.tracking_code,
    subtotalCents: row.subtotal_cents,
    shippingCents: row.shipping_cents,
    discountCents: row.discount_cents,
    totalCents: row.total_cents,
    couponCode: row.coupon_code,
    placedAt: row.placed_at,
    shippedAt: row.shipped_at,
    deliveredAt: row.delivered_at,
    notes: row.notes,
    items: items.get(row.id) ?? 0,
  }
}

async function productsFor(supabase: Supabase, member: Member, limit = 200): Promise<ProductRef[]> {
  if (!allows(member, 'catalogos:read')) return []
  const { data, error } = await supabase
    .from('products')
    .select('id, sku, name, price_cents')
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .limit(limit)
  if (error) {
    console.error('[ecommerce] productsFor', error)
    return []
  }
  return (data ?? []).map((r) => ({
    id: r.id, sku: r.sku, name: r.name, priceCents: r.price_cents,
  }))
}

export async function getPedidosPage(offset = 0): Promise<Page<OnlineOrderRow>> {
  const member = await requirePermission('ecommerce:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('online_orders')
    .select(ORDER_COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('placed_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[ecommerce] getPedidosPage', error)
    return { rows: [], total: 0 }
  }

  const rows = data as unknown as OrderRecord[]
  const { data: itemRows } = await supabase
    .from('online_order_items')
    .select('id, order_id')
    .in('order_id', rows.map((r) => r.id))

  const counts = new Map<string, number>()
  for (const row of itemRows ?? []) {
    counts.set(row.order_id, (counts.get(row.order_id) ?? 0) + 1)
  }

  return {
    rows: rows.map((row) => toOrder(row, counts)),
    total: totalOf(count, rows.length, from),
  }
}

export async function getEcommerce(): Promise<EcommerceData> {
  const member = await requirePermission('ecommerce:read')
  const supabase = await createClient()

  const [ordersResult, couponsResult, productos] = await Promise.all([
    supabase
      .from('online_orders')
      .select(ORDER_COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('placed_at', { ascending: false })
      .range(...pageRange(0)),
    supabase
      .from('discount_coupons')
      .select('id, code, percent_off, amount_off_cents, min_total_cents, max_uses, used_count, starts_on, expires_on, is_active')
      .eq('org_id', member.orgId)
      .order('code', { ascending: true })
      .limit(200),
    productsFor(supabase, member),
  ])

  if (ordersResult.error) {
    console.error('[ecommerce] getEcommerce', ordersResult.error)
    return { pedidos: [], pedidosTotal: 0, items: [], cupones: [], productos: [], canWrite: false }
  }
  if (couponsResult.error) console.error('[ecommerce] coupons', couponsResult.error)

  const rows = ordersResult.data as unknown as OrderRecord[]

  const { data: itemData, error: itemError } = await supabase
    .from('online_order_items')
    .select('id, order_id, product_id, description, quantity, unit_price_cents, position')
    .in('order_id', rows.map((r) => r.id))
    .order('position', { ascending: true })
    .limit(1000)

  if (itemError) console.error('[ecommerce] items', itemError)

  const itemRows = (itemData ?? []) as unknown as ItemRecord[]
  const counts = new Map<string, number>()
  for (const row of itemRows) {
    counts.set(row.order_id, (counts.get(row.order_id) ?? 0) + 1)
  }

  return {
    pedidos: rows.map((row) => toOrder(row, counts)),
    pedidosTotal: totalOf(ordersResult.count, rows.length),
    items: itemRows.map((row) => ({
      id: row.id,
      orderId: row.order_id,
      productId: row.product_id,
      description: row.description,
      quantity: row.quantity,
      unitPriceCents: row.unit_price_cents,
      position: row.position,
    })),
    cupones: ((couponsResult.data ?? []) as unknown as CouponRecord[]).map((row) => ({
      id: row.id,
      code: row.code,
      percentOff: row.percent_off,
      amountOffCents: row.amount_off_cents,
      minTotalCents: row.min_total_cents,
      maxUses: row.max_uses,
      usedCount: row.used_count,
      startsOn: row.starts_on,
      expiresOn: row.expires_on,
      isActive: row.is_active,
    })),
    productos,
    canWrite: can(member.permissions, 'ecommerce:write'),
  }
}
