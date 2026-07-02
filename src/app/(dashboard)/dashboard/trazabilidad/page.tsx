'use client'

import { useState } from 'react'
import { FileSpreadsheet } from '@/lib/icons'
import { exportExcel } from '@/lib/utils'
import TabBar from '@/components/ui/TabBar'
import { useApp } from '@/lib/context/AppContext'

/* ------------------------------------------------------------------ */
/*  Page-local data (matches original nucleo-rh.jsx EVENTOS verbatim)  */
/* ------------------------------------------------------------------ */
interface Evento {
  who: string
  act: string
  obj: string
  t: string
  type: string
  red?: boolean
}
interface EventoGrupo {
  g: string
  items: Evento[]
}

const EVENTOS: EventoGrupo[] = [
  { g: 'Hoy', items: [
    { who: 'María González', act: 'firmó', obj: 'Acuerdo de confidencialidad', t: '09:42', type: 'Firma', red: true },
    { who: 'Juan Pérez', act: 'abrió un ticket:', obj: 'Certificado laboral (TK-1287) · área Personas', t: '08:50', type: 'Ticket' },
    { who: 'Asistente IA', act: 'detectó', obj: '3 contratos por vencer este mes', t: '08:15', type: 'IA' },
    { who: 'Daniel Ospina', act: 'registró entrada de', obj: 'Teclado mecánico (INV-0601)', t: '07:50', type: 'Inventario' },
  ] },
  { g: 'Ayer', items: [
    { who: 'Camila Restrepo', act: 'subió', obj: 'Plan de capacitación 2026', t: '17:20', type: 'Documento' },
    { who: 'Sistema', act: 'asignó', obj: 'MacBook Pro 14" a María González', t: '11:05', type: 'Inventario' },
    { who: 'Valentina Ruiz', act: 'completó', obj: 'Onboarding documental', t: '09:30', type: 'Empleado' },
  ] },
  { g: '18 jun 2026', items: [
    { who: 'Camila Restrepo', act: 'solicitó firma de', obj: 'Contrato laboral a Sebastián Cano', t: '16:12', type: 'Firma' },
    { who: 'Asistente IA', act: 'resumió', obj: 'estado de cumplimiento documental (94%)', t: '10:00', type: 'IA' },
  ] },
]

export default function TrazabilidadPage() {
  const { addToast } = useApp()
  const [f, setF] = useState('Todos')
  const chips = ['Todos', 'Firma', 'Ticket', 'Inventario', 'Documento', 'Empleado', 'IA']
  const exportLog = () => {
    const rows = EVENTOS.flatMap((grp) => grp.items.filter((e) => f === 'Todos' || e.type === f)
      .map((e) => ({ Fecha: grp.g, Hora: e.t, 'Quién': e.who, 'Acción': `${e.act} ${e.obj}`, Tipo: e.type })))
    exportExcel(rows, 'trazabilidad-whitebox')
    addToast('Excel exportado', 'ok')
  }
  return (
    <div className="card rise d1">
      <div className="chead">
        <TabBar value={f} onChange={setF} items={chips.map((c) => ({ key: c, label: c }))} />
        <button className="btn" data-tip="Exportar a Excel" onClick={exportLog}><FileSpreadsheet size={14} />Exportar</button>
      </div>
      <div className="tl">
        {EVENTOS.map((grp) => {
          const items = grp.items.filter((e) => f === 'Todos' || e.type === f)
          if (!items.length) return null
          return (
            <div key={grp.g}>
              <div className="tlg">{grp.g}</div>
              {items.map((e, i) => (
                <div className={`tli ${i === items.length - 1 ? 'last' : ''}`} key={i}>
                  <div className="tlrail"><div className={`tlnode ${e.red ? 'red' : ''}`} /></div>
                  <div className="tlbody">
                    <div className="tltop">
                      <div className="tltxt"><b>{e.who}</b> {e.act} {e.obj}</div>
                      <div className="tltime mono">{e.t}</div>
                    </div>
                    <span className="tltag">{e.type}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
