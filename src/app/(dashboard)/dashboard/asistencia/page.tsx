'use client'

import { useState, useEffect, useRef, type ComponentType } from 'react'
import { createPortal } from 'react-dom'
import { UserMinus, AlertCircle, Clock, Calendar, Plus, Check, Trash2, X, PenLine, MoreHorizontal } from '@/lib/icons'
import type { IconProps } from '@/lib/icons'
import Avatar from '@/components/ui/Avatar'
import Select from '@/components/ui/Select'
import { tone } from '@/lib/utils'
import { useApp } from '@/lib/context/AppContext'

interface Ausencia {
  id: string
  name: string
  tipo: string
  desde: string
  hasta: string
  dias: number
  st: string
}
interface Vacacion {
  name: string
  disponibles: number
  tomados: number
}

const EMPLEADOS = [
  { id: 'EMP-1042', name: 'María González' },
  { id: 'EMP-1043', name: 'Juan Pérez' },
  { id: 'EMP-1044', name: 'Camila Restrepo' },
  { id: 'EMP-1045', name: 'Andrés Mora' },
  { id: 'EMP-1046', name: 'Valentina Ruiz' },
  { id: 'EMP-1047', name: 'Sebastián Cano' },
  { id: 'EMP-1048', name: 'Laura Jiménez' },
  { id: 'EMP-1049', name: 'Daniel Ospina' },
]

const AUSENCIAS: Ausencia[] = [
  { id: 'AUS-01', name: 'Andrés Mora', tipo: 'Incapacidad', desde: '16 jun 2026', hasta: '23 jun 2026', dias: 7, st: 'Activa' },
  { id: 'AUS-02', name: 'Sebastián Cano', tipo: 'Vacaciones', desde: '10 jun 2026', hasta: '14 jun 2026', dias: 5, st: 'Finalizada' },
  { id: 'AUS-03', name: 'Valentina Ruiz', tipo: 'Permiso', desde: '20 jun 2026', hasta: '20 jun 2026', dias: 1, st: 'Activa' },
  { id: 'AUS-04', name: 'Daniel Ospina', tipo: 'Vacaciones', desde: '29 jun 2026', hasta: '03 jul 2026', dias: 5, st: 'Programada' },
]
const VACACIONES: Vacacion[] = [
  { name: 'María González', disponibles: 15, tomados: 5 }, { name: 'Juan Pérez', disponibles: 18, tomados: 2 },
  { name: 'Andrés Mora', disponibles: 9, tomados: 11 }, { name: 'Valentina Ruiz', disponibles: 12, tomados: 8 },
  { name: 'Sebastián Cano', disponibles: 20, tomados: 0 }, { name: 'Daniel Ospina', disponibles: 14, tomados: 6 },
]

const HEATMAP_JUNE = [
  0, 0, 1, 0, 0, 0, 0,
  0, 1, 2, 1, 0, 0, 0,
  0, 1, 3, 3, 2, 0, 0,
  1, 2, 2, 1, 1, 0, 0,
  0, 1, 0,
]

const TONE: Record<string, [string, string]> = {
  red: ['#ff8a8d', '#e5484d'], grn: ['#3ed694', '#1f9d63'], amb: ['#f0bd5a', '#bf8410'],
  blu: ['#7aa2ff', '#3b82f6'], vio: ['#b298f2', '#7c5cd6'], ink: ['#a6a6b2', '#6b6b76'],
  neu: ['#a6a6b2', '#6b6b76'],
}

