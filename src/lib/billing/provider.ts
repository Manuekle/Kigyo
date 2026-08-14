import { createHmac, timingSafeEqual } from 'node:crypto'
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
  /** The vendor payload, reduced to a `BillingEvent`. Null when unusable. */
  parse(rawBody: string): BillingEvent | null
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

    parse(rawBody) {
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
        raw: body,
      }
    },
  }
}
