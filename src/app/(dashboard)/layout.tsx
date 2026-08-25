import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AppProvider } from '@/lib/context/AppContext'
import { ConfirmProvider } from '@/lib/context/ConfirmContext'
import { MemberProvider } from '@/lib/context/MemberContext'
import { SoundProvider } from '@/lib/context/SoundContext'
import { requireMember } from '@/lib/auth/session'
import { getNotificaciones } from '@/server/queries/notificaciones'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import Toasts from '@/components/ui/Toasts'
import CommandPalette from '@/components/ui/CommandPalette'

/**
 * Every page under /dashboard renders per-user, permission-filtered data.
 * Prerendering any of it would either bake one tenant's view into a shared
 * HTML file or fail the build — neither is acceptable, so the whole segment
 * is dynamic by declaration rather than by inference.
 */
export const dynamic = 'force-dynamic'

/**
 * Authentication boundary for everything under /dashboard.
 *
 * `requireMember()` runs here rather than relying on the proxy redirect: proxy
 * matching has been bypassable in shipped Next releases, so the guard has to
 * live where the data is read. Individual routes add their own permission
 * check on top via `requirePermission()`.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember()

  /**
   * A company whose setup is unfinished goes to the wizard.
   *
   * Per company, not per account. The old condition asked whether the *account*
   * had ever been through onboarding, which meant the second company an account
   * created skipped setup entirely — no sector question, no module selection, no
   * branches, no invitations — because the first one had answered for it.
   *
   * Only for somebody who could actually finish it. An invited colleague never
   * sees the wizard: the company they joined is somebody else's to configure,
   * and showing them a half-finished setup they cannot complete would be both
   * confusing and a small disclosure about how the business is run.
   *
   * The company already exists and works by this point (the signup trigger
   * builds the first, `createCompany` the rest), so this is a redirect toward
   * something useful rather than a gate in front of something broken. Skipping
   * the wizard costs the customer a better-configured company, not a working one.
   */
  if (!member.setupCompleted && member.permissions.has('configuracion:manage')) {
    redirect('/onboarding')
  }

  /**
   * An account that has not paid does not get the product.
   *
   * Until migration 106 this check did not exist and neither did anything like
   * it: signing up created a `starter` account — the tier `/pricing` charges
   * $80.000/month for — and nothing in the product ever asked for money again.
   * `billing_status` was written by the webhook and read by nobody.
   *
   * After the setup redirect, deliberately. Somebody mid-wizard has not been
   * offered a plan yet — that is the wizard's last step — and bouncing them to
   * a paywall before they have seen what they are buying is the wall the
   * onboarding was designed not to be.
   *
   * This is the courteous half of the gate, not the load-bearing one. The rule
   * is enforced in the database by `app.company_is_active`, which every one of
   * the 543 RESTRICTIVE policies from migration 99 already consults — so an
   * unpaid account cannot write a row even talking to PostgREST directly with
   * the anon key, which is the hole a TypeScript-only paywall would leave.
   */
  if (member.account.accessState !== 'active') {
    redirect('/suscripcion')
  }
  // Derived from live rows rather than a fixture, so the bell's count is
  // something that can actually go to zero.
  const notificaciones = await getNotificaciones()

  return (
    <MemberProvider
      member={{
        userId: member.userId,
        email: member.email,
        fullName: member.fullName,
        avatarUrl: member.avatarUrl,
        orgId: member.orgId,
        orgName: member.orgName,
        companyType: member.companyType,
        subsector: member.subsector,
        plan: member.plan,
        timezone: member.orgTimezone,
        modules: [...member.modules],
        role: member.role,
        permissions: [...member.permissions],
        account: member.account,
        companies: member.companies,
        accounts: member.accounts,
      }}
    >
      <AppProvider>
        <ConfirmProvider>
          <SoundProvider>
            <a href="#contenido" className="skip-link">Saltar al contenido</a>
            <Sidebar />
            <main className="main">
              <Topbar notificaciones={notificaciones} />
              {/*
                A suspended company is fully readable and refuses every write.
                Without this banner the customer learns that from a failed save —
                an error about a permission they do have, for a reason nothing on
                screen mentions. Said once, at the top, on every page.

                Rendered here rather than per page because it is a property of the
                company, not of what is being looked at.
              */}
              {member.status === 'suspended' && (
                <div className="suspend-banner" role="status">
                  <strong>{member.orgName} está en modo solo lectura.</strong>{' '}
                  El plan de la cuenta no cubre esta empresa o el pago está pendiente. Tus datos
                  siguen completos y vuelven a estar disponibles al regularizar el plan.{' '}
                  {/*
                    The banner used to end there, telling the customer to
                    "regularizar el plan" without saying where. The screen that
                    does it is two clicks away behind a menu, so the sentence
                    was an instruction with no verb — and the person reading it
                    is, by definition, the one who wants to pay.
                  */}
                  <Link href="/dashboard/empresas">Ver los planes</Link>
                </div>
              )}
              <div className="content" id="contenido" tabIndex={-1}>
                {children}
              </div>
            </main>
            <Toasts />
            <CommandPalette />
          </SoundProvider>
        </ConfirmProvider>
      </AppProvider>
    </MemberProvider>
  )
}
