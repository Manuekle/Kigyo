'use server'

import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
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