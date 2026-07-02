'use client'

import { usePathname } from 'next/navigation'

// Content-side of the skeleton reveal. The dashboard-segment template
// does not remount on sub-navigation, so key the wrapper by pathname to
// replay the fade-in + un-blur each time a page swaps in after its
// loading.tsx skeleton.
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div key={pathname} className="page-reveal">
      {children}
    </div>
  )
}
