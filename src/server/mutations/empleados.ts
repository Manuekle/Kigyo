'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { DEFAULT_ROLE } from '@/lib/auth/permissions'
import { getEmpleados, type EmpleadoRow, type EmpleadosData } from '@/server/queries/empleados'
import { belongsToOrg } from '@/server/queries/shared'

/**
 * Server Functions for the empleados screen.
 *
 * Every one re-checks the caller's permission. A Server Function is a public
 * HTTP endpoint — being reachable only from a control the UI hides is not
 * access control. `org_id` is taken from the session and never from the
 * request, so a caller cannot write a row into someone else's organization.
 */

export type EmpleadoResult<T> = { ok: true; data: T } | { ok: false; error: string }

const STATUSES = ['Activo', 'Inactivo', 'Onboarding', 'En licencia', 'Salida'] as const
const EMPLOYMENT_TYPES = ['Tiempo completo', 'Medio tiempo', 'Contrato', 'Prácticas'] as const

const baseSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'El nombre necesita al menos 2 caracteres.')
    .max(160, 'El nombre es demasiado largo.'),
  // The column has a `email = lower(email)` check, so the value is folded here
  // rather than left to fail at the database with an opaque constraint error.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Correo inválido.')
    .nullable()
    .or(z.literal('').transform(() => null)),
  position: z.string().trim().max(120, 'El cargo es demasiado largo.').default(''),
  department: z.string().trim().max(120).default(''),
  location: z.string().trim().max(120).default(''),
  status: z.enum(STATUSES).default('Activo'),
  employmentType: z.enum(EMPLOYMENT_TYPES).default('Tiempo completo'),
  // Not an enum: roles are rows the organization creates (migration 24), so
  // the valid set is a database question. Checked by `validRole` below, which
  // asks the tenant's own table.
  intendedRole: z.string().trim().min(2).max(40).default(DEFAULT_ROLE),
  managerId: z.uuid().nullable().default(null),
  hiredOn: z.string().date().nullable().default(null),
  siteId: z.string().uuid().nullable().default(null),
})

const createSchema = baseSchema
const updateSchema = baseSchema.extend({ id: z.uuid() })

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

/**
 * Rejects a manager that is not a live employee of this organization.
 *
 * RLS would already refuse a manager id from another tenant, but it refuses it
 * as a foreign-key violation with a database message. More importantly it
 * would *accept* a soft-deleted colleague, which puts a person who has left
 * back at the top of somebody's reporting line.
 */
async function validManager(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  managerId: string | null,
): Promise<boolean> {
  if (!managerId) return true
  const { data } = await supabase
    .from('employees')
    .select('id')
    .eq('id', managerId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()
  return Boolean(data)
}

/**
 * Rejects a role this organization does not define.
 *
 * `employees.intended_role` is a composite foreign key on `(org_id, key)`, so a
 * role belonging to another tenant is already impossible. This turns the
 * remaining case — a role that was deleted while the form was open — into a
 * sentence instead of constraint violation 23503.
 */
async function validRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  role: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('roles')
    .select('key')
    .eq('org_id', orgId)
    .eq('key', role)
    .maybeSingle()
  return Boolean(data)
}

export async function createEmpleado(
  input: z.input<typeof createSchema>,
): Promise<EmpleadoResult<EmpleadosData>> {
  try {
    const member = await requirePermission('empleados:write')
    const parsed = createSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    if (!(await validManager(supabase, member.orgId, parsed.data.managerId))) {
      return fail('El jefe seleccionado ya no está en el equipo.')
    }
    if (!(await validRole(supabase, member.orgId, parsed.data.intendedRole))) {
      return fail('Ese rol ya no existe en la organización.')
    }
    if (!(await belongsToOrg(supabase, 'sites', parsed.data.siteId, member.orgId))) {
      return fail('Esa sucursal no pertenece a la organización.')
    }

    const { error } = await supabase.from('employees').insert({
      org_id: member.orgId,
      full_name: parsed.data.fullName,
      email: parsed.data.email,
      position: parsed.data.position,
      department: parsed.data.department,
      location: parsed.data.location,
      status: parsed.data.status,
      employment_type: parsed.data.employmentType,
      intended_role: parsed.data.intendedRole,
      manager_id: parsed.data.managerId,
      hired_on: parsed.data.hiredOn,
      site_id: parsed.data.siteId,
    })

    if (error) {
      console.error('[empleados] createEmpleado', error)
      // 23505 = unique_violation, which here is the `(org_id, code)` key or a
      // duplicate email. The code is generated by a trigger, so in practice
      // this is the address.
      if (error.code === '23505') return fail('Ya existe una persona con ese correo.')
      return fail('No se pudo crear la persona.')
    }

    revalidatePath('/dashboard/empleados')
    return { ok: true, data: await getEmpleados() }
  } catch {
    return fail('No tienes permiso para gestionar el equipo.')
  }
}

