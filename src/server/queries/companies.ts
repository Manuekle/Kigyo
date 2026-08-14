import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requireMember } from '@/lib/auth/session'
import type { RoleKey } from '@/lib/auth/permissions'

/**
 * The companies of the account, for the screen that manages them.
 *
 * This cannot be an ordinary select. `organizations_select` shows a person only
 * the companies they are a member of — correctly, and it is the property the
 * whole design rests on — which means an account owner cannot see a company
 * they created and then left. The screen that exists to offer them a way back
 * in would not be able to list it.
 *
 * `public.account_companies()` (migration 28) is the privileged read that
 * answers it, and it is deliberately thin: a name, a sector and whether the
 * caller is inside. Governing the account tells you a company exists, never
 * what is in it.
 */

export interface AccountCompany {
  orgId: string
  name: string
  slug: string
  companyType: string | null
  /** Whether the caller holds a membership, and can therefore open it. */
  joined: boolean
  /** The caller's role there, when they are inside. */
  role: RoleKey | null
  /** The group that owns it. `account_companies()` spans every group. */
  accountId: string
  accountName: string
}

export async function getAccountCompanies(): Promise<AccountCompany[]> {
  const member = await requireMember()
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('account_companies')

  if (error) {
    console.error('[companies] getAccountCompanies', error)
    return []
  }

  const rows = (data ?? []) as unknown as Array<{
    org_id: string
    name: string
    slug: string
    company_type: string | null
    account_id: string
    joined: boolean
  }>

  // The role comes from the session rather than from the function, which
  // deliberately does not return it: `member.companies` already carries the
  // caller's role in every company they belong to, and asking the database
  // again for something already in hand is a round trip for nothing.
  const roles = new Map(member.companies.map((c) => [c.orgId, c.role]))
  // Same reasoning for the group's name: every row this function returns
  // belongs to an account the caller governs, and those are exactly the ones
  // `member.accounts` carries.
  const accountNames = new Map(member.accounts.map((a) => [a.accountId, a.name]))

  return rows.map((row) => ({
    orgId: row.org_id,
    name: row.name,
    slug: row.slug,
    companyType: row.company_type,
    joined: row.joined,
    role: roles.get(row.org_id) ?? null,
    accountId: row.account_id,
    accountName: accountNames.get(row.account_id) ?? 'Cuenta',
  }))
}
