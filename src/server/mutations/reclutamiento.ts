'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import {
  CANDIDATE_STAGES, EMPLOYMENT_TYPES, OPENING_STATUSES,
  todayIn,
} from '@/lib/domain'
import { belongsToOrg } from '@/server/queries/shared'
import { getReclutamiento, type ReclutamientoData } from '@/server/queries/reclutamiento'

/** `org_id` comes from the session, never from the request. */
export type ReclutamientoResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

/* ─── Vacancies ────────────────────────────────────────────────────────── */

const openingSchema = z.object({
  title: z.string().trim().min(3, 'Escribe el nombre del cargo.').max(160),
  department: z.string().trim().max(120).default(''),
  location: z.string().trim().max(120).default(''),
  employmentType: z.enum(EMPLOYMENT_TYPES).default('Tiempo completo'),
  openings: z.coerce.number().int().min(1).max(999).default(1),
  salaryMinCents: z.coerce.number().int().min(0).default(0),
  salaryMaxCents: z.coerce.number().int().min(0).default(0),
  hiringManagerId: z.uuid().nullable().default(null),
  description: z.string().trim().max(4000).default(''),
})

export async function createOpening(
  input: z.input<typeof openingSchema>,
): Promise<ReclutamientoResult<ReclutamientoData>> {
  try {
    const member = await requirePermission('reclutamiento:write')
    const parsed = openingSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    // Mirrors `job_openings_salary_ordered`. Checked here so an inverted range
    // reads as a sentence rather than as a constraint violation.
    if (parsed.data.salaryMaxCents > 0 && parsed.data.salaryMaxCents < parsed.data.salaryMinCents) {
      return fail('El salario máximo no puede ser menor que el mínimo.')
    }

    const supabase = await createClient()
    if (!(await belongsToOrg(supabase, 'employees', parsed.data.hiringManagerId, member.orgId))) {
      return fail('Esa persona no está en el equipo de tu organización.')
    }

    const { error } = await supabase.from('job_openings').insert({
      org_id: member.orgId,
      title: parsed.data.title,
      department: parsed.data.department,
      location: parsed.data.location,
      employment_type: parsed.data.employmentType,
      status: 'Abierta',
      openings: parsed.data.openings,
      salary_min_cents: parsed.data.salaryMinCents,
      salary_max_cents: parsed.data.salaryMaxCents,
      hiring_manager_id: parsed.data.hiringManagerId,
      description: parsed.data.description,
    })

    if (error) {
      console.error('[reclutamiento] createOpening', error)
      return fail('No se pudo crear la vacante.')
    }

    revalidatePath('/dashboard/reclutamiento')
    return { ok: true, data: await getReclutamiento() }
  } catch {
    return fail('No tienes permiso para gestionar reclutamiento.')
  }
}

const openingUpdateSchema = openingSchema.extend({ id: z.uuid() })

export async function updateOpening(
  input: z.input<typeof openingUpdateSchema>,
): Promise<ReclutamientoResult<ReclutamientoData>> {
  try {
    const member = await requirePermission('reclutamiento:write')
    const parsed = openingUpdateSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    // Mirrors `job_openings_salary_ordered`. Checked here so an inverted range
    // reads as a sentence rather than as a constraint violation.
    if (parsed.data.salaryMaxCents > 0 && parsed.data.salaryMaxCents < parsed.data.salaryMinCents) {
      return fail('El salario máximo no puede ser menor que el mínimo.')
    }

    const supabase = await createClient()
    if (!(await belongsToOrg(supabase, 'employees', parsed.data.hiringManagerId, member.orgId))) {
      return fail('Esa persona no está en el equipo de tu organización.')
    }

    const { error } = await supabase
      .from('job_openings')
      .update({
        title: parsed.data.title,
        department: parsed.data.department,
        location: parsed.data.location,
        employment_type: parsed.data.employmentType,
        openings: parsed.data.openings,
        salary_min_cents: parsed.data.salaryMinCents,
        salary_max_cents: parsed.data.salaryMaxCents,
        hiring_manager_id: parsed.data.hiringManagerId,
        description: parsed.data.description,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[reclutamiento] updateOpening', error)
      return fail('No se pudo actualizar la vacante.')
    }

    revalidatePath('/dashboard/reclutamiento')
    return { ok: true, data: await getReclutamiento() }
  } catch {
    return fail('No tienes permiso para gestionar reclutamiento.')
  }
}

const openingStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(OPENING_STATUSES),
})

