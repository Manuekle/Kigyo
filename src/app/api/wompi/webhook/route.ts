import { wompiEventsSecret } from '@/lib/env'
import { verifyWompiEvent } from '@/lib/wompi'
import { applyWompiEvent } from '@/lib/wompi-apply'

/**
 * Webhook de Wompi para los pagos en línea del POS.
 *
 * Mismo contrato que el webhook de billing, porque los proveedores se
 * comportan igual: verificar la firma ANTES de parsear y de tocar la base,
 * responder 200 a lo registrado aunque no se pueda aplicar, y 500 solo a lo
 * transitorio (así el proveedor reintenta solo lo que tiene sentido).
 *
 * Un evento sin firma válida recibe 401 y nada más: no es un oráculo.
 * Sin WOMPI_EVENTS_SECRET responde 503 — un endpoint que marca ventas como
 * pagadas no puede correr sin poder distinguir a Wompi de cualquiera.
 *
 * En modo simulado esta ruta no recibe tráfico real: la simulación firma por
 * dentro (/api/wompi/simulate), que es exactamente el lugar del proveedor.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const secret = wompiEventsSecret()

  if (!secret) {
    console.error('[wompi] WOMPI_EVENTS_SECRET is not configured')
    return Response.json({ error: 'payments not configured' }, { status: 503 })
  }

  const raw = await request.text()
  const event = verifyWompiEvent(raw, secret)
  if (!event) {
    return Response.json({ error: 'invalid signature' }, { status: 401 })
  }

  const result = await applyWompiEvent(event)
  if (result.error) {
    // Genuinamente transitorio: el proveedor debe reintentar.
    return Response.json({ error: result.error }, { status: 500 })
  }
  return Response.json({ ok: true, applied: result.applied })
}
