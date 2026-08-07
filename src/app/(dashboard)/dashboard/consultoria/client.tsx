'use client'

import { useState } from 'react'
import {
  MessageSquare, Clock, Check, Calendar, Plus, CalendarClock, X,
} from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Stat from '@/components/ui/Stat'
import Select from '@/components/ui/Select'
import { useApp } from '@/lib/context/AppContext'
import { EMPLEADOS } from '@/lib/data/empleados'

// ── Page-local data (faithful to original nucleo-rh.jsx — shared CONSULTAS is
//    FAQ-shaped, so the consultoría list is seeded inline to render IDENTICAL).
interface ConsultaItem { id: string; tema: string; quien: string; consultor: string; date: string; st: string }
interface ConsultaMeeting { id: number; title: string; day: string; time: string; dur: string }
interface SchedForm { titulo: string; fecha: string; hora: string; dur: string; asesor: string }

const CONSULTAS: ConsultaItem[] = [
  { id: 'CN-218', tema: 'Licencia ambiental para granja solar', quien: 'Andrés Mora', consultor: 'Regulatorio', st: 'En curso', date: 'Hoy' },
  { id: 'CN-215', tema: 'Cumplimiento RETIE en instalaciones', quien: 'Camila Restrepo', consultor: 'Normativo', st: 'Agendada', date: '22 jun' },
  { id: 'CN-210', tema: 'Revisión de contrato EPC', quien: 'Legal', consultor: 'Contractual', st: 'Resuelta', date: '14 jun' },
  { id: 'CN-204', tema: 'Cambio normativo UPME — medición neta', quien: 'Diego Vargas', consultor: 'Regulatorio', st: 'Resuelta', date: '08 jun' },
]