export async function setOpeningStatus(
  input: z.input<typeof openingStatusSchema>,
): Promise<ReclutamientoResult<ReclutamientoData>> {
  try {
    const member = await requirePermission('reclutamiento:write')
    const parsed = openingStatusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const done = parsed.data.status === 'Cerrada' || parsed.data.status === 'Cancelada'
    const supabase = await createClient()
    const { error } = await supabase
      .from('job_openings')
      .update({
        status: parsed.data.status,
        // Cleared on reopen: a close date on a live vacancy is a lie the
        // time-to-hire report would repeat.
        closed_on: done ? todayIn(member.orgTimezone) : null,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[reclutamiento] setOpeningStatus', error)
      return fail('No se pudo actualizar la vacante.')
    }

    revalidatePath('/dashboard/reclutamiento')
    return { ok: true, data: await getReclutamiento() }
  } catch {
    return fail('No tienes permiso para gestionar reclutamiento.')
  }
}

/** Soft delete, for a vacancy opened by mistake. Closing is `setOpeningStatus`. */
export async function deleteOpening(id: string): Promise<ReclutamientoResult<ReclutamientoData>> {
  try {
    const member = await requirePermission('reclutamiento:write')
    if (!z.uuid().safeParse(id).success) return fail('Vacante desconocida.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('job_openings')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[reclutamiento] deleteOpening', error)
      return fail('No se pudo eliminar la vacante.')
    }

    revalidatePath('/dashboard/reclutamiento')
    return { ok: true, data: await getReclutamiento() }
  } catch {
    return fail('No tienes permiso para gestionar reclutamiento.')
  }
}

/* ─── Candidates ───────────────────────────────────────────────────────── */

const candidateSchema = z.object({
  openingId: z.uuid('Elige la vacante a la que se postula.'),
  fullName: z.string().trim().min(3, 'Escribe el nombre del candidato.').max(160),
  email: z.email('Escribe un correo válido.').max(160).toLowerCase().nullable().default(null),
  phone: z.string().trim().max(40).default(''),
  source: z.string().trim().max(80).default(''),
  expectedSalaryCents: z.coerce.number().int().min(0).default(0),
  rating: z.coerce.number().int().min(1).max(5).nullable().default(null),
  notes: z.string().trim().max(2000).default(''),
})

