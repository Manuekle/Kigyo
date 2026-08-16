'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { BLOOD_TYPES, PATIENT_STATUSES, VISIT_KINDS } from '@/lib/domain'
import { belongsToOrg, type Supabase } from '@/server/queries/shared'
import { getPacientes, type PacientesData } from '@/server/queries/pacientes'

export type PacientesResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

function rawClient(supabase: Supabase): SupabaseClient {
  return supabase as unknown as SupabaseClient
}

const patientSchema = z.object({
  fullName: z.string().trim().min(3, 'Escribe el nombre del paciente.').max(160),
  documentId: z.string().trim().max(40).default(''),
  birthDate: z.string().date().nullable().default(null),
  sex: z.enum(['F', 'M', 'Otro']).nullable().default(null),
  bloodType: z.enum(BLOOD_TYPES).nullable().default(null),
  email: z.email('Escribe un correo válido.').max(160).toLowerCase().nullable().default(null),
  phone: z.string().trim().max(40).default(''),
  address: z.string().trim().max(200).default(''),
  insurer: z.string().trim().max(120).default(''),
  allergies: z.string().trim().max(1000).default(''),
  conditions: z.string().trim().max(2000).default(''),
  emergencyContact: z.string().trim().max(160).default(''),
  emergencyPhone: z.string().trim().max(40).default(''),
})

export async function createPaciente(
  input: z.input<typeof patientSchema>,
): Promise<PacientesResult<PacientesData>> {
  try {
    const member = await requirePermission('pacientes:write')
    const parsed = patientSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    // A birth date in the future is a typo, and it would produce a negative
    // age that every downstream report would print without comment.
    if (parsed.data.birthDate && parsed.data.birthDate > new Date().toISOString().slice(0, 10)) {
      return fail('La fecha de nacimiento no puede estar en el futuro.')
    }

    const supabase = await createClient()
    const { error } = await supabase.from('patients').insert({
      org_id: member.orgId,
      full_name: parsed.data.fullName,
      document_id: parsed.data.documentId,
      birth_date: parsed.data.birthDate,
      sex: parsed.data.sex,
      blood_type: parsed.data.bloodType,
      status: 'Activo',
      email: parsed.data.email,
      phone: parsed.data.phone,
      address: parsed.data.address,
      insurer: parsed.data.insurer,
      allergies: parsed.data.allergies,
      conditions: parsed.data.conditions,
      emergency_contact: parsed.data.emergencyContact,
      emergency_phone: parsed.data.emergencyPhone,
    })

    if (error) {
      console.error('[pacientes] createPaciente', error)
      return fail('No se pudo registrar el paciente.')
    }

    revalidatePath('/dashboard/pacientes')
    return { ok: true, data: await getPacientes() }
  } catch {
    return fail('No tienes permiso para gestionar pacientes.')
  }
}

const updateSchema = patientSchema.extend({ id: z.uuid() })

export async function updatePaciente(
  input: z.input<typeof updateSchema>,
): Promise<PacientesResult<PacientesData>> {
  try {
    const member = await requirePermission('pacientes:write')
    const parsed = updateSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    if (parsed.data.birthDate && parsed.data.birthDate > new Date().toISOString().slice(0, 10)) {
      return fail('La fecha de nacimiento no puede estar en el futuro.')
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('patients')
      .update({
        full_name: parsed.data.fullName,
        document_id: parsed.data.documentId,
        birth_date: parsed.data.birthDate,
        sex: parsed.data.sex,
        blood_type: parsed.data.bloodType,
        email: parsed.data.email,
        phone: parsed.data.phone,
        address: parsed.data.address,
        insurer: parsed.data.insurer,
        allergies: parsed.data.allergies,
        conditions: parsed.data.conditions,
        emergency_contact: parsed.data.emergencyContact,
        emergency_phone: parsed.data.emergencyPhone,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[pacientes] updatePaciente', error)
      return fail('No se pudo actualizar el paciente.')
    }

    revalidatePath('/dashboard/pacientes')
    return { ok: true, data: await getPacientes() }
  } catch {
    return fail('No tienes permiso para gestionar pacientes.')
  }
}

const statusSchema = z.object({ id: z.uuid(), status: z.enum(PATIENT_STATUSES) })

export async function setPacienteStatus(
  input: z.input<typeof statusSchema>,
): Promise<PacientesResult<PacientesData>> {
  try {
    const member = await requirePermission('pacientes:write')
    const parsed = statusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('patients')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[pacientes] setPacienteStatus', error)
      return fail('No se pudo actualizar el paciente.')
    }

    revalidatePath('/dashboard/pacientes')
    return { ok: true, data: await getPacientes() }
  } catch {
    return fail('No tienes permiso para gestionar pacientes.')
  }
}

export async function deletePaciente(id: string): Promise<PacientesResult<PacientesData>> {
  try {
    const member = await requirePermission('pacientes:write')
    if (!z.uuid().safeParse(id).success) return fail('Paciente desconocido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('patients')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[pacientes] deletePaciente', error)
      return fail('No se pudo eliminar el paciente.')
    }

    revalidatePath('/dashboard/pacientes')
    return { ok: true, data: await getPacientes() }
  } catch {
    return fail('No tienes permiso para gestionar pacientes.')
  }
}

