import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PLANS, SELF_SERVE_PLANS, isSelfServePlan } from '@/lib/plans'
import { PRICING, trialDaysFor } from '@/lib/pricing'

/**
 * The paywall, pinned.
 *
 * Every one of these assertions exists because the product shipped for months
 * without the thing it checks. Signing up created a `starter` account — the
 * tier `/pricing` charges $80.000 a month for — with no subscription, no
 * expiry, and no screen that ever asked for money. The checkout was built,
 * wired and correct; nothing ever sent anybody to it.
 *
 * That is the shape of the failure worth guarding against: not a broken
 * payment path, an *absent* one. None of the 290 tests that were green at the
 * time could have caught it, because each of them checked a piece that worked.
 * So these read the migrations and the catalogue and ask whether the pieces are
 * still connected to each other.
 */

const MIGRATIONS_DIR = resolve(process.cwd(), 'supabase/migrations')

/**
 * Las migraciones concatenadas, leídas una sola vez.
 *
 * Memoizado a propósito. Sin la caché, cada aserción de este archivo releía y
 * volvía a limpiar de comentarios ~110 archivos SQL, y con la suite corriendo
 * en paralelo eso bastó para que `sectors.test.ts` —que hace la misma lectura—
 * se pasara de tiempo una vez. Un guardia que introduce un fallo intermitente
 * en el vecino cuesta más de lo que vale.
 */
let cachedSql: string | null = null

function migrationSql(): string {
  cachedSql ??= readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((file) => readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8'))
    .join('\n')
  return cachedSql
}

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

/**
 * The same text with every comment removed.
 *
 * Not fussiness: the first draft of this file asserted that
 * `onboarding/client.tsx` no longer contains `upgradeToGrowth`, and it failed
 * against the fixed code — because the comment explaining *why* the function
 * was renamed names it. A test that cannot tell an explanation from an
 * instruction punishes writing the explanation down, which is the opposite of
 * what it should encourage.
 */
const strippedCache = new Map<string, string>()

function withoutComments(text: string): string {
  const hit = strippedCache.get(text)
  if (hit !== undefined) return hit
  const out = stripComments(text)
  strippedCache.set(text, out)
  return out
}

function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')   // /* … */ and JSX {/* … */}
    .replace(/^\s*--.*$/gm, ' ')          // SQL line comments
    .replace(/^\s*\/\/.*$/gm, ' ')         // TS line comments
}

/**
 * The body of a `create or replace function`, comments stripped.
 *
 * `lastIndexOf` because a function can be redefined across migrations and only
 * the last definition is the live one — which is exactly how migration 106
 * changed the behaviour of 543 policies without touching a single policy.
 */
function functionBody(sql: string, signature: string): string {
  // Comments come off *first*, and that is not tidiness either. Every one of
  // these migrations ends with a commented-out rollback that repeats the
  // `create or replace` line verbatim — so `lastIndexOf` on the raw text lands
  // in the rollback note, where there is no body to find.
  const bare = withoutComments(sql)
  const start = bare.lastIndexOf(signature)
  expect(start, `${signature} is not in any migration`).toBeGreaterThan(-1)
  const rest = bare.slice(start)
  // The body is delimited by `$$` … `$$;`; the opening one comes right after
  // the `as`, so the closer is the first `$$;` past it.
  const end = rest.indexOf('$$;')
  expect(end, `${signature} has no dollar-quoted body`).toBeGreaterThan(-1)
  return rest.slice(0, end)
}

