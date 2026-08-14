import { redirect } from 'next/navigation'
import { requireMember } from '@/lib/auth/session'
import { getAccountCompanies } from '@/server/queries/companies'
import Client from './client'

/**
 * The account's companies.
 *
 * Guarded by hand rather than by `RequirePermission`, because this screen is
 * not a module. `role_permissions` answers "may this person open Facturación in
 * *this company*", and the question here is one level up: may they govern the
 * account that owns the companies. Wiring it to a module permission would have
 * meant inventing an `empresas:read` that every company grants separately —
 * which is the wrong grain and would have let an administrator of one company
 * enumerate the group.
 *
 * Redirects rather than showing a refusal: an employee has no path to this URL
 * from the UI, so arriving here means typing it, and a page explaining what
 * they may not do is of no use to them.
 */
export default async function Page() {
  const member = await requireMember()

  if (member.account.role !== 'owner' && member.account.role !== 'admin') {
    redirect('/dashboard')
  }

  const companies = await getAccountCompanies()
  return <Client companies={companies} />
}
