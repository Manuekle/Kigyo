import type { Metadata } from 'next'
import Link from 'next/link'
import PublicPageShell from '@/components/marketing/PublicPageShell'
import PublicCta from '@/components/marketing/PublicCta'
import FaqAccordion from '@/components/marketing/FaqAccordion'

export const metadata: Metadata = {
  title: 'Preguntas frecuentes',
  description: 'Respuestas a las preguntas más comunes sobre Kigyo: planes, demos, seguridad, migración de datos y cumplimiento legal.',
}

export default function FaqPage() {
  return (
    <PublicPageShell>
      <div className="pub-page-head">
        <span className="pub-page-eyebrow">FAQ</span>
        <h1 className="pub-page-title">Preguntas frecuentes</h1>
        <p className="pub-page-sub">
          Todo lo que necesitas saber antes de empezar. ¿No encuentras tu
          respuesta? <Link href="/contact" className="pub-inline-link">Escríbenos</Link>.
        </p>
      </div>

      <section className="l-section pub-section-tight">
        <div data-reveal>
          <FaqAccordion />
        </div>
      </section>

      <PublicCta
        title="¿Listo para probar Kigyo?"
        subtitle="Los tres planes cuestan $0 y no piden tarjeta de crédito."
        primary={{ href: '/register', label: 'Crear cuenta gratis' }}
        secondary={{ href: '/contact', label: 'Solicitar demo' }}
      />
    </PublicPageShell>
  )
}
