'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Wallet, Lock } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import TabBar from '@/components/ui/TabBar'
import { isSelfServePlan, PLANS, type PlanKey } from '@/lib/plans'
import { CYCLES, PRICING, type Cycle } from '@/lib/pricing'
import { startPolarCheckout } from '@/server/mutations/billing'
import type { AccountAccessState } from '@/lib/auth/session'

/**
 * What the customer sees while the subscription is not running.
 *
 * Two audiences, and they need different screens. Somebody who governs the
 * account can fix this in one click, so they get the plans and a checkout.
 * Everybody else — the overwhelming majority, since being an employee of a
 * company says nothing about governing the group that owns it — can do nothing
 * about it at all, and a wall of prices they cannot buy would only read as the
 * product blaming them for somebody else's invoice.
 */
export default function SuscripcionClient({
  accountName,
  accountRole,
  plan,
  accessState,
  email,
}: {
  accountName: string
  accountRole: 'owner' | 'billing' | 'admin' | null
  plan: PlanKey
  accessState: AccountAccessState
  email: string
}) {
  const [cycle, setCycle] = useState<Cycle>('mensual')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [buying, setBuying] = useState<PlanKey | null>(null)

  // `billing` is deliberately not enough. It is the role for somebody who
  // receives the invoices, and `startPolarCheckout` gates on owner/admin —
  // offering a button the server will refuse is worse than not offering it.
  const canPay = accountRole === 'owner' || accountRole === 'admin'

  function checkout(tier: PlanKey) {
    if (!isSelfServePlan(tier)) return
    setError(null)
    setBuying(tier)
    startTransition(async () => {
      const result = await startPolarCheckout({
        plan: tier,
        interval: cycle === 'anual' ? 'yearly' : 'monthly',
        returnTo: '/suscripcion',
      })
      setBuying(null)
      if (!result.ok) {
        setError(result.error)
        return
      }
      // External host, so a full navigation rather than the router — the same
      // reason the wizard and the plan switcher do it this way.
      window.location.href = result.url
    })
  }

  return (
    <div className="onb">
      <div className="onb-card">
        <div className="onb-head">
          {canPay ? <Wallet size={18} /> : <Lock size={18} />}
          <div>
            <h1 className="onb-title">
              {accessState === 'delinquent'
                ? `El plan de ${accountName} está inactivo`
                : `Activa tu suscripción`}
            </h1>
            <p className="onb-sub">
              {accessState === 'delinquent'
                ? 'El último cobro no se completó. Tus datos siguen completos y en solo lectura: ' +
                  'vuelven a estar disponibles en cuanto se regularice el pago.'
                : `${accountName} todavía no tiene un plan activo. Tu empresa quedó configurada y ` +
                  'te espera; elige un plan para empezar a usarla.'}
            </p>
          </div>
        </div>

        {error && <p className="onb-error" role="alert">{error}</p>}

        {!canPay ? (
          <div className="onb-body">
            <p className="onb-note" style={{ marginTop: 0 }}>
              Solo quien administra la cuenta puede activar el plan. Pídeselo a esa persona —
              en cuanto lo haga, todo vuelve a funcionar sin que tengas que hacer nada.
            </p>
            <p className="onb-note">
              Entraste como <b>{email}</b>. Si administras la cuenta con otro correo, cierra
              sesión y vuelve a entrar con ese.
            </p>
            <div className="onb-foot">
              <Link href="/contact" className="btn">Hablar con nosotros</Link>
            </div>
          </div>
        ) : (
          <div className="onb-body">
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 10, marginBottom: 14,
              }}
            >
              <TabBar items={CYCLES} value={cycle} onChange={(key) => setCycle(key as Cycle)} />
              {cycle === 'anual' && <span className="muted" style={{ fontSize: 12 }}>2 meses gratis</span>}
            </div>

            {PLANS.map((tier) => {
              const pricing = PRICING[tier.key]
              const price = cycle === 'anual' ? pricing.priceAnnual : pricing.priceMonthly
              return (
                <div
                  key={tier.key}
                  className="card"
                  style={{
                    padding: 14, marginBottom: 10, display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 14.5 }}>{tier.label}</strong>
                      {/*
                        The tier the account already carries, which for a
                        `pending` account is whatever it was created with. It is
                        what the customer will be billed for if they take this
                        card, not a plan they already have — so it is labelled
                        as a suggestion rather than as a state.
                      */}
                      {tier.key === plan && <Badge st="Tu plan" tone="blu" />}
                      {pricing.featured && tier.key !== plan && <Badge st="Recomendado" tone="vio" />}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{tier.description}</div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {price}
                      <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>
                        {cycle === 'anual' ? '/año' : '/mes'}
                      </span>
                    </div>
                    {isSelfServePlan(tier.key) ? (
                      <button
                        className={tier.key === plan ? 'btn dark' : 'btn'}
                        style={{ marginTop: 6 }}
                        disabled={pending}
                        aria-busy={pending && buying === tier.key}
                        onClick={() => checkout(tier.key)}
                      >
                        {pending && buying === tier.key
                          ? <>Abriendo pago…</>
                          : <><ArrowRight size={14} />Pagar {tier.label}</>}
                      </button>
                    ) : (
                      <Link href={pricing.href} className="btn" style={{ marginTop: 6 }}>
                        Contactar ventas
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}

            <p className="onb-note">
              <Check size={12} style={{ verticalAlign: '-1px' }} /> El pago se procesa en Polar.
              Nada de lo que configuraste se pierde: tus datos están completos y en solo lectura
              hasta que el plan quede activo.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
