import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { pageRange, rosterFor, totalOf, type Page, type RosterEntry } from './shared'

/**
 * Patients and their visits.
 *
 * Every column here is health information about an identified person, which is
 * why the module carries its own permission pair rather than sitting under
 * `empleados` — and why migration 14 grants `pacientes:*` to no role by
 * default except Administrador. A clinic decides who sees a clinical history;
 * the product does not decide it for them by leaving it on.
 */

export interface PatientRow {
  id: string
  code: string | null
  fullName: string
  documentId: string
  birthDate: string | null
  sex: string | null
  bloodType: string | null
  status: string
  email: string | null
  phone: string
  address: string
  insurer: string
  allergies: string
  conditions: string
  emergencyContact: string
  emergencyPhone: string
  /** Derived from `birth_date`, so the record never stores a stale age. */
  age: number | null
  visits: number
  lastVisitAt: string | null
}

export interface VisitRow {
  id: string
  patientId: string
  patientName: string
  kind: string
  professionalId: string | null
  reason: string
  diagnosis: string
  treatment: string
  notes: string
  feeCents: number
  visitedAt: string
  followUpOn: string | null
}

export interface TurnoRow {
  id: string
  patientId: string
  patientName: string
  kind: string
  scheduledFor: string
  professionalId: string | null
  status: string
  reason: string
  notes: string
}

export interface RecetaRow {
  id: string
  patientId: string
  patientName: string
  medication: string
  dose: string
  frequency: string
  instructions: string
  prescribedOn: string | null
  professionalId: string | null
}

export interface LaboratorioRow {
  id: string
  patientId: string
  patientName: string
  testName: string
  status: string
  result: string
  orderedOn: string | null
  resultOn: string | null
}

export interface PacientesData {
  pacientes: PatientRow[]
  pacientesTotal: number
  consultas: VisitRow[]
  turnos: TurnoRow[]
  recetas: RecetaRow[]
  laboratorio: LaboratorioRow[]
  roster: RosterEntry[]
  canWrite: boolean
}

interface PatientRecord {
  id: string
  code: string | null
  full_name: string
  document_id: string
  birth_date: string | null
  sex: string | null
  blood_type: string | null
  status: string
  email: string | null
  phone: string
  address: string
  insurer: string
  allergies: string
  conditions: string
  emergency_contact: string
  emergency_phone: string
}

interface VisitRecord {
  id: string
  patient_id: string
  kind: string
  professional_id: string | null
  reason: string
  diagnosis: string
  treatment: string
  notes: string
  fee_cents: number
  visited_at: string
  follow_up_on: string | null
}

interface TurnoRecord {
  id: string
  patient_id: string
  kind: string
  scheduled_for: string
  professional_id: string | null
  status: string
  reason: string
  notes: string
}

interface RecetaRecord {
  id: string
  patient_id: string
  medication: string
  dose: string
  frequency: string
  instructions: string
  prescribed_on: string | null
  professional_id: string | null
}

interface LaboratorioRecord {
  id: string
  patient_id: string
  test_name: string
  status: string
  result: string
  ordered_on: string | null
  result_on: string | null
}

const PATIENT_COLUMNS = `id, code, full_name, document_id, birth_date, sex, blood_type, status,
   email, phone, address, insurer, allergies, conditions, emergency_contact, emergency_phone`

/** Whole years, counting the birthday as having passed only once it has. */
function ageFrom(iso: string | null): number | null {
  if (!iso) return null
  const born = new Date(`${iso}T00:00:00`)
  const today = new Date()
  let age = today.getFullYear() - born.getFullYear()
  const month = today.getMonth() - born.getMonth()
  if (month < 0 || (month === 0 && today.getDate() < born.getDate())) age -= 1
  return age >= 0 ? age : null
}

function toPatient(
  row: PatientRecord,
  visits: Map<string, number>,
  lastSeen: Map<string, string>,
): PatientRow {
  return {
    id: row.id,
    code: row.code,
    fullName: row.full_name,
    documentId: row.document_id,
    birthDate: row.birth_date,
    sex: row.sex,
    bloodType: row.blood_type,
    status: row.status,
    email: row.email,
    phone: row.phone,
    address: row.address,
    insurer: row.insurer,
    allergies: row.allergies,
    conditions: row.conditions,
    emergencyContact: row.emergency_contact,
    emergencyPhone: row.emergency_phone,
    age: ageFrom(row.birth_date),
    visits: visits.get(row.id) ?? 0,
    lastVisitAt: lastSeen.get(row.id) ?? null,
  }
}

