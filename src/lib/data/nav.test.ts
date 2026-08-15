import { describe, expect, it } from 'vitest'
import { navFor, NAV } from './nav'
import { MODULE_GROUPS, REGISTRY } from '@/lib/modules/registry'
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
