import type { Metadata } from 'next'
import PublicNav from '@/components/marketing/PublicNav'
import PublicFooter from '@/components/marketing/PublicFooter'
import ContactForm from '@/components/marketing/ContactForm'
import { Mail, MessageSquare, MapPin } from '@/lib/icons'

export const metadata: Metadata = {
  title: 'Contacto',
  description: 'Ponte en contacto con el equipo de Kigyo para dudas de ventas, soporte o alianzas.',
}

const INFO = [
  {
    icon: Mail,
    title: 'Correo',
    value: 'hola@kigyo.mx',
  },
  {
    icon: MessageSquare,
    title: 'Soporte',
    value: 'Respuesta en menos de 24h hábiles',
  },
  {
    icon: MapPin,
    title: 'Oficina',
    value: 'Ciudad de México, México',
  },
]

export default function ContactPage() {
  return (
    <div className="landing">
      <PublicNav />

      <div className="pub-page-head">
        <span className="pub-page-eyebrow">Contacto</span>
        <h1 className="pub-page-title">Hablemos de tu equipo</h1>
        <p className="pub-page-sub">
          Ya sea que tengas dudas sobre planes, necesites soporte o quieras
          platicar sobre una alianza, aquí estamos.
        </p>
      </div>

      <section className="l-section" style={{ paddingTop: 12, paddingBottom: 90 }}>
        <div className="contact-grid">
          <div className="card contact-info-card">
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

          <ContactForm />
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
