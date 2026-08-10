import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { pageRange, rosterFor, totalOf, type Page, type RosterEntry } from './shared'

/**
 * The risk register, read through RLS.
 *
 * The board used to hold ten fixture risks in `useState`. "Gestionar" removed
 * one from the array and the KPI counted the gap between the seed length and
 * the current length — so "Gestionados" reset to zero on every reload, and a
 * risk that had genuinely been dealt with came straight back.
 *
 * `risks` carries `status` ('Abierto' | 'Mitigado' | 'Cerrado') and
 * `resolved_at`, which is what "gestionado" actually means.
 */

export interface RiesgoRow {
  id: string
  code: string | null
  category: string
  title: string
  employeeId: string | null
  employeeName: string | null
  area: string
  severity: string
  detail: string
  action: string
  status: string
  dueOn: string | null
  resolvedAt: string | null
}

export interface RiesgosData {
  riesgos: RiesgoRow[]
  /** Risks in the register, of which `riesgos` is the first page. */
  riesgosTotal: number
  roster: RosterEntry[]
  canWrite: boolean
}

interface RiskRecord {
  id: string
  code: string | null
  category: string
  title: string
  employee_id: string | null
  area: string
  severity: string
  detail: string
  action: string
  status: string
  due_on: string | null
  resolved_at: string | null
  employees: { full_name: string } | null
}

const RISK_COLUMNS = `id, code, category, title, employee_id, area, severity, detail, action,
   status, due_on, resolved_at, employees ( full_name )`

function toRiesgo(row: RiskRecord): RiesgoRow {
  return {
    id: row.id,
    code: row.code,
    category: row.category,
    title: row.title,
    employeeId: row.employee_id,
    employeeName: row.employees?.full_name ?? null,
    area: row.area,
    severity: row.severity,
    detail: row.detail,
    action: row.action,
    status: row.status,
    dueOn: row.due_on,
    resolvedAt: row.resolved_at,
  }
}

/** One page of the risk register, newest first. */
export async function getRiesgosPage(offset = 0): Promise<Page<RiesgoRow>> {
  const member = await requirePermission('riesgos:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('risks')
    .select(RISK_COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[riesgos] getRiesgosPage', error)
    return { rows: [], total: 0 }
  }

  return {
    rows: (data as unknown as RiskRecord[]).map(toRiesgo),
    total: totalOf(count, data.length, from),
  }
}

export async function getRiesgos(): Promise<RiesgosData> {
  const member = await requirePermission('riesgos:read')
  const supabase = await createClient()

  const [risksResult, roster] = await Promise.all([
    supabase
      .from('risks')
      .select(RISK_COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(...pageRange(0)),
    rosterFor(supabase, member),
  ])

  if (risksResult.error) {
    console.error('[riesgos] getRiesgos', risksResult.error)
    return { riesgos: [], riesgosTotal: 0, roster: [], canWrite: false }
  }

  const riesgos = (risksResult.data as unknown as RiskRecord[]).map(toRiesgo)

  return {
    riesgos,
    riesgosTotal: totalOf(risksResult.count, riesgos.length),
    roster,
    canWrite: can(member.permissions, 'riesgos:write'),
  }
}