export default function ConsultoriaPage() {
  const { addToast } = useApp()
  const [consultas, setConsultas] = useState<ConsultaItem[]>(CONSULTAS)
  const [consultaMeetings, setConsultaMeetings] = useState<ConsultaMeeting[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [tema, setTema] = useState('')
  const [quien, setQuien] = useState(EMPLEADOS[0].name)
  const [schedOpen, setSchedOpen] = useState(false)
  const [schedForm, setSchedForm] = useState<SchedForm>({ titulo: 'Sesión de consultoría laboral', fecha: '25', hora: '10:00', dur: '1 h', asesor: 'Asesor laboral externo' })

  const pendientes = consultas.filter(c => c.st === 'Agendada' || c.st === 'En curso').length
  const resueltas = consultas.filter(c => c.st === 'Resuelta').length

  const addConsulta = () => {
    if (!tema.trim()) return
    const id = `CON-0${consultas.length + 1}`
    setConsultas(cs => [{ id, tema, quien, consultor: 'Asesor laboral', date: '21 jun 2026', st: 'Agendada' }, ...cs])
    addToast('Consulta registrada', 'ok')
    setAddOpen(false); setTema('')
  }
  const advanceSt = (id: string) => {
    setConsultas(cs => cs.map(c => {
      if (c.id !== id) return c
      const next: Record<string, string> = { 'Agendada': 'En curso', 'En curso': 'Resuelta' }
      return { ...c, st: next[c.st] || c.st }
    }))
  }
  const agendar = () => {
    if (!schedForm.titulo.trim()) return
    // emulate original onSchedule(schedForm): record a local meeting
    setConsultaMeetings(ms => [...ms, { id: Date.now(), title: schedForm.titulo, day: schedForm.fecha, time: schedForm.hora, dur: schedForm.dur }])
    addToast('Sesión agendada — revisa el Calendario', 'ok')
    setSchedOpen(false)
    setSchedForm({ titulo: 'Sesión de consultoría laboral', fecha: '25', hora: '10:00', dur: '1 h', asesor: 'Asesor laboral externo' })
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat icon={<MessageSquare size={16} />} tone="blu" label="Consultas totales" value={consultas.length} /></div>
        <div className="rise d2"><Stat icon={<Clock size={16} />} tone="amb" label="Pendientes / En curso" value={pendientes} /></div>
        <div className="rise d3"><Stat icon={<Check size={16} />} tone="grn" label="Resueltas" value={resueltas} /></div>
        <div className="rise d4"><Stat icon={<Calendar size={16} />} tone="vio" label="Sesiones en calendario" value={consultaMeetings.length} /></div>
      </div>
      <div className="g2">
        <div className="card rise d1">
          <div className="chead">
            <div className="ctitle">Solicitudes de consultoría</div>
            <button className="btn pri" onClick={() => setAddOpen(true)}><Plus size={15} />Nueva consulta</button>
          </div>
          <div className="tblwrap">
            <table className="tbl">
              <thead><tr><th scope="col">Tema</th><th scope="col">Solicitante</th><th scope="col">Estado</th><th scope="col"></th></tr></thead>
              <tbody>
                {consultas.map(c => (
                  <tr className="trow" key={c.id}>
                    <td><div className="cename">{c.tema}</div><div className="ceid mono">{c.id} · {c.date}</div></td>
                    <td className="muted">{c.quien}</td>
                    <td><Badge st={c.st} /></td>
                    <td style={{ textAlign: 'right' }}>
                      {c.st !== 'Resuelta' && (
                        <button className="btn" onClick={() => advanceSt(c.id)}>
                          {c.st === 'Agendada' ? 'Iniciar' : 'Resolver'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card cpad rise d2" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="ctitle">Cumplimiento normativo</div>
            <Badge st="Activo" />
          </div>
          <p style={{ color: 'var(--ink2)', fontSize: 13.5, margin: 0, lineHeight: 1.55 }}>
            Acompañamiento en licencias ambientales, regulación CREG/UPME, RETIE y normativa del sector energético colombiano.
          </p>
          <div className="fg2" style={{ gap: 14, borderTop: '1px solid var(--line2)', paddingTop: 14 }}>
            <div><div className="kvs">Tiempo de respuesta</div><div style={{ fontWeight: 800, fontSize: 16, marginTop: 3, letterSpacing: '-.04em' }}>24 h hábiles</div></div>
            <div><div className="kvs">Consultas este mes</div><div style={{ fontWeight: 800, fontSize: 16, marginTop: 3, letterSpacing: '-.04em' }}>{consultas.length}</div></div>
          </div>
          {consultaMeetings.length > 0 && (
            <>
              <div className="dsect" style={{ margin: '0' }}>Sesiones agendadas</div>
              {consultaMeetings.slice(0, 3).map(m => (
                <div className="elrow" key={m.id}>
                  <div><div className="eltxt">{m.title}</div><div className="elsub">{m.day} jun · {m.time} · {m.dur}</div></div>
                  <Badge st="Agendada" />
                </div>
              ))}
            </>
          )}
          <button className="btn pri" style={{ justifyContent: 'center', marginTop: 'auto' }} onClick={() => setSchedOpen(true)}><CalendarClock size={15} />Agendar sesión</button>
        </div>
      </div>
      {addOpen && (
        <div className="mwrap" onClick={() => setAddOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Nueva consulta</div><button className="ibtn" onClick={() => setAddOpen(false)}><X size={18} /></button></div>
            <div className="mbody">
              <div className="flabel" style={{ marginTop: 0 }}>Tema</div>
              <input className="field" value={tema} onChange={e => setTema(e.target.value)} placeholder="Ej. Revisión de contrato laboral" />
              <div className="flabel">Solicitante</div>
              <Select value={quien} onChange={setQuien} options={EMPLEADOS.map(e => e.name)} />
            </div>
            <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
              <button className="btn" onClick={() => setAddOpen(false)}>Cancelar</button>
              <button className="btn dark" onClick={addConsulta}>Registrar</button>
            </div></div>
          </div>
        </div>
      )}
      {schedOpen && (
        <div className="mwrap" onClick={() => setSchedOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Agendar sesión</div><button className="ibtn" onClick={() => setSchedOpen(false)}><X size={18} /></button></div>
            <div className="mbody">
              <div className="flabel" style={{ marginTop: 0 }}>Título de la sesión</div>
              <input className="field" value={schedForm.titulo} onChange={e => setSchedForm(f => ({ ...f, titulo: e.target.value }))} />
              <div className="flabel">Día (junio 2026)</div>
              <input className="field" type="number" min="22" max="30" value={schedForm.fecha} onChange={e => setSchedForm(f => ({ ...f, fecha: e.target.value }))} />
              <div className="flabel">Hora</div>
              <input className="field" value={schedForm.hora} onChange={e => setSchedForm(f => ({ ...f, hora: e.target.value }))} placeholder="10:00" />
              <div className="flabel">Duración</div>
              <Select value={schedForm.dur} onChange={(v) => setSchedForm(f => ({ ...f, dur: v }))} options={['30 min', '1 h', '1 h 30 min', '2 h']} />
              <div className="flabel">Asesor</div>
              <input className="field" value={schedForm.asesor} onChange={e => setSchedForm(f => ({ ...f, asesor: e.target.value }))} />
            </div>
            <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
              <button className="btn" onClick={() => setSchedOpen(false)}>Cancelar</button>
              <button className="btn dark" onClick={agendar}><CalendarClock size={14} />Agendar</button>
            </div></div>
          </div>
        </div>
      )}
    </>
  )
}
