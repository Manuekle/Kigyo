import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  PERMISSIONS,
  PERMISSION_LABELS,
  ROUTE_PERMISSIONS,
  SYSTEM_ROLES,
  DEFAULT_ROLE,
  isSystemRole,
  can,
  isPermission,
  permissionsByModule,
  type Permission,
} from './permissions'

const MIGRATIONS_DIR = resolve(process.cwd(), 'supabase/migrations')

/** The core migration, which is where the permission catalogue is seeded. */
const CORE_MIGRATION = resolve(MIGRATIONS_DIR, '20260806090000_01_core.sql')

/**
 * Where roles stopped being global reference data and became tenant rows.
 * `app.seed_default_roles` is what every new organization starts with, and
 * `SYSTEM_ROLES` is the app's copy of that list.
 */
const ROLES_MIGRATION = resolve(MIGRATIONS_DIR, '20260810220000_24_custom_roles.sql')

/**
 * Every permission key inserted into `public.permissions`, across all
 * migrations.
 *
 * This used to read only 01_core.sql, on the assumption that the catalogue was
 * seeded once and never grown. It was grown — migration 14 adds thirty-two
 * keys for the sector modules — and the assumption turned a correct schema
 * into a failing test. Scanning the directory means the next migration to add
 * a permission needs no change here at all.
 */
function permissionsInMigrations(): string[] {
  const keys: string[] = []

  for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
    if (!file.endsWith('.sql')) continue
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8')

    for (const block of sql.matchAll(
      /insert into public\.permissions \(key, module, action, label\) values([\s\S]*?);/g,
    )) {
      keys.push(...[...block[1].matchAll(/\('([a-z-]+:[a-z]+)'/g)].map((m) => m[1]))
    }
  }

  if (keys.length === 0) {
    throw new Error('no permission INSERT block found in supabase/migrations')
  }
  return keys
}

describe('permission catalogue', () => {
  /**
   * The single most important invariant in this file. RLS policies are written
   * against the database catalogue and `assertPermission` against the TS one:
   * if they drift, a permission can be granted in the UI and silently refused
   * by the database, or vice versa.
   */
  it('matches the database catalogue exactly', () => {
    const inDatabase = permissionsInMigrations()
    expect([...inDatabase].sort()).toEqual([...PERMISSIONS].sort())
  })

  it('inserts each permission key into the catalogue exactly once', () => {
    // Two migrations inserting the same key is only harmless while the second
    // keeps its `on conflict do nothing`. Catching the duplicate here is
    // cheaper than discovering it as a failed deploy.
    const inDatabase = permissionsInMigrations()
    expect(new Set(inDatabase).size).toBe(inDatabase.length)
  })

  it('has no duplicates', () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length)
  })

  it('labels every permission', () => {
    for (const permission of PERMISSIONS) {
      expect(PERMISSION_LABELS[permission], `missing label for ${permission}`).toBeTruthy()
    }
    expect(Object.keys(PERMISSION_LABELS).sort()).toEqual([...PERMISSIONS].sort())
  })

  it('uses only the module:action shape', () => {
    for (const permission of PERMISSIONS) {
      expect(permission).toMatch(/^[a-z][a-z0-9-]*:(read|write|manage|use)$/)
    }
  })

  it('maps every dashboard route to a real permission', () => {
    for (const [route, permission] of Object.entries(ROUTE_PERMISSIONS)) {
      expect(isPermission(permission), `${route} → unknown permission`).toBe(true)
    }
  })

  it('rejects the retired verb-scoped keys', () => {
    // The old model in lib/data/nav.ts used ver_/editar_/gestionar_ prefixes.
    // Nothing should accept them any more.
    for (const legacy of ['ver_empleados', 'gestionar_nomina', 'editar_empleados']) {
      expect(isPermission(legacy)).toBe(false)
    }
  })
})

describe('permissionsByModule', () => {
  it('partitions the catalogue without loss', () => {
    const flattened = permissionsByModule().flatMap((g) => g.permissions)
    expect(flattened.sort()).toEqual([...PERMISSIONS].sort())
  })

  it('groups by the module segment', () => {
    for (const group of permissionsByModule()) {
      for (const permission of group.permissions) {
        expect(permission.startsWith(`${group.module}:`)).toBe(true)
      }
    }
  })
})

describe('can', () => {
  const granted: Permission[] = ['tickets:read', 'ia:use']

  it('accepts both a Set and an array', () => {
    expect(can(granted, 'tickets:read')).toBe(true)
    expect(can(new Set(granted), 'tickets:read')).toBe(true)
  })

  it('denies what was not granted', () => {
    expect(can(granted, 'tickets:write')).toBe(false)
    expect(can(new Set(granted), 'nomina:read')).toBe(false)
  })

  it('denies against an empty grant set', () => {
    expect(can([], 'dashboard:read')).toBe(false)
  })
})

describe('roles', () => {
  it('matches what app.seed_default_roles gives a new organization', () => {
    const sql = readFileSync(ROLES_MIGRATION, 'utf8')
    const block = sql.match(
      /insert into public\.roles \(org_id, key, label, rank, is_system\) values([\s\S]*?);/,
    )
    expect(block).toBeTruthy()
    const inDatabase = [...block![1].matchAll(/\(p_org_id, '([^']+)',/g)].map((m) => m[1])
    expect(inDatabase.sort()).toEqual([...SYSTEM_ROLES].sort())
  })

  it('defaults to a role the seed actually creates', () => {
    expect(isSystemRole(DEFAULT_ROLE)).toBe(true)
  })

  /**
   * The point of migration 24. A union type here would have compiled and then
   * rejected «Médico» at runtime, which is the failure mode the change exists
   * to remove — so the openness is pinned rather than left to be re-narrowed
   * by a future refactor that finds `string` too loose.
   */
  it('treats a role the customer invented as a role', () => {
    expect(isSystemRole('Médico')).toBe(false)
  })

  it('no longer seeds a global role catalogue in the core migration', () => {
    const sql = readFileSync(CORE_MIGRATION, 'utf8')
    const later = readFileSync(ROLES_MIGRATION, 'utf8')
    // The core migration still creates the old global table — migrations are
    // append-only history, not a description of the current schema — so what
    // is pinned is that migration 24 replaces it.
    expect(sql).toContain('insert into public.roles (key, label, rank) values')
    expect(later).toContain('drop table if exists public.roles')
  })
})
