import type { Metadata } from 'next'
import Link from 'next/link'
import PublicPageShell from '@/components/marketing/PublicPageShell'
import PublicCta from '@/components/marketing/PublicCta'
import { PRICING } from '@/lib/pricing'

export const metadata: Metadata = {
  title: 'Términos de servicio',
  description: 'Condiciones de uso, suscripción y responsabilidades de la plataforma Kigyo.',
}

/**
 * Los términos, reescritos contra lo que el producto hace de verdad.
 *
 * La versión anterior describía Kigyo como «una plataforma de gestión de
 * personas… nómina, documentos, vacaciones» — un módulo y medio de los
 * cincuenta y nueve que tiene, sin mencionar el punto de venta, la facturación,
 * el inventario ni los verticales de salud. Un contrato que describe mal el
 * objeto es un contrato que no cubre lo que se está vendiendo.
 *
 * Lo que se añade y por qué:
 *
 *   · §5 y §6 — la suscripción es en dólares y la cobra Polar, y la prueba
 *     gratuita es de 14 días y SOLO en Starter mensual. Ese detalle estaba en
 *     la página de precios y en ninguna parte vinculante.
 *   · §9 — los módulos con alcance limitado, dichos aquí y no solo en la
 *     pantalla: nómina con parámetros que pone el cliente, DIAN en modo
 *     demostración, cobros de mostrador simulados, y notificaciones y
 *     marketing sin envío. Es la sección que más protege a las dos partes.
 *   · §10 — quién responde por los datos de terceros que el cliente sube. Con
 *     historias clínicas de por medio, no decirlo es lo grave.
 */
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
          <p className="legal-updated">Última actualización: 25 de agosto de 2026</p>

          <h2>1. Aceptación de los términos</h2>
          <p>
            Al crear una cuenta, acceder o utilizar la plataforma Kigyo
            (&ldquo;el Servicio&rdquo;), aceptas quedar sujeto a estos Términos de
            servicio y a nuestra <Link href="/privacy">Política de privacidad</Link>,
            que forma parte integral de este acuerdo. Si contratas en nombre de una
            empresa, declaras tener facultad para obligarla. Si no estás de acuerdo
            con alguna parte, no debes utilizar el Servicio.
          </p>

          <h2>2. Descripción del servicio</h2>
          <p>
            Kigyo es una plataforma de gestión empresarial en la nube que combina
            CRM, ERP y punto de venta. Incluye, entre otros, módulos de personas y
            nómina, clientes, cotizaciones, pedidos, facturación, cartera, compras,
            inventario, contabilidad, caja y punto de venta, documentos con
            asistente de inteligencia artificial, y módulos sectoriales
            —salud, educación, restaurante, hotelería, agro, inmobiliario,
            construcción y otros—.
          </p>
          <p>
            Los módulos disponibles dependen del plan contratado y de los que la
            organización decida activar. La lista vigente de cada plan está
            publicada en la <Link href="/pricing">página de precios</Link>.
          </p>

          <h2>3. Cuentas, empresas y usuarios</h2>
          <p>
            El Servicio distingue tres niveles: la <strong>cuenta</strong>, que es
            quien contrata y paga la suscripción; las <strong>empresas</strong> que
            operan bajo esa cuenta, cada una con sus propios datos; y las{' '}
            <strong>personas</strong> invitadas a cada empresa, con un rol que
            determina qué pueden ver y hacer.
          </p>
          <p>
            Quien administra la cuenta es responsable de a quién invita y con qué
            rol. Pertenecer a la cuenta no otorga por sí solo acceso a los datos de
            una empresa: hace falta ser miembro de esa empresa.
          </p>
          <p>
            Eres responsable de mantener la confidencialidad de tus credenciales y
            de toda actividad realizada bajo tu cuenta. Debes notificarnos de
            inmediato ante cualquier uso no autorizado. Recomendamos activar la
            verificación en dos pasos, disponible en Configuración.
          </p>

          <h2>4. Uso aceptable</h2>
          <ul>
            <li>No utilizar el Servicio para fines ilegales o no autorizados.</li>
            <li>No intentar acceder a datos de otras organizaciones, ni eludir los controles de aislamiento o de permisos.</li>
            <li>No interferir con la seguridad o el funcionamiento normal de la plataforma, ni someterla a cargas automatizadas que la degraden.</li>
            <li>No cargar contenido ilícito, ni datos personales de terceros sin la autorización que la ley exija.</li>
            <li>No revender el Servicio ni cederlo a un tercero sin nuestro consentimiento escrito.</li>
          </ul>
          <p>
            Podemos suspender el acceso ante un incumplimiento grave o ante un uso
            que ponga en riesgo la plataforma o los datos de otros clientes,
            avisando cuando las circunstancias lo permitan.
          </p>

          <h2>5. Suscripción, precios y pagos</h2>
          <p>
            El Servicio se presta mediante suscripción de pago. Los planes vigentes
            y sus precios están publicados en la{' '}
            <Link href="/pricing">página de precios</Link>, desde{' '}
            {PRICING.starter.priceMonthly} USD al mes. <strong>Los precios están
            expresados en dólares de los Estados Unidos (USD)</strong>; si tu medio
            de pago está denominado en otra moneda, tu banco aplicará su propia tasa
            de conversión y podrá cobrar comisiones que no controlamos.
          </p>
          <p>
            El cobro lo procesa <strong>Polar</strong>, nuestro proveedor de pagos,
            que actúa como comerciante registrado de la operación y emite el
            comprobante correspondiente. Kigyo no almacena los datos de tu tarjeta.
          </p>
          <p>
            La suscripción se renueva automáticamente por periodos iguales al
            contratado hasta que la canceles. Puedes cancelar en cualquier momento
            desde el portal de facturación; la cancelación surte efecto al final del
            periodo ya pagado y no genera reembolsos proporcionales, salvo que la
            ley aplicable disponga otra cosa.
          </p>
          <p>
            Configurar tu empresa es gratuito. <strong>Para operarla hace falta un
            plan activo.</strong> Si la suscripción se interrumpe, la cuenta pasa a
            modo de solo lectura: conservas el acceso a todos tus datos y puedes
            exportarlos, y las funciones de escritura vuelven en cuanto el plan se
            reactive. No borramos tu información por falta de pago.
          </p>
          <p>
            Cualquier cambio de precio se informará con al menos treinta (30) días
            de anticipación y no se aplicará de forma retroactiva al periodo ya
            pagado. Las cuentas creadas antes de la introducción de la suscripción
            obligatoria conservan el acceso que ya tenían.
          </p>

          <h2>6. Prueba gratuita</h2>
          <p>
            El plan <strong>Starter con facturación mensual</strong> incluye{' '}
            <strong>catorce (14) días de prueba</strong> antes del primer cobro.
            Ningún otro plan ni ciclo de facturación incluye periodo de prueba. Si
            no cancelas antes de que terminen los catorce días, la suscripción
            continúa y se cobra el primer periodo. La prueba puede requerir un medio
            de pago válido al momento de activarla.
          </p>

          <h2>7. Suspensión y terminación</h2>
          <p>
            Puedes terminar este acuerdo cancelando la suscripción. Nosotros podemos
            suspender o terminar el Servicio por falta de pago o por incumplimiento
            de la sección 4.
          </p>
          <p>
            Tras la terminación conservarás, durante al menos noventa (90) días,
            acceso de lectura y exportación a tus datos, salvo que solicites su
            eliminación antes. Transcurrido ese plazo podremos eliminarlos de forma
            definitiva. Recomendamos exportar la información que necesites conservar
            antes de cancelar.
          </p>

          <h2>8. Tus datos</h2>
          <p>
            Conservas la propiedad de todos los datos que tú y tu organización
            ingresen a la plataforma. Kigyo los procesa únicamente para prestar el
            Servicio, conforme a la{' '}
            <Link href="/privacy">Política de privacidad</Link>. No usamos tus datos
            de negocio para entrenar modelos de inteligencia artificial ni los
            cedemos a terceros con fines comerciales.
          </p>
          <p>
            Puedes exportar tus datos en cualquier momento desde los módulos que
            ofrecen exportación, y solicitar una copia completa escribiéndonos.
          </p>

          <h2>9. Alcance de determinados módulos</h2>
          <p>
            Algunos módulos requieren configuración, validación profesional o
            proveedores externos que el cliente debe contratar. Los describimos aquí
            para que no haya lugar a equívoco:
          </p>
          <ul>
            <li>
              <strong>Nómina.</strong> Kigyo calcula con los parámetros que tu
              organización cargue —salario mínimo, auxilio de transporte,
              porcentajes de seguridad social y parafiscales— y genera el archivo
              PILA. La plataforma no fija esas cifras ni las actualiza por su
              cuenta. La correcta liquidación y su conformidad con la legislación
              laboral vigente son responsabilidad de tu organización y de su
              contador.
            </li>
            <li>
              <strong>Facturación electrónica (DIAN).</strong> El módulo opera en{' '}
              <strong>modo de demostración</strong>: genera un documento XML y un
              CUFE simulados con fines de prueba. <strong>No constituye facturación
              electrónica válida ante la DIAN</strong> y no sustituye a un proveedor
              tecnológico habilitado. Emitir facturación electrónica con validez
              fiscal exige contratar dicho proveedor.
            </li>
            <li>
              <strong>Cobros con pasarela en el punto de venta.</strong> La
              integración de pagos del mostrador opera en modo simulado mientras no
              se configuren llaves reales del proveedor. Las ventas en efectivo y
              demás medios se registran normalmente.
            </li>
            <li>
              <strong>Notificaciones y marketing.</strong> Las reglas de aviso
              operan dentro de la plataforma. El envío por correo electrónico o
              mensajería requiere que conectes un proveedor de mensajería; sin él,
              Kigyo prepara y guarda las listas pero no envía mensajes.
            </li>
            <li>
              <strong>Asistente de inteligencia artificial.</strong> Sus respuestas
              se generan automáticamente y pueden contener errores. No sustituyen
              asesoría contable, jurídica, médica ni profesional de ninguna clase, y
              deben verificarse antes de actuar sobre ellas.
            </li>
          </ul>

          <h2>10. Datos de terceros que cargas en la plataforma</h2>
          <p>
            Tu organización carga en Kigyo datos personales de terceros —empleados,
            clientes, proveedores y, según el sector, pacientes—. Frente a esos
            datos, <strong>tu organización actúa como responsable del tratamiento y
            Kigyo como encargado</strong>: los tratamos siguiendo tus instrucciones y
            para prestarte el Servicio.
          </p>
          <p>
            Corresponde a tu organización obtener las autorizaciones que la ley
            exija, informar a los titulares y atender el ejercicio de sus derechos.
            Esto es especialmente relevante cuando cargas <strong>datos sensibles</strong>,
            como información de salud en los módulos clínicos y veterinarios, cuyo
            tratamiento requiere autorización explícita del titular.
          </p>

          <h2>11. Disponibilidad y cambios en el Servicio</h2>
          <p>
            Trabajamos para mantener el Servicio disponible de forma continua, pero
            no garantizamos una disponibilidad ininterrumpida salvo que se haya
            pactado un acuerdo de nivel de servicio por escrito. Podemos realizar
            mantenimientos programados, avisando con antelación razonable cuando
            impliquen interrupción.
          </p>
          <p>
            Podemos modificar, añadir o retirar funcionalidades. Si retiramos una
            funcionalidad relevante de tu plan, te avisaremos con anticipación
            razonable.
          </p>

          <h2>12. Propiedad intelectual</h2>
          <p>
            El Servicio, su software, diseño, marcas y documentación son propiedad
            de Kigyo o de sus licenciantes. Te otorgamos una licencia limitada, no
            exclusiva, revocable e intransferible para usar el Servicio durante la
            vigencia de tu suscripción. Esta licencia no te transfiere derecho
            alguno sobre el software.
          </p>

          <h2>13. Limitación de responsabilidad</h2>
          <p>
            El Servicio se proporciona &ldquo;tal cual&rdquo; y &ldquo;según
            disponibilidad&rdquo;. En la medida permitida por la ley, Kigyo no será
            responsable por daños indirectos, incidentales, especiales o
            consecuenciales, ni por lucro cesante o pérdida de datos derivada del
            uso o de la imposibilidad de uso de la plataforma.
          </p>
          <p>
            En todo caso, nuestra responsabilidad total acumulada no excederá el
            monto que hayas pagado por el Servicio durante los doce (12) meses
            anteriores al hecho que la origine. Nada de lo aquí dispuesto limita la
            responsabilidad que la ley no permita limitar, incluidos el dolo y la
            culpa grave.
          </p>

          <h2>14. Indemnidad</h2>
          <p>
            Te comprometes a mantener indemne a Kigyo frente a reclamaciones de
            terceros derivadas del contenido que cargas en la plataforma, del uso
            que le das al Servicio en contra de estos términos, o del
            incumplimiento de las obligaciones que te corresponden como responsable
            del tratamiento conforme a la sección 10.
          </p>

          <h2>15. Cambios a estos términos</h2>
          <p>
            Podemos actualizar estos Términos de servicio. Te notificaremos los
            cambios significativos por correo electrónico o mediante aviso dentro de
            la plataforma, con al menos treinta (30) días de anticipación cuando
            afecten de forma sustancial tus derechos. Continuar usando el Servicio
            después de la entrada en vigor implica su aceptación.
          </p>

          <h2>16. Ley aplicable y resolución de controversias</h2>
          <p>
            Estos Términos se rigen por las leyes de la República de Colombia.
            Cualquier controversia se someterá a los jueces competentes de
            Bogotá D.C. Antes de acudir a la vía judicial, las partes procurarán
            resolver la diferencia de forma directa dentro de los treinta (30) días
            siguientes a la notificación escrita del reclamo.
          </p>

          <h2>17. Contacto</h2>
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
