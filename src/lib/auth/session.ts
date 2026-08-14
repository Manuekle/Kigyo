import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CORE_MODULES, resolveModules } from '@/lib/modules'
import { lowestPlanWith, planAllows, planFor, planModules, type PlanKey } from '@/lib/plans'
import { ACTIVE_COMPANY_COOKIE, isCompanyId, resolveActiveCompany } from './active-company'
import { can, type Permission, type RoleKey } from './permissions'

/**
 * One company this person belongs to.
 *
 * Enough to render the switcher and no more: the modules and the permission set
 * are resolved for the *active* company only, because resolving them for all of
 * them would be N extra round trips to populate a dropdown.
 */
export interface CompanyRef {
  /** See AGENTS.md: `org_id` is the company id. */
  orgId: string
  name: string
  slug: string
  companyType: string | null
  /** This person's role in *this* company. It differs between companies. */
  role: RoleKey
  /** Payment state. `suspended` = visible and read-only. */
  status: 'active' | 'suspended'
  /**
   * The account that owns it.
   *
   * Carried so the switcher can group by group. One person can belong to
   * companies in several accounts — a consultant in a client's group and in
   * their own — and a flat list of eleven company names with no headings is a
   * list somebody picks wrong from.
   */
  accountId: string
  accountName: string
}

/**
 * The commercial account above the active company.
 *
 * `role` is the caller's standing on the account, and it is `null` for most
 * people: being an employee of a company says nothing about governing the group
 * that owns it. It grants no access to any company's data — see AGENTS.md.
 */
export interface AccountRef {
  accountId: string
  name: string
  plan: PlanKey
  role: 'owner' | 'billing' | 'admin' | null
  /**
   * Whether the setup wizard has been finished.
   *
   * Null means it has not. The dashboard layout redirects on it, so it has to
   * come back with the session rather than being fetched where it is needed —
   * an extra round trip on every page load, to answer a question that is `false`
   * for the rest of the account's life, would be a poor trade.
   */
  onboardingCompleted: boolean
}

export interface Member {
  /**
   * Whether the **active company's** setup wizard has been finished.
   *
   * Distinct from `account.onboardingCompleted`, and it is the one the redirect
   * uses. While the flag lived only on the account, the second company an
   * account created was never configured at all: the account had been stamped
   * during the first company's setup, so the new business inherited a sector, a
   * module selection and a set of branches that were somebody else's answers.
   *
   * Comes back with the session rather than being fetched where it is needed:
   * the dashboard layout redirects on it, and an extra round trip on every page
   * load to answer a question that is `true` for the rest of the company's life
   * would be a poor trade.
   */
  setupCompleted: boolean
  userId: string
  email: string
  fullName: string
  avatarUrl: string | null
  /** The **active** company. Every query in the app filters on this. */
  orgId: string
  orgName: string
  orgSlug: string
  companyType: string | null
  /**
   * The kind of business inside the sector, when the customer named one.
   *
   * Carried alongside `companyType` because it decides what some sector modules
   * *show*, not what anybody may open: `pacientes` renders an odontogram for
   * `salud-odontologia` and does not for `salud-consultorio`, and both run on
   * the same permission. Presentation, never access — a screen hidden by
   * subsector is still reachable by anyone with `pacientes:read`, which is the
   * correct behaviour for a clinic that changed its mind about what it is.
   */
  subsector: string | null
  /** The subscription tier. Decides which modules may be enabled at all. */
  plan: PlanKey
  /** Payment state of the active company. `suspended` gates writes. */
  status: 'active' | 'suspended'
  /**
   * Modules this company uses, already resolved — core modules folded in,
   * the company-type preset substituted for a never-configured account, and
   * anything the plan does not include filtered out.
   *
   * Orthogonal to `permissions`: this answers "did the company buy this and
   * does it use it", the permission set answers "may this person see it".
   */
  modules: Set<string>
  /** The caller's role in the active company. */
  role: RoleKey
  /** The caller's permissions in the active company. */
  permissions: Set<Permission>
  /** The account that owns the active company. */
  account: AccountRef
  /**
   * Every company this person belongs to, most recently used first.
   *
   * Always contains the active one. A single entry is the overwhelmingly common
   * case and the switcher hides itself for it.
   */
  companies: CompanyRef[]
  /**
   * Every account this person governs, whether or not they are inside any of
   * its companies.
   *
   * Distinct from `companies`: an owner can create a group, leave its company
   * and still be the one who pays for it. Without this the screen that manages
   * groups could not list the one it exists to manage.
   *
   * Contains the active company's account only when the caller actually governs
   * it, which most people do not — being an employee says nothing about who
   * owns the business.
   */
  accounts: Array<{ accountId: string; name: string; role: 'owner' | 'billing' | 'admin' }>
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

