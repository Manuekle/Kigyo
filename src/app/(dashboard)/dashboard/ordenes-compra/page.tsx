'use client'

import { useState, useMemo } from 'react'
import { FileCheck2, Check, Truck, X, Plus, Eye, Calendar } from '@/lib/icons'
import Stat from '@/components/ui/Stat'
import TabBar from '@/components/ui/TabBar'
import { useApp } from '@/lib/context/AppContext'

interface OCItem { desc: string; cantidad: number; precio: number }
interface OC { id: string; proveedor: string; proyecto: string; status: 'Pendiente' | 'Aprobada' | 'Recibida' | 'Cancelada'; total: number; fecha: string; vencimiento: string; items: OCItem[]; notas: string }

const OC_SEED: OC[] = [
  { id: 'OC-101', proveedor: 'Soltek Solar', proyecto: 'P-001 · Torre Sur', status: 'Pendiente', total: 8200000, fecha: '15 jun', vencimiento: '25 jun', items: [{ desc: 'Paneles 640W', cantidad: 30, precio: 220000 }, { desc: 'Estructura montaje', cantidad: 1, precio: 3800000 }], notas: 'Pendiente firma del cliente.' },
  { id: 'OC-098', proveedor: 'Mecánica Total', proyecto: 'P-003 · Industrias XYZ', status: 'Aprobada', total: 4200000, fecha: '10 jun', vencimiento: '22 jun', items: [{ desc: 'Inspección eléctrica', cantidad: 1, precio: 4200000 }], notas: 'Aprobada por comité.' },
  { id: 'OC-092', proveedor: 'Logística Rápida', proyecto: 'P-002 · Comercial Centro', status: 'Recibida', total: 12800000, fecha: '04 jun', vencimiento: '14 jun', items: [{ desc: 'Transporte paneles', cantidad: 1, precio: 12800000 }], notas: 'Servicio completado.' },
  { id: 'OC-088', proveedor: 'EnerSol Services', proyecto: 'P-004 · Planta Norte', status: 'Cancelada', total: 5400000, fecha: '28 may', vencimiento: '10 jun', items: [{ desc: 'Mantenimiento baterías', cantidad: 1, precio: 5400000 }], notas: 'Cancelado por cambio de proveedor.' },
]

const STATUS_TABS = ['Todos', 'Pendiente', 'Aprobada', 'Recibida', 'Cancelada']
const STATUS_FLOW: Record<OC['status'], OC['status'] | null> = { Pendiente: 'Aprobada', Aprobada: 'Recibida', Recibida: null, Cancelada: null }