export async function createCandidate(
  input: z.input<typeof candidateSchema>,
): Promise<ReclutamientoResult<ReclutamientoData>> {
  try {
    const member = await requirePermission('reclutamiento:write')
    const parsed = candidateSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    // `candidates` inherits RLS from its parent, so the policy cannot vouch for
    // the other side of the row: without this check an opening id from another
    // tenant is a valid-looking foreign key.
    const { data: opening } = await supabase
      .from('job_openings')
      .select('id')
      .eq('id', parsed.data.openingId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!opening) return fail('Esa vacante no existe en tu organización.')

    const { error } = await supabase.from('candidates').insert({
      job_opening_id: parsed.data.openingId,
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      source: parsed.data.source,
      stage: 'Postulado',
      rating: parsed.data.rating,
      expected_salary_cents: parsed.data.expectedSalaryCents,
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[reclutamiento] createCandidate', error)
      return fail('No se pudo registrar el candidato.')
    }

    revalidatePath('/dashboard/reclutamiento')
    return { ok: true, data: await getReclutamiento() }
  } catch {
    return fail('No tienes permiso para gestionar reclutamiento.')
  }
}

const candidateUpdateSchema = candidateSchema.extend({ id: z.uuid() })

export async function updateCandidate(
  input: z.input<typeof candidateUpdateSchema>,
): Promise<ReclutamientoResult<ReclutamientoData>> {
  try {
    const member = await requirePermission('reclutamiento:write')
    const parsed = candidateUpdateSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    // `candidates` inherits RLS from its parent, so the policy cannot vouch for
    // the other side of the row: without this check an opening id from another
    // tenant is a valid-looking foreign key.
    const { data: opening } = await supabase
      .from('job_openings')
      .select('id')
      .eq('id', parsed.data.openingId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!opening) return fail('Esa vacante no existe en tu organización.')

    // The update is scoped through the parent, since `candidates` carries no
    // org_id of its own. Without the join a candidate id from another tenant
    // would be refused by RLS — but with an empty result, not an error, and
    // the screen would report success.
    const { data: owned } = await supabase
      .from('candidates')
      .select('id, job_openings!inner ( org_id )')
      .eq('id', parsed.data.id)
      .eq('job_openings.org_id', member.orgId)
      .maybeSingle()

    if (!owned) return fail('Ese candidato no existe en tu organización.')

    const { error } = await supabase
      .from('candidates')
      .update({
        job_opening_id: parsed.data.openingId,
        full_name: parsed.data.fullName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        source: parsed.data.source,
        rating: parsed.data.rating,
        expected_salary_cents: parsed.data.expectedSalaryCents,
        notes: parsed.data.notes,
      })
      .eq('id', parsed.data.id)

    if (error) {
      console.error('[reclutamiento] updateCandidate', error)
      return fail('No se pudo actualizar el candidato.')
    }

    revalidatePath('/dashboard/reclutamiento')
    return { ok: true, data: await getReclutamiento() }
  } catch {
    return fail('No tienes permiso para gestionar reclutamiento.')
  }
}

const stageSchema = z.object({
  id: z.uuid(),
  stage: z.enum(CANDIDATE_STAGES),
})

/**
 * Moves a candidate along the funnel.
 *
 * Deliberately allows moving backwards: an interview gets rescheduled, an
 * offer is withdrawn, and a pipeline that only advances forces people to
 * delete and re-enter the candidate, which loses the applied date.
 */
export async function setCandidateStage(
  input: z.input<typeof stageSchema>,
): Promise<ReclutamientoResult<ReclutamientoData>> {
  try {
    const member = await requirePermission('reclutamiento:write')
    const parsed = stageSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()

    // The update is scoped through the parent, since `candidates` carries no
    // org_id of its own. Without the join a candidate id from another tenant
    // would be refused by RLS — but with an empty result, not an error, and
    // the screen would report success.
    const { data: owned } = await supabase
      .from('candidates')
      .select('id, job_openings!inner ( org_id )')
      .eq('id', parsed.data.id)
      .eq('job_openings.org_id', member.orgId)
      .maybeSingle()

    if (!owned) return fail('Ese candidato no existe en tu organización.')

    const { error } = await supabase
      .from('candidates')
      .update({ stage: parsed.data.stage })
      .eq('id', parsed.data.id)

    if (error) {
      console.error('[reclutamiento] setCandidateStage', error)
      return fail('No se pudo mover el candidato.')
    }

    revalidatePath('/dashboard/reclutamiento')
    return { ok: true, data: await getReclutamiento() }
  } catch {
    return fail('No tienes permiso para gestionar reclutamiento.')
  }
}

export async function deleteCandidate(id: string): Promise<ReclutamientoResult<ReclutamientoData>> {
  try {
    const member = await requirePermission('reclutamiento:write')
    if (!z.uuid().safeParse(id).success) return fail('Candidato desconocido.')

    const supabase = await createClient()
    const { data: owned } = await supabase
      .from('candidates')
      .select('id, job_openings!inner ( org_id )')
      .eq('id', id)
      .eq('job_openings.org_id', member.orgId)
      .maybeSingle()

    if (!owned) return fail('Ese candidato no existe en tu organización.')

    // Hard delete: `candidates` has no `deleted_at`, and a rejected applicant
    // asking to be forgotten is a request the product should be able to honour.
    const { error } = await supabase.from('candidates').delete().eq('id', id)

    if (error) {
      console.error('[reclutamiento] deleteCandidate', error)
      return fail('No se pudo eliminar el candidato.')
    }

    revalidatePath('/dashboard/reclutamiento')
    return { ok: true, data: await getReclutamiento() }
  } catch {
    return fail('No tienes permiso para gestionar reclutamiento.')
  }
}
