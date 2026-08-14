import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PLANS } from '@/lib/plans'

/**
 * The account scope, pinned statically.
 *
 * supabase/tests/rls/005_account_isolation.sql already proves the runtime
 * behaviour: the owner of an account with two companies sees nothing in the one
 * they did not join. What it cannot prove is that the *next* table added to the
 * schema keeps that property — a new policy that consults `app.current_account_ids()`
 * would let the account scope reach business data, and the existing test would
 * go on passing because it only knows about the tables it seeds.
 *
 * So this reads the migrations instead. It is a grep with a reason attached,
 * and it fails the moment somebody widens the boundary by accident.
 */

const MIGRATIONS_DIR = resolve(process.cwd(), 'supabase/migrations')

function migrations(): Array<{ file: string; sql: string }> {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((file) => ({ file, sql: readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8') }))
}

/**
 * The tables the account scope is allowed to govern. Nothing else, ever.
 *
 * `billing_events` joined them in migration 38 and is the same kind of thing as
 * the other two: it is *about* a subscription, not about a company's work. It
 * is also the strictest row in the schema — no policies at all and every
 * privilege revoked, so `service_role` is the only reader — which is exactly
 * why carrying `account_id` is right there and would be wrong on an invoice or
 * a patient.
 */
const ACCOUNT_TABLES = ['accounts', 'account_memberships', 'billing_events']

/** Helpers that answer "what may this user do to the ACCOUNT". */
const ACCOUNT_PRIMITIVES = [
  'app.current_account_ids',
  'app.accounts_of_my_orgs',
  'app.is_account_owner',
  'app.can_manage_account',
]

describe('account scope never reaches business data', () => {
  /**
   * The rule from AGENTS.md, made executable: no policy on a business table may
   * reference an account.
   *
   * Reading a company's rows requires a row in `public.memberships`, and that is
   * the whole reason the migration could leave 66 tables and ~264 policies
   * untouched. A policy that asked the account instead would reintroduce exactly
   * the cross-company visibility the design exists to prevent — and it would do
   * it silently, because the owner of the account is usually also a member of
   * the company being tested.
   */
  it('no policy outside the account tables consults an account primitive', () => {
    const offenders: string[] = []

    for (const { file, sql } of migrations()) {
      // `create policy <name> on <table> ... ;` — policy bodies contain no
      // semicolons in this schema, so terminating on one is safe here.
      const policies = sql.matchAll(
        /create\s+policy\s+"?([\w\s]+?)"?\s+on\s+(?:public\.)?(\w+)([\s\S]*?);/gi,
      )

      for (const [, name, table, body] of policies) {
        if (ACCOUNT_TABLES.includes(table)) continue
        for (const primitive of ACCOUNT_PRIMITIVES) {
          if (body.includes(primitive)) {
            offenders.push(`${file}: policy ${name.trim()} on ${table} uses ${primitive}`)
          }
        }
      }
    }

    expect(
      offenders,
      'A business-table policy consults the account scope. Reading a company\'s rows must ' +
        'require public.memberships — see AGENTS.md and docs/FASE_0_CONTRATOS.md §6.3.',
    ).toEqual([])
  })

  /**
   * Business tables isolate on `org_id`, and `org_id` means *company*.
   *
   * A table carrying `account_id` would be a table isolated at the wrong grain:
   * every company in the group could read it. `public.organizations` is the one
   * legitimate holder of that column — it is the edge that links a company to
   * the account above it.
   */
  it('only organizations carries account_id', () => {
    const offenders: string[] = []

    for (const { file, sql } of migrations()) {
      const tables = sql.matchAll(/create\s+table\s+(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/gi)
      for (const [, table, body] of tables) {
        if (ACCOUNT_TABLES.includes(table)) continue
        if (/^\s*account_id\s/m.test(body)) {
          offenders.push(`${file}: ${table} declares account_id`)
        }
      }

      const altered = sql.matchAll(
        /alter\s+table\s+(?:public\.)?(\w+)([\s\S]*?);/gi,
      )
      for (const [, table, body] of altered) {
        if (table === 'organizations' || ACCOUNT_TABLES.includes(table)) continue
        if (/add\s+column\s+account_id/i.test(body)) {
          offenders.push(`${file}: ${table} gains account_id`)
        }
      }
    }

    expect(
      offenders,
      'A business table carries account_id. Business tables isolate on org_id, which means ' +
        'company — see AGENTS.md.',
    ).toEqual([])
  })
})

describe('billing references are never granted', () => {
  /**
   * `authenticated` may read the plan and nothing else about the money.
   *
   * The plan has to be readable — the sidebar is gated on it — but the payment
   * provider's customer id is not something an employee of one company in the
   * group should be able to read about the group. Migration 08 grants DML on
   * every table in `public` and sets `alter default privileges` to keep doing
   * it, so `accounts` was born permissive and migration 26 has to revoke the
   * table and grant the columns back one at a time.
   *
   * A column cannot be subtracted from a table-wide grant — Postgres warns and
   * does nothing — so "revoke the table, grant the columns" is the only form
   * that works, and this test is what stops it from being simplified back into
   * the form that silently does not.
   */
  const BILLING_COLUMNS = ['billing_customer_id', 'billing_subscription_id', 'billing_status']

  it('revokes the accounts table from authenticated before granting columns', () => {
    const all = migrations().map((m) => m.sql).join('\n')

    expect(all).toMatch(/revoke\s+all\s+on\s+public\.accounts\s+from\s+authenticated/i)

    const grant = all.match(
      /grant\s+select\s*\(([^)]*)\)\s*\n?\s*on\s+public\.accounts\s+to\s+authenticated/i,
    )
    expect(grant, 'no column-scoped SELECT grant on public.accounts').toBeTruthy()

    const granted = grant![1].split(',').map((c) => c.trim())
    expect(granted.sort()).toEqual(['id', 'name', 'onboarding_completed_at', 'plan'])
  })

  it('never names a billing column in any grant', () => {
    const offenders: string[] = []

    for (const { file, sql } of migrations()) {
      for (const [, body] of sql.matchAll(/\bgrant\b([\s\S]*?);/gi)) {
        for (const column of BILLING_COLUMNS) {
          if (body.includes(column)) offenders.push(`${file}: grant names ${column}`)
        }
      }
    }

    expect(
      offenders,
      'A migration grants access to a billing column. Only service_role reads those.',
    ).toEqual([])
  })

  /**
   * The plan is bought, not set — on the account now, as it already was on the
   * company. Both guards must survive, because the dual-read means both columns
   * are live until `organizations.plan` is dropped.
   */
  it('guards the plan column against authenticated on both tables', () => {
    const all = migrations().map((m) => m.sql).join('\n')
    expect(all).toContain('app.guard_plan_change')
    expect(all).toContain('app.guard_account_plan_change')

    for (const fn of ['app.guard_plan_change', 'app.guard_account_plan_change']) {
      const body = all.slice(all.indexOf(`create or replace function ${fn}`))
      expect(body.slice(0, 800), `${fn} does not test current_user`).toContain(
        "current_user = 'authenticated'",
      )
    }
  })
})

describe('plan limits agree between the catalogue and the database', () => {
  /**
   * `public.plan_limits` (migration 28) and `PLANS` in src/lib/plans.ts hold the
   * same numbers, and both are consulted: the application reads the catalogue to
   * disable the button and word the refusal, the trigger reads the table to
   * actually refuse the insert.
   *
   * If they disagree the failure is silent and shaped exactly wrong — the screen
   * offers a company the database will reject, or refuses one it would have
   * allowed. This is the same class of gap that `app.valid_module_keys` had for
   * two migrations with nothing watching it.
   */
  it('every plan in the catalogue has the same limits in the table', () => {
    const sql = readFileSync(
      resolve(MIGRATIONS_DIR, '20260811110000_28_create_company.sql'),
      'utf8',
    )

    const block = sql.match(
      /insert into public\.plan_limits[\s\S]*?values([\s\S]*?);/i,
    )
    expect(block, 'no plan_limits seed found in migration 28').toBeTruthy()

    const rows = [...block![1].matchAll(/\('(\w+)',\s*(null|\d+),\s*(null|\d+)\)/gi)]
    expect(rows.length, 'expected one seeded row per plan').toBe(PLANS.length)

    const inDatabase = new Map(
      rows.map((m) => [
        m[1],
        {
          maxCompanies: m[2] === 'null' ? null : Number(m[2]),
          maxSitesPerCompany: m[3] === 'null' ? null : Number(m[3]),
        },
      ]),
    )

    for (const plan of PLANS) {
      const row = inDatabase.get(plan.key)
      expect(row, `plan ${plan.key} is missing from public.plan_limits`).toBeTruthy()
      expect(row!.maxCompanies, `${plan.key}.max_companies`).toBe(plan.maxCompanies)
      expect(row!.maxSitesPerCompany, `${plan.key}.max_sites_per_company`).toBe(
        plan.maxSitesPerCompany,
      )
    }
  })

  /**
   * Cumulative by construction, like `modules`. A tier that allowed fewer
   * companies than the one below it would make upgrading a downgrade, and the
   * trigger would start refusing companies the customer already has.
   */
  it('a higher tier never allows fewer companies than a lower one', () => {
    for (let i = 1; i < PLANS.length; i++) {
      const lower = PLANS[i - 1].maxCompanies
      const higher = PLANS[i].maxCompanies
      if (higher === null) continue
      expect(lower, `${PLANS[i].key} allows fewer companies than ${PLANS[i - 1].key}`)
        .not.toBeNull()
      expect(higher).toBeGreaterThanOrEqual(lower!)
    }
  })

  /** Every tier must allow at least the one company a signup creates. */
  it('every plan allows at least one company', () => {
    for (const plan of PLANS) {
      expect(plan.maxCompanies === null || plan.maxCompanies >= 1, plan.key).toBe(true)
    }
  })
})

describe('branch scope stays additive', () => {
  /**
   * Site scope was added with RESTRICTIVE policies, which are ANDed with the
   * permissive ones the earlier migrations generated. That is the whole reason
   * migration 31 could ship without editing ~28 existing policy bodies by hand
   * on tables holding live rows.
   *
   * A future policy written permissive by mistake would be ORed instead — it
   * would *widen* access rather than narrow it, and every assertion in
   * supabase/tests/rls/009_sites.sql that checks a restricted person cannot see
   * something would start failing in a way that looks like a test problem.
   */
  it('every site-scope policy is RESTRICTIVE', () => {
    const all = migrations().map((m) => m.sql).join('\n')

    const generator = all.match(
      /create or replace function app\.add_site_scope[\s\S]*?\n\$\$;/,
    )
    expect(generator, 'app.add_site_scope not found').toBeTruthy()
    expect(generator![0]).toContain('as restrictive')

    // And no hand-written site policy slipped in permissive.
    for (const [, body] of all.matchAll(/create policy\s+\w*_site_scope[\s\S]*?;/g)) {
      expect(body, 'a *_site_scope policy is not restrictive').toContain('as restrictive')
    }
  })

  /**
   * `with check` as well as `using`.
   *
   * A restrictive policy with only `using` filters reads and leaves writes
   * open: a restricted person could create rows in a branch they cannot see,
   * and — worse — move a row they *can* see into one they cannot.
   */
  it('site scope applies to writes, not only reads', () => {
    const all = migrations().map((m) => m.sql).join('\n')
    const generator = all.match(/create or replace function app\.add_site_scope[\s\S]*?\n\$\$;/)![0]
    expect(generator).toContain('using      (app.may_access_site(site_id))')
    expect(generator).toContain('with check (app.may_access_site(site_id))')
  })

  /**
   * Seven tables, chosen because a branch is a fact of the business there.
   *
   * Pinned so the list grows deliberately. A branch is where a person works and
   * where stock sits; it is not a property of an invoice or a contract, and
   * giving one to those would invite a filter that quietly hides half the books
   * from somebody assigned to a branch.
   */
  it('only the intended tables carry a branch', () => {
    const all = migrations().map((m) => m.sql).join('\n')
    const scoped = [...all.matchAll(/select app\.add_site_scope\('(\w+)'\)/g)].map((m) => m[1])

    expect([...scoped].sort()).toEqual([
      'cash_sessions', 'dining_tables', 'employees', 'hotel_rooms',
      'inventory_assets', 'restaurant_orders', 'work_orders',
    ])
  })

  /**
   * Restriction is opt-in, and both null-means-yes rules survive.
   *
   * `site_id is null` keeps every pre-migration row visible, and "no rows in
   * membership_sites" keeps every existing member unrestricted. Reversing
   * either would empty the screens of every customer who never asked for
   * branches — the single most damaging way this feature could ship.
   */
  it('an unassigned person and an unbranched row are both allowed', () => {
    const all = migrations().map((m) => m.sql).join('\n')
    const fn = all.slice(all.indexOf('create or replace function app.may_access_site'))
    const body = fn.slice(0, fn.indexOf('$$;'))

    expect(body, 'a row with no branch must be company-wide').toContain('p_site_id is null')
    expect(body, 'a person with no assignment must be unrestricted').toContain('not exists')
  })
})
