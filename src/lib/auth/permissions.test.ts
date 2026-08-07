import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  PERMISSIONS,
  PERMISSION_LABELS,
  ROUTE_PERMISSIONS,
  ROLES,
  can,
  isPermission,
  permissionsByModule,
  type Permission,
} from './permissions'

const MIGRATION = resolve(
  process.cwd(),
  'supabase/migrations/20260806090000_01_core.sql',
)

/** The permission keys the migration inserts into public.permissions. */
function permissionsInMigration(): string[] {
  const sql = readFileSync(MIGRATION, 'utf8')
  const block = sql.match(
    /insert into public\.permissions \(key, module, action, label\) values([\s\S]*?);/,
  )
  if (!block) throw new Error('permission INSERT block not found in the migration')
  return [...block[1].matchAll(/\('([a-z-]+:[a-z]+)'/g)].map((m) => m[1])
}

describe('permission catalogue', () => {
  /**
   * The single most important invariant in this file. RLS policies are written
   * against the database catalogue and `assertPermission` against the TS one:
   * if they drift, a permission can be granted in the UI and silently refused
   * by the database, or vice versa.
   */
  it('matches the database catalogue exactly', () => {
    const inDatabase = permissionsInMigration()
    expect([...inDatabase].sort()).toEqual([...PERMISSIONS].sort())
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
  it('matches the roles seeded by the migration', () => {
    const sql = readFileSync(MIGRATION, 'utf8')
    const block = sql.match(/insert into public\.roles \(key, label, rank\) values([\s\S]*?);/)
    expect(block).toBeTruthy()
    const inDatabase = [...block![1].matchAll(/\('([^']+)',/g)].map((m) => m[1])
    expect(inDatabase.sort()).toEqual([...ROLES].sort())
  })
})
