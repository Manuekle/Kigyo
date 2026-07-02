import type { Metadata } from 'next'
import Link from 'next/link'
import PublicNav from '@/components/marketing/PublicNav'
import PublicFooter from '@/components/marketing/PublicFooter'
import FaqAccordion from '@/components/marketing/FaqAccordion'

export const metadata: Metadata = {
  title: 'Preguntas frecuentes',
  description: 'Respuestas a las preguntas más comunes sobre Kigyo: planes, seguridad, migración de datos y cumplimiento legal.',
}

export default function FaqPage() {
  return (
    <div className="landing">
      <PublicNav />

      <div className="pub-page-head">
        <span className="pub-page-eyebrow">FAQ</span>
        <h1 className="pub-page-title">Preguntas frecuentes</h1>
        <p className="pub-page-sub">
          Todo lo que necesitas saber antes de empezar. ¿No encuentras tu
          respuesta? <Link href="/contact" style={{ color: 'var(--ink)', fontWeight: 600 }}>Escríbenos</Link>.
        </p>
      </div>

      <section className="l-section" style={{ paddingTop: 12, paddingBottom: 90 }}>
        <FaqAccordion />
      </section>

      <PublicFooter />
    </div>
  )
}
