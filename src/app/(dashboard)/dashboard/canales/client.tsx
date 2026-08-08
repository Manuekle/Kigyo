'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Users, Plus, X, CheckCircle, MapPin, Briefcase } from '@/lib/icons'
import { useApp } from '@/lib/context/AppContext'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import { activatable } from '@/lib/a11y'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Mensaje {
  id: string
  usr: string
  txt: string
  t: string
  proy?: { id: string; nombre: string; ubicacion: string; monto: string; estado: string }
}

interface Canal {
  id: string
  nombre: string
  tipo: 'grupo' | 'directo'
  miembros: string[]
  ultimo: string
}

/* ------------------------------------------------------------------ */
/*  Page-local data                                                    */
/* ------------------------------------------------------------------ */
const USUARIOS = [
  { name: 'María González', role: 'Líder de equipo' },
  { name: 'Juan Pérez', role: 'Instalador' },
  { name: 'Camila Restrepo', role: 'Administradora' },
  { name: 'Valentina Ruiz', role: 'Ingeniera' },
  { name: 'Daniel Ospina', role: 'Almacenista' },
  { name: 'Sara López', role: 'Instaladora' },
  { name: 'Carlos Ríos', role: 'Supervisor HSEQ' },
  { name: 'Ana Torres', role: 'Diseñadora' },
]

const CANALES_INIT: Canal[] = [
  { id: 'general', nombre: 'General', tipo: 'grupo', miembros: USUARIOS.map(u => u.name), ultimo: '10:32' },
  { id: 'proyectos', nombre: 'Proyectos', tipo: 'grupo', miembros: ['María González', 'Juan Pérez', 'Valentina Ruiz', 'Carlos Ríos'], ultimo: 'ayer' },
  { id: 'soporte', nombre: 'Soporte técnico', tipo: 'grupo', miembros: ['Daniel Ospina', 'Ana Torres', 'Camila Restrepo'], ultimo: '15 jun' },
  { id: 'hseq', nombre: 'HSEQ', tipo: 'grupo', miembros: ['Carlos Ríos', 'María González', 'Valentina Ruiz'], ultimo: '12 jun' },
]

const PROJECTS = [
  { id: 'P-001', nombre: 'Instalación Solar Residencial — Av. Siempre Viva 123', ubicacion: 'Av. Siempre Viva 123', monto: '$4,200', estado: 'En curso' },
  { id: 'P-002', nombre: 'Sistema Fotovoltaico — Comercial Centro', ubicacion: 'Cra 45 #67-89', monto: '$12,800', estado: 'Pendiente' },
  { id: 'P-003', nombre: 'Mantenimiento Planta Solar — Industrias XYZ', ubicacion: 'Km 5 Vía al Mar', monto: '$3,500', estado: 'Completado' },
]

