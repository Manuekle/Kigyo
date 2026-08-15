import { createAdminClient } from '@/lib/supabase/admin'
import { wompiEventsSecret } from '@/lib/env'
import { verifyWompiEvent } from '@/lib/wompi'

/**
 * Webhook de Wompi para los pagos en línea del POS.
 *
 * Mismo contrato que el webhook de billing, porque los proveedores se
 * comportan igual: verificar la firma ANTES de parsear y de tocar la base,
 * responder 200 a lo registrado aunque no se pueda aplicar, y 500 solo a lo
 * transitorio (así el proveedor reintenta solo lo que tiene sentido).
 *
 * La idempotencia es doble:
 *   · `pos_payments.event_id` es único: dos entregas del mismo evento no
 *     pueden confirmar dos veces.
 *   · `confirm_pos_payment` (migración 84) es idempotente por sí mismo.
 *
 * El match evento → pago es por `external_id` (el id de la transacción en
 * Wompi, guardado al crear la intención). Si el evento nombra una transacción
 * desconocida, se responde 200 sin aplicar: la fila de la intención no existe
 * y no hay nada que confirmar — pero el evento no se pierde en silencio, se
 * registra en logs.
 *
 * Un evento sin firma válida recibe 401 y nada más: no es un oráculo.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const secret = wompiEventsSecret()

  // Sin secreto no hay forma de distinguir a Wompi de cualquiera, y un
  // endpoint que marca ventas como pagadas no puede correr en ese estado.
  if (!secret) {
    console.error('[wompi] WOMPI_EVENTS_SECRET is not configured')
    return Response.json({ error: 'payments not configured' }, { status: 503 })
  }

  const raw = await request.text()
  const event = verifyWompiEvent(raw, secret)
  if (!event) {
    return Response.json({ error: 'invalid signature' }, { status: 401 })
  }

  // Solo los eventos de transacción que cambian un estado nos importan; el
  // resto (envíos de prueba, otros eventos) responden 200 sin tocar nada.
  if (event.eventType !== 'transaction.updated' || !event.transactionId) {
    return Response.json({ ok: true, applied: false })
  }

  const supabase = createAdminClient()

  // El pago se encuentra por la transacción que lo originó.
  const { data: payment } = await supabase
    .from('pos_payments')
    .select('id, event_id, status')
    .eq('external_id', event.transactionId)
    .maybeSingle()

  if (!payment) {
    // Transacción que este servidor no conoce: nada que aplicar. 200.
    console.warn('[wompi] transacción desconocida', event.transactionId)
    return Response.json({ ok: true, applied: false })
  }

  // Registrar el evento la primera vez: el unique(event_id) es el candado.
  if (!payment.event_id) {
    const { error: stampError } = await supabase
      .from('pos_payments')
      .update({ event_id: `${event.eventType}:${event.transactionId}` })
      .eq('id', payment.id)
      .is('event_id', null)

    if (stampError) {
      console.error('[wompi] stamp event', stampError)
      return Response.json({ error: 'could not record event' }, { status: 500 })
    }
  }

  const eventId = payment.event_id ?? `${event.eventType}:${event.transactionId}`

  // APPROVED es lo único que paga. Los estados terminales negativos dejan la
  // venta Pendiente para anularla a mano; VOIDED la anula el rechazo del
  // proveedor y el cajero la ve en el historial.
  const approved = event.status === 'APPROVED'
  const declined = ['DECLINED', 'ERROR', 'VOIDED', 'REJECTED'].includes(event.status ?? '')

  const rpc = approved ? 'confirm_pos_payment' : declined ? 'reject_pos_payment' : null
  if (!rpc) {
    return Response.json({ ok: true, applied: false }) // p. ej. PENDING: aún no resuelve
  }

  const { error } = await supabase.rpc(rpc, { p_event_id: eventId })
  if (error) {
    console.error(`[wompi] ${rpc}`, error)
    // Genuinamente transitorio (p. ej. caída del RPC): reintenta.
    return Response.json({ error: 'could not apply event' }, { status: 500 })
  }

  return Response.json({ ok: true, applied: true })
}