describe('the database decides who may write, not the browser', () => {
  /**
   * The whole gate is one function, and that is the point.
   *
   * `app.company_is_active` is the predicate of all 543 RESTRICTIVE policies
   * migration 99 emitted. Teaching it about `access_state` in migration 106
   * taught all 543 at once — no new policy, no list to keep in step, and no
   * table that can be forgotten when the next one is created, because the
   * emitters apply the same function.
   */
  it('gates writes on the account being paid up', () => {
    const body = functionBody(migrationSql(), 'create or replace function app.company_is_active')
    expect(body, 'the guard no longer consults accounts.access_state').toContain('access_state')
    expect(body, 'the guard stopped checking organizations.status').toContain("o.status = 'active'")
  })

  /**
   * The exemption that keeps the wizard usable.
   *
   * Without it the branches step — which writes `sites`, a table with `org_id`
   * and therefore with a guard — would fail for every new account, and the
   * customer would hit the wall before being shown what they are buying.
   */
  it('lets a company still being configured write', () => {
    const body = functionBody(migrationSql(), 'create or replace function app.company_is_active')
    expect(body).toContain('setup_completed_at is null')
  })

  /** Readable, so the paywall can explain itself. Never writable. */
  it('grants access_state for reading and never for writing', () => {
    const sql = migrationSql()
    expect(sql).toMatch(/grant\s+select\s*\(access_state\)\s*\n?\s*on\s+public\.accounts\s+to\s+authenticated/i)

    for (const [, body] of sql.matchAll(/\bgrant\s+update\s*\(([^)]*)\)/gi)) {
      expect(body, 'a migration lets authenticated write access_state').not.toContain('access_state')
    }
  })

  /**
   * Only the webhook moves the state.
   *
   * `apply_subscription` is `security definer` with EXECUTE revoked from every
   * role but `service_role`, so this is the single door. A second writer would
   * be a second definition of "paid".
   */
  it('writes access_state only from apply_subscription', () => {
    const sql = withoutComments(migrationSql())
    const body = functionBody(migrationSql(), 'create or replace function public.apply_subscription')

    /*
     * Assignments, not mentions.
     *
     * `a.access_state = 'active'` inside `company_is_active` is a *read* in a
     * where-clause, and the first draft of this test counted it as a writer.
     * The lookbehind is what tells the two apart: an assignment names the bare
     * column, a read qualifies it with its table alias.
     */
    const assigns = (text: string) => [...text.matchAll(/(?<![.\w])access_state\s*=/g)].length

    // One write outside the function, and it is the backfill
    // (`update public.accounts set access_state = 'active'`), which runs once
    // at migration time and grandfathers everybody who was already here.
    expect(assigns(sql) - assigns(body), 'something other than apply_subscription writes access_state')
      .toBeLessThanOrEqual(1)
    expect(assigns(body), 'apply_subscription stopped writing access_state').toBeGreaterThan(0)
  })

  /** A trial Polar is running is a subscription, not an unpaid account. */
  it('counts a provider-managed trial as paid', () => {
    const body = functionBody(migrationSql(), 'create or replace function public.apply_subscription')
    expect(body).toContain("'trialing'")
  })
})

describe('the app sends unpaid accounts to the checkout', () => {
  it('redirects out of the dashboard when the account is not active', () => {
    const layout = source('src/app/(dashboard)/layout.tsx')
    expect(layout).toContain("member.account.accessState !== 'active'")
    expect(layout).toContain("redirect('/suscripcion')")
  })

  /**
   * The order matters and is worth pinning.
   *
   * The paywall has to come *after* the wizard redirect. Reversed, somebody who
   * has not finished setting up their company is shown a price list for a
   * product they have not configured — which is the wall the onboarding was
   * deliberately built not to be.
   */
  it('offers the wizard before the paywall', () => {
    const layout = source('src/app/(dashboard)/layout.tsx')
    expect(layout.indexOf("redirect('/onboarding')"))
      .toBeLessThan(layout.indexOf("redirect('/suscripcion')"))
  })

  /**
   * The wizard's last step has no free exit.
   *
   * It used to have two — "Saltar por ahora" and "Terminar", both calling
   * `done()` — so the screen that showed three prices carried two buttons for
   * paying none of them, and they were the only ones that did not leave the
   * app. Every account took that door.
   */
  it('leaves no way past the plan step but paying', () => {
    const wizard = withoutComments(source('src/app/onboarding/client.tsx'))
    expect(wizard, 'the plan step offers "Saltar por ahora" again')
      .toContain("current !== 'plan'")
    expect(wizard, 'the plan step charges for a fixed tier again')
      .toContain('checkoutTier(tier.key)')
    expect(wizard, 'the checkout is hard-coded to one tier again')
      .not.toContain('upgradeToGrowth')
  })
})

