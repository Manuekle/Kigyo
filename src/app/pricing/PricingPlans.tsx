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
import { CYCLES, PRICING, trialDaysFor, type Cycle } from '@/lib/pricing'

/**
 * Four lines a buyer can scan. Seats and companies come from `PLANS` so the
 * card cannot drift from the gate; the pitch is the difference that makes
 * someone leave the tier below, not a dump of every module name.
 */
function featuresFor(index: number): string[] {
  const plan = PLANS[index]
  const below = index > 0 ? PLANS[index - 1] : null
  const seats = plan.seats === null
    ? 'Colaboradores ilimitados'
    : `Hasta ${plan.seats} colaboradores`
  const companies = plan.maxCompanies === null
    ? 'Empresas ilimitadas'
    : plan.maxCompanies === 1
      ? '1 empresa'
      : `Hasta ${plan.maxCompanies} empresas`

  if (index === 0) {
    return [seats, companies, 'Personas, clientes y documentos', ...PRICING.starter.extras]
  }
  if (index === 1) {
    return [
      `Todo lo de ${below!.label}`,
      `${seats} · ${companies}`,
      'Operación, ventas y módulos de sector',
      PRICING.growth.extras[0],
    ]
  }
  return [
    `Todo lo de ${below!.label}`,
    companies,
    'Tienda, ecommerce y trazabilidad',
    PRICING.enterprise.extras[0],
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
          const trialDays = trialDaysFor(plan.key, cycle)
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
                  <TextSwap>{annual ? 'USD/año' : 'USD/mes'}</TextSwap>
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
              {/*
                La nota de abajo dijo, en este orden: «Prueba 30 días gratis si
                solicitas una demo» —falso, no existía ninguna prueba— y luego
                el ofrecimiento de la demo, que sí es real. Ahora hay una prueba
                de verdad, y el riesgo se invierte: anunciarla en las seis
                tarjetas cuando solo la lleva Starter mensual. Por eso el número
                sale de `trialDaysFor` y la nota cambia por tarjeta y por ciclo.
              */}
              {trialDays > 0 ? (
                <p className="pricing-trial-note">
                  <strong>{trialDays} días gratis</strong> — solo en el plan mensual
                </p>
              ) : (
                <p className="pricing-trial-note">
                  {pricing.sales ? (
                    <>
                      ¿Necesitas SSO o una integración a medida?{' '}
                      <Link href={pricing.sales}>Habla con ventas</Link>
                    </>
                  ) : (
                    <>
                      <Link href="/contact">Solicita una demo</Link> y te damos acceso a un
                      entorno de ejemplo para mirarlo por dentro
                    </>
                  )}
                </p>
              )}
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
