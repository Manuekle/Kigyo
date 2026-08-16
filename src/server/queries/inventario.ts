import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { pageRange, rosterFor, scoped, totalOf, type Page, type RosterEntry } from './shared'

/**
 * Assets and stock orders, read through RLS.
 *
 * The screen used to hold both lists in `useState`, with the holder as a name
 * string and the sentinel `'—'` for "unassigned" — so an asset assigned to
 * nobody and an asset assigned to a person called "—" were the same row.
 *
 * `inventory_assets.employee_id` is nullable and carries a check constraint
 * (`inventory_assets_assignment_consistent`) that an asset is 'Asignado' if
 * and only if somebody holds it.
 */

export interface ActivoRow {
  id: string
  code: string | null
  name: string
  category: string
  employeeId: string | null
  employeeName: string | null
  serial: string
  status: string
  acquiredOn: string | null
  siteId: string | null
  siteName: string | null
}

export interface PedidoRow {
  id: string
  code: string | null
  item: string
  supplier: string
  quantity: number
  estPriceCents: number
  requestedById: string | null
  requestedByName: string | null
  status: string
  orderedOn: string
}

export interface InventarioData {
  activos: ActivoRow[]
  /** Assets in the organization, of which `activos` is the first page. */
  activosTotal: number
  pedidos: PedidoRow[]
  /** Orders in the organization, of which `pedidos` is the first page. */
  pedidosTotal: number
  roster: RosterEntry[]
  canWrite: boolean
  /** Active branches, for the site picker on the asset form. */
  sites: Array<{ id: string; name: string }>
}

interface AssetRecord {
  id: string
  code: string | null
  name: string
  category: string
  employee_id: string | null
  serial: string
  status: string
  acquired_on: string | null
  employees: { full_name: string } | null
  site_id: string | null
  sites: { name: string } | null
}

interface OrderRecord {
  id: string
  code: string | null
  item: string
  supplier: string
  quantity: number
  est_price_cents: number
  requested_by_id: string | null
  status: string
  ordered_on: string
  employees: { full_name: string } | null
}

const ASSET_COLUMNS =
  'id, code, name, category, employee_id, serial, status, acquired_on, site_id, employees ( full_name ), sites ( name )'

const ORDER_COLUMNS =
  'id, code, item, supplier, quantity, est_price_cents, requested_by_id, status, ordered_on, employees ( full_name )'

function toActivo(row: AssetRecord): ActivoRow {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    employeeId: row.employee_id,
    employeeName: row.employees?.full_name ?? null,
    serial: row.serial,
    status: row.status,
    acquiredOn: row.acquired_on,
    siteId: row.site_id,
    siteName: row.sites?.name ?? null,
  }
}

function toPedido(row: OrderRecord): PedidoRow {
  return {
    id: row.id,
    code: row.code,
    item: row.item,
    supplier: row.supplier,
    quantity: row.quantity,
    estPriceCents: Number(row.est_price_cents),
    requestedById: row.requested_by_id,
    requestedByName: row.employees?.full_name ?? null,
    status: row.status,
    orderedOn: row.ordered_on,
  }
}

/** One page of the asset register, alphabetical. */
export async function getActivosPage(offset = 0): Promise<Page<ActivoRow>> {
  const member = await requirePermission('inventario:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('inventory_assets')
    .select(ASSET_COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .range(from, to)

  if (error) {
    console.error('[inventario] getActivosPage', error)
    return { rows: [], total: 0 }
  }

  return {
    rows: (data as unknown as AssetRecord[]).map(toActivo),
    total: totalOf(count, data.length, from),
  }
}

/**
 * One page of purchase orders, newest first.
 *
 * This is the table the storefront writes a row into per checkout line, so it
 * grows with trade rather than with the size of the company.
 */
export async function getPedidosPage(offset = 0): Promise<Page<PedidoRow>> {
  const member = await requirePermission('inventario:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('inventory_orders')
    .select(ORDER_COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('ordered_on', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[inventario] getPedidosPage', error)
    return { rows: [], total: 0 }
  }

  return {
    rows: (data as unknown as OrderRecord[]).map(toPedido),
    total: totalOf(count, data.length, from),
  }
}

export async function getInventario(): Promise<InventarioData> {
  const member = await requirePermission('inventario:read')
  const supabase = await createClient()

  const [assetsResult, ordersResult, roster, sitesResult] = await Promise.all([
    supabase
      .from('inventory_assets')
      .select(ASSET_COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('name', { ascending: true })
      .range(...pageRange(0)),
    supabase
      .from('inventory_orders')
      .select(ORDER_COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('ordered_on', { ascending: false })
      .range(...pageRange(0)),
    rosterFor(supabase, member),
    scoped(supabase, member, 'sites')
      .select('id, name')
      .is('deleted_at', null)
      .order('name', { ascending: true }),
  ])

  if (assetsResult.error) {
    console.error('[inventario] getInventario', assetsResult.error)
    return {
      activos: [], activosTotal: 0, pedidos: [], pedidosTotal: 0,
      roster: [], canWrite: false, sites: [],
    }
  }

  const activos = (assetsResult.data as unknown as AssetRecord[]).map(toActivo)
  const pedidos = ((ordersResult.data ?? []) as unknown as OrderRecord[]).map(toPedido)
  const sites = ((sitesResult.data ?? []) as Array<{ id: string; name: string }>)

  return {
    activos,
    activosTotal: totalOf(assetsResult.count, activos.length),
    pedidos,
    pedidosTotal: totalOf(ordersResult.count, pedidos.length),
    roster,
    canWrite: can(member.permissions, 'inventario:write'),
    sites,
  }
}
