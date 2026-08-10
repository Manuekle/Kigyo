'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import {
  MENU_CATEGORIES, RESTAURANT_ORDER_STATUSES, TABLE_STATUSES,
} from '@/lib/domain'
import { belongsToOrg } from '@/server/queries/shared'
import { getRestaurante, type RestauranteData } from '@/server/queries/restaurante'

export type RestauranteResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

/* ─── Menu ─────────────────────────────────────────────────────────────── */

const menuSchema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre del plato.').max(160),
  category: z.enum(MENU_CATEGORIES).default('Plato fuerte'),
  description: z.string().trim().max(1000).default(''),
  priceCents: z.coerce.number().int().min(0).default(0),
  costCents: z.coerce.number().int().min(0).default(0),
  prepMinutes: z.coerce.number().int().min(0).max(600).nullable().default(null),
  allergens: z.string().trim().max(500).default(''),
})

export async function createPlato(
  input: z.input<typeof menuSchema>,
): Promise<RestauranteResult<RestauranteData>> {
  try {
    const member = await requirePermission('restaurante:write')
    const parsed = menuSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    // Not a database constraint — a loss leader is a real decision — but it is
    // almost always a swapped pair of fields, and the margin report would
    // report the mistake as a fact.
    if (parsed.data.priceCents > 0 && parsed.data.costCents > parsed.data.priceCents) {
      return fail('El costo supera al precio. Revisa los valores.')
    }

    const supabase = await createClient()
    const { error } = await supabase.from('menu_items').insert({
      org_id: member.orgId,
      name: parsed.data.name,
      category: parsed.data.category,
      description: parsed.data.description,
      price_cents: parsed.data.priceCents,
      cost_cents: parsed.data.costCents,
      prep_minutes: parsed.data.prepMinutes,
      allergens: parsed.data.allergens,
    })

    if (error) {
      console.error('[restaurante] createPlato', error)
      return fail('No se pudo crear el plato.')
    }

    revalidatePath('/dashboard/restaurante')
    return { ok: true, data: await getRestaurante() }
  } catch {
    return fail('No tienes permiso para gestionar el restaurante.')
  }
}

const availabilitySchema = z.object({ id: z.uuid(), isAvailable: z.boolean() })

export async function setPlatoDisponible(
  input: z.input<typeof availabilitySchema>,
): Promise<RestauranteResult<RestauranteData>> {
  try {
    const member = await requirePermission('restaurante:write')
    const parsed = availabilitySchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('menu_items')
      .update({ is_available: parsed.data.isAvailable })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[restaurante] setPlatoDisponible', error)
      return fail('No se pudo actualizar el plato.')
    }

    revalidatePath('/dashboard/restaurante')
    return { ok: true, data: await getRestaurante() }
  } catch {
    return fail('No tienes permiso para gestionar el restaurante.')
  }
}

/* ─── Tables ───────────────────────────────────────────────────────────── */

const tableSchema = z.object({
  label: z.string().trim().min(1, 'Ponle nombre a la mesa.').max(40),
  zone: z.string().trim().max(80).default(''),
  seats: z.coerce.number().int().min(1).max(100).default(2),
})

export async function createMesa(
  input: z.input<typeof tableSchema>,
): Promise<RestauranteResult<RestauranteData>> {
  try {
    const member = await requirePermission('restaurante:write')
    const parsed = tableSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase.from('dining_tables').insert({
      org_id: member.orgId,
      label: parsed.data.label,
      zone: parsed.data.zone,
      seats: parsed.data.seats,
    })

    if (error) {
      console.error('[restaurante] createMesa', error)
      if (error.code === '23505') return fail('Ya existe una mesa con ese nombre.')
      return fail('No se pudo crear la mesa.')
    }

    revalidatePath('/dashboard/restaurante')
    return { ok: true, data: await getRestaurante() }
  } catch {
    return fail('No tienes permiso para gestionar el restaurante.')
  }
}

const tableStatusSchema = z.object({ id: z.uuid(), status: z.enum(TABLE_STATUSES) })

export async function setMesaStatus(
  input: z.input<typeof tableStatusSchema>,
): Promise<RestauranteResult<RestauranteData>> {
  try {
    const member = await requirePermission('restaurante:write')
    const parsed = tableStatusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('dining_tables')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[restaurante] setMesaStatus', error)
      return fail('No se pudo actualizar la mesa.')
    }

    revalidatePath('/dashboard/restaurante')
    return { ok: true, data: await getRestaurante() }
  } catch {
    return fail('No tienes permiso para gestionar el restaurante.')
  }
}

/* ─── Orders ───────────────────────────────────────────────────────────── */

