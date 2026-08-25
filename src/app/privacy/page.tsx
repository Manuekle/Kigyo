import type { Metadata } from 'next'
import Link from 'next/link'
import PublicPageShell from '@/components/marketing/PublicPageShell'
import PublicCta from '@/components/marketing/PublicCta'

export const metadata: Metadata = {
  title: 'Política de privacidad',
  description: 'Qué datos trata Kigyo, con quién, dónde se alojan y cómo ejercer tus derechos.',
}

/**
 * La política, reescrita contra lo que el sistema hace de verdad.
 *
 * Tres afirmaciones de la versión anterior no eran ciertas, y una ausencia
 * pesaba más que las tres juntas:
 *
 *   · «cookies analíticas para entender cómo se usa el Servicio» — no hay
 *     analítica de ningún tipo en el repositorio. Cero.
 *   · «respaldos automáticos y monitoreo continuo» — afirmado sin que nada en
 *     el producto lo sostenga. Ahora se describe lo que sí existe y se atribuye
 *     al proveedor lo que es del proveedor.
 *   · «puedes solicitar la eliminación en cualquier momento» — cierto como
 *     trámite, pero no existe un botón que lo haga, así que se dice cómo se
 *     pide y en qué plazo se atiende.
 *
 * Y lo que faltaba: los datos viven en Estados Unidos (Supabase sobre AWS
 * us-west-2), lo que es una transferencia internacional que la Ley 1581 obliga
 * a informar; y la tabla `patients` guarda tipo de sangre, alergias y
 * diagnósticos, más radiografías en almacenamiento — datos sensibles de salud,
 * la categoría con el régimen más estricto, sin una sola mención.
 */
