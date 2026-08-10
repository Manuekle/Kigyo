import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { pageRange, rosterFor, totalOf, type Page, type RosterEntry } from './shared'

/**
 * Review cycles, the evaluations inside them, and the goals people are working
 * towards.
 *
 * Three tables because they answer three different questions and outlive each
 * other: a cycle is a period, an evaluation is one person's outcome within it,
 * and a goal frequently spans several — or none, for a company that tracks
 * objectives without running formal reviews at all. `employee_goals.cycle_id`
 * is nullable for exactly that reason.
 *
 * The evaluation is `evaluations`, which has existed since migration 02.
 * Migration 15 attached it to a cycle rather than replacing it with a new
 * table, so "how did this person do" keeps a single home.
 */

export interface CycleRow {
  id: string
  name: string
  status: string
  startsOn: string
  endsOn: string | null
  description: string
  /** Evaluations recorded against this cycle, and how many are finished. */
  reviews: number
  completed: number
  /** Mean score of the completed ones, or null when none are. */
  averageScore: number | null
}

export interface ReviewRow {
  id: string
  code: string | null
  cycleId: string | null
  cycleName: string
  employeeId: string
  employeeName: string
  evaluatorId: string | null
  periodLabel: string
  score: number | null
  objectivesDone: number
  objectivesTotal: number
  status: string
  strengths: string
  improvements: string
  comments: string
  evaluatedOn: string | null
}

export interface GoalRow {
  id: string
  employeeId: string
  employeeName: string
  cycleId: string | null
  title: string
  detail: string
  metric: string
  targetValue: number | null
  currentValue: number
  weight: number
  status: string
  dueOn: string | null
}

export interface DesempenoData {
  cycles: CycleRow[]
  cyclesTotal: number
  reviews: ReviewRow[]
  goals: GoalRow[]
  roster: RosterEntry[]
  canWrite: boolean
}

interface CycleRecord {
  id: string
  name: string
  status: string
  starts_on: string
  ends_on: string | null
  description: string
}

interface ReviewRecord {
  id: string
  code: string | null
  cycle_id: string | null
  employee_id: string
  evaluator_id: string | null
  period_label: string
  score: number | null
  objectives_done: number
  objectives_total: number
  status: string
  strengths: string
  improvements: string
  comments: string
  evaluated_on: string | null
  employees: { full_name: string } | null
}

interface GoalRecord {
  id: string
  employee_id: string
  cycle_id: string | null
  title: string
  detail: string
  metric: string
  target_value: number | null
  current_value: number
  weight: number
  status: string
  due_on: string | null
  employees: { full_name: string } | null
}

const CYCLE_COLUMNS = 'id, name, status, starts_on, ends_on, description'

const REVIEW_COLUMNS = `id, code, cycle_id, employee_id, evaluator_id, period_label, score,
   objectives_done, objectives_total, status, strengths, improvements, comments,
   evaluated_on, employees!evaluations_employee_id_fkey ( full_name )`

const GOAL_COLUMNS = `id, employee_id, cycle_id, title, detail, metric, target_value,
   current_value, weight, status, due_on, employees ( full_name )`

/** A review counts as finished once it is past the drafting states. */
function isComplete(status: string): boolean {
  return status === 'Completada' || status === 'Calibrada'
}

function summarise(rows: ReviewRecord[]) {
  const reviews = new Map<string, number>()
  const completed = new Map<string, number>()
  const scoreSum = new Map<string, number>()
  const scoreCount = new Map<string, number>()

  for (const row of rows) {
    const key = row.cycle_id
    if (!key) continue
    reviews.set(key, (reviews.get(key) ?? 0) + 1)
    if (!isComplete(row.status)) continue
    completed.set(key, (completed.get(key) ?? 0) + 1)
    if (row.score === null) continue
    scoreSum.set(key, (scoreSum.get(key) ?? 0) + row.score)
    scoreCount.set(key, (scoreCount.get(key) ?? 0) + 1)
  }

  return { reviews, completed, scoreSum, scoreCount }
}

