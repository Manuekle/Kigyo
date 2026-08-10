'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import {
  ACADEMIC_ENROLLMENT_STATUSES, STUDENT_STATUSES, type AcademicEnrollmentStatus,
} from '@/lib/domain'
import { belongsToOrg } from '@/server/queries/shared'
import { getEstudiantes, type EstudiantesData } from '@/server/queries/estudiantes'

export type EstudiantesResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

async function programBelongs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string | null,
  orgId: string,
): Promise<boolean> {
  if (!id) return true
  const { data } = await supabase
    .from('academic_programs')
    .select('id')
    .eq('id', id)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()
  return Boolean(data)
}

/* ─── Programmes ───────────────────────────────────────────────────────── */

const programSchema = z.object({
  name: z.string().trim().min(3, 'Escribe el nombre del programa.').max(160),
  level: z.string().trim().max(80).default(''),
  durationTerms: z.coerce.number().int().min(1).max(60).nullable().default(null),
  tuitionCents: z.coerce.number().int().min(0).default(0),
  coordinatorId: z.uuid().nullable().default(null),
  description: z.string().trim().max(2000).default(''),
})

export async function createPrograma(
  input: z.input<typeof programSchema>,
): Promise<EstudiantesResult<EstudiantesData>> {
  try {
    const member = await requirePermission('estudiantes:write')
    const parsed = programSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    if (!(await belongsToOrg(supabase, 'employees', parsed.data.coordinatorId, member.orgId))) {
      return fail('Esa persona no está en el equipo de tu organización.')
    }

    const { error } = await supabase.from('academic_programs').insert({
      org_id: member.orgId,
      name: parsed.data.name,
      level: parsed.data.level,
      duration_terms: parsed.data.durationTerms,
      tuition_cents: parsed.data.tuitionCents,
      coordinator_id: parsed.data.coordinatorId,
      description: parsed.data.description,
    })

    if (error) {
      console.error('[estudiantes] createPrograma', error)
      return fail('No se pudo crear el programa.')
    }

    revalidatePath('/dashboard/estudiantes')
    return { ok: true, data: await getEstudiantes() }
  } catch {
    return fail('No tienes permiso para gestionar estudiantes.')
  }
}

/* ─── Students ─────────────────────────────────────────────────────────── */

const studentSchema = z.object({
  fullName: z.string().trim().min(3, 'Escribe el nombre del estudiante.').max(160),
  documentId: z.string().trim().max(40).default(''),
  birthDate: z.string().date().nullable().default(null),
  email: z.email('Escribe un correo válido.').max(160).toLowerCase().nullable().default(null),
  phone: z.string().trim().max(40).default(''),
  address: z.string().trim().max(200).default(''),
  programId: z.uuid().nullable().default(null),
  guardianName: z.string().trim().max(160).default(''),
  guardianPhone: z.string().trim().max(40).default(''),
})

export async function createEstudiante(
  input: z.input<typeof studentSchema>,
): Promise<EstudiantesResult<EstudiantesData>> {
  try {
    const member = await requirePermission('estudiantes:write')
    const parsed = studentSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    if (parsed.data.birthDate && parsed.data.birthDate > new Date().toISOString().slice(0, 10)) {
      return fail('La fecha de nacimiento no puede estar en el futuro.')
    }

    const supabase = await createClient()
    if (!(await programBelongs(supabase, parsed.data.programId, member.orgId))) {
      return fail('Ese programa no existe en tu organización.')
    }

    const { error } = await supabase.from('students').insert({
      org_id: member.orgId,
      full_name: parsed.data.fullName,
      document_id: parsed.data.documentId,
      birth_date: parsed.data.birthDate,
      email: parsed.data.email,
      phone: parsed.data.phone,
      address: parsed.data.address,
      status: 'Activo',
      program_id: parsed.data.programId,
      guardian_name: parsed.data.guardianName,
      guardian_phone: parsed.data.guardianPhone,
    })

    if (error) {
      console.error('[estudiantes] createEstudiante', error)
      return fail('No se pudo registrar el estudiante.')
    }

    revalidatePath('/dashboard/estudiantes')
    return { ok: true, data: await getEstudiantes() }
  } catch {
    return fail('No tienes permiso para gestionar estudiantes.')
  }
}

const statusSchema = z.object({ id: z.uuid(), status: z.enum(STUDENT_STATUSES) })

export async function setEstudianteStatus(
  input: z.input<typeof statusSchema>,
): Promise<EstudiantesResult<EstudiantesData>> {
  try {
    const member = await requirePermission('estudiantes:write')
    const parsed = statusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('students')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[estudiantes] setEstudianteStatus', error)
      return fail('No se pudo actualizar el estudiante.')
    }

    revalidatePath('/dashboard/estudiantes')
    return { ok: true, data: await getEstudiantes() }
  } catch {
    return fail('No tienes permiso para gestionar estudiantes.')
  }
}

