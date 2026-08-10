import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { PERMISSIONS, ROLES, type Permission, type RoleKey } from '@/lib/auth/permissions'
import { isModuleKey, resolveModules } from '@/lib/modules'

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

/** A pending invitation: created, not yet accepted, not yet expired. */
export interface InvitationRow {
  id: string
  email: string
  role: RoleKey
  expiresAt: string
  createdAt: string
}

export interface SettingsData {
  organization: {
    id: string
    name: string
    industry: string | null
    slug: string
    companyType: string | null
    /**
     * Resolved, not raw: a never-configured account reports the preset its
     * company type implies, which is what the sidebar is already showing. The
     * Módulos tab must open on the state the user can see, not on the empty
     * array behind it.
     */
    modules: string[]
  }
  profile: { fullName: string; email: string; avatarUrl: string | null; role: RoleKey }
  /** role → permission → granted. Dense: every role has every permission key. */
  matrix: Record<RoleKey, Record<Permission, boolean>>
  members: OrgMemberRow[]
  /** Outstanding invitations. Empty for a caller who cannot manage the org. */
  invitations: InvitationRow[]
  /** Whether this account has a verified TOTP factor. Per person, not per org. */
  mfaEnabled: boolean
  canManage: boolean
}

export async function getSettings(): Promise<SettingsData> {
  const member = await requirePermission('configuracion:read')
  const supabase = await createClient()

  const [orgResult, grantsResult, membersResult, invitationsResult, factorsResult] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, industry, slug, company_type, enabled_modules')
      .eq('id', member.orgId)
      .single(),
    supabase.from('role_permissions').select('role, permission').eq('org_id', member.orgId),
    supabase
      .from('memberships')
      .select('id, user_id, role, profiles!inner(full_name, email, avatar_url)')
      .eq('org_id', member.orgId)
      .order('created_at', { ascending: true }),
    // Expired rows are filtered here rather than shown greyed out: the signup
    // trigger ignores them, so an expired invitation is not a thing waiting to
    // happen — it is a row that will never do anything again.
    supabase
      .from('invitations')
      .select('id, email, role, expires_at, created_at')
      .eq('org_id', member.orgId)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
    // Enrolment is a property of the person, not the organization, but the
    // Seguridad tab is on this screen and this is the read it already makes.
    supabase.auth.mfa.listFactors(),
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

  const org = orgResult.data

  return {
    organization: {
      id: org.id,
      name: org.name,
      industry: org.industry,
      slug: org.slug,
      companyType: org.company_type,
      // CORE_MODULES are folded in by `resolveModules` but must not reach the
      // toggle list: they are not switchable, and rendering them as switches
      // that cannot move is worse than not rendering them.
      modules: [...resolveModules(org.enabled_modules, org.company_type)].filter(isModuleKey),
    },
    profile: {
      fullName: member.fullName,
      email: member.email,
      avatarUrl: member.avatarUrl,
      role: member.role,
    },
    matrix,
    members,
    invitations: (invitationsResult.data ?? []).map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role as RoleKey,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    })),
    mfaEnabled: (factorsResult.data?.totp ?? []).some((f) => f.status === 'verified'),
    canManage: member.permissions.has('configuracion:manage'),
  }
}
