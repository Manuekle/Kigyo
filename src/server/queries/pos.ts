import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { paymentsSimulated } from '@/lib/wompi'
import { pageRange, scoped, totalOf, type Page } from './shared'

/**
 * El mostrador.
 *
 * Un comercio vendía por `tienda`, que es un catálogo web con carrito: sirve
 * para que alguien pida desde el celular y no para cobrarle a quien está parado
 * enfrente. Esta pantalla es lo segundo — un carrito que se arma rápido, cobra,
 * descuenta existencias y queda atado al turno de caja que estuviera abierto.
 *
 * La venta se registra en una función de base de datos (`register_pos_sale`,
 * migración 43) y no desde aquí. No es una preferencia de estilo: leer las
 * existencias, decidir y después escribirlas deja una ventana en la que dos
 * cajeros venden la última unidad, y el UPDATE sobre `products` exigiría
 * `catalogos:write` a quien solo está cobrando.
 */

export interface SellableRow {
  id: string
  sku: string
  barcode: string
  name: string
  category: string
  priceCents: number
  stock: number
  unit: string
}

export interface SaleItemRow {
  id: string
  productId: string | null
  sku: string
  name: string
  quantity: number
  unitPriceCents: number
  totalCents: number
}

export interface SaleRow {
  id: string
  code: string | null
  customerName: string
  subtotalCents: number
  discountCents: number
  totalCents: number
  paymentMethod: string
  status: string
  soldAt: string
  soldByName: string | null
  notes: string
  items: SaleItemRow[]
  /** Si quedó atada a un turno de caja. Null cuando no había ninguno abierto. */
  sessionId: string | null
  /** Sucursal donde se vendió. Null = empresa sin sucursal o venta sin turno. */
  siteId: string | null
  siteName: string | null
}

export interface ReceiptPrefs {
  /** Ancho del papel: 80 (térmica estándar) u 58 (portátil). */
  width: number
  /** Texto del pie del recibo. */
  footer: string
  /** Encabezado con el nombre de la empresa. */
  showLogo: boolean
}

export interface PosData {
  /** Lo que se puede vender hoy: activo, con existencias, del catálogo. */
  vendibles: SellableRow[]
  ventas: SaleRow[]
  ventasTotal: number
  /** Cobrado hoy, sin contar anuladas. */
  vendidoHoyCents: number
  ventasHoy: number
  /** Hay un turno de caja abierto al que esta venta se va a enganchar. */
  cajaAbierta: boolean
  /** La empresa usa el módulo de caja. Distinto de que haya un turno abierto. */
  hasCaja: boolean
  /** El nombre de la empresa, para el encabezado del recibo. */
  orgName: string
  /** Preferencias del recibo, resueltas con los valores por defecto. */
  receiptPrefs: ReceiptPrefs
  /**
   * Cobro con QR disponible: plan Enterprise + pasarela configurada y
   * habilitada en Integraciones. El cajero no necesita integraciones:read —
   * el flag se resuelve con el cliente admin, y solo dice sí/no.
   */
  qrEnabled: boolean
  canWrite: boolean
  /** Sucursales activas de la empresa, para el selector de mostrador. */
  sites: { id: string; name: string }[]
}

interface SaleRecord {
  id: string
  code: string | null
  customer_name: string
  subtotal_cents: number
  discount_cents: number
  total_cents: number
  payment_method: string
  status: string
  sold_at: string
  sold_by: string | null
  notes: string
  session_id: string | null
  site_id: string | null
}

const SALE_COLUMNS = `id, code, customer_name, subtotal_cents, discount_cents,
   total_cents, payment_method, status, sold_at, sold_by, notes, session_id, site_id`

