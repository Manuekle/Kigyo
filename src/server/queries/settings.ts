import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { PERMISSIONS, ROLES, type Permission, type RoleKey } from '@/lib/auth/permissions'

/**
 * Organization settings: the profile, the org record, the permission matrix
 * and who belongs to it.
 *
 * The matrix used to live in `localStorage['nucleo-config-state']` — editable
 * by the very user it was meant to restrict, and read by nothing on the
 * server. It is now `role_permissions`, which is also what RLS reads.
 */

export interface OrgMemberRow {
  membershipId: string
  userId: string
  fullName: string
  email: string
  role: RoleKey
  avatarUrl: string | null
  isSelf: boolean
}

export interface SettingsData {
  organization: { id: string; name: string; industry: string | null; slug: string }
  profile: { fullName: string; email: string; avatarUrl: string | null; role: RoleKey }
  /** role → permission → granted. Dense: every role has every permission key. */
  matrix: Record<RoleKey, Record<Permission, boolean>>
  members: OrgMemberRow[]
  canManage: boolean
}

export async function getSettings(): Promise<SettingsData> {
  const member = await requirePermission('configuracion:read')
  const supabase = await createClient()

  const [orgResult, grantsResult, membersResult] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, industry, slug')
      .eq('id', member.orgId)
      .single(),
    supabase.from('role_permissions').select('role, permission').eq('org_id', member.orgId),
    supabase
      .from('memberships')
      .select('id, user_id, role, profiles!inner(full_name, email, avatar_url)')
      .eq('org_id', member.orgId)
      .order('created_at', { ascending: true }),
  ])

  if (orgResult.error || !orgResult.data) {
    throw new Error('No se pudo leer la organización')
  }

  // Dense matrix, so the UI never has to distinguish "not granted" from
  // "row missing" — a distinction that produced inconsistent checkbox states.
  const matrix = Object.fromEntries(
    ROLES.map((role) => [
      role,
      Object.fromEntries(PERMISSIONS.map((permission) => [permission, false])),
    ]),
  ) as Record<RoleKey, Record<Permission, boolean>>

  for (const grant of grantsResult.data ?? []) {
    const role = grant.role as RoleKey
    const permission = grant.permission as Permission
    if (matrix[role] && permission in matrix[role]) matrix[role][permission] = true
  }

  const members: OrgMemberRow[] = (membersResult.data ?? []).map((row) => {
    const profile = row.profiles as unknown as {
      full_name: string
      email: string
      avatar_url: string | null
    }
    return {
      membershipId: row.id,
      userId: row.user_id,
      fullName: profile.full_name || profile.email.split('@')[0],
      email: profile.email,
      role: row.role as RoleKey,
      avatarUrl: profile.avatar_url,
      isSelf: row.user_id === member.userId,
    }
  })

  return {
    organization: orgResult.data,
    profile: {
      fullName: member.fullName,
      email: member.email,
      avatarUrl: member.avatarUrl,
      role: member.role,
    },
    matrix,
    members,
    canManage: member.permissions.has('configuracion:manage'),
  }
}
