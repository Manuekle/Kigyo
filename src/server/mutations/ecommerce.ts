'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { ONLINE_ORDER_STATUSES, SHIPPING_METHODS } from '@/lib/domain'
import { getEcommerce, type EcommerceData } from '@/server/queries/ecommerce'

export type EcommerceResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const itemSchema = z.object({
  productId: z.uuid().nullable().default(null),
  description: z.string().trim().min(1, 'Cada línea necesita una descripción.').max(300),
  quantity: z.coerce.number().positive('La cantidad debe ser mayor que cero.').max(1e6),
  unitPriceCents: z.coerce.number().int().min(0),
})

const orderSchema = z.object({
  customerName: z.string().trim().min(2, 'Escribe el nombre del comprador.').max(200),
  customerEmail: z.email('Escribe un correo válido.').max(160).toLowerCase().nullable().default(null),
  customerPhone: z.string().trim().max(40).default(''),
  shippingMethod: z.enum(SHIPPING_METHODS).default('Domicilio'),
  shippingAddress: z.string().trim().max(300).default(''),
  shippingCity: z.string().trim().max(120).default(''),
  shippingCents: z.coerce.number().int().min(0).default(0),
  couponCode: z.string().trim().max(32).toUpperCase().default(''),
  notes: z.string().trim().max(2000).default(''),
  items: z.array(itemSchema).min(1, 'Agrega al menos un producto.').max(200),
})

/**
 * Applies a coupon to a subtotal, in minor units.
 *
 * The discount is capped at the subtotal: a fixed-amount coupon worth more than
 * the order must not produce a negative total, which the `total_cents >= 0`
 * check would reject with an opaque constraint violation. Shipping is charged
 * on top and is deliberately not discounted — that is a separate promotion, and
 * conflating them is how a free-shipping coupon ends up discounting the goods.
 */
function discountFor(
  subtotal: number,
  coupon: { percent_off: number | null; amount_off_cents: number | null } | null,
): number {
  if (!coupon) return 0
  const raw = coupon.percent_off !== null
    ? Math.round((subtotal * coupon.percent_off) / 100)
    : coupon.amount_off_cents ?? 0
  return Math.min(raw, subtotal)
}

