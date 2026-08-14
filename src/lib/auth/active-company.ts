/**
 * Which company a request is operating in.
 *
 * Kigyo is multi-company: one person can belong to a clinic and a restaurant
 * owned by the same account, and every screen, every query and every permission
 * answers for exactly one of them at a time. That one is the *active company*.
 *
 * Two things keep this safe, and they are separate on purpose:
 *
 *   · **RLS is the ceiling.** It decides what this person may ever see — the
 *     companies they hold a membership in, and nothing else. It does not know
 *     about the active company and must never be taught: a policy that consults
 *     a cookie is a policy that can be talked out of its answer.
 *   · **The active company is the filter inside that ceiling.** It decides what
 *     they are looking at right now. Getting it wrong shows a member their own
 *     other company — annoying and confusing, but not a breach.
 *
 * The value arrives in a cookie, which is to say it arrives from the client and
 * is therefore a request, not a fact. `resolveActiveCompany` is where that
 * request is checked against the memberships the server just read. Nothing else
 * in the codebase is allowed to trust the raw cookie.
 *
 * This module is deliberately free of `server-only`, `next/headers` and any
 * Supabase import: it is pure, so the rule that decides which company a person
 * lands in can be tested directly instead of through a mocked database.
 */

/**
 * Name of the cookie carrying the active company.
 *
 * Short and unguessable-looking on purpose — it is set `httpOnly`, so no
 * browser script reads or writes it, and the only writer is the
 * `switchCompany` Server Function.
 */
export const ACTIVE_COMPANY_COOKIE = 'kigyo_ctx'

/**
 * A year. The cookie is a preference, not a session: expiring it early would
 * silently drop somebody back into their oldest company, which is exactly the
 * behaviour this exists to remove.
 *
 * It carries no authority whatsoever — it names a company, and being a member
 * of that company is checked on every single request — so a long life costs
 * nothing. Losing it costs a switch.
 */
export const ACTIVE_COMPANY_MAX_AGE = 60 * 60 * 24 * 365

/** Cookie attributes. Collected here so the writer cannot get one of them wrong. */
export function activeCompanyCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    // `lax` rather than `strict`: the switcher navigates, and `strict` would
    // withhold the cookie on the first request after following a link into the
    // app, dropping the user into the default company for one page.
    secure: isProduction,
    path: '/',
    maxAge: ACTIVE_COMPANY_MAX_AGE,
  }
}

/** The shape `resolveActiveCompany` needs. Real callers pass a richer object. */
export interface CompanyLike {
  orgId: string
}

/**
 * Picks the company a request operates in.
 *
 * `companies` is what the server just read from the database — the caller's
 * real memberships, already filtered by RLS. `requested` is whatever the cookie
 * said, which is to say whatever the client sent.
 *
 * The order is: honour the request if it is real, otherwise fall back to the
 * first company in the list. Callers sort that list most-recently-used first,
 * so the fallback is "where you were last", and the very first sign-in gets the
 * oldest membership — the company the account was created around.
 *
 * A `requested` value that is not in the list is **not an error**. It is the
 * normal consequence of being removed from a company, of a company being
 * deleted, or of someone editing a cookie by hand. All three deserve the same
 * response: ignore it, quietly, and carry on in a company they do belong to.
 * Throwing here would lock a removed colleague out of the product entirely.
 */
export function resolveActiveCompany<T extends CompanyLike>(
  companies: readonly T[],
  requested: string | null | undefined,
): T | null {
  if (companies.length === 0) return null
  if (requested) {
    const match = companies.find((c) => c.orgId === requested)
    if (match) return match
  }
  return companies[0]
}

/**
 * Whether the cookie is worth sending to the database at all.
 *
 * Not a security control — `resolveActiveCompany` is, and it compares against
 * real memberships. This only keeps a junk value from becoming a query
 * parameter, since an id-shaped column compared against `'; drop'` raises a
 * cast error rather than returning nothing.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isCompanyId(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID.test(value)
}
