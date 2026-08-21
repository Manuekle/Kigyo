'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { CYCLE_STATUSES, GOAL_STATUSES, REVIEW_STATUSES, type GoalStatus, todayIn } from '@/lib/domain'
import { belongsToOrg } from '@/server/queries/shared'
import { getDesempeno, type DesempenoData } from '@/server/queries/desempeno'

export type DesempenoResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

/** Rejects a cycle id that is not a live cycle of this organization. */
async function cycleBelongs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string | null,
  orgId: string,
): Promise<boolean> {
  if (!id) return true
  const { data } = await supabase
    .from('review_cycles')
    .select('id')
    .eq('id', id)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()
  return Boolean(data)
}

/* ─── Cycles ───────────────────────────────────────────────────────────── */

const cycleSchema = z.object({
  name: z.string().trim().min(3, 'Ponle nombre al ciclo.').max(120),
  startsOn: z.string().date(),
  endsOn: z.string().date().nullable().default(null),
  description: z.string().trim().max(1000).default(''),
})

export async function createCycle(
  input: z.input<typeof cycleSchema>,
): Promise<DesempenoResult<DesempenoData>> {
  try {
    const member = await requirePermission('desempeno:write')
    const parsed = cycleSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    if (parsed.data.endsOn && parsed.data.endsOn < parsed.data.startsOn) {
      return fail('La fecha de cierre no puede ser anterior a la de inicio.')
    }

    const supabase = await createClient()
    const { error } = await supabase.from('review_cycles').insert({
      org_id: member.orgId,
      name: parsed.data.name,
      status: 'Planificado',
      starts_on: parsed.data.startsOn,
      ends_on: parsed.data.endsOn,
      description: parsed.data.description,
    })

    if (error) {
      console.error('[desempeno] createCycle', error)
      return fail('No se pudo crear el ciclo.')
    }

    revalidatePath('/dashboard/desempeno')
    return { ok: true, data: await getDesempeno() }
  } catch {
    return fail('No tienes permiso para gestionar desempeño.')
  }
}

const cycleStatusSchema = z.object({ id: z.uuid(), status: z.enum(CYCLE_STATUSES) })

export async function setCycleStatus(
  input: z.input<typeof cycleStatusSchema>,
): Promise<DesempenoResult<DesempenoData>> {
  try {
    const member = await requirePermission('desempeno:write')
    const parsed = cycleStatusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('review_cycles')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[desempeno] setCycleStatus', error)
      return fail('No se pudo actualizar el ciclo.')
    }

    revalidatePath('/dashboard/desempeno')
    return { ok: true, data: await getDesempeno() }
  } catch {
    return fail('No tienes permiso para gestionar desempeño.')
  }
}

export async function deleteCycle(id: string): Promise<DesempenoResult<DesempenoData>> {
  try {
    const member = await requirePermission('desempeno:write')
    if (!z.uuid().safeParse(id).success) return fail('Ciclo desconocido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('review_cycles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[desempeno] deleteCycle', error)
      return fail('No se pudo eliminar el ciclo.')
    }

    revalidatePath('/dashboard/desempeno')
    return { ok: true, data: await getDesempeno() }
  } catch {
    return fail('No tienes permiso para gestionar desempeño.')
  }
}

/* ─── Reviews ──────────────────────────────────────────────────────────── */

const reviewSchema = z.object({
  cycleId: z.uuid().nullable().default(null),
  employeeId: z.uuid('Elige a la persona evaluada.'),
  evaluatorId: z.uuid().nullable().default(null),
  periodLabel: z.string().trim().max(80).default(''),
  // 1–5, matching `evaluations.score numeric(3,1) check between 0 and 5`.
  score: z.coerce.number().min(0).max(5).nullable().default(null),
  objectivesDone: z.coerce.number().int().min(0).max(999).default(0),
  objectivesTotal: z.coerce.number().int().min(0).max(999).default(0),
  strengths: z.string().trim().max(2000).default(''),
  improvements: z.string().trim().max(2000).default(''),
  comments: z.string().trim().max(2000).default(''),
})