export async function createPedido(
  input: z.input<typeof orderSchema>,
): Promise<EcommerceResult<EcommerceData>> {
  try {
    const member = await requirePermission('ecommerce:write')
    const parsed = orderSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    const productIds = [...new Set(parsed.data.items.map((i) => i.productId).filter(Boolean))] as string[]
    if (productIds.length > 0) {
      const { data: owned } = await supabase
        .from('products')
        .select('id')
        .eq('org_id', member.orgId)
        .is('deleted_at', null)
        .in('id', productIds)

      if ((owned ?? []).length !== productIds.length) {
        return fail('Alguno de los productos no existe en tu catálogo.')
      }
    }

    const subtotal = parsed.data.items.reduce(
      (sum, item) => sum + Math.round(item.quantity * item.unitPriceCents), 0,
    )

    // The coupon is validated server-side against every condition it carries.
    // A browser that posts its own discount is a browser that shops for free.
    let discount = 0
    let couponId: string | null = null
    if (parsed.data.couponCode) {
      const { data: coupon } = await supabase
        .from('discount_coupons')
        .select('id, percent_off, amount_off_cents, min_total_cents, max_uses, used_count, starts_on, expires_on, is_active')
        .eq('org_id', member.orgId)
        .eq('code', parsed.data.couponCode)
        .maybeSingle()

      if (!coupon) return fail('Ese cupón no existe.')
      if (!coupon.is_active) return fail('Ese cupón está desactivado.')

      const today = new Date().toISOString().slice(0, 10)
      if (coupon.starts_on && today < coupon.starts_on) return fail('Ese cupón todavía no está vigente.')
      if (coupon.expires_on && today > coupon.expires_on) return fail('Ese cupón ya venció.')
      if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
        return fail('Ese cupón ya alcanzó su número máximo de usos.')
      }
      if (subtotal < coupon.min_total_cents) {
        return fail(
          `Ese cupón aplica desde ${(coupon.min_total_cents / 100).toLocaleString('es-CO')}.`,
        )
      }

      discount = discountFor(subtotal, coupon)
      couponId = coupon.id
    }

    const total = subtotal + parsed.data.shippingCents - discount

    const { data: order, error } = await supabase
      .from('online_orders')
      .insert({
        org_id: member.orgId,
        customer_name: parsed.data.customerName,
        customer_email: parsed.data.customerEmail,
        customer_phone: parsed.data.customerPhone,
        status: 'Nuevo',
        shipping_method: parsed.data.shippingMethod,
        shipping_address: parsed.data.shippingAddress,
        shipping_city: parsed.data.shippingCity,
        subtotal_cents: subtotal,
        shipping_cents: parsed.data.shippingCents,
        discount_cents: discount,
        total_cents: total,
        coupon_code: parsed.data.couponCode,
        notes: parsed.data.notes,
      })
      .select('id')
      .single()

    if (error || !order) {
      console.error('[ecommerce] createPedido', error)
      return fail('No se pudo crear el pedido.')
    }

    const { error: itemsError } = await supabase.from('online_order_items').insert(
      parsed.data.items.map((item, index) => ({
        order_id: order.id,
        product_id: item.productId,
        description: item.description,
        quantity: item.quantity,
        unit_price_cents: item.unitPriceCents,
        position: index,
      })),
    )

    if (itemsError) {
      console.error('[ecommerce] createPedido items', itemsError)
      // An order whose header exists and whose lines do not charges a total
      // nothing supports. Rolled back by hand — PostgREST has no transaction
      // across two calls.
      await supabase.from('online_orders').delete().eq('id', order.id).eq('org_id', member.orgId)
      return fail('No se pudieron guardar las líneas del pedido.')
    }

    if (couponId) {
      // Incremented after the order is safely written, so a failed order does
      // not burn a use. Read-then-write rather than an atomic increment: the
      // volume here is a shop's order rate, not a race worth a function for.
      const { data: fresh } = await supabase
        .from('discount_coupons')
        .select('used_count')
        .eq('id', couponId)
        .maybeSingle()

      await supabase
        .from('discount_coupons')
        .update({ used_count: (fresh?.used_count ?? 0) + 1 })
        .eq('id', couponId)
        .eq('org_id', member.orgId)
    }

    revalidatePath('/dashboard/ecommerce')
    return { ok: true, data: await getEcommerce() }
  } catch {
    return fail('No tienes permiso para gestionar ecommerce.')
  }
}

const statusSchema = z.object({
  id: z.uuid(),
  status: z.enum(ONLINE_ORDER_STATUSES),
  trackingCode: z.string().trim().max(120).default(''),
})

