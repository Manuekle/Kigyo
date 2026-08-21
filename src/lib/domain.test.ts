import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import * as domain from './domain'
import {
  ASSET_STATUSES, assetStatusFor, dayCount, lineTotalCents, pesosToCents,
  daysUntil, netFromGross, projectStateError, rangesOverlap, sumLinesCents, taxWithin, todayIn,
} from './domain'

/**
 * The enumerated vocabularies in lib/domain.ts must match the `check (... in
 * (...))` constraints in the migrations.
 *
 * This is the one class of bug the type system cannot catch: every list here
 * is `as const`, so TypeScript is perfectly happy with a value the database
 * will reject at 3am with `violates check constraint`. Worse is the reverse —
 * a status the column allows but the app never offers, which is simply
 * unreachable and looks like a missing feature.
 *
 * Rather than restating the SQL, the constraints are parsed out of the
 * migration files, so adding a value in one place and not the other fails
 * here instead of in production.
 */

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations')

const sql = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))
  .join('\n')

/**
 * Pulls the allowed values of `<table>.<column>` out of its check constraint.
 *
 * Matches the column's own definition line and the `check (col in (...))` that
 * follows it, which is how every one of these is written in the schema.
 */
function allowedValues(table: string, column: string): string[] {
  // Isolate the CREATE TABLE body first: `status` appears on a dozen tables,
  // and a global search would happily return another table's list.
  const tableMatch = new RegExp(
    `create table public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`,
    'i',
  ).exec(sql)
  if (!tableMatch) throw new Error(`No CREATE TABLE found for public.${table}`)

  const body = tableMatch[1]
  const checkMatch = new RegExp(
    `${column}\\s+[\\s\\S]*?check\\s*\\(\\s*${column}\\s+in\\s*\\(([\\s\\S]*?)\\)\\s*\\)`,
    'i',
  ).exec(body)
  if (!checkMatch) throw new Error(`No check constraint found for ${table}.${column}`)

  return [...checkMatch[1].matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'"))
}

/** [label, the TS list, table, column] */
const CASES: Array<[string, readonly string[], string, string]> = [
  ['PROJECT_STATUSES', domain.PROJECT_STATUSES, 'projects', 'status'],
  ['PROJECT_KINDS', domain.PROJECT_KINDS, 'projects', 'kind'],
  ['TICKET_AREAS', domain.TICKET_AREAS, 'tickets', 'area'],
  ['TICKET_PRIORITIES', domain.TICKET_PRIORITIES, 'tickets', 'priority'],
  ['TICKET_STATUSES', domain.TICKET_STATUSES, 'tickets', 'status'],
  ['EMPLOYEE_STATUSES', domain.EMPLOYEE_STATUSES, 'employees', 'status'],
  ['EMPLOYMENT_TYPES', domain.EMPLOYMENT_TYPES, 'employees', 'employment_type'],
  ['ABSENCE_KINDS', domain.ABSENCE_KINDS, 'absences', 'kind'],
  ['ABSENCE_STATUSES', domain.ABSENCE_STATUSES, 'absences', 'status'],
  ['PAYROLL_STATUSES', domain.PAYROLL_STATUSES, 'payroll_periods', 'status'],
  ['RISK_CATEGORIES', domain.RISK_CATEGORIES, 'risks', 'category'],
  ['RISK_SEVERITIES', domain.RISK_SEVERITIES, 'risks', 'severity'],
  ['RISK_STATUSES', domain.RISK_STATUSES, 'risks', 'status'],
  ['EVENT_KINDS', domain.EVENT_KINDS, 'calendar_events', 'kind'],
  ['PRODUCT_UNITS', domain.PRODUCT_UNITS, 'products', 'unit'],
  ['QUOTE_KINDS', domain.QUOTE_KINDS, 'quotes', 'kind'],
  ['QUOTE_STATUSES', domain.QUOTE_STATUSES, 'quotes', 'status'],
  ['PURCHASE_CATEGORIES', domain.PURCHASE_CATEGORIES, 'purchase_requests', 'category'],
  ['PURCHASE_REQUEST_STATUSES', domain.PURCHASE_REQUEST_STATUSES, 'purchase_requests', 'status'],
  ['PURCHASE_URGENCIES', domain.PURCHASE_URGENCIES, 'purchase_requests', 'urgency'],
  ['PURCHASE_ORDER_STATUSES', domain.PURCHASE_ORDER_STATUSES, 'purchase_orders', 'status'],
  ['ASSET_CATEGORIES', domain.ASSET_CATEGORIES, 'inventory_assets', 'category'],
  ['ASSET_STATUSES', domain.ASSET_STATUSES, 'inventory_assets', 'status'],
  ['INVENTORY_ORDER_STATUSES', domain.INVENTORY_ORDER_STATUSES, 'inventory_orders', 'status'],
  ['HSEQ_CATEGORIES', domain.HSEQ_CATEGORIES, 'hseq_reports', 'category'],
  ['HSEQ_KINDS', domain.HSEQ_KINDS, 'hseq_reports', 'kind'],
  ['HSEQ_STATUSES', domain.HSEQ_STATUSES, 'hseq_reports', 'status'],
  ['HSEQ_PRIORITIES', domain.HSEQ_PRIORITIES, 'hseq_reports', 'priority'],
  ['HSEQ_SEVERITIES', domain.HSEQ_SEVERITIES, 'hseq_reports', 'severity'],
  ['DOCUMENT_KINDS', domain.DOCUMENT_KINDS, 'documents', 'kind'],
  ['DOCUMENT_STATUSES', domain.DOCUMENT_STATUSES, 'documents', 'status'],
  ['SIGNATURE_KINDS', domain.SIGNATURE_KINDS, 'signature_requests', 'kind'],
  ['SIGNATURE_STATUSES', domain.SIGNATURE_STATUSES, 'signature_requests', 'status'],
  ['CONSULTATION_CATEGORIES', domain.CONSULTATION_CATEGORIES, 'consultations', 'category'],
  ['CONSULTATION_STATUSES', domain.CONSULTATION_STATUSES, 'consultations', 'status'],
]

describe('domain vocabularies match the database check constraints', () => {
  // Named off the label and the column rather than `%s`, which stringifies the
  // array into the test name and makes a failure unreadable.
  it.each(CASES.map((c) => [`${c[0]} ↔ ${c[2]}.${c[3]}`, ...c] as const))(
    '%s',
    (_name, _label, values, table, column) => {
      // Sorted: the order the app lists them in is a UI decision, and forcing
      // it to match the SQL would fail for a reason nobody cares about.
      expect([...values].sort()).toEqual(allowedValues(table, column).sort())
    },
  )

  it('has no duplicate values within a list', () => {
    for (const [label, values] of CASES) {
      expect(new Set(values).size, `${label} has duplicates`).toBe(values.length)
    }
  })

  it('never ships an empty vocabulary', () => {
    // An empty `z.enum([])` compiles and rejects every input, which surfaces
    // as "Datos inválidos" on a form that looks fine.
    for (const [label, values] of CASES) {
      expect(values.length, `${label} is empty`).toBeGreaterThan(0)
    }
  })
})

describe('severity and priority are kept apart on HSEQ', () => {
  it('grades severity more finely than priority', () => {
    // The fixture had one three-level field doing both jobs. How bad the event
    // was and how urgently it needs following up are different questions, and
    // the schema comment says so explicitly.
    expect(domain.HSEQ_SEVERITIES.length).toBeGreaterThan(domain.HSEQ_PRIORITIES.length)
    expect(domain.HSEQ_SEVERITIES).toContain('Crítica')
    expect(domain.HSEQ_PRIORITIES).not.toContain('Crítica')
  })
})

describe('todayIn', () => {
  const at = (iso: string, tz: string) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(iso))
    try {
      return todayIn(tz)
    } finally {
      vi.useRealTimers()
    }
  }

  it('is the company’s date, not the server’s', () => {
    // 00:30 UTC on the 11th is 19:30 on the 10th in Bogotá. This is the case
    // that made "Ventas de hoy" read zero through a restaurant's dinner
    // service: the filter asked for sales on or after the 11th.
    expect(at('2026-08-11T00:30:00Z', 'America/Bogota')).toBe('2026-08-10')
    expect(at('2026-08-11T00:30:00Z', 'UTC')).toBe('2026-08-11')
  })

  it('crosses forward as well as back', () => {
    // Madrid is ahead: 23:30 UTC is already the next day there.
    expect(at('2026-08-10T23:30:00Z', 'Europe/Madrid')).toBe('2026-08-11')
  })

  it('falls back to UTC rather than throwing on an unknown zone', () => {
    expect(at('2026-08-11T00:30:00Z', 'Marte/Olympus')).toBe('2026-08-11')
  })
})

