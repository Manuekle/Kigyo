import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { CANDIDATE_STAGES } from '@/lib/domain'
import { pageRange, rosterFor, totalOf, type Page, type RosterEntry } from './shared'

/**
 * Vacancies and the people applying to them.
 *
 * `job_openings` and `candidates` have existed since migration 02 but nothing
 * ever read them — they were scaffolding under `empleados:read`. Migration 15
 * widens both and moves them to their own permission pair, which is what makes
 * "who is in the pipeline" answerable without also handing out the salary of
 * everyone already hired.
 *
 * Candidates come back with the opening they belong to rather than nested
 * inside it: the screen's main view is a funnel across every vacancy, and
 * regrouping a nested shape on the client to draw it would be work the
 * database already did.
 */

export interface OpeningRow {
  id: string
  code: string | null
  title: string
  department: string
  location: string
  employmentType: string
  status: string
  openings: number
  salaryMinCents: number
  salaryMaxCents: number
  hiringManagerId: string | null
  description: string
  openedOn: string
  closedOn: string | null
  /** Candidates on this vacancy, excluding the discarded. */
  activeCandidates: number
}

export interface CandidateRow {
  id: string
  openingId: string
  openingTitle: string
  fullName: string
  email: string | null
  phone: string
  source: string
  stage: string
  rating: number | null
  expectedSalaryCents: number
  resumeUrl: string | null
  notes: string
  appliedOn: string
  employeeId: string | null
}

export interface ReclutamientoData {
  openings: OpeningRow[]
  openingsTotal: number
  candidates: CandidateRow[]
  roster: RosterEntry[]
  canWrite: boolean
}

interface OpeningRecord {
  id: string
  code: string | null
  title: string
  department: string
  location: string
  employment_type: string
  status: string
  openings: number
  salary_min_cents: number
  salary_max_cents: number
  hiring_manager_id: string | null
  description: string
  opened_on: string
  closed_on: string | null
}

interface CandidateRecord {
  id: string
  job_opening_id: string
  full_name: string
  email: string | null
  phone: string
  source: string
  stage: string
  rating: number | null
  expected_salary_cents: number
  resume_url: string | null
  notes: string
  applied_on: string
  employee_id: string | null
}

/**
 * No `employees ( full_name )` embed for the hiring manager.
 *
 * PostgREST needs a disambiguating FK hint whenever a table references another
 * more than once, and that hint is a constraint name — a string that looks
 * like data and breaks silently if the constraint is ever recreated under a
 * different one. The roster is already fetched for this screen's pickers, so
 * the client resolves the name from it and the query stays a plain select.
 */
const OPENING_COLUMNS = `id, code, title, department, location, employment_type, status,
   openings, salary_min_cents, salary_max_cents, hiring_manager_id, description,
   opened_on, closed_on`

const CANDIDATE_COLUMNS = `id, job_opening_id, full_name, email, phone, source, stage,
   rating, expected_salary_cents, resume_url, notes, applied_on, employee_id`

/**
 * How many candidates each vacancy is actually working.
 *
 * 'Descartado' is excluded because the number is read as "how much is in
 * flight": a vacancy with two live candidates and forty rejections is not
 * busier than one with three live candidates, and showing 42 says it is.
 */
function activeCountsBy(rows: CandidateRecord[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    if (row.stage === 'Descartado') continue
    counts.set(row.job_opening_id, (counts.get(row.job_opening_id) ?? 0) + 1)
  }
  return counts
}

function toOpening(row: OpeningRecord, active: Map<string, number>): OpeningRow {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    department: row.department,
    location: row.location,
    employmentType: row.employment_type,
    status: row.status,
    openings: row.openings,
    salaryMinCents: row.salary_min_cents,
    salaryMaxCents: row.salary_max_cents,
    hiringManagerId: row.hiring_manager_id,
    description: row.description,
    openedOn: row.opened_on,
    closedOn: row.closed_on,
    activeCandidates: active.get(row.id) ?? 0,
  }
}

function toCandidate(row: CandidateRecord, titles: Map<string, string>): CandidateRow {
  return {
    id: row.id,
    openingId: row.job_opening_id,
    openingTitle: titles.get(row.job_opening_id) ?? '',
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    source: row.source,
    stage: row.stage,
    rating: row.rating,
    expectedSalaryCents: row.expected_salary_cents,
    resumeUrl: row.resume_url,
    notes: row.notes,
    appliedOn: row.applied_on,
    employeeId: row.employee_id,
  }
}

/** One page of vacancies, newest first. */
export async function getOpeningsPage(offset = 0): Promise<Page<OpeningRow>> {
  const member = await requirePermission('reclutamiento:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('job_openings')
    .select(OPENING_COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[reclutamiento] getOpeningsPage', error)
    return { rows: [], total: 0 }
  }

  const rows = data as unknown as OpeningRecord[]

  // Counts for this page only. A second full-table aggregate on every page
  // fetch would cost more than the page itself.
  const { data: candidateRows } = await supabase
    .from('candidates')
    .select('id, job_opening_id, stage')
    .in('job_opening_id', rows.map((r) => r.id))

  const active = activeCountsBy((candidateRows ?? []) as unknown as CandidateRecord[])

  return {
    rows: rows.map((row) => toOpening(row, active)),
    total: totalOf(count, rows.length, from),
  }
}

export async function getReclutamiento(): Promise<ReclutamientoData> {
  const member = await requirePermission('reclutamiento:read')
  const supabase = await createClient()

  const [openingsResult, roster] = await Promise.all([
    supabase
      .from('job_openings')
      .select(OPENING_COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(...pageRange(0)),
    rosterFor(supabase, member),
  ])

  if (openingsResult.error) {
    console.error('[reclutamiento] getReclutamiento', openingsResult.error)
    return { openings: [], openingsTotal: 0, candidates: [], roster: [], canWrite: false }
  }

  const openingRows = openingsResult.data as unknown as OpeningRecord[]
  const titles = new Map(openingRows.map((r) => [r.id, r.title]))

  // RLS on `candidates` reads through the parent, so this is already scoped to
  // the organization — the `in` filter is about the page, not about isolation.
  const { data: candidateData, error: candidateError } = await supabase
    .from('candidates')
    .select(CANDIDATE_COLUMNS)
    .in('job_opening_id', openingRows.map((r) => r.id))
    .order('applied_on', { ascending: false })
    .limit(500)

  if (candidateError) console.error('[reclutamiento] candidates', candidateError)

  const candidateRows = (candidateData ?? []) as unknown as CandidateRecord[]
  const active = activeCountsBy(candidateRows)

  return {
    openings: openingRows.map((row) => toOpening(row, active)),
    openingsTotal: totalOf(openingsResult.count, openingRows.length),
    // Sorted into pipeline order so the board can render columns without
    // re-sorting: `CANDIDATE_STAGES` is the funnel, and its index is the stage.
    candidates: candidateRows
      .map((row) => toCandidate(row, titles))
      .sort((a, b) => CANDIDATE_STAGES.indexOf(a.stage as never) - CANDIDATE_STAGES.indexOf(b.stage as never)),
    roster,
    canWrite: can(member.permissions, 'reclutamiento:write'),
  }
}