export async function setPedidoStatus(
  input: z.input<typeof statusSchema>,
): Promise<EcommerceResult<EcommerceData>> {
  try {
    const member = await requirePermission('ecommerce:write')
    const parsed = statusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const shipped = parsed.data.status === 'Enviado'
    const delivered = parsed.data.status === 'Entregado'
    const now = new Date().toISOString()

    const supabase = await createClient()
    const { error } = await supabase
      .from('online_orders')
      .update({
        status: parsed.data.status,
        // A delivered order was necessarily shipped, so the shipped timestamp
        // is kept when it moves on. Rolling back to an earlier state clears
        // both, since a cancelled order was not delivered.
        ...(shipped ? { shipped_at: now, delivered_at: null } : {}),
        ...(delivered ? { delivered_at: now } : {}),
        ...(!shipped && !delivered ? { shipped_at: null, delivered_at: null } : {}),
        ...(parsed.data.trackingCode ? { tracking_code: parsed.data.trackingCode } : {}),
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[ecommerce] setPedidoStatus', error)
      return fail('No se pudo actualizar el pedido.')
    }

    revalidatePath('/dashboard/ecommerce')
    return { ok: true, data: await getEcommerce() }
  } catch {
    return fail('No tienes permiso para gestionar ecommerce.')
  }
}

const devolucionSchema = z.object({
  orderId: z.uuid('Pedido desconocido.'),
  reason: z.string().trim().min(2, 'Escribe el motivo de la devolución.'),
  amountCents: z.coerce.number().int().min(0).default(0),
})

export async function registrarDevolucion(
  input: z.input<typeof devolucionSchema>,
): Promise<EcommerceResult<EcommerceData>> {
  try {
    const member = await requirePermission('ecommerce:write')
    const parsed = devolucionSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { data: order } = await supabase
      .from('online_orders')
      .select('id, status')
      .eq('id', parsed.data.orderId)
      .eq('org_id', member.orgId)
      .maybeSingle()

    if (!order) return fail('Ese pedido no existe.')
    if (order.status === 'Cancelado' || order.status === 'Devuelto') {
      return fail('Ese pedido ya no se puede devolver.')
    }

    const { error: insertError } = await supabase
      .from('online_order_returns' as never)
      .insert({
        order_id: parsed.data.orderId,
        reason: parsed.data.reason,
        amount_cents: parsed.data.amountCents,
      } as never)

    if (insertError) {
      console.error('[ecommerce] registrarDevolucion', insertError)
      return fail('No se pudo registrar la devolución.')
    }

    const { error: statusError } = await supabase
      .from('online_orders')
      .update({ status: 'Devuelto' })
      .eq('id', parsed.data.orderId)
      .eq('org_id', member.orgId)

    if (statusError) {
      console.error('[ecommerce] registrarDevolucion status', statusError)
      return fail('No se pudo actualizar el pedido.')
    }

    revalidatePath('/dashboard/ecommerce')
    return { ok: true, data: await getEcommerce() }
  } catch {
    return fail('No tienes permiso para gestionar ecommerce.')
  }
}

const trackingSchema = z.object({
  orderId: z.uuid('Pedido desconocido.'),
  trackingCode: z.string().trim().max(120, 'El código de seguimiento es muy largo.'),
})

export async function setPedidoTracking(
  input: z.input<typeof trackingSchema>,
): Promise<EcommerceResult<EcommerceData>> {
  try {
    const member = await requirePermission('ecommerce:write')
    const parsed = trackingSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { data: order } = await supabase
      .from('online_orders')
      .select('status')
      .eq('id', parsed.data.orderId)
      .eq('org_id', member.orgId)
      .maybeSingle()

    if (!order) return fail('Ese pedido no existe.')

    const { error } = await supabase
      .from('online_orders')
      .update({
        tracking_code: parsed.data.trackingCode,
        ...(order.status === 'Nuevo' || order.status === 'Pagado' || order.status === 'En preparación'
          ? { status: 'Enviado' }
          : {}),
      })
      .eq('id', parsed.data.orderId)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[ecommerce] setPedidoTracking', error)
      return fail('No se pudo actualizar el seguimiento.')
    }

    revalidatePath('/dashboard/ecommerce')
    return { ok: true, data: await getEcommerce() }
  } catch {
    return fail('No tienes permiso para gestionar ecommerce.')
  }
}

export async function deletePedido(id: string): Promise<EcommerceResult<EcommerceData>> {
  try {
    const member = await requirePermission('ecommerce:write')
    if (!z.uuid().safeParse(id).success) return fail('Pedido desconocido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('online_orders')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[ecommerce] deletePedido', error)
      return fail('No se pudo eliminar el pedido.')
    }

    revalidatePath('/dashboard/ecommerce')
    return { ok: true, data: await getEcommerce() }
  } catch {
    return fail('No tienes permiso para gestionar ecommerce.')
  }
}

/* ─── Coupons ──────────────────────────────────────────────────────────── */

const couponSchema = z.object({
  code: z.string().trim().min(3, 'El código son mínimo 3 caracteres.').max(32).toUpperCase(),
  percentOff: z.coerce.number().int().min(1).max(100).nullable().default(null),
  amountOffCents: z.coerce.number().int().positive().nullable().default(null),
  minTotalCents: z.coerce.number().int().min(0).default(0),
  maxUses: z.coerce.number().int().positive().nullable().default(null),
  startsOn: z.string().date().nullable().default(null),
  expiresOn: z.string().date().nullable().default(null),
})

