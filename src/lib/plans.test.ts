import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PLAN, PLANS, PLAN_KEYS, isPlanKey, lowestPlanWith,
  planAllows, planFor, planModules, seatsAvailable,
} from './plans'
import { CORE_MODULES, MODULE_KEYS, resolveModules } from './modules'
import { lowestMonthlyCop, monthlyCop } from './pricing'

/**
 * The plan is the outermost of the three access gates, so a mistake here is
 * not a cosmetic one: a module wrongly excluded is a feature a paying customer
 * cannot reach, and one wrongly included is revenue given away.
 */

describe('plan catalogue', () => {
  it('matches the plans the database check constraint accepts', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260810120000_14_plans_and_sectors.sql'),
      'utf8',
    )
    const block = sql.match(/check \(plan in \(([^)]*)\)\)/)
    expect(block, 'plan check constraint not found in migration 14').toBeTruthy()
    const inDatabase = [...block![1].matchAll(/'([a-z]+)'/g)].map((m) => m[1])
    expect(inDatabase.sort()).toEqual([...PLAN_KEYS].sort())
  })

  it('only names modules that exist', () => {
    for (const plan of PLANS) {
      for (const key of plan.modules) {
        expect(MODULE_KEYS, `${plan.key} → ${key}`).toContain(key)
      }
    }
  })

  it('has no duplicates inside a plan', () => {
    for (const plan of PLANS) {
      expect(new Set(plan.modules).size, plan.key).toBe(plan.modules.length)
    }
  })

  /**
   * The single most important invariant in this file. If a tier ever dropped a
   * module the tier below it includes, upgrading would *remove* a feature —
   * and the customer would have paid for the privilege.
   */
  it('is strictly cumulative: each tier contains everything below it', () => {
    for (let i = 1; i < PLANS.length; i += 1) {
      const below = new Set(PLANS[i - 1].modules)
      for (const key of below) {
        expect(PLANS[i].modules, `${PLANS[i].key} is missing ${key}`).toContain(key)
      }
    }
  })

  it('reaches every module by the top tier', () => {
    // A module in no plan is unreachable on every account — a bug that looks
    // exactly like "the feature does not work".
    const top = new Set(PLANS[PLANS.length - 1].modules)
    for (const key of MODULE_KEYS) {
      expect(top.has(key), `${key} is in no plan`).toBe(true)
    }
  })

  it('never sells the core shell as a feature', () => {
    for (const plan of PLANS) {
      for (const core of CORE_MODULES) {
        expect(plan.modules).not.toContain(core)
      }
    }
  })

  it('leaves the lowest tier genuinely lower', () => {
    expect(PLANS[0].modules.length).toBeLessThan(MODULE_KEYS.length)
  })

  it('starts new accounts on the cheapest plan', () => {
    expect(DEFAULT_PLAN).toBe(PLANS[0].key)
  })
})

describe('planFor', () => {
  it('resolves every known key', () => {
    for (const plan of PLANS) expect(planFor(plan.key).key).toBe(plan.key)
  })

  /**
   * Fails open, and only here. A row written by a newer version of the app
   * naming a plan this one does not know must not silently strip modules from
   * a paying customer — and the database constraint already rejects anything
   * outside PLAN_KEYS, so this cannot be reached by a client.
   */
  it('falls back to the top tier for an unknown or missing key', () => {
    const top = PLANS[PLANS.length - 1].key
    expect(planFor('plan-del-futuro').key).toBe(top)
    expect(planFor(null).key).toBe(top)
    expect(planFor(undefined).key).toBe(top)
  })

  it('recognises its own keys and rejects anything else', () => {
    for (const plan of PLANS) expect(isPlanKey(plan.key)).toBe(true)
    expect(isPlanKey('platinum')).toBe(false)
    expect(isPlanKey('')).toBe(false)
  })
})

describe('planAllows', () => {
  it('permits what the tier includes and refuses what it does not', () => {
    expect(planAllows('starter', 'empleados')).toBe(true)
    expect(planAllows('starter', 'nomina')).toBe(false)
    expect(planAllows('growth', 'nomina')).toBe(true)
    expect(planAllows('enterprise', 'trazabilidad')).toBe(true)
  })

  it('refuses a module that does not exist', () => {
    expect(planAllows('enterprise', 'modulo-fantasma')).toBe(false)
  })
})

describe('lowestPlanWith', () => {
  it('names the cheapest tier that includes a module', () => {
    expect(lowestPlanWith('empleados')?.key).toBe('starter')
    expect(lowestPlanWith('nomina')?.key).toBe('growth')
    expect(lowestPlanWith('trazabilidad')?.key).toBe('enterprise')
  })

  it('returns null for a module no plan carries', () => {
    expect(lowestPlanWith('modulo-fantasma')).toBeNull()
  })
})

describe('seatsAvailable', () => {
  it('enforces a capped plan and short circuits an uncapped one', () => {
    expect(seatsAvailable('starter', 9)).toBe(true)
    expect(seatsAvailable('starter', 10)).toBe(false)
    expect(seatsAvailable('starter', 200)).toBe(false)
    expect(seatsAvailable('growth', 10_000)).toBe(true)
    expect(seatsAvailable('enterprise', 10_000)).toBe(true)
  })
})

