'use client'

import { useReveal } from '@/lib/hooks/use-reveal'
import PublicNav from '@/components/marketing/PublicNav'
import PublicFooter from '@/components/marketing/PublicFooter'

export default function PublicPageShell({ children }: { children: React.ReactNode }) {
  useReveal()

  return (
    <div className="landing">
      <PublicNav />
      {children}
      <PublicFooter />
    </div>
  )
}
