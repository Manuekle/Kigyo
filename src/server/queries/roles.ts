import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_ROLE, type RoleKey } from '@/lib/auth/permissions'

/**
 * The organization's own roles.
 *
 * Read here rather than imported from a constant, because roles stopped being
 * a constant in migration 24: they are tenant rows an administrator creates.
 * Every screen that shows a role picker — the permission matrix, the member
 * list, the invitation form, the employee sheet — reads this one function, so
 * a role created in Configuración appears everywhere at once and no screen can
 * offer a role the database would reject.
 */

export interface RoleRow {
  key: RoleKey
  label: string
  /** Lower is more privilege. Ordering only. */
  rank: number
  /** Seeded with the organization rather than created by the customer. */
  isSystem: boolean
  /** People currently holding it. A role with members cannot be deleted. */
  members: number
}

/**
 * Ordered by rank, then label, which is the order every picker renders.
 *
 * `members` is counted here rather than in each caller: the delete button and
 * the "3 personas" caption are the same fact, and reading it twice is how they
 * end up disagreeing.
 */
export async function getRoles(orgId: string): Promise<RoleRow[]> {
  const supabase = await createClient()

  const [rolesResult, membershipsResult] = await Promise.all([
    supabase
      .from('roles')
      .select('key, label, rank, is_system')
      .eq('org_id', orgId)
      .order('rank', { ascending: true })
      .order('label', { ascending: true }),
    supabase.from('memberships').select('role').eq('org_id', orgId),
  ])

  if (rolesResult.error) {
    console.error('[roles] getRoles', rolesResult.error)
    return []
  }

  const counts = new Map<string, number>()
  for (const row of membershipsResult.data ?? []) {
    counts.set(row.role, (counts.get(row.role) ?? 0) + 1)
  }

  return (rolesResult.data ?? []).map((row) => ({
    key: row.key,
    label: row.label,
    rank: row.rank,
    isSystem: row.is_system,
    members: counts.get(row.key) ?? 0,
  }))
}

/**
 * The role a picker should open on.
 *
 * The least privileged one — highest rank — so an invitation form that the
 * administrator submits without touching the select adds a person with the
 * narrowest access the organization defines, not the widest. Falls back to the
 * seeded 'Empleado' for an organization whose roles could not be read.
 */
export function defaultRole(roles: readonly RoleRow[]): RoleKey {
  if (roles.length === 0) return DEFAULT_ROLE
  return roles.reduce((lowest, role) => (role.rank > lowest.rank ? role : lowest)).key
}
