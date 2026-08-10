'use client'

import Link from 'next/link'
import BeamButton from '@/components/ui/BeamButton'
import type { BorderBeamSize } from 'border-beam'

type BeamLinkProps = {
  href: string
  className?: string
  size?: BorderBeamSize
  borderRadius?: number
  children: React.ReactNode
}

/** `BeamButton` around a `next/link` — the same ring on a navigation CTA. */
export default function BeamLink({
  href,
  className,
  size = 'sm',
  borderRadius,
  children,
}: BeamLinkProps) {
  return (
    <BeamButton size={size} borderRadius={borderRadius}>
      <Link href={href} className={className}>
        {children}
      </Link>
    </BeamButton>
  )
}
