import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import {
  pageRange,
  projectsFor,
  rosterFor,
  totalOf,
  type Page,
  type ProjectRef,
  type RosterEntry,
} from './shared'

/**
 * HSEQ reports, read through RLS.
 *
 * The board used to hold its reports in `useState`, with the amount as the
 * string `'$4,200'` (US formatting, in a Colombian-peso product), the project
 * as the free-text label `'P-001 · Instalación Torre Sur'` matching nothing in
 * `projects`, and `overdue` as a boolean typed in next to a `vencimiento` it
 * never agreed with.
 *
 * `hseq_reports` carries `amount_cents`, a real `project_id`, and `due_on` —
 * so overdue is derived, and the project links to the project.
 */

export interface HseqChecklistItem {
  id: string
  label: string
  isDone: boolean
  position: number
}

export interface HseqUpdate {
  id: string
  actorName: string | null
  note: string
  occurredAt: string
}

export interface HseqRow {
  id: string
  code: string | null
  category: string
  kind: string
  status: string
  priority: string
  severity: string
  area: string
  projectId: string | null
  projectLabel: string | null
  location: string
  amountCents: number
  ownerId: string | null
  ownerName: string | null
  notes: string
  reportedOn: string
  dueOn: string | null
  closedAt: string | null
  /** Derived from `due_on` against today; false once closed. */
  overdue: boolean
  checklist: HseqChecklistItem[]
  updates: HseqUpdate[]
}

export interface HseqData {
  reports: HseqRow[]
  /** Reports in the organization, of which `reports` is the first page. */
  reportsTotal: number
  roster: RosterEntry[]
  proyectos: ProjectRef[]
  canWrite: boolean
}

interface ReportRecord {
  id: string
  code: string | null
  category: string
  kind: string
  status: string
  priority: string
  severity: string
  area: string
  project_id: string | null
  location: string
  amount_cents: number
  owner_id: string | null
  notes: string
  reported_on: string
  due_on: string | null
  closed_at: string | null
  employees: { full_name: string } | null
  projects: { code: string | null; name: string } | null
  hseq_checklist_items: Array<{ id: string; label: string; is_done: boolean; position: number }> | null
  hseq_updates: Array<{
    id: string
    note: string
    occurred_at: string
    employees: { full_name: string } | null
  }> | null
}

const REPORT_COLUMNS = `id, code, category, kind, status, priority, severity, area, project_id,
   location, amount_cents, owner_id, notes, reported_on, due_on, closed_at,
   employees ( full_name ),
   projects ( code, name ),
   hseq_checklist_items ( id, label, is_done, position ),
   hseq_updates ( id, note, occurred_at, employees ( full_name ) )`

/** @param today ISO date, passed in so every row of one read judges overdue alike. */
function toReport(row: ReportRecord, today: string): HseqRow {
  return {
    id: row.id,
    code: row.code,
    category: row.category,
    kind: row.kind,
    status: row.status,
    priority: row.priority,
    severity: row.severity,
    area: row.area,
    projectId: row.project_id,
    projectLabel: row.projects
      ? [row.projects.code, row.projects.name].filter(Boolean).join(' · ')
      : null,
    location: row.location,
    amountCents: Number(row.amount_cents),
    ownerId: row.owner_id,
    ownerName: row.employees?.full_name ?? null,
    notes: row.notes,
    reportedOn: row.reported_on,
    dueOn: row.due_on,
    closedAt: row.closed_at,
    // A closed report is never overdue, whatever its due date says.
    overdue: Boolean(row.due_on && !row.closed_at && row.due_on < today),
    checklist: (row.hseq_checklist_items ?? [])
      .map((c) => ({ id: c.id, label: c.label, isDone: c.is_done, position: c.position }))
      .sort((a, b) => a.position - b.position),
    updates: (row.hseq_updates ?? [])
      .map((u) => ({
        id: u.id,
        actorName: u.employees?.full_name ?? null,
        note: u.note,
        occurredAt: u.occurred_at,
      }))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
  }
}

/** One page of HSEQ reports, newest first. */
export async function getHseqPage(offset = 0): Promise<Page<HseqRow>> {
  const member = await requirePermission('hseq:read')
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('hseq_reports')
    .select(REPORT_COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('reported_on', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[hseq] getHseqPage', error)
    return { rows: [], total: 0 }
  }

  return {
    rows: (data as unknown as ReportRecord[]).map((row) => toReport(row, today)),
    total: totalOf(count, data.length, from),
  }
}

export async function getHseq(): Promise<HseqData> {
  const member = await requirePermission('hseq:read')
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  const [reportsResult, roster, proyectos] = await Promise.all([
    supabase
      .from('hseq_reports')
      .select(REPORT_COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('reported_on', { ascending: false })
      .range(...pageRange(0)),
    rosterFor(supabase, member),
    projectsFor(supabase, member),
  ])

  if (reportsResult.error) {
    console.error('[hseq] getHseq', reportsResult.error)
    return { reports: [], reportsTotal: 0, roster: [], proyectos: [], canWrite: false }
  }

  const reports = (reportsResult.data as unknown as ReportRecord[]).map((row) => toReport(row, today))

  return {
    reports,
    reportsTotal: totalOf(reportsResult.count, reports.length),
    roster,
    proyectos,
    canWrite: can(member.permissions, 'hseq:write'),
  }
}
