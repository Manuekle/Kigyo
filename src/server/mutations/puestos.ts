'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import type { Supabase } from '@/server/queries/shared'
import { getPuestos, type PuestosData } from '@/server/queries/puestos'

export type PuestosResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const DENIED = 'No tienes permiso para gestionar los puestos de servicio.'

async function refreshed(): Promise<PuestosResult<PuestosData>> {
  revalidatePath('/dashboard/puestos')
  return { ok: true, data: await getPuestos() }
}

/**
 * Rechaza un FK que no es una fila viva de *esta* organización. RLS sobre
 * `guard_posts` y `post_shifts` mira el `org_id` de la fila, no lo que la
 * fila señala, así que la otra punta de cada referencia se valida a mano.
 */
async function clientInOrg(
  supabase: Supabase,
  clientId: string | null,
  orgId: string,
): Promise<boolean> {
  if (!clientId) return true
  const { data } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()
  return Boolean(data)
}

async function postInOrg(
  supabase: Supabase,
  postId: string | null,
  orgId: string,
): Promise<boolean> {
  if (!postId) return false
  const { data } = await supabase
    .from('guard_posts')
    .select('id')
    .eq('id', postId)
    .eq('org_id', orgId)
    .maybeSingle()
  return Boolean(data)
}

async function employeeInOrg(
  supabase: Supabase,
  employeeId: string | null,
  orgId: string,
): Promise<boolean> {
  if (!employeeId) return true
  const { data } = await supabase
    .from('employees')
    .select('id')
    .eq('id', employeeId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()
  return Boolean(data)
}

/* ─── Puestos ───────────────────────────────────────────────────────────── */

const addPostSchema = z.object({
  name: z.string().trim().min(2).max(120),
  clientId: z.string().uuid().nullable().optional(),
  address: z.string().trim().max(200).default(''),
  notes: z.string().trim().max(500).default(''),
})

/**
 * Abre un puesto nuevo. Nace activo: se desactiva, no se borra, salvo que se
 * elimine a mano. El cliente es opcional — hay puestos sin ficha comercial —
 * y cuando viene se valida contra *esta* organización.
 */
export async function addPost(
  input: z.input<typeof addPostSchema>,
): Promise<PuestosResult<PuestosData>> {
  try {
    const member = await requirePermission('puestos:write')
    const parsed = addPostSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    if (!(await clientInOrg(supabase, parsed.data.clientId ?? null, member.orgId))) {
      return fail('Ese cliente no pertenece a tu organización.')
    }

    const { error } = await supabase.from('guard_posts').insert({
      org_id: member.orgId,
      name: parsed.data.name,
      client_id: parsed.data.clientId ?? null,
      address: parsed.data.address || null,
      notes: parsed.data.notes,
      is_active: true,
    })

    if (error) {
      console.error('[puestos] addPost', error)
      return fail('No se pudo crear el puesto.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function setPostActive(
  id: string,
  active: boolean,
): Promise<PuestosResult<PuestosData>> {
  try {
    const member = await requirePermission('puestos:write')
    if (!z.uuid().safeParse(id).success) return fail('Puesto inválido.')
    if (!z.boolean().safeParse(active).success) return fail('Estado inválido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('guard_posts')
      .update({ is_active: active })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[puestos] setPostActive', error)
      return fail('No se pudo cambiar el estado.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deletePost(id: string): Promise<PuestosResult<PuestosData>> {
  try {
    const member = await requirePermission('puestos:write')
    if (!z.uuid().safeParse(id).success) return fail('Puesto inválido.')

    const supabase = await createClient()
    // Borrado real, no suave: un puesto mal tecleado no es historia que
    // preservar. Sus turnos caen con él (`on delete cascade`). `org_id` va
    // explícito para que nadie pueda borrar por id lo que no es de su empresa.
    const { error } = await supabase
      .from('guard_posts')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[puestos] deletePost', error)
      return fail('No se pudo eliminar el puesto.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/* ─── Turnos ────────────────────────────────────────────────────────────── */

const addShiftSchema = z.object({
  postId: z.string().uuid(),
  employeeId: z.string().uuid().nullable().optional(),
  startsAt: z.string().min(10),
  endsAt: z.string().min(10),
  notes: z.string().trim().max(500).default(''),
})

/**
 * Abre un turno nuevo. Nace `programado`; empieza cuando un guarda lo toma.
 *
 * El guarda es opcional — un turno puede quedar por asignar, y esa es la
 * vacante que la pantalla cuenta —, y tanto el puesto como el guarda se
 * validan contra *esta* organización.
 */
export async function addShift(
  input: z.input<typeof addShiftSchema>,
): Promise<PuestosResult<PuestosData>> {
  try {
    const member = await requirePermission('puestos:write')
    const parsed = addShiftSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    if (new Date(parsed.data.endsAt).getTime() <= new Date(parsed.data.startsAt).getTime()) {
      return fail('El fin debe ser después del inicio.')
    }

    const supabase = await createClient()

    if (!(await postInOrg(supabase, parsed.data.postId, member.orgId))) {
      return fail('Ese puesto no pertenece a tu organización.')
    }
    if (!(await employeeInOrg(supabase, parsed.data.employeeId ?? null, member.orgId))) {
      return fail('Ese empleado no pertenece a tu organización.')
    }

    const { error } = await supabase.from('post_shifts').insert({
      org_id: member.orgId,
      post_id: parsed.data.postId,
      employee_id: parsed.data.employeeId ?? null,
      starts_at: parsed.data.startsAt,
      ends_at: parsed.data.endsAt,
      status: 'programado',
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[puestos] addShift', error)
      return fail('No se pudo crear el turno.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function setShiftStatus(
  id: string,
  status: string,
): Promise<PuestosResult<PuestosData>> {
  try {
    const member = await requirePermission('puestos:write')
    if (!z.uuid().safeParse(id).success) return fail('Turno inválido.')
    const parsedStatus = z
      .enum(['programado', 'en_curso', 'completado', 'cancelado'])
      .safeParse(status)
    if (!parsedStatus.success) return fail('Estado inválido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('post_shifts')
      .update({ status: parsedStatus.data })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[puestos] setShiftStatus', error)
      return fail('No se pudo cambiar el estado.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deleteShift(id: string): Promise<PuestosResult<PuestosData>> {
  try {
    const member = await requirePermission('puestos:write')
    if (!z.uuid().safeParse(id).success) return fail('Turno inválido.')

    const supabase = await createClient()
    // Borrado real, no suave, con `org_id` explícito: nadie borra por id lo
    // que no es de su empresa.
    const { error } = await supabase
      .from('post_shifts')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[puestos] deleteShift', error)
      return fail('No se pudo eliminar el turno.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}
