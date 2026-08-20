'use client'

import { useState } from 'react'
import Link from 'next/link'
import BeamLink from '@/components/ui/BeamLink'
import BeamCard from '@/components/ui/BeamCard'
import TiltCard from '@/components/ui/TiltCard'
import TabBar from '@/components/ui/TabBar'
import PopNumber from '@/components/ui/PopNumber'
import TextSwap from '@/components/ui/TextSwap'
import { Check } from '@/lib/icons'
import { PLANS } from '@/lib/plans'
import { modulesByGroup } from '@/lib/modules'
import { CYCLES, PRICING, type Cycle } from '@/lib/pricing'

/**
 * What each tier costs lives in `@/lib/pricing`, shared with the in-dashboard
 * plan switcher so the two screens cannot quote different numbers. What each
 * tier *includes* is `@/lib/plans`, which is also what the product enforces.
 *
 * These two used to be separate prose. The page promised Starter customers
 * "empleados, asistencia y documentos" while the app let them switch on all
 * nineteen modules, and later promised Enterprise "tienda virtual y catálogos"
 * that Growth could reach anyway. A pricing page that describes a restriction
 * nobody implements is not a description, it is a wish.
 *
 * Deriving the feature list from the same catalogue the gate reads means a
 * module moved between tiers changes this page in the same commit, with no
 * second edit to forget.
 */

/**
 * The headline features for a tier: the seat allowance, then the modules this
 * tier adds over the one below it, grouped so the line reads as a sentence
 * rather than as a list of twenty-four nouns.
 *
 * Naming only the *difference* is what makes the ladder legible. Listing every
 * module in Growth would bury the six that are the actual reason to leave
 * Starter.
 */
function featuresFor(index: number): string[] {
  const plan = PLANS[index]
  const below = index > 0 ? PLANS[index - 1] : null
  const inherited = new Set(below?.modules ?? [])
  const added = plan.modules.filter((key) => !inherited.has(key))

  const seats = plan.seats === null
    ? 'Colaboradores ilimitados'
    : `Hasta ${plan.seats} colaboradores`

  const byGroup = modulesByGroup()
    .map(({ group, modules }) => {
      const names = modules.filter((m) => added.includes(m.key)).map((m) => m.label)
      return names.length > 0 ? `${group}: ${names.join(', ')}` : null
    })
    .filter((line): line is string => line !== null)

  return [
    seats,
    ...(below ? [`Todo lo de ${below.label}`] : []),
    ...byGroup,
    ...PRICING[plan.key].extras,
  ]
}

export default function PricingPlans() {
  const [cycle, setCycle] = useState<Cycle>('mensual')
  const annual = cycle === 'anual'

  return (
    <>
      <div className="pricing-toggle" data-reveal>
        <TabBar items={CYCLES} value={cycle} onChange={(key) => setCycle(key as Cycle)} />
        <span className="pricing-toggle-hint">Anual: 2 meses gratis</span>
      </div>

      <div className="pricing-grid">
        {PLANS.map((plan, i) => {
          const pricing = PRICING[plan.key]
          const card = (
            <div className={`card pricing-card${pricing.featured ? ' featured' : ''}`}>
              {pricing.featured && <span className="pricing-badge">Más popular</span>}
              <div className="pricing-name">{plan.label}</div>
              <div className="pricing-price">
                {/* Keyed on the cycle so switching remounts the figure. The
                    pop-in is an entrance animation: without a fresh element it
                    would only ever play on first paint, and changing the text
                    in place would swap the price with no motion at all. */}
                <span className="pricing-amount">
                  <PopNumber key={cycle} value={annual ? pricing.priceAnnual : pricing.priceMonthly} />
                </span>
                {/* The suffix is a word, not a figure, so it swaps rather than
                    popping character by character next to the number. */}
                <span className="pricing-period">
                  <TextSwap>{annual ? '/año' : '/mes'}</TextSwap>
                </span>
              </div>
              <p className="pricing-desc">{plan.description}</p>
              <ul className="pricing-features">
                {featuresFor(i).map((f) => (
                  <li key={f}>
                    <Check size={15} />
                    {f}
                  </li>
                ))}
              </ul>
              {pricing.featured ? (
                <BeamLink href={pricing.href} className="btn ink pricing-cta" borderRadius={18}>
                  {pricing.cta}
                </BeamLink>
              ) : (
                <Link href={pricing.href} className="btn pricing-cta">
                  {pricing.cta}
                </Link>
              )}
              <p className="pricing-trial-note">Prueba 30 días gratis si solicitas una demo</p>
            </div>
          )

          return (
            // The tilt is the outermost layer so the halo turns with the card
            // instead of staying square to the page under it. `radius` is
            // `.card`'s own 20px, which the glare inherits.
            <TiltCard key={plan.key} className="t-tilt-shell" radius={20} data-reveal data-reveal-delay={String(i + 1)}>
              {/* Only the recommended plan gets the halo — a bloom around all
                  three would single out none of them. */}
              {pricing.featured ? <BeamCard>{card}</BeamCard> : card}
            </TiltCard>
          )
        })}
      </div>
    </>
  )
}
