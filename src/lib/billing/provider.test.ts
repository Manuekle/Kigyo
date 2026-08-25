import { createHmac } from 'node:crypto'
import { Webhook } from 'standardwebhooks'
import { describe, expect, it } from 'vitest'
import { SIGNATURE_HEADER, manualProvider, polarProvider } from './provider'

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
    }), new Headers())

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
    }), new Headers())
    expect(event?.plan).toBeNull()
  })

  it('accepts an event that carries no subscription change', () => {
    const event = provider.parse(JSON.stringify({ event_id: 'evt_9', kind: 'ping' }), new Headers())
    expect(event).toMatchObject({ eventId: 'evt_9', plan: null, status: null, accountId: null })
  })

  /**
   * Without an id there is no idempotency: a synthetic one would make every
   * retry of the same delivery look like a new event, which is precisely the
   * failure the unique constraint exists to prevent.
   */
  it('refuses an event with no id', () => {
    expect(provider.parse(JSON.stringify({ kind: 'subscription.updated' }), new Headers())).toBeNull()
  })

  it('refuses an event with no kind', () => {
    expect(provider.parse(JSON.stringify({ event_id: 'evt_9' }), new Headers())).toBeNull()
  })

  it('refuses a body that is not an object', () => {
    expect(provider.parse('"texto"', new Headers())).toBeNull()
    expect(provider.parse('null', new Headers())).toBeNull()
    expect(provider.parse('[]', new Headers())).toBeNull()
  })

  it('refuses a body that is not JSON', () => {
    expect(provider.parse('<html>502</html>', new Headers())).toBeNull()
  })

  it('keeps the original body, so a mistake here is recoverable', () => {
    const raw = { event_id: 'evt_9', kind: 'x', extra: { anidado: true } }
    expect(provider.parse(JSON.stringify(raw), new Headers())?.raw).toEqual(raw)
  })
})

