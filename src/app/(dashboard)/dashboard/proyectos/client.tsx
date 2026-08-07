'use client'

import { useState } from 'react'
import { BarChart3, Clock, Check, Plus, X, Users, ChevronRight, MapPin, Zap, FileText } from '@/lib/icons'
import type { IconProps } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import TabBar from '@/components/ui/TabBar'
import { useApp } from '@/lib/context/AppContext'
import { activatable } from '@/lib/a11y'

interface Proyecto {
  id: string
  nombre: string
  ubicacion: string
  cliente: string
  tipo: string
  capacidad: string
  inicio: string
  fin: string
  progreso: number
  st: string
  equipo: string[]
  presupuesto: number
}

const PROYECTOS: Proyecto[] = [
  { id: 'PRY-001', nombre: 'Parque Solar Bosa Fase I', ubicacion: 'Bosa, Bogotá', cliente: 'Empresa de Energía de Bogotá', tipo: 'Instalación', capacidad: '150 kWp', inicio: '02 ene 2026', fin: '30 jun 2026', progreso: 72, st: 'En ejecución', equipo: ['Andrés Mora', 'Juan Pérez', 'Laura Jiménez'], presupuesto: 580000000 },
  { id: 'PRY-002', nombre: 'Mantención Planta Cajicá', ubicacion: 'Cajicá, Cundinamarca', cliente: 'SolarCol SAS', tipo: 'Mantenimiento', capacidad: '80 kWp', inicio: '01 mar 2026', fin: '31 ago 2026', progreso: 45, st: 'En ejecución', equipo: ['Daniel Ospina', 'Sebastián Cano'], presupuesto: 120000000 },
  { id: 'PRY-003', nombre: 'Sistema Solar Comercial CEFI', ubicacion: 'Centro Empresarial, Bogotá', cliente: 'CEFI Propiedades', tipo: 'Instalación', capacidad: '45 kWp', inicio: '15 abr 2026', fin: '15 jul 2026', progreso: 30, st: 'En ejecución', equipo: ['María González', 'Andrés Mora'], presupuesto: 210000000 },
  { id: 'PRY-004', nombre: 'Expansión Planta Solar Yumbo', ubicacion: 'Yumbo, Valle', cliente: 'Energía Limpia SA', tipo: 'Ampliación', capacidad: '200 kWp', inicio: '01 feb 2026', fin: '31 may 2026', progreso: 100, st: 'Finalizado', equipo: ['Juan Pérez', 'Daniel Ospina', 'Valentina Ruiz'], presupuesto: 720000000 },
  { id: 'PRY-005', nombre: 'Solar Residencial 60 viviendas', ubicacion: 'Soacha, Cundinamarca', cliente: 'Constructora Hábitat', tipo: 'Instalación', capacidad: '90 kWp', inicio: '10 jun 2026', fin: '30 sep 2026', progreso: 15, st: 'En ejecución', equipo: ['Sebastián Cano', 'Laura Jiménez'], presupuesto: 320000000 },
  { id: 'PRY-006', nombre: 'Diagnóstico Energético Zona Franca', ubicacion: 'Zona Franca, Bogotá', cliente: 'Zona Franca BO', tipo: 'Diagnóstico', capacidad: '—', inicio: '20 may 2026', fin: '20 jul 2026', progreso: 55, st: 'En pausa', equipo: ['María González'], presupuesto: 45000000 },
  { id: 'PRY-007', nombre: 'Granja Solar Montes de María', ubicacion: 'El Carmen, Bolívar', cliente: 'Gobernación de Bolívar', tipo: 'Instalación', capacidad: '500 kWp', inicio: '01 jul 2026', fin: '31 dic 2026', progreso: 0, st: 'Planificación', equipo: ['Camila Restrepo', 'Andrés Mora', 'Juan Pérez'], presupuesto: 1850000000 },
]


