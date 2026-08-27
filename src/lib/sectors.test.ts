import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  COMPANY_TYPES, MANUAL_START, MODULE_KEYS, SUBSECTOR_PARENT, SUBSECTOR_PRESETS,
  applySectorDelta, presetFor, subsectorsOf,
} from '@/lib/modules'
import { CORE_MODULES, missingHardDependencies, dependentsOf } from '@/lib/modules/registry'
import { EMPTY_CATALOGUE, presetFromCatalogue, proposalForPlan, type SectorCatalogue } from '@/lib/sectors'
import { SUGGESTED_ROLES } from '@/lib/suggested-roles'
import { PLAN_KEYS, planAllows, planModules, type PlanKey } from '@/lib/plans'

const MIGRATIONS_DIR = resolve(process.cwd(), 'supabase/migrations')

function allMigrations(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(resolve(MIGRATIONS_DIR, f), 'utf8'))
    .join('\n')
    .replace(/^\s*--.*$/gm, '')
}

/**
 * The seed, read back out of migration 34.
 *
 * Written as `select '<sector>', k, '<mode>' from unnest(array[…])` rather than
 * one tuple per row: three hundred and sixty single-line tuples are unreadable
 * in review, which for a file whose entire content is product judgement is the
 * property that matters most.
 */
function seededPresets(): Record<string, { add: string[]; remove: string[] }> {
  const sql = allMigrations()
  const rows = [...sql.matchAll(
    /select '([a-z0-9-]+)', k, '(add|remove)' from unnest\(array\[([^\]]*)\]\)/g,
  )]
  expect(rows.length, 'no sector_modules seed found').toBeGreaterThan(0)

  const out: Record<string, { add: string[]; remove: string[] }> = {}
  for (const [, sector, mode, list] of rows) {
    const modules = [...list.matchAll(/'([a-z-]+)'/g)].map((m) => m[1])
    const entry = (out[sector] ??= { add: [], remove: [] })
    entry[mode as 'add' | 'remove'].push(...modules)
  }
  return out
}

/**
 * Which sector each subsector hangs off, read from the `public.sectors` seed.
 *
 * Read rather than inferred from the key. `fitness-gimnasio` belongs to
 * `fitness-bienestar`, so the obvious `key.startsWith(sector + '-')` shortcut
 * gets it wrong — and gets it wrong *silently*, resolving the preset against no
 * parent at all, which is the whole catalogue.
 */
