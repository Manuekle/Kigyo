import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AppProvider } from '@/lib/context/AppContext'
import { ConfirmProvider } from '@/lib/context/ConfirmContext'
import { MemberProvider } from '@/lib/context/MemberContext'
import { SoundProvider } from '@/lib/context/SoundContext'
import { requireMember } from '@/lib/auth/session'
import Toasts from '@/components/ui/Toasts'
import { ArrowLeft } from '@/lib/icons'

/**
 * The counter, without the office around it.
 *
 * `/dashboard/pos` renders inside the same shell as the other sixty-one
 * screens: a 272px rail of modules a cashier cannot open, a topbar with a theme
 * switch and a notification bell, and ~200px of KPI tiles above the products.
 * On the tablet at a till that is most of the screen spent on an administration
 * app, in front of somebody who is standing there waiting.
 *
 * ─── Why a route group and not a subdomain ─────────────────────────────────
 *
 * `pos.kigyo.pro` was the obvious shape and it is the wrong one. The session
 * cookies (`sb-*` and `kigyo_ctx`) are host-only, `NEXT_PUBLIC_APP_URL` is a
 * build-time constant that every confirmation email, Polar return and Wompi
 * redirect is built from, and the CSP is `connect-src 'self'` — so a second
 * host means a second login, a second active-company cookie that silently
 * drifts out of sync with the first, and a platform migration to pay for it.
 *
 * A sibling route group gets the same full screen for the price of this file:
 * one origin, one session, one active company, and a link back.
 *
 * ─── The gates are the same ────────────────────────────────────────────────
 *
 * Deliberately identical to `(dashboard)/layout.tsx`, in the same order and for
 * the same reasons — a second door into the same data must not be a second,
 * looser set of rules. The page adds `pos:read` on top.
 */
export const dynamic = 'force-dynamic'

export default async function MostradorLayout({ children }: { children: React.ReactNode }) {
  const member = await requireMember()

  if (!member.setupCompleted && member.permissions.has('configuracion:manage')) {
    redirect('/onboarding')
  }
  if (member.account.accessState !== 'active') {
    redirect('/suscripcion')
  }

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
            <div className="mostrador">
              {/*
                Forty pixels of chrome, and every one of them earns its place:
                which company is being charged in (a person who works two of
                them must be able to tell at a glance), who is at the till, and
                the way back. No theme switch, no bell, no module rail.
              */}
              <header className="mostrador-bar">
                <Link className="mostrador-back" href="/dashboard/pos">
                  <ArrowLeft size={15} />
                  <span>Salir del mostrador</span>
                </Link>
                <div className="mostrador-who">
                  <strong>{member.orgName}</strong>
                  <span>{member.fullName} · {member.role}</span>
                </div>
              </header>
              {/*
                A suspended company reads fine and refuses every write, which at
                a till means the sale will not go through. Said before the
                cashier finds out from a failed charge with a customer waiting.
              */}
              {member.status === 'suspended' && (
                <div className="suspend-banner" role="status">
                  <strong>{member.orgName} está en modo solo lectura.</strong>{' '}
                  No se pueden registrar ventas hasta regularizar el plan.{' '}
                  <Link href="/dashboard/empresas">Ver los planes</Link>
                </div>
              )}
              <main className="mostrador-body" id="contenido" tabIndex={-1}>
                {children}
              </main>
            </div>
            <Toasts />
          </SoundProvider>
        </ConfirmProvider>
      </AppProvider>
    </MemberProvider>
  )
}
