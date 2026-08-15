'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/session'
import { PAYMENT_METHODS } from '@/lib/domain'
import { wompiCreatePaymentIntent } from '@/lib/wompi'
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

const qrSchema = z.object({
  items: z
    .array(z.object({
      productId: z.uuid(),
      quantity: z.coerce.number().int().min(1).max(9999),
    }))
    .min(1, 'Agrega al menos un producto.')
    .max(100, 'La venta tiene demasiadas líneas.'),
  customerName: z.string().trim().max(160).default(''),
  customerEmail: z.string().trim().email('El correo del cliente no es válido.').max(200),
  discountCents: z.coerce.number().int().min(0).max(1_000_000_00).default(0),
})

export interface QrSaleData extends PosData {
  qr: {
    saleId: string
    saleCode: string
    amountCents: number
    qrUrl: string | null
    redirectUrl: string | null
  }
}

/**
 * Cobra una venta por QR (Wompi, Bancolombia QR).
 *
 * Flujo: la venta nace Pendiente (existencias descontadas, misma atomicidad
 * que el efectivo), se crea la transacción en Wompi y se muestra el QR. La
 * venta solo pasa a Pagada cuando llega el webhook firmado — nunca por
 * sondeo, y nunca por un clic del cliente.
 *
 * Capability Enterprise: la decisión de pricing del plan CRM/ERP/POS 3.3.
 * El gate es el plan, el código no cambia.
 */
export async function cobrarConQr(
  input: z.input<typeof qrSchema>,
): Promise<PosResult<QrSaleData>> {
  try {
    const member = await requirePermission('pos:write')
    const parsed = qrSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    if (member.plan !== 'enterprise') {
      return fail('Los pagos con QR están disponibles en el plan Enterprise.')
    }

    // La configuración de la pasarela y el secreto del vault se leen con el
    // cliente admin: el cajero no tiene (ni necesita) integraciones:read.
    const admin = createAdminClient()
    const { data: gateway } = await admin
      .from('integration_settings')
      .select('provider, enabled, config')
      .eq('org_id', member.orgId)
      .eq('kind', 'pagos')
      .maybeSingle()

    const publicKey = (gateway?.config as Record<string, unknown> | undefined)?.public_key
    if (!gateway?.enabled || typeof publicKey !== 'string' || !publicKey) {
      return fail('Configura la pasarela de pagos en Integraciones antes de cobrar con QR.')
    }
    if (gateway.provider !== 'wompi') {
      return fail('El pago con QR está disponible con Wompi por ahora.')
    }

    const { data: privateKey, error: secretError } = await admin.rpc('integraciones_get_secret', {
      p_name: `integraciones.${member.orgId}.pagos.private_key`,
    })
    if (secretError || typeof privateKey !== 'string' || !privateKey) {
      console.error('[pos] cobrarConQr secret', secretError)
      return fail('La llave privada de la pasarela no está disponible.')
    }

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('register_pos_sale', {
      p_org_id: member.orgId,
      p_items: parsed.data.items.map((i) => ({
        product_id: i.productId,
        quantity: i.quantity,
      })),
      p_payment_method: 'QR Wompi',
      p_customer_name: parsed.data.customerName,
      p_discount_cents: parsed.data.discountCents,
      p_notes: '',
      p_pending: true,
    })

    if (error) {
      console.error('[pos] cobrarConQr register', error)
      if (error.code === 'KG103' || error.code === 'KG102') return fail(error.message)
      if (error.code === 'KG101') return fail(DENIED)
      return fail('No se pudo preparar la venta.')
    }

    const row = Array.isArray(data) ? data[0] : null
    if (!row) return fail('No se pudo preparar la venta.')

    let intent
    try {
      intent = await wompiCreatePaymentIntent({
        privateKey,
        publicKey: publicKey as string,
        amountCents: row.sale_total_cents,
        reference: row.sale_code,
        customerEmail: parsed.data.customerEmail,
      })
    } catch (e) {
      console.error('[pos] cobrarConQr intent', e)
      // La venta queda Pendiente: se ve en el historial y se anula. No se
      // deja huérfana ni se cobra a ciegas.
      return fail('No se pudo crear el pago con Wompi. La venta quedó pendiente para anular.')
    }

    const { error: payError } = await admin
      .from('pos_payments')
      .insert({
        org_id: member.orgId,
        sale_id: row.sale_id,
        provider: gateway.provider,
        status: 'Pendiente',
        amount_cents: row.sale_total_cents,
        reference: row.sale_code,
        external_id: intent.id,
      })

    if (payError) {
      console.error('[pos] cobrarConQr payment row', payError)
      return fail('La venta quedó pendiente pero no se pudo registrar el pago en línea. Anúlala.')
    }

    const refresh = await refreshed()
    if (!refresh.ok) return refresh

    return {
      ok: true,
      data: {
        ...refresh.data,
        qr: {
          saleId: row.sale_id,
          saleCode: row.sale_code,
          amountCents: row.sale_total_cents,
          qrUrl: intent.qrUrl,
          redirectUrl: intent.redirectUrl,
        },
      },
    }
  } catch {
    return fail(DENIED)
  }
}

const receiptPrefsSchema = z.object({
  width: z.number().int().refine((w) => w === 58 || w === 80, 'Ancho de papel desconocido.'),
  footer: z.string().trim().max(120).default('Gracias por su compra'),
  showLogo: z.boolean().default(true),
})

/**
 * Guarda las preferencias del recibo.
 *
 * jsonb en `organizations`, no tabla aparte: son tres valores que viajan con
 * la empresa, y la forma la valida el zod de aquí. `pos:write` basta — es
 * configuración operativa del mostrador, no de la cuenta.
 */
export async function saveReceiptPrefs(
  input: z.input<typeof receiptPrefsSchema>,
): Promise<PosResult<PosData>> {
  try {
    const member = await requirePermission('pos:write')
    const parsed = receiptPrefsSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('organizations')
      .update({ receipt_prefs: parsed.data })
      .eq('id', member.orgId)

    if (error) {
      console.error('[pos] saveReceiptPrefs', error)
      return fail('No se pudieron guardar las preferencias del recibo.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}
