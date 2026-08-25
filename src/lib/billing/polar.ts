import 'server-only'
import { Polar } from '@polar-sh/sdk'
import { polarEnv } from '@/lib/env'
import { SELF_SERVE_PLANS, type PlanKey, type SelfServePlan } from '@/lib/plans'

export type BillingInterval = 'monthly' | 'yearly'

// The catalogue moved to `lib/plans.ts` when the paywall screen — a client
// component — needed to know which tiers have a checkout. Re-exported so the
// billing callers that already import it from here keep working.
export { SELF_SERVE_PLANS, isSelfServePlan } from '@/lib/plans'
export type { SelfServePlan } from '@/lib/plans'

let cachedClient: Polar | null = null

/** Null when Polar is not configured — every caller already knows to check. */
export function polarClient(): Polar | null {
  const env = polarEnv()
  if (!env) return null
  if (!cachedClient) {
    cachedClient = new Polar({ accessToken: env.POLAR_ACCESS_TOKEN, server: env.POLAR_SERVER })
  }
  return cachedClient
}

function productMap(env: NonNullable<ReturnType<typeof polarEnv>>): Record<SelfServePlan, Record<BillingInterval, string>> {
  return {
    starter: { monthly: env.POLAR_PRODUCT_STARTER_MONTHLY, yearly: env.POLAR_PRODUCT_STARTER_YEARLY },
    growth: { monthly: env.POLAR_PRODUCT_GROWTH_MONTHLY, yearly: env.POLAR_PRODUCT_GROWTH_YEARLY },
  }
}

/** Which Polar product a tier + billing interval buys. Null when unconfigured. */
export function polarProductId(plan: SelfServePlan, interval: BillingInterval): string | null {
  const env = polarEnv()
  return env ? productMap(env)[plan][interval] : null
}

/**
 * The reverse of `polarProductId`, for the webhook: which tier a Polar
 * product id buys. Both directions read the same four env vars, so a product
 * id set for one tier can never resolve to another.
 */
export function planForPolarProduct(productId: string): PlanKey | null {
  const env = polarEnv()
  if (!env) return null
  const map = productMap(env)
  for (const plan of SELF_SERVE_PLANS) {
    if (map[plan].monthly === productId || map[plan].yearly === productId) return plan
  }
  return null
}