describe('polarProvider', () => {
  const POLAR_SECRET = 'un-secreto-de-polar-de-prueba'
  // Same transformation `polarProvider` applies internally, so a fixture
  // signed here verifies against it — see the comment on `polarProvider`
  // for why the secret is re-encoded rather than passed through.
  const signer = new Webhook(Buffer.from(POLAR_SECRET, 'utf-8').toString('base64'))

  function polarHeaders(id: string, body: string, secret = signer): Headers {
    const timestamp = new Date()
    return new Headers({
      'webhook-id': id,
      'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
      'webhook-signature': secret.sign(id, timestamp, body),
    })
  }

  const provider = polarProvider(POLAR_SECRET, (productId) =>
    productId === 'prod_growth' ? 'growth' : null,
  )

  it('accepts a body signed with the secret', () => {
    const body = JSON.stringify({ type: 'ping' })
    expect(provider.verify(body, polarHeaders('msg_1', body))).toBe(true)
  })

  it('refuses a body signed with a different secret', () => {
    const other = new Webhook(Buffer.from('otro-secreto-largo', 'utf-8').toString('base64'))
    const body = JSON.stringify({ type: 'ping' })
    expect(provider.verify(body, polarHeaders('msg_1', body, other))).toBe(false)
  })

  it('refuses a body with no signature headers at all', () => {
    expect(provider.verify('{}', new Headers())).toBe(false)
  })

  /**
   * Un evento que no va de suscripciones no es un error.
   *
   * El cuerpo de abajo es un `organization.updated` real, tal como Polar lo
   * envió el 2026-08-25 (recortado a lo que la función mira). La versión
   * anterior lo marcaba en la bitácora con el error «el evento no nombra una
   * cuenta de Kigyo», que es falso y además caro: los procesadores mandan
   * muchos más eventos de los que cambian un plan, así que la bitácora se
   * llenaba de errores inventados y el error de verdad —un evento de
   * suscripción que nombra una cuenta inexistente— quedaba enterrado entre
   * ellos justo el día que hay que encontrarlo.
   */
  it('marca como ajeno a suscripciones un organization.updated', () => {
    const body = JSON.stringify({
      type: 'organization.updated',
      data: {
        id: '8e199cab-80e8-4982-95a5-e9d090be73d0',
        name: 'kigyo',
        status: 'created',
        country: 'CO',
        capabilities: { checkout_payments: false, api_access: true },
      },
    })
    const event = provider.parse(body, polarHeaders('msg_org', body))
    expect(event).toMatchObject({
      kind: 'organization.updated',
      aboutSubscription: false,
      accountId: null,
      plan: null,
      status: null,
    })
  })

  /**
   * `data.status` de una organización NO es el estado de una suscripción.
   *
   * El payload real trae `"status": "created"` en la raíz de `data`. Si la
   * función mirara el estado sin comprobar antes de qué habla el evento, ese
   * valor entraría en `apply_subscription` como si fuera el estado de un plan —
   * y `created` no es `active`, así que habría suspendido las empresas de
   * alguien por un evento que solo decía que se editó el perfil de la
   * organización.
   */
  it('no confunde el status de la organización con el de una suscripción', () => {
    const body = JSON.stringify({
      type: 'organization.updated',
      data: { status: 'created', customer: { external_id: 'cuenta-1' } },
    })
    const event = provider.parse(body, polarHeaders('msg_org2', body))
    expect(event?.status, 'el status de la organización se coló').toBeNull()
    expect(event?.accountId, 'se atribuyó una cuenta a un evento que no es de suscripción').toBeNull()
  })

  /**
   * `data.customer.external_id` is set once, on the customer, and every later
   * event for that subscriber carries it — including renewals, where the
   * checkout's own metadata is long gone. Checked first for that reason.
   */
  it('prefers customer.external_id over metadata.account_id', () => {
    const body = JSON.stringify({
      type: 'subscription.created',
      data: {
        id: 'sub_1',
        status: 'active',
        product_id: 'prod_growth',
        metadata: { account_id: 'from-metadata' },
        customer: { external_id: 'from-customer' },
      },
    })
    const event = provider.parse(body, polarHeaders('msg_2', body))
    expect(event).toMatchObject({
      eventId: 'msg_2',
      kind: 'subscription.created',
      accountId: 'from-customer',
      plan: 'growth',
      status: 'active',
    })
  })

  it('falls back to metadata.account_id when the customer carries no external id', () => {
    const body = JSON.stringify({
      type: 'subscription.updated',
      data: { id: 'sub_1', status: 'canceled', product_id: 'prod_growth', metadata: { account_id: 'from-metadata' } },
    })
    const event = provider.parse(body, polarHeaders('msg_3', body))
    expect(event).toMatchObject({ accountId: 'from-metadata', status: 'canceled' })
  })

  /**
   * `subscription.paused` is real and Polar sends it; the pinned SDK's own
   * `validateEvent` does not have a case for it and throws. This provider
   * must not — an event type it does not specifically parse is still logged.
   */
  it('records a subscription event type it does not specifically read, rather than rejecting it', () => {
    const body = JSON.stringify({
      type: 'subscription.paused',
      data: { id: 'sub_1', status: 'paused', product_id: 'prod_unmapped', metadata: {}, customer: {} },
    })
    const event = provider.parse(body, polarHeaders('msg_4', body))
    expect(event).toMatchObject({ eventId: 'msg_4', kind: 'subscription.paused', plan: null, status: 'paused' })
  })

  it('records a non-subscription event with nothing to apply, rather than rejecting it', () => {
    const body = JSON.stringify({ type: 'order.paid', data: { id: 'order_1' } })
    const event = provider.parse(body, polarHeaders('msg_5', body))
    expect(event).toMatchObject({ eventId: 'msg_5', kind: 'order.paid', accountId: null, plan: null, status: null })
  })

  it('refuses an event whose signature does not verify', () => {
    const body = JSON.stringify({ type: 'subscription.created', data: { id: 'sub_1' } })
    const other = new Webhook(Buffer.from('otro-secreto-largo', 'utf-8').toString('base64'))
    expect(provider.parse(body, polarHeaders('msg_6', body, other))).toBeNull()
  })
})