describe('the price list says what the product does', () => {
  /**
   * A tier with a price and no checkout is a tier nobody can buy.
   *
   * Starter was exactly that: $80.000 on the page, `DEFAULT_PLAN` in the code,
   * y ningún botón que lo cobrara. Enterprise fue lo mismo durante más tiempo,
   * por otra razón: se decidió que iba a `/contact` y esa decisión sobrevivió a
   * la creación de su producto en Polar. Ahora los tres se pueden pagar.
   */
  it('gives every tier a price and a way to buy it', () => {
    for (const plan of PLANS) {
      const priced = PRICING[plan.key].priceMonthly
      expect(priced, `${plan.key} no tiene precio`).toMatch(/\d/)
      expect(isSelfServePlan(plan.key), `${plan.key} no se puede pagar`).toBe(true)
    }
    expect([...SELF_SERVE_PLANS].sort()).toEqual(['enterprise', 'growth', 'starter'])
  })

  /**
   * Cada plan vendible necesita sus dos ids de producto en el entorno.
   *
   * Un plan en `SELF_SERVE_PLANS` cuyo id no está en `polarSchema` es un botón
   * «Pagar» que responde «la facturación todavía no está configurada» — el
   * mismo callejón que este archivo entero existe para impedir, una capa más
   * abajo.
   */
  it('exige en el entorno los dos productos de cada plan vendible', () => {
    const env = source('src/lib/env.ts')
    for (const plan of SELF_SERVE_PLANS) {
      for (const interval of ['MONTHLY', 'YEARLY']) {
        const key = `POLAR_PRODUCT_${plan.toUpperCase()}_${interval}`
        expect(env, `${key} no está en polarSchema`).toContain(key)
      }
    }
  })

  /**
   * La prueba gratis: la que hay, donde está, y en ningún otro sitio.
   *
   * Solo `STARTER_MONTHLY` la lleva —14 días, configurados en Polar y
   * verificados contra su API—. Las dos formas de equivocarse aquí son la
   * misma: la pantalla hablando por su cuenta del dinero. Antes se anunciaba
   * una prueba que no existía; el riesgo ahora es anunciar en las seis tarjetas
   * la que solo lleva una.
   */
  it('concede la prueba solo a Starter mensual', () => {
    expect(trialDaysFor('starter', 'mensual')).toBe(14)
    expect(trialDaysFor('starter', 'anual')).toBe(0)
    for (const plan of ['growth', 'enterprise'] as const) {
      for (const cycle of ['mensual', 'anual'] as const) {
        expect(trialDaysFor(plan, cycle), `${plan}/${cycle} no debe tener prueba`).toBe(0)
      }
    }
  })

  /**
   * La página no escribe el número de días a mano.
   *
   * Decía «Prueba 30 días gratis» cuando no existía ninguna prueba — de la
   * misma familia que las cuatro afirmaciones falsas del FAQ y que el
   * `price: '0'` del JSON-LD: una promesa hecha donde nadie la contrasta con el
   * código. Ahora hay una prueba real de 14 días, así que la regla ya no puede
   * ser «no menciones pruebas»; es «el número sale de `TRIAL_DAYS`». Un literal
   * en la plantilla es lo que se queda atrás cuando cambie el trial en Polar.
   */
  it('deriva los días de prueba en vez de escribirlos', () => {
    const pricing = withoutComments(source('src/app/pricing/PricingPlans.tsx'))
    expect(pricing, 'la página escribe los días de prueba a mano')
      .not.toMatch(/\b\d+\s+días?\s+grat/i)
    expect(pricing, 'la página no consulta la tabla de pruebas').toContain('trialDaysFor')
  })

  /** The terms of service are the one place a false claim about money is not a typo. */
  it('does not tell customers the service is free', () => {
    const terms = source('src/app/terms/page.tsx')
    expect(terms).not.toContain('se presta actualmente sin costo')
    expect(terms, 'the terms must name the subscription').toMatch(/suscripción/i)
  })
})