export default function PrivacyPage() {
  return (
    <PublicPageShell>
      <div className="pub-page-head">
        <span className="pub-page-eyebrow">Legal</span>
        <h1 className="pub-page-title">Política de privacidad</h1>
        <p className="pub-page-sub">
          Qué datos tratamos, con quién, dónde se alojan y cómo ejercer tus derechos.
        </p>
      </div>

      <section className="l-section pub-section-tight">
        <div className="legal-body" data-reveal>
          <p className="legal-updated">Última actualización: 25 de agosto de 2026</p>

          <h2>1. Quién trata tus datos, y en qué calidad</h2>
          <p>
            Esta política distingue dos situaciones, porque las obligaciones son
            distintas en cada una:
          </p>
          <ul>
            <li>
              <strong>Datos de nuestros clientes.</strong> Cuando creas una cuenta,
              contratas un plan o nos escribes, Kigyo actúa como{' '}
              <strong>responsable del tratamiento</strong> de tus datos de contacto
              y facturación.
            </li>
            <li>
              <strong>Datos que tu organización carga en la plataforma.</strong>{' '}
              Los de empleados, clientes, proveedores y pacientes son de tu
              organización: ella es la <strong>responsable</strong> y Kigyo actúa
              como <strong>encargado</strong>, tratándolos según sus instrucciones y
              solo para prestar el Servicio. Si eres empleado o paciente de una
              empresa que usa Kigyo, dirige tus solicitudes a esa empresa; nosotros
              te ayudaremos a canalizarlas.
            </li>
          </ul>

          <h2>2. Qué datos tratamos</h2>
          <ul>
            <li>
              <strong>De cuenta y facturación:</strong> nombre, correo electrónico,
              nombre de la empresa, identificación fiscal, plan contratado y estado
              de la suscripción. <em>No almacenamos datos de tarjetas</em>: los
              gestiona nuestro procesador de pagos.
            </li>
            <li>
              <strong>De las personas de tu organización:</strong> nombre,
              documento, cargo, área, sede, contacto, fechas de vinculación,
              información de nómina y documentos laborales.
            </li>
            <li>
              <strong>De terceros con los que operas:</strong> clientes,
              proveedores, estudiantes, huéspedes, arrendatarios y demás, según los
              módulos que actives.
            </li>
            <li>
              <strong>Archivos:</strong> documentos, fotos de perfil, logotipos e
              imágenes clínicas que cargues en la plataforma.
            </li>
            <li>
              <strong>De uso y seguridad:</strong> registros de acceso, bitácora de
              auditoría de cambios, dirección IP e identificadores técnicos
              necesarios para operar la plataforma y prevenir abuso.
            </li>
            <li>
              <strong>De solicitudes de demostración:</strong> nombre, correo,
              empresa y mensaje, cuando llenas el formulario de contacto.
            </li>
          </ul>

          <h2>3. Datos sensibles</h2>
          <p>
            Los módulos clínicos y veterinarios permiten registrar{' '}
            <strong>datos sensibles de salud</strong> —tipo de sangre, alergias,
            diagnósticos, historia clínica e imágenes diagnósticas—. Conforme a la
            Ley 1581 de 2012, su tratamiento exige{' '}
            <strong>autorización explícita del titular</strong>, y ningún titular
            está obligado a autorizarlo.
          </p>
          <p>
            Esa autorización debe obtenerla la organización que los registra, que es
            su responsable. Kigyo los aloja cifrados, con acceso restringido por
            organización y por permiso, y las imágenes diagnósticas se sirven
            mediante enlaces temporales que caducan, nunca desde un repositorio
            público.
          </p>

          <h2>4. Para qué los usamos</h2>
          <ul>
            <li>Operar, mantener y asegurar la plataforma.</li>
            <li>Prestar las funciones que cada módulo ofrece.</li>
            <li>Gestionar la suscripción, el cobro y la facturación.</li>
            <li>Brindar soporte y comunicarnos contigo sobre el Servicio.</li>
            <li>Cumplir obligaciones legales y atender requerimientos de autoridad competente.</li>
            <li>Detectar y prevenir fraude, abuso e incidentes de seguridad.</li>
          </ul>
          <p>
            <strong>No vendemos datos personales</strong>, no los cedemos con fines
            publicitarios y no los usamos para entrenar modelos de inteligencia
            artificial.
          </p>

          <h2>5. Proveedores que nos ayudan a operar</h2>
          <p>
            Compartimos información con los proveedores estrictamente necesarios
            para prestar el Servicio, bajo obligaciones de confidencialidad y
            seguridad:
          </p>
          <ul>
            <li><strong>Supabase</strong> — base de datos, autenticación y almacenamiento de archivos.</li>
            <li><strong>Vercel</strong> — alojamiento y entrega de la aplicación.</li>
            <li><strong>Polar</strong> — procesamiento de pagos y facturación de la suscripción.</li>
            <li><strong>Microsoft Azure</strong> — servicios de inteligencia artificial del asistente.</li>
          </ul>
          <p>
            Si conectas integraciones opcionales —pasarela de pagos del mostrador,
            mensajería, facturación electrónica— los datos necesarios para esa
            función se comparten con el proveedor que tú elijas y contrates.
          </p>

          <h2>6. Dónde se alojan y transferencia internacional</h2>
          <p>
            La infraestructura de Kigyo opera en centros de datos ubicados en{' '}
            <strong>los Estados Unidos de América</strong>. Si tu organización está
            en Colombia, esto constituye una{' '}
            <strong>transferencia internacional de datos</strong> en los términos de
            la Ley 1581 de 2012, y al usar el Servicio la autorizas.
          </p>
          <p>
            Nuestros proveedores mantienen certificaciones y compromisos
            contractuales de seguridad y confidencialidad equiparables a los
            estándares exigidos por la normativa colombiana.
          </p>

          <h2>7. Asistente de inteligencia artificial</h2>
          <p>
            Cuando usas el asistente, el texto de tu consulta y los fragmentos de
            tus documentos que resulten relevantes se envían al servicio de
            inteligencia artificial de Microsoft Azure para generar la respuesta.
          </p>
          <p>
            Conforme a los términos de ese servicio, <strong>tus datos no se usan
            para entrenar modelos</strong> ni se comparten con otros clientes. El
            asistente solo accede a los datos de la empresa activa y solo a los
            módulos que esa empresa tiene encendidos. Puedes desactivarlo apagando
            el módulo correspondiente.
          </p>

          <h2>8. Cómo protegemos la información</h2>
          <ul>
            <li>Cifrado en tránsito (TLS) y en reposo, provisto por nuestra infraestructura.</li>
            <li>
              <strong>Aislamiento por organización a nivel de base de datos.</strong>{' '}
              Cada fila pertenece a una empresa y las políticas de seguridad impiden
              que una consulta devuelva filas de otra, incluso si la aplicación
              fallara.
            </li>
            <li>Control de acceso por rol y permiso, configurable por cada organización.</li>
            <li>Verificación en dos pasos (TOTP) disponible para todas las cuentas.</li>
            <li>Límites de intentos en el inicio de sesión y en operaciones sensibles.</li>
            <li>Bitácora de auditoría de los cambios realizados en cada empresa.</li>
            <li>Archivos en repositorios privados, accesibles solo mediante enlaces temporales que caducan.</li>
          </ul>
          <p>
            Ningún sistema es infalible. Si ocurriera un incidente que afecte tus
            datos personales, te lo notificaremos y reportaremos a la autoridad
            competente conforme a la normativa aplicable.
          </p>

          <h2>9. Cuánto tiempo los conservamos</h2>
          <p>
            Conservamos los datos mientras tu cuenta esté vigente y durante el
            tiempo que exija la legislación aplicable —en particular la laboral,
            contable y tributaria, que impone plazos mínimos de conservación—.
          </p>
          <p>
            La suspensión por falta de pago <strong>no elimina información</strong>:
            la cuenta pasa a modo de solo lectura y los datos siguen disponibles y
            exportables.
          </p>
          <p>
            Puedes solicitar la eliminación de tu cuenta y de los datos asociados
            escribiéndonos desde la{' '}
            <Link href="/contact">página de contacto</Link>. Atenderemos la
            solicitud dentro de los quince (15) días hábiles siguientes, salvo que
            debamos conservar información por mandato legal, en cuyo caso te
            indicaremos qué y por cuánto tiempo. Hoy la eliminación se tramita de
            forma asistida; no existe todavía una opción de autoservicio dentro de
            la plataforma.
          </p>

          <h2>10. Tus derechos</h2>
          <p>
            Conforme a la Ley 1581 de 2012 y sus decretos reglamentarios, como
            titular puedes conocer, actualizar y rectificar tus datos personales;
            solicitar prueba de la autorización otorgada; ser informado sobre el uso
            que se les ha dado; presentar quejas ante la Superintendencia de
            Industria y Comercio; revocar la autorización; y solicitar la supresión
            de tus datos cuando no exista un deber legal o contractual de
            conservarlos.
          </p>
          <p>
            Puedes ejercerlos escribiéndonos desde la{' '}
            <Link href="/contact">página de contacto</Link>. Responderemos las
            consultas dentro de los diez (10) días hábiles y los reclamos dentro de
            los quince (15) días hábiles siguientes a su recepción, conforme a los
            plazos legales.
          </p>
          <p>
            Si tus datos fueron cargados por una empresa que usa Kigyo —tu empleador
            o tu prestador de servicios de salud, por ejemplo— esa empresa es la
            responsable del tratamiento y es a quien debes dirigir la solicitud.
            Escríbenos igualmente si necesitas ayuda para identificarla o
            contactarla.
          </p>

          <h2>11. Cookies y almacenamiento local</h2>
          <p>
            Kigyo usa <strong>únicamente cookies necesarias</strong> para
            funcionar. No usamos cookies de analítica, de publicidad ni de
            seguimiento, ni compartimos datos con redes publicitarias.
          </p>
          <ul>
            <li><strong>Sesión</strong> — mantiene tu sesión iniciada de forma segura entre visitas.</li>
            <li><strong>Empresa activa</strong> — recuerda con cuál de tus empresas estás trabajando.</li>
          </ul>
          <p>
            Son dos, y las dos son necesarias: sin la primera habría que iniciar
            sesión en cada página, y sin la segunda el sistema no sabría de cuál de
            tus empresas mostrarte los datos.
          </p>
          <p>
            Además guardamos tu preferencia de tema (claro u oscuro) en el
            almacenamiento local de tu navegador. Ese valor no viaja a nuestros
            servidores y puedes borrarlo desde tu navegador.
          </p>

          <h2>12. Menores de edad</h2>
          <p>
            El Servicio está dirigido a empresas y no a menores de edad. Si tu
            organización registra datos de menores —por ejemplo, en el módulo de
            estudiantes— corresponde a tu organización obtener la autorización de
            sus representantes legales y velar por el interés superior del menor,
            conforme a la normativa aplicable.
          </p>

          <h2>13. Cambios a esta política</h2>
          <p>
            Podemos actualizar esta Política de privacidad. Notificaremos los
            cambios importantes por correo electrónico o dentro de la plataforma. La
            fecha de la última actualización aparece al inicio de esta página.
          </p>

          <h2>14. Contacto</h2>
          <p>
            Para dudas sobre esta política o para ejercer tus derechos, escríbenos
            desde la <Link href="/contact">página de contacto</Link>. Consulta
            también nuestros{' '}
            <Link href="/terms">Términos de servicio</Link>.
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
