import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  COMPANY_TYPES,
  CORE_MODULES,
  MODULE_KEYS,
  isCompanyType,
  isModuleKey,
  modulesByGroup,
  presetFor,
  resolveModules,
} from './modules'
import { PERMISSIONS, ROUTE_PERMISSIONS } from './auth/permissions'

/**
 * The module catalogue is the outer half of the access model: it answers
 * "does this company use this at all", ahead of the per-role permission.
 * These pin the invariants the guards depend on.
 */

describe('module catalogue', () => {
  it('every module key is the module half of at least one permission', () => {
    // If a module key names no permission, `moduleOf()` can never produce it
    // and the module gate silently never fires for that module.
    const fromPermissions = new Set(PERMISSIONS.map((p) => p.split(':')[0]))
    for (const key of MODULE_KEYS) {
      expect(fromPermissions.has(key), `${key} has no permission`).toBe(true)
    }
  })

  it('every route permission belongs to a module or to the core shell', () => {
    // A route whose permission maps to an unknown module would be refused by
    // `RequirePermission` for everyone, forever.
    const known = new Set<string>([...MODULE_KEYS, ...CORE_MODULES])
    for (const [route, permission] of Object.entries(ROUTE_PERMISSIONS)) {
      expect(known.has(permission.split(':')[0]), `${route} → ${permission}`).toBe(true)
    }
  })

  it('does not offer dashboard or configuracion as switchable', () => {
    // Switching configuración off would remove the only screen that can switch
    // it back on.
    for (const core of CORE_MODULES) {
      expect(MODULE_KEYS).not.toContain(core)
    }
  })

  it('groups every module exactly once', () => {
    const grouped = modulesByGroup().flatMap((g) => g.modules.map((m) => m.key))
    expect(grouped.sort()).toEqual([...MODULE_KEYS].sort())
  })
})

describe('company type presets', () => {
  it('only names modules that exist', () => {
    for (const type of COMPANY_TYPES) {
      for (const key of type.modules) {
        expect(isModuleKey(key), `${type.key} → ${key}`).toBe(true)
      }
    }
  })

  it('leaves something switched off, so the preset is a decision', () => {
    // A preset that enables everything has not chosen anything, and the
    // administrator is back to switching a dozen modules off by hand.
    for (const type of COMPANY_TYPES) {
      expect(new Set(type.modules).size, `${type.key} enables everything`)
        .toBeLessThan(MODULE_KEYS.length)
    }
  })

  it('has no duplicates inside a preset', () => {
    for (const type of COMPANY_TYPES) {
      expect(new Set(type.modules).size, type.key).toBe(type.modules.length)
    }
  })

  it('recognises its own keys and rejects anything else', () => {
    for (const type of COMPANY_TYPES) expect(isCompanyType(type.key)).toBe(true)
    expect(isCompanyType('minería-espacial')).toBe(false)
    expect(isCompanyType('')).toBe(false)
  })

  /**
   * `CompanyTypeKey` is derived from the generated database types, so TypeScript
   * already stops this file naming a sector the constraint rejects. It cannot
   * catch the other direction: a sector the *database* accepts and this
   * catalogue never offers is a value `handle_new_user` would happily store and
   * no screen could ever display.
   */
  it('offers every sector the database accepts', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260810120000_14_plans_and_sectors.sql'),
      'utf8',
    )
    const block = sql.match(/add constraint organizations_company_type_check[\s\S]*?in \(([\s\S]*?)\)\);/)
    expect(block, 'company_type check constraint not found in migration 14').toBeTruthy()
    const inDatabase = [...block![1].matchAll(/'([a-z]+)'/g)].map((m) => m[1])
    expect(inDatabase.sort()).toEqual(COMPANY_TYPES.map((t) => t.key).sort())
  })

  /**
   * A sector module exists precisely because one industry needs its own
   * vocabulary. If a sector's preset did not enable it, the module would ship
   * switched off for the only customers it was built for.
   */
  it('enables each sector module in the sector that owns it', () => {
    const owners: Array<[string, string]> = [
      ['salud', 'pacientes'],
      ['educacion', 'estudiantes'],
      ['alimentos', 'restaurante'],
      ['agro', 'agro'],
      ['inmobiliario', 'inmobiliario'],
      ['hoteleria', 'hoteleria'],
      ['ecommerce', 'ecommerce'],
    ]
    for (const [sector, module] of owners) {
      const preset = COMPANY_TYPES.find((t) => t.key === sector)
      expect(preset, `sector ${sector} is missing`).toBeTruthy()
      expect(preset!.modules, `${sector} does not enable ${module}`).toContain(module)
    }
  })
})

describe('resolveModules', () => {
  it('always includes the core modules', () => {
    const resolved = resolveModules(['empleados'], null)
    for (const core of CORE_MODULES) expect(resolved.has(core)).toBe(true)
  })

  it('treats an empty column as "never configured", not "everything off"', () => {
    // Every organization created before the column existed has `{}`. None of
    // them should wake up to an empty sidebar.
    const resolved = resolveModules([], 'servicios')
    expect(resolved.has('proyectos')).toBe(true)
    expect([...resolved].length).toBeGreaterThan(CORE_MODULES.length)
  })

  it('falls back to the whole catalogue when there is no type either', () => {
    const resolved = resolveModules(null, null)
    for (const key of MODULE_KEYS) expect(resolved.has(key), key).toBe(true)
  })

  it('honours an explicit selection over the type preset', () => {
    // The preset is a starting point. Once an administrator has amended it,
    // the amendment wins — otherwise changing the presets in this file would
    // silently rewrite every customer's selection.
    const resolved = resolveModules(['tienda'], 'servicios')
    expect(resolved.has('tienda')).toBe(true)
    expect(resolved.has('proyectos')).toBe(false)
  })

  it('drops unknown keys rather than trusting the column', () => {
    const resolved = resolveModules(['empleados', 'modulo-fantasma'], null)
    expect(resolved.has('empleados')).toBe(true)
    expect(resolved.has('modulo-fantasma')).toBe(false)
  })

  it('presetFor is total: an unknown type opens everything, never nothing', () => {
    // Returning `[]` here would read as "all modules off" and lock the account
    // out of its own sidebar.
    expect(presetFor('no-existe').sort()).toEqual([...MODULE_KEYS].sort())
  })
})
