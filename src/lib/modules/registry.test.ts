import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CORE_MODULES, MODULE_DEPENDENCIES, MODULE_GROUPS, REGISTRY,
  missingHardDependencies,
} from './registry'
import { COMPANY_TYPES, MANUAL_START, MODULE_KEYS, MODULES } from '@/lib/modules'
import { PERMISSIONS, ROUTE_PERMISSIONS } from '@/lib/auth/permissions'
import { NAV, META, META_SUB, ROUTE_MAP } from '@/lib/data/nav'

const MIGRATIONS_DIR = resolve(process.cwd(), 'supabase/migrations')

/**
 * Every migration, with `--` comments stripped.
 *
 * Stripping matters: these assertions find a statement by matching up to its
 * terminating semicolon, and a semicolon inside a prose comment truncates the
 * match. That failure is silent and looks like an empty seed rather than a
 * broken regular expression — which is exactly how it presented the first time.
 */
function allMigrations(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(resolve(MIGRATIONS_DIR, f), 'utf8'))
    .join('\n')
    .replace(/^\s*--.*$/gm, '')
}

/**
 * The gap this file was written to close.
 *
 * Five structures described a module, and two of them had a test watching them:
 * `PERMISSIONS` was pinned against the migrations' INSERTs, and the sector list
 * against its CHECK constraint. `app.valid_module_keys()` — the function that
 * decides which keys `organizations.enabled_modules` will accept — had nothing.
 *
 * A module added to the catalogue and forgotten there does not fail at build
 * time, or at deploy time, or on any screen. It fails when an administrator
 * saves their module selection and gets a `check_violation`: an opaque database
 * error, for a mistake made weeks earlier, in a function nobody would think to
 * look at.
 */
describe('the SQL side knows the same modules', () => {
  it('app.valid_module_keys accepts exactly the switchable catalogue', () => {
    const sql = allMigrations()

    // The last definition wins — migrations are append-only, so a later
    // `create or replace` is the one the database ends up with.
    const definitions = [
      ...sql.matchAll(
        /create or replace function app\.valid_module_keys[\s\S]*?where k not in \(([\s\S]*?)\)\s*\);/g,
      ),
    ]
    expect(definitions.length, 'no app.valid_module_keys definition found').toBeGreaterThan(0)

    const latest = definitions[definitions.length - 1][1]
    const inDatabase = [...latest.matchAll(/'([a-z-]+)'/g)].map((m) => m[1])

    expect([...inDatabase].sort()).toEqual([...MODULE_KEYS].sort())
  })

  /**
   * The shell must never be storable in `enabled_modules`.
   *
   * Storing `dashboard` would imply it could be switched off, and the column's
   * "empty means never configured" semantics would start disagreeing with
   * itself: a company that had switched everything off except the shell would
   * be indistinguishable from one that had never been configured at all.
   */
  it('app.valid_module_keys rejects the core modules', () => {
    const sql = allMigrations()
    const definitions = [
      ...sql.matchAll(
        /create or replace function app\.valid_module_keys[\s\S]*?where k not in \(([\s\S]*?)\)\s*\);/g,
      ),
    ]
    const latest = definitions[definitions.length - 1][1]
    for (const core of CORE_MODULES) {
      expect(latest, `${core} must not be storable in enabled_modules`).not.toContain(`'${core}'`)
    }
  })
})

