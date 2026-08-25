'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { maybePostAutoEntry } from '@/server/contabilidad-auto'
import { invoiceTotals, netFromGross, todayIn } from '@/lib/domain'
import type { PedidosData, OrderStatus } from '@/server/queries/pedidos'
import { getPedidos } from '@/server/queries/pedidos'

export type OrderResult = { ok: true; data: PedidosData } | { ok: false; error: string }

function friendly(error: { message?: string; code?: string } | null, fallback: string): string {
  if (!error) return fallback
  const msg = error.message ?? ''
  // The RPC raises these errcodes with a human message already.
  if (/KG1\d\d|P0001/.test(error.code ?? '')) return msg
  return fallback
}

/** Cotización aceptada → pedido Confirmado, copiando líneas con origen. */
export async function createOrderFromQuote(
  quoteId: string,
  opts?: {
    issuedOn?: string
    dueOn?: string | null
    paymentTerms?: string
    shippingAddress?: string
    notes?: string
  },
): Promise<OrderResult> {
  const member = await requirePermission('pedidos:write')
  if (!member) return { ok: false, error: 'No tienes permiso para crear pedidos.' }

  const supabase = await createClient()
  const { data: orderId, error } = await supabase.rpc('create_order_from_quote', {
    p_quote_id: quoteId,
    p_issued_on: opts?.issuedOn ?? null,
    p_due_on: opts?.dueOn ?? null,
    p_payment_terms: opts?.paymentTerms ?? '',
    p_shipping_address: opts?.shippingAddress ?? '',
    p_notes: opts?.notes ?? '',
  })

  if (error || !orderId) {
    console.error('[pedidos] createOrderFromQuote', error)
    return {
      ok: false,
      error: friendly(
        error,
        'No se pudo generar el pedido. Verifica que la cotización esté aceptada.',
      ),
    }
  }

  return { ok: true, data: await getPedidos() }
}

