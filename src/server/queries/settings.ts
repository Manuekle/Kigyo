import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { PERMISSIONS, type Permission, type RoleKey } from '@/lib/auth/permissions'
import { isModuleKey, resolveModules } from '@/lib/modules'
import type { SectorCatalogue } from '@/lib/sectors'
import { getRoles, type RoleRow } from './roles'
import { getSectors } from './sectors'

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
  /**
   * The whole sector catalogue: sectors, their subsectors, and what each one
   * proposes.
   *
   * Sent whole rather than narrowed to the chosen branch, which is what this
   * used to do. The screen lets you *change* sector, and a narrowed payload
   * could only describe the sector you arrived with — so picking a different
   * one offered no subsectors until the page was reloaded, and proposed modules
   * from the TypeScript copy while the wizard next door proposed them from the
   * database. Around four hundred short rows buys one source of truth for both.
   */
  catalogue: SectorCatalogue
  organization: {
    id: string
    name: string
    industry: string | null
    slug: string
    companyType: string | null
    /** The subsector, when the sector has one and the customer picked it. */
    subsector: string | null
    /**
     * Whether the sector may still be changed.
     *
     * False once the company has records in the vertical its sector names — a
     * clinic with patients, a hotel with rooms. The database refuses the write
     * either way (migration 41), so this exists purely so the screen can show
     * the sector as settled *before* somebody picks a new one: offering a choice
     * and then rejecting it is worse than never offering.
     *
     * Modules stay editable regardless. The sector only ever proposed them.
     */
    canChangeSector: boolean
    /**
     * Resolved, not raw: a never-configured account reports the preset its
     * company type implies, which is what the sidebar is already showing. The
     * Módulos tab must open on the state the user can see, not on the empty
     * array behind it.
     */
    modules: string[]
    /**
     * URL firmada del logo, o null.
     *
     * Firmada y no pública: `logos` es un bucket privado (migración 107), por el
     * mismo motivo que `avatars` — un bucket abierto sería la lista de los logos
     * de todos los clientes de Kigyo servida sin autenticación. La URL caduca,
     * y esta consulta corre en cada carga de la pantalla, así que siempre hay
     * una fresca. El coste es condicional: una empresa sin logo no paga nada.
     */
    logoUrl: string | null
  }
  profile: { fullName: string; email: string; avatarUrl: string | null; role: RoleKey }
  /**
   * The organization's roles, in the order every picker renders them.
   *
   * Read from the database rather than a constant since migration 24. The
   * matrix, the member list and the invitation form all key off this array, so
   * a role created in this screen shows up in the other three without a
   * reload of anything but this query.
   */
  roles: RoleRow[]
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

  const [orgResult, roles, grantsResult, membersResult, invitationsResult, factorsResult, sectorLock] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, industry, slug, company_type, subsector, enabled_modules, branding')
      .eq('id', member.orgId)
      .single(),
    getRoles(member.orgId),
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
    // One `exists` against the sector's own table. Cheap, and it is the
    // difference between a settled sector rendered as a fact and one rendered
    // as twenty-two buttons that all fail.
    supabase.rpc('can_change_sector', { p_org_id: member.orgId }),
  ])

  if (orgResult.error || !orgResult.data) {
    throw new Error('No se pudo leer la organización')
  }

  // Dense matrix, so the UI never has to distinguish "not granted" from
  // "row missing" — a distinction that produced inconsistent checkbox states.
  // Keyed by the organization's own roles: a matrix built from a constant
  // would silently drop every grant belonging to a role the customer created.
  const matrix = Object.fromEntries(
    roles.map((role) => [
      role.key,
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

  /**
   * El logo, firmado si lo hay.
   *
   * `branding` es jsonb y su clave es `logo_url` — la escribe `updateBranding`
   * y guarda la *ruta* dentro del bucket, no una URL. Ese fue el diseño desde
   * la migración 30; lo que faltaba era el bucket y quien subiera el archivo.
   */
  const brandingLogo = (org.branding as { logo_url?: string } | null)?.logo_url ?? null
  let logoUrl: string | null = null
  if (brandingLogo) {
    const { data: signed } = await supabase.storage
      .from('logos')
      .createSignedUrl(brandingLogo, 3600)
    logoUrl = signed?.signedUrl ?? null
  }

  return {
    catalogue: await getSectors(),
    organization: {
      id: org.id,
      name: org.name,
      industry: org.industry,
      slug: org.slug,
      companyType: org.company_type,
      subsector: org.subsector,
      // A company with no sector may always choose one, which is also what the
      // function returns — the fallback covers a read that failed, and it fails
      // *closed*: showing the sector as settled when it is not costs a customer
      // one support message, while offering a change the database will refuse
      // costs them the confidence that anything on this screen means what it says.
      canChangeSector: sectorLock.data ?? org.company_type === null,
      // CORE_MODULES are folded in by `resolveModules` but must not reach the
      // toggle list: they are not switchable, and rendering them as switches
      // that cannot move is worse than not rendering them.
      modules: [...resolveModules(org.enabled_modules, org.company_type)].filter(isModuleKey),
      logoUrl,
    },
    profile: {
      fullName: member.fullName,
      email: member.email,
      avatarUrl: member.avatarUrl,
      role: member.role,
    },
    roles,
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
