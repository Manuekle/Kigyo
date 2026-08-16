'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import {
  WORK_ORDER_KINDS, WORK_ORDER_PRIORITIES, WORK_ORDER_STATUSES,
} from '@/lib/domain'
import { belongsToOrg } from '@/server/queries/shared'
import { getMantenimiento, type MantenimientoData } from '@/server/queries/mantenimiento'

export type MantenimientoResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

/** An asset id must belong to this tenant; `inventory_assets` is not a child table. */
async function assetBelongs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string | null,
  orgId: string,
): Promise<boolean> {
  if (!id) return true
  const { data } = await supabase
    .from('inventory_assets')
    .select('id')
    .eq('id', id)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()
  return Boolean(data)
}

const baseSchema = z.object({
  title: z.string().trim().min(3, 'Describe el trabajo a realizar.').max(200),
  kind: z.enum(WORK_ORDER_KINDS).default('Correctivo'),
  priority: z.enum(WORK_ORDER_PRIORITIES).default('Media'),
  assetId: z.uuid().nullable().default(null),
  assetLabel: z.string().trim().max(160).default(''),
  assigneeId: z.uuid().nullable().default(null),
  location: z.string().trim().max(160).default(''),
  detail: z.string().trim().max(4000).default(''),
  scheduledOn: z.string().date().nullable().default(null),
  laborCostCents: z.coerce.number().int().min(0).default(0),
  partsCostCents: z.coerce.number().int().min(0).default(0),
  recurrenceDays: z.coerce.number().int().min(1).max(3650).nullable().default(null),
  siteId: z.string().uuid().nullable().default(null),
})

const updateSchema = baseSchema.extend({ id: z.uuid() })

export async function createOrden(
  input: z.input<typeof baseSchema>,
): Promise<MantenimientoResult<MantenimientoData>> {
  try {
    const member = await requirePermission('mantenimiento:write')
    const parsed = baseSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const [assetOk, assigneeOk, siteOk] = await Promise.all([
      assetBelongs(supabase, parsed.data.assetId, member.orgId),
      belongsToOrg(supabase, 'employees', parsed.data.assigneeId, member.orgId),
      belongsToOrg(supabase, 'sites', parsed.data.siteId, member.orgId),
    ])

    if (!assetOk) return fail('Ese activo no existe en tu organización.')
    if (!assigneeOk) return fail('Esa persona no está en el equipo de tu organización.')
    if (!siteOk) return fail('Esa sucursal no pertenece a la organización.')

    const { error } = await supabase.from('work_orders').insert({
      org_id: member.orgId,
      title: parsed.data.title,
      kind: parsed.data.kind,
      // A scheduled date is what distinguishes a planned job from a backlog
      // item, so the status follows the date rather than being asked for twice.
      status: parsed.data.scheduledOn ? 'Programada' : 'Abierta',
      priority: parsed.data.priority,
      asset_id: parsed.data.assetId,
      asset_label: parsed.data.assetLabel,
      assignee_id: parsed.data.assigneeId,
      location: parsed.data.location,
      detail: parsed.data.detail,
      scheduled_on: parsed.data.scheduledOn,
      labor_cost_cents: parsed.data.laborCostCents,
      parts_cost_cents: parsed.data.partsCostCents,
      recurrence_days: parsed.data.recurrenceDays,
      site_id: parsed.data.siteId,
    })

    if (error) {
      console.error('[mantenimiento] createOrden', error)
      return fail('No se pudo crear la orden de trabajo.')
    }

    revalidatePath('/dashboard/mantenimiento')
    return { ok: true, data: await getMantenimiento() }
  } catch {
    return fail('No tienes permiso para gestionar mantenimiento.')
  }
}

export async function updateOrden(
  input: z.input<typeof updateSchema>,
): Promise<MantenimientoResult<MantenimientoData>> {
  try {
    const member = await requirePermission('mantenimiento:write')
    const parsed = updateSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const [assetOk, assigneeOk, siteOk] = await Promise.all([
      assetBelongs(supabase, parsed.data.assetId, member.orgId),
      belongsToOrg(supabase, 'employees', parsed.data.assigneeId, member.orgId),
      belongsToOrg(supabase, 'sites', parsed.data.siteId, member.orgId),
    ])

    if (!assetOk) return fail('Ese activo no existe en tu organización.')
    if (!assigneeOk) return fail('Esa persona no está en el equipo de tu organización.')
    if (!siteOk) return fail('Esa sucursal no pertenece a la organización.')

    const { error } = await supabase
      .from('work_orders')
      .update({
        title: parsed.data.title,
        kind: parsed.data.kind,
        status: parsed.data.scheduledOn ? 'Programada' : 'Abierta',
        priority: parsed.data.priority,
        asset_id: parsed.data.assetId,
        asset_label: parsed.data.assetLabel,
        assignee_id: parsed.data.assigneeId,
        location: parsed.data.location,
        detail: parsed.data.detail,
        scheduled_on: parsed.data.scheduledOn,
        labor_cost_cents: parsed.data.laborCostCents,
        parts_cost_cents: parsed.data.partsCostCents,
        recurrence_days: parsed.data.recurrenceDays,
        site_id: parsed.data.siteId,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[mantenimiento] updateOrden', error)
      return fail('No se pudo actualizar la orden de trabajo.')
    }

    revalidatePath('/dashboard/mantenimiento')
    return { ok: true, data: await getMantenimiento() }
  } catch {
    return fail('No tienes permiso para gestionar mantenimiento.')
  }
}

const statusSchema = z.object({
  id: z.uuid(),
  status: z.enum(WORK_ORDER_STATUSES),
  downtimeHours: z.coerce.number().min(0).max(100_000).nullable().default(null),
})

/**
 * Moves a work order along, and closes the loop on a recurring one.
 *
 * Completing an order with `recurrence_days` set schedules the next occurrence
 * immediately. Preventive maintenance that has to be re-entered by hand after
 * every service is preventive maintenance that stops happening.
 */
export async function setOrdenStatus(
  input: z.input<typeof statusSchema>,
): Promise<MantenimientoResult<MantenimientoData>> {
  try {
    const member = await requirePermission('mantenimiento:write')
    const parsed = statusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { data: current } = await supabase
      .from('work_orders')
      .select('id, title, kind, priority, asset_id, asset_label, assignee_id, location, detail, recurrence_days, scheduled_on')
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!current) return fail('Esa orden no existe en tu organización.')

    const completed = parsed.data.status === 'Completada'
    const { error } = await supabase
      .from('work_orders')
      .update({
        status: parsed.data.status,
        // Cleared on reopen: a completion timestamp on an open order is what
        // makes the MTTR report wrong and nobody notices.
        completed_at: completed ? new Date().toISOString() : null,
        ...(parsed.data.downtimeHours !== null
          ? { downtime_hours: parsed.data.downtimeHours }
          : {}),
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[mantenimiento] setOrdenStatus', error)
      return fail('No se pudo actualizar la orden.')
    }

    if (completed && current.recurrence_days) {
      const next = new Date()
      next.setDate(next.getDate() + current.recurrence_days)

      const { error: repeatError } = await supabase.from('work_orders').insert({
        org_id: member.orgId,
        title: current.title,
        kind: current.kind,
        status: 'Programada',
        priority: current.priority,
        asset_id: current.asset_id,
        asset_label: current.asset_label,
        assignee_id: current.assignee_id,
        location: current.location,
        detail: current.detail,
        scheduled_on: next.toISOString().slice(0, 10),
        recurrence_days: current.recurrence_days,
      })

      // Reported but not fatal: the order that was just completed genuinely
      // was, and failing the whole call would invite a second click that
      // completes it again.
      if (repeatError) console.error('[mantenimiento] recurrence', repeatError)
    }

    revalidatePath('/dashboard/mantenimiento')
    return { ok: true, data: await getMantenimiento() }
  } catch {
    return fail('No tienes permiso para gestionar mantenimiento.')
  }
}

export async function deleteOrden(id: string): Promise<MantenimientoResult<MantenimientoData>> {
  try {
    const member = await requirePermission('mantenimiento:write')
    if (!z.uuid().safeParse(id).success) return fail('Orden desconocida.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('work_orders')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[mantenimiento] deleteOrden', error)
      return fail('No se pudo eliminar la orden.')
    }

    revalidatePath('/dashboard/mantenimiento')
    return { ok: true, data: await getMantenimiento() }
  } catch {
    return fail('No tienes permiso para gestionar mantenimiento.')
  }
}

