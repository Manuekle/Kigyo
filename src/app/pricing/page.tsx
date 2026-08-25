import type { Metadata } from 'next'
import PublicPageShell from '@/components/marketing/PublicPageShell'
import PublicCta from '@/components/marketing/PublicCta'
import PricingPlans from './PricingPlans'
import { PRICING } from '@/lib/pricing'

export const metadata: Metadata = {
  title: 'Precios',
  description: `Planes de Kigyo desde ${PRICING.starter.priceMonthly} USD/mes, o ${PRICING.starter.priceAnnual} USD/año. Sin permanencia: cancelas cuando quieras. Agenda una demo para verlo con tu equipo.`,
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
        {/* "Sin tarjeta de crédito" se fue con el muro de pago. Era cierto
            mientras nadie pagaba nunca; desde que la suscripción es obligatoria
            para usar el producto, es lo primero que un cliente descubre que no
            era verdad — y lo descubre al final del asistente, después de haber
            configurado su empresa entera. */}
        <p className="pub-page-sub">
          Sin permanencia: cancelas cuando quieras y tus datos siguen siendo
          tuyos. Activas solo los módulos que tu empresa usa y el resto no
          estorba.
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