const visitSchema = z.object({
  patientId: z.uuid('Elige el paciente.'),
  kind: z.enum(VISIT_KINDS).default('Consulta'),
  professionalId: z.uuid().nullable().default(null),
  reason: z.string().trim().max(500).default(''),
  diagnosis: z.string().trim().max(2000).default(''),
  treatment: z.string().trim().max(2000).default(''),
  notes: z.string().trim().max(2000).default(''),
  feeCents: z.coerce.number().int().min(0).default(0),
  followUpOn: z.string().date().nullable().default(null),
})

export async function registrarConsulta(
  input: z.input<typeof visitSchema>,
): Promise<PacientesResult<PacientesData>> {
  try {
    const member = await requirePermission('pacientes:write')
    const parsed = visitSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    // `patient_visits` inherits RLS from the patient, so the id has to be
    // checked against this tenant explicitly.
    const [{ data: patient }, professionalOk] = await Promise.all([
      supabase
        .from('patients')
        .select('id')
        .eq('id', parsed.data.patientId)
        .eq('org_id', member.orgId)
        .is('deleted_at', null)
        .maybeSingle(),
      belongsToOrg(supabase, 'employees', parsed.data.professionalId, member.orgId),
    ])

    if (!patient) return fail('Ese paciente no existe en tu organización.')
    if (!professionalOk) return fail('Esa persona no está en el equipo de tu organización.')

    const { error } = await supabase.from('patient_visits').insert({
      patient_id: parsed.data.patientId,
      kind: parsed.data.kind as "Consulta" | "Control" | "Urgencia" | "Procedimiento" | "Teleconsulta",
      professional_id: parsed.data.professionalId,
      reason: parsed.data.reason,
      diagnosis: parsed.data.diagnosis,
      treatment: parsed.data.treatment,
      notes: parsed.data.notes,
      fee_cents: parsed.data.feeCents,
      follow_up_on: parsed.data.followUpOn,
    })

    if (error) {
      console.error('[pacientes] registrarConsulta', error)
      return fail('No se pudo registrar la consulta.')
    }

    revalidatePath('/dashboard/pacientes')
    return { ok: true, data: await getPacientes() }
  } catch {
    return fail('No tienes permiso para gestionar pacientes.')
  }
}

const TURNO_KINDS = ['Consulta', 'Control', 'Vacunación', 'Examen', 'Otro'] as const
const TURNO_STATUSES = [
  'Programada', 'Confirmada', 'En sala', 'Atendida', 'Cancelada', 'No asistió',
] as const

const turnoSchema = z.object({
  patientId: z.uuid('Elige el paciente.'),
  kind: z.enum(TURNO_KINDS).default('Consulta'),
  scheduledFor: z.string().datetime('Escribe una fecha y hora válidas.'),
  professionalId: z.uuid().nullable().default(null),
  reason: z.string().trim().max(500).default(''),
  notes: z.string().trim().max(2000).default(''),
})

