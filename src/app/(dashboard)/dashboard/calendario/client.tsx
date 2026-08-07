'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, PenLine, Trash2, X } from '@/lib/icons'
import { useApp } from '@/lib/context/AppContext'

interface Meeting {
  id: string
  title: string
  type: string
  day: number
  time: string
  dur: string
  with: string
  loc: string
}

const MEETINGS: Meeting[] = [
  { id: 'M-01', title: 'Entrevista — Backend Senior', type: 'Entrevista', day: 9, time: '10:00', dur: '45 min', with: 'Juan Pérez', loc: 'Sala 2 · Bogotá' },
  { id: 'M-02', title: 'Onboarding — Sebastián Cano', type: 'Onboarding', day: 12, time: '09:00', dur: '1 h', with: 'Camila Restrepo', loc: 'Virtual · Meet' },
  { id: 'M-03', title: '1:1 — Valentina Ruiz', type: '1:1', day: 15, time: '15:30', dur: '30 min', with: 'Camila Restrepo', loc: 'Virtual · Meet' },
  { id: 'M-04', title: 'Sesión de consultoría laboral', type: 'Consultoría', day: 18, time: '11:00', dur: '1 h', with: 'Asesor externo', loc: 'Virtual · Meet' },
  { id: 'M-05', title: '1:1 — Daniel Ospina', type: '1:1', day: 22, time: '14:00', dur: '30 min', with: 'Camila Restrepo', loc: 'Sala 1 · Bogotá' },
  { id: 'M-06', title: 'Entrevista — Diseñador UX', type: 'Entrevista', day: 23, time: '16:00', dur: '45 min', with: 'Sebastián Cano', loc: 'Virtual · Meet' },
  { id: 'M-07', title: 'Revisión de cumplimiento laboral', type: 'Consultoría', day: 25, time: '10:30', dur: '1 h', with: 'Asesor externo', loc: 'Virtual · Meet' },
  { id: 'M-08', title: 'Onboarding — Nuevo ingreso Finanzas', type: 'Onboarding', day: 29, time: '09:30', dur: '1 h', with: 'Andrés Mora', loc: 'Sala 2 · Bogotá' },
]

const MEET_TONE: Record<string, string> = { 'Entrevista': 'blu', 'Onboarding': 'grn', '1:1': 'vio', 'Consultoría': 'red' }

type NewMeetingData = Omit<Meeting, 'id'>

type NewMeetingModalProps = { open: boolean; onClose: () => void; onCreate: (d: NewMeetingData) => void }

function NewMeetingModal(props: NewMeetingModalProps) {
  // Mounting only while open is what resets the form; the body below holds no
  // reset effect, which used to cost an extra render on every open.
  if (!props.open) return null
  return <NewMeetingModalBody {...props} />
}

