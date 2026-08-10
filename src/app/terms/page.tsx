import type { Metadata } from 'next'
import Link from 'next/link'
import PublicPageShell from '@/components/marketing/PublicPageShell'
import PublicCta from '@/components/marketing/PublicCta'

export const metadata: Metadata = {
  title: 'Términos de servicio',
  description: 'Términos y condiciones de uso de la plataforma Kigyo.',
}

export default function TermsPage() {
  return (
    <PublicPageShell>
      <div className="pub-page-head">
        <span className="pub-page-eyebrow">Legal</span>
        <h1 className="pub-page-title">Términos de servicio</h1>
        <p className="pub-page-sub">
          Condiciones de uso de la plataforma Kigyo para tu organización.
        </p>
      </div>

      <section className="l-section pub-section-tight">
        <div className="legal-body" data-reveal>
          <p className="legal-updated">Última actualización: 1 de julio de 2026</p>

          <h2>1. Aceptación de los términos</h2>
          <p>
            Al acceder o utilizar la plataforma Kigyo (&ldquo;el Servicio&rdquo;), aceptas
            quedar sujeto a estos Términos de servicio. Si no estás de acuerdo con
            alguna parte de estos términos, no debes utilizar el Servicio.
          </p>

          <h2>2. Descripción del servicio</h2>
          <p>
            Kigyo es una plataforma de gestión de personas (People Operating System)
            que permite a las empresas administrar personal, nómina, documentos,
            vacaciones y procesos relacionados de recursos humanos.
          </p>

          <h2>3. Cuentas y responsabilidad</h2>
          <p>
            Eres responsable de mantener la confidencialidad de tus credenciales de
            acceso y de toda actividad que ocurra bajo tu cuenta. Debes notificarnos
            de inmediato ante cualquier uso no autorizado.
          </p>

          <h2>4. Uso aceptable</h2>
          <ul>
            <li>No utilizar el Servicio para fines ilegales o no autorizados.</li>
            <li>No intentar acceder a datos de otras organizaciones sin autorización.</li>
            <li>No interferir con la seguridad o el funcionamiento normal de la plataforma.</li>
          </ul>

          <h2>5. Costo del Servicio</h2>
          <p>
            El Servicio se presta actualmente sin costo y no requiere método de
            pago. Si en el futuro se introducen planes pagos, lo informaremos con
            anticipación y ninguna función que hoy uses se cobrará de forma
            retroactiva.
          </p>

          <h2>6. Propiedad de los datos</h2>
          <p>
            Tú conservas la propiedad de todos los datos que ingreses a la
            plataforma. Kigyo únicamente procesa esta información para prestar el
            Servicio, conforme a nuestra Política de privacidad.
          </p>

          <h2>7. Limitación de responsabilidad</h2>
          <p>
            El Servicio se proporciona &ldquo;tal cual&rdquo;. En la medida permitida por la
            ley, Kigyo no será responsable por daños indirectos, incidentales o
            consecuentes derivados del uso de la plataforma.
          </p>

          <h2>8. Ley aplicable</h2>
          <p>
            Estos Términos se rigen por las leyes de la República de Colombia.
            Cualquier controversia se someterá a los jueces competentes de
            Bogotá D.C.
          </p>

          <h2>9. Cambios a estos términos</h2>
          <p>
            Podemos actualizar estos Términos de servicio ocasionalmente. Te
            notificaremos sobre cambios significativos por correo electrónico o
            mediante un aviso dentro de la plataforma.
          </p>

          <h2>10. Contacto</h2>
          <p>
            Si tienes preguntas sobre estos términos, escríbenos desde la{' '}
            <Link href="/contact">página de contacto</Link>.
          </p>
        </div>
      </section>

      <PublicCta
        title="¿Tienes preguntas sobre los términos?"
        subtitle="Escríbenos y con gusto te ayudamos a entender cómo funciona el servicio."
        primary={{ href: '/contact', label: 'Contactar equipo' }}
      />
    </PublicPageShell>
  )
}