const INIT_MSGS: Record<string, Mensaje[]> = {
  general: [
    { id: 'g1', usr: 'Camila Restrepo', txt: '¡Buen día equipo! Recordatorio: mañana hay reunión de planificación semanal a las 9am.', t: '09:15' },
    { id: 'g2', usr: 'María González', txt: 'Confirmado. Llevo el reporte de avance de proyectos.', t: '09:22' },
    { id: 'g3', usr: 'Juan Pérez', txt: 'Perfecto, yo tengo los datos de instalación de esta semana.', t: '09:30' },
    { id: 'g4', usr: 'Carlos Ríos', txt: 'Adjunto el formato HSEQ para la revisión de mañana. @Maria hay un punto de seguridad que necesito discutir.', t: '09:45' },
    { id: 'g5', usr: 'Valentina Ruiz', txt: 'Acabo de actualizar los planos del proyecto P-003. Quedan en la carpeta compartida.', t: '10:05' },
    { id: 'g6', usr: 'Ana Torres', txt: 'Gracias Vale. Los reviso esta tarde para ajustar la cotización.', t: '10:10' },
    { id: 'g7', usr: 'Daniel Ospina', txt: 'Llegó el pedido de paneles solares. Los tengo en bodega listos para distribución.', t: '10:32' },
  ],
  proyectos: [
    { id: 'p1', usr: 'María González', txt: 'Asignación del proyecto P-001 para revisión técnica. Por favor revisar los detalles.', t: '08:30', proy: { id: 'P-001', nombre: 'Instalación Solar Residencial — Av. Siempre Viva 123', ubicacion: 'Av. Siempre Viva 123', monto: '$4,200', estado: 'En curso' } },
    { id: 'p2', usr: 'Valentina Ruiz', txt: 'Revisé los planos del P-001. Todo en orden, podemos proceder con la instalación la próxima semana.', t: '09:00' },
    { id: 'p3', usr: 'Juan Pérez', txt: 'Perfecto. Confirmo disponibilidad del equipo para el lunes. Necesitamos 3 instaladores.', t: '09:15' },
    { id: 'p4', usr: 'María González', txt: 'Adjunto especificaciones del proyecto P-002 para cotización.', t: 'ayer', proy: { id: 'P-002', nombre: 'Sistema Fotovoltaico — Comercial Centro', ubicacion: 'Cra 45 #67-89', monto: '$12,800', estado: 'Pendiente' } },
    { id: 'p5', usr: 'Ana Torres', txt: 'Recibido. Preparo la cotización y el diseño para la revisión del cliente.', t: 'ayer' },
  ],
  soporte: [
    { id: 's1', usr: 'Daniel Ospina', txt: 'Equipo, la impresora del área de diseño dejó de funcionar. ¿Alguien sabe de soporte técnico?', t: '14:20' },
    { id: 's2', usr: 'Ana Torres', txt: 'Ya hablé con TI. Vendrán mañana a revisarla. Mientras tanto pueden usar la del área administrativa.', t: '14:35' },
    { id: 's3', usr: 'Camila Restrepo', txt: 'Gracias Ana. @Daniel también necesito que revisen el inventario de herramientas para la instalación del lunes.', t: '15:00' },
  ],
  hseq: [
    { id: 'h1', usr: 'Carlos Ríos', txt: 'Reporte de inspección de seguridad semanal: todo en regla en los frentes de trabajo. Se identificó un riesgo menor en bodega (orden y aseo), ya se asignó acción correctiva.', t: '11:00' },
    { id: 'h2', usr: 'María González', txt: 'Carlos, ¿puedes compartir el formato de permiso de trabajo en alturas para el proyecto P-001?', t: '11:15' },
    { id: 'h3', usr: 'Carlos Ríos', txt: 'Claro, lo subo al repositorio documental y les comparto el enlace por acá.', t: '11:20' },
    { id: 'h4', usr: 'Carlos Ríos', txt: 'Listo, queda en la carpeta HSEQ > Permisos. Cualquier novedad me avisan.', t: '11:25' },
  ],
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export default function CanalesPage() {
  const { addToast } = useApp()
  const [canales, setCanales] = useState(CANALES_INIT)
  const [currentId, setCurrentId] = useState('general')
  const [msgs, setMsgs] = useState(INIT_MSGS)
  const [input, setInput] = useState('')
  const [showNewChan, setShowNewChan] = useState(false)
  const [newChanName, setNewChanName] = useState('')
  const [selProy, setSelProy] = useState<string | null>(null)
  const [showProyPicker, setShowProyPicker] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const current = canales.find(c => c.id === currentId)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, currentId])

  function sendMsg() {
    if (!input.trim() && !selProy) return
    const msg: Mensaje = {
      id: `m${Date.now()}`,
      usr: 'Camila Restrepo',
      txt: input.trim() || 'Compartió un proyecto',
      t: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    }
    if (selProy) {
      const proj = PROJECTS.find(p => p.id === selProy)
      if (proj) msg.proy = proj
    }
    setMsgs(prev => ({ ...prev, [currentId]: [...(prev[currentId] || []), msg] }))
    setInput('')
    setSelProy(null)
  }

  function addCanal() {
    if (!newChanName.trim()) return
    const id = newChanName.toLowerCase().replace(/[^a-z0-9]/g, '')
    setCanales(prev => [...prev, { id, nombre: newChanName, tipo: 'grupo', miembros: ['Camila Restrepo'], ultimo: 'ahora' }])
    setMsgs(prev => ({ ...prev, [id]: [] }))
    setNewChanName('')
    setShowNewChan(false)
    addToast(`Canal #${newChanName} creado`, 'ok')
  }

  const selProjData = selProy ? PROJECTS.find(p => p.id === selProy) : null

  return (
    <div className="ch-page">
      {/* ---- Sidebar ---- */}
      <div className="ch-side">
        <div className="ch-side-head">
          <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: '.02em', color: 'var(--ink2)' }}>Canales</span>
          <button className="ibtn" style={{ width: 28, height: 28 }} onClick={() => setShowNewChan(true)} title="Crear canal">
            <Plus size={14} />
          </button>
        </div>

        {showNewChan && (
          <div className="ch-new">
            <input
              className="field"
              style={{ flex: 1, fontSize: 12, padding: '5px 10px', height: 28 }}
              placeholder="Nombre del canal"
              value={newChanName}
              onChange={e => setNewChanName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCanal()}
              autoFocus
            />
            <button className="ibtn" style={{ width: 28, height: 28 }} onClick={addCanal}><CheckCircle size={13} /></button>
            <button className="ibtn" style={{ width: 28, height: 28 }} onClick={() => { setShowNewChan(false); setNewChanName('') }}><X size={13} /></button>
          </div>
        )}

        <div className="ch-side-list">
          {canales.map(c => (
            <button
              key={c.id}
              className={`ch-item${c.id === currentId ? ' on' : ''}`}
              onClick={() => setCurrentId(c.id)}
            >
              <span className="ch-item-hash">#</span>
              <span className="ch-item-name">{c.nombre}</span>
              <span className="ch-item-time">{c.ultimo}</span>
            </button>
          ))}
        </div>

        <div className="ch-side-foot">
          <Users size={12} />
          <span>{USUARIOS.length} miembros</span>
        </div>
      </div>

      {/* ---- Main area ---- */}
      <div className="ch-main">
        <div className="ch-head">
          <span className="ch-head-hash">#</span>
          <span className="ch-head-name">{current?.nombre}</span>
          <span className="ch-head-count">{current?.miembros.length} miembros</span>
        </div>

        <div className="ch-msgs">
          {msgs[currentId]?.map(m => {
            const user = USUARIOS.find(u => u.name === m.usr)
            return (
              <div className="ch-msg" key={m.id}>
                <div className="ch-msg-ava">
                  <Avatar name={m.usr} size={32} />
                </div>
                <div className="ch-msg-body">
                  <div className="ch-msg-meta">
                    <span className="ch-msg-name">{m.usr}</span>
                    <span className="ch-msg-time">{m.t}</span>
                    {user && <span className="ch-msg-role">{user.role}</span>}
                  </div>
                  {m.txt && <div className="ch-msg-text">{m.txt}</div>}

                  {m.proy && (
                    <div className="ch-proj" {...activatable(() => addToast(`Abriendo ${m.proy?.nombre}`, 'ok'), `Abrir proyecto ${m.proy?.nombre}`)}>
                      <div className="ch-proj-head">
                        <Briefcase size={14} style={{ color: 'var(--ink2)' }} />
                        <span className="ch-proj-id">{m.proy.id}</span>
                        <Badge st={m.proy.estado} />
                      </div>
                      <div className="ch-proj-name">{m.proy.nombre}</div>
                      <div className="ch-proj-meta">
                        <span><MapPin size={11} />{m.proy.ubicacion}</span>
                        <span style={{ fontWeight: 500, color: 'var(--ink2)' }}>{m.proy.monto}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Composer */}
        <div className="ch-composer">
          {showProyPicker && (
            <div className="ch-picker">
              <div className="ch-picker-title">Compartir proyecto</div>
              {PROJECTS.map(p => (
                <button
                  key={p.id}
                  className={`ch-pick-item${selProy === p.id ? ' on' : ''}`}
                  onClick={() => { setSelProy(p.id); setShowProyPicker(false) }}
                >
                  <Briefcase size={14} style={{ flexShrink: 0, opacity: .6 }} />
                  <div style={{ minWidth: 0 }}>
                    <div className="ch-pick-item-name">{p.nombre}</div>
                    <div className="ch-pick-item-sub">{p.monto} · {p.estado}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="ch-input-row">
            <button
              className="ibtn"
              style={{ width: 30, height: 30 }}
              onClick={() => setShowProyPicker(v => !v)}
              title="Adjuntar proyecto"
            >
              <Briefcase size={14} />
            </button>

            <div className="ia-box" style={{ flex: 1 }}>
              {selProjData && (
                <span className="ch-input-tag">
                  {selProjData.id}
                  <button onClick={() => setSelProy(null)}>×</button>
                </span>
              )}
              <input
                className="ia-text"
                placeholder={`Mensaje en #${current?.nombre || 'canal'}`}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() } }}
              />
            </div>

            <button
              className="ia-go"
              onClick={sendMsg}
              disabled={!input.trim() && !selProy}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
