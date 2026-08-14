import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { SIGNATURE_HEADER, manualProvider } from './provider'

const SECRET = 'un-secreto-de-pruebas-suficientemente-largo'
const provider = manualProvider(SECRET)

function sign(body: string, secret = SECRET): Headers {
  return new Headers({
    [SIGNATURE_HEADER]: createHmac('sha256', secret).update(body, 'utf8').digest('hex'),
  })
}

describe('verifying that a body came from the provider', () => {
  it('accepts a body signed with the secret', () => {
    const body = JSON.stringify({ event_id: 'evt_1', kind: 'subscription.updated' })
    expect(provider.verify(body, sign(body))).toBe(true)
  })

  it('refuses a body signed with a different secret', () => {
    const body = JSON.stringify({ event_id: 'evt_1', kind: 'subscription.updated' })
    expect(provider.verify(body, sign(body, 'otro-secreto-cualquiera-largo'))).toBe(false)
  })

  /**
   * The attack this exists to stop: a real signature over a real event, reused
   * over a body that says something else — "cancel" becoming "enterprise".
   */
  it('refuses a body that changed after it was signed', () => {
    const original = JSON.stringify({ event_id: 'evt_1', kind: 'x', plan: 'starter' })
    const tampered = JSON.stringify({ event_id: 'evt_1', kind: 'x', plan: 'enterprise' })
    expect(provider.verify(tampered, sign(original))).toBe(false)
  })

  it('refuses a body with no signature at all', () => {
    expect(provider.verify('{}', new Headers())).toBe(false)
  })

  it('refuses a signature that is not even hex', () => {
    expect(provider.verify('{}', new Headers({ [SIGNATURE_HEADER]: 'no' }))).toBe(false)
  })

  /**
   * A provider built without a secret must refuse everything rather than accept
   * everything. The route already returns 503 before reaching here; this is the
   * second answer to the same question, because the first one is one `if` away
   * from being deleted by somebody refactoring.
   */
  it('refuses everything when there is no secret', () => {
    const orphan = manualProvider('')
    const body = '{}'
    expect(orphan.verify(body, sign(body, ''))).toBe(false)
  })
})

describe('reading what the event says', () => {
  it('reduces a full payload to a BillingEvent', () => {
    const event = provider.parse(JSON.stringify({
      event_id: 'evt_9',
      kind: 'subscription.updated',
      account_id: '0d1e6d4a-3f2b-4a3c-9e2f-8b7c6d5e4f3a',
      plan: 'growth',
      status: 'active',
    }))

    expect(event).toMatchObject({
      eventId: 'evt_9',
      kind: 'subscription.updated',
      accountId: '0d1e6d4a-3f2b-4a3c-9e2f-8b7c6d5e4f3a',
      plan: 'growth',
      status: 'active',
    })
  })

  /**
   * A plan this build does not know must not reach `apply_subscription`, which
   * would refuse it anyway — but as an exception recorded against the event
   * rather than a null the log can explain.
   */
  it('drops a plan that is not one of ours', () => {
    const event = provider.parse(JSON.stringify({
      event_id: 'evt_9', kind: 'x', plan: 'ultra',
    }))
    expect(event?.plan).toBeNull()
  })

  it('accepts an event that carries no subscription change', () => {
    const event = provider.parse(JSON.stringify({ event_id: 'evt_9', kind: 'ping' }))
    expect(event).toMatchObject({ eventId: 'evt_9', plan: null, status: null, accountId: null })
  })

  /**
   * Without an id there is no idempotency: a synthetic one would make every
   * retry of the same delivery look like a new event, which is precisely the
   * failure the unique constraint exists to prevent.
   */
  it('refuses an event with no id', () => {
    expect(provider.parse(JSON.stringify({ kind: 'subscription.updated' }))).toBeNull()
  })

  it('refuses an event with no kind', () => {
    expect(provider.parse(JSON.stringify({ event_id: 'evt_9' }))).toBeNull()
  })

  it('refuses a body that is not an object', () => {
    expect(provider.parse('"texto"')).toBeNull()
    expect(provider.parse('null')).toBeNull()
    expect(provider.parse('[]')).toBeNull()
  })

  it('refuses a body that is not JSON', () => {
    expect(provider.parse('<html>502</html>')).toBeNull()
  })

  it('keeps the original body, so a mistake here is recoverable', () => {
    const raw = { event_id: 'evt_9', kind: 'x', extra: { anidado: true } }
    expect(provider.parse(JSON.stringify(raw))?.raw).toEqual(raw)
  })
})
