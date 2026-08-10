import type { Metadata } from 'next'
import PublicPageShell from '@/components/marketing/PublicPageShell'
import PublicCta from '@/components/marketing/PublicCta'
import PricingPlans from './PricingPlans'

export const metadata: Metadata = {
  title: 'Precios',
  description: 'Planes de Kigyo desde $80.000/mes, o $800.000/año. Sin tarjeta de crédito y sin contratos forzosos. Agenda una demo para verlo con tu equipo.',
}

export default function PricingPage() {
  return (
    <PublicPageShell>
      <div className="pub-page-head">
        <span className="pub-page-eyebrow">Precios</span>
        <h1 className="pub-page-title">Un plan para cada etapa de tu equipo</h1>
        {/* "Sin funciones bloqueadas" was here, next to three tiers that
            differ precisely by which functions they unlock. Nómina is not in
            Starter; saying otherwise on the pricing page is a claim the
            product contradicts on day one. */}
        <p className="pub-page-sub">
          Sin tarjeta de crédito y sin contratos forzosos. Activas solo los
          módulos que tu empresa usa y el resto no estorba.
        </p>
      </div>

      <section className="l-section" style={{ paddingTop: 12 }}>
        <PricingPlans />
      </section>

      <PublicCta
        title="¿Quieres verlo con tu equipo?"
        subtitle="Agenda una demo y te mostramos cómo quedaría tu operación en Kigyo."
        primary={{ href: '/contact', label: 'Solicitar demo' }}
        secondary={{ href: '/faq', label: 'Ver preguntas frecuentes' }}
      />
    </PublicPageShell>
  )
}
