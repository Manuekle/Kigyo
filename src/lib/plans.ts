/**
 * What a subscription buys.
 *
 * Until now the three tiers on /pricing were prose. They named modules —
 * "Nómina, firmas electrónicas y riesgos", "Tienda virtual y catálogos" — and
 * nothing in the product read them: a Starter account could switch on every
 * module in Configuración, so the page was describing a restriction that did
 * not exist.
 *
 * The plan is now a third gate, outside the two that already exist:
 *
 *   · `plan`             — what did this company buy?   Org-wide, billing.
 *   · `enabled_modules`  — what does it use?            Org-wide, admin.
 *   · `role_permissions` — who may open it?             Per role.
 *
 * They compose outermost-first. A module the plan does not include cannot be
 * switched on at all, so it never reaches the second question; a module that
 * is on but not permitted to your role reaches the third and stops there. Each
 * refusal is worded differently, because "buy a bigger plan", "ask an admin to
 * enable it" and "ask an admin to grant it" send you to three different places.
 *
 * Deliberately *not* here: prices. Those live on the marketing page, they
 * change with promotions and currency, and a price baked into the access
 * control layer is a price nobody remembers to update.
 */

import { MODULE_KEYS } from './modules'

export const PLAN_KEYS = ['starter', 'growth', 'enterprise'] as const
export type PlanKey = (typeof PLAN_KEYS)[number]

/**
 * The plan a row falls back to.
 *
 * `starter` for anything new, so an account cannot arrive at the top tier by
 * accident. Rows that predate the column are backfilled to `enterprise` by the
 * migration instead — they were sold before plans existed and must not lose a
 * module they are already using.
 */
export const DEFAULT_PLAN: PlanKey = 'starter'

export interface PlanDef {
  key: PlanKey
  label: string
  /** One line, written for someone deciding whether to move up a tier. */
  description: string
  /**
   * Modules this plan may switch on. Cumulative by construction below: every
   * tier starts from the one under it, so a module can never be in Starter and
   * missing from Growth.
   */
  modules: string[]
  /**
   * Maximum members, or `null` for no limit. Counted against memberships plus
   * outstanding invitations — an invitation that has been sent is a seat that
   * is already spoken for, and not counting it lets a full organization invite
   * its way past the cap.
   */
  seats: number | null
  /**
   * How many companies one account may own, or `null` for no limit.
   *
   * A customer buys one subscription and may run several businesses under it —
   * a group with a clinic and a restaurant, a holding with three construction
   * firms. This is the number that makes that a paid capability rather than a
   * free one.
   *
   * Unlike `seats`, this is enforced by the database as well: a trigger on
   * `organizations` refuses the insert (migration 28). Seats can stay
   * application-level because only an administrator writes invitations, so
   * exceeding them is a billing discrepancy; a company is an object being
   * charged for, and the row should not exist at all.
   */
  maxCompanies: number | null
  /**
   * Branches per company, or `null` for no limit.
   *
   * Declared now and inert until phase 6 builds `sites`. It lives here rather
   * than being added later so that `public.plan_limits` and this catalogue can
   * be pinned against each other from the day the table exists — a limit that
   * only one of the two knows about is a limit that disagrees with itself.
   */
  maxSitesPerCompany: number | null
}

/**
 * Starter is the people floor: a small team getting its records in order.
 *
 * It carries `clientes` and `contratos` because "who are our customers" and
 * "what did we sign" are questions a five-person company already has, and
 * answering them badly in a spreadsheet is the thing Kigyo replaces.
 */
const STARTER = [
  'empleados', 'asistencia', 'documentos', 'calendario', 'canales', 'tickets',
  'clientes', 'contratos',
]

/**
 * Growth is the operating tier: everything a company that runs projects,
 * inventory and a commercial pipeline needs, plus the sector modules.
 *
 * The verticals (pacientes, estudiantes, restaurante, agro, inmobiliario,
 * hoteleria, socios) sit here rather than in Enterprise on purpose. A
 * twelve-table restaurant, a rural clinic and a neighbourhood gym are
 * Growth-sized businesses; putting their one essential module behind the top
 * tier would price them out of the product that was built for them.
 */
