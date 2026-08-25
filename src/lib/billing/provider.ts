import { createHmac, timingSafeEqual } from 'node:crypto'
import { Webhook, WebhookVerificationError as StandardWebhookVerificationError } from 'standardwebhooks'
import { isPlanKey, type PlanKey } from '@/lib/plans'

/**
 * Everything about billing that is *not* about a particular processor.
 *
 * Which company Kigyo bills through — Wompi, Stripe, MercadoPago — is a
 * commercial decision that has not been made. Building the generic half first
 * costs nothing and cannot be invalidated by the answer: a processor's
 * integration is a signature check and a payload shape, and both are named
 * here as an interface with one implementation.
 *
 * The rest of the system talks to this file and never to a vendor SDK. When a
 * processor is chosen, it arrives as a second `BillingProvider` and the webhook
 * route does not change.
 *
 * ─── Lo que un proveedor tiene que contestar ─────────────────────────────────
 *
 *   1. ¿este cuerpo viene de verdad de ti?   → `verify`
 *   2. ¿qué dice?                             → `parse`
 *
 * Nothing else. Deliberately no "create a checkout session", no "open the
 * customer portal": those are redirects, they differ wildly between processors,
 * and inventing an abstraction over two of them before having either is how a
 * seam becomes a second product.
 */

/** What a processor's event boils down to, once the vendor shape is gone. */
export interface BillingEvent {
  /** The processor's own id. The idempotency key — see `billing_events`. */
  eventId: string
  /** Free-form, for the log: `subscription.updated`, `payment.failed`… */
  kind: string
  /**
   * Which account it is about, as *our* id.
   *
   * Processors carry it in metadata that was set when the subscription was
   * created. An event that does not name one is recorded and not applied —
   * guessing which customer a payment belongs to is not a thing to guess at.
   */
  accountId: string | null
  /** The tier the subscription now buys, when the event says. */
  plan: PlanKey | null
  /**
   * What the subscription is doing: `active`, `past_due`, `canceled`…
   *
   * Anything other than `active` suspends the account's companies — read-only,
   * never deleted. See `app.apply_subscription`.
   */
  status: string | null
  /**
   * Si el evento habla de una suscripción siquiera.
   *
   * Un procesador manda muchos más eventos de los que cambian un plan:
   * `organization.updated`, `checkout.created`, `benefit.granted`… Sin este
   * campo, el registro no distingue «este evento no iba de una suscripción»
   * —normal, no pasa nada— de «este evento iba de una suscripción y nombra una
   * cuenta que no tenemos», que es un problema de verdad que alguien debe mirar.
   *
   * La primera vez que llegó un `organization.updated` real, la bitácora lo
   * anotó como error. Con eso, el día que llegue el error verdadero estará
   * enterrado entre cien falsos.
   */
  aboutSubscription: boolean
  /** The untouched body, kept for the log so a mistake here is recoverable. */
  raw: unknown
}

export interface BillingProvider {
  /** Stored on `accounts.billing_provider` and on every event row. */
  readonly name: string
  /**
   * Whether this body really came from the processor.
   *
   * Takes the **raw** body, not a parsed object: every signature scheme signs
   * bytes, and `JSON.parse` followed by `JSON.stringify` does not reliably
   * reproduce them. The webhook route reads `request.text()` for this reason.
   */
  verify(rawBody: string, headers: Headers): boolean
  /**
   * The vendor payload, reduced to a `BillingEvent`. Null when unusable.
   *
   * Takes `headers` too, not only the body: a Standard-Webhooks processor
   * (Polar) carries its own idempotency id — the delivery id — in the
   * `webhook-id` header, not in the JSON. The manual provider ignores the
   * parameter and keeps reading `event_id` from the body, so this is
   * additive for the provider that already existed.
   */
  parse(rawBody: string, headers: Headers): BillingEvent | null
}

/**
 * The header a signature arrives in.
 *
 * One name for now. A real processor picks its own (`Stripe-Signature`,
 * `X-Event-Checksum`) and its adapter reads that instead.
 */
export const SIGNATURE_HEADER = 'x-kigyo-signature'

/**
 * Constant-time comparison of two hex digests.
 *
 * `===` on a signature leaks the position of the first wrong byte through
 * timing. That attack is fiddly over a network and entirely free to prevent,
 * and the alternative is explaining one day why it was not.
 */
function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  // `timingSafeEqual` throws on a length mismatch, which is itself a leak of
  // one bit. Hashing both sides first makes every comparison the same length.
  const norm = (buf: Buffer) => createHmac('sha256', 'len').update(buf).digest()
  return timingSafeEqual(norm(left), norm(right))
}

/**
 * The provider used until a real one is chosen.
 *
 * It is not a mock in the sense of "returns a canned answer": it verifies a
 * genuine HMAC-SHA256 of the raw body against `BILLING_WEBHOOK_SECRET`, which
 * is the same check every processor performs, and it parses a payload in the
 * shape `BillingEvent` already describes. So the route, the log, the
 * idempotency and the reconciliation are all exercised for real, and swapping
 * in a vendor means writing `verify` and `parse` against their documentation.
 *
 * It is also what a self-hosted deployment or an internal admin tool can post
 * to, which is worth having on its own.
 */