export async function createReview(
  input: z.input<typeof reviewSchema>,
): Promise<DesempenoResult<DesempenoData>> {
  try {
    const member = await requirePermission('desempeno:write')
    const parsed = reviewSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    if (parsed.data.objectivesDone > parsed.data.objectivesTotal) {
      return fail('Los objetivos cumplidos no pueden superar el total.')
    }

    const supabase = await createClient()
    const [employeeOk, evaluatorOk, cycleOk] = await Promise.all([
      belongsToOrg(supabase, 'employees', parsed.data.employeeId, member.orgId),
      belongsToOrg(supabase, 'employees', parsed.data.evaluatorId, member.orgId),
      cycleBelongs(supabase, parsed.data.cycleId, member.orgId),
    ])

    if (!employeeOk || !evaluatorOk) {
      return fail('Esa persona no está en el equipo de tu organización.')
    }
    if (!cycleOk) return fail('Ese ciclo no existe en tu organización.')

    const { error } = await supabase.from('evaluations').insert({
      org_id: member.orgId,
      cycle_id: parsed.data.cycleId,
      employee_id: parsed.data.employeeId,
      evaluator_id: parsed.data.evaluatorId,
      period_label: parsed.data.periodLabel,
      score: parsed.data.score,
      objectives_done: parsed.data.objectivesDone,
      objectives_total: parsed.data.objectivesTotal,
      status: 'Pendiente',
      strengths: parsed.data.strengths,
      improvements: parsed.data.improvements,
      comments: parsed.data.comments,
    })

    if (error) {
      console.error('[desempeno] createReview', error)
      return fail('No se pudo crear la evaluación.')
    }

    revalidatePath('/dashboard/desempeno')
    return { ok: true, data: await getDesempeno() }
  } catch {
    return fail('No tienes permiso para gestionar desempeño.')
  }
}

const reviewStatusSchema = z.object({ id: z.uuid(), status: z.enum(REVIEW_STATUSES) })

export async function setReviewStatus(
  input: z.input<typeof reviewStatusSchema>,
): Promise<DesempenoResult<DesempenoData>> {
  try {
    const member = await requirePermission('desempeno:write')
    const parsed = reviewStatusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const done = parsed.data.status === 'Completada' || parsed.data.status === 'Calibrada'
    const supabase = await createClient()
    const { error } = await supabase
      .from('evaluations')
      .update({
        status: parsed.data.status,
        // Both cleared on reopen: a submitted timestamp on a review still being
        // drafted is a claim the calibration meeting would act on.
        submitted_at: done ? new Date().toISOString() : null,
        evaluated_on: done ? todayIn(member.orgTimezone) : null,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[desempeno] setReviewStatus', error)
      return fail('No se pudo actualizar la evaluación.')
    }

    revalidatePath('/dashboard/desempeno')
    return { ok: true, data: await getDesempeno() }
  } catch {
    return fail('No tienes permiso para gestionar desempeño.')
  }
}

export async function deleteReview(id: string): Promise<DesempenoResult<DesempenoData>> {
  try {
    const member = await requirePermission('desempeno:write')
    if (!z.uuid().safeParse(id).success) return fail('Evaluación desconocida.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('evaluations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[desempeno] deleteReview', error)
      return fail('No se pudo eliminar la evaluación.')
    }

    revalidatePath('/dashboard/desempeno')
    return { ok: true, data: await getDesempeno() }
  } catch {
    return fail('No tienes permiso para gestionar desempeño.')
  }
}

/* ─── Goals ────────────────────────────────────────────────────────────── */

const goalSchema = z.object({
  employeeId: z.uuid('Elige a la persona.'),
  cycleId: z.uuid().nullable().default(null),
  title: z.string().trim().min(3, 'Escribe el objetivo.').max(200),
  detail: z.string().trim().max(2000).default(''),
  metric: z.string().trim().max(120).default(''),
  targetValue: z.coerce.number().nullable().default(null),
  currentValue: z.coerce.number().default(0),
  weight: z.coerce.number().int().min(0).max(100).default(0),
  dueOn: z.string().date().nullable().default(null),
})

export async function createGoal(
  input: z.input<typeof goalSchema>,
): Promise<DesempenoResult<DesempenoData>> {
  try {
    const member = await requirePermission('desempeno:write')
    const parsed = goalSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const [employeeOk, cycleOk] = await Promise.all([
      belongsToOrg(supabase, 'employees', parsed.data.employeeId, member.orgId),
      cycleBelongs(supabase, parsed.data.cycleId, member.orgId),
    ])

    if (!employeeOk) return fail('Esa persona no está en el equipo de tu organización.')
    if (!cycleOk) return fail('Ese ciclo no existe en tu organización.')

    const { error } = await supabase.from('employee_goals').insert({
      org_id: member.orgId,
      employee_id: parsed.data.employeeId,
      cycle_id: parsed.data.cycleId,
      title: parsed.data.title,
      detail: parsed.data.detail,
      metric: parsed.data.metric,
      target_value: parsed.data.targetValue,
      current_value: parsed.data.currentValue,
      weight: parsed.data.weight,
      status: 'En progreso',
      due_on: parsed.data.dueOn,
    })

    if (error) {
      console.error('[desempeno] createGoal', error)
      return fail('No se pudo crear el objetivo.')
    }

    revalidatePath('/dashboard/desempeno')
    return { ok: true, data: await getDesempeno() }
  } catch {
    return fail('No tienes permiso para gestionar desempeño.')
  }
}

const goalProgressSchema = z.object({
  id: z.uuid(),
  currentValue: z.coerce.number().nullable().default(null),
  status: z.enum(GOAL_STATUSES).nullable().default(null),
})

/**
 * Updates progress, the status, or both.
 *
 * One function rather than two because they are the same edit from the user's
 * side — moving the number is usually what closes the goal — and because two
 * writes would let a goal sit at 100 % of target while still reading
 * "En progreso".
 */
export async function updateGoal(
  input: z.input<typeof goalProgressSchema>,
): Promise<DesempenoResult<DesempenoData>> {
  try {
    const member = await requirePermission('desempeno:write')
    const parsed = goalProgressSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    // Typed rather than `Record<string, unknown>`: the generated Update type
    // rejects excess properties, so a mistyped column name is a compile error
    // instead of a silently ignored field.
    const patch: { current_value?: number; status?: GoalStatus } = {}
    if (parsed.data.currentValue !== null) patch.current_value = parsed.data.currentValue
    if (parsed.data.status !== null) patch.status = parsed.data.status
    if (Object.keys(patch).length === 0) return fail('No hay nada que actualizar.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('employee_goals')
      .update(patch)
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[desempeno] updateGoal', error)
      return fail('No se pudo actualizar el objetivo.')
    }

    revalidatePath('/dashboard/desempeno')
    return { ok: true, data: await getDesempeno() }
  } catch {
    return fail('No tienes permiso para gestionar desempeño.')
  }
}

export async function deleteGoal(id: string): Promise<DesempenoResult<DesempenoData>> {
  try {
    const member = await requirePermission('desempeno:write')
    if (!z.uuid().safeParse(id).success) return fail('Objetivo desconocido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('employee_goals')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[desempeno] deleteGoal', error)
      return fail('No se pudo eliminar el objetivo.')
    }

    revalidatePath('/dashboard/desempeno')
    return { ok: true, data: await getDesempeno() }
  } catch {
    return fail('No tienes permiso para gestionar desempeño.')
  }
}