export async function createTurno(
  input: z.input<typeof turnoSchema>,
): Promise<PacientesResult<PacientesData>> {
  try {
    const member = await requirePermission('pacientes:write')
    const parsed = turnoSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const [{ data: patient }, professionalOk] = await Promise.all([
      supabase
        .from('patients')
        .select('id')
        .eq('id', parsed.data.patientId)
        .eq('org_id', member.orgId)
        .is('deleted_at', null)
        .maybeSingle(),
      belongsToOrg(supabase, 'employees', parsed.data.professionalId, member.orgId),
    ])

    if (!patient) return fail('Ese paciente no existe en tu organización.')
    if (!professionalOk) return fail('Esa persona no está en el equipo de tu organización.')

    const { error } = await rawClient(supabase).from('patient_appointments').insert({
      patient_id: parsed.data.patientId,
      kind: parsed.data.kind,
      scheduled_for: parsed.data.scheduledFor,
      professional_id: parsed.data.professionalId,
      status: 'Programada',
      reason: parsed.data.reason,
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[pacientes] createTurno', error)
      return fail('No se pudo registrar el turno.')
    }

    revalidatePath('/dashboard/pacientes')
    return { ok: true, data: await getPacientes() }
  } catch {
    return fail('No tienes permiso para gestionar pacientes.')
  }
}

const turnoStatusSchema = z.object({ id: z.uuid(), status: z.enum(TURNO_STATUSES) })

export async function setTurnoStatus(
  input: z.input<typeof turnoStatusSchema>,
): Promise<PacientesResult<PacientesData>> {
  try {
    const member = await requirePermission('pacientes:write')
    const parsed = turnoStatusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { error } = await rawClient(supabase)
      .from('patient_appointments')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[pacientes] setTurnoStatus', error)
      return fail('No se pudo actualizar el turno.')
    }

    revalidatePath('/dashboard/pacientes')
    return { ok: true, data: await getPacientes() }
  } catch {
    return fail('No tienes permiso para gestionar pacientes.')
  }
}

export async function deleteTurno(id: string): Promise<PacientesResult<PacientesData>> {
  try {
    const member = await requirePermission('pacientes:write')
    if (!z.uuid().safeParse(id).success) return fail('Turno desconocido.')

    const supabase = await createClient()
    const { error } = await rawClient(supabase)
      .from('patient_appointments')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[pacientes] deleteTurno', error)
      return fail('No se pudo eliminar el turno.')
    }

    revalidatePath('/dashboard/pacientes')
    return { ok: true, data: await getPacientes() }
  } catch {
    return fail('No tienes permiso para gestionar pacientes.')
  }
}

export async function atenderTurno(id: string): Promise<PacientesResult<PacientesData>> {
  try {
    const member = await requirePermission('pacientes:write')
    if (!z.uuid().safeParse(id).success) return fail('Turno desconocido.')

    const supabase = await createClient()
    const { data: turno, error: turnoError } = await rawClient(supabase)
      .from('patient_appointments')
      .select('patient_id, kind, professional_id, reason, status')
      .eq('id', id)
      .maybeSingle()

    if (turnoError || !turno) return fail('Turno desconocido.')
    if (turno.status === 'Cancelada' || turno.status === 'No asistió') {
      return fail('Este turno no se puede atender.')
    }
    if (turno.status === 'Atendida') return fail('Este turno ya fue atendido.')

    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('id', turno.patient_id)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!patient) return fail('Ese turno no pertenece a tu organización.')

    const { error: visitError } = await supabase.from('patient_visits').insert({
      patient_id: turno.patient_id,
      kind: turno.kind,
      professional_id: turno.professional_id,
      reason: turno.reason,
      visited_at: new Date().toISOString(),
      fee_cents: 0,
    })

    if (visitError) {
      console.error('[pacientes] atenderTurno', visitError)
      return fail('No se pudo registrar la consulta.')
    }

    const { error: statusError } = await rawClient(supabase)
      .from('patient_appointments')
      .update({ status: 'Atendida' })
      .eq('id', id)

    if (statusError) {
      console.error('[pacientes] atenderTurno', statusError)
      return fail('No se pudo actualizar el turno.')
    }

    revalidatePath('/dashboard/pacientes')
    return { ok: true, data: await getPacientes() }
  } catch {
    return fail('No tienes permiso para gestionar pacientes.')
  }
}

const recetaSchema = z.object({
  patientId: z.uuid('Elige el paciente.'),
  medication: z.string().trim().min(1, 'Escribe el medicamento.').max(200),
  dose: z.string().trim().max(100).default(''),
  frequency: z.string().trim().max(100).default(''),
  instructions: z.string().trim().max(1000).default(''),
  prescribedOn: z.string().date().nullable().default(null),
  professionalId: z.uuid().nullable().default(null),
})

