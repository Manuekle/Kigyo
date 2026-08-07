import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { can, type Permission, type RoleKey } from './permissions'

export interface Member {
  userId: string
  email: string
  fullName: string
  avatarUrl: string | null
  orgId: string
  orgName: string
  orgSlug: string
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
  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) return null

  const { data, error } = await supabase
    .from('memberships')
    .select(
      `role,
       org_id,
       organizations!inner ( name, slug ),
       profiles!inner ( email, full_name, avatar_url )`,
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null

  const org = data.organizations as unknown as { name: string; slug: string }
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

/**
 * Server-side authorization gate.
 *
 * RLS already blocks the underlying rows, but a policy failure surfaces as an
 * empty result or an opaque database error. Checking here turns that into a
 * 403 the UI can explain.
 */
export async function requirePermission(permission: Permission): Promise<Member> {
  const member = await requireMember()
  if (!can(member.permissions, permission)) throw new PermissionError(permission)
  return member
}

export async function hasPermission(permission: Permission): Promise<boolean> {
  const member = await getMember()
  return member ? can(member.permissions, permission) : false
}