describe('dayCount', () => {
  it('counts a single day as 1', () => {
    // The unit debited from a vacation balance. Off by one here is a day of
    // somebody's holiday.
    expect(dayCount('2026-06-10', '2026-06-10')).toBe(1)
  })

  it('is inclusive of both ends', () => {
    expect(dayCount('2026-06-10', '2026-06-14')).toBe(5)
  })

  it('spans month and year boundaries', () => {
    expect(dayCount('2026-01-30', '2026-02-02')).toBe(4)
    expect(dayCount('2025-12-30', '2026-01-02')).toBe(4)
  })

  it('counts the leap day', () => {
    expect(dayCount('2028-02-27', '2028-03-01')).toBe(4)
  })

  it('returns 0 for a reversed range rather than a negative count', () => {
    // A reversed range is a validation error; a negative day count would be
    // credited back to the balance as free holiday.
    expect(dayCount('2026-06-14', '2026-06-10')).toBe(0)
  })

  it('returns 0 for unparseable input', () => {
    expect(dayCount('', '2026-06-10')).toBe(0)
    expect(dayCount('no-es-fecha', 'tampoco')).toBe(0)
  })
})

describe('money', () => {
  it('rounds pesos to whole cents', () => {
    expect(pesosToCents('1250.50')).toBe(125_050)
    expect(pesosToCents(0.1)).toBe(10)
  })

  it('never produces a fraction of a cent', () => {
    // The columns are `bigint`. `0.07 * 100` is 7.000000000000001 in floating
    // point, and an unrounded value fails the insert with a type error.
    for (const pesos of [0.07, 0.29, 1.005, 8.11, 1234.565]) {
      expect(Number.isInteger(pesosToCents(pesos))).toBe(true)
    }
  })

  it('floors nonsense at zero rather than storing NaN', () => {
    expect(pesosToCents('')).toBe(0)
    expect(pesosToCents('abc')).toBe(0)
    expect(pesosToCents(-5)).toBe(0)
  })

  it('rounds each line before summing, so the total matches what is printed', () => {
    // 2.5 × 333 cents = 832.5. Rounding once at the end gives a total that
    // disagrees with the rounded line above it by a cent — which is exactly
    // the kind of discrepancy a customer notices on a quote.
    const lines = [
      { quantity: 2.5, unitPriceCents: 333 },
      { quantity: 2.5, unitPriceCents: 333 },
    ]
    const printed = lines.map((l) => lineTotalCents(l.quantity, l.unitPriceCents))
    expect(printed).toEqual([833, 833])
    expect(sumLinesCents(lines)).toBe(1666)
    expect(sumLinesCents(lines)).toBe(printed[0] + printed[1])
  })

  it('treats a non-finite quantity as zero instead of NaN', () => {
    expect(lineTotalCents(Number.NaN, 100)).toBe(0)
    expect(lineTotalCents(1, Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('assetStatusFor', () => {
  it('forces Asignado whenever somebody holds it', () => {
    // Mirrors `inventory_assets_assignment_consistent`. Deriving rather than
    // accepting both fields is what keeps the constraint from ever firing.
    expect(assetStatusFor('emp-1')).toBe('Asignado')
    expect(assetStatusFor('emp-1', 'Disponible')).toBe('Asignado')
    expect(assetStatusFor('emp-1', 'Mantenimiento')).toBe('Asignado')
  })

  it('honours a non-assigned status when nobody holds it', () => {
    expect(assetStatusFor(null, 'Mantenimiento')).toBe('Mantenimiento')
    expect(assetStatusFor(null, 'Baja')).toBe('Baja')
  })

  it('refuses Asignado without a holder', () => {
    expect(assetStatusFor(null, 'Asignado')).toBe('Disponible')
  })

  it('falls back to Disponible for an unknown status', () => {
    expect(assetStatusFor(null, 'Prestado')).toBe('Disponible')
    expect(assetStatusFor(null)).toBe('Disponible')
  })

  it('only ever returns a value the column accepts', () => {
    const inputs: Array<[string | null, string | undefined]> = [
      ['e', undefined], ['e', 'Baja'], [null, 'Asignado'],
      [null, 'Prestado'], [null, undefined], [null, 'Mantenimiento'],
    ]
    for (const [holder, requested] of inputs) {
      expect(ASSET_STATUSES).toContain(assetStatusFor(holder, requested))
    }
  })
})

describe('projectStateError', () => {
  it('rejects a finished project that is not at 100%', () => {
    expect(projectStateError('Finalizado', 40)).not.toBeNull()
    expect(projectStateError('Finalizado', 100)).toBeNull()
  })

  it('rejects progress on a project still in planning', () => {
    expect(projectStateError('Planificación', 15)).not.toBeNull()
    expect(projectStateError('Planificación', 0)).toBeNull()
  })

  it('leaves the in-between states alone', () => {
    for (const progress of [0, 40, 100]) {
      expect(projectStateError('En ejecución', progress)).toBeNull()
      expect(projectStateError('En pausa', progress)).toBeNull()
    }
  })
})

describe('rangesOverlap', () => {
  it('detects a shared day at either edge', () => {
    // Touching ranges *do* overlap: the shared day would be counted twice in
    // "who is out today" and debited twice from the balance.
    expect(rangesOverlap('2026-06-01', '2026-06-05', '2026-06-05', '2026-06-09')).toBe(true)
    expect(rangesOverlap('2026-06-05', '2026-06-09', '2026-06-01', '2026-06-05')).toBe(true)
  })

  it('detects full containment in both directions', () => {
    expect(rangesOverlap('2026-06-01', '2026-06-30', '2026-06-10', '2026-06-12')).toBe(true)
    expect(rangesOverlap('2026-06-10', '2026-06-12', '2026-06-01', '2026-06-30')).toBe(true)
  })

  it('is false for ranges that merely touch across a gap', () => {
    expect(rangesOverlap('2026-06-01', '2026-06-04', '2026-06-05', '2026-06-09')).toBe(false)
  })

  it('is symmetric', () => {
    const cases: Array<[string, string, string, string]> = [
      ['2026-01-01', '2026-01-10', '2026-01-05', '2026-01-15'],
      ['2026-01-01', '2026-01-02', '2026-03-01', '2026-03-02'],
      ['2026-02-01', '2026-02-28', '2026-02-14', '2026-02-14'],
    ]
    for (const [aS, aE, bS, bE] of cases) {
      expect(rangesOverlap(aS, aE, bS, bE)).toBe(rangesOverlap(bS, bE, aS, aE))
    }
  })
})

/**
 * La convención del IVA, que es la única forma de que tres implementaciones
 * —el RPC en SQL, el catálogo y la factura— no se contradigan.
 */
describe('IVA sobre precio con impuesto incluido', () => {
  it('extrae, no suma', () => {
    // El caso canónico: 11.900 al 19% contiene 1.900 de IVA sobre 10.000.
    expect(taxWithin(11_900, 19)).toBe(1_900)
    expect(netFromGross(11_900, 19)).toBe(10_000)
    // Y el redondo vuelve: neto × 1,19 = bruto.
    expect(Math.round(10_000 * 1.19)).toBe(11_900)
  })

  it('no confunde la fórmula con la del precio sin IVA', () => {
    // `bruto × tasa/100` daría 2.261 y declararía 361 de más por unidad. Es el
    // error que esta prueba existe para que no vuelva.
    expect(taxWithin(11_900, 19)).not.toBe(Math.round(11_900 * 0.19))
  })

  it('trata exento y excluido como lo que son: cero', () => {
    expect(taxWithin(5_000, 0)).toBe(0)
    expect(netFromGross(5_000, 0)).toBe(5_000)
  })

  it('soporta la tasa reducida de la canasta', () => {
    // 5% sobre 10.500 → 500 de IVA sobre 10.000.
    expect(taxWithin(10_500, 5)).toBe(500)
  })

  it('nunca devuelve impuesto sobre un importe no positivo', () => {
    expect(taxWithin(0, 19)).toBe(0)
    expect(taxWithin(-100, 19)).toBe(0)
  })
})

describe('daysUntil', () => {
  it('cuenta hacia adelante y hacia atrás', () => {
    expect(daysUntil('2026-08-25', '2026-08-21')).toBe(4)
    expect(daysUntil('2026-08-18', '2026-08-21')).toBe(-3)
    expect(daysUntil('2026-08-21', '2026-08-21')).toBe(0)
  })

  it('cruza mes, año y bisiesto sin desviarse', () => {
    expect(daysUntil('2026-09-01', '2026-08-30')).toBe(2)
    expect(daysUntil('2027-01-01', '2026-12-30')).toBe(2)
    expect(daysUntil('2028-03-01', '2028-02-28')).toBe(2) // 2028 es bisiesto
  })

  it('devuelve null en vez de NaN para lo que no es fecha', () => {
    // Las seis versiones anteriores devolvían NaN aquí, que se renderiza como
    // «Vence en NaN d» en vez de no renderizar nada.
    expect(daysUntil(null, '2026-08-21')).toBeNull()
    expect(daysUntil('no-es-fecha', '2026-08-21')).toBeNull()
  })

  it('el «hoy» entra por parámetro, nunca del reloj de la máquina', () => {
    // Es la propiedad que hace que servidor y navegador respondan lo mismo:
    // dos husos distintos con el mismo «hoy» dan el mismo número.
    expect(daysUntil('2026-08-25', todayIn('America/Bogota')))
      .toBe(daysUntil('2026-08-25', todayIn('America/Bogota')))
  })
})
