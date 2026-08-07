import { describe, expect, it } from 'vitest'
import { columnsOf, sanitizeCell } from './export'

describe('sanitizeCell', () => {
  it('escapes every character a spreadsheet treats as starting a formula', () => {
    for (const payload of [
      '=1+1',
      '=HYPERLINK("https://evil.test","haz clic")',
      '+1234',
      '-2+3',
      '@SUM(A1:A9)',
      '\t=cmd|\' /C calc\'!A0',
      '\r=1',
    ]) {
      expect(sanitizeCell(payload), payload).toBe(`'${payload}`)
    }
  })

  it('leaves ordinary text alone', () => {
    expect(sanitizeCell('Contrato laboral')).toBe('Contrato laboral')
    expect(sanitizeCell('María González')).toBe('María González')
    // A leading digit is not a formula trigger.
    expect(sanitizeCell('1+1')).toBe('1+1')
    // Nor is an interior one.
    expect(sanitizeCell('Total = 100')).toBe('Total = 100')
  })

  it('passes non-string primitives through unchanged', () => {
    const date = new Date('2026-06-18T10:00:00Z')
    expect(sanitizeCell(42)).toBe(42)
    expect(sanitizeCell(-7)).toBe(-7)
    expect(sanitizeCell(true)).toBe(true)
    expect(sanitizeCell(date)).toBe(date)
  })

  it('normalises empty values to null', () => {
    expect(sanitizeCell(null)).toBeNull()
    expect(sanitizeCell(undefined)).toBeNull()
  })

  it('stringifies anything else before checking it', () => {
    expect(sanitizeCell({ toString: () => '=BAD()' })).toBe("'=BAD()")
  })
})

describe('columnsOf', () => {
  it('unions keys across rows so optional fields survive', () => {
    const columns = columnsOf([
      { ID: 1, Nombre: 'A' },
      { ID: 2, Nombre: 'B', Área: 'TI' },
    ])
    expect(columns).toEqual(['ID', 'Nombre', 'Área'])
  })

  it('preserves first-seen order and de-duplicates', () => {
    expect(columnsOf([{ b: 1, a: 2 }, { a: 3, b: 4 }])).toEqual(['b', 'a'])
  })

  it('handles an empty set', () => {
    expect(columnsOf([])).toEqual([])
  })
})
