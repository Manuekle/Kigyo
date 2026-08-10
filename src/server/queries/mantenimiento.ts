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
 * Work orders against equipment.
 *
 * The asset is a nullable FK to `inventory_assets` plus a free-text label, not
 * one or the other. A company can run maintenance before it has built an asset
 * register — requiring the FK would make the module unusable until it had —
 * and a company that has one should not be retyping serial numbers.
 */

export interface WorkOrderRow {
  id: string
  code: string | null
  title: string
  kind: string
  status: string
  priority: string
  assetId: string | null
  assetLabel: string
  assigneeId: string | null
  location: string
  detail: string
  scheduledOn: string | null
  completedAt: string | null
  downtimeHours: number
  laborCostCents: number
  partsCostCents: number
  recurrenceDays: number | null
}

export interface AssetRef {
  id: string
  name: string
  code: string | null
}

export interface MantenimientoData {
  ordenes: WorkOrderRow[]
  ordenesTotal: number
  assets: AssetRef[]
  roster: RosterEntry[]
  canWrite: boolean
}

interface WorkOrderRecord {
  id: string
  code: string | null
  title: string
  kind: string
  status: string
  priority: string
  asset_id: string | null
  asset_label: string
  assignee_id: string | null
  location: string
  detail: string
  scheduled_on: string | null
  completed_at: string | null
  downtime_hours: number
  labor_cost_cents: number
  parts_cost_cents: number
  recurrence_days: number | null
}

const COLUMNS = `id, code, title, kind, status, priority, asset_id, asset_label, assignee_id,
   location, detail, scheduled_on, completed_at, downtime_hours, labor_cost_cents,
   parts_cost_cents, recurrence_days`

function toRow(row: WorkOrderRecord): WorkOrderRow {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    kind: row.kind,
    status: row.status,
    priority: row.priority,
    assetId: row.asset_id,
    assetLabel: row.asset_label,
    assigneeId: row.assignee_id,
    location: row.location,
    detail: row.detail,
    scheduledOn: row.scheduled_on,
    completedAt: row.completed_at,
    downtimeHours: row.downtime_hours,
    laborCostCents: row.labor_cost_cents,
    partsCostCents: row.parts_cost_cents,
    recurrenceDays: row.recurrence_days,
  }
}

/**
 * Assets available to attach a work order to.
 *
 * Empty when the caller cannot read `inventario`: the screen still works, it
 * just offers free text instead of a picker. Same contract as `rosterFor`.
 */
async function assetsFor(supabase: Supabase, member: Member, limit = 200): Promise<AssetRef[]> {
  if (!allows(member, 'inventario:read')) return []

  const { data, error } = await supabase
    .from('inventory_assets')
    .select('id, name, code')
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('[mantenimiento] assetsFor', error)
    return []
  }
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, code: r.code }))
}

export async function getOrdenesPage(offset = 0): Promise<Page<WorkOrderRow>> {
  const member = await requirePermission('mantenimiento:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('work_orders')
    .select(COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[mantenimiento] getOrdenesPage', error)
    return { rows: [], total: 0 }
  }

  const rows = data as unknown as WorkOrderRecord[]
  return { rows: rows.map(toRow), total: totalOf(count, rows.length, from) }
}

export async function getMantenimiento(): Promise<MantenimientoData> {
  const member = await requirePermission('mantenimiento:read')
  const supabase = await createClient()

  const [ordersResult, assets, roster] = await Promise.all([
    supabase
      .from('work_orders')
      .select(COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(...pageRange(0)),
    assetsFor(supabase, member),
    rosterFor(supabase, member),
  ])

  if (ordersResult.error) {
    console.error('[mantenimiento] getMantenimiento', ordersResult.error)
    return { ordenes: [], ordenesTotal: 0, assets: [], roster: [], canWrite: false }
  }

  const rows = ordersResult.data as unknown as WorkOrderRecord[]

  return {
    ordenes: rows.map(toRow),
    ordenesTotal: totalOf(ordersResult.count, rows.length),
    assets,
    roster,
    canWrite: can(member.permissions, 'mantenimiento:write'),
  }
}
