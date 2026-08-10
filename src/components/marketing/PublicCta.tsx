'use client'

import Link from 'next/link'
import BeamButton from '@/components/ui/BeamButton'
import { ArrowRight } from '@/lib/icons'

type Action = {
  href: string
  label: string
}

type PublicCtaProps = {
  title: string
  subtitle: string
  primary: Action
  secondary?: Action
}

export default function PublicCta({ title, subtitle, primary, secondary }: PublicCtaProps) {
  return (
    <section className="l-section l-cta">
      <div className="l-cta-card" data-reveal>
        <h2 className="l-cta-title">{title}</h2>
        <p className="l-cta-sub">{subtitle}</p>
        <div className="l-cta-actions">
          {/* 23px is half the 46px `.l-cta-btn` — the pill's real corner. */}
          <BeamButton borderRadius={23}>
            <Link href={primary.href} className="btn ink l-cta-btn">
              {primary.label}
              <ArrowRight size={16} />
            </Link>
          </BeamButton>
          {secondary && (
            <Link href={secondary.href} className="btn l-cta-btn">
              {secondary.label}
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
