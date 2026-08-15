import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { verifyWompiEvent } from '@/lib/wompi'

/**
 * La firma de Wompi es un checksum determinista: concatenación de los valores
 * de signature.properties (en orden), el secreto de eventos y el timestamp,
 * todo en SHA-256. Se puede verificar sin llamar a Wompi — y conviene, porque
 * es exactamente la puerta por la que una venta pasa a Pagada.
 */

function signEvent(event: Record<string, unknown>, secret: string): string {
  const props = (event.signature as { properties: string[] }).properties
  const concat = props.map((p) => String(dot(event.data, p))).join('') + secret + String(event.timestamp)
  return createHash('sha256').update(concat, 'utf8').digest('hex')
}

function dot(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[key]
  }, obj)
}

function makeEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const event: Record<string, unknown> = {
    event: 'transaction.updated',
    timestamp: 1723670000,
    data: {
      transaction: {
        id: 'txn-123',
        status: 'APPROVED',
        amount_in_cents: 5000,
        reference: 'VTA-00042',
      },
    },
    signature: {
      properties: [
        'transaction.id',
        'transaction.status',
        'transaction.amount_in_cents',
        'transaction.reference',
      ],
      checksum: '',
    },
    ...overrides,
  }
  ;(event.signature as { checksum: string }).checksum = signEvent(event, 'events-secret')
  return event
}

describe('verifyWompiEvent', () => {
  it('acepta un evento firmado correctamente', () => {
    const verified = verifyWompiEvent(JSON.stringify(makeEvent()), 'events-secret')
    expect(verified).not.toBeNull()
    expect(verified?.eventType).toBe('transaction.updated')
    expect(verified?.transactionId).toBe('txn-123')
    expect(verified?.status).toBe('APPROVED')
  })

  it('rechaza un checksum que no corresponde al secreto', () => {
    expect(verifyWompiEvent(JSON.stringify(makeEvent()), 'otro-secreto')).toBeNull()
  })

  it('rechaza un evento sin firma', () => {
    const event = makeEvent()
    delete event.signature
    expect(verifyWompiEvent(JSON.stringify(event), 'events-secret')).toBeNull()
  })

  it('rechaza una propiedad faltante aunque el resto cuadre', () => {
    const event = makeEvent()
    ;(event.data as { transaction: Record<string, unknown> }).transaction = {
      id: 'txn-123',
      status: 'APPROVED',
    } as never // sin amount_in_cents ni reference
    expect(verifyWompiEvent(JSON.stringify(event), 'events-secret')).toBeNull()
  })

  it('rechaza JSON que no es objeto', () => {
    expect(verifyWompiEvent('no-es-json', 'events-secret')).toBeNull()
  })
})
