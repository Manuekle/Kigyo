import type { Metadata } from 'next'
import PublicNav from '@/components/marketing/PublicNav'
import PublicFooter from '@/components/marketing/PublicFooter'

export const metadata: Metadata = {
  title: 'Términos de servicio',
  description: 'Términos y condiciones de uso de la plataforma Kigyo.',
}

export default function TermsPage() {
  return (
    <div className="landing">
      <PublicNav />

      <div className="pub-page-head">
        <span className="pub-page-eyebrow">Legal</span>
        <h1 className="pub-page-title">Términos de servicio</h1>
      </div>

      <section className="l-section" style={{ paddingTop: 12 }}>
        <div className="legal-body">
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

          <h2>5. Pagos y suscripciones</h2>
          <p>
            Los planes de pago se facturan de forma recurrente según el ciclo
            elegido. Puedes cancelar tu suscripción en cualquier momento; el acceso
            se mantendrá vigente hasta el final del periodo ya pagado.
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

          <h2>8. Cambios a estos términos</h2>
          <p>
            Podemos actualizar estos Términos de servicio ocasionalmente. Te
            notificaremos sobre cambios significativos por correo electrónico o
            mediante un aviso dentro de la plataforma.
          </p>

          <h2>9. Contacto</h2>
          <p>
            Si tienes preguntas sobre estos términos, escríbenos a
            hola@kigyo.mx.
          </p>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