export default function OCPage() {
  const { addToast } = useApp()
  const [ocs, setOcs] = useState(OC_SEED)
  const [filter, setFilter] = useState('Todos')
  const [selId, setSelId] = useState(OC_SEED[0].id)
  const [form, setForm] = useState({ proveedor: '', proyecto: '', total: '' })
  const sel = ocs.find(o => o.id === selId) ?? ocs[0]

  const filtered = ocs.filter(o => filter === 'Todos' || o.status === filter)
  const stats = useMemo(() => ({
    total: ocs.length,
    pendientes: ocs.filter(o => o.status === 'Pendiente').length,
    aprobadas: ocs.filter(o => o.status === 'Aprobada').length,
    totalMonto: ocs.reduce((a, o) => a + o.total, 0),
  }), [ocs])

  const advance = (id: string) => {
    setOcs(prev => prev.map(o => {
      if (o.id !== id) return o
      const next = STATUS_FLOW[o.status]
      if (!next) return o
      addToast(`OC ${next === 'Recibida' ? 'marcada recibida' : next === 'Aprobada' ? 'aprobada' : ''}`, next === 'Recibida' ? 'ok' : 'info')
      return { ...o, status: next }
    }))
  }

  const cancelOC = (id: string) => {
    setOcs(prev => prev.map(o => o.id === id ? { ...o, status: 'Cancelada' as const } : o))
    addToast('OC cancelada', 'info')
  }

  const generateFromReqs = () => {
    if (!form.proveedor || !form.proyecto) { addToast('Completa proveedor y proyecto', 'warn'); return }
    const id = `OC-${Math.floor(Math.random() * 900) + 100}`
    const nueva: OC = { id, proveedor: form.proveedor, proyecto: form.proyecto, status: 'Pendiente', total: Number(form.total) || 0, fecha: 'Hoy', vencimiento: '30 jun', items: [{ desc: 'Producto/servicio', cantidad: 1, precio: Number(form.total) || 0 }], notas: '' }
    setOcs(prev => [nueva, ...prev])
    setSelId(id)
    setForm({ proveedor: '', proyecto: '', total: '' })
    addToast(`OC ${id} generada desde requisición`, 'ok')
  }

  return (
    <div>
      <div className="g3" style={{ marginBottom: 16 }}>
        <Stat icon={<FileCheck2 size={16} />} tone="blu" label="Órdenes totales" value={stats.total} />
        <Stat icon={<Calendar size={16} />} tone="amb" label="Pendientes" value={stats.pendientes} />
        <Stat icon={<Check size={16} />} tone="grn" label="Aprobadas" value={stats.aprobadas} />
        <Stat icon={<Truck size={16} />} tone="vio" label="Total comprometido" value={`COP ${stats.totalMonto.toLocaleString('es-CO')}`} />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, fontSize: 13, color: 'var(--ink2)' }}>
        <FileCheck2 size={16} />
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,.30)' }}>{stats.total} OC · COP {stats.totalMonto.toLocaleString('es-CO')}</span>
      </div>

      <div className="card rise d1" style={{ marginBottom: 18 }}>
        <div className="chead">
          <TabBar value={filter} onChange={setFilter} items={STATUS_TABS.map(s => ({ key: s, label: s }))} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input className="field" placeholder="Proveedor" value={form.proveedor} onChange={e => setForm(p => ({ ...p, proveedor: e.target.value }))} style={{ width: 140, fontSize: 12 }} />
            <input className="field" placeholder="Proyecto" value={form.proyecto} onChange={e => setForm(p => ({ ...p, proyecto: e.target.value }))} style={{ width: 140, fontSize: 12 }} />
            <input className="field" placeholder="Total" type="number" value={form.total} onChange={e => setForm(p => ({ ...p, total: e.target.value }))} style={{ width: 100, fontSize: 12 }} />
            <button className="btn pri" onClick={generateFromReqs}><Plus size={13} />Generar OC</button>
          </div>
        </div>
        <div style={{ maxHeight: 280, overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>ID · Fecha</th>
                <th>Proveedor</th>
                <th>Proyecto</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Vence</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(oc => (
                <tr key={oc.id} className="trow" onClick={() => setSelId(oc.id)} style={oc.id === sel?.id ? { background: 'var(--blus)' } : undefined}>
                  <td><div className="cename">{oc.id}</div><div className="elsub">{oc.fecha}</div></td>
                  <td>{oc.proveedor}</td>
                  <td>{oc.proyecto}</td>
                  <td>{oc.total.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</td>
                  <td><span className={`badge b-${oc.status === 'Aprobada' ? 'grn' : oc.status === 'Pendiente' ? 'amb' : oc.status === 'Recibida' ? 'blu' : 'neu'} ${oc.status === 'Aprobada' ? 'filled-grn' : oc.status === 'Pendiente' ? 'filled-amb' : oc.status === 'Recibida' ? 'filled-blu' : 'filled-neu'}`}><span className="bd" />{oc.status}</span></td>
                  <td className="muted">{oc.vencimiento}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="g2">
        <div className="card rise d1">
          <div className="chead">
            <div className="ctitle">{sel?.id}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {sel && STATUS_FLOW[sel.status] && <button className="btn pri" onClick={() => advance(sel.id)}>{sel.status === 'Pendiente' ? 'Aprobar' : 'Marcar recibida'}</button>}
              {sel && sel.status !== 'Cancelada' && sel.status !== 'Recibida' && <button className="btn ghost" onClick={() => cancelOC(sel.id)}><X size={13} />Cancelar</button>}
            </div>
          </div>
          <div className="cpad">
            {sel ? (<>
              <div className="elrow"><div><div className="eltxt">Proveedor</div><div className="elsub">{sel.proveedor}</div></div><div><div className="eltxt">Proyecto</div><div className="elsub">{sel.proyecto}</div></div><div><div className="eltxt">Total</div><div className="cename">{sel.total.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</div></div></div>
              <div className="elrow"><div><div className="eltxt">Estado</div><div className="elsub">{sel.status}</div></div><div><div className="eltxt">Vencimiento</div><div className="elsub">{sel.vencimiento}</div></div><div><div className="eltxt">Notas</div><div className="elsub">{sel.notas}</div></div></div>
              <div style={{ marginTop: 12 }}><div className="elsub" style={{ marginBottom: 6 }}>Items</div>{sel.items.map(i => (<div key={i.desc} className="elrow" style={{ padding: '6px 0' }}><div><div className="eltxt">{i.desc}</div><div className="elsub">{i.cantidad} × {(i.precio).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</div></div><div style={{ fontWeight: 700 }}>{(i.cantidad * i.precio).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</div></div>))}</div>
            </>) : <p className="psub" style={{ fontSize: 10, color: 'rgba(255,255,255,.30)', marginTop: 2 }}>Selecciona una OC</p>}
          </div>
        </div>
        <div className="card rise d1">
          <div className="chead"><div className="ctitle">Nueva OC</div></div>
          <div className="cpad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input className="field" placeholder="Proveedor" value={form.proveedor} onChange={e => setForm(p => ({ ...p, proveedor: e.target.value }))} />
            <input className="field" placeholder="Proyecto" value={form.proyecto} onChange={e => setForm(p => ({ ...p, proyecto: e.target.value }))} />
            <input className="field" placeholder="Monto total" type="number" value={form.total} onChange={e => setForm(p => ({ ...p, total: e.target.value }))} />
            <button className="btn dark" onClick={generateFromReqs}><Plus size={14} />Generar orden de compra</button>
          </div>
        </div>
      </div>
    </div>
  )
}