function NewMeetingModalBody({ onClose, onCreate }: NewMeetingModalProps) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState('Entrevista')
  const [day, setDay] = useState<number | string>(22)
  const [time, setTime] = useState('10:00')
  const [withWhom, setWithWhom] = useState('')
  const types = ['Entrevista', 'Onboarding', '1:1', 'Consultoría']
  const create = () => {
    if (!title.trim()) return
    onCreate({ title, type, day: Math.min(30, Math.max(1, Number(day) || 1)), time, dur: '30 min', with: withWhom.trim() || 'Por confirmar', loc: 'Virtual · Meet' })
  }
  return (
    <div className="mwrap" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead"><div className="mtitle">Agendar reunión</div><button className="ibtn" onClick={onClose}><X size={18} /></button></div>
        <div className="mbody">
          <div className="flabel" style={{ marginTop: 0 }}>Título</div>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Entrevista — Backend Senior" />
          <div className="flabel">Tipo</div>
          <div className="chips">{types.map((t) => <button key={t} className={`chip ${type === t ? 'on' : ''}`} onClick={() => setType(t)}>{t}</button>)}</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <div style={{ flex: 1 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Día (junio)</div>
              <input className="field" type="number" min="1" max="30" value={day} onChange={(e) => setDay(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Hora</div>
              <input className="field" value={time} onChange={(e) => setTime(e.target.value)} placeholder="10:00" />
            </div>
          </div>
          <div className="flabel">Con quién</div>
          <input className="field" value={withWhom} onChange={(e) => setWithWhom(e.target.value)} placeholder="Nombre" />
        </div>
        <div className="mfoot">
          <span />
          <div style={{ display: 'flex', gap: 9 }}>
            <button className="btn" onClick={onClose}>Cancelar</button>
            <button className="btn dark" onClick={create}>Agendar</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CalendarioPage() {
  const { addToast } = useApp()
  const [meetings, setMeetings] = useState<Meeting[]>(MEETINGS)
  const [addOpen, setAddOpen] = useState(false)
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null)
  const today = 21
  const cells = Array.from({ length: 35 }, (_, i) => (i + 1 <= 30 ? i + 1 : null))
  const byDay = (d: number) => meetings.filter((m) => m.day === d)
  const upcoming = meetings.filter((m) => m.day >= today).sort((a, b) => a.day - b.day || a.time.localeCompare(b.time))
  const addMeeting = (d: NewMeetingData) => {
    const id = `M-${meetings.length + 1}`
    setMeetings((m) => [...m, { id, ...d }])
    addToast('Reunión agendada', 'ok')
    setAddOpen(false)
  }
  const updateMeeting = (id: string, patch: Partial<Meeting>) => {
    setMeetings((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)))
    addToast('Reunión actualizada', 'ok')
    setEditMeeting(null)
  }
  const deleteMeeting = (id: string) => {
    const removed = meetings.find((m) => m.id === id)
    setMeetings((ms) => ms.filter((m) => m.id !== id))
    addToast('Reunión eliminada', 'info', 'Deshacer', () => { if (removed) setMeetings((ms) => [...ms, removed]) })
  }
  return (
    <div className="g2 calgrid">
      <div className="card cpad rise d1">
        <div className="calhead">
          <button className="ibtn" disabled><ChevronLeft size={16} /></button>
          <div className="ctitle">Junio 2026</div>
          <button className="ibtn" disabled><ChevronRight size={16} /></button>
        </div>
        <div className="calgridwrap">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <div className="caldow" key={d}>{d}</div>)}
          {cells.map((d, i) => (
            <div key={i} className={`calcell ${d === today ? 'today' : ''} ${!d ? 'empty' : ''}`}>
              {d && (
                <>
                  <span className="caldnum">{d}</span>
                  <div className="caldots">
                    {byDay(d).slice(0, 4).map((m) => <span key={m.id} className={`caldot ${MEET_TONE[m.type]}`} />)}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="card cpad rise d2">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div className="ctitle">Próximas reuniones</div>
          <button className="btn pri" onClick={() => setAddOpen(true)}><Plus size={14} />Agendar</button>
        </div>
        {upcoming.length === 0 ? <div className="dempty">No hay reuniones próximas.</div> : upcoming.map((m) => (
          <div className="meetrow" key={m.id}>
            <div className={`meetdate ${MEET_TONE[m.type]}`}><div className="meetday">{m.day}</div><div className="meetmon">Jun</div></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="eltxt">{m.title}</div>
              <div className="elsub">{m.time} · {m.dur} · {m.with}</div>
            </div>
            <span className={`badge b-${MEET_TONE[m.type]}`}>{m.type}</span>
            <button className="ibtn" style={{ width: 28, height: 28, flexShrink: 0 }} data-tip="Editar" onClick={() => setEditMeeting(m)}>
              <PenLine size={13} />
            </button>
            <button className="ibtn" style={{ width: 28, height: 28, flexShrink: 0 }} data-tip="Eliminar" onClick={() => deleteMeeting(m.id)}>
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
      <NewMeetingModal open={addOpen} onClose={() => setAddOpen(false)} onCreate={addMeeting} />
      {editMeeting && (
        <div className="mwrap" onClick={() => setEditMeeting(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Editar reunión</div><button className="ibtn" onClick={() => setEditMeeting(null)}><X size={18} /></button></div>
            <div className="mbody">
              <div className="flabel" style={{ marginTop: 0 }}>Título</div>
              <input className="field" value={editMeeting.title} onChange={(e) => setEditMeeting((m) => (m ? { ...m, title: e.target.value } : m))} />
              <div className="flabel">Hora</div>
              <input className="field" value={editMeeting.time} onChange={(e) => setEditMeeting((m) => (m ? { ...m, time: e.target.value } : m))} />
              <div className="flabel">Duración</div>
              <input className="field" value={editMeeting.dur} onChange={(e) => setEditMeeting((m) => (m ? { ...m, dur: e.target.value } : m))} />
              <div className="flabel">Con quien</div>
              <input className="field" value={editMeeting.with} onChange={(e) => setEditMeeting((m) => (m ? { ...m, with: e.target.value } : m))} />
            </div>
            <div className="mfoot">
              <button className="btn danger" onClick={() => { deleteMeeting(editMeeting.id) }}>Eliminar</button>
              <div style={{ display: 'flex', gap: 9 }}>
                <button className="btn" onClick={() => setEditMeeting(null)}>Cancelar</button>
                <button className="btn dark" onClick={() => updateMeeting(editMeeting.id, editMeeting)}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