describe('resolveModules under a plan', () => {
  it('drops what the plan does not include', () => {
    // The stored selection is honoured, then narrowed. `nomina` is Growth+, so
    // a Starter account that somehow has it stored still cannot see it.
    const resolved = resolveModules(['empleados', 'nomina'], null, planModules('starter'))
    expect(resolved.has('empleados')).toBe(true)
    expect(resolved.has('nomina')).toBe(false)
  })

  it('keeps the core shell even when the plan strips everything else', () => {
    // An account whose plan excludes every module it had switched on still
    // lands on a working dashboard and a configuración screen that explains it.
    const resolved = resolveModules(['tienda'], null, planModules('starter'))
    for (const core of CORE_MODULES) expect(resolved.has(core)).toBe(true)
    expect(resolved.has('tienda')).toBe(false)
  })

  it('narrows a sector preset rather than refusing it', () => {
    // Picking "Salud" on Starter is a true statement about the business. It
    // just does not unlock `pacientes`, which is Growth+.
    const resolved = resolveModules([], 'salud', planModules('starter'))
    expect(resolved.has('empleados')).toBe(true)
    expect(resolved.has('pacientes')).toBe(false)
  })

  it('leaves the selection untouched when no plan is passed', () => {
    const resolved = resolveModules(['nomina'], null)
    expect(resolved.has('nomina')).toBe(true)
  })
})

/**
 * Nada llega a Enterprise por descuido.
 *
 * `Enterprise` se define como `[...MODULE_KEYS]`, y eso es correcto: un módulo
 * que este archivo olvide sigue siendo alcanzable en algún plan en vez de
 * quedar muerto. Pero tiene un coste que no se ve — recoge en silencio todo lo
 * que `GROWTH` no liste, así que «olvidarse de un módulo» y «ponerlo en el plan
 * más caro» son indistinguibles desde fuera.
 *
 * Fue exactamente lo que pasó con `pedidos`: llegó en la migración 88, nadie lo
 * añadió a `GROWTH`, y una empresa Growth se encontró con que podía crear
 * cotizaciones y aceptarlas pero no convertirlas en pedidos — la mitad de una
 * cadena, detrás de un plan que nadie había decidido cobrar por ella. El
 * docstring de Enterprise nombra sus tres diferenciadores; esta prueba exige
 * que sean *exactamente* esos tres.
 *
 * Añadir un módulo a Enterprise a propósito es entonces un cambio de dos
 * líneas: la lista de abajo y el docstring. Que es lo que debería costar.
 */
describe('el salto de Growth a Enterprise es deliberado', () => {
  const ENTERPRISE_ONLY = ['tienda', 'ecommerce', 'trazabilidad']

  it('Enterprise solo añade lo que su docstring nombra', () => {
    const growth = planModules('growth')
    const extra = [...planModules('enterprise')]
      .filter((m) => !growth.has(m) && !CORE_MODULES.includes(m))
      .sort()

    expect(extra).toEqual([...ENTERPRISE_ONLY].sort())
  })

  it('la cadena comercial completa cabe en Growth', () => {
    // Cotizar sin poder convertir, o pedir sin poder facturar, es media
    // función. Los cinco eslabones viven o mueren juntos.
    const growth = planModules('growth')
    for (const m of ['clientes', 'leads', 'cotizaciones', 'pedidos', 'facturacion']) {
      expect(growth.has(m), `${m} debería estar en Growth`).toBe(true)
    }
  })
})

/**
 * El precio que ven los buscadores es el precio que cobra la página.
 *
 * El JSON-LD de `app/layout.tsx` declaraba `price: '0'`, o sea que Kigyo es
 * gratis, mientras `/pricing` cobra desde $80.000 al mes. Los datos
 * estructurados alimentan los resultados enriquecidos de Google y los
 * rastreadores de IA, así que era la afirmación falsa dicha donde más se
 * propaga — la misma familia que las cuatro del FAQ, y la que menos se revisa
 * porque no se ve en pantalla.
 */
describe('los datos estructurados no contradicen la página de precios', () => {
  it('el precio de entrada sale de PRICING y no es cero', () => {
    expect(lowestMonthlyCop()).toBe(80_000)
    expect(lowestMonthlyCop()).toBe(monthlyCop('starter'))
    expect(lowestMonthlyCop()).toBeGreaterThan(0)
  })

  it('Growth cuesta más que Starter, o el «desde» miente', () => {
    expect(monthlyCop('growth')).toBeGreaterThan(monthlyCop('starter'))
  })

  it('cada plan con checkout tiene un precio legible como número', () => {
    for (const key of ['starter', 'growth'] as const) {
      expect(Number.isFinite(monthlyCop(key)), `${key} no parsea`).toBe(true)
      expect(monthlyCop(key)).toBeGreaterThan(0)
    }
  })
})
