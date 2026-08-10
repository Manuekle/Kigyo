'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { COURSE_MODES, ENROLLMENT_STATUSES } from '@/lib/domain'
import { belongsToOrg } from '@/server/queries/shared'
import { getCapacitacion, type CapacitacionData } from '@/server/queries/capacitacion'

export type CapacitacionResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const courseSchema = z.object({
  name: z.string().trim().min(3, 'Escribe el nombre del curso.').max(160),
  category: z.string().trim().max(80).default(''),
  mode: z.enum(COURSE_MODES).default('Presencial'),
  provider: z.string().trim().max(120).default(''),
  instructor: z.string().trim().max(120).default(''),
  durationHours: z.coerce.number().min(0).max(9999).nullable().default(null),
  costCents: z.coerce.number().int().min(0).default(0),
  seats: z.coerce.number().int().min(1).max(9999).nullable().default(null),
  validityMonths: z.coerce.number().int().min(1).max(600).nullable().default(null),
  isMandatory: z.boolean().default(false),
  startsOn: z.string().date().nullable().default(null),
  endsOn: z.string().date().nullable().default(null),
  description: z.string().trim().max(2000).default(''),
})

export async function createCourse(
  input: z.input<typeof courseSchema>,
): Promise<CapacitacionResult<CapacitacionData>> {
  try {
    const member = await requirePermission('capacitacion:write')
    const parsed = courseSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    // Mirrors `courses_dates_ordered`, so an inverted range reads as a
    // sentence instead of as a constraint violation.
    if (parsed.data.startsOn && parsed.data.endsOn && parsed.data.endsOn < parsed.data.startsOn) {
      return fail('La fecha de fin no puede ser anterior a la de inicio.')
    }

    const supabase = await createClient()
    const { error } = await supabase.from('courses').insert({
      org_id: member.orgId,
      name: parsed.data.name,
      category: parsed.data.category || 'Otro',
      mode: parsed.data.mode,
      provider: parsed.data.provider,
      instructor: parsed.data.instructor,
      duration_hours: parsed.data.durationHours,
      cost_cents: parsed.data.costCents,
      seats: parsed.data.seats,
      validity_months: parsed.data.validityMonths,
      is_mandatory: parsed.data.isMandatory,
      starts_on: parsed.data.startsOn,
      ends_on: parsed.data.endsOn,
      description: parsed.data.description,
    })

    if (error) {
      console.error('[capacitacion] createCourse', error)
      // `unique (org_id, name)` predates this module and is worth keeping: two
      // courses with the same name make "who is certified" ambiguous.
      if (error.code === '23505') return fail('Ya existe un curso con ese nombre.')
      return fail('No se pudo crear el curso.')
    }

    revalidatePath('/dashboard/capacitacion')
    return { ok: true, data: await getCapacitacion() }
  } catch {
    return fail('No tienes permiso para gestionar capacitación.')
  }
}

export async function deleteCourse(id: string): Promise<CapacitacionResult<CapacitacionData>> {
  try {
    const member = await requirePermission('capacitacion:write')
    if (!z.uuid().safeParse(id).success) return fail('Curso desconocido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('courses')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[capacitacion] deleteCourse', error)
      return fail('No se pudo eliminar el curso.')
    }

    revalidatePath('/dashboard/capacitacion')
    return { ok: true, data: await getCapacitacion() }
  } catch {
    return fail('No tienes permiso para gestionar capacitación.')
  }
}

const enrollSchema = z.object({
  courseId: z.uuid('Elige el curso.'),
  employeeId: z.uuid('Elige a la persona.'),
})

