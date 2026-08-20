'use server'

import { z } from 'zod'
import { ResourceNotFound } from '@polar-sh/sdk/models/errors/resourcenotfound.js'
import { requireMember } from '@/lib/auth/session'
import { serverEnv } from '@/lib/env'
import { polarClient, polarProductId } from '@/lib/billing/polar'

/**
 * Checkout and customer-portal links for the account's Polar subscription.
 *
 * Both actions are gated to the same governance `/dashboard/empresas` already
 * requires to be reached at all — owner or admin on the account — because
 * changing what an account is billed for is exactly that kind of decision,
 * and neither action has an authorization check of its own the way a module
 * permission would.
 */

export type BillingActionResult = { ok: true; url: string } | { ok: false; error: string }

const NOT_CONFIGURED = 'La facturación con Polar todavía no está configurada.'
const NOT_ALLOWED = 'Solo quien administra la cuenta puede cambiar la facturación.'

const checkoutSchema = z.object({
  plan: z.enum(['starter', 'growth']),
  interval: z.enum(['monthly', 'yearly']),
})

/**
 * Starts a Polar checkout for the tier and interval chosen, scoped to the
 * caller's account via `externalCustomerId` so every later webhook for this
 * subscriber — including renewals, long after the checkout is gone — still
 * resolves back to the right account. `metadata.account_id` rides along too,
 * belt and suspenders, since it is copied to the subscription at creation.
 */
export async function startPolarCheckout(
  input: z.input<typeof checkoutSchema>,
): Promise<BillingActionResult> {
  const member = await requireMember()
  if (member.account.role !== 'owner' && member.account.role !== 'admin') {
    return { ok: false, error: NOT_ALLOWED }
  }

  const parsed = checkoutSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: 'Datos inválidos.' }
  const { plan, interval } = parsed.data

  const client = polarClient()
  const productId = polarProductId(plan, interval)
  if (!client || !productId) return { ok: false, error: NOT_CONFIGURED }

  try {
    const checkout = await client.checkouts.create({
      products: [productId],
      externalCustomerId: member.account.accountId,
      metadata: { account_id: member.account.accountId, plan },
      successUrl: `${serverEnv().NEXT_PUBLIC_APP_URL}/dashboard/empresas?checkout=success`,
    })
    return { ok: true, url: checkout.url }
  } catch (error) {
    console.error('[billing] could not create Polar checkout', error)
    return { ok: false, error: 'No se pudo iniciar el pago. Intenta de nuevo.' }
  }
}

/**
 * A link into Polar's own customer portal, where an existing subscriber
 * changes plan, updates the payment method or cancels — natively, so Kigyo
 * never has to re-implement proration or plan-switch rules Polar already
 * owns and gets right.
 *
 * There is no local record of whether this account has checked out with
 * Polar before — `accounts.billing_provider` is deliberately not readable by
 * `authenticated` (migration 38), and this screen has no reason to be the
 * exception. So the button is offered unconditionally, and "no customer yet"
 * comes back as this specific, actionable message instead of a stack trace.
 */
export async function openBillingPortal(): Promise<BillingActionResult> {
  const member = await requireMember()
  if (member.account.role !== 'owner' && member.account.role !== 'admin') {
    return { ok: false, error: NOT_ALLOWED }
  }

  const client = polarClient()
  if (!client) return { ok: false, error: NOT_CONFIGURED }

  try {
    const session = await client.customerSessions.create({
      externalCustomerId: member.account.accountId,
    })
    return { ok: true, url: session.customerPortalUrl }
  } catch (error) {
    if (error instanceof ResourceNotFound) {
      return { ok: false, error: 'Todavía no tienes una suscripción activa. Elige un plan para empezar.' }
    }
    console.error('[billing] could not open Polar customer portal', error)
    return { ok: false, error: 'No se pudo abrir el portal de facturación.' }
  }
}