/** Hoy en ISO local, para el corte del día que muestra la pantalla. */
function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Las líneas de un conjunto de ventas, agrupadas por venta. */
async function itemsFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  saleIds: string[],
): Promise<Map<string, SaleItemRow[]>> {
  if (saleIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from('pos_sale_items')
    .select('id, sale_id, product_id, sku, name, quantity, unit_price_cents, total_cents')
    .in('sale_id', saleIds)

  if (error) {
    console.error('[pos] itemsFor', error)
    return new Map()
  }

  const out = new Map<string, SaleItemRow[]>()
  for (const row of (data ?? []) as Array<{
    id: string; sale_id: string; product_id: string | null; sku: string
    name: string; quantity: number; unit_price_cents: number; total_cents: number
  }>) {
    const item: SaleItemRow = {
      id: row.id,
      productId: row.product_id,
      sku: row.sku,
      name: row.name,
      quantity: row.quantity,
      unitPriceCents: row.unit_price_cents,
      totalCents: row.total_cents,
    }
    const list = out.get(row.sale_id)
    if (list) list.push(item)
    else out.set(row.sale_id, [item])
  }
  return out
}

function toSale(row: SaleRecord, items: SaleItemRow[], names: Map<string, string>): SaleRow {
  return {
    id: row.id,
    code: row.code,
    customerName: row.customer_name,
    subtotalCents: row.subtotal_cents,
    discountCents: row.discount_cents,
    totalCents: row.total_cents,
    paymentMethod: row.payment_method,
    status: row.status,
    soldAt: row.sold_at,
    soldByName: row.sold_by ? names.get(row.sold_by) ?? null : null,
    notes: row.notes,
    items,
    sessionId: row.session_id,
    siteId: row.site_id,
    siteName: null,
  }
}

export async function getVentasPage(offset = 0): Promise<Page<SaleRow>> {
  const member = await requirePermission('pos:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await scoped(supabase, member, 'pos_sales')
    .select(SALE_COLUMNS, { count: 'exact' })
    .order('sold_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[pos] getVentasPage', error)
    return { rows: [], total: 0 }
  }

  const rows = (data ?? []) as SaleRecord[]
  const items = await itemsFor(supabase, rows.map((r) => r.id))

  return {
    rows: rows.map((row) => toSale(row, items.get(row.id) ?? [], new Map())),
    total: totalOf(count, rows.length, from),
  }
}

export async function getPos(): Promise<PosData> {
  const member = await requirePermission('pos:read')
  const supabase = await createClient()

  // El flag del QR es una decisión de plan + configuración, no de permiso:
  // se resuelve con el cliente admin y no expone nada del vault. En modo
  // SIMULADO no hay pasarela que configurar — el loop entero es sintético y
  // basta el plan Enterprise.
  const qrEnabled = member.plan === 'enterprise'
    ? paymentsSimulated()
      ? true
      : await (async () => {
          const admin = createAdminClient()
          const { data } = await admin
            .from('integration_settings')
            .select('enabled, config')
            .eq('org_id', member.orgId)
            .eq('kind', 'pagos')
            .maybeSingle()
          const publicKey = (data?.config as Record<string, unknown> | undefined)?.public_key
          return Boolean(data?.enabled && typeof publicKey === 'string' && publicKey)
        })()
    : false

  // El catálogo se lee solo si esta persona puede verlo. Sin el permiso la
  // pantalla queda sin qué vender, y decirlo es mejor que mostrar una rejilla
  // vacía que parece un catálogo sin productos.
  const wantsCatalogue = member.modules.has('catalogos') && can(member.permissions, 'catalogos:read')
  const hasCaja = member.modules.has('caja') && can(member.permissions, 'caja:read')

  const [productsResult, salesResult, sessionResult, orgResult, sitesResult] = await Promise.all([
    wantsCatalogue
      ? scoped(supabase, member, 'products')
          .select('id, sku, barcode, name, category, price_cents, stock, unit')
          .is('deleted_at', null)
          .eq('is_active', true)
          .order('name', { ascending: true })
          .limit(500)
      : Promise.resolve({ data: [] as Array<Record<string, never>> }),
    scoped(supabase, member, 'pos_sales')
      .select(SALE_COLUMNS, { count: 'exact' })
      .order('sold_at', { ascending: false })
      .range(...pageRange(0)),
    hasCaja
      ? scoped(supabase, member, 'cash_sessions')
          .select('id')
          .eq('status', 'Abierta')
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('organizations')
      .select('name, receipt_prefs')
      .eq('id', member.orgId)
      .single(),
    scoped(supabase, member, 'sites')
      .select('id, name')
      .is('deleted_at', null)
      .order('name', { ascending: true }),
  ])

  const saleRows = (salesResult.data ?? []) as SaleRecord[]
  const items = await itemsFor(supabase, saleRows.map((r) => r.id))
  const sites = ((sitesResult.data ?? []) as Array<{ id: string; name: string }>).map((s) => ({
    id: s.id,
    name: s.name,
  }))
  const siteNameById = new Map(sites.map((s) => [s.id, s.name]))

  const vendibles: SellableRow[] = ((productsResult.data ?? []) as unknown as Array<{
    id: string; sku: string; barcode: string; name: string; category: string
    price_cents: number; stock: number; unit: string
  }>).map((row) => ({
    id: row.id,
    sku: row.sku,
    barcode: row.barcode ?? '',
    name: row.name,
    category: row.category,
    priceCents: row.price_cents,
    stock: row.stock,
    unit: row.unit,
  }))

  const ventas = saleRows.map((row) => {
    const sale = toSale(row, items.get(row.id) ?? [], new Map())
    sale.siteName = row.site_id ? siteNameById.get(row.site_id) ?? null : null
    return sale
  })
  const now = today()
  const hoy = ventas.filter((v) => v.status !== 'Anulada' && v.soldAt.slice(0, 10) === now)

  const org = orgResult.data as { name: string; receipt_prefs: Record<string, unknown> | null } | null
  const rawPrefs = org?.receipt_prefs ?? {}
  const width = typeof rawPrefs.width === 'number' && [58, 80].includes(rawPrefs.width)
    ? rawPrefs.width
    : 80

  return {
    vendibles,
    ventas,
    ventasTotal: totalOf(salesResult.count, saleRows.length, 0),
    vendidoHoyCents: hoy.reduce((sum, v) => sum + v.totalCents, 0),
    ventasHoy: hoy.length,
    cajaAbierta: sessionResult.data !== null,
    hasCaja,
    orgName: org?.name ?? '',
    qrEnabled,
    receiptPrefs: {
      width,
      footer: typeof rawPrefs.footer === 'string' && rawPrefs.footer.trim()
        ? rawPrefs.footer.slice(0, 120)
        : 'Gracias por su compra',
      showLogo: typeof rawPrefs.showLogo === 'boolean' ? rawPrefs.showLogo : true,
    },
    canWrite: can(member.permissions, 'pos:write'),
    sites,
  }
}
