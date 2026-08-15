import { paymentsSimulated } from '@/lib/wompi'
import { applyWompiEvent } from '@/lib/wompi-apply'
import { hasPermission } from '@/lib/auth/session'

/**
 * Simulación del proveedor de pagos.
 *
 * Ocupa el lugar de Wompi: en la vida real el único que confirma un pago es
 * el proveedor, firmando el evento con su secreto. Aquí, en modo simulado,
 * esta ruta ES el proveedor y aplica el mismo camino que el webhook real
 * (`applyWompiEvent`) — lo que se prueba es exactamente lo que correrá con
 * Wompi, con la única diferencia de quién firma.
 *
 * Solo existe en modo simulado; producción demo exige PAYMENTS_DEMO=true.
 * Con WOMPI_REAL=true responde 404 y la confirmación vuelve a ser asunto
 * exclusivo del webhook firmado.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const allowed = paymentsSimulated()
    && (process.env.NODE_ENV !== 'production' || process.env.PAYMENTS_DEMO === 'true')
  if (!allowed) {
    return Response.json({ error: 'not available' }, { status: 404 })
  }

  if (!await hasPermission('pos:write')) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: { transactionId?: string; status?: string }
  try {
    body = (await request.json()) as { transactionId?: string; status?: string }
  } catch {
    return Response.json({ error: 'unreadable body' }, { status: 400 })
  }

  if (!body.transactionId || !body.status || !['APPROVED', 'DECLINED'].includes(body.status)) {
    return Response.json({ error: 'transactionId and status are required' }, { status: 400 })
  }

  const result = await applyWompiEvent({
    eventType: 'transaction.updated',
    transactionId: body.transactionId,
    status: body.status,
    timestamp: Date.now(),
  })

  if (result.error) {
    return Response.json({ error: result.error }, { status: 500 })
  }
  return Response.json({ ok: true, applied: result.applied })
}
