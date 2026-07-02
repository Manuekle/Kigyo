import { AppProvider } from '@/lib/context/AppContext'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import Toasts from '@/components/ui/Toasts'
import CommandPalette from '@/components/ui/CommandPalette'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <Sidebar />
      <main className="main">
        <Topbar />
        <div className="content">
          {children}
        </div>
      </main>
      <Toasts />
      <CommandPalette />
    </AppProvider>
  )
}
