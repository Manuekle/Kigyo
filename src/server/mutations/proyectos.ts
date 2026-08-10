'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { PROJECT_KINDS, PROJECT_STATUSES, projectStateError } from '@/lib/domain'
import { getProyectos, type ProyectosData } from '@/server/queries/proyectos'

/**
 * Server Functions for the proyectos screen.
 *
 * `org_id` comes from the session and never from the request, so a caller
 * cannot file a project into another organization; RLS refuses it a second
 * time at the database.
 */

export type ProyectoResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const baseSchema = z.object({
  name: z.string().trim().min(2, 'El nombre del proyecto es obligatorio.').max(160),
  client: z.string().trim().max(160).default(''),
  location: z.string().trim().max(160).default(''),
  kind: z.enum(PROJECT_KINDS).default('Instalación'),
  capacityKwp: z
    .number()
    .min(0, 'La capacidad no puede ser negativa.')
    .max(99_999_999, 'La capacidad es demasiado alta.')
    .nullable()
    .default(null),
  status: z.enum(PROJECT_STATUSES).default('Planificación'),
  progress: z.number().int().min(0).max(100).default(0),
  // Minor units, integer. Taking pesos as a float here and multiplying by 100
  // is how 210000000.00000001 ends up in a bigint column.
  budgetCents: z
    .number()
    .int('El presupuesto debe ser un número entero de centavos.')
    .min(0, 'El presupuesto no puede ser negativo.')
    .default(0),
  startsOn: z.string().date().nullable().default(null),
  endsOn: z.string().date().nullable().default(null),
})

const createSchema = baseSchema
const updateSchema = baseSchema.extend({ id: z.uuid() })

/** Mirrors the `projects_dates_ordered` check, so the error is in Spanish. */
function datesOrdered(startsOn: string | null, endsOn: string | null): boolean {
  if (!startsOn || !endsOn) return true
  return endsOn >= startsOn
}

export async function createProyecto(
  input: z.input<typeof createSchema>,
): Promise<ProyectoResult<ProyectosData>> {
  try {
    const member = await requirePermission('proyectos:write')
    const parsed = createSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const p = parsed.data
    if (!datesOrdered(p.startsOn, p.endsOn)) {
      return fail('La fecha de fin no puede ser anterior a la de inicio.')
    }
    const stateError = projectStateError(p.status, p.progress)
    if (stateError) return fail(stateError)

    const supabase = await createClient()
    const { error } = await supabase.from('projects').insert({
      org_id: member.orgId,
      name: p.name,
      client: p.client,
      location: p.location,
      kind: p.kind,
      capacity_kwp: p.capacityKwp,
      status: p.status,
      progress: p.progress,
      budget_cents: p.budgetCents,
      starts_on: p.startsOn,
      ends_on: p.endsOn,
    })

    if (error) {
      console.error('[proyectos] createProyecto', error)
      return fail('No se pudo crear el proyecto.')
    }

    revalidatePath('/dashboard/proyectos')
    // Channels can attach a project card, so its picker is now out of date.
    revalidatePath('/dashboard/canales')
    return { ok: true, data: await getProyectos() }
  } catch {
    return fail('No tienes permiso para gestionar proyectos.')
  }
}

export async function updateProyecto(
  input: z.input<typeof updateSchema>,
): Promise<ProyectoResult<ProyectosData>> {
  try {
    const member = await requirePermission('proyectos:write')
    const parsed = updateSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const p = parsed.data
    if (!datesOrdered(p.startsOn, p.endsOn)) {
      return fail('La fecha de fin no puede ser anterior a la de inicio.')
    }
    const stateError = projectStateError(p.status, p.progress)
    if (stateError) return fail(stateError)

    const supabase = await createClient()
    const { error } = await supabase
      .from('projects')
      .update({
        name: p.name,
        client: p.client,
        location: p.location,
        kind: p.kind,
        capacity_kwp: p.capacityKwp,
        status: p.status,
        progress: p.progress,
        budget_cents: p.budgetCents,
        starts_on: p.startsOn,
        ends_on: p.endsOn,
      })
      .eq('id', p.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[proyectos] updateProyecto', error)
      return fail('No se pudo actualizar el proyecto.')
    }

    revalidatePath('/dashboard/proyectos')
    revalidatePath('/dashboard/canales')
    return { ok: true, data: await getProyectos() }
  } catch {
    return fail('No tienes permiso para gestionar proyectos.')
  }
}

/**
 * Soft delete.
 *
 * `channel_messages.project_id` is `on delete set null`, so a hard delete
 * silently strips the project card off every message that shared it. The row
 * stays and every read filters `deleted_at`.
 */
export async function deleteProyecto(id: string): Promise<ProyectoResult<ProyectosData>> {
  try {
    const member = await requirePermission('proyectos:write')
    if (!z.uuid().safeParse(id).success) return fail('Proyecto desconocido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('projects')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[proyectos] deleteProyecto', error)
      return fail('No se pudo archivar el proyecto.')
    }

    revalidatePath('/dashboard/proyectos')
    revalidatePath('/dashboard/canales')
    return { ok: true, data: await getProyectos() }
  } catch {
    return fail('No tienes permiso para gestionar proyectos.')
  }
}

const teamSchema = z.object({
  projectId: z.uuid(),
  employeeId: z.uuid(),
  role: z.string().trim().max(80).default(''),
})

/**
 * Assign somebody to a project.
 *
 * The team used to be free text typed into the project form, which is why the
 * seven fixture projects listed colleagues who were in no directory. It is a
 * real membership row now, so "who is on this" and "who works here" cannot
 * disagree.
 */
export async function addProyectoMember(
  input: z.input<typeof teamSchema>,
): Promise<ProyectoResult<ProyectosData>> {
  try {
    const member = await requirePermission('proyectos:write')
    const parsed = teamSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()

    // RLS on `project_members` inherits from the project, so it cannot vouch
    // for the *employee* side of the row: without this, an employee id from
    // another organization would be accepted as a team member.
    const { data: employee } = await supabase
      .from('employees')
      .select('id')
      .eq('id', parsed.data.employeeId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!employee) return fail('Esa persona no está en el equipo de tu organización.')

    const { error } = await supabase
      .from('project_members')
      .upsert(
        {
          project_id: parsed.data.projectId,
          employee_id: parsed.data.employeeId,
          role: parsed.data.role,
        },
        { onConflict: 'project_id,employee_id' },
      )

    if (error) {
      console.error('[proyectos] addProyectoMember', error)
      return fail('No se pudo asignar a la persona.')
    }

    revalidatePath('/dashboard/proyectos')
    return { ok: true, data: await getProyectos() }
  } catch {
    return fail('No tienes permiso para gestionar proyectos.')
  }
}

export async function removeProyectoMember(
  input: z.input<typeof teamSchema>,
): Promise<ProyectoResult<ProyectosData>> {
  try {
    await requirePermission('proyectos:write')
    const parsed = teamSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('project_members')
      .delete()
      .eq('project_id', parsed.data.projectId)
      .eq('employee_id', parsed.data.employeeId)

    if (error) {
      console.error('[proyectos] removeProyectoMember', error)
      return fail('No se pudo quitar a la persona del proyecto.')
    }

    revalidatePath('/dashboard/proyectos')
    return { ok: true, data: await getProyectos() }
  } catch {
    return fail('No tienes permiso para gestionar proyectos.')
  }
}