export async function updateEmpleado(
  input: z.input<typeof updateSchema>,
): Promise<EmpleadoResult<EmpleadosData>> {
  try {
    const member = await requirePermission('empleados:write')
    const parsed = updateSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    // A person reporting to themselves makes the org chart infinite, and the
    // renderer walks it depth-first.
    if (parsed.data.managerId === parsed.data.id) {
      return fail('Una persona no puede ser su propio jefe.')
    }

    const supabase = await createClient()
    if (!(await validManager(supabase, member.orgId, parsed.data.managerId))) {
      return fail('El jefe seleccionado ya no está en el equipo.')
    }
    if (!(await validRole(supabase, member.orgId, parsed.data.intendedRole))) {
      return fail('Ese rol ya no existe en la organización.')
    }
    if (!(await belongsToOrg(supabase, 'sites', parsed.data.siteId, member.orgId))) {
      return fail('Esa sucursal no pertenece a la organización.')
    }

    // Longer cycles (A reports to B reports to A) are the same hazard one step
    // removed, so the chain is walked before the write rather than left for the
    // org chart to discover by hanging.
    if (parsed.data.managerId) {
      const { data: chain } = await supabase
        .from('employees')
        .select('id, manager_id')
        .eq('org_id', member.orgId)
        .is('deleted_at', null)

      const parents = new Map((chain ?? []).map((r) => [r.id, r.manager_id]))
      let cursor: string | null = parsed.data.managerId
      const seen = new Set<string>()
      while (cursor) {
        if (cursor === parsed.data.id) {
          return fail('Ese cambio crearía un ciclo en el organigrama.')
        }
        if (seen.has(cursor)) break
        seen.add(cursor)
        cursor = parents.get(cursor) ?? null
      }
    }

    const { error } = await supabase
      .from('employees')
      .update({
        full_name: parsed.data.fullName,
        email: parsed.data.email,
        position: parsed.data.position,
        department: parsed.data.department,
        location: parsed.data.location,
        status: parsed.data.status,
        employment_type: parsed.data.employmentType,
        intended_role: parsed.data.intendedRole,
        manager_id: parsed.data.managerId,
        hired_on: parsed.data.hiredOn,
        site_id: parsed.data.siteId,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[empleados] updateEmpleado', error)
      return fail('No se pudo actualizar la persona.')
    }

    revalidatePath('/dashboard/empleados')
    return { ok: true, data: await getEmpleados() }
  } catch {
    return fail('No tienes permiso para gestionar el equipo.')
  }
}

/**
 * Soft delete.
 *
 * Hard deleting cascades into `channel_messages.author_id`, project
 * memberships, payroll lines and absences — the person's history, which is
 * exactly what an HR record exists to keep. `deleted_at` takes them out of
 * every list (all reads filter on it) while leaving what they did intact.
 */
export async function deleteEmpleado(id: string): Promise<EmpleadoResult<EmpleadosData>> {
  try {
    const member = await requirePermission('empleados:write')
    if (!z.uuid().safeParse(id).success) return fail('Persona desconocida.')

    const supabase = await createClient()

    // Removing someone who still has direct reports would orphan them out of
    // the org chart entirely: the renderer starts at the row with no manager
    // and walks down, so a subtree hanging off a deleted node disappears from
    // the screen without disappearing from the table.
    const { count } = await supabase
      .from('employees')
      .select('id', { count: 'exact', head: true })
      .eq('manager_id', id)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)

    if ((count ?? 0) > 0) {
      return fail(
        `Esta persona tiene ${count} ${count === 1 ? 'persona a cargo' : 'personas a cargo'}. Reasígnalas antes de retirarla.`,
      )
    }

    const { error } = await supabase
      .from('employees')
      .update({ deleted_at: new Date().toISOString(), status: 'Salida' })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[empleados] deleteEmpleado', error)
      return fail('No se pudo retirar a la persona.')
    }

    revalidatePath('/dashboard/empleados')
    return { ok: true, data: await getEmpleados() }
  } catch {
    return fail('No tienes permiso para gestionar el equipo.')
  }
}

/** Read exposed to the client so a list can refresh without a route reload. */
export async function refreshEmpleados(): Promise<EmpleadoResult<EmpleadosData>> {
  try {
    return { ok: true, data: await getEmpleados() }
  } catch {
    return fail('No tienes permiso para ver el equipo.')
  }
}

export interface DirectoryHit {
  id: string
  fullName: string
  position: string
  department: string
}

/**
 * Directory lookup for the command palette.
 *
 * `requirePermission('empleados:read')` is what makes this safe to expose:
 * it is a Server Function, so it answers anyone who can reach the app, and
 * without the check the palette would be a way to enumerate a colleague's
 * roster past both the module gate and `empleados:read`.
 */
export async function searchDirectory(query: string): Promise<EmpleadoResult<DirectoryHit[]>> {
  try {
    const member = await requirePermission('empleados:read')
    const needle = query.trim().slice(0, 80)
    const supabase = await createClient()

    let statement = supabase
      .from('employees')
      .select('id, full_name, position, department')
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .neq('status', 'Salida')

    // PostgREST treats `,` and `)` as operator syntax inside `or`, so a name
    // containing either would build a filter the parser reads as more terms.
    if (needle) {
      const safe = needle.replace(/[,()\\]/g, ' ')
      statement = statement.or(
        `full_name.ilike.%${safe}%,position.ilike.%${safe}%,department.ilike.%${safe}%`,
      )
    }

    const { data, error } = await statement.order('full_name', { ascending: true }).limit(6)
    if (error) {
      console.error('[empleados] searchDirectory', error)
      return { ok: true, data: [] }
    }

    return {
      ok: true,
      data: (data ?? []).map((r) => ({
        id: r.id,
        fullName: r.full_name,
        position: r.position,
        department: r.department,
      })),
    }
  } catch {
    // Not an error the palette should surface: plenty of members legitimately
    // cannot read the directory, and the palette still lists pages for them.
    return { ok: true, data: [] }
  }
}

export type { EmpleadoRow }
