import type { PlanKey } from './plans'

/**
 * What each tier costs, and how it is sold — the number half of the pricing
 * story, split from `plans.ts` on purpose: prices change with promotions and
 * currency, and a price baked into the access-control layer is a price
 * nobody remembers to update. See `plans.ts` for what each tier *includes*.
 *
 * Shared between `/pricing` (anonymous visitors) and the in-dashboard plan
 * switcher (`/dashboard/empresas`, paying accounts): one number per tier per
 * cycle, read from one place, so the two screens cannot quote different
 * prices for the same plan.
 */
export type Cycle = 'mensual' | 'anual'

export const CYCLES: Array<{ key: Cycle; label: string }> = [
  { key: 'mensual', label: 'Mensual' },
  { key: 'anual', label: 'Anual' },
]

export const PRICING: Record<
  PlanKey,
  { priceMonthly: string; priceAnnual: string; cta: string; href: string; featured: boolean; extras: string[] }
> = {
  starter: {
    priceMonthly: '$80.000',
    priceAnnual: '$800.000',
    cta: 'Comenzar',
    href: '/register',
    featured: false,
    extras: ['Soporte por correo'],
  },
  growth: {
    priceMonthly: '$300.000',
    priceAnnual: '$3.000.000',
    cta: 'Comenzar',
    href: '/register',
    featured: true,
    extras: ['Asistente de IA sobre tus datos', 'Soporte prioritario'],
  },
  enterprise: {
    priceMonthly: '$600.000',
    priceAnnual: '$6.000.000',
    // The one plan that needs a conversation first, so its action is the demo
    // rather than self-serve signup — and, in the dashboard switcher, never a
    // checkout button.
    cta: 'Solicitar demo',
    href: '/contact',
    featured: false,
    extras: ['SSO y controles de seguridad', 'Integraciones personalizadas', 'SLA y onboarding asistido'],
  },
}
