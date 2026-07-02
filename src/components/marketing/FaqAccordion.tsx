'use client'

import { useState } from 'react'

const FAQS = [
  {
    q: '¿Necesito tarjeta de crédito para probar Kigyo?',
    a: 'No. El plan Starter es gratuito y no requiere método de pago. Puedes usarlo el tiempo que necesites con hasta 10 colaboradores.',
  },
  {
    q: '¿Kigyo cumple con la legislación laboral mexicana?',
    a: 'Sí. Nuestros módulos de nómina, documentos y vacaciones están diseñados conforme a la normativa laboral vigente en México, y se actualizan cuando la legislación cambia.',
  },
  {
    q: '¿Puedo migrar la información de mi equipo desde otra herramienta?',
    a: 'Sí. Puedes importar tu plantilla actual mediante una plantilla de datos, o nuestro equipo puede ayudarte con la migración en planes Growth y Enterprise.',
  },
  {
    q: '¿Qué pasa si supero el número de colaboradores de mi plan?',
    a: 'Te avisaremos antes de que esto ocurra. Puedes actualizar tu plan en cualquier momento desde la configuración de tu cuenta, sin perder información.',
  },
  {
    q: '¿Cómo protege Kigyo los datos de mis empleados?',
    a: 'Todos los datos se almacenan encriptados, con respaldos automáticos y control de acceso por rol. Consulta nuestra Política de privacidad para más detalle.',
  },
  {
    q: '¿Puedo cancelar mi suscripción en cualquier momento?',
    a: 'Sí, no hay contratos forzosos. Puedes cancelar cuando quieras desde la configuración de tu cuenta y mantendrás acceso hasta el fin de tu ciclo de facturación.',
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
