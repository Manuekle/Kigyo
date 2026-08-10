import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CORE_MODULES, resolveModules } from '@/lib/modules'
import { lowestPlanWith, planAllows, planModules, type PlanKey } from '@/lib/plans'
import { can, type Permission, type RoleKey } from './permissions'

export interface Member {
  userId: string
  email: string
  fullName: string
  avatarUrl: string | null
  orgId: string
  orgName: string
  orgSlug: string
  companyType: string | null
  /** The subscription tier. Decides which modules may be enabled at all. */
  plan: PlanKey
  /**
   * Modules this organization uses, already resolved — core modules folded in,
   * the company-type preset substituted for a never-configured account, and
   * anything the plan does not include filtered out.
   *
   * Orthogonal to `permissions`: this answers "did the company buy this and
   * does it use it", the permission set answers "may this person see it".
   */
  modules: Set<string>
  role: RoleKey
  permissions: Set<Permission>
}

/**
 * Resolves the caller once per request.
 *
 * `getUser()` is used rather than `getSession()` on purpose: it revalidates the
 * JWT against the auth server, whereas `getSession()` trusts whatever is in the
 * cookie. On the server that distinction is the whole point.
 *
 * Wrapped in React's `cache` so a layout, a page and three Server Functions in
 * the same render share one round trip.
 */
export const getMember = cache(async (): Promise<Member | null> => {
  // On an unconfigured install `createClient()` throws, which would surface as
  // a 500 error page on /dashboard. There is no session in that state, so
  // returning null is both accurate and better: `requireMember()` redirects to
  // /login, where submitting the form reports exactly which variables are
  // missing. Either way the dashboard is never served — this fails closed.
  let supabase: Awaited<ReturnType<typeof createClient>>
  try {
    supabase = await createClient()
  } catch (error) {
    console.error('[auth] Supabase is not configured', error)
    return null
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) return null

  // A session that stopped at the password when the account carries a verified
  // second factor is not a session. Refused here rather than in the proxy so
  // every entry point is covered at once — pages, layouts and Server Functions
  // all resolve the caller through this function, and a gate that only guards
  // routing is a gate a Server Function walks around.
  //
  // No extra round trip: the assurance level is read off the JWT and the
  // factor list already on `user`.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') return null

  const { data, error } = await supabase
    .from('memberships')
    .select(
      `role,
       org_id,
       organizations!inner ( name, slug, company_type, enabled_modules, plan ),
       profiles!inner ( email, full_name, avatar_url )`,
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null

  const org = data.organizations as unknown as {
    name: string
    slug: string
    company_type: string | null
    enabled_modules: string[] | null
    plan: PlanKey
  }
  const profile = data.profiles as unknown as {
    email: string
    full_name: string
    avatar_url: string | null
  }

  const { data: grants } = await supabase
    .from('role_permissions')
    .select('permission')
    .eq('org_id', data.org_id)
    .eq('role', data.role)

  return {
    userId: user.id,
    email: profile.email,
    fullName: profile.full_name || profile.email.split('@')[0],
    avatarUrl: profile.avatar_url,
    orgId: data.org_id,
    orgName: org.name,
    orgSlug: org.slug,
    companyType: org.company_type,
    plan: org.plan,
    // The plan is applied here, once, rather than at each call site. Everything
    // downstream — `requirePermission`, `RequirePermission`, the sidebar, the
    // pickers in queries/shared.ts — asks the same `member.modules` question
    // and therefore cannot disagree about what the subscription includes.
    modules: resolveModules(org.enabled_modules, org.company_type, planModules(org.plan)),
    role: data.role as RoleKey,
    permissions: new Set((grants ?? []).map((g) => g.permission as Permission)),
  }
})

/** Redirects to /login when there is no session. Use in pages and layouts. */
export async function requireMember(): Promise<Member> {
  const member = await getMember()
  if (!member) redirect('/login')
  return member
}

export class PermissionError extends Error {
  readonly permission: Permission
  constructor(permission: Permission) {
    super(`No tienes permiso para esta acción (${permission}).`)
    this.name = 'PermissionError'
    this.permission = permission
  }
}

export class ModuleDisabledError extends Error {
  readonly module: string
  constructor(module: string) {
    super(`El módulo ${module} no está activo en esta organización.`)
    this.name = 'ModuleDisabledError'
    this.module = module
  }
}

/**
 * Distinct from `ModuleDisabledError` because the fix is different.
 *
 * "Your organization has not switched this on" sends an administrator to
 * Configuración → Módulos, where they will find the toggle greyed out and no
 * explanation. "Your plan does not include this" sends them to the plan.
 */
export class PlanRequiredError extends Error {
  readonly module: string
  readonly requiredPlan: string | null
  constructor(module: string, requiredPlan: string | null) {
    super(
      requiredPlan
        ? `El módulo ${module} requiere el plan ${requiredPlan}.`
        : `El módulo ${module} no está incluido en tu plan.`,
    )
    this.name = 'PlanRequiredError'
    this.module = module
    this.requiredPlan = requiredPlan
  }
}

/** The module half of a permission key: `proyectos:read` → `proyectos`. */
export function moduleOf(permission: Permission): string {
  return permission.split(':')[0]
}

/** The shell — always on, owned by no plan and by no toggle. */
export function isCoreModule(module: string): boolean {
  return (CORE_MODULES as readonly string[]).includes(module)
}

/**
 * Server-side authorization gate.
 *
 * RLS already blocks the underlying rows, but a policy failure surfaces as an
 * empty result or an opaque database error. Checking here turns that into a
 * 403 the UI can explain.
 *
 * Three gates, checked outermost first, because each one has a different fix:
 *
 *   1. the plan does not include the module   → change the subscription
 *   2. the organization has it switched off   → an admin enables it
 *   3. the role lacks the permission          → an admin grants it
 *
 * Collapsing them would send people to the wrong place. An administrator told
 * "your role does not include Ver tienda" while holding every permission in
 * the account goes looking for a grant that would not have helped.
 */
export async function requirePermission(permission: Permission): Promise<Member> {
  const member = await requireMember()
  const moduleKey = moduleOf(permission)

  // Core modules belong to no plan by construction — they are the shell, and
  // `PLANS[*].modules` is drawn from the switchable catalogue, which excludes
  // them. Testing them against the plan would lock every tier out of its own
  // dashboard.
  if (!isCoreModule(moduleKey) && !planAllows(member.plan, moduleKey)) {
    throw new PlanRequiredError(moduleKey, lowestPlanWith(moduleKey)?.label ?? null)
  }
  if (!member.modules.has(moduleKey)) throw new ModuleDisabledError(moduleKey)
  if (!can(member.permissions, permission)) throw new PermissionError(permission)
  return member
}

/**
 * The same answer as `requirePermission`, as a boolean.
 *
 * Only `member.modules` is tested, not the plan: modules the plan excludes are
 * already absent from that set — `getMember` filters them out once, at the
 * source. Re-testing the plan here would be a second place to keep in sync,
 * and the two could only ever disagree by being wrong.
 */
export async function hasPermission(permission: Permission): Promise<boolean> {
  const member = await getMember()
  if (!member) return false
  return member.modules.has(moduleOf(permission)) && can(member.permissions, permission)
}

/** Whether the organization uses a module at all, ignoring who is asking. */
export async function hasModule(module: string): Promise<boolean> {
  const member = await getMember()
  return member ? member.modules.has(module) : false
}