export function manualProvider(secret: string): BillingProvider {
  return {
    name: 'manual',

    verify(rawBody, headers) {
      const sent = headers.get(SIGNATURE_HEADER)
      if (!sent || !secret) return false
      const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
      return safeEqual(sent, expected)
    },

    parse(rawBody, _headers) {
      let body: unknown
      try {
        body = JSON.parse(rawBody)
      } catch {
        return null
      }
      if (typeof body !== 'object' || body === null) return null

      const b = body as Record<string, unknown>
      const eventId = typeof b.event_id === 'string' ? b.event_id : null
      const kind = typeof b.kind === 'string' ? b.kind : null
      // Without an id there is no idempotency, and without a kind there is
      // nothing to record. Both are refused rather than defaulted: a synthetic
      // id would make every retry look like a new event.
      if (!eventId || !kind) return null

      const plan = typeof b.plan === 'string' && isPlanKey(b.plan) ? b.plan : null

      return {
        eventId,
        kind,
        accountId: typeof b.account_id === 'string' ? b.account_id : null,
        plan,
        status: typeof b.status === 'string' ? b.status : null,
        // El proveedor manual solo existe para mover suscripciones: cualquier
        // cuerpo que llegue aquí pretende cambiar un plan o un estado.
        aboutSubscription: true,
        raw: body,
      }
    },
  }
}

/**
 * Polar.sh, on the Standard Webhooks specification every processor Polar's
 * size tends to converge on: `webhook-id` / `webhook-timestamp` /
 * `webhook-signature` headers, `base64(HMAC-SHA256(secret, "id.timestamp.body"))`,
 * and a `whsec_`-prefixed, base64 secret.
 *
 * `@polar-sh/sdk` ships a `validateEvent` that does this and returns a typed,
 * camelCase payload — deliberately not used here. It parses the body through a
 * `switch` on every event type the installed SDK version knows about and
 * throws `SDKValidationError` for anything else, which as of 0.49.0 does not
 * yet include `subscription.paused` / `subscription.resumed` even though
 * Polar already sends them. That exception is indistinguishable from a bad
 * signature to a caller that only catches `WebhookVerificationError`, and an
 * event Polar added after this SDK shipped is exactly the kind of thing that
 * must still be *recorded* — see `manualProvider`'s own reasoning about
 * refusing to default a missing id rather than the mirror mistake of refusing
 * to log an id we do not recognise.
 *
 * So this reads the wire JSON `standardwebhooks` already verified and hands
 * back — snake_case, exactly as Polar sent it — generically: `type` and, for
 * anything starting with `subscription.`, the handful of fields
 * `apply_subscription` needs. Every other event is still recorded, with
 * `accountId: null`, which the webhook route already treats as "nothing to
 * apply" rather than a failure.
 */
export function polarProvider(
  webhookSecret: string,
  planForProduct: (productId: string) => PlanKey | null,
): BillingProvider {
  // `Webhook` wants the secret as it signs: base64. Polar hands out
  // `whsec_<base64>`; the SDK's own adapter strips nothing and instead
  // re-encodes the whole string (prefix included) as base64 before handing it
  // to `Webhook`, so this mirrors that rather than assuming the prefix format
  // is stable across Polar's own key rotation tooling.
  const key = Buffer.from(webhookSecret, 'utf-8').toString('base64')
  const webhook = new Webhook(key)

  function verified(rawBody: string, headers: Headers): Record<string, unknown> | null {
    let body: unknown
    try {
      body = webhook.verify(rawBody, Object.fromEntries(headers))
    } catch (error) {
      if (error instanceof StandardWebhookVerificationError) return null
      throw error
    }
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null
  }

  return {
    name: 'polar',

    verify(rawBody, headers) {
      return verified(rawBody, headers) !== null
    },

    parse(rawBody, headers) {
      const body = verified(rawBody, headers)
      if (!body) return null

      const kind = typeof body.type === 'string' ? body.type : null
      // The delivery id, not anything in the body: Polar's envelope carries
      // no id of its own, and this is the value Polar itself retries with, so
      // it is the correct idempotency key even for an event this function
      // otherwise cannot read.
      const eventId = headers.get('webhook-id')
      if (!kind || !eventId) return null

      const data = typeof body.data === 'object' && body.data !== null
        ? (body.data as Record<string, unknown>)
        : null

      if (!kind.startsWith('subscription.') || !data) {
        return {
          eventId, kind, accountId: null, plan: null, status: null,
          aboutSubscription: false, raw: body,
        }
      }

      const metadata = typeof data.metadata === 'object' && data.metadata !== null
        ? (data.metadata as Record<string, unknown>)
        : {}
      const customer = typeof data.customer === 'object' && data.customer !== null
        ? (data.customer as Record<string, unknown>)
        : {}
      // Metadata set on the checkout is copied to the subscription once, at
      // creation — Polar's own docs say so. `external_customer_id` is set the
      // same moment but lives on the *customer*, which every later event for
      // this subscriber carries regardless, so it is the more durable of the
      // two and checked first.
      const accountId =
        (typeof customer.external_id === 'string' ? customer.external_id : null) ??
        (typeof metadata.account_id === 'string' ? metadata.account_id : null)

      const productId = typeof data.product_id === 'string' ? data.product_id : null

      return {
        eventId,
        kind,
        accountId,
        plan: productId ? planForProduct(productId) : null,
        status: typeof data.status === 'string' ? data.status : null,
        aboutSubscription: true,
        raw: body,
      }
    },
  }
}