export async function getPacientesPage(offset = 0): Promise<Page<PatientRow>> {
  const member = await requirePermission('pacientes:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('patients')
    .select(PATIENT_COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('full_name', { ascending: true })
    .range(from, to)

  if (error) {
    console.error('[pacientes] getPacientesPage', error)
    return { rows: [], total: 0 }
  }

  const rows = data as unknown as PatientRecord[]
  const { data: visitRows } = await supabase
    .from('patient_visits')
    .select('id, patient_id, visited_at')
    .in('patient_id', rows.map((r) => r.id))
    .order('visited_at', { ascending: false })

  const counts = new Map<string, number>()
  const lastSeen = new Map<string, string>()
  for (const row of visitRows ?? []) {
    counts.set(row.patient_id, (counts.get(row.patient_id) ?? 0) + 1)
    if (!lastSeen.has(row.patient_id)) lastSeen.set(row.patient_id, row.visited_at)
  }

  return {
    rows: rows.map((row) => toPatient(row, counts, lastSeen)),
    total: totalOf(count, rows.length, from),
  }
}

export async function getPacientes(): Promise<PacientesData> {
  const member = await requirePermission('pacientes:read')
  const supabase = await createClient()

  const [patientsResult, roster] = await Promise.all([
    supabase
      .from('patients')
      .select(PATIENT_COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('full_name', { ascending: true })
      .range(...pageRange(0)),
    rosterFor(supabase, member),
  ])

  if (patientsResult.error) {
    console.error('[pacientes] getPacientes', patientsResult.error)
    return {
      pacientes: [], pacientesTotal: 0, consultas: [], turnos: [], recetas: [], laboratorio: [],
      roster: [], canWrite: false,
    }
  }

  const patientRows = patientsResult.data as unknown as PatientRecord[]
  const names = new Map(patientRows.map((r) => [r.id, r.full_name]))

  const { data: visitData, error: visitError } = await supabase
    .from('patient_visits')
    .select('id, patient_id, kind, professional_id, reason, diagnosis, treatment, notes, fee_cents, visited_at, follow_up_on')
    .in('patient_id', patientRows.map((r) => r.id))
    .order('visited_at', { ascending: false })
    .limit(500)

  if (visitError) console.error('[pacientes] visits', visitError)

  const visitRows = (visitData ?? []) as unknown as VisitRecord[]
  const counts = new Map<string, number>()
  const lastSeen = new Map<string, string>()
  for (const row of visitRows) {
    counts.set(row.patient_id, (counts.get(row.patient_id) ?? 0) + 1)
    if (!lastSeen.has(row.patient_id)) lastSeen.set(row.patient_id, row.visited_at)
  }

  const raw = supabase as unknown as SupabaseClient
  const patientIds = patientRows.map((r) => r.id)
  const [turnoResult, recetaResult, laboratorioResult] = await Promise.all([
    raw
      .from('patient_appointments')
      .select('id, patient_id, kind, scheduled_for, professional_id, status, reason, notes')
      .in('patient_id', patientIds)
      .order('scheduled_for', { ascending: true }),
    raw
      .from('patient_prescriptions')
      .select('id, patient_id, medication, dose, frequency, instructions, prescribed_on, professional_id')
      .in('patient_id', patientIds)
      .order('prescribed_on', { ascending: false }),
    raw
      .from('patient_lab_results')
      .select('id, patient_id, test_name, status, result, ordered_on, result_on')
      .in('patient_id', patientIds)
      .order('ordered_on', { ascending: false }),
  ])

  if (turnoResult.error) console.error('[pacientes] turnos', turnoResult.error)
  if (recetaResult.error) console.error('[pacientes] recetas', recetaResult.error)
  if (laboratorioResult.error) console.error('[pacientes] laboratorio', laboratorioResult.error)

  return {
    pacientes: patientRows.map((row) => toPatient(row, counts, lastSeen)),
    pacientesTotal: totalOf(patientsResult.count, patientRows.length),
    consultas: visitRows.map((row) => ({
      id: row.id,
      patientId: row.patient_id,
      patientName: names.get(row.patient_id) ?? '',
      kind: row.kind,
      professionalId: row.professional_id,
      reason: row.reason,
      diagnosis: row.diagnosis,
      treatment: row.treatment,
      notes: row.notes,
      feeCents: row.fee_cents,
      visitedAt: row.visited_at,
      followUpOn: row.follow_up_on,
    })),
    turnos: ((turnoResult.data ?? []) as unknown as TurnoRecord[]).map((row) => ({
      id: row.id,
      patientId: row.patient_id,
      patientName: names.get(row.patient_id) ?? '',
      kind: row.kind,
      scheduledFor: row.scheduled_for,
      professionalId: row.professional_id,
      status: row.status,
      reason: row.reason,
      notes: row.notes,
    })),
    recetas: ((recetaResult.data ?? []) as unknown as RecetaRecord[]).map((row) => ({
      id: row.id,
      patientId: row.patient_id,
      patientName: names.get(row.patient_id) ?? '',
      medication: row.medication,
      dose: row.dose,
      frequency: row.frequency,
      instructions: row.instructions,
      prescribedOn: row.prescribed_on,
      professionalId: row.professional_id,
    })),
    laboratorio: ((laboratorioResult.data ?? []) as unknown as LaboratorioRecord[]).map((row) => ({
      id: row.id,
      patientId: row.patient_id,
      patientName: names.get(row.patient_id) ?? '',
      testName: row.test_name,
      status: row.status,
      result: row.result,
      orderedOn: row.ordered_on,
      resultOn: row.result_on,
    })),
    roster,
    canWrite: can(member.permissions, 'pacientes:write'),
  }
}
