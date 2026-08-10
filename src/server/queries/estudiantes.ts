import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { pageRange, rosterFor, totalOf, type Page, type RosterEntry } from './shared'

/**
 * Students, the programmes they are in, and their subject enrolments.
 *
 * `student_enrollments` is unique on (student, subject, term), so retaking a
 * subject in a later term is a new row while re-entering this term's grade
 * updates the existing one. Without the term in the key, a retake would
 * silently overwrite the original result — which is the one thing an academic
 * record must never do.
 */

export interface ProgramRow {
  id: string
  code: string | null
  name: string
  level: string
  durationTerms: number | null
  tuitionCents: number
  coordinatorId: string | null
  description: string
  isActive: boolean
  students: number
}

export interface StudentRow {
  id: string
  code: string | null
  fullName: string
  documentId: string
  birthDate: string | null
  email: string | null
  phone: string
  address: string
  status: string
  programId: string | null
  programName: string
  guardianName: string
  guardianPhone: string
  enrolledOn: string
  subjects: number
  /** Mean of graded subjects, or null when none are graded yet. */
  average: number | null
}

export interface EnrollmentRow {
  id: string
  studentId: string
  studentName: string
  subject: string
  term: string
  teacherId: string | null
  status: string
  grade: number | null
  attendancePct: number | null
}

export interface EstudiantesData {
  estudiantes: StudentRow[]
  estudiantesTotal: number
  programas: ProgramRow[]
  materias: EnrollmentRow[]
  roster: RosterEntry[]
  canWrite: boolean
}

interface ProgramRecord {
  id: string
  code: string | null
  name: string
  level: string
  duration_terms: number | null
  tuition_cents: number
  coordinator_id: string | null
  description: string
  is_active: boolean
}

interface StudentRecord {
  id: string
  code: string | null
  full_name: string
  document_id: string
  birth_date: string | null
  email: string | null
  phone: string
  address: string
  status: string
  program_id: string | null
  guardian_name: string
  guardian_phone: string
  enrolled_on: string
}

interface EnrollmentRecord {
  id: string
  student_id: string
  subject: string
  term: string
  teacher_id: string | null
  status: string
  grade: number | null
  attendance_pct: number | null
}

const STUDENT_COLUMNS = `id, code, full_name, document_id, birth_date, email, phone, address,
   status, program_id, guardian_name, guardian_phone, enrolled_on`

const PROGRAM_COLUMNS = `id, code, name, level, duration_terms, tuition_cents, coordinator_id,
   description, is_active`

/** Subject count and grade average per student, in one pass. */
function summarise(rows: EnrollmentRecord[]) {
  const subjects = new Map<string, number>()
  const sum = new Map<string, number>()
  const graded = new Map<string, number>()

  for (const row of rows) {
    subjects.set(row.student_id, (subjects.get(row.student_id) ?? 0) + 1)
    if (row.grade === null) continue
    sum.set(row.student_id, (sum.get(row.student_id) ?? 0) + row.grade)
    graded.set(row.student_id, (graded.get(row.student_id) ?? 0) + 1)
  }

  return { subjects, sum, graded }
}

function toStudent(
  row: StudentRecord,
  programNames: Map<string, string>,
  s: ReturnType<typeof summarise>,
): StudentRow {
  const count = s.graded.get(row.id) ?? 0
  return {
    id: row.id,
    code: row.code,
    fullName: row.full_name,
    documentId: row.document_id,
    birthDate: row.birth_date,
    email: row.email,
    phone: row.phone,
    address: row.address,
    status: row.status,
    programId: row.program_id,
    programName: row.program_id ? programNames.get(row.program_id) ?? '' : '',
    guardianName: row.guardian_name,
    guardianPhone: row.guardian_phone,
    enrolledOn: row.enrolled_on,
    subjects: s.subjects.get(row.id) ?? 0,
    average: count > 0 ? Math.round(((s.sum.get(row.id) ?? 0) / count) * 10) / 10 : null,
  }
}

