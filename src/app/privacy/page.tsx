import type { Metadata } from 'next'
import PublicNav from '@/components/marketing/PublicNav'
import PublicFooter from '@/components/marketing/PublicFooter'

export const metadata: Metadata = {
  title: 'Política de privacidad',
  description: 'Cómo Kigyo recopila, usa y protege los datos personales de tu equipo.',
}

export default function PrivacyPage() {
  return (
    <div className="landing">
      <PublicNav />

      <div className="pub-page-head">
        <span className="pub-page-eyebrow">Legal</span>
        <h1 className="pub-page-title">Política de privacidad</h1>
      </div>

      <section className="l-section" style={{ paddingTop: 12 }}>
        <div className="legal-body">
          <p className="legal-updated">Última actualización: 1 de julio de 2026</p>

          <h2>1. Información que recopilamos</h2>
          <p>
            Recopilamos la información que tú y tu organización proporcionan al
            usar Kigyo: datos de cuenta, información de empleados que administras
            en la plataforma (nombre, puesto, contacto, documentos laborales) y
            datos de uso del Servicio.
          </p>

          <h2>2. Cómo usamos tu información</h2>
          <ul>
            <li>Para operar y mantener la plataforma Kigyo.</li>
            <li>Para procesar nómina, documentos y solicitudes dentro del Servicio.</li>
            <li>Para brindar soporte técnico y comunicarnos contigo.</li>
            <li>Para mejorar y desarrollar nuevas funcionalidades.</li>
          </ul>

          <h2>3. Con quién compartimos información</h2>
          <p>
            No vendemos datos personales. Compartimos información únicamente con
            proveedores que nos ayudan a operar el Servicio (por ejemplo, hosting
            o procesamiento de pagos), bajo acuerdos de confidencialidad, o cuando
            la ley lo exige.
          </p>

          <h2>4. Seguridad de los datos</h2>
          <p>
            Los datos se almacenan encriptados en tránsito y en reposo. Aplicamos
            controles de acceso por rol, respaldos automáticos y monitoreo
            continuo para proteger la información de tu equipo.
          </p>

          <h2>5. Retención de datos</h2>
          <p>
            Conservamos los datos mientras tu cuenta esté activa o según lo
            requiera la legislación laboral aplicable. Puedes solicitar la
            eliminación de tu cuenta y datos asociados en cualquier momento.
          </p>

          <h2>6. Tus derechos</h2>
          <p>
            Puedes solicitar acceso, corrección o eliminación de tus datos
            personales, así como oponerte a ciertos usos, escribiendo a
            hola@kigyo.mx.
          </p>

          <h2>7. Cookies</h2>
          <p>
            Utilizamos cookies esenciales para el funcionamiento de la plataforma
            y cookies analíticas para entender cómo se usa el Servicio y
            mejorarlo.
          </p>

          <h2>8. Cambios a esta política</h2>
          <p>
            Podemos actualizar esta Política de privacidad periódicamente.
            Notificaremos cambios importantes por correo electrónico o dentro de
            la plataforma.
          </p>

          <h2>9. Contacto</h2>
          <p>
            Para dudas sobre esta política, escríbenos a hola@kigyo.mx.
          </p>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
