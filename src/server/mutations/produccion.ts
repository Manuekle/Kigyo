'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { PRODUCTION_STATUSES } from '@/lib/domain'
import { belongsToOrg } from '@/server/queries/shared'
import { getProduccion, type ProduccionData } from '@/server/queries/produccion'

export type ProduccionResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const orderSchema = z.object({
  productId: z.uuid().nullable().default(null),
  productLabel: z.string().trim().min(2, 'Indica qué se va a producir.').max(160),
  quantityPlanned: z.coerce.number().positive('La cantidad debe ser mayor que cero.').max(1e9),
  unit: z.string().trim().max(20).default('UN'),
  line: z.string().trim().max(120).default(''),
  supervisorId: z.uuid().nullable().default(null),
  startsOn: z.string().date().nullable().default(null),
  dueOn: z.string().date().nullable().default(null),
  costCents: z.coerce.number().int().min(0).default(0),
  notes: z.string().trim().max(2000).default(''),
})

export async function createOrdenProduccion(
  input: z.input<typeof orderSchema>,
): Promise<ProduccionResult<ProduccionData>> {
  try {
    const member = await requirePermission('produccion:write')
    const parsed = orderSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    if (parsed.data.startsOn && parsed.data.dueOn && parsed.data.dueOn < parsed.data.startsOn) {
      return fail('La fecha de entrega no puede ser anterior a la de inicio.')
    }

    const supabase = await createClient()
    const [productOk, supervisorOk] = await Promise.all([
      belongsToOrg(supabase, 'products', parsed.data.productId, member.orgId),
      belongsToOrg(supabase, 'employees', parsed.data.supervisorId, member.orgId),
    ])

    if (!productOk) return fail('Ese producto no existe en tu catálogo.')
    if (!supervisorOk) return fail('Esa persona no está en el equipo de tu organización.')

    const { error } = await supabase.from('production_orders').insert({
      org_id: member.orgId,
      product_id: parsed.data.productId,
      product_label: parsed.data.productLabel,
      status: 'Planificada',
      quantity_planned: parsed.data.quantityPlanned,
      unit: parsed.data.unit,
      line: parsed.data.line,
      supervisor_id: parsed.data.supervisorId,
      starts_on: parsed.data.startsOn,
      due_on: parsed.data.dueOn,
      cost_cents: parsed.data.costCents,
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[produccion] createOrdenProduccion', error)
      return fail('No se pudo crear la orden de producción.')
    }

    revalidatePath('/dashboard/produccion')
    return { ok: true, data: await getProduccion() }
  } catch {
    return fail('No tienes permiso para gestionar producción.')
  }
}

const progressSchema = z.object({
  id: z.uuid(),
  quantityDone: z.coerce.number().min(0).max(1e9).nullable().default(null),
  quantityScrap: z.coerce.number().min(0).max(1e9).nullable().default(null),
  status: z.enum(PRODUCTION_STATUSES).nullable().default(null),
})

/**
 * Records output, scrap and status in one write.
 *
 * They are one edit at the end of a shift, and splitting them would let an
 * order sit at "Terminada" with the previous shift's quantity — the exact
 * combination that makes a yield report wrong in the safe-looking direction.
 */
export async function updateOrdenProduccion(
  input: z.input<typeof progressSchema>,
): Promise<ProduccionResult<ProduccionData>> {
  try {
    const member = await requirePermission('produccion:write')
    const parsed = progressSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { data: current } = await supabase
      .from('production_orders')
      .select('id, quantity_planned, quantity_done, quantity_scrap')
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!current) return fail('Esa orden no existe en tu organización.')

    const done = parsed.data.quantityDone ?? current.quantity_done
    const scrap = parsed.data.quantityScrap ?? current.quantity_scrap

    // Not a database constraint, because an over-run is a real thing a plant
    // does — but producing twice the order is almost always a typo, and the
    // report that follows treats it as fact.
    if (done + scrap > current.quantity_planned * 2) {
      return fail('La cantidad producida supera al doble de lo planificado. Revisa el dato.')
    }

    const completed = parsed.data.status === 'Terminada'
    const { error } = await supabase
      .from('production_orders')
      .update({
        quantity_done: done,
        quantity_scrap: scrap,
        ...(parsed.data.status !== null ? { status: parsed.data.status } : {}),
        ...(parsed.data.status !== null
          ? { completed_at: completed ? new Date().toISOString() : null }
          : {}),
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[produccion] updateOrdenProduccion', error)
      return fail('No se pudo actualizar la orden.')
    }

    revalidatePath('/dashboard/produccion')
    return { ok: true, data: await getProduccion() }
  } catch {
    return fail('No tienes permiso para gestionar producción.')
  }
}

const stageSchema = z.object({
  orderId: z.uuid(),
  name: z.string().trim().min(2, 'Ponle nombre a la etapa.').max(120),
  operatorId: z.uuid().nullable().default(null),
  position: z.coerce.number().int().min(0).max(999).default(0),
})

export async function addEtapa(
  input: z.input<typeof stageSchema>,
): Promise<ProduccionResult<ProduccionData>> {
  try {
    const member = await requirePermission('produccion:write')
    const parsed = stageSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    // `production_stages` inherits RLS from the order, so the order id has to
    // be checked against this tenant explicitly.
    const [{ data: order }, operatorOk] = await Promise.all([
      supabase
        .from('production_orders')
        .select('id')
        .eq('id', parsed.data.orderId)
        .eq('org_id', member.orgId)
        .is('deleted_at', null)
        .maybeSingle(),
      belongsToOrg(supabase, 'employees', parsed.data.operatorId, member.orgId),
    ])

    if (!order) return fail('Esa orden no existe en tu organización.')
    if (!operatorOk) return fail('Esa persona no está en el equipo de tu organización.')

    const { error } = await supabase.from('production_stages').insert({
      order_id: parsed.data.orderId,
      name: parsed.data.name,
      status: 'Planificada',
      operator_id: parsed.data.operatorId,
      position: parsed.data.position,
    })

    if (error) {
      console.error('[produccion] addEtapa', error)
      return fail('No se pudo agregar la etapa.')
    }

    revalidatePath('/dashboard/produccion')
    return { ok: true, data: await getProduccion() }
  } catch {
    return fail('No tienes permiso para gestionar producción.')
  }
}

const stageStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(PRODUCTION_STATUSES),
  quantityDone: z.coerce.number().min(0).max(1e9).nullable().default(null),
})

