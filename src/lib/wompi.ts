import { createHash } from 'node:crypto'

/**
 * Cliente mínimo de Wompi: intención de pago y verificación de eventos.
 *
 * Solo lo que el POS necesita. La intención la crea una server action (que es
 * quien puede leer la llave privada del vault); la verificación la usa el
 * webhook, que es el único camino por el que una venta pasa a Pagada.
 *
 * Firma de eventos (docs de Wompi): el evento trae `signature.properties`,
 * una lista de rutas en orden; el checksum es el SHA-256 de la concatenación
 * de los VALORES de esas rutas (en ese orden), luego el secreto de eventos y
 * por último el `timestamp` del evento. Si cualquiera de las propiedades no
 * existe, el evento no es válido.
 */

export interface WompiIntent {
  /** id de la transacción en Wompi: el external_id que el webhook devuelve. */
  id: string
  /** URL con el QR de Bancolombia, cuando el método lo devuelve. */
  qrUrl: string | null
  /** URL de redirección al checkout de Wompi. */
  redirectUrl: string | null
}

function wompiBase(): string {
  // Sandbox en desarrollo para poder probar con llaves de prueba; producción
  // real en producción.
  return process.env.NODE_ENV === 'production'
    ? 'https://production.wompi.co'
    : 'https://sandbox.wompi.co'
}

/** El token de aceptación, requisito legal del checkout de Wompi. */
async function acceptanceToken(privateKey: string, publicKey: string): Promise<string> {
  const res = await fetch(`${wompiBase()}/v1/merchants/${publicKey}`, {
    headers: { Authorization: `Bearer ${privateKey}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`wompi:merchant:${res.status}`)
  }
  const body = (await res.json()) as {
    data?: { presigned_acceptance?: string; presigned_acceptance_token?: string }
  }
  const token = body.data?.presigned_acceptance_token
  if (!token) throw new Error('wompi:merchant:no-acceptance-token')
  return token
}

/**
 * Crea una transacción de pago. Devuelve el id y, si el método lo produce, la
 * URL del QR; siempre devuelve además la URL de redirección como plan B para
 * pagar desde el navegador del propio teléfono.
 */
export async function wompiCreatePaymentIntent(input: {
  privateKey: string
  publicKey: string
  amountCents: number
  reference: string
  customerEmail: string
}): Promise<WompiIntent> {
  const token = await acceptanceToken(input.privateKey, input.publicKey)

  const res = await fetch(`${wompiBase()}/v1/transactions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.privateKey}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({
      acceptance_token: token,
      amount_in_cents: input.amountCents,
      currency: 'COP',
      customer_email: input.customerEmail,
      reference: input.reference,
      payment_method: { type: 'BANCOLOMBIA_QR' },
      redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/pos`,
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`wompi:transaction:${res.status}:${detail.slice(0, 120)}`)
  }

  const body = (await res.json()) as {
    data?: {
      id?: string
      redirect_url?: string
      payment_method?: { extra?: { qr_url?: string } }
    }
  }
  const data = body.data
  const id = data?.id
  if (!id) throw new Error('wompi:transaction:no-id')

  return {
    id,
    qrUrl: data.payment_method?.extra?.qr_url ?? null,
    redirectUrl: data.redirect_url ?? null,
  }
}

export interface WompiEvent {
  eventType: string
  transactionId: string | null
  status: string | null
  timestamp: number | null
}

/** Lee un valor por ruta de puntos (a.b.c) dentro de un objeto JSON. */
function dotGet(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[key]
  }, obj)
}

/** La representación que Wompi usa para firmar cada valor. */
function wompiStringify(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

/**
 * Verifica la firma del evento contra el secreto de eventos.
 *
 * Devuelve null si el evento no es verificable (firma ausente, propiedad
 * faltante o checksum distinto) — el webhook responde 401 sin decir más.
 */
export function verifyWompiEvent(raw: string, secret: string): WompiEvent | null {
  let event: Record<string, unknown>
  try {
    event = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }

  const signature = event.signature as
    | { properties?: unknown; checksum?: unknown }
    | undefined
  const properties = signature?.properties
  const checksum = signature?.checksum
  const timestamp = event.timestamp

  if (!Array.isArray(properties) || typeof checksum !== 'string' || typeof timestamp !== 'number') {
    return null
  }

  let concat = ''
  for (const prop of properties) {
    if (typeof prop !== 'string') return null
    // Las rutas de signature.properties se resuelven contra `data`, no
    // contra la raíz del evento (p. ej. "transaction.id").
    const value = dotGet(event.data, prop)
    if (value === undefined) return null
    concat += wompiStringify(value)
  }
  concat += secret
  concat += String(timestamp)

  const expected = createHash('sha256').update(concat, 'utf8').digest('hex')
  if (expected.toLowerCase() !== checksum.toLowerCase()) return null

  const data = event.data as { transaction?: { id?: string; status?: string } } | undefined

  return {
    eventType: typeof event.event === 'string' ? event.event : '',
    transactionId: data?.transaction?.id ?? null,
    status: data?.transaction?.status ?? null,
    timestamp,
  }
}
