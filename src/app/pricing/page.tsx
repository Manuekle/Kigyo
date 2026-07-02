import type { Metadata } from 'next'
import Link from 'next/link'
import PublicNav from '@/components/marketing/PublicNav'
import PublicFooter from '@/components/marketing/PublicFooter'
import { Check } from '@/lib/icons'

export const metadata: Metadata = {
  title: 'Precios',
  description: 'Planes de Kigyo para equipos de cualquier tamaño. Sin contratos forzosos, cancela cuando quieras.',
}

const PLANS = [
  {
    name: 'Starter',
    price: '$0',
    period: '/mes',
    desc: 'Para equipos pequeños que empiezan a organizar su gestión de personas.',
    features: [
      'Hasta 10 colaboradores',
      'Perfiles y organigrama',
      'Solicitudes de vacaciones',
      'Documentos básicos',
      'Soporte por correo',
    ],
    cta: 'Comenzar gratis',
    featured: false,
  },
  {
    name: 'Growth',
    price: '$899',
    period: 'MXN /mes',
    desc: 'Para empresas en crecimiento que necesitan automatizar nómina y firmas.',
    features: [
      'Colaboradores ilimitados',
      'Nómina y recibos automatizados',
      'Firmas electrónicas',
      'Dashboard e insights con IA',
      'Flujos de aprobación personalizados',
      'Soporte prioritario',
    ],
    cta: 'Comenzar prueba gratis',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: 'A medida',
    period: '',
    desc: 'Para organizaciones con requisitos de seguridad y cumplimiento avanzados.',
    features: [
      'Todo lo de Growth',
      'SSO y controles de seguridad',
      'Integraciones personalizadas',
      'SLA y soporte dedicado',
      'Onboarding asistido',
    ],
    cta: 'Hablar con ventas',
    featured: false,
  },
]

export default function PricingPage() {
  return (
    <div className="landing">
      <PublicNav />

      <div className="pub-page-head">
        <span className="pub-page-eyebrow">Precios</span>
        <h1 className="pub-page-title">Un plan para cada etapa de tu equipo</h1>
        <p className="pub-page-sub">
          Empieza gratis y crece a tu ritmo. Sin contratos forzosos, cancela
          cuando quieras.
        </p>
      </div>

      <section className="l-section" style={{ paddingTop: 12 }}>
        <div className="pricing-grid">
          {PLANS.map((plan) => (
            <div key={plan.name} className={`card pricing-card${plan.featured ? ' featured' : ''}`}>
              {plan.featured && <span className="pricing-badge">Más popular</span>}
              <div className="pricing-name">{plan.name}</div>
              <div className="pricing-price">
                <span className="pricing-amount">{plan.price}</span>
                {plan.period && <span className="pricing-period">{plan.period}</span>}
              </div>
              <p className="pricing-desc">{plan.desc}</p>
              <ul className="pricing-features">
                {plan.features.map((f) => (
                  <li key={f}>
                    <Check size={15} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href={plan.name === 'Enterprise' ? '/contact' : '/login'} className={`btn${plan.featured ? ' pri' : ''}`}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="l-section l-quote-section" style={{ paddingTop: 0 }}>
        <div className="l-quote-card" style={{ padding: '32px 36px', gap: 12 }}>
          <p className="l-quote-text" style={{ fontSize: 15 }}>
            ¿Necesitas un plan personalizado o tienes preguntas sobre facturación?
          </p>
          <Link href="/contact" className="btn pri" style={{ textDecoration: 'none' }}>
            Contactar ventas
          </Link>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
