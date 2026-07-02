import type { Metadata } from 'next'
import Link from 'next/link'
import PublicNav from '@/components/marketing/PublicNav'
import PublicFooter from '@/components/marketing/PublicFooter'
import { ArrowRight, Users, Shield, Sparkles } from '@/lib/icons'

export const metadata: Metadata = {
  title: 'Sobre nosotros',
  description:
    'Conoce la misión de Kigyo: simplificar la gestión de personas para equipos modernos en México y Latinoamérica.',
}

const VALUES = [
  {
    icon: Users,
    title: 'Personas primero',
    desc: 'Diseñamos cada función pensando en las personas que la usan a diario, no solo en procesos.',
  },
  {
    icon: Shield,
    title: 'Confianza y seguridad',
    desc: 'Los datos de tu equipo se tratan con el mismo cuidado que exigiríamos para los nuestros.',
  },
  {
    icon: Sparkles,
    title: 'Simplicidad',
    desc: 'Menos clics, menos fricción. Si una tarea toma más de un minuto, la rediseñamos.',
  },
]

export default function AboutPage() {
  return (
    <div className="landing">
      <PublicNav />

      <div className="pub-page-head">
        <span className="pub-page-eyebrow">Sobre nosotros</span>
        <h1 className="pub-page-title">Construimos el sistema operativo de personas</h1>
        <p className="pub-page-sub">
          Kigyo nació de la frustración de gestionar equipos con hojas de cálculo,
          carpetas dispersas y procesos manuales. Creemos que administrar personas
          debería ser simple, humano y estar al alcance de cualquier empresa.
        </p>
      </div>

      <section className="l-section">
        <div className="l-section-head">
          <h2 className="l-section-title">Nuestra misión</h2>
          <p className="l-section-sub">
            Ayudar a equipos de recursos humanos en México y Latinoamérica a dejar
            atrás el trabajo operativo repetitivo, para que puedan enfocarse en lo
            que realmente importa: su gente.
          </p>
        </div>

        <div className="about-values">
          {VALUES.map((v) => (
            <div key={v.title} className="card l-feature">
              <div className="l-feature-icon">
                <v.icon size={22} />
              </div>
              <h3 className="l-feature-title">{v.title}</h3>
              <p className="l-feature-desc">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="l-section l-cta">
        <div className="l-cta-card">
          <h2 className="l-cta-title">¿Quieres formar parte de la historia de Kigyo?</h2>
          <p className="l-cta-sub">
            Empieza a gestionar a tu equipo hoy mismo o platica con nosotros
            si tienes preguntas.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link href="/login" className="btn pri" style={{ height: 46, fontSize: 14, fontWeight: 700, padding: '0 28px', textDecoration: 'none' }}>
              Comenzar ahora
              <ArrowRight size={16} />
            </Link>
            <Link href="/contact" className="btn" style={{ height: 46, fontSize: 14, fontWeight: 600, padding: '0 28px', textDecoration: 'none' }}>
              Contactar equipo
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
