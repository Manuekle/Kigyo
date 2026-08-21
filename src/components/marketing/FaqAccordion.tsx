'use client'

import { useState } from 'react'

const FAQS = [
  {
    q: '¿Qué es Kigyo?',
    a: 'Una plataforma de operación para tu negocio: CRM para clientes y ventas, ERP para inventario y compras, punto de venta con pagos, documentos con firma electrónica y gestión de personas con nómina. Se adapta al sector de tu empresa.',
  },
  {
    q: '¿Necesito tarjeta de crédito para registrarme?',
    a: 'No para registrarte: creas la cuenta y configuras tu empresa sin método de pago. Los planes Starter y Growth se pagan cuando decides continuar, con los precios que ves en la página de Planes; Enterprise se cotiza en una llamada.',
  },
  {
    q: '¿Cómo elige Kigyo qué módulos uso?',
    a: 'Al crear tu empresa eliges tu sector y Kigyo propone los módulos de tu industria: una panadería y un consultorio no usan lo mismo. Los activas o apagas uno a uno cuando quieras, o configuras todo manualmente.',
  },
  {
    q: '¿Cómo funcionan los pagos en el punto de venta?',
    a: 'El POS cobra en línea o en mostrador con Wompi: tarjetas, QR y otros métodos. Puedes probar el flujo completo con pagos simulados antes de activar cobros reales.',
  },
  {
    q: '¿Puedo agendar una demo con mi equipo?',
    a: 'Sí. Escríbenos desde la página de contacto y coordinamos una sesión para recorrer la plataforma con los datos y procesos de tu operación.',
  },
  {
    q: '¿Qué pasa si supero el número de colaboradores de mi plan?',
    a: 'Kigyo no te deja pasarte del límite sin avisar: al invitar a alguien más te dice que el plan está lleno. Puedes cambiar de plan en cualquier momento desde Empresas, sin perder información — pagas la diferencia del plan nuevo, no un cargo aparte.',
  },
  {
    q: '¿Cómo maneja Kigyo la nómina colombiana?',
    a: 'Nómina trabaja con reglas versionadas —salario mínimo, auxilio de transporte, porcentajes de seguridad social y parafiscales— que tu empresa carga y tu contador valida, y genera el archivo PILA. Los periodos cerrados quedan inmutables y con trazabilidad. Kigyo no fija por su cuenta las cifras de cada año: quien las aprueba es tu contador, y la plataforma te avisa mientras estén sin definir.',
  },
  {
    q: '¿Puedo migrar la información de mi negocio desde otra herramienta?',
    a: 'Escríbenos y nuestro equipo te acompaña en la carga inicial de clientes, empleados, inventario o documentos. La importación por autoservicio desde Excel todavía no está disponible; la exportación sí, en todos los módulos.',
  },
  {
    q: '¿Cómo protege Kigyo los datos de mi empresa?',
    a: 'Cada empresa mantiene sus datos aislados con control de acceso por rol, respaldos automáticos y almacenamiento encriptado. Consulta nuestra Política de privacidad para más detalle.',
  },
  {
    q: '¿Puedo dejar de usar Kigyo cuando quiera?',
    a: 'Sí, no hay contratos ni permanencia. Puedes exportar la información de cada módulo a Excel cuando quieras, y cancelar tu suscripción desde la configuración de la cuenta. Para borrar definitivamente los datos de tu empresa, escríbenos y lo hacemos según nuestra Política de privacidad.',
  },
]

export default function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="faq-list">
      {FAQS.map((item, i) => {
        const isOpen = open === i
        return (
          <div key={item.q} className={`faq-item t-acc${isOpen ? ' open' : ''}`} data-open={isOpen}>
            <button
              type="button"
              className="faq-q t-acc-head"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
            >
              {item.q}
              <span className="t-acc-chevron" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 6.5L8 10.5L12 6.5" />
                </svg>
              </span>
            </button>
            <div className="t-acc-panel">
              <div className="t-acc-panel-inner">
                <p className="faq-a">{item.a}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