export async function setEtapaStatus(
  input: z.input<typeof stageStatusSchema>,
): Promise<ProduccionResult<ProduccionData>> {
  try {
    const member = await requirePermission('produccion:write')
    const parsed = stageStatusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { data: owned } = await supabase
      .from('production_stages')
      .select('id, production_orders!inner ( org_id )')
      .eq('id', parsed.data.id)
      .eq('production_orders.org_id', member.orgId)
      .maybeSingle()

    if (!owned) return fail('Esa etapa no existe en tu organización.')

    const now = new Date().toISOString()
    const running = parsed.data.status === 'En proceso'
    const finished = parsed.data.status === 'Terminada'

    const { error } = await supabase
      .from('production_stages')
      .update({
        status: parsed.data.status,
        ...(running ? { started_at: now } : {}),
        finished_at: finished ? now : null,
        ...(parsed.data.quantityDone !== null
          ? { quantity_done: parsed.data.quantityDone }
          : {}),
      })
      .eq('id', parsed.data.id)

    if (error) {
      console.error('[produccion] setEtapaStatus', error)
      return fail('No se pudo actualizar la etapa.')
    }

    revalidatePath('/dashboard/produccion')
    return { ok: true, data: await getProduccion() }
  } catch {
    return fail('No tienes permiso para gestionar producción.')
  }
}

