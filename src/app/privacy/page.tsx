import type { Metadata } from 'next'
import Link from 'next/link'
import PublicPageShell from '@/components/marketing/PublicPageShell'
import PublicCta from '@/components/marketing/PublicCta'

export const metadata: Metadata = {
  title: 'Política de privacidad',
  description: 'Cómo Kigyo recopila, usa y protege los datos personales de tu equipo.',
}

export default function PrivacyPage() {
  return (
    <PublicPageShell>
      <div className="pub-page-head">
        <span className="pub-page-eyebrow">Legal</span>
        <h1 className="pub-page-title">Política de privacidad</h1>
        <p className="pub-page-sub">
          Cómo recopilamos, usamos y protegemos los datos personales de tu equipo.
        </p>
      </div>

      <section className="l-section pub-section-tight">
        <div className="legal-body" data-reveal>
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
            Conforme a la Ley 1581 de 2012 y sus decretos reglamentarios, puedes
            conocer, actualizar, rectificar y suprimir tus datos personales, así
            como revocar la autorización para su tratamiento, a través de
            nuestro <Link href="/contact">formulario de contacto</Link>.
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
            Para dudas sobre esta política, escríbenos desde la{' '}
            <Link href="/contact">página de contacto</Link>.
          </p>
        </div>
      </section>

      <PublicCta
        title="¿Tienes dudas sobre privacidad?"
        subtitle="Nuestro equipo puede aclarar cómo protegemos los datos de tu organización."
        primary={{ href: '/contact', label: 'Contactar equipo' }}
      />
    </PublicPageShell>
  )
}