/** Avanza un pedido por su ciclo: estado siguiente o el indicado. */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<OrderResult> {
  const member = await requirePermission('pedidos:write')
  if (!member) return { ok: false, error: 'No tienes permiso para gestionar pedidos.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('sales_orders')
    .update({ status })
    .eq('id', orderId)
    .eq('org_id', member.orgId)
    .is('deleted_at', null)

  if (error) {
    console.error('[pedidos] updateOrderStatus', error)
    return { ok: false, error: 'No se pudo actualizar el estado del pedido.' }
  }

  return { ok: true, data: await getPedidos() }
}

/** Soft delete: el pedido desaparece de la lista pero conserva su historial. */
export async function deletePedido(orderId: string): Promise<OrderResult> {
  const member = await requirePermission('pedidos:write')
  if (!member) return { ok: false, error: 'No tienes permiso para eliminar pedidos.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('sales_orders')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('org_id', member.orgId)
    .is('deleted_at', null)

  if (error) {
    console.error('[pedidos] deletePedido', error)
    return { ok: false, error: 'No se pudo eliminar el pedido.' }
  }

  return { ok: true, data: await getPedidos() }
}
/* ═══════════════════════════════════════════════════════════════════════════
 * Facturar un pedido
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * El eslabón que faltaba. La cadena comercial iba
 *
 *     cliente → cotización → Aceptada → pedido → ✗
 *
 * y ahí se acababa: `invoices.sales_order_id` existe desde la migración 98, con
 * su FK y su guardia anti-cruce de empresa (`invoices_order_same_org`), y
 * **ningún archivo del repositorio la nombraba** — 0 lecturas, 0 escrituras.
 * Quien vendía por pedido tenía que reescribir la factura línea a línea en otra
 * pantalla, y el enlace entre las dos no existía en ninguna parte.
 *
 * ─── El IVA, que es donde esto se rompe si se hace de memoria ──────────────
 *
 * Las dos mitades de la cadena guardan el precio con significados distintos, y
 * los dos son correctos (migración 104):
 *
 *     cotización / pedido   unit_price_cents = precio CON IVA, sin desglose
 *     factura               unit_price_cents = precio SIN IVA + tax_rate
 *
 * El pedido hereda de la cotización, que copia `products.price_cents` tal cual
 * —y esa columna es el precio de góndola, con IVA dentro—. La factura suma
 * `total = subtotal + tax`. Copiar la línea del pedido a la factura sin
 * convertir cobraría el 19% dos veces: exactamente el error que la migración
 * 104 encontró y arregló en `facturacion/client.tsx`, reintroducido por la
 * puerta de al lado.
 *
 * Así que se convierte, con la misma función que usa la pantalla de
 * facturación: `netFromGross(bruto, tasa)`. La tasa sale del producto del
 * catálogo cuando la línea tiene uno, y es 0 cuando no —una línea de texto
 * libre («50 horas de consultoría») no tiene tasa que heredar y suponerle 19%
 * sería inventarle un impuesto—.
 *
 * El total puede quedar a uno o dos pesos del total del pedido, porque la
 * factura redondea por línea para que la suma de lo impreso cuadre con el
 * total impreso. Se prefiere eso a que la factura no cuadre consigo misma.
 */

const INVOICE_STATUS_AT_BIRTH = 'Borrador'

export async function facturarPedido(orderId: string): Promise<OrderResult> {
  let member
  try {
    // Crea una factura, así que el permiso que pide es el de facturación —
    // `pedidos:write` deja mover un pedido por su ciclo, no emitir un
    // documento fiscal. Quien solo tenga uno de los dos no pasa de aquí.
    member = await requirePermission('facturacion:write')
  } catch {
    return { ok: false, error: 'No tienes permiso para facturar, o el módulo de Facturación está apagado.' }
  }

  const supabase = await createClient()

  /**
   * El pedido con sus líneas.
   *
   * Tipado a mano por el mismo motivo que `ORDER_COLUMNS` en la capa de
   * consultas: el alias `items:` sobre la relación deja a supabase-js
   * infiriendo `GenericStringError` en vez de la fila, y el cast es lo que ya
   * hace el resto del módulo.
   */
  type OrderToInvoice = {
    id: string
    code: string | null
    client_id: string | null
    client_name: string
    status: OrderStatus
    issued_on: string
    due_on: string | null
    notes: string
    items: Array<{
      product_id: string | null
      description: string
      quantity: number
      unit_price_cents: number
      position: number
    }> | null
  }

  const { data: orderRow, error: orderError } = await supabase
    .from('sales_orders')
    .select(
      'id, code, client_id, client_name, status, issued_on, due_on, notes, ' +
        'items: sales_order_items ( product_id, description, quantity, unit_price_cents, position )',
    )
    .eq('id', orderId)
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (orderError || !orderRow) {
    console.error('[pedidos] facturarPedido order', orderError)
    return { ok: false, error: 'Ese pedido no existe en tu empresa.' }
  }

  const order = orderRow as unknown as OrderToInvoice

  if (order.status === 'Cancelado') {
    return { ok: false, error: 'Un pedido cancelado no se factura.' }
  }

  const items = order.items ?? []
  if (items.length === 0) {
    return { ok: false, error: 'El pedido no tiene líneas que facturar.' }
  }

  /**
   * Ya facturado.
   *
   * Se pregunta antes de escribir y no se confía solo en eso: dos pestañas
   * pueden pasar la comprobación a la vez. Lo que hace que la carrera sea
   * inofensiva es que el resultado son dos borradores enlazados al mismo
   * pedido, visibles los dos en la lista — no una factura emitida por
   * duplicado. Un índice único sobre `sales_order_id` sería la respuesta
   * definitiva y también prohibiría la factura parcial, que es una cosa que
   * las empresas hacen, así que no se pone.
   */
  const { data: already } = await supabase
    .from('invoices')
    .select('id, code')
    .eq('org_id', member.orgId)
    .eq('sales_order_id', orderId)
    .is('deleted_at', null)
    .maybeSingle()

  if (already) {
    return {
      ok: false,
      error: `Este pedido ya tiene la factura ${already.code ?? 'creada'}.`,
    }
  }

  // Las tasas del catálogo, en una sola consulta. Una línea sin producto —o
  // con un producto ya borrado— se factura exenta.
  const productIds = [...new Set(items.map((i) => i.product_id).filter((id): id is string => id !== null))]
  const rates = new Map<string, number>()
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('id, tax_rate')
      .eq('org_id', member.orgId)
      .in('id', productIds)
    for (const p of (products ?? []) as Array<{ id: string; tax_rate: number | null }>) {
      rates.set(p.id, Number(p.tax_rate ?? 0))
    }
  }

  const lines = items
    .sort((a, b) => a.position - b.position)
    .map((item) => {
      const rate = item.product_id ? rates.get(item.product_id) ?? 0 : 0
      return {
        productId: item.product_id,
        description: item.description,
        quantity: Number(item.quantity),
        unitPriceCents: netFromGross(item.unit_price_cents, rate),
        taxRate: rate,
      }
    })

  const { subtotal, tax, total } = invoiceTotals(lines)
  const today = todayIn(member.orgTimezone)

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      org_id: member.orgId,
      sales_order_id: order.id,
      client_id: order.client_id,
      // Igual que en `createFactura`: el nombre viaja copiado para que la
      // factura siga diciendo a quién se emitió aunque la ficha se borre.
      client_name: order.client_name,
      status: INVOICE_STATUS_AT_BIRTH,
      // Hoy, no la fecha del pedido: la factura se emite cuando se emite, y
      // fechar hacia atrás un documento fiscal no es una comodidad.
      issued_on: today,
      due_on: order.due_on,
      subtotal_cents: subtotal,
      tax_cents: tax,
      total_cents: total,
      currency: 'COP',
      notes: order.code ? `Pedido ${order.code}` : '',
    })
    .select('id, code')
    .single()

  if (invoiceError || !invoice) {
    console.error('[pedidos] facturarPedido invoice', invoiceError)
    return { ok: false, error: 'No se pudo crear la factura del pedido.' }
  }

  const { error: itemsError } = await supabase.from('invoice_items').insert(
    lines.map((line, index) => ({
      invoice_id: invoice.id,
      product_id: line.productId,
      description: line.description,
      quantity: line.quantity,
      unit_price_cents: line.unitPriceCents,
      tax_rate: line.taxRate,
      position: index,
    })),
  )

  if (itemsError) {
    console.error('[pedidos] facturarPedido items', itemsError)
    // Mismo desmontaje a mano que `createFactura`: una cabecera sin líneas
    // imprime un total que nada sostiene, y PostgREST no da transacción entre
    // dos llamadas.
    await supabase.from('invoices').delete().eq('id', invoice.id).eq('org_id', member.orgId)
    return { ok: false, error: 'No se pudieron copiar las líneas del pedido a la factura.' }
  }

  // Venta a crédito: nace la cuenta por cobrar, igual que al facturar a mano.
  // `post_auto_entry` es idempotente por (source, source_id).
  if (order.due_on) {
    await maybePostAutoEntry(
      member, 'venta_credito', 'Venta', invoice.id,
      `Factura ${order.client_name}`, today, total,
    )
  }

  revalidatePath('/dashboard/facturacion')
  revalidatePath('/dashboard/cartera')
  return { ok: true, data: await getPedidos() }
}