export async function createReceta(
  input: z.input<typeof recetaSchema>,
): Promise<PacientesResult<PacientesData>> {
  try {
    const member = await requirePermission('pacientes:write')
    const parsed = recetaSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const [{ data: patient }, professionalOk] = await Promise.all([
      supabase
        .from('patients')
        .select('id')
        .eq('id', parsed.data.patientId)
        .eq('org_id', member.orgId)
        .is('deleted_at', null)
        .maybeSingle(),
      belongsToOrg(supabase, 'employees', parsed.data.professionalId, member.orgId),
    ])

    if (!patient) return fail('Ese paciente no existe en tu organización.')
    if (!professionalOk) return fail('Esa persona no está en el equipo de tu organización.')

    const { error } = await rawClient(supabase).from('patient_prescriptions').insert({
      patient_id: parsed.data.patientId,
      professional_id: parsed.data.professionalId,
      medication: parsed.data.medication,
      dose: parsed.data.dose,
      frequency: parsed.data.frequency,
      instructions: parsed.data.instructions,
      prescribed_on: parsed.data.prescribedOn,
    })

    if (error) {
      console.error('[pacientes] createReceta', error)
      return fail('No se pudo registrar la receta.')
    }

    revalidatePath('/dashboard/pacientes')
    return { ok: true, data: await getPacientes() }
  } catch {
    return fail('No tienes permiso para gestionar pacientes.')
  }
}

export async function deleteReceta(id: string): Promise<PacientesResult<PacientesData>> {
  try {
    const member = await requirePermission('pacientes:write')
    if (!z.uuid().safeParse(id).success) return fail('Receta desconocida.')

    const supabase = await createClient()
    const { error } = await rawClient(supabase)
      .from('patient_prescriptions')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[pacientes] deleteReceta', error)
      return fail('No se pudo eliminar la receta.')
    }

    revalidatePath('/dashboard/pacientes')
    return { ok: true, data: await getPacientes() }
  } catch {
    return fail('No tienes permiso para gestionar pacientes.')
  }
}

const examenSchema = z.object({
  patientId: z.uuid('Elige el paciente.'),
  testName: z.string().trim().min(1, 'Escribe el nombre del examen.').max(200),
  orderedOn: z.string().date().nullable().default(null),
})

export async function crearExamen(
  input: z.input<typeof examenSchema>,
): Promise<PacientesResult<PacientesData>> {
  try {
    const member = await requirePermission('pacientes:write')
    const parsed = examenSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .eq('id', parsed.data.patientId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!patient) return fail('Ese paciente no existe en tu organización.')

    const { error } = await rawClient(supabase).from('patient_lab_results').insert({
      patient_id: parsed.data.patientId,
      test_name: parsed.data.testName,
      status: 'Solicitado',
      result: '',
      ordered_on: parsed.data.orderedOn,
    })

    if (error) {
      console.error('[pacientes] crearExamen', error)
      return fail('No se pudo solicitar el examen.')
    }

    revalidatePath('/dashboard/pacientes')
    return { ok: true, data: await getPacientes() }
  } catch {
    return fail('No tienes permiso para gestionar pacientes.')
  }
}

const examenResultadoSchema = z.object({
  id: z.uuid(),
  result: z.string().trim().max(5000).default(''),
  status: z.enum(['Resultado', 'En proceso']),
  resultOn: z.string().date().nullable().default(null),
})

export async function setExamenResultado(
  input: z.input<typeof examenResultadoSchema>,
): Promise<PacientesResult<PacientesData>> {
  try {
    const member = await requirePermission('pacientes:write')
    const parsed = examenResultadoSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await rawClient(supabase)
      .from('patient_lab_results')
      .update({
        result: parsed.data.result,
        status: parsed.data.status,
        result_on:
          parsed.data.status === 'Resultado'
            ? parsed.data.resultOn ?? new Date().toISOString().slice(0, 10)
            : parsed.data.resultOn,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[pacientes] setExamenResultado', error)
      return fail('No se pudo actualizar el examen.')
    }

    revalidatePath('/dashboard/pacientes')
    return { ok: true, data: await getPacientes() }
  } catch {
    return fail('No tienes permiso para gestionar pacientes.')
  }
}

export async function deleteExamen(id: string): Promise<PacientesResult<PacientesData>> {
  try {
    const member = await requirePermission('pacientes:write')
    if (!z.uuid().safeParse(id).success) return fail('Examen desconocido.')

    const supabase = await createClient()
    const { error } = await rawClient(supabase)
      .from('patient_lab_results')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[pacientes] deleteExamen', error)
      return fail('No se pudo eliminar el examen.')
    }

    revalidatePath('/dashboard/pacientes')
    return { ok: true, data: await getPacientes() }
  } catch {
    return fail('No tienes permiso para gestionar pacientes.')
  }
}