function toCycle(row: CycleRecord, s: ReturnType<typeof summarise>): CycleRow {
  const count = s.scoreCount.get(row.id) ?? 0
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    description: row.description,
    reviews: s.reviews.get(row.id) ?? 0,
    completed: s.completed.get(row.id) ?? 0,
    // Rounded to one decimal, matching the column's own numeric(3,1). A mean
    // printed to four places implies a precision the 1–5 scale does not have.
    averageScore: count > 0 ? Math.round(((s.scoreSum.get(row.id) ?? 0) / count) * 10) / 10 : null,
  }
}

export async function getCyclesPage(offset = 0): Promise<Page<CycleRow>> {
  const member = await requirePermission('desempeno:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('review_cycles')
    .select(CYCLE_COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('starts_on', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[desempeno] getCyclesPage', error)
    return { rows: [], total: 0 }
  }

  const rows = data as unknown as CycleRecord[]
  const { data: reviewRows } = await supabase
    .from('evaluations')
    .select('id, cycle_id, status, score')
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .in('cycle_id', rows.map((r) => r.id))

  const s = summarise((reviewRows ?? []) as unknown as ReviewRecord[])

  return {
    rows: rows.map((row) => toCycle(row, s)),
    total: totalOf(count, rows.length, from),
  }
}

export async function getDesempeno(): Promise<DesempenoData> {
  const member = await requirePermission('desempeno:read')
  const supabase = await createClient()

  const [cyclesResult, reviewsResult, goalsResult, roster] = await Promise.all([
    supabase
      .from('review_cycles')
      .select(CYCLE_COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('starts_on', { ascending: false })
      .range(...pageRange(0)),
    supabase
      .from('evaluations')
      .select(REVIEW_COLUMNS)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('employee_goals')
      .select(GOAL_COLUMNS)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(500),
    rosterFor(supabase, member),
  ])

  if (cyclesResult.error) {
    console.error('[desempeno] getDesempeno', cyclesResult.error)
    return { cycles: [], cyclesTotal: 0, reviews: [], goals: [], roster: [], canWrite: false }
  }
  if (reviewsResult.error) console.error('[desempeno] reviews', reviewsResult.error)
  if (goalsResult.error) console.error('[desempeno] goals', goalsResult.error)

  const cycleRows = cyclesResult.data as unknown as CycleRecord[]
  const reviewRows = (reviewsResult.data ?? []) as unknown as ReviewRecord[]
  const goalRows = (goalsResult.data ?? []) as unknown as GoalRecord[]
  const cycleNames = new Map(cycleRows.map((r) => [r.id, r.name]))

  return {
    cycles: cycleRows.map((row) => toCycle(row, summarise(reviewRows))),
    cyclesTotal: totalOf(cyclesResult.count, cycleRows.length),
    reviews: reviewRows.map((row) => ({
      id: row.id,
      code: row.code,
      cycleId: row.cycle_id,
      cycleName: row.cycle_id ? cycleNames.get(row.cycle_id) ?? '' : '',
      employeeId: row.employee_id,
      employeeName: row.employees?.full_name ?? '',
      evaluatorId: row.evaluator_id,
      periodLabel: row.period_label,
      score: row.score,
      objectivesDone: row.objectives_done,
      objectivesTotal: row.objectives_total,
      status: row.status,
      strengths: row.strengths,
      improvements: row.improvements,
      comments: row.comments,
      evaluatedOn: row.evaluated_on,
    })),
    goals: goalRows.map((row) => ({
      id: row.id,
      employeeId: row.employee_id,
      employeeName: row.employees?.full_name ?? '',
      cycleId: row.cycle_id,
      title: row.title,
      detail: row.detail,
      metric: row.metric,
      targetValue: row.target_value,
      currentValue: row.current_value,
      weight: row.weight,
      status: row.status,
      dueOn: row.due_on,
    })),
    roster,
    canWrite: can(member.permissions, 'desempeno:write'),
  }
}
