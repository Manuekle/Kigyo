import 'server-only'
import { Polar } from '@polar-sh/sdk'
import { polarEnv } from '@/lib/env'
import type { PlanKey } from '@/lib/plans'

export type BillingInterval = 'monthly' | 'yearly'

/** The two tiers sold through a checkout. Enterprise goes to `/contact`. */
export const SELF_SERVE_PLANS = ['starter', 'growth'] as const
export type SelfServePlan = (typeof SELF_SERVE_PLANS)[number]

export function isSelfServePlan(plan: string): plan is SelfServePlan {
  return (SELF_SERVE_PLANS as readonly string[]).includes(plan)
}

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