describe('the registry is the only list', () => {
  it('every projection covers exactly the registry', () => {
    const keys = REGISTRY.map((m) => m.key)

    // Permissions: one module, at least one action, no orphans either way.
    const permissionModules = new Set(PERMISSIONS.map((p) => p.split(':')[0]))
    expect([...permissionModules].sort()).toEqual([...keys].sort())

    // Nav: every entry with an icon, plus every alias — the aliases nested
    // under their parent rather than beside it, which is the whole reason the
    // children have to be walked to make this comparison.
    const navKeys = NAV.flatMap((s) =>
      s.items.flatMap((i) => [i.key, ...(i.children ?? []).map((c) => c.key)]),
    ).sort()
    const expectedNav = REGISTRY.flatMap((m) =>
      m.icon ? [m.key, ...(m.aliases ?? []).map((a) => a.key)] : [],
    ).sort()
    expect(navKeys).toEqual(expectedNav)

    // Nothing appears twice. `ia` and `configuracion` are lifted out of their
    // groups into «Herramientas», and the bug that lift invites is rendering
    // them in both places.
    expect(new Set(navKeys).size, 'a nav key is rendered twice').toBe(navKeys.length)

    // Headings and routes cover the registry and its aliases.
    const withAliases = REGISTRY.flatMap((m) => [m.key, ...(m.aliases ?? []).map((a) => a.key)])
    for (const key of withAliases) {
      expect(META[key], `${key} has no heading`).toBeTruthy()
      expect(META_SUB[key], `${key} has no subheading`).toBeTruthy()
      expect(ROUTE_MAP[key], `${key} has no route`).toBeTruthy()
      expect(ROUTE_PERMISSIONS[key], `${key} maps to no permission`).toBeTruthy()
    }
  })

  it('has no duplicate keys, aliases included', () => {
    const all = REGISTRY.flatMap((m) => [m.key, ...(m.aliases ?? []).map((a) => a.key)])
    expect(new Set(all).size).toBe(all.length)
  })

  /**
   * An alias is a second screen of an existing module, never a module. Modelled
   * the other way it would appear in the plan catalogue and in
   * `enabled_modules` as a toggle that switched nothing.
   */
  it('aliases are not modules', () => {
    const aliases = REGISTRY.flatMap((m) => (m.aliases ?? []).map((a) => a.key))
    for (const alias of aliases) {
      expect(MODULE_KEYS, `${alias} leaked into the module catalogue`).not.toContain(alias)
      expect(REGISTRY.some((m) => m.key === alias)).toBe(false)
    }
  })

  it('routes are unique and live under /dashboard', () => {
    const routes = REGISTRY.flatMap((m) => [m.route, ...(m.aliases ?? []).map((a) => a.route)])
    expect(new Set(routes).size).toBe(routes.length)
    for (const route of routes) expect(route.startsWith('/dashboard')).toBe(true)
  })

  it('every switchable module has a group the sidebar renders', () => {
    for (const m of MODULES) {
      expect(MODULE_GROUPS, `${m.key} sits under an unknown heading`).toContain(m.group)
    }
  })

  /**
   * The shell is defined by having no group, and nothing else may rely on the
   * two names. `CORE_MODULES` is derived from that, so a third core module
   * would need only a registry entry with `group: null`.
   */
  it('the shell is exactly the ungrouped entries', () => {
    const ungrouped = REGISTRY.filter((m) => m.group === null).map((m) => m.key)
    expect([...CORE_MODULES].sort()).toEqual([...ungrouped].sort())
    for (const core of CORE_MODULES) {
      expect(MODULE_KEYS, `${core} is the shell and must not be switchable`).not.toContain(core)
    }
  })

  it('declares at least one action per module', () => {
    for (const m of REGISTRY) {
      expect(m.actions.length, `${m.key} defines no action`).toBeGreaterThan(0)
      expect(new Set(m.actions).size, `${m.key} repeats an action`).toBe(m.actions.length)
    }
  })
})