export async function deleteEstudiante(id: string): Promise<EstudiantesResult<EstudiantesData>> {
  try {
    const member = await requirePermission('estudiantes:write')
    if (!z.uuid().safeParse(id).success) return fail('Estudiante desconocido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('students')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[estudiantes] deleteEstudiante', error)
      return fail('No se pudo eliminar el estudiante.')
    }

    revalidatePath('/dashboard/estudiantes')
    return { ok: true, data: await getEstudiantes() }
  } catch {
    return fail('No tienes permiso para gestionar estudiantes.')
  }
}

/* ─── Subject enrolments ───────────────────────────────────────────────── */

const enrollmentSchema = z.object({
  studentId: z.uuid('Elige el estudiante.'),
  subject: z.string().trim().min(2, 'Escribe la materia.').max(160),
  term: z.string().trim().max(40).default(''),
  teacherId: z.uuid().nullable().default(null),
})

export async function matricularMateria(
  input: z.input<typeof enrollmentSchema>,
): Promise<EstudiantesResult<EstudiantesData>> {
  try {
    const member = await requirePermission('estudiantes:write')
    const parsed = enrollmentSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    // `student_enrollments` inherits RLS from the student, so the id has to be
    // checked against this tenant explicitly.
    const [{ data: student }, teacherOk] = await Promise.all([
      supabase
        .from('students')
        .select('id')
        .eq('id', parsed.data.studentId)
        .eq('org_id', member.orgId)
        .is('deleted_at', null)
        .maybeSingle(),
      belongsToOrg(supabase, 'employees', parsed.data.teacherId, member.orgId),
    ])

    if (!student) return fail('Ese estudiante no existe en tu organización.')
    if (!teacherOk) return fail('Esa persona no está en el equipo de tu organización.')

    const { error } = await supabase.from('student_enrollments').insert({
      student_id: parsed.data.studentId,
      subject: parsed.data.subject,
      term: parsed.data.term,
      teacher_id: parsed.data.teacherId,
      status: 'Inscrito',
    })

    if (error) {
      console.error('[estudiantes] matricularMateria', error)
      if (error.code === '23505') {
        return fail('Ese estudiante ya tiene esa materia en ese periodo.')
      }
      return fail('No se pudo matricular la materia.')
    }

    revalidatePath('/dashboard/estudiantes')
    return { ok: true, data: await getEstudiantes() }
  } catch {
    return fail('No tienes permiso para gestionar estudiantes.')
  }
}

const gradeSchema = z.object({
  id: z.uuid(),
  grade: z.coerce.number().min(0).max(100).nullable().default(null),
  attendancePct: z.coerce.number().int().min(0).max(100).nullable().default(null),
  status: z.enum(ACADEMIC_ENROLLMENT_STATUSES).nullable().default(null),
})

/**
 * Records a grade, attendance, or a status change.
 *
 * One function because they are one edit at the end of a term. Splitting them
 * would let a subject sit at "Aprobado" with last term's mark, which is the
 * failure mode an academic record cannot have.
 */
export async function calificarMateria(
  input: z.input<typeof gradeSchema>,
): Promise<EstudiantesResult<EstudiantesData>> {
  try {
    const member = await requirePermission('estudiantes:write')
    const parsed = gradeSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { data: owned } = await supabase
      .from('student_enrollments')
      .select('id, students!inner ( org_id )')
      .eq('id', parsed.data.id)
      .eq('students.org_id', member.orgId)
      .maybeSingle()

    if (!owned) return fail('Esa materia no existe en tu organización.')

    // Typed against the domain union rather than `string`: the generated
    // Update type carries the check constraint, so a stray status is a compile
    // error instead of a runtime constraint violation.
    const patch: {
      grade?: number
      attendance_pct?: number
      status?: AcademicEnrollmentStatus
    } = {}
    if (parsed.data.grade !== null) patch.grade = parsed.data.grade
    if (parsed.data.attendancePct !== null) patch.attendance_pct = parsed.data.attendancePct
    if (parsed.data.status !== null) patch.status = parsed.data.status
    if (Object.keys(patch).length === 0) return fail('No hay nada que actualizar.')

    const { error } = await supabase
      .from('student_enrollments')
      .update(patch)
      .eq('id', parsed.data.id)

    if (error) {
      console.error('[estudiantes] calificarMateria', error)
      return fail('No se pudo actualizar la materia.')
    }

    revalidatePath('/dashboard/estudiantes')
    return { ok: true, data: await getEstudiantes() }
  } catch {
    return fail('No tienes permiso para gestionar estudiantes.')
  }
}