export async function getEstudiantesPage(offset = 0): Promise<Page<StudentRow>> {
  const member = await requirePermission('estudiantes:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const [studentsResult, { data: programRows }] = await Promise.all([
    supabase
      .from('students')
      .select(STUDENT_COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('full_name', { ascending: true })
      .range(from, to),
    supabase
      .from('academic_programs')
      .select('id, name')
      .eq('org_id', member.orgId)
      .is('deleted_at', null),
  ])

  if (studentsResult.error) {
    console.error('[estudiantes] getEstudiantesPage', studentsResult.error)
    return { rows: [], total: 0 }
  }

  const rows = studentsResult.data as unknown as StudentRecord[]
  const { data: enrollmentRows } = await supabase
    .from('student_enrollments')
    .select('id, student_id, subject, term, teacher_id, status, grade, attendance_pct')
    .in('student_id', rows.map((r) => r.id))

  const names = new Map((programRows ?? []).map((p) => [p.id, p.name]))
  const s = summarise((enrollmentRows ?? []) as unknown as EnrollmentRecord[])

  return {
    rows: rows.map((row) => toStudent(row, names, s)),
    total: totalOf(studentsResult.count, rows.length, from),
  }
}

export async function getEstudiantes(): Promise<EstudiantesData> {
  const member = await requirePermission('estudiantes:read')
  const supabase = await createClient()

  const [studentsResult, programsResult, roster] = await Promise.all([
    supabase
      .from('students')
      .select(STUDENT_COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('full_name', { ascending: true })
      .range(...pageRange(0)),
    supabase
      .from('academic_programs')
      .select(PROGRAM_COLUMNS)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('name', { ascending: true })
      .limit(200),
    rosterFor(supabase, member),
  ])

  if (studentsResult.error) {
    console.error('[estudiantes] getEstudiantes', studentsResult.error)
    return {
      estudiantes: [], estudiantesTotal: 0, programas: [], materias: [],
      roster: [], canWrite: false,
    }
  }
  if (programsResult.error) console.error('[estudiantes] programs', programsResult.error)

  const studentRows = studentsResult.data as unknown as StudentRecord[]
  const programRows = (programsResult.data ?? []) as unknown as ProgramRecord[]
  const names = new Map(programRows.map((p) => [p.id, p.name]))
  const studentNames = new Map(studentRows.map((s) => [s.id, s.full_name]))

  const { data: enrollmentData, error: enrollmentError } = await supabase
    .from('student_enrollments')
    .select('id, student_id, subject, term, teacher_id, status, grade, attendance_pct')
    .in('student_id', studentRows.map((r) => r.id))
    .order('term', { ascending: false })
    .limit(1000)

  if (enrollmentError) console.error('[estudiantes] enrollments', enrollmentError)

  const enrollmentRows = (enrollmentData ?? []) as unknown as EnrollmentRecord[]
  const s = summarise(enrollmentRows)

  // Students per programme, counted off the page in hand rather than with a
  // second aggregate query.
  const perProgram = new Map<string, number>()
  for (const row of studentRows) {
    if (!row.program_id || row.status !== 'Activo') continue
    perProgram.set(row.program_id, (perProgram.get(row.program_id) ?? 0) + 1)
  }

  return {
    estudiantes: studentRows.map((row) => toStudent(row, names, s)),
    estudiantesTotal: totalOf(studentsResult.count, studentRows.length),
    programas: programRows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      level: row.level,
      durationTerms: row.duration_terms,
      tuitionCents: row.tuition_cents,
      coordinatorId: row.coordinator_id,
      description: row.description,
      isActive: row.is_active,
      students: perProgram.get(row.id) ?? 0,
    })),
    materias: enrollmentRows.map((row) => ({
      id: row.id,
      studentId: row.student_id,
      studentName: studentNames.get(row.student_id) ?? '',
      subject: row.subject,
      term: row.term,
      teacherId: row.teacher_id,
      status: row.status,
      grade: row.grade,
      attendancePct: row.attendance_pct,
    })),
    roster,
    canWrite: can(member.permissions, 'estudiantes:write'),
  }
}
