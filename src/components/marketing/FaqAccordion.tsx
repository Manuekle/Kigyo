'use client'

import { useState } from 'react'

const FAQS = [
  {
    q: '¿Qué es Kigyo?',
    a: 'Una plataforma de operación para tu negocio: CRM para clientes y ventas, ERP para inventario y compras, punto de venta con pagos, documentos con firma electrónica y gestión de personas con nómina. Se adapta al sector de tu empresa.',
  },
  {
    q: '¿Necesito tarjeta de crédito para usar Kigyo?',
    a: 'No. Los tres planes cuestan $0 y no pedimos método de pago en ningún momento.',
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
    a: 'Te avisaremos antes de que esto ocurra. Puedes cambiar de plan en cualquier momento desde la configuración de tu cuenta, sin perder información y sin costo.',
  },
  {
    q: '¿Kigyo cumple con la legislación laboral colombiana?',
    a: 'Sí. Nómina, prestaciones sociales, vacaciones y documentos siguen lo que exige el Código Sustantivo del Trabajo, incluidas cesantías, prima de servicios y los aportes a seguridad social. Se actualizan cuando la normativa cambia.',
  },
  {
    q: '¿Puedo migrar la información de mi negocio desde otra herramienta?',
    a: 'Sí. Puedes importar tu nómina actual desde un archivo de Excel, o nuestro equipo puede acompañarte en la migración de clientes, inventario o documentos si nos escribes.',
  },
  {
    q: '¿Cómo protege Kigyo los datos de mi empresa?',
    a: 'Cada empresa mantiene sus datos aislados con control de acceso por rol, respaldos automáticos y almacenamiento encriptado. Consulta nuestra Política de privacidad para más detalle.',
  },
  {
    q: '¿Puedo dejar de usar Kigyo cuando quiera?',
    a: 'Sí, no hay contratos ni permanencia. Puedes exportar la información de tu empresa y eliminar tu cuenta desde la configuración en cualquier momento.',
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
