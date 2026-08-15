import { createAdminClient } from '@/lib/supabase/admin'
import type { WompiEvent } from '@/lib/wompi'

/**
 * La aplicación de un evento de pago: lo que hace el webhook una vez la
 * firma está verificada.
 *
 * Vive aparte del webhook porque la SIMULACIÓN usa el mismo camino: la ruta
 * /api/wompi/simulate ocupa el lugar del proveedor — el único que en la vida
 * real firmaría el evento — y aplica exactamente esta función. Así, lo que se
 * prueba en simulado es lo que correrá con Wompi real: la única diferencia es
 * quién firma.
 *
 * Reglas:
 *   · un evento de transacción desconocida no es un error: se responde 200
 *     sin aplicar (nada que confirmar), pero no se pierde en silencio;
 *   · el evento se sella una sola vez (unique(event_id)) y los RPC de
 *     confirmación son idempotentes por sí mismos;
 *   · APPROVED es lo único que paga; los terminales negativos dejan la
 *     venta Pendiente para anularla a mano.
 */

export interface ApplyResult {
  applied: boolean
  /** true si el evento se registró pero no cambia nada (p. ej. PENDING). */
  recorded: boolean
  error?: string
}

export async function applyWompiEvent(event: WompiEvent): Promise<ApplyResult> {
  if (event.eventType !== 'transaction.updated' || !event.transactionId) {
    return { applied: false, recorded: false }
  }

  const supabase = createAdminClient()

  const { data: payment } = await supabase
    .from('pos_payments')
    .select('id, event_id, status')
    .eq('external_id', event.transactionId)
    .maybeSingle()

  if (!payment) {
    console.warn('[wompi] transacción desconocida', event.transactionId)
    return { applied: false, recorded: false }
  }

  if (!payment.event_id) {
    const { error: stampError } = await supabase
      .from('pos_payments')
      .update({ event_id: `${event.eventType}:${event.transactionId}` })
      .eq('id', payment.id)
      .is('event_id', null)

    if (stampError) {
      console.error('[wompi] stamp event', stampError)
      return { applied: false, recorded: false, error: 'could not record event' }
    }
  }

  const eventId = payment.event_id ?? `${event.eventType}:${event.transactionId}`

  const approved = event.status === 'APPROVED'
  const declined = ['DECLINED', 'ERROR', 'VOIDED', 'REJECTED'].includes(event.status ?? '')
  const rpc = approved ? 'confirm_pos_payment' : declined ? 'reject_pos_payment' : null

  if (!rpc) {
    return { applied: false, recorded: true } // p. ej. PENDING: aún no resuelve
  }

  const { error } = await supabase.rpc(rpc, { p_event_id: eventId })
  if (error) {
    console.error(`[wompi] ${rpc}`, error)
    return { applied: false, recorded: true, error: 'could not apply event' }
  }

  return { applied: true, recorded: true }
}