export type WorkOrderTask = { id: string; description: string; done: boolean }

const taskListSelect = (supabase: Awaited<ReturnType<typeof createClient>>, workOrderId: string) =>
  supabase
    .from('work_order_tasks')
    .select('id, description, done')
    .eq('work_order_id', workOrderId)
    .order('position', { ascending: true })

export async function fetchWorkOrderTasks(
  workOrderId: string,
): Promise<MantenimientoResult<WorkOrderTask[]>> {
  try {
    await requirePermission('mantenimiento:read')
    if (!z.uuid().safeParse(workOrderId).success) return fail('Orden desconocida.')

    const supabase = await createClient()
    const { data, error } = await taskListSelect(supabase, workOrderId)

    if (error) {
      console.error('[mantenimiento] fetchWorkOrderTasks', error)
      return fail('No se pudieron cargar las tareas.')
    }

    return { ok: true, data: data ?? [] }
  } catch {
    return fail('No tienes permiso para ver mantenimiento.')
  }
}

const createTaskSchema = z.object({
  workOrderId: z.uuid(),
  description: z.string().trim().min(1, 'Describe la tarea.').max(300, 'La descripción es muy larga.'),
})

export async function createWorkOrderTask(
  input: z.input<typeof createTaskSchema>,
): Promise<MantenimientoResult<WorkOrderTask[]>> {
  try {
    const member = await requirePermission('mantenimiento:write')
    const parsed = createTaskSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { count } = await supabase
      .from('work_order_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('work_order_id', parsed.data.workOrderId)

    const { error } = await supabase.from('work_order_tasks').insert({
      work_order_id: parsed.data.workOrderId,
      description: parsed.data.description,
      position: count ?? 0,
    })

    if (error) {
      console.error('[mantenimiento] createWorkOrderTask', error)
      return fail('No se pudo crear la tarea.')
    }

    revalidatePath('/dashboard/mantenimiento')
    const { data } = await taskListSelect(supabase, parsed.data.workOrderId)
    return { ok: true, data: data ?? [] }
  } catch {
    return fail('No tienes permiso para gestionar mantenimiento.')
  }
}

const toggleTaskSchema = z.object({ id: z.uuid(), done: z.boolean() })

export async function toggleWorkOrderTask(
  input: z.input<typeof toggleTaskSchema>,
): Promise<MantenimientoResult<boolean>> {
  try {
    await requirePermission('mantenimiento:write')
    const parsed = toggleTaskSchema.safeParse(input)
    if (!parsed.success) return fail('Tarea desconocida.')

    const supabase = await createClient()
    const { error, data } = await supabase
      .from('work_order_tasks')
      .update({ done: parsed.data.done })
      .eq('id', parsed.data.id)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('[mantenimiento] toggleWorkOrderTask', error)
      return fail('No se pudo actualizar la tarea.')
    }
    if (!data) return fail('Esa tarea no existe en tu organización.')

    revalidatePath('/dashboard/mantenimiento')
    return { ok: true, data: true }
  } catch {
    return fail('No tienes permiso para gestionar mantenimiento.')
  }
}

export async function deleteWorkOrderTask(id: string): Promise<MantenimientoResult<WorkOrderTask[]>> {
  try {
    const member = await requirePermission('mantenimiento:write')
    if (!z.uuid().safeParse(id).success) return fail('Tarea desconocida.')

    const supabase = await createClient()
    const { error, data } = await supabase
      .from('work_order_tasks')
      .delete()
      .eq('id', id)
      .select('work_order_id')
      .maybeSingle()

    if (error) {
      console.error('[mantenimiento] deleteWorkOrderTask', error)
      return fail('No se pudo eliminar la tarea.')
    }
    if (!data) return fail('Esa tarea no existe en tu organización.')

    revalidatePath('/dashboard/mantenimiento')
    const { data: list } = await taskListSelect(supabase, data.work_order_id)
    return { ok: true, data: list ?? [] }
  } catch {
    return fail('No tienes permiso para gestionar mantenimiento.')
  }
}
