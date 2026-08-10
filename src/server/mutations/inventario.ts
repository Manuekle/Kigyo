'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import {
  ASSET_CATEGORIES, ASSET_STATUSES, INVENTORY_ORDER_STATUSES, assetStatusFor,
} from '@/lib/domain'
import { belongsToOrg, currentEmployeeId } from '@/server/queries/shared'
import { getInventario, type InventarioData } from '@/server/queries/inventario'

export type InventarioResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const assetSchema = z.object({
  name: z.string().trim().min(2, 'El nombre del activo es obligatorio.').max(200),
  category: z.enum(ASSET_CATEGORIES).default('Otro'),
  serial: z.string().trim().max(120).default(''),
  employeeId: z.uuid().nullable().default(null),
  acquiredOn: z.string().date().nullable().default(null),
})

const updateAssetSchema = assetSchema.extend({
  id: z.uuid(),
  status: z.enum(ASSET_STATUSES),
})

export async function createActivo(
  input: z.input<typeof assetSchema>,
): Promise<InventarioResult<InventarioData>> {
  try {
    const member = await requirePermission('inventario:write')
    const parsed = assetSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    if (!(await belongsToOrg(supabase, 'employees', parsed.data.employeeId, member.orgId))) {
      return fail('Esa persona no está en el equipo de tu organización.')
    }

    const { error } = await supabase.from('inventory_assets').insert({
      org_id: member.orgId,
      name: parsed.data.name,
      category: parsed.data.category,
      serial: parsed.data.serial,
      employee_id: parsed.data.employeeId,
      status: assetStatusFor(parsed.data.employeeId),
      acquired_on: parsed.data.acquiredOn,
    })

    if (error) {
      console.error('[inventario] createActivo', error)
      return fail('No se pudo registrar el activo.')
    }

    revalidatePath('/dashboard/inventario')
    return { ok: true, data: await getInventario() }
  } catch {
    return fail('No tienes permiso para gestionar inventario.')
  }
}

export async function updateActivo(
  input: z.input<typeof updateAssetSchema>,
): Promise<InventarioResult<InventarioData>> {
  try {
    const member = await requirePermission('inventario:write')
    const parsed = updateAssetSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    if (!(await belongsToOrg(supabase, 'employees', parsed.data.employeeId, member.orgId))) {
      return fail('Esa persona no está en el equipo de tu organización.')
    }

    const { error } = await supabase
      .from('inventory_assets')
      .update({
        name: parsed.data.name,
        category: parsed.data.category,
        serial: parsed.data.serial,
        employee_id: parsed.data.employeeId,
        status: assetStatusFor(parsed.data.employeeId, parsed.data.status),
        acquired_on: parsed.data.acquiredOn,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[inventario] updateActivo', error)
      return fail('No se pudo actualizar el activo.')
    }

    revalidatePath('/dashboard/inventario')
    return { ok: true, data: await getInventario() }
  } catch {
    return fail('No tienes permiso para gestionar inventario.')
  }
}

const assignSchema = z.object({
  id: z.uuid(),
  employeeId: z.uuid().nullable(),
})

/** Hand an asset to somebody, or take it back. Status follows automatically. */
export async function assignActivo(
  input: z.input<typeof assignSchema>,
): Promise<InventarioResult<InventarioData>> {
  try {
    const member = await requirePermission('inventario:write')
    const parsed = assignSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    if (!(await belongsToOrg(supabase, 'employees', parsed.data.employeeId, member.orgId))) {
      return fail('Esa persona no está en el equipo de tu organización.')
    }

    const { error } = await supabase
      .from('inventory_assets')
      .update({
        employee_id: parsed.data.employeeId,
        status: assetStatusFor(parsed.data.employeeId),
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[inventario] assignActivo', error)
      return fail('No se pudo asignar el activo.')
    }

    revalidatePath('/dashboard/inventario')
    return { ok: true, data: await getInventario() }
  } catch {
    return fail('No tienes permiso para gestionar inventario.')
  }
}

export async function deleteActivo(id: string): Promise<InventarioResult<InventarioData>> {
  try {
    const member = await requirePermission('inventario:write')
    if (!z.uuid().safeParse(id).success) return fail('Activo desconocido.')

    const supabase = await createClient()
    // 'Baja' rather than gone: an asset that was written off is part of the
    // asset history, and its serial may still turn up in an audit.
    const { error } = await supabase
      .from('inventory_assets')
      .update({ deleted_at: new Date().toISOString(), status: 'Baja', employee_id: null })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[inventario] deleteActivo', error)
      return fail('No se pudo dar de baja el activo.')
    }

    revalidatePath('/dashboard/inventario')
    return { ok: true, data: await getInventario() }
  } catch {
    return fail('No tienes permiso para gestionar inventario.')
  }
}

const orderSchema = z.object({
  item: z.string().trim().min(2, 'Describe qué se pide.').max(200),
  supplier: z.string().trim().max(160).default(''),
  quantity: z.number().int().min(1, 'La cantidad debe ser al menos 1.').max(100_000),
  estPriceCents: z.number().int().min(0).default(0),
})

export async function createPedido(
  input: z.input<typeof orderSchema>,
): Promise<InventarioResult<InventarioData>> {
  try {
    const member = await requirePermission('inventario:write')
    const parsed = orderSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const requestedBy = await currentEmployeeId(supabase, member.orgId, member.userId)

    const { error } = await supabase.from('inventory_orders').insert({
      org_id: member.orgId,
      item: parsed.data.item,
      supplier: parsed.data.supplier,
      quantity: parsed.data.quantity,
      est_price_cents: parsed.data.estPriceCents,
      requested_by_id: requestedBy,
      status: 'Solicitado',
    })

    if (error) {
      console.error('[inventario] createPedido', error)
      return fail('No se pudo registrar el pedido.')
    }

    revalidatePath('/dashboard/inventario')
    return { ok: true, data: await getInventario() }
  } catch {
    return fail('No tienes permiso para gestionar inventario.')
  }
}

const orderStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(INVENTORY_ORDER_STATUSES),
})

export async function setPedidoStatus(
  input: z.input<typeof orderStatusSchema>,
): Promise<InventarioResult<InventarioData>> {
  try {
    const member = await requirePermission('inventario:write')
    const parsed = orderStatusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('inventory_orders')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[inventario] setPedidoStatus', error)
      return fail('No se pudo actualizar el pedido.')
    }

    revalidatePath('/dashboard/inventario')
    return { ok: true, data: await getInventario() }
  } catch {
    return fail('No tienes permiso para gestionar inventario.')
  }
}