const orderItemSchema = z.object({
  menuItemId: z.uuid().nullable().default(null),
  description: z.string().trim().min(1, 'Cada línea necesita una descripción.').max(300),
  quantity: z.coerce.number().int().positive().max(999),
  unitPriceCents: z.coerce.number().int().min(0),
  notes: z.string().trim().max(300).default(''),
})

const orderSchema = z.object({
  tableId: z.uuid().nullable().default(null),
  waiterId: z.uuid().nullable().default(null),
  guests: z.coerce.number().int().min(1).max(200).default(1),
  notes: z.string().trim().max(1000).default(''),
  items: z.array(orderItemSchema).min(1, 'Agrega al menos un plato.').max(200),
})

export async function abrirComanda(
  input: z.input<typeof orderSchema>,
): Promise<RestauranteResult<RestauranteData>> {
  try {
    const member = await requirePermission('restaurante:write')
    const parsed = orderSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    if (parsed.data.tableId) {
      const { data: table } = await supabase
        .from('dining_tables')
        .select('id')
        .eq('id', parsed.data.tableId)
        .eq('org_id', member.orgId)
        .is('deleted_at', null)
        .maybeSingle()
      if (!table) return fail('Esa mesa no existe en tu organización.')
    }

    if (!(await belongsToOrg(supabase, 'employees', parsed.data.waiterId, member.orgId))) {
      return fail('Esa persona no está en el equipo de tu organización.')
    }

    const subtotal = parsed.data.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPriceCents, 0,
    )

    const { data: order, error } = await supabase
      .from('restaurant_orders')
      .insert({
        org_id: member.orgId,
        table_id: parsed.data.tableId,
        waiter_id: parsed.data.waiterId,
        status: 'Abierta',
        guests: parsed.data.guests,
        subtotal_cents: subtotal,
        total_cents: subtotal,
        notes: parsed.data.notes,
      })
      .select('id')
      .single()

    if (error || !order) {
      console.error('[restaurante] abrirComanda', error)
      return fail('No se pudo abrir la comanda.')
    }

    const { error: itemsError } = await supabase.from('restaurant_order_items').insert(
      parsed.data.items.map((item, index) => ({
        order_id: order.id,
        menu_item_id: item.menuItemId,
        description: item.description,
        quantity: item.quantity,
        unit_price_cents: item.unitPriceCents,
        notes: item.notes,
        position: index,
      })),
    )

    if (itemsError) {
      console.error('[restaurante] abrirComanda items', itemsError)
      await supabase.from('restaurant_orders').delete().eq('id', order.id).eq('org_id', member.orgId)
      return fail('No se pudieron guardar los platos de la comanda.')
    }

    // The table follows the order. A comanda open on a table still marked
    // "Libre" is how two parties end up seated at the same table.
    if (parsed.data.tableId) {
      await supabase
        .from('dining_tables')
        .update({ status: 'Ocupada' })
        .eq('id', parsed.data.tableId)
        .eq('org_id', member.orgId)
    }

    revalidatePath('/dashboard/restaurante')
    return { ok: true, data: await getRestaurante() }
  } catch {
    return fail('No tienes permiso para gestionar el restaurante.')
  }
}

const orderStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(RESTAURANT_ORDER_STATUSES),
  tipCents: z.coerce.number().int().min(0).nullable().default(null),
})

/**
 * Moves a comanda along, and frees its table when it closes.
 *
 * Paying is the only transition that touches the total, because the tip is
 * only known then. Releasing the table is what stops the floor plan drifting
 * out of step with the room over a service.
 */
export async function setComandaStatus(
  input: z.input<typeof orderStatusSchema>,
): Promise<RestauranteResult<RestauranteData>> {
  try {
    const member = await requirePermission('restaurante:write')
    const parsed = orderStatusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { data: order } = await supabase
      .from('restaurant_orders')
      .select('id, table_id, subtotal_cents, tip_cents')
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!order) return fail('Esa comanda no existe en tu organización.')

    const closed = parsed.data.status === 'Pagada' || parsed.data.status === 'Anulada'
    const tip = parsed.data.tipCents ?? order.tip_cents

    const { error } = await supabase
      .from('restaurant_orders')
      .update({
        status: parsed.data.status,
        tip_cents: tip,
        total_cents: order.subtotal_cents + tip,
        closed_at: closed ? new Date().toISOString() : null,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[restaurante] setComandaStatus', error)
      return fail('No se pudo actualizar la comanda.')
    }

    if (closed && order.table_id) {
      await supabase
        .from('dining_tables')
        .update({ status: 'Libre' })
        .eq('id', order.table_id)
        .eq('org_id', member.orgId)
    }

    revalidatePath('/dashboard/restaurante')
    return { ok: true, data: await getRestaurante() }
  } catch {
    return fail('No tienes permiso para gestionar el restaurante.')
  }
}