function Stat({ ico: Ico, tone = 'ink', label, value, sub }: {
  ico: (p: IconProps) => React.ReactElement
  tone?: string
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <div className="card kpi">
      <div className={`kglow ${tone}`} />
      <div className="klab">
        <span className={`kico-soft ${tone}`}><Ico size={16} /></span>
        {label}
      </div>
      <div className="kval">{value}</div>
      {sub && <div className="kvs" style={{ marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

const cop = (n: number) => '$' + n.toLocaleString('es-CO')

export default function ProyectosPage() {
  const { addToast } = useApp()
  const [proyectos, setProyectos] = useState<Proyecto[]>(PROYECTOS)
  const [filtro, setFiltro] = useState('Todos')
  const [addOpen, setAddOpen] = useState(false)
  const [selProy, setSelProy] = useState<string | null>(null)
  const [nuevo, setNuevo] = useState({ nombre: '', ubicacion: '', cliente: '', tipo: 'Instalación', capacidad: '', presupuesto: '' })

  const activos = proyectos.filter(p => p.st === 'En ejecución').length
  const completados = proyectos.filter(p => p.st === 'Finalizado').length
  const planificacion = proyectos.filter(p => p.st === 'Planificación').length
  const presupuestoTotal = proyectos.reduce((s, p) => s + p.presupuesto, 0)

  const filtered = proyectos.filter(p => filtro === 'Todos' || p.st === filtro)

  const addProyecto = () => {
    if (!nuevo.nombre.trim()) return
    const id = `PRY-${(proyectos.length + 10).toString().padStart(3, '0')}`
    setProyectos(ps => [{ id, nombre: nuevo.nombre, ubicacion: nuevo.ubicacion || 'Por definir', cliente: nuevo.cliente || 'Por definir', tipo: nuevo.tipo, capacidad: nuevo.capacidad || '—', inicio: '—', fin: '—', progreso: 0, st: 'Planificación', equipo: [], presupuesto: parseInt(nuevo.presupuesto) || 0 }, ...ps])
    addToast(`Proyecto "${nuevo.nombre}" creado`, 'ok')
    setAddOpen(false)
    setNuevo({ nombre: '', ubicacion: '', cliente: '', tipo: 'Instalación', capacidad: '', presupuesto: '' })
  }

  const eliminarProyecto = (id: string) => {
    const p = proyectos.find(x => x.id === id)
    setProyectos(ps => ps.filter(x => x.id !== id))
    setSelProy(null)
    if (p) addToast(`Proyecto "${p.nombre}" eliminado`, 'info', 'Deshacer', () => setProyectos(ps => [p, ...ps]))
  }

  const sel = proyectos.find(p => p.id === selProy) || null

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat ico={BarChart3} tone="blu" label="Proyectos activos" value={activos} sub="en ejecución" /></div>
        <div className="rise d2"><Stat ico={Check} tone="grn" label="Finalizados" value={completados} sub="este año" /></div>
        <div className="rise d3"><Stat ico={Clock} tone="amb" label="En planificación" value={planificacion} sub="próximos" /></div>
        <div className="rise d4"><Stat ico={Zap} tone="vio" label="Presupuesto total" value={cop(presupuestoTotal)} sub="todos los proyectos" /></div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <TabBar
            value={filtro}
            onChange={setFiltro}
            items={['Todos', 'Planificación', 'En ejecución', 'En pausa', 'Finalizado'].map(s => ({
              key: s,
              label: `${s}${s !== 'Todos' ? ` · ${proyectos.filter(p => p.st === s).length}` : ''}`,
            }))}
          />
          <button className="btn pri" onClick={() => setAddOpen(true)}><Plus size={15} />Nuevo proyecto</button>
        </div>
        <table className="tbl">
          <thead><tr><th scope="col">Proyecto</th><th scope="col">Ubicación</th><th scope="col">Capacidad</th><th scope="col">Avance</th><th scope="col">Estado</th><th scope="col"></th></tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6}><div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>No hay proyectos en esta categoría.</div></td></tr>
            ) : filtered.map(p => (
              <tr className="trow" key={p.id} style={{ cursor: 'pointer' }} {...activatable(() => setSelProy(p.id), `Abrir proyecto ${p.nombre}`)}>
                <td>
                  <div className="cename">{p.nombre}</div>
                  <div className="ceid mono">{p.id} · {p.cliente}</div>
                </td>
                <td><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={13} style={{ flexShrink: 0 }} /><span className="muted">{p.ubicacion}</span></div></td>
                <td className="muted">{p.capacidad}</td>
                <td style={{ minWidth: 130 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="bartrack" style={{ flex: 1 }}><div className="barfill" style={{ width: `${p.progreso}%`, background: p.progreso === 100 ? 'var(--grn)' : 'var(--blu)' }} /></div>
                    <span className="elsub" style={{ fontWeight: 600, flexShrink: 0, minWidth: 32, textAlign: 'right' }}>{p.progreso}%</span>
                  </div>
                </td>
                <td><Badge st={p.st} filled /></td>
                <td style={{ textAlign: 'right' }}><ChevronRight size={16} color="#c4c4cc" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drawer detalle */}
      {sel && (
        <>
          <div className="ovl" onClick={() => setSelProy(null)} />
          <aside className="drawer">
            <div className="dhead tkhead">
              <div className="dmark" style={{ background: 'linear-gradient(145deg,#7aa2ff,#3b82f6)', boxShadow: '0 8px 18px -8px #3b82f699' }}>
                <BarChart3 size={19} color="#fff" />
              </div>
              <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
                <div className="dh-t">{sel.nombre}</div>
                <div className="dh-s mono">{sel.id}</div>
              </div>
              <button className="ibtn" onClick={() => setSelProy(null)} style={{ position: 'relative', zIndex: 1 }}><X size={18} /></button>
            </div>
            <div className="dbody">
              <div style={{ display: 'flex', gap: 8 }}>
                <Badge st={sel.st} filled />
              </div>

              <div className="dsect">Información general</div>
              <div className="elrow"><div className="eltxt">Cliente</div><div className="elsub">{sel.cliente}</div></div>
              <div className="elrow"><div className="eltxt">Ubicación</div><div className="elsub" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={13} />{sel.ubicacion}</div></div>
              <div className="elrow"><div className="eltxt">Tipo</div><div className="elsub">{sel.tipo}</div></div>
              <div className="elrow"><div className="eltxt">Capacidad</div><div className="elsub">{sel.capacidad}</div></div>

              <div className="dsect">Cronograma</div>
              <div className="elrow"><div className="eltxt">Inicio</div><div className="elsub">{sel.inicio}</div></div>
              <div className="elrow"><div className="eltxt">Fin previsto</div><div className="elsub">{sel.fin}</div></div>

              <div className="dsect">Avance</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="bartrack" style={{ height: 12, borderRadius: 8, flex: 1 }}><div className="barfill" style={{ width: `${sel.progreso}%`, height: 12, borderRadius: 8, background: sel.progreso === 100 ? 'var(--grn)' : 'var(--blu)' }} /></div>
                <span style={{ fontWeight: 700, fontSize: 20, flexShrink: 0 }}>{sel.progreso}%</span>
              </div>

              <div className="dsect">Presupuesto</div>
              <div className="elrow"><div className="eltxt">Asignado</div><div className="eltxt">{cop(sel.presupuesto)}</div></div>

              <div className="dsect">Equipo asignado</div>
              {sel.equipo.length === 0 ? (
                <div className="dempty" style={{ padding: '12px 0' }}>Sin equipo asignado</div>
              ) : sel.equipo.map((m, i) => (
                <div className="elrow" key={i}>
                  <Users size={14} />
                  <div className="eltxt">{m}</div>
                </div>
              ))}
            </div>
            <div className="dacts">
              <button className="btn dark" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { addToast('Descargando informe…', 'ok') }}><FileText size={15} />Informe</button>
              <button className="ibtn" style={{ color: 'var(--redd)', borderColor: '#f7cbcb' }} onClick={() => eliminarProyecto(sel.id)}><X size={17} /></button>
            </div>
          </aside>
        </>
      )}

      {/* Modal nuevo proyecto */}
      {addOpen && (
        <div className="mwrap" onClick={() => setAddOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Nuevo proyecto</div><button className="ibtn" onClick={() => setAddOpen(false)}><X size={18} /></button></div>
            <div className="mbody">
              <div className="flabel" style={{ marginTop: 0 }}>Nombre del proyecto</div>
              <input className="field" placeholder="Ej. Parque Solar Bosa Fase II" value={nuevo.nombre} onChange={e => setNuevo(n => ({ ...n, nombre: e.target.value }))} />
              <div className="flabel">Ubicación</div>
              <input className="field" placeholder="Ej. Bosa, Bogotá" value={nuevo.ubicacion} onChange={e => setNuevo(n => ({ ...n, ubicacion: e.target.value }))} />
              <div className="flabel">Cliente</div>
              <input className="field" placeholder="Ej. Empresa de Energía" value={nuevo.cliente} onChange={e => setNuevo(n => ({ ...n, cliente: e.target.value }))} />
              <div className="flabel">Tipo</div>
              <div className="chips">
                {['Instalación', 'Mantenimiento', 'Ampliación', 'Diagnóstico'].map(t => (
                  <button key={t} className={`chip ${nuevo.tipo === t ? 'on' : ''}`} onClick={() => setNuevo(n => ({ ...n, tipo: t }))}>{t}</button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><div className="flabel">Capacidad</div><input className="field" placeholder="Ej. 150 kWp" value={nuevo.capacidad} onChange={e => setNuevo(n => ({ ...n, capacidad: e.target.value }))} /></div>
                <div><div className="flabel">Presupuesto estimado</div><input className="field" type="number" placeholder="0" value={nuevo.presupuesto} onChange={e => setNuevo(n => ({ ...n, presupuesto: e.target.value }))} /></div>
              </div>
            </div>
            <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
              <button className="btn" onClick={() => setAddOpen(false)}>Cancelar</button>
              <button className="btn dark" onClick={addProyecto}>Crear proyecto</button>
            </div></div>
          </div>
        </div>
      )}
    </>
  )
}