describe('dependencies agree with the database', () => {
  /**
   * `MODULE_DEPENDENCIES` and the seed in migration 29 are the same rule stored
   * twice, and both are consulted: the screen uses the catalogue to explain and
   * pre-tick, `updateModules` uses it to fold hard dependencies in. Divergence
   * would be silent and shaped exactly wrong — a module the customer thinks is
   * required and the product does not add, or the reverse.
   */
  it('every dependency in the catalogue is seeded, and vice versa', () => {
    const sql = allMigrations()
    // Every block, not just the first. Migration 29 seeded the original set and
    // each new module appends its own — matching once found 29's list and
    // reported the new module's dependency as missing from a database that had
    // it, which is the opposite of what this test is for.
    const blocks = [...sql.matchAll(
      /insert into public\.module_dependencies \(module_key, requires_key, kind\) values([\s\S]*?);/g,
    )]
    expect(blocks.length, 'no module_dependencies seed found').toBeGreaterThan(0)

    const inDatabase = blocks
      .flatMap((block) => [...block[1].matchAll(/\('([\w-]+)',\s*'([\w-]+)',\s*'(hard|soft)'\)/g)])
      .map((m) => `${m[1]}->${m[2]}:${m[3]}`)
      .sort()

    const inCatalogue = MODULE_DEPENDENCIES
      .map((d) => `${d.module}->${d.requires}:${d.kind}`)
      .sort()

    expect(inDatabase).toEqual(inCatalogue)
  })

  it('only ever names real modules', () => {
    for (const d of MODULE_DEPENDENCIES) {
      expect(MODULE_KEYS, `${d.module} is not a module`).toContain(d.module)
      expect(MODULE_KEYS, `${d.requires} is not a module`).toContain(d.requires)
    }
  })

  /**
   * A cycle cannot be resolved: enabling either module would enable both
   * forever, and disabling either would be refused by the other. The database
   * refuses one at insert; this catches it before the migration is even run.
   */
  it('has no cycles', () => {
    const edges = new Map<string, string[]>()
    for (const d of MODULE_DEPENDENCIES) {
      edges.set(d.module, [...(edges.get(d.module) ?? []), d.requires])
    }

    const state = new Map<string, 'visiting' | 'done'>()
    const walk = (node: string, trail: string[]): void => {
      if (state.get(node) === 'done') return
      expect(state.get(node), `cycle: ${[...trail, node].join(' → ')}`).not.toBe('visiting')
      state.set(node, 'visiting')
      for (const next of edges.get(node) ?? []) walk(next, [...trail, node])
      state.set(node, 'done')
    }
    for (const key of edges.keys()) walk(key, [])
  })

  /**
   * A preset that proposes a module without its hard dependencies would hand a
   * customer an incoherent starting point on their very first day — and it is
   * `updateModules` that would quietly correct it, which means the sector
   * catalogue would be describing something the product does not do.
   */
  it('every sector preset is already closed under hard dependencies', () => {
    for (const sector of COMPANY_TYPES) {
      expect(
        missingHardDependencies(sector.modules),
        `preset for ${sector.key} is missing a hard dependency`,
      ).toEqual([])
    }
  })

  it('the manual start is closed under hard dependencies too', () => {
    expect(missingHardDependencies(MANUAL_START)).toEqual([])
  })
})

describe('sectors agree with the database', () => {
  /**
   * The sector vocabulary moved into `public.sectors` in migration 29, so the
   * CHECK constraint that `modules.test.ts` pins is now history. What has to
   * agree from here on is the catalogue in TypeScript and the seed in the
   * migration — a sector offered by the picker but absent from the table is a
   * value `create_company` will silently drop.
   */
  it('offers exactly the sectors the table seeds', () => {
    const sql = allMigrations()
    // `g`: the vocabulary spans more than one migration — 29 seeded the
    // original list, 33 added Fitness y bienestar.
    const blocks = [...sql.matchAll(
      /insert into public\.sectors \(key, label, sort\) values([\s\S]*?);/g,
    )]
    expect(blocks.length, 'no top-level sector seed found').toBeGreaterThan(0)

    const inDatabase = blocks.flatMap((b) =>
      [...b[1].matchAll(/\('([a-z-]+)',/g)].map((m) => m[1]),
    )
    expect([...inDatabase].sort()).toEqual(COMPANY_TYPES.map((t) => t.key).sort())
  })

  /** Every subsector must hang off a sector the picker actually offers. */
  it('every subsector belongs to a real sector, one level deep', () => {
    const sql = allMigrations()
    const blocks = [...sql.matchAll(
      /insert into public\.sectors \(key, label, parent_key, sort\) values([\s\S]*?);/g,
    )]
    expect(blocks.length, 'no subsector seed found').toBeGreaterThan(0)

    const rows = blocks.flatMap((b) =>
      [...b[1].matchAll(/\('([a-z-]+)',\s*'[^']*',\s*'([a-z-]+)',/g)],
    )
    expect(rows.length).toBeGreaterThan(0)

    // Widened to `string`: the parents come out of the SQL as plain text, and
    // whether each one is a known sector key is precisely what is being asked.
    const sectorKeys = new Set<string>(COMPANY_TYPES.map((t) => t.key))
    const subKeys = new Set(rows.map((m) => m[1]))

    for (const [, key, parent] of rows) {
      expect(sectorKeys.has(parent), `${key} hangs off unknown sector ${parent}`).toBe(true)
      expect(subKeys.has(parent), `${key} hangs off another subsector`).toBe(false)
    }
  })
})
