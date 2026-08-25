import { SELF_SERVE_PLANS, type PlanKey } from './plans'

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

/**
 * El precio de entrada, en número, para los datos estructurados.
 *
 * Se deriva de `priceMonthly` en vez de escribirse aparte porque un segundo
 * número es un número que se queda atrás. Esto existe por un caso concreto: el
 * JSON-LD de `app/layout.tsx` declaraba `price: '0'` a los buscadores mientras
 * esta página cobraba — el mismo tipo de afirmación falsa que el FAQ,
 * pero dirigida a quien indexa el sitio en vez de a quien lo lee.
 *
 * Los separadores de miles se quitan; el resultado son dólares enteros.
 */
export function monthlyUsd(plan: PlanKey): number {
  return Number(PRICING[plan].priceMonthly.replace(/[^\d]/g, ''))
}

/**
 * El más barato de los planes con checkout, para `AggregateOffer.lowPrice`.
 *
 * Derivado de `SELF_SERVE_PLANS` y no de una lista escrita aquí: esa lista
 * decía `['starter','growth']` y siguió diciéndolo cuando Enterprise pasó a
 * venderse solo. Hoy no cambia el mínimo —Starter sigue siendo el más barato—
 * pero una lista paralela de planes es exactamente lo que se queda atrás.
 */
export function lowestMonthlyUsd(): number {
  return Math.min(...SELF_SERVE_PLANS.map((plan) => monthlyUsd(plan)))
}

/**
 * Los días de prueba de cada plan, por ciclo.
 *
 * **Solo Starter mensual.** No es un valor por defecto ni una simplificación:
 * es lo que está configurado en Polar, producto por producto —
 * `trial_interval: day, trial_interval_count: 14` en `STARTER_MONTHLY` y en
 * ninguno más. Verificado contra la API de Polar, no supuesto.
 *
 * Esta tabla existe para que la pantalla no lo invente. La versión anterior de
 * `/pricing` anunciaba «Prueba 30 días gratis» sin que nada la concediera, y
 * eso se retiró por falso; ahora hay una prueba de verdad y el riesgo es el
 * contrario — anunciarla en las seis tarjetas cuando solo la lleva una. Las dos
 * formas de equivocarse son la misma: la pantalla hablando por su cuenta del
 * dinero.
 *
 * Quien cambie el trial en Polar tiene que cambiarlo aquí. No se puede derivar:
 * el catálogo de Polar solo se puede consultar con el token, que es de
 * servidor, y esta tabla la lee `/pricing`, que es pública y anónima.
 */
export const TRIAL_DAYS: Record<PlanKey, Partial<Record<Cycle, number>>> = {
  starter: { mensual: 14 },
  growth: {},
  enterprise: {},
}

/** Días de prueba de una combinación concreta. 0 = sin prueba. */
export function trialDaysFor(plan: PlanKey, cycle: Cycle): number {
  return TRIAL_DAYS[plan][cycle] ?? 0
}

export const PRICING: Record<
  PlanKey,
  {
    priceMonthly: string
    priceAnnual: string
    cta: string
    href: string
    featured: boolean
    extras: string[]
    /** Enlace a ventas, al lado del botón de pago. Solo Enterprise lo usa. */
    sales?: string
  }
> = {
  starter: {
    priceMonthly: '$30',
    priceAnnual: '$300',
    cta: 'Comenzar',
    href: '/register',
    featured: false,
    extras: ['Soporte por correo'],
  },
  growth: {
    priceMonthly: '$100',
    priceAnnual: '$1,000',
    cta: 'Comenzar',
    href: '/register',
    featured: true,
    extras: ['Asistente de IA sobre tus datos', 'Soporte prioritario'],
  },
  enterprise: {
    priceMonthly: '$200',
    priceAnnual: '$2,000',
    // Se vendía solo como demo —«el plan que necesita una conversación
    // primero»— y esa decisión sobrevivió a la creación de su producto en
    // Polar, así que el plan más caro era el único que nadie podía comprar.
    // Ahora se paga como los otros dos y la conversación se ofrece al lado, en
    // `sales`: SSO, integraciones a medida y SLA siguen mereciendo una llamada,
    // pero obligar a esperarla pierde al cliente que ya decidió.
    cta: 'Comenzar',
    href: '/register',
    featured: false,
    extras: ['SSO y controles de seguridad', 'Integraciones personalizadas', 'SLA y onboarding asistido'],
    sales: '/contact',
  },
}
