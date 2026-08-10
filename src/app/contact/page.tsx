import type { Metadata } from 'next'
import PublicPageShell from '@/components/marketing/PublicPageShell'
import ContactForm from '@/components/marketing/ContactForm'
import { Mail, MessageSquare, MapPin } from '@/lib/icons'

export const metadata: Metadata = {
  title: 'Contacto',
  description: 'Solicita una demo de Kigyo o escríbenos si necesitas soporte con tu cuenta.',
}

// The form is the only contact channel — there is no mailbox to publish while
// the product lives on a vercel.app domain.
const INFO = [
  {
    icon: Mail,
    title: 'Demo',
    value: 'Te escribimos para agendar una sesión con tu equipo',
  },
  {
    icon: MessageSquare,
    title: 'Soporte',
    value: 'Respuesta en menos de 24h hábiles',
  },
  {
    icon: MapPin,
    title: 'Dónde estamos',
    value: 'Bogotá, Colombia',
  },
]

export default function ContactPage() {
  return (
    <PublicPageShell>
      <div className="pub-page-head">
        <span className="pub-page-eyebrow">Contacto</span>
        <h1 className="pub-page-title">Solicita una demo</h1>
        <p className="pub-page-sub">
          Te mostramos Kigyo con los procesos de tu operación. También puedes
          escribirnos si tienes dudas sobre los planes o necesitas soporte.
        </p>
      </div>

      <section className="l-section pub-section-tight">
        <div className="contact-grid">
          <div className="card contact-info-card" data-reveal>
            {INFO.map((item) => (
              <div key={item.title} className="contact-info-item">
                <div className="l-feature-icon">
                  <item.icon size={20} />
                </div>
                <div>
                  <b>{item.title}</b>
                  <span>{item.value}</span>
                </div>
              </div>
            ))}
          </div>

          <div data-reveal data-reveal-delay="2">
            <ContactForm />
          </div>
        </div>
      </section>
    </PublicPageShell>
  )
}
