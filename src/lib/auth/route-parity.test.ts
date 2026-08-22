import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROUTE_PERMISSIONS } from './permissions'
import { ROUTE_MAP } from '@/lib/data/nav'

/**
 * Every dashboard page is guarded, and the guard is checked by a machine.
 *
 * `ROUTE_PERMISSIONS` maps a route segment to the permission that opens it, but
 * nothing consumes it as a gate: each `page.tsx` calls `RequirePermission` or
 * `requirePermission` by hand, forty times. That works, and it works today —
 * the scan below passes on every page currently in the tree.
 *
 * What it does not survive is the forty-first page. Adding a route and
 * forgetting the guard breaks no build, fails no test, and renders perfectly:
 * RLS still refuses the rows, so the screen comes up empty rather than
 * forbidden. An empty screen reads as "no data yet", which is the most
 * expensive possible way to be told you lack access — nobody files a bug, and
 * the missing guard survives review because the page looks fine.
 *
 * So the convention is pinned instead of trusted.
 */

const DASHBOARD = resolve(process.cwd(), 'src/app/(dashboard)/dashboard')

/** Every `page.tsx` under the dashboard segment, recursively. */
function pages(dir = DASHBOARD, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry)
    if (statSync(full).isDirectory()) pages(full, found)
    else if (entry === 'page.tsx') found.push(full)
  }
  return found
}

/** The route segment a page file belongs to. `page.tsx` at the root is `dashboard`. */
function segmentOf(file: string): string {
  const relative = file.slice(DASHBOARD.length + 1).replace(/\/page\.tsx$/, '')
  if (relative === 'page.tsx' || relative === '') return 'dashboard'
  // `empleados/[id]/page.tsx` is guarded as `empleados`.
  return relative.split('/')[0]
}

const GUARDS = ['RequirePermission', 'requirePermission', 'requireMember']

describe('every dashboard route is guarded', () => {
  it('finds the pages at all', () => {
    // A path typo here would make every assertion below vacuously true, which is
    // the failure mode of any test that iterates a directory.
    expect(pages().length).toBeGreaterThan(30)
  })

  it('guards authorization inside every page.tsx', () => {
    const unguarded: string[] = []

    for (const file of pages()) {
      const source = readFileSync(file, 'utf8')
      if (!GUARDS.some((guard) => source.includes(guard))) {
        unguarded.push(file.slice(process.cwd().length + 1))
      }
    }

    expect(
      unguarded,
      'A dashboard page performs no authorization check. RLS would still refuse the ' +
        'rows, so the page renders empty rather than forbidden — which reads as "no data" ' +
        'and hides the bug. Add RequirePermission, requirePermission or requireMember.',
    ).toEqual([])
  })

  /**
   * A page whose segment has a permission must use it, not merely check that
   * somebody is signed in. `requireMember` alone on `/dashboard/nomina` would
   * let every employee in the company open payroll.
   */
  it('uses the segment\'s own permission where one exists', () => {
    const weak: string[] = []

    for (const file of pages()) {
      const segment = segmentOf(file)
      const permission = ROUTE_PERMISSIONS[segment]
      if (!permission) continue

      const source = readFileSync(file, 'utf8')
      const usesPermission =
        source.includes('RequirePermission') || source.includes('requirePermission')
      if (!usesPermission) {
        weak.push(`${file.slice(process.cwd().length + 1)} (needs ${permission})`)
      }
    }

    expect(
      weak,
      'A page checks only that somebody is signed in, on a route that has its own ' +
        'permission. requireMember is the right guard for account-level screens and ' +
        'the wrong one for a module.',
    ).toEqual([])
  })

  /**
   * Every routable segment resolves. A page under a directory the route table
   * does not know is reachable but unnamed: the topbar shows "Dashboard", the
   * command palette cannot find it, and the sidebar can never highlight it.
   */
  it('names every page segment in the route table', () => {
    const unknown: string[] = []

    for (const file of pages()) {
      const segment = segmentOf(file)
      if (!ROUTE_MAP[segment]) unknown.push(`${segment} (${file.slice(process.cwd().length + 1)})`)
    }

    expect(
      unknown,
      'A dashboard directory has no entry in ROUTE_MAP, so nothing can link to it by ' +
        'name and the topbar cannot title it.',
    ).toEqual([])
  })

  /** And the reverse: a route the nav offers must actually have a page. */
  it('has a page for every route the nav offers', () => {
    const segments = new Set(pages().map(segmentOf))
    const missing = Object.keys(ROUTE_MAP).filter((key) => !segments.has(key))

    expect(
      missing,
      'The nav offers a route with no page behind it. Clicking it would 404.',
    ).toEqual([])
  })
})
