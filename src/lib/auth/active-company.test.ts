import { describe, expect, it } from 'vitest'
import {
  ACTIVE_COMPANY_COOKIE,
  ACTIVE_COMPANY_MAX_AGE,
  activeCompanyCookieOptions,
  isCompanyId,
  resolveActiveCompany,
} from './active-company'

/**
 * The rule that decides which company a request operates in.
 *
 * It is the only piece of the multi-company machinery that is pure, and it is
 * also the piece most likely to be got wrong in a way nothing else catches: the
 * database is still perfectly isolated when this function picks the wrong
 * company, so RLS raises no objection and the tests in supabase/tests/rls stay
 * green. What the user sees is their *other* business's data on screen.
 */

const clinic = { orgId: '11111111-1111-1111-1111-111111111111', name: 'Clínica' }
const rest = { orgId: '22222222-2222-2222-2222-222222222222', name: 'Restaurante' }
const outsider = '99999999-9999-9999-9999-999999999999'

describe('resolveActiveCompany', () => {
  it('honours a cookie naming a company the caller belongs to', () => {
    expect(resolveActiveCompany([clinic, rest], rest.orgId)).toBe(rest)
  })

  /**
   * The caller list arrives sorted most-recently-used first, so "the first one"
   * means "where you were last". Getting this backwards is the bug the whole
   * `last_active_at` column exists to prevent: landing every morning in the
   * oldest membership and switching by hand.
   */
  it('falls back to the first company when there is no cookie', () => {
    expect(resolveActiveCompany([rest, clinic], null)).toBe(rest)
    expect(resolveActiveCompany([rest, clinic], undefined)).toBe(rest)
    expect(resolveActiveCompany([rest, clinic], '')).toBe(rest)
  })

  /**
   * The single most important case, and the one that must NOT throw.
   *
   * A cookie naming a company the caller does not belong to is the normal
   * consequence of being removed from that company, of it being deleted, or of
   * somebody editing the cookie. Refusing the request would lock a removed
   * colleague out of the companies they remain in — turning an HR action into
   * an outage.
   */
  it('ignores a company the caller does not belong to', () => {
    expect(resolveActiveCompany([clinic, rest], outsider)).toBe(clinic)
  })

  it('never resolves to a company outside the list', () => {
    const resolved = resolveActiveCompany([clinic, rest], outsider)
    expect([clinic, rest]).toContain(resolved)
  })

  it('returns null when the caller belongs to nothing', () => {
    expect(resolveActiveCompany([], clinic.orgId)).toBeNull()
    expect(resolveActiveCompany([], null)).toBeNull()
  })

  it('is stable: resolving twice with the same input gives the same company', () => {
    const first = resolveActiveCompany([clinic, rest], rest.orgId)
    const second = resolveActiveCompany([clinic, rest], rest.orgId)
    expect(first).toBe(second)
  })
})

describe('isCompanyId', () => {
  it('accepts a uuid in either case', () => {
    expect(isCompanyId(clinic.orgId)).toBe(true)
    expect(isCompanyId('AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE')).toBe(true)
  })

  it('rejects anything that is not one', () => {
    for (const value of [
      null,
      undefined,
      '',
      'clinica',
      "'; drop table organizations; --",
      '11111111-1111-1111-1111-11111111111', // one short
      '11111111-1111-1111-1111-111111111111x',
    ]) {
      expect(isCompanyId(value as string | null), String(value)).toBe(false)
    }
  })
})

describe('the cookie', () => {
  /**
   * `httpOnly` is the load-bearing attribute. The value carries no authority —
   * membership is re-checked against the database on every request — but a
   * cookie a page script can write is a cookie an XSS can write, and there is
   * no reason to hand it that.
   */
  it('is httpOnly, same-site and scoped to the whole app', () => {
    const options = activeCompanyCookieOptions(true)
    expect(options.httpOnly).toBe(true)
    expect(options.sameSite).toBe('lax')
    expect(options.path).toBe('/')
  })

  it('is secure in production and not in development', () => {
    expect(activeCompanyCookieOptions(true).secure).toBe(true)
    // http://localhost would silently drop a `secure` cookie, and the symptom
    // is "switching companies does nothing", which reads like a broken feature.
    expect(activeCompanyCookieOptions(false).secure).toBe(false)
  })

  it('outlives a session, because it is a preference and not one', () => {
    expect(ACTIVE_COMPANY_MAX_AGE).toBeGreaterThanOrEqual(60 * 60 * 24 * 30)
    expect(activeCompanyCookieOptions(true).maxAge).toBe(ACTIVE_COMPANY_MAX_AGE)
  })

  it('has a stable name', () => {
    // Pinned because renaming it silently resets every user to their default
    // company, and nothing else in the suite would notice.
    expect(ACTIVE_COMPANY_COOKIE).toBe('kigyo_ctx')
  })
})
