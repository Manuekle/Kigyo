import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requireMember } from '@/lib/auth/session'

/**
 * The company's branches, and who is restricted to which.
 *
 * Both reads go through RLS, so this cannot show a branch of another company —
 * and, notably, a person who is themselves restricted sees only the branches
 * they may reach. That is correct: the restriction is not an administrative
 * overlay, it is what the database will let them touch.
 */

export interface SiteRow {
  id: string
  name: string
  code: string | null
  address: string | null
  city: string | null
  phone: string | null
  isDefault: boolean
  /** People restricted to this branch. Empty means nobody is limited to it. */
  memberCount: number
}

export interface SitesData {
  sites: SiteRow[]
  /** userId → the branches that person is limited to. Absent = unrestricted. */
  assignments: Record<string, string[]>
}

export async function getSites(): Promise<SitesData> {
  const member = await requireMember()
  const supabase = await createClient()

  const [{ data: siteRows, error }, { data: assignmentRows }] = await Promise.all([
    supabase
      .from('sites')
      .select('id, name, code, address, city, phone, is_default')
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true }),
    supabase
      .from('membership_sites')
      .select('user_id, site_id')
      .eq('org_id', member.orgId),
  ])

  if (error) {
    console.error('[sites] getSites', error)
    return { sites: [], assignments: {} }
  }

  const assignments: Record<string, string[]> = {}
  const perSite = new Map<string, number>()
  for (const row of assignmentRows ?? []) {
    ;(assignments[row.user_id] ??= []).push(row.site_id)
    perSite.set(row.site_id, (perSite.get(row.site_id) ?? 0) + 1)
  }

  return {
    sites: (siteRows ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      address: r.address,
      city: r.city,
      phone: r.phone,
      isDefault: r.is_default,
      memberCount: perSite.get(r.id) ?? 0,
    })),
    assignments,
  }
}