export async function deleteOrdenProduccion(id: string): Promise<ProduccionResult<ProduccionData>> {
  try {
    const member = await requirePermission('produccion:write')
    if (!z.uuid().safeParse(id).success) return fail('Orden desconocida.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('production_orders')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[produccion] deleteOrdenProduccion', error)
      return fail('No se pudo eliminar la orden.')
    }

    revalidatePath('/dashboard/produccion')
    return { ok: true, data: await getProduccion() }
  } catch {
    return fail('No tienes permiso para gestionar producción.')
  }
}

/* ─── Lista de materiales (BOM) ─────────────────────────────────────────── */

const bomItemSchema = z.object({
  componentId: z.string().uuid(),
  quantity: z.coerce.number().min(0.001).max(1_000_000),
  unit: z.string().trim().min(1).max(10).default('UN'),
  notes: z.string().trim().max(200).default(''),
})

const saveBomSchema = z.object({
  productId: z.string().uuid(),
  version: z.string().trim().min(1).max(20).default('1'),
  notes: z.string().trim().max(300).default(''),
  items: z.array(bomItemSchema).min(1).max(50),
})

export async function saveBom(
  input: z.input<typeof saveBomSchema>,
): Promise<ProduccionResult<ProduccionData>> {
  try {
    const member = await requirePermission('produccion:write')
    const parsed = saveBomSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    // El producto y sus componentes deben ser del catálogo de *esta* org.
    const ids = [parsed.data.productId, ...parsed.data.items.map((i) => i.componentId)]
    const { data: products } = await supabase
      .from('products')
      .select('id')
      .in('id', ids)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)

    const known = new Set((products ?? []).map((p: { id: string }) => p.id))
    if (!known.has(parsed.data.productId)) return fail('Ese producto no pertenece a tu catálogo.')
    for (const item of parsed.data.items) {
      if (!known.has(item.componentId)) return fail('Un componente no pertenece a tu catálogo.')
    }

    const { data: bom, error: bomError } = await supabase
      .from('production_boms')
      .upsert(
        {
          org_id: member.orgId,
          product_id: parsed.data.productId,
          version: parsed.data.version,
          notes: parsed.data.notes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'org_id,product_id' },
      )
      .select('id')
      .single()

    if (bomError || !bom) {
      console.error('[produccion] saveBom', bomError)
      return fail('No se pudo guardar la lista de materiales.')
    }

    // La receta se reemplaza entera: editar es reescribir, no emparchar.
    const { error: delError } = await supabase
      .from('production_bom_items')
      .delete()
      .eq('bom_id', bom.id)

    if (delError) {
      console.error('[produccion] saveBom delete', delError)
      return fail('No se pudo reemplazar la lista de materiales.')
    }

    const { error: itemsError } = await supabase.from('production_bom_items').insert(
      parsed.data.items.map((item, i) => ({
        bom_id: bom.id,
        component_id: item.componentId,
        quantity: item.quantity,
        unit: item.unit,
        position: i,
        notes: item.notes,
      })),
    )

    if (itemsError) {
      console.error('[produccion] saveBom items', itemsError)
      return fail('La receta se guardó sin sus componentes.')
    }

    revalidatePath('/dashboard/produccion')
    return { ok: true, data: await getProduccion() }
  } catch {
    return fail('No tienes permiso para gestionar producción.')
  }
}

export async function deleteBom(id: string): Promise<ProduccionResult<ProduccionData>> {
  try {
    const member = await requirePermission('produccion:write')
    if (!z.uuid().safeParse(id).success) return fail('Receta desconocida.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('production_boms')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[produccion] deleteBom', error)
      return fail('No se pudo eliminar la receta.')
    }

    revalidatePath('/dashboard/produccion')
    return { ok: true, data: await getProduccion() }
  } catch {
    return fail('No tienes permiso para gestionar producción.')
  }
}