export async function createCupon(
  input: z.input<typeof couponSchema>,
): Promise<EcommerceResult<EcommerceData>> {
  try {
    const member = await requirePermission('ecommerce:write')
    const parsed = couponSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    // Mirrors `discount_coupons_one_kind`. A coupon that is both 10 % and
    // $20.000 has no defined behaviour, and one that is neither does nothing.
    const hasPercent = parsed.data.percentOff !== null
    const hasAmount = parsed.data.amountOffCents !== null
    if (hasPercent === hasAmount) {
      return fail('Elige un solo tipo de descuento: porcentaje o monto fijo.')
    }
    if (parsed.data.startsOn && parsed.data.expiresOn && parsed.data.expiresOn < parsed.data.startsOn) {
      return fail('La fecha de expiración no puede ser anterior a la de inicio.')
    }

    const supabase = await createClient()
    const { error } = await supabase.from('discount_coupons').insert({
      org_id: member.orgId,
      code: parsed.data.code,
      percent_off: parsed.data.percentOff,
      amount_off_cents: parsed.data.amountOffCents,
      min_total_cents: parsed.data.minTotalCents,
      max_uses: parsed.data.maxUses,
      starts_on: parsed.data.startsOn,
      expires_on: parsed.data.expiresOn,
    })

    if (error) {
      console.error('[ecommerce] createCupon', error)
      if (error.code === '23505') return fail('Ya existe un cupón con ese código.')
      return fail('No se pudo crear el cupón.')
    }

    revalidatePath('/dashboard/ecommerce')
    return { ok: true, data: await getEcommerce() }
  } catch {
    return fail('No tienes permiso para gestionar ecommerce.')
  }
}

const couponUpdateSchema = couponSchema.extend({ id: z.uuid() })

export async function updateCupon(
  input: z.input<typeof couponUpdateSchema>,
): Promise<EcommerceResult<EcommerceData>> {
  try {
    const member = await requirePermission('ecommerce:write')
    const parsed = couponUpdateSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const hasPercent = parsed.data.percentOff !== null
    const hasAmount = parsed.data.amountOffCents !== null
    if (hasPercent === hasAmount) {
      return fail('Elige un solo tipo de descuento: porcentaje o monto fijo.')
    }
    if (parsed.data.startsOn && parsed.data.expiresOn && parsed.data.expiresOn < parsed.data.startsOn) {
      return fail('La fecha de expiración no puede ser anterior a la de inicio.')
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('discount_coupons')
      .update({
        code: parsed.data.code,
        percent_off: parsed.data.percentOff,
        amount_off_cents: parsed.data.amountOffCents,
        min_total_cents: parsed.data.minTotalCents,
        max_uses: parsed.data.maxUses,
        starts_on: parsed.data.startsOn,
        expires_on: parsed.data.expiresOn,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[ecommerce] updateCupon', error)
      if (error.code === '23505') return fail('Ya existe un cupón con ese código.')
      return fail('No se pudo actualizar el cupón.')
    }

    revalidatePath('/dashboard/ecommerce')
    return { ok: true, data: await getEcommerce() }
  } catch {
    return fail('No tienes permiso para gestionar ecommerce.')
  }
}

const couponActiveSchema = z.object({ id: z.uuid(), isActive: z.boolean() })

export async function setCuponActivo(
  input: z.input<typeof couponActiveSchema>,
): Promise<EcommerceResult<EcommerceData>> {
  try {
    const member = await requirePermission('ecommerce:write')
    const parsed = couponActiveSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('discount_coupons')
      .update({ is_active: parsed.data.isActive })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[ecommerce] setCuponActivo', error)
      return fail('No se pudo actualizar el cupón.')
    }

    revalidatePath('/dashboard/ecommerce')
    return { ok: true, data: await getEcommerce() }
  } catch {
    return fail('No tienes permiso para gestionar ecommerce.')
  }
}
