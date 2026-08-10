'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { BLOOD_TYPES, PATIENT_STATUSES, VISIT_KINDS } from '@/lib/domain'
import { belongsToOrg } from '@/server/queries/shared'
import { getPacientes, type PacientesData } from '@/server/queries/pacientes'

export type PacientesResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
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
      kind: parsed.data.kind,
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
