import { redirect } from 'next/navigation'
import { requireMember } from '@/lib/auth/session'
import Client from './client'

/**
 * The paywall.
 *
 * Deliberately outside the `(dashboard)` group, for the same reason
 * `/onboarding` is: that layout redirects *here*, so a paywall living inside it
 * would redirect to itself. It also has no use for the sidebar or the
 * notification bell — there is nothing to navigate to yet.
 *
 * ─── Por qué existe ────────────────────────────────────────────────────────
 *
 * Until migration 106 nobody ever paid. Signing up created a `starter` account
 * — the tier `/pricing` charges $80.000/month for — with no subscription, no
 * expiry and no screen that ever asked. The checkout existed (Polar, migration
 * 38) but the only way to reach it was to *volunteer* to upgrade. This is the
 * screen that closes that gap: an account that has not subscribed gets here
 * instead of the dashboard, and leaves it by paying.
 *
 * Nothing is deleted or hidden while it waits. `app.company_is_active` refuses
 * writes and never touches SELECT, so the data is intact the moment the money
 * arrives.
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const member = await requireMember()

  // Already paid. Not an error state — this is where Polar's `successUrl`
  // lands once the webhook has been applied, and where anyone who bookmarks
  // the page ends up afterwards.
  if (member.account.accessState === 'active') {
    redirect('/dashboard')
  }

  return (
    <Client
      accountName={member.account.name}
      accountRole={member.account.role}
      plan={member.account.plan}
      accessState={member.account.accessState}
      email={member.email}
    />
  )
}