const GROWTH = [
  ...STARTER,
  'nomina', 'riesgos', 'firmas', 'reclutamiento', 'capacitacion', 'desempeno',
  'proyectos', 'hseq', 'inventario', 'mantenimiento', 'flota', 'produccion',
  'cotizaciones', 'compras', 'facturacion', 'catalogos',
  // The counter and the till are operating tools, not scale ones. `tienda` and
  // `ecommerce` sit in Enterprise because selling to the public over the
  // internet is a different business; charging the person standing in front of
  // you is what a Growth-sized shop does all day.
  'pos', 'caja', 'tiempos', 'suscripciones', 'cartera', 'notificaciones', 'reportes', 'creditos', 'donantes', 'suscriptores', 'puestos', 'calidad', 'obra',
  'consultoria', 'ia',
  'pacientes', 'estudiantes', 'restaurante', 'agro', 'inmobiliario', 'hoteleria',
  'socios',
]

/**
 * Enterprise adds the two things that are genuinely about scale rather than
 * about doing more work: selling to the public (tienda, ecommerce) and being
 * able to prove what happened (trazabilidad).
 */
export const PLANS: PlanDef[] = [
  {
    key: 'starter',
    label: 'Starter',
    description: 'Equipos pequeños ordenando personas, clientes y documentos.',
    modules: STARTER,
    seats: 10,
    // One business. Running a second is what Growth is for, and it is the
    // clearest reason to move up a tier that the product has.
    maxCompanies: 1,
    maxSitesPerCompany: 1,
  },
  {
    key: 'growth',
    label: 'Growth',
    description: 'Empresas que además manejan operación, comercial y su sector.',
    modules: GROWTH,
    // Unlimited, decided rather than defaulted. docs/FASE_0_CONTRATOS.md §7.2
    // had proposed 50; the call went the other way, and for a reason worth
    // keeping written down: Growth is differentiated by which modules it opens
    // and how many companies it allows, not by headcount. Charging per seat in
    // an ERP for small business penalises exactly the customer who is rolling
    // it out to their team — the one adoption depends on.
    seats: null,
    maxCompanies: 3,
    maxSitesPerCompany: 5,
  },
  {
    key: 'enterprise',
    label: 'Enterprise',
    description: 'Venta al público, auditoría completa y controles avanzados.',
    // Spread from the catalogue rather than listed: a module added to
    // lib/modules.ts and forgotten here would be unreachable on every plan,
    // which is a bug that looks exactly like "the feature does not work".
    modules: [...MODULE_KEYS],
    seats: null,
    maxCompanies: null,
    maxSitesPerCompany: null,
  },
]

export function isPlanKey(value: string): value is PlanKey {
  return (PLAN_KEYS as readonly string[]).includes(value)
}

/** The plan definition, falling back to the top tier for an unknown key. */
export function planFor(key: string | null | undefined): PlanDef {
  const found = key ? PLANS.find((p) => p.key === key) : undefined
  // Unknown means a row written by a version of the app that knew a plan this
  // one does not. Failing *open* is the right direction here and only here:
  // the alternative silently removes modules from a paying customer, and the
  // database check constraint already rejects anything not in PLAN_KEYS.
  return found ?? PLANS[PLANS.length - 1]
}

/** Modules the plan allows, as a set, for the gate to test membership against. */
export function planModules(key: string | null | undefined): Set<string> {
  return new Set(planFor(key).modules)
}

export function planAllows(key: string | null | undefined, module: string): boolean {
  return planModules(key).has(module)
}

/**
 * The cheapest plan that includes a module, for the "requires Growth" hint the
 * configuración screen shows next to a locked toggle. `null` when no plan does,
 * which the tests forbid but the type system cannot.
 */
export function lowestPlanWith(module: string): PlanDef | null {
  return PLANS.find((p) => p.modules.includes(module)) ?? null
}

/**
 * Whether the organization can add one more member.
 *
 * `used` is memberships plus pending invitations. An unlimited plan short
 * circuits, so the caller never has to special-case `null`.
 */
export function seatsAvailable(key: string | null | undefined, used: number): boolean {
  const seats = planFor(key).seats
  return seats === null || used < seats
}

/**
 * Whether the account can own one more company.
 *
 * `used` is how many it already has. The database enforces the same rule on the
 * insert (migration 28); this exists so the screen can say "tu plan Starter
 * permite 1 empresa" instead of surfacing a constraint violation, and so the
 * "Nueva empresa" button can be disabled rather than only failing when pressed.
 */
export function companiesAvailable(key: string | null | undefined, used: number): boolean {
  const max = planFor(key).maxCompanies
  return max === null || used < max
}