/* ─── Encuestas ─────────────────────────────────────────────────────────── */

export interface EncuestaRow {
  id: string
  name: string
  responses: number
  score: number | null
  closedOn: string | null
}

const encuestaSchema = z.object({
  name: z.string().trim().min(2, 'Ponle nombre a la encuesta.').max(120),
  responses: z.coerce.number().int().min(0).max(9999).default(0),
  score: z.coerce.number().min(-100).max(100).nullable().default(null),
  closedOn: z.string().date().nullable().default(null),
})

export async function fetchEncuestas(): Promise<EncuestaRow[]> {
  const member = await requirePermission('desempeno:read')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('surveys')
    .select('id, name, responses, score, closed_on')
    .eq('org_id', member.orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[desempeno] fetchEncuestas', error)
    return []
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    responses: row.responses,
    score: row.score,
    closedOn: row.closed_on,
  }))
}

export async function createEncuesta(
  input: z.input<typeof encuestaSchema>,
): Promise<DesempenoResult<EncuestaRow[]>> {
  try {
    const member = await requirePermission('desempeno:write')
    const parsed = encuestaSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase.from('surveys').insert({
      org_id: member.orgId,
      name: parsed.data.name,
      responses: parsed.data.responses,
      score: parsed.data.score,
      closed_on: parsed.data.closedOn,
    })

    if (error) {
      console.error('[desempeno] createEncuesta', error)
      return fail('No se pudo crear la encuesta.')
    }

    revalidatePath('/dashboard/desempeno')
    return { ok: true, data: await fetchEncuestas() }
  } catch {
    return fail('No tienes permiso para gestionar desempeño.')
  }
}

export async function deleteEncuesta(id: string): Promise<DesempenoResult<EncuestaRow[]>> {
  try {
    const member = await requirePermission('desempeno:write')
    if (!z.uuid().safeParse(id).success) return fail('Encuesta desconocida.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('surveys')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[desempeno] deleteEncuesta', error)
      return fail('No se pudo eliminar la encuesta.')
    }

    revalidatePath('/dashboard/desempeno')
    return { ok: true, data: await fetchEncuestas() }
  } catch {
    return fail('No tienes permiso para gestionar desempeño.')
  }
}