function Stat({ ico: Ico, tone: t = 'ink', label, value, sub }: { ico: ComponentType<IconProps>; tone?: string; label: string; value: string | number; sub?: string }) {
  return (
    <div className="card kpi">
      <div className={`kglow ${t}`} />
      <div className="klab">
        <span className={`kico-soft ${t}`}><Ico size={16} /></span>
        {label}
      </div>
      <div className="kval">{value}</div>
      {sub && <div className="kvs" style={{ marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function Badge({ st }: { st: string }) {
  const dotColor: Record<string, string> = {
    Activa: '#f0bd5a', Programada: '#7aa2ff', Finalizada: '#6b6b76', Resuelta: '#3ed694',
  }
  return <span className={`badge b-${tone(st)}`}><span className="bd" style={{ background: dotColor[st] || 'var(--ink3)' }} />{st}</span>
}

export default function AsistenciaPage() {
  const { addToast } = useApp()
  const [ausencias, setAusencias] = useState<Ausencia[]>(AUSENCIAS)
  const [vacaciones, setVacaciones] = useState<Vacacion[]>(VACACIONES)
  const [addOpen, setAddOpen] = useState(false)
  const [editAus, setEditAus] = useState<Ausencia | null>(null)
  const [empSel, setEmpSel] = useState(EMPLEADOS[0].name)
  const [tipo, setTipo] = useState('Vacaciones')
  const [desde, setDesde] = useState('2026-06-24')
  const [hasta, setHasta] = useState('2026-06-30')
  const [menuId, setMenuId] = useState<string | null>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const menuBtnRef = useRef<HTMLButtonElement | null>(null)

  const placeMenuFromBtn = () => {
    const r = menuBtnRef.current?.getBoundingClientRect()
    if (!r) return
    const below = window.innerHeight - r.bottom
    const top = below < 180 ? r.top - 180 - 6 : r.bottom + 6
    setMenuPos({ top, left: r.right - 170 })
  }

  const openMenu = (id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (menuId === id) { setMenuId(null); return }
    menuBtnRef.current = e.currentTarget
    const r = e.currentTarget.getBoundingClientRect()
    const below = window.innerHeight - r.bottom
    const top = below < 180 ? r.top - 180 - 6 : r.bottom + 6
    setMenuPos({ top, left: r.right - 170 })
    setMenuId(id)
  }

  useEffect(() => {
    if (!menuId) return
    window.addEventListener('scroll', placeMenuFromBtn, true)
    window.addEventListener('resize', placeMenuFromBtn)
    return () => {
      window.removeEventListener('scroll', placeMenuFromBtn, true)
      window.removeEventListener('resize', placeMenuFromBtn)
    }
  }, [menuId])

  useEffect(() => {
    if (!menuId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuId(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuId])

  const menuWasOpen = useRef(false)
  useEffect(() => {
    if (!menuId && menuWasOpen.current) menuBtnRef.current?.focus()
    menuWasOpen.current = !!menuId
  }, [menuId])

  const activas = ausencias.filter((a) => a.st === 'Activa').length
  const incapacidades = ausencias.filter((a) => a.tipo === 'Incapacidad').length
  const vacPendientes = vacaciones.reduce((s, v) => s + v.disponibles, 0)
  const horasExtra = 142

  const addAusencia = () => {
    const d1 = new Date(desde), d2 = new Date(hasta)
    const dias = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1)
    const id = `AUS-${(ausencias.length + 1).toString().padStart(2, '0')}`
    setAusencias((a) => [{ id, name: empSel, tipo, desde, hasta, dias, st: 'Activa' }, ...a])
    if (tipo === 'Vacaciones') {
      setVacaciones((v) => v.map((x) => x.name === empSel
        ? { ...x, disponibles: Math.max(0, x.disponibles - dias), tomados: x.tomados + dias }
        : x))
    }
    addToast(`Ausencia registrada para ${empSel.split(' ')[0]}`, 'ok')
    setAddOpen(false)
  }

  const resolveAusencia = (id: string) => {
    setAusencias((a) => a.map((x) => (x.id === id ? { ...x, st: 'Resuelta' } : x)))
    addToast('Ausencia marcada como resuelta', 'ok')
  }

  const deleteAusencia = (id: string) => {
    const a = ausencias.find((x) => x.id === id)
    setAusencias((as) => as.filter((x) => x.id !== id))
    addToast('Ausencia eliminada', 'ok', 'Deshacer', () => { if (a) setAusencias((as) => [a, ...as]) })
  }

  const saveEdit = () => {
    if (!editAus) return
    setAusencias((as) => as.map((x) => (x.id === editAus.id ? editAus : x)))
    addToast('Ausencia actualizada', 'ok')
    setEditAus(null)
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat ico={UserMinus} tone="amb" label="Ausencias activas" value={activas} /></div>
        <div className="rise d2"><Stat ico={AlertCircle} tone="red" label="Incapacidades" value={incapacidades} /></div>
        <div className="rise d3"><Stat ico={Clock} tone="vio" label="Horas extra (mes)" value={horasExtra} /></div>
        <div className="rise d4"><Stat ico={Calendar} tone="grn" label="Vacaciones pendientes" value={`${vacPendientes} días`} /></div>
      </div>
      <div className="g2">
        <div className="card rise d2">
          <div className="chead">
            <div className="ctitle">Registro de ausencias</div>
            <button className="btn pri" onClick={() => setAddOpen(true)}><Plus size={14} />Registrar</button>
          </div>
          <table className="tbl">
            <thead><tr><th>Empleado</th><th>Tipo</th><th>Desde</th><th>Días</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {ausencias.map((a) => (
                <tr className="trow" key={a.id}>
                  <td><div className="cemp"><Avatar name={a.name} size={26} /><div className="cename">{a.name}</div></div></td>
                  <td className="muted">{a.tipo}</td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{a.desde}</td>
                  <td className="muted">{a.dias}d</td>
                  <td><Badge st={a.st} /></td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="ibtn"
                      style={{ width: 30, height: 30 }}
                      aria-haspopup="menu"
                      aria-expanded={menuId === a.id}
                      aria-label={`Acciones para ${a.name}`}
                      onClick={(e) => openMenu(a.id, e)}
                    >
                      <MoreHorizontal size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {menuId && menuPos && createPortal(
          <>
            <div className="nselect-catch" onClick={() => setMenuId(null)} />
            <div className="nselect-menu" role="menu" aria-label="Acciones de ausencia" style={{ top: menuPos.top, left: menuPos.left, width: 170 }}>
              {(() => {
                const a = ausencias.find(x => x.id === menuId)
                if (!a) return null
                return (
                  <>
                    {a.st === 'Activa' && (
                      <button className="nselect-item action" role="menuitem" onClick={() => { setMenuId(null); resolveAusencia(a.id) }}><Check size={14} />Resolver</button>
                    )}
                    <button className="nselect-item action" role="menuitem" onClick={() => { setMenuId(null); setEditAus(a) }}><PenLine size={14} />Editar</button>
                    <button className="nselect-item action" role="menuitem" style={{ color: 'var(--redd)' }} onClick={() => { setMenuId(null); deleteAusencia(a.id) }}><Trash2 size={14} />Eliminar</button>
                  </>
                )
              })()}
            </div>
          </>,
          document.body,
        )}
        <div className="card cpad rise d3">
          <div className="ctitle" style={{ marginBottom: 12 }}>Vacaciones por persona</div>
          {vacaciones.map((v) => {
            const tot = v.disponibles + v.tomados
            return (
              <div className="elrow" key={v.name}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div className="eltxt">{v.name}</div>
                    <div className="elsub">{v.disponibles}d disp.</div>
                  </div>
                  <div className="bartrack"><div className="barfill grn" style={{ width: `${tot ? (v.tomados / tot) * 100 : 0}%` }} /></div>
                  <div className="elsub" style={{ marginTop: 4 }}>{v.tomados}/{tot} días tomados</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="card rise d4" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Heatmap de ausentismo — Junio 2026</div>
        </div>
        <div className="cpad">
          <div className="heatdows">{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <div key={d} className="heatdow">{d}</div>)}</div>
          <div className="heatgrid">
            {Array.from({ length: 35 }, (_, i) => {
              const day = i + 1
              if (day > 30) return <div key={i} className="heatcell e" />
              const count = HEATMAP_JUNE[day - 1] || 0
              const level = count === 0 ? 'l0' : count === 1 ? 'l1' : count === 2 ? 'l2' : count <= 4 ? 'l3' : 'l4'
              return <div key={i} className={`heatcell ${level}`} title={`${day} jun · ${count} ausencia${count !== 1 ? 's' : ''}`}>{day}</div>
            })}
          </div>
          <div className="heatlegend">
            {[['l0', 'Sin ausencias'], ['l1', '1'], ['l2', '2'], ['l3', '3-4'], ['l4', '5+']].map(([cls, lbl]) => (
              <span key={cls} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span className={`heatcell ${cls}`} style={{ width: 16, height: 16, borderRadius: 3 }} />
                <span>{lbl}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
      {editAus && (
        <div className="mwrap" onClick={() => setEditAus(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Editar ausencia</div><button className="ibtn" onClick={() => setEditAus(null)}><X size={18} /></button></div>
            <div className="mbody">
              <div className="flabel" style={{ marginTop: 0 }}>Empleado</div>
              <Select value={editAus.name} onChange={(v) => setEditAus((a) => a ? { ...a, name: v } : a)} options={EMPLEADOS.map((e) => e.name)} />
              <div className="flabel">Tipo de ausencia</div>
              <Select value={editAus.tipo} onChange={(v) => setEditAus((a) => a ? { ...a, tipo: v } : a)} options={['Vacaciones', 'Incapacidad', 'Permiso', 'Licencia', 'Otro']} />
              <div className="flabel">Estado</div>
              <Select value={editAus.st} onChange={(v) => setEditAus((a) => a ? { ...a, st: v } : a)} options={['Activa', 'Finalizada', 'Programada', 'Resuelta']} />
            </div>
            <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
              <button className="btn" onClick={() => setEditAus(null)}>Cancelar</button>
              <button className="btn dark" onClick={saveEdit}><Check size={14} />Guardar</button>
            </div></div>
          </div>
        </div>
      )}
      {addOpen && (
        <div className="mwrap" onClick={() => setAddOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Registrar ausencia</div><button className="ibtn" onClick={() => setAddOpen(false)}><X size={18} /></button></div>
            <div className="mbody">
              <div className="flabel" style={{ marginTop: 0 }}>Empleado</div>
              <Select value={empSel} onChange={setEmpSel} options={EMPLEADOS.map((e) => e.name)} />
              <div className="flabel">Tipo de ausencia</div>
              <Select value={tipo} onChange={setTipo} options={['Vacaciones', 'Incapacidad', 'Permiso', 'Licencia', 'Otro']} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><div className="flabel">Desde</div><input className="field" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
                <div><div className="flabel">Hasta</div><input className="field" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
              </div>
            </div>
            <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
              <button className="btn" onClick={() => setAddOpen(false)}>Cancelar</button>
              <button className="btn dark" onClick={addAusencia}>Registrar ausencia</button>
            </div></div>
          </div>
        </div>
      )}
    </>
  )
}
