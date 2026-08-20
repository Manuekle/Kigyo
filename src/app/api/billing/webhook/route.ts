import { createAdminClient } from '@/lib/supabase/admin'
import { billingWebhookSecret, polarEnv } from '@/lib/env'
import { manualProvider, polarProvider } from '@/lib/billing/provider'
import { planForPolarProduct } from '@/lib/billing/polar'

/**
 * Where a payment provider tells Kigyo what a customer has paid for.
 *
 * Written as a plain route handler rather than through `publicRoute`, for one
 * reason that matters: the helper parses the body as JSON, and a signature is
 * computed over the **bytes**. `JSON.parse` followed by `JSON.stringify` does
 * not reliably reproduce them — key order, unicode escapes and number
 * formatting all drift — so a verified body has to be the string that arrived.
 *
 * ─── El orden importa ───────────────────────────────────────────────────────
 *
 *   1. refuse if there is no secret to verify against;
 *   2. verify the signature — before parsing, before touching the database.
 *      An unsigned body is not input, it is noise;
 *   3. record the event, and let the unique constraint answer "have I seen
 *      this before". Every processor retries on a non-2xx and several deliver
 *      at least once by design, so a webhook that is not idempotent is a
 *      webhook that will eventually apply the same cancellation twice;
 *   4. only then change anything.
 *
 * ─── Por qué responde 200 a un evento que no pudo aplicar ───────────────────
 *
 * Because the event is *recorded*. A processor reading a 500 retries — often
 * for days — and the retries would fail identically, since the reason is
 * usually that the event names an account this database does not have. The row
 * carries the reason in `billing_events.error`, which is where somebody can
 * act on it. A genuinely transient failure returns 500 and is retried.
 *
 * Signature verification failures answer 401 and nothing else: telling an
 * unauthenticated caller whether the account exists, or whether the event was a
 * duplicate, is telling them about customers.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const polar = polarEnv()
  const manualSecret = billingWebhookSecret()

  // Polar first: it is the processor actually chosen. `manual` stays reachable
  // behind it for a self-hosted deployment or an internal admin tool, per its
  // own docstring — never both at once, since a body signed for one would be
  // meaningless to the other.
  const provider = polar
    ? polarProvider(polar.POLAR_WEBHOOK_SECRET, planForPolarProduct)
    : manualSecret
      ? manualProvider(manualSecret)
      : null

  // No provider means every caller is unauthenticated and none can be told
  // apart. An endpoint that can suspend a customer's companies must refuse to
  // run in that state rather than trusting whatever arrives.
  if (!provider) {
    console.error('[billing] no provider configured — set POLAR_* or BILLING_WEBHOOK_SECRET')
    return Response.json({ error: 'billing not configured' }, { status: 503 })
  }

  const raw = await request.text()

  if (!provider.verify(raw, request.headers)) {
    return Response.json({ error: 'invalid signature' }, { status: 401 })
  }

  const event = provider.parse(raw, request.headers)
  if (!event) {
    return Response.json({ error: 'unreadable event' }, { status: 400 })
  }

  const supabase = createAdminClient()

  /**
   * The log write is the idempotency check.
   *
   * Inserting and reading the conflict is the only version of "have I seen
   * this" that cannot race with itself: two deliveries arriving at once would
   * both pass a `select` and both apply. `23505` is the unique violation, and
   * here it is the expected answer rather than an error.
   */
  const { data: inserted, error: insertError } = await supabase
    .from('billing_events')
    .insert({
      provider: provider.name,
      event_id: event.eventId,
      kind: event.kind,
      account_id: event.accountId,
      payload: event.raw as never,
    })
    .select('id')
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return Response.json({ ok: true, duplicate: true })
    }
    console.error('[billing] could not record event', insertError)
    // Genuinely transient: the provider should retry this one.
    return Response.json({ error: 'could not record event' }, { status: 500 })
  }

  // `.single()` types the row as nullable even though a successful insert
  // always returns one. Treated as transient rather than asserted away: without
  // the id there is no row to settle, and reporting success for an event whose
  // outcome cannot be recorded would lose it silently.
  if (!inserted) {
    console.error('[billing] insert returned no row')
    return Response.json({ error: 'could not record event' }, { status: 500 })
  }
  const eventRowId = inserted.id

  /** Marks the outcome on the row, so the log says what happened and not only what arrived. */
  async function settle(error: string | null) {
    await supabase
      .from('billing_events')
      .update({ applied_at: error ? null : new Date().toISOString(), error })
      .eq('id', eventRowId)
  }

  // Nothing to apply is a normal event, not a failure: processors send plenty
  // that carry no subscription change at all.
  if (!event.accountId) {
    await settle('el evento no nombra una cuenta de Kigyo')
    return Response.json({ ok: true, applied: false })
  }
  if (!event.plan && !event.status) {
    await settle(null)
    return Response.json({ ok: true, applied: false })
  }

  const { error: applyError } = await supabase.rpc('apply_subscription', {
    p_account_id: event.accountId,
    p_plan: event.plan,
    p_status: event.status,
  })

  if (applyError) {
    console.error('[billing] could not apply subscription', applyError)
    await settle(applyError.message)
    // Recorded with its reason, so a retry would fail the same way. The row is
    // what somebody acts on.
    return Response.json({ ok: true, applied: false })
  }

  await settle(null)
  return Response.json({ ok: true, applied: true })
}
