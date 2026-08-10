import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { pageRange, rosterFor, totalOf, type Page, type RosterEntry } from './shared'

/**
 * Courses the organization runs, and who is enrolled in them.
 *
 * `courses` and `course_enrollments` existed since migration 02 with four
 * columns between them and no reader. Migration 15 widened them — mode, cost,
 * validity, a score — and moved them onto `capacitacion:*`.
 *
 * `validity_months` and `expires_on` are the reason this is a module rather
 * than a list: a safety certification that lapsed is indistinguishable from
 * one never taken, and the compliance question is always "who is current".
 */

export interface CourseRow {
  id: string
  code: string | null
  name: string
  category: string
  mode: string
  provider: string
  instructor: string
  durationHours: number | null
  costCents: number
  seats: number | null
  validityMonths: number | null
  isMandatory: boolean
  startsOn: string | null
  endsOn: string | null
  description: string
  /** Enrollments that have not been cancelled. */
  enrolled: number
  approved: number
}

export interface EnrollmentRow {
  id: string
  courseId: string
  courseName: string
  employeeId: string
  employeeName: string
  status: string
  score: number | null
  completedOn: string | null
  expiresOn: string | null
  certificateUrl: string | null
}

export interface CapacitacionData {
  courses: CourseRow[]
  coursesTotal: number
  enrollments: EnrollmentRow[]
  roster: RosterEntry[]
  canWrite: boolean
}

interface CourseRecord {
  id: string
  code: string | null
  name: string
  category: string
  mode: string
  provider: string
  instructor: string
  duration_hours: number | null
  cost_cents: number
  seats: number | null
  validity_months: number | null
  is_mandatory: boolean
  starts_on: string | null
  ends_on: string | null
  description: string
}

interface EnrollmentRecord {
  id: string
  course_id: string
  employee_id: string
  status: string
  score: number | null
  completed_on: string | null
  expires_on: string | null
  certificate_url: string | null
  employees: { full_name: string } | null
}

const COURSE_COLUMNS = `id, code, name, category, mode, provider, instructor, duration_hours,
   cost_cents, seats, validity_months, is_mandatory, starts_on, ends_on, description`

const ENROLLMENT_COLUMNS = `id, course_id, employee_id, status, score, completed_on,
   expires_on, certificate_url, employees ( full_name )`

function tally(rows: EnrollmentRecord[]) {
  const enrolled = new Map<string, number>()
  const approved = new Map<string, number>()
  for (const row of rows) {
    if (row.status === 'Cancelado') continue
    enrolled.set(row.course_id, (enrolled.get(row.course_id) ?? 0) + 1)
    if (row.status === 'Aprobado') {
      approved.set(row.course_id, (approved.get(row.course_id) ?? 0) + 1)
    }
  }
  return { enrolled, approved }
}

function toCourse(
  row: CourseRecord,
  counts: ReturnType<typeof tally>,
): CourseRow {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    mode: row.mode,
    provider: row.provider,
    instructor: row.instructor,
    durationHours: row.duration_hours,
    costCents: row.cost_cents,
    seats: row.seats,
    validityMonths: row.validity_months,
    isMandatory: row.is_mandatory,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    description: row.description,
    enrolled: counts.enrolled.get(row.id) ?? 0,
    approved: counts.approved.get(row.id) ?? 0,
  }
}

export async function getCoursesPage(offset = 0): Promise<Page<CourseRow>> {
  const member = await requirePermission('capacitacion:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('courses')
    .select(COURSE_COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[capacitacion] getCoursesPage', error)
    return { rows: [], total: 0 }
  }

  const rows = data as unknown as CourseRecord[]
  const { data: enrollmentRows } = await supabase
    .from('course_enrollments')
    .select('id, course_id, status')
    .in('course_id', rows.map((r) => r.id))

  const counts = tally((enrollmentRows ?? []) as unknown as EnrollmentRecord[])

  return {
    rows: rows.map((row) => toCourse(row, counts)),
    total: totalOf(count, rows.length, from),
  }
}

export async function getCapacitacion(): Promise<CapacitacionData> {
  const member = await requirePermission('capacitacion:read')
  const supabase = await createClient()

  const [coursesResult, roster] = await Promise.all([
    supabase
      .from('courses')
      .select(COURSE_COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(...pageRange(0)),
    rosterFor(supabase, member),
  ])

  if (coursesResult.error) {
    console.error('[capacitacion] getCapacitacion', coursesResult.error)
    return { courses: [], coursesTotal: 0, enrollments: [], roster: [], canWrite: false }
  }

  const courseRows = coursesResult.data as unknown as CourseRecord[]
  const names = new Map(courseRows.map((r) => [r.id, r.name]))

  const { data: enrollmentData, error: enrollmentError } = await supabase
    .from('course_enrollments')
    .select(ENROLLMENT_COLUMNS)
    .in('course_id', courseRows.map((r) => r.id))
    .order('created_at', { ascending: false })
    .limit(500)

  if (enrollmentError) console.error('[capacitacion] enrollments', enrollmentError)

  const enrollmentRows = (enrollmentData ?? []) as unknown as EnrollmentRecord[]

  return {
    courses: courseRows.map((row) => toCourse(row, tally(enrollmentRows))),
    coursesTotal: totalOf(coursesResult.count, courseRows.length),
    enrollments: enrollmentRows.map((row) => ({
      id: row.id,
      courseId: row.course_id,
      courseName: names.get(row.course_id) ?? '',
      employeeId: row.employee_id,
      employeeName: row.employees?.full_name ?? '',
      status: row.status,
      score: row.score,
      completedOn: row.completed_on,
      expiresOn: row.expires_on,
      certificateUrl: row.certificate_url,
    })),
    roster,
    canWrite: can(member.permissions, 'capacitacion:write'),
  }
}