  /**
   * Every company this person belongs to, not just the first one.
   *
   * Until migration 26 this ended in `.limit(1).maybeSingle()`, which was
   * correct while an account *was* a company. It is now the single line that
   * would keep multi-company from working: somebody in two companies would see
   * the older one forever, with no way to reach the other.
   *
   * Ordered most-recently-used first so the fallback in `resolveActiveCompany`
   * means "where you were last". `nullsFirst: false` matters — a membership
   * that has never been opened must sort *after* one that has, and in Postgres
   * `desc` puts nulls first by default.
   */
  const { data: rows, error } = await supabase
    .from('memberships')
    .select(
      `role,
       org_id,
       organizations!inner (
         name, slug, company_type, subsector, enabled_modules, status, setup_completed_at,
         accounts ( id, name, plan, onboarding_completed_at )
       ),
       profiles!inner ( email, full_name, avatar_url )`,
    )
    .eq('user_id', user.id)
    .order('last_active_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (error || !rows || rows.length === 0) return null

  type OrgRow = {
    name: string
    slug: string
    company_type: string | null
    subsector: string | null
    enabled_modules: string[] | null
    status: 'active' | 'suspended'
    setup_completed_at: string | null
    accounts: {
      id: string
      name: string
      plan: PlanKey
      onboarding_completed_at: string | null
    } | null
  }

  const memberships = rows.map((row) => ({
    orgId: row.org_id,
    role: row.role as RoleKey,
    org: row.organizations as unknown as OrgRow,
  }))

  const companies: CompanyRef[] = memberships.map((m) => ({
    orgId: m.orgId,
    name: m.org.name,
    slug: m.org.slug,
    companyType: m.org.company_type,
    role: m.role,
    status: m.org.status,
    // Empty only when RLS filtered the account row out, which the switcher
    // renders as an ungrouped entry rather than dropping the company.
    accountId: m.org.accounts?.id ?? '',
    accountName: m.org.accounts?.name ?? m.org.name,
  }))

  /**
   * The cookie is a request, not a fact.
   *
   * It is `httpOnly`, so no page script wrote it — but a cookie is still
   * client-supplied, and the only thing that makes it trustworthy is being
   * compared against the memberships just read above, which RLS already
   * filtered. A value naming a company this person left is ignored rather than
   * refused: being removed from a company must not lock anyone out of the ones
   * they remain in.
   */
  const jar = await cookies()
  const requested = jar.get(ACTIVE_COMPANY_COOKIE)?.value
  const active = resolveActiveCompany(
    memberships,
    isCompanyId(requested) ? requested : null,
  )
  if (!active) return null

  const org = active.org
  const profile = rows[0].profiles as unknown as {
    email: string
    full_name: string
    avatar_url: string | null
  }

  const [{ data: grants }, { data: accountRoles }] = await Promise.all([
    supabase
      .from('role_permissions')
      .select('permission')
      .eq('org_id', active.orgId)
      .eq('role', active.role),
    // The caller's standing on the account, which is `null` for most people.
    // Scoped to this user only; `account_memberships` is invisible to anyone
    // who does not govern the account, so a plain member gets an empty list
    // rather than a refusal.
    // The name comes along so the "mis cuentas" list does not need a second
    // query for a label: `accounts_select` already lets a member read the row.
    supabase
      .from('account_memberships')
      .select('account_id, role, accounts ( name )')
      .eq('user_id', user.id),
  ])

  /**
   * The plan, read from the account — the only copy that exists since
   * migration 32 dropped `organizations.plan`.
   *
   * The fallback is not defensive padding: `organizations.account_id` is NOT
   * NULL, but the embed can still come back null if the account row is filtered
   * out by RLS. Falling back to the most generous tier keeps a member signed in
   * with the right modules instead of silently dropping them to Starter — the
   * same answer `planFor()` gives for a key the app does not know.
   */
  const plan: PlanKey = org.accounts?.plan ?? planFor(null).key

  const account: AccountRef = {
    accountId: org.accounts?.id ?? '',
    // Falls back to the company's own name rather than an empty string: when
    // the account row is filtered out, "Clínica del Norte" is a better label
    // for the group than nothing at all.
    name: org.accounts?.name ?? org.name,
    plan,
    role:
      (accountRoles ?? []).find((r) => r.account_id === org.accounts?.id)?.role ??
      null,
    /**
     * Treated as finished when the account row is unreadable.
     *
     * Failing the other way would trap somebody in a wizard they have already
     * completed, with no way out — the worst possible response to a transient
     * read failure. An account that really has not been configured simply gets
     * asked again next time.
     */
    onboardingCompleted: org.accounts ? org.accounts.onboarding_completed_at !== null : true,
  }

  return {
    userId: user.id,
    email: profile.email,
    fullName: profile.full_name || profile.email.split('@')[0],
    avatarUrl: profile.avatar_url,
    orgId: active.orgId,
    orgName: org.name,
    orgSlug: org.slug,
    companyType: org.company_type,
    subsector: org.subsector,
    setupCompleted: org.setup_completed_at !== null,
    plan,
    status: org.status,
    // The plan is applied here, once, rather than at each call site. Everything
    // downstream — `requirePermission`, `RequirePermission`, the sidebar, the
    // pickers in queries/shared.ts — asks the same `member.modules` question
    // and therefore cannot disagree about what the subscription includes.
    modules: resolveModules(org.enabled_modules, org.company_type, planModules(plan)),
    role: active.role,
    permissions: new Set((grants ?? []).map((g) => g.permission as Permission)),
    account,
    companies,
    accounts: (accountRoles ?? []).map((r) => ({
      accountId: r.account_id,
      name:
        (r.accounts as unknown as { name: string } | null)?.name ??
        // Same fallback as `account.name`: a group whose row was filtered out
        // is better labelled by the active company than by an empty string.
        (r.account_id === account.accountId ? account.name : 'Cuenta'),
      role: r.role as 'owner' | 'billing' | 'admin',
    })),
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

/**
 * Distinct from the plan errors because the fix is different.
 *
 * A suspended company is a payment state, not a configuration one: the data
 * is all still there and still readable, and the subscription being renewed
 * is what lifts the suspension. Sending an administrator to Configuración
 * would send them somewhere with nothing to fix.
 */
export class CompanySuspendedError extends Error {
  constructor() {
    super(
      'Esta empresa está suspendida: el plan está inactivo. Los datos siguen disponibles en modo de solo lectura.',
    )
    this.name = 'CompanySuspendedError'
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

  /**
   * The suspension gate, before the plan gate.
   *
   * A downgrade may suspend a company *and* leave it with modules outside the
   * plan; the suspension is the stronger statement and has to win the error.
   * Reads stay open — suspension hides nothing, it only stops new writes.
   */
  if (member.status === 'suspended' && !permission.endsWith(':read')) {
    throw new CompanySuspendedError()
  }

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
