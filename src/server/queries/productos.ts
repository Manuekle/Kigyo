import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can, type Permission } from '@/lib/auth/permissions'
import { pageRange, totalOf, type Page, type Supabase } from './shared'

/**
 * Products — one table behind two screens.
 *
 * `catalogos` and `tienda` each held their own hardcoded product list with
 * diverging prices for the same items, which is the exact problem the single
 * `products` table was created to fix (see migration 03's header). They read
 * from it now, so a price change in the catalogue is the price the storefront
 * charges.
 *
 * The two screens differ in *which* products they see and what they may do:
 *   · catálogos — the whole list, including items not offered for sale
 *   · tienda    — only `in_storefront`, and never `cost_cents`
 *
 * Cost is deliberately absent from the storefront shape: margin is not
 * something a store page needs, and shipping it to the browser leaks it to
 * anyone who opens devtools.
 */

export interface ProductoRow {
  id: string
  sku: string
  barcode: string
  name: string
  category: string
  description: string
  unit: string
  priceCents: number
  /** Null in the storefront projection — never sent where it is not needed. */
  costCents: number | null
  stock: number
  supplier: string
  isActive: boolean
  inStorefront: boolean
}

export interface ProductosData {
  productos: ProductoRow[]
  /** Products the scope can see, of which `productos` is the first page. */
  productosTotal: number
  categories: string[]
  canWrite: boolean
}

interface ProductRecord {
  id: string
  sku: string
  barcode: string
  name: string
  category: string
  description: string
  unit: string
  price_cents: number
  cost_cents?: number
  stock: number
  supplier: string
  is_active: boolean
  in_storefront: boolean
}

const BASE_COLUMNS =
  'id, sku, barcode, name, category, description, unit, price_cents, stock, supplier, is_active, in_storefront'

export type ProductScope = 'catalogos' | 'tienda'

function toProducto(row: ProductRecord): ProductoRow {
  return {
    id: row.id,
    sku: row.sku,
    barcode: row.barcode,
    name: row.name,
    category: row.category,
    description: row.description,
    unit: row.unit,
    priceCents: Number(row.price_cents),
    costCents: row.cost_cents === undefined ? null : Number(row.cost_cents),
    stock: row.stock,
    supplier: row.supplier,
    isActive: row.is_active,
    inStorefront: row.in_storefront,
  }
}

/**
 * The one place a scope's filters are decided.
 *
 * Not `async`: a PostgREST builder is thenable, so awaiting it here would run
 * the query and hand back a response with no `.order()` left to call.
 */
function productsQuery(
  scope: ProductScope,
  orgId: string,
  supabase: Supabase,
  columns: string,
) {
  const query = supabase
    .from('products')
    .select(columns, { count: 'exact' })
    .eq('org_id', orgId)
    .is('deleted_at', null)

  return scope === 'tienda'
    ? query.eq('in_storefront', true).eq('is_active', true)
    : query
}

/** Columns the scope is allowed to see. Cost never reaches the storefront. */
function columnsFor(scope: ProductScope): string {
  return scope === 'catalogos' ? `${BASE_COLUMNS}, cost_cents` : BASE_COLUMNS
}

/** One page of products for a scope, alphabetical. */
export async function getProductosPage(
  scope: ProductScope,
  offset = 0,
): Promise<Page<ProductoRow>> {
  const permission: Permission = scope === 'catalogos' ? 'catalogos:read' : 'tienda:read'
  const member = await requirePermission(permission)
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await productsQuery(
    scope, member.orgId, supabase, columnsFor(scope),
  )
    .order('name', { ascending: true })
    .range(from, to)

  if (error) {
    console.error(`[productos] getProductosPage(${scope})`, error)
    return { rows: [], total: 0 }
  }

  return {
    rows: (data as unknown as ProductRecord[]).map(toProducto),
    total: totalOf(count, data.length, from),
  }
}

/**
 * @param scope `catalogos` sees everything and the cost; `tienda` sees only
 *   what is offered for sale, without it.
 */
async function readProducts(scope: ProductScope): Promise<ProductosData> {
  const permission: Permission = scope === 'catalogos' ? 'catalogos:read' : 'tienda:read'
  const writePermission: Permission = scope === 'catalogos' ? 'catalogos:write' : 'tienda:write'

  const member = await requirePermission(permission)
  const supabase = await createClient()

  const [pageResult, categoriesResult] = await Promise.all([
    productsQuery(scope, member.orgId, supabase, columnsFor(scope))
      .order('name', { ascending: true })
      .range(...pageRange(0)),
    // The filter chips list the organization's own categories. Derived from
    // the first page they would drop every category whose products sort after
    // the letter M, and the chip for them would simply not be offered.
    productsQuery(scope, member.orgId, supabase, 'category'),
  ])

  if (pageResult.error) {
    console.error(`[productos] readProducts(${scope})`, pageResult.error)
    return { productos: [], productosTotal: 0, categories: [], canWrite: false }
  }

  const productos = (pageResult.data as unknown as ProductRecord[]).map(toProducto)
  const categoryRows = (categoriesResult.data ?? []) as unknown as Array<{ category: string }>

  return {
    productos,
    productosTotal: totalOf(pageResult.count, productos.length),
    categories: [...new Set(categoryRows.map((p) => p.category).filter(Boolean))].sort(),
    canWrite: can(member.permissions, writePermission),
  }
}

export const getCatalogos = () => readProducts('catalogos')
export const getTienda = () => readProducts('tienda')
