import { AppProvider } from '@/lib/context/AppContext'
import { MemberProvider } from '@/lib/context/MemberContext'
import { requireMember } from '@/lib/auth/session'
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

  return (
    <MemberProvider
      member={{
        userId: member.userId,
        email: member.email,
        fullName: member.fullName,
        avatarUrl: member.avatarUrl,
        orgId: member.orgId,
        orgName: member.orgName,
        role: member.role,
        permissions: [...member.permissions],
      }}
    >
      <AppProvider>
        <a href="#contenido" className="skip-link">Saltar al contenido</a>
        <Sidebar />
        <main className="main">
          <Topbar />
          <div className="content" id="contenido" tabIndex={-1}>
            {children}
          </div>
        </main>
        <Toasts />
        <CommandPalette />
      </AppProvider>
    </MemberProvider>
  )
}