export async function enroll(
  input: z.input<typeof enrollSchema>,
): Promise<CapacitacionResult<CapacitacionData>> {
  try {
    const member = await requirePermission('capacitacion:write')
    const parsed = enrollSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    // `course_enrollments` inherits RLS from the course, so neither foreign key
    // is vouched for by the policy. Both are checked against this tenant.
    const [{ data: course }, employeeOk] = await Promise.all([
      supabase
        .from('courses')
        .select('id, seats')
        .eq('id', parsed.data.courseId)
        .eq('org_id', member.orgId)
        .is('deleted_at', null)
        .maybeSingle(),
      belongsToOrg(supabase, 'employees', parsed.data.employeeId, member.orgId),
    ])

    if (!course) return fail('Ese curso no existe en tu organización.')
    if (!employeeOk) return fail('Esa persona no está en el equipo de tu organización.')

    if (course.seats !== null) {
      const { count } = await supabase
        .from('course_enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('course_id', parsed.data.courseId)
        .neq('status', 'Cancelado')

      if ((count ?? 0) >= course.seats) {
        return fail(`El curso tiene ${course.seats} cupos y ya están tomados.`)
      }
    }

    const { error } = await supabase.from('course_enrollments').insert({
      course_id: parsed.data.courseId,
      employee_id: parsed.data.employeeId,
      status: 'Inscrito',
    })

    if (error) {
      console.error('[capacitacion] enroll', error)
      // `unique (course_id, employee_id)`: a retake updates the row, so "who is
      // certified" keeps a single answer per person per course.
      if (error.code === '23505') return fail('Esa persona ya está inscrita en el curso.')
      return fail('No se pudo inscribir a la persona.')
    }

    revalidatePath('/dashboard/capacitacion')
    return { ok: true, data: await getCapacitacion() }
  } catch {
    return fail('No tienes permiso para gestionar capacitación.')
  }
}

const enrollmentStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(ENROLLMENT_STATUSES),
  score: z.coerce.number().min(0).max(100).nullable().default(null),
})

/**
 * Records the outcome of an enrollment.
 *
 * Approving is what sets `completed_on` and, when the course expires, the date
 * it stops counting — derived from the course's `validity_months` rather than
 * asked for, because the two must agree and a typed date is a chance for them
 * not to.
 */
export async function setEnrollmentStatus(
  input: z.input<typeof enrollmentStatusSchema>,
): Promise<CapacitacionResult<CapacitacionData>> {
  try {
    const member = await requirePermission('capacitacion:write')
    const parsed = enrollmentStatusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { data: owned } = await supabase
      .from('course_enrollments')
      .select('id, courses!inner ( org_id, validity_months )')
      .eq('id', parsed.data.id)
      .eq('courses.org_id', member.orgId)
      .maybeSingle()

    if (!owned) return fail('Esa inscripción no existe en tu organización.')

    const course = owned.courses as unknown as { validity_months: number | null }
    const approved = parsed.data.status === 'Aprobado'
    const completedOn = approved ? new Date() : null

    let expiresOn: string | null = null
    if (completedOn && course.validity_months) {
      const expiry = new Date(completedOn)
      expiry.setMonth(expiry.getMonth() + course.validity_months)
      expiresOn = expiry.toISOString().slice(0, 10)
    }

    const { error } = await supabase
      .from('course_enrollments')
      .update({
        status: parsed.data.status,
        score: parsed.data.score,
        completed_on: completedOn ? completedOn.toISOString().slice(0, 10) : null,
        expires_on: expiresOn,
      })
      .eq('id', parsed.data.id)

    if (error) {
      console.error('[capacitacion] setEnrollmentStatus', error)
      return fail('No se pudo actualizar la inscripción.')
    }

    revalidatePath('/dashboard/capacitacion')
    return { ok: true, data: await getCapacitacion() }
  } catch {
    return fail('No tienes permiso para gestionar capacitación.')
  }
}

export async function removeEnrollment(id: string): Promise<CapacitacionResult<CapacitacionData>> {
  try {
    const member = await requirePermission('capacitacion:write')
    if (!z.uuid().safeParse(id).success) return fail('Inscripción desconocida.')

    const supabase = await createClient()
    const { data: owned } = await supabase
      .from('course_enrollments')
      .select('id, courses!inner ( org_id )')
      .eq('id', id)
      .eq('courses.org_id', member.orgId)
      .maybeSingle()

    if (!owned) return fail('Esa inscripción no existe en tu organización.')

    const { error } = await supabase.from('course_enrollments').delete().eq('id', id)

    if (error) {
      console.error('[capacitacion] removeEnrollment', error)
      return fail('No se pudo eliminar la inscripción.')
    }

    revalidatePath('/dashboard/capacitacion')
    return { ok: true, data: await getCapacitacion() }
  } catch {
    return fail('No tienes permiso para gestionar capacitación.')
  }
}