function subsectorParents(): Map<string, string> {
  const sql = allMigrations()
  const rows = [...sql.matchAll(
    /insert into public\.sectors \(key, label, parent_key, sort\) values([\s\S]*?);/g,
  )].flatMap((b) => [...b[1].matchAll(/\('([a-z0-9-]+)',\s*'[^']*',\s*'([a-z0-9-]+)',/g)])
  expect(rows.length, 'no subsector seed found').toBeGreaterThan(0)
  return new Map(rows.map((m) => [m[1], m[2]]))
}

/** A catalogue shaped like the one `getSectors()` returns, from the seed. */
function catalogueFromSeed(): SectorCatalogue {
  const presets = seededPresets()
  return { ...EMPTY_CATALOGUE, presets }
}

const sorted = (xs: readonly string[]) => [...xs].sort()

describe('the presets in the database are the presets in TypeScript', () => {
  /**
   * Two copies of the same product decision, and both are consulted: the
   * signup page previews a sector from `COMPANY_TYPES` before there is a
   * session to query with, and every picker inside the app reads the table.
   *
   * Drift here is invisible and shaped exactly wrong — the customer is shown
   * one set of modules on the way in and given a different one once inside.
   */
  it('every sector proposes the same modules on both sides', () => {
    const seeded = seededPresets()

    for (const sector of COMPANY_TYPES) {
      const row = seeded[sector.key]
      expect(row, `${sector.key} has no rows in sector_modules`).toBeTruthy()
      expect(sorted(row.add), `${sector.key} differs`).toEqual(sorted([...new Set(sector.modules)]))
      // A top-level sector's rows *are* its proposal: there is nothing above it
      // to subtract from, and the trigger in migration 34 refuses the row.
      expect(row.remove, `${sector.key} removes something from nothing`).toEqual([])
    }
  })

  it('every subsector delta is the same on both sides', () => {
    const seeded = seededPresets()
    const sectorKeys = new Set(COMPANY_TYPES.map((t) => t.key))

    for (const [key, delta] of Object.entries(SUBSECTOR_PRESETS)) {
      const row = seeded[key] ?? { add: [], remove: [] }
      expect(sorted(row.add), `${key} adds differently`).toEqual(sorted(delta.add))
      expect(sorted(row.remove), `${key} removes differently`).toEqual(sorted(delta.remove))
    }

    // And nothing in the seed that TypeScript does not know about.
    for (const [key, row] of Object.entries(seeded)) {
      if (sectorKeys.has(key)) continue
      const delta = SUBSECTOR_PRESETS[key]
      expect(delta, `${key} is seeded but absent from SUBSECTOR_PRESETS`).toBeTruthy()
      expect(sorted(row.add)).toEqual(sorted(delta.add))
      expect(sorted(row.remove)).toEqual(sorted(delta.remove))
    }
  })

  it('every subsector delta belongs to a subsector the database seeds', () => {
    for (const key of Object.keys(SUBSECTOR_PRESETS)) {
      expect(subsectorParents().has(key), `${key} is not a subsector in public.sectors`).toBe(true)
    }
  })

  it('only ever names real modules', () => {
    for (const [key, delta] of Object.entries(SUBSECTOR_PRESETS)) {
      for (const named of [...delta.add, ...delta.remove]) {
        expect(MODULE_KEYS, `${key} names ${named}, which is not a module`).toContain(named)
      }
    }
  })
})

describe('what a subsector proposes stays coherent', () => {
  /** Every subsector, paired with the sector it amends. */
  const parentOf = subsectorParents()
  const pairs = Object.keys(SUBSECTOR_PRESETS).map((sub) => ({
    sub,
    parent: parentOf.get(sub) ?? null,
  }))

  it('each one hangs off a sector the catalogue knows', () => {
    const known = new Set(COMPANY_TYPES.map((t) => t.key))
    for (const { sub, parent } of pairs) {
      expect(parent, `${sub} has no parent in public.sectors`).toBeTruthy()
      expect(known.has(parent!), `${sub} hangs off unknown sector ${parent}`).toBe(true)
    }
  })

  /**
   * The same rule the sector presets already have to satisfy. A proposal that
   * offers `tienda` without `catalogos` hands the customer a storefront with
   * nothing in it, and `updateModules` then quietly corrects it — so the
   * catalogue would be describing something the product does not do.
   */
  it('the resolved preset is closed under hard dependencies', () => {
    for (const { sub, parent } of pairs) {
      const resolved = presetFor(parent, sub)
      expect(
        missingHardDependencies(resolved),
        `${sub} proposes a module without its hard dependency`,
      ).toEqual([])
    }
  })

  /**
   * The same failure from the other side: `remove` must not take a module that
   * something left in the proposal cannot work without. Removing `inventario`
   * while `produccion` stays is exactly as broken as adding `produccion`
   * without `inventario`, and only this direction is easy to write by accident.
   */
  it('never removes something the rest of the proposal depends on', () => {
    for (const { sub, parent } of pairs) {
      const resolved = new Set(presetFor(parent, sub))
      for (const removed of SUBSECTOR_PRESETS[sub].remove) {
        expect(
          dependentsOf(removed, resolved),
          `${sub} removes ${removed}, which is still required`,
        ).toEqual([])
      }
    }
  })

  it('leaves a usable product, not an empty one and not the whole catalogue', () => {
    for (const { sub, parent } of pairs) {
      const resolved = presetFor(parent, sub)
      expect(resolved.length, `${sub} proposes almost nothing`).toBeGreaterThan(4)
      expect(resolved.length, `${sub} proposes everything`).toBeLessThan(MODULE_KEYS.length)
    }
  })

  it('actually differs from its parent — otherwise it is a question with no answer', () => {
    for (const { sub, parent } of pairs) {
      expect(
        sorted(presetFor(parent, sub)),
        `${sub} proposes exactly what ${parent} does`,
      ).not.toEqual(sorted(presetFor(parent)))
    }
  })
})

describe('resolving a preset from the catalogue', () => {
  const catalogue = catalogueFromSeed()

  it('gives the same answer as TypeScript for every sector and subsector', () => {
    for (const sector of COMPANY_TYPES) {
      expect(sorted(presetFromCatalogue(catalogue, sector.key))).toEqual(sorted(presetFor(sector.key)))
    }
    const parentOf = subsectorParents()
    for (const sub of Object.keys(SUBSECTOR_PRESETS)) {
      const parent = parentOf.get(sub)!
      expect(sorted(presetFromCatalogue(catalogue, parent, sub))).toEqual(
        sorted(presetFor(parent, sub)),
      )
    }
  })

  /**
   * The reason this function exists at all.
   *
   * `presetFor()` answers an unknown key with *every module*, which is correct
   * for its own job — an account that predates `enabled_modules` must not wake
   * up to an empty sidebar — and catastrophic for a sector somebody inserted as
   * data: whoever picked «Moda» would have all thirty-five modules switched on,
   * which is the exact mess `MANUAL_START` was introduced to prevent.
   */
  it('falls back to the manual start for a sector nothing knows about', () => {
    expect(presetFromCatalogue(catalogue, 'moda')).toEqual(MANUAL_START)
    expect(presetFor('moda')).toEqual(MODULE_KEYS) // the behaviour being avoided
  })

  it('uses the database rows for a sector TypeScript has never heard of', () => {
    const withNewSector: SectorCatalogue = {
      ...catalogue,
      presets: {
        ...catalogue.presets,
        moda: { add: ['catalogos', 'inventario', 'clientes'], remove: [] },
        'moda-boutique': { add: ['tienda'], remove: ['inventario'] },
      },
    }
    expect(sorted(presetFromCatalogue(withNewSector, 'moda'))).toEqual(
      ['catalogos', 'clientes', 'inventario'],
    )
    expect(sorted(presetFromCatalogue(withNewSector, 'moda', 'moda-boutique'))).toEqual(
      ['catalogos', 'clientes', 'tienda'],
    )
  })

  it('treats no sector as the manual path', () => {
    expect(presetFromCatalogue(catalogue, null)).toEqual(MANUAL_START)
    expect(presetFromCatalogue(EMPTY_CATALOGUE, null)).toEqual(MANUAL_START)
  })
})

describe('the delta arithmetic', () => {
  it('adds first and removes second, so remove is the last word', () => {
    expect(applySectorDelta(['a'], { add: ['b'], remove: ['b'] })).toEqual(['a'])
  })

  it('is a no-op without a delta', () => {
    expect(applySectorDelta(['a', 'b'])).toEqual(['a', 'b'])
    expect(applySectorDelta(['a', 'b'], null)).toEqual(['a', 'b'])
  })

  it('does not mutate what it was given', () => {
    const base = ['a', 'b']
    applySectorDelta(base, { add: ['c'], remove: ['a'] })
    expect(base).toEqual(['a', 'b'])
  })

  it('ignores a removal of something that was never there', () => {
    expect(applySectorDelta(['a'], { add: [], remove: ['z'] })).toEqual(['a'])
  })
})

/**
 * The wizard must never propose a selection its own server function refuses.
 *
 * `updateSector` rejects the whole write if any submitted key falls outside the
 * plan, and the module step used to seed `selected` with the raw sector preset.
 * Every one of the twenty-three sectors proposes modules Starter does not
 * carry, so «Continuar» failed for every Starter customer on every sector —
 * with an error naming modules that were not even on screen, since the toggle
 * list *was* filtered by the plan. The only way out of the wizard was «Saltar».
 *
 * This pins the two halves together: whatever the client seeds must survive the
 * server's gate, for every sector and every tier.
 */
describe('the wizard proposes only what the plan can save', () => {
  const planGate = (plan: PlanKey, modules: string[]) =>
    modules.filter((key) => !planAllows(plan, key))

  it.each(PLAN_KEYS)('%s: no sector proposes a module the plan refuses', (plan) => {
    const allowed = planModules(plan)
    for (const sector of [null, ...COMPANY_TYPES.map((t) => t.key)]) {
      // The very function onboarding/client.tsx seeds `selected` from.
      const proposed = proposalForPlan(EMPTY_CATALOGUE, allowed, sector).included
      // Exactly what updateSector submits, and what its gate checks.
      const submitted = proposed.filter((k) => !CORE_MODULES.includes(k))
      expect(planGate(plan, submitted), `sector ${sector ?? 'manual'} on ${plan}`).toEqual([])
      expect(submitted.length, `sector ${sector ?? 'manual'} on ${plan} saves nothing`)
        .toBeGreaterThan(0)
    }
  })

  it('still proposes the sector module when the plan reaches it', () => {
    // The filter must cut by plan, not gut the proposal: Growth carries the
    // verticals, so a clinic on Growth still starts with `pacientes`.
    const growth = planModules('growth')
    const salud = proposalForPlan(EMPTY_CATALOGUE, growth, 'salud').included
    expect(salud).toContain('pacientes')
  })
})

/**
 * El invariante que hace seguro sembrar los roles del sector automáticamente.
 *
 * Desde que `updateSector` llama a `seed_suggested_roles`, elegir un sector
 * crea sus roles sin que nadie los revise. Un rol que nombra un módulo que el
 * preset de su sector no enciende es, en ese momento, una promesa vacía: la
 * persona invitada como «Recepcionista» abre el menú y no encuentra la pantalla
 * que su rol dice abrir — y la culpa la carga el rol, que sí tenía el permiso.
 *
 * Vive aquí y no en `suggested-roles.test.ts` porque las dos piezas que hacen
 * falta ya están en este archivo: `presetFor` y, sobre todo, `subsectorParents`,
 * que se lee del seed justo porque deducir el padre de la clave se equivoca en
 * silencio con `fitness-gimnasio`.
 */
describe('un rol sugerido solo nombra módulos que su sector enciende', () => {
  const parentOf = subsectorParents()
  const known = new Set<string>(COMPANY_TYPES.map((t) => t.key))

  it('para los 23 sectores y sus subsectores', () => {
    for (const [key, roles] of Object.entries(SUGGESTED_ROLES)) {
      // La clave es un sector, o el subsector cuyo padre dice el seed.
      const parent = parentOf.get(key) ?? null
      const [sector, subsector] = parent ? [parent, key] : [key, null]
      expect(known.has(sector), `${key} no cuelga de ningún sector conocido`).toBe(true)

      const preset = new Set([...presetFor(sector, subsector), ...CORE_MODULES])
      for (const role of roles) {
        for (const permission of role.permissions) {
          const [moduleKey] = permission.split(':')
          expect(
            preset.has(moduleKey),
            `${key}/${role.key} abre ${permission}, y ${sector}` +
              `${subsector ? ` → ${subsector}` : ''} no enciende ${moduleKey}`,
          ).toBe(true)
        }
      }
    }
  })
})

/**
 * El árbol de sectores, fijado en las dos direcciones.
 *
 * `SUBSECTOR_PARENT` es una copia de `parent_key` en `public.sectors`, y una
 * copia sin guardia es una copia que se desincroniza el día que alguien añade
 * un subsector por INSERT — que es justo el caso de uso para el que los
 * sectores viven en la base y no en el código.
 */
describe('SUBSECTOR_PARENT es el árbol que siembra la base', () => {
  const seeded = subsectorParents()

  it('cubre exactamente lo mismo, en ambas direcciones', () => {
    for (const [key, parent] of seeded) {
      expect(SUBSECTOR_PARENT[key], `la base cuelga ${key} de ${parent} y TS no`).toBe(parent)
    }
    for (const [key, parent] of Object.entries(SUBSECTOR_PARENT)) {
      expect(seeded.get(key), `TS cuelga ${key} de ${parent} y la base no lo siembra`).toBe(parent)
    }
  })

  it('todo padre es un sector conocido', () => {
    const known = new Set<string>(COMPANY_TYPES.map((t) => t.key))
    for (const parent of new Set(Object.values(SUBSECTOR_PARENT))) {
      expect(known.has(parent), `${parent} no es un sector`).toBe(true)
    }
  })

  it('subsectorsOf no se deja engañar por el prefijo', () => {
    // El caso que hace falso el atajo `key.startsWith(sector + '-')`.
    expect(subsectorsOf('fitness-bienestar')).toContain('fitness-gimnasio')
    expect(subsectorsOf('salud')).toEqual(
      Object.keys(SUBSECTOR_PARENT).filter((k) => SUBSECTOR_PARENT[k] === 'salud'),
    )
  })
})
