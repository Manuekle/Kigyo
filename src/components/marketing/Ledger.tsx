/**
 * The one section that shows what Kigyo actually holds.
 *
 * Every other block on the landing page describes the product; this one is
 * made of it — the same record ids, states and ageing counters the dashboard
 * renders, in the same monospace the app uses for identifiers. An HR lead
 * should recognise their own Monday in it before reading a word of copy.
 *
 * Sample records, matching the app's demo data. Presented as an interface
 * preview, which is what it is — no claim is made about real customers.
 */

const RECORDS = [
  {
    id: 'DOC-3190',
    what: 'Anexo de teletrabajo',
    who: 'María González',
    age: '18',
    unit: 'días sin firmar',
    state: 'Vencido',
    tone: 'red',
  },
  {
    id: 'R-01',
    what: 'Contrato por vencer',
    who: 'Andrés Mora',
    age: '8',
    unit: 'días restantes',
    state: 'Riesgo alto',
    tone: 'amb',
  },
  {
    id: 'DOC-3201',
    what: 'Contrato laboral',
    who: 'Sebastián Cano',
    age: '2',
    unit: 'días para firmar',
    state: 'Pendiente',
    tone: 'amb',
  },
  {
    id: 'TK-1287',
    what: 'Certificado laboral',
    who: 'Juan Pérez',
    age: '4',
    unit: 'días sin respuesta',
    state: 'Abierto',
    tone: 'neu',
  },
  {
    id: 'INV-0601',
    what: 'Teclado mecánico',
    who: 'Daniel Ospina',
    age: '—',
    unit: 'asignado hoy',
    state: 'Al día',
    tone: 'grn',
  },
] as const

export default function Ledger() {
  return (
    <section className="l-section l-ledger-section">
      <div className="l-section-head" data-reveal>
        <span className="l-eyebrow">Operación</span>
        <h2 className="l-section-title">Tu lunes, ya ordenado</h2>
        <p className="l-section-sub">
          Kigyo vigila contratos, firmas, riesgos y tickets sin que nadie tenga que
          acordarse. Esto es lo que encuentra antes de que preguntes.
        </p>
      </div>

      <div className="l-ledger" data-reveal>
        <div className="l-ledger-bar">
          <span className="l-ledger-when mono">lun · 08:40</span>
          <span className="l-ledger-tally">
            <b>3</b> requieren acción hoy
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

              <span className={`badge b-${record.tone} l-row-state`}>
                <span className="bd" aria-hidden="true" />
                {record.state}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
