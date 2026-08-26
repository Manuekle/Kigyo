import type { ReactNode } from 'react'
import {
  CheckCircle,
  Send,
  AlertTriangle,
  Clock,
  FileText,
  Zap,
} from '@/lib/icons'

/**
 * The one section that shows what Kigyo actually holds.
 *
 * Every other block on the landing page describes the product; this one is
 * made of it — the same record ids, states and ageing counters the dashboard
 * renders, in the same monospace the app uses for identifiers. A store owner
 * should recognise their own Monday in it before reading a word of copy.
 *
 * Sample records, matching the app's demo data. Presented as an interface
 * preview, which is what it is — no claim is made about real customers.
 *
 * `tone` names a `.tag` variant rather than a colour, so a status can never
 * end up with an icon in one hue and a tint in another.
 *
 * No tone in this table is in the blue family. Blue is the one hue a reader
 * will take for brand colour rather than for a state, and a status palette
 * whose loudest member also means "us" stops being a status palette. "Abierto"
 * is deliberately the neutral variant: a lead that is merely open has not had
 * anything happen to it yet, and giving that a colour is how a badge system
 * ends up with six equally loud pills and no hierarchy.
 */

const RECORDS = [
  {
    id: 'VT-0042',
    what: 'Venta de mostrador',
    who: 'Café El Bosque',
    age: '2',
    unit: 'ventas esta mañana',
    state: 'Pagada',
    tone: 'is-green',
    icon: <CheckCircle size={13} />,
  },
  {
    id: 'COT-0142',
    what: 'Cotización — catering evento',
    who: 'María González',
    age: '3',
    unit: 'días sin respuesta',
    state: 'Enviada',
    tone: 'is-pink',
    icon: <Send size={13} />,
  },
  {
    id: 'STK-031',
    what: 'Stock bajo — grano 1kg',
    who: 'Inventario',
    age: '6',
    unit: 'unidades restantes',
    state: 'Alerta',
    tone: 'is-red',
    icon: <AlertTriangle size={13} />,
  },
  {
    id: 'R-01',
    what: 'Contrato por vencer',
    who: 'Andrés Mora',
    age: '8',
    unit: 'días restantes',
    state: 'Riesgo alto',
    tone: 'is-orange',
    icon: <Zap size={13} />,
  },
  {
    id: 'DOC-3201',
    what: 'Contrato laboral',
    who: 'Sebastián Cano',
    age: '2',
    unit: 'días para firmar',
    state: 'Pendiente',
    tone: 'is-yellow',
    icon: <Clock size={13} />,
  },
  {
    id: 'LEAD-1287',
    what: 'Lead calificado — flota',
    who: 'Juan Pérez',
    age: '4',
    unit: 'días en embudo',
    state: 'Abierto',
    tone: 'is-muted',
    icon: <FileText size={13} />,
  },
] as const satisfies readonly {
  id: string
  what: string
  who: string
  age: string
  unit: string
  state: string
  tone: string
  icon: ReactNode
}[]

export default function Ledger() {
  return (
    <section className="l-section l-ledger-section">
      <div className="l-section-head" data-reveal>
        <span className="l-eyebrow">Operación</span>
        <h2 className="l-section-title">Tu lunes, ya ordenado</h2>
        <p className="l-section-sub">
          Kigyo vigila ventas, cotizaciones, inventario, contratos y firmas sin
          que nadie tenga que acordarse. Esto es lo que encuentra antes de que
          preguntes.
        </p>
      </div>

      <div className="l-ledger" data-reveal>
        <div className="l-ledger-bar">
          <span className="l-ledger-when mono">lun · 08:40</span>
          <span className="l-ledger-tally">
            <b>4</b> requieren acción hoy
          </span>
        </div>

        <ul className="l-ledger-rows">
          {RECORDS.map((record, i) => (
            <li className="l-row" key={record.id} data-reveal data-reveal-delay={i + 1}>
              <span className="l-row-id mono">{record.id}</span>

              <span className="l-row-what">
                <span className="l-row-title">{record.what}</span>
                <span className="l-row-who">{record.who}</span>
              </span>

              <span className="l-row-age">
                <b className="mono">{record.age}</b>
                <span>{record.unit}</span>
              </span>

              <span className={`tag ${record.tone} l-row-state`}>
                {record.icon}
                {record.state}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
