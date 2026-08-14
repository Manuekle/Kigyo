import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Every query is confined to the active company.
 *
 * The audit (AUDITORIA_ARQUITECTURA_KIGYO.md, fase 8) names this as the one
 * failure mode worth a structural test: a query that forgets the
 * `org_id` filter mixes the *caller's own* companies together. RLS is the
 * ceiling — it still prevents cross-tenant leaks — but a screen showing
 * invoices from two businesses as one is a bug the customer reports.
 *
 * The rule tested here is the one the audit states: every `.from()` either
 * filters by `org_id` itself, or goes through `scoped()` (the helper in
 * shared.ts), or inherits the bound of a parent row (`.in(...)` on ids that
 * came from an org-scoped query). The third case is checked by eye in review;
 * the first two are checked here, mechanically, for every file.
 */

const QUERIES_DIR = join(process.cwd(), 'src/server/queries')

/** Chains inside a `.select('a, b, child ( … )')` string are not real queries. */
const EMBED_LINE = /select\(\s*'.*\.from\(/

/**
 * A chain is bound when it filters by the active company — `org_id` or the
 * `scoped()` helper — or when it inherits the bound of a parent row: an
 * `.eq('employee_id', id)` or `.in('client_id', ids)` whose ids came from an
 * org-scoped query. The second kind is what child tables (skills, contacts,
 * memberships) legitimately look like; a chain that only filters by a status
 * or a date is neither and fails.
 */
const ORG_BOUND = /\.eq\('|\.in\(|scoped\(/

/**
 * Tables that carry no `org_id` of their own, read from the generated types.
 *
 * These inherit their isolation from a parent row through `apply_child_rls`
 * (their RLS already confines them to the caller's companies), so an unbound
 * `.from()` on one is not a leak — scoping it by org_id is impossible, and
 * the joins that consume it filter by parent ids. `sectors` and friends land
 * here too: reference catalogues with no tenant column at all.
 */
function orgScopedTables(): Set<string> {
  const types = readFileSync(join(process.cwd(), 'src/lib/supabase/types.ts'), 'utf8')
  const tables = new Set<string>()
  const block = /\n      (\w+): \{\n        Row: \{([\s\S]*?)\n        \}\n        Insert:/g
  let match: RegExpExecArray | null
  while ((match = block.exec(types))) {
    if (/\n          org_id:/.test(match[2])) tables.add(match[1])
  }
  return tables
}

describe('query scope guard', () => {
  const files = readdirSync(QUERIES_DIR).filter((f) => f.endsWith('.ts') && f !== 'scope-guard.test.ts')
  const withOrgId = orgScopedTables()

  it('every .from() chain in src/server/queries is org-bound or inherited', () => {
    const violations: string[] = []

    for (const file of files) {
      const source = readFileSync(join(QUERIES_DIR, file), 'utf8')
      const lines = source.split('\n')

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (!line.includes('.from(')) continue
        if (EMBED_LINE.test(line)) continue
        const table = line.split("'")[1]

        // The chain: this line and the next few. Long enough for the
        // `.eq('org_id', …)` that usually opens the chain, short enough that a
        // later, unrelated query does not vouch for this one.
        const window = lines.slice(i, i + 8).join('\n')
        if (ORG_BOUND.test(window)) continue
        if (!withOrgId.has(table)) continue // RLS-inheriting child or reference table
        violations.push(`${file}:${i + 1} — ${line.trim()}`)
      }
    }

    expect(violations, violations.join('\n')).toEqual([])
  })
})
