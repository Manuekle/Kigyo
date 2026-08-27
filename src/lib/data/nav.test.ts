import { describe, expect, it } from 'vitest'
import { moduleRankFor, navFor, NAV } from './nav'
import { MODULE_GROUPS, REGISTRY } from '@/lib/modules/registry'
import { NAV_ICON_NAMES } from './nav-icons'
import { COMPANY_TYPES, SECTOR_NAV } from '@/lib/modules'

/**
 * The sidebar's shape, which is the part of it that has an opinion.
 *
 * `registry.test.ts` already pins the *contents* — that every module with an
 * icon appears exactly once, headings and routes included. These are about
 * order and naming: the four things `navFor` exists to do, each of which was a
 * complaint about the old flat nav before it was a test.
 */

const labels = (sector: string | null) =>
  navFor(sector).map((s) => s.label)

describe('navFor', () => {
  it('puts the sector on top and the tools at the bottom', () => {
    const sections = navFor('salud')

    // Dashboard leads, unlabelled.
    expect(sections[0].label).toBeUndefined()
    expect(sections[0].items.map((i) => i.key)).toEqual(['dashboard'])

    // Then the vertical, under the name of the business rather than under
    // «Sectoriales» — and above Personas, which is where it used to be buried.
    expect(sections[1].label).toBe('Clínica')
    expect(sections[1].items.map((i) => i.key)).toContain('pacientes')

    expect(sections.at(-1)?.label).toBe('Herramientas')
    expect(sections.at(-1)?.items.map((i) => i.key)).toEqual(['ia'])
  })

  it('orders the general groups per sector', () => {
    // A factory opens on Operación; an agency on Comercial. Both used to open
    // on Personas, which is the state this exists to prevent regressing to.
    expect(labels('manufactura').indexOf('Operación'))
      .toBeLessThan(labels('manufactura').indexOf('Personas'))
    expect(labels('servicios').indexOf('Comercial'))
      .toBeLessThan(labels('servicios').indexOf('Personas'))
  })

  it('falls back to the catalogue order for a sector with no opinion', () => {
    // «Otro» is deliberately absent from SECTOR_NAV.
    expect(SECTOR_NAV.otro).toBeUndefined()
    // Sectoriales is excluded: it has been promoted above these and keeps its
    // catalogue name only because this sector has no business to name it after.
    const general = labels('otro').filter(
      (l) => l !== 'Sectoriales' && (MODULE_GROUPS as readonly string[]).includes(l ?? ''),
    )
    expect(general).toEqual(['Personas', 'Operación', 'Comercial', 'Equipo'])
  })

  it('renders every group exactly once, whatever the sector', () => {
    // A partial `groupOrder` appends the rest, and the bug that invites is a
    // group listed both by name and by the fallback.
    for (const sector of [null, ...Object.keys(SECTOR_NAV)]) {
      const seen = labels(sector).filter(Boolean)
      expect(new Set(seen).size, `${sector} repeats a heading`).toBe(seen.length)
    }
  })

  it('nests an alias under its module instead of beside it', () => {
    const items = NAV.flatMap((s) => s.items)
    expect(items.map((i) => i.key)).not.toContain('ordenes-compra')
    expect(items.map((i) => i.key)).not.toContain('proveedores')
    expect(items.find((i) => i.key === 'compras')?.children?.map((c) => c.key))
      .toEqual(['ordenes-compra', 'proveedores'])
  })

  it('names the group for every sector that has a vertical', () => {
    // A sector whose defining module would appear under the bare word
    // «Sectoriales» is one the nav has nothing to say about the business of.
    const verticals = new Set(
      REGISTRY.filter((m) => m.group === 'Sectoriales').map((m) => m.key),
    )
    for (const type of COMPANY_TYPES) {
      if (!type.vertical || !verticals.has(type.vertical)) continue
      expect(SECTOR_NAV[type.key]?.navLabel, `${type.key} has no navLabel`).toBeTruthy()
    }
  })
})

/**
 * One icon map, and it covers the registry.
 *
 * There used to be two written by hand against the same list: fifty entries in
 * `Sidebar` and twenty-six in `CommandPalette`. The palette was missing every
 * sectoral module, so searching «Pacientes» in a clinic returned a row with an
 * empty square where the icon goes — and `ICON_MAP[name]` has no fallback, so
 * nothing distinguished that from a module with no icon. It also carried
 * `PenTool`, which no module has ever declared.
 *
 * Pinned in both directions: a module whose icon is missing fails the first
 * assertion, and an icon kept around after the module that used it was renamed
 * fails the second.
 */
describe('the nav icon map', () => {
  const declared = new Set(
    REGISTRY.flatMap((m) => [m.icon, ...(m.aliases ?? []).map((a) => a.icon)]).filter(
      (i): i is string => typeof i === 'string',
    ),
  )

  it('answers to every icon the registry names', () => {
    for (const name of declared) {
      expect(NAV_ICON_NAMES, `el registro pide ${name} y el mapa no lo tiene`).toContain(name)
    }
  })

  it('carries nothing the registry does not name', () => {
    for (const name of NAV_ICON_NAMES) {
      expect(declared.has(name), `el mapa lleva ${name} y ningún módulo lo usa`).toBe(true)
    }
  })
})

/**
 * El mismo criterio para el rail y para las baldosas del inicio.
 *
 * El dashboard empujaba sus KPI en una lista literal que terminaba en
 * `… inventario, ocupacion, pacientes`, así que una clínica —el sector cuyo nav
 * se reescribió precisamente para poner «Clínica» arriba— encontraba «Pacientes
 * activos» de última, detrás de Empleados y de Tickets. Ahora las dos pantallas
 * ordenan con esta función, y estas son las tres cosas que tiene que cumplir.
 */
describe('moduleRankFor', () => {
  it('pone el vertical por delante de todo', () => {
    const salud = moduleRankFor('salud')
    for (const key of ['empleados', 'tickets', 'clientes', 'facturacion', 'inventario']) {
      expect(salud('pacientes'), `pacientes debería ir antes que ${key}`).toBeLessThan(salud(key))
    }
  })

  it('respeta el orden de grupos de cada sector', () => {
    // Una fábrica abre en Operación; una agencia, en Comercial.
    const fabrica = moduleRankFor('manufactura')
    expect(fabrica('inventario')).toBeLessThan(fabrica('empleados'))
    const agencia = moduleRankFor('servicios')
    expect(agencia('clientes')).toBeLessThan(agencia('empleados'))
  })

  it('coincide con el orden de las secciones que dibuja navFor', () => {
    for (const sector of [null, ...COMPANY_TYPES.map((t) => t.key)]) {
      const rank = moduleRankFor(sector)
      const sections = navFor(sector).filter((s) => s.items.length > 0)
      /*
       * Se recortan los dos extremos, y los dos por la misma razón: no son
       * grupos, son posiciones que el sidebar impone. La primera sección es
       * `dashboard` —armazón, `group: null`— y la última es «Herramientas», que
       * baja el asistente al pie aunque `ia` pertenezca a Equipo. Entre medias,
       * los rangos tienen que venir no decrecientes.
       */
      const ranks = sections
        .slice(1, -1)
        .map((s) => rank(s.items[0].key))
        .filter((r) => r !== 99)
      const sorted = [...ranks].sort((a, b) => a - b)
      expect(ranks, `el orden de ${sector ?? 'manual'} no coincide`).toEqual(sorted)
    }
  })
})
