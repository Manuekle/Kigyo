'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { PAYMENT_METHODS } from '@/lib/domain'
import { getPos, type PosData } from '@/server/queries/pos'

export type PosResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const DENIED = 'No tienes permiso para vender.'

async function refreshed(): Promise<PosResult<PosData>> {
  revalidatePath('/dashboard/pos')
  // La venta movió existencias, así que el catálogo también cambió.
  revalidatePath('/dashboard/catalogos')
  revalidatePath('/dashboard/caja')
  return { ok: true, data: await getPos() }
}

const saleSchema = z.object({
  items: z
    .array(z.object({
      productId: z.uuid(),
      quantity: z.coerce.number().int().min(1).max(9999),
    }))
    .min(1, 'Agrega al menos un producto.')
    .max(100, 'La venta tiene demasiadas líneas.'),
  paymentMethod: z.enum(PAYMENT_METHODS).default('Efectivo'),
  customerName: z.string().trim().max(160).default(''),
  discountCents: z.coerce.number().int().min(0).max(1_000_000_00).default(0),
  notes: z.string().trim().max(1000).default(''),
})

/**
 * Cobra una venta de mostrador.
 *
 * Todo el trabajo lo hace `register_pos_sale` (migración 43), y esta función es
 * solo la validación, la traducción del error y el refresco. No es delegación
 * por gusto: el precio, el subtotal y el descuento de existencias tienen que
 * decidirse dentro de la misma transacción que bloquea las filas de
 * `products`, o dos cajeros venden la última unidad. Y el precio sale del
 * catálogo, nunca del navegador — aceptarlo del cliente sería dejar que
 * cualquiera se cobre a sí mismo lo que quiera.
 *
 * Los códigos son los que levanta la función:
 *   KG101 sin permiso · KG102 carrito inválido · KG103 una línea ya no se sostiene
 */
export async function cobrarVenta(
  input: z.input<typeof saleSchema>,
): Promise<PosResult<PosData & { saleCode: string | null }>> {
  try {
    const member = await requirePermission('pos:write')
    const parsed = saleSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('register_pos_sale', {
      p_org_id: member.orgId,
      p_items: parsed.data.items.map((i) => ({
        product_id: i.productId,
        quantity: i.quantity,
      })),
      p_payment_method: parsed.data.paymentMethod,
      p_customer_name: parsed.data.customerName,
      p_discount_cents: parsed.data.discountCents,
      p_notes: parsed.data.notes,
    })

    if (error) {
      console.error('[pos] cobrarVenta', error)
      // KG103 nombra el producto y la cantidad disponible, así que se pasa tal
      // cual: la frase de la base es más útil que cualquier reemplazo genérico.
      if (error.code === 'KG103' || error.code === 'KG102') return fail(error.message)
      if (error.code === 'KG101') return fail(DENIED)
      return fail('No se pudo registrar la venta.')
    }

    const row = Array.isArray(data) ? data[0] : null
    const refresh = await refreshed()
    if (!refresh.ok) return refresh

    return { ok: true, data: { ...refresh.data, saleCode: row?.sale_code ?? null } }
  } catch {
    return fail(DENIED)
  }
}

/**
 * Anula una venta y devuelve las existencias.
 *
 * También en la base, y por lo mismo: reponer existencias desde aquí exigiría
 * `catalogos:write` a quien solo está corrigiendo un cobro. `void_pos_sale` es
 * idempotente, así que un doble clic no infla el inventario.
 */
export async function anularVenta(id: string): Promise<PosResult<PosData>> {
  try {
    await requirePermission('pos:write')
    if (!z.uuid().safeParse(id).success) return fail('Venta inválida.')

    const supabase = await createClient()
    const { error } = await supabase.rpc('void_pos_sale', { p_sale_id: id })

    if (error) {
      console.error('[pos] anularVenta', error)
      if (error.code === 'KG101') return fail(DENIED)
      if (error.code === 'KG102') return fail('Esa venta no existe.')
      return fail('No se pudo anular la venta.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}
