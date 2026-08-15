import type { Metadata } from 'next'
import PublicPageShell from '@/components/marketing/PublicPageShell'
import PublicCta from '@/components/marketing/PublicCta'
import TiltCard from '@/components/ui/TiltCard'
import { Users, Shield, Sparkles } from '@/lib/icons'

export const metadata: Metadata = {
  title: 'Sobre nosotros',
  description:
    'Conoce la misión de Kigyo: simplificar la operación de tu negocio — clientes, inventario, ventas y personas — para empresas en América Latina.',
}

// One line each. Three cards side by side are read as a set, not studied one
// at a time — a second sentence in each is a sentence nobody reaches.
const VALUES = [
  {
    icon: Users,
    title: 'Personas primero',
    desc: 'Diseñamos para quien usa la herramienta a diario, no para el proceso.',
  },
  {
    icon: Shield,
    title: 'Confianza y seguridad',
    desc: 'Cuidamos los datos de tu equipo como exigiríamos para los nuestros.',
  },
  {
    icon: Sparkles,
    title: 'Simplicidad',
    desc: 'Si una tarea toma más de un minuto, la rediseñamos.',
  },
]

export default function AboutPage() {
  return (
    <PublicPageShell>
      <div className="pub-page-head">
        <span className="pub-page-eyebrow">Sobre nosotros</span>
        <h1 className="pub-page-title">Construimos el sistema operativo de tu negocio</h1>
        <p className="pub-page-sub">
          Nacimos de la frustración de operar un negocio con hojas de cálculo,
          herramientas sueltas y procesos manuales.
        </p>
      </div>

      {/* No section head: the three cards say what they are on their own, and
          a heading over them was one more line to read before reaching them. */}
      <section className="l-section">
        <div className="about-values">
          {VALUES.map((v, i) => (
            <TiltCard key={v.title} className="card l-feature" data-reveal data-reveal-delay={String(i + 1)}>
              <div className="l-feature-icon">
                <v.icon size={22} />
              </div>
              <h3 className="l-feature-title">{v.title}</h3>
              <p className="l-feature-desc">{v.desc}</p>
            </TiltCard>
          ))}
        </div>
      </section>

      <PublicCta
        title="¿Quieres formar parte de la historia de Kigyo?"
        subtitle="Empieza hoy mismo o platica con nosotros."
        primary={{ href: '/login', label: 'Comenzar ahora' }}
        secondary={{ href: '/contact', label: 'Contactar equipo' }}
      />
    </PublicPageShell>
  )
}
