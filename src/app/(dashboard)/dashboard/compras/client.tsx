'use client'

import { useMemo, useState } from 'react'
import {
  ShoppingCart,
  Truck,
  Check,
  Clock,
  Plus,
  Paperclip,
  RotateCcw,
  X,
} from '@/lib/icons'
import Stat from '@/components/ui/Stat'
import TabBar from '@/components/ui/TabBar'
import Select from '@/components/ui/Select'
import { useApp } from '@/lib/context/AppContext'

/* ------------------------------------------------------------------ */
interface ReqItem {
  desc: string
  cantidad: number
  unidad: string
  costoUnitario: number
}

interface ReqHistory {
  who: string
  when: string
  note: string
}

interface Requisition {
  id: string
  provider: string
  project: string
  category: 'Materiales' | 'Servicios' | 'Logística'
  status: 'Borrador' | 'Pendiente' | 'Aprobada' | 'OC generada'
  amount: number
  owner: string
  urgency: 'Alta' | 'Normal' | 'Baja'
  created: string
  due: string
  items: ReqItem[]
  history: ReqHistory[]
  attachments: string[]
}

const REQS_SEED: Requisition[] = [
  {
    id: 'REQ-212',
    provider: 'Soltek Solar',
    project: 'P-001 • Torre Sur',
    category: 'Materiales',
    status: 'Pendiente',
    amount: 8200000,
    owner: 'Camila Restrepo',
    urgency: 'Alta',
    created: '12 jun',
    due: '21 jun',
    items: [
      { desc: 'Paneles bifaciales 640 W', cantidad: 30, unidad: 'UN', costoUnitario: 220000 },
      { desc: 'Estructuras de montaje', cantidad: 1, unidad: 'KIT', costoUnitario: 3800000 },
    ],
    history: [
      { who: 'Camila', when: '09:10', note: 'Solicitud generada en estado borrador.' },
      { who: 'María', when: '15:32', note: 'Revisó y marcó como pendiente de aprobación.' },
    ],
    attachments: ['PolizaSoltek.pdf', 'Especificaciones PAN-640.pdf'],
  },
  {
    id: 'REQ-199',
    provider: 'Mecánica Total',
    project: 'P-003 • Industrias XYZ',
    category: 'Servicios',
    status: 'Aprobada',
    amount: 4200000,
    owner: 'Valentina Ruiz',
    urgency: 'Normal',
    created: '08 jun',
    due: '18 jun',
    items: [
      { desc: 'Inspección eléctrica avanzada', cantidad: 1, unidad: 'SERV', costoUnitario: 4200000 },
    ],
    history: [
      { who: 'Valentina', when: '08:40', note: 'Solicitud enviada a finanzas.' },
      { who: 'Camila', when: '10:20', note: 'Aprobada en comité de compras.' },
    ],
    attachments: ['ReporteHSEQ-xyz.pdf'],
  },
  {
    id: 'REQ-184',
    provider: 'Logística Rápida',
    project: 'P-002 • Comercial Centro',
    category: 'Logística',
    status: 'OC generada',
    amount: 12800000,
    owner: 'Daniel Ospina',
    urgency: 'Normal',
    created: '04 jun',
    due: '12 jun',
    items: [
      { desc: 'Transporte especial para paneles', cantidad: 1, unidad: 'SERV', costoUnitario: 12800000 },
    ],
    history: [
      { who: 'Daniel', when: '08:05', note: 'Solicitud derivada a logística.' },
      { who: 'Ana', when: '09:30', note: 'Orden de compra generada y enviada.' },
    ],
    attachments: ['CotizacionTransporte.pdf'],
  },
  {
    id: 'REQ-170',
    provider: 'EnerSol Services',
    project: 'P-004 • Planta Norte',
    category: 'Servicios',
    status: 'Borrador',
    amount: 5400000,
    owner: 'Sara López',
    urgency: 'Baja',
    created: '01 jun',
    due: '30 jun',
    items: [
      { desc: 'Mantenimiento preventivo bancos de baterías', cantidad: 1, unidad: 'SERV', costoUnitario: 5400000 },
    ],
    history: [{ who: 'Sara', when: '09:12', note: 'Borrador creado sin aprobar.' }],
    attachments: [],
  },
]

const STATUS_FILTERS = ['Todos', 'Borrador', 'Pendiente', 'Aprobada', 'OC generada']
const CATEGORIES: Requisition['category'][] = ['Materiales', 'Servicios', 'Logística']
const URGENCIES = ['Alta', 'Normal', 'Baja']

const STATUS_FLOW: Record<Requisition['status'], Requisition['status'] | null> = {
  Borrador: 'Pendiente',
  Pendiente: 'Aprobada',
  Aprobada: 'OC generada',
  'OC generada': null,
}

const CATALOG = [
  { name: 'Panel Solar 540 W Mono', price: 380000, stock: 60 },
  { name: 'Microinversor 3kW', price: 1850000, stock: 24 },
  { name: 'Kit Estructura Terra', price: 720000, stock: 18 },
  { name: 'Servicio instalación + puesta en marcha', price: 1250000, stock: 12 },
]

/* ------------------------------------------------------------------ */

export default function ComprasPage() {
  const { addToast } = useApp()
  const [requisitions, setRequisitions] = useState(REQS_SEED)
  const [filter, setFilter] = useState<typeof STATUS_FILTERS[number]>('Todos')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(REQS_SEED[0].id)
  const [form, setForm] = useState({
    provider: '',
    project: '',
    category: 'Materiales',
    item: '',
    quantity: 1,
    unitCost: 0,
    owner: 'Camila Restrepo',
    urgency: 'Normal',
    due: '22 jun 2026',
    attachment: '',
  })
  const [formItems, setFormItems] = useState<ReqItem[]>([])
  const [attachments, setAttachments] = useState<string[]>([])

  const filtered = useMemo(
    () => requisitions.filter((req) => {
      if (filter !== 'Todos' && req.status !== filter) return false
      if (search && !`${req.provider} ${req.project} ${req.id}`.toLowerCase().includes(search.toLowerCase())) return false
      return true
    }),
    [filter, search, requisitions]
  )

  const selected = requisitions.find((r) => r.id === selectedId) ?? filtered[0] ?? null

  const stats = useMemo(() => {
    const total = requisitions.length
    const pending = requisitions.filter((req) => req.status === 'Pendiente').length
    const approved = requisitions.filter((req) => req.status === 'Aprobada').length
    const oc = requisitions.filter((req) => req.status === 'OC generada').length
    const nav = requisitions.reduce((acc, req) => acc + req.amount, 0)
    return { total, pending, approved, oc, nav }
  }, [requisitions])

  const advanceStatus = (id: string) => {
    setRequisitions((prev) => prev.map((req) => {
      if (req.id !== id) return req
      const next = STATUS_FLOW[req.status]
      if (!next) return req
      addToast(`Estado actualizado a ${next}`, next === 'OC generada' ? 'ok' : 'info')
      const entry: ReqHistory = { who: req.owner, when: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }), note: `Estado ${next}` }
      return { ...req, status: next, history: [entry, ...req.history] }
    }))
  }

  const handleAddItem = () => {
    if (!form.item || form.quantity <= 0 || form.unitCost <= 0) {
      addToast('Completa descripción, cantidad y costo unitario.', 'warn')
      return
    }
    setFormItems((prev) => [...prev, { desc: form.item, cantidad: form.quantity, unidad: 'UN', costoUnitario: form.unitCost }])
    setForm((prev) => ({ ...prev, item: '', quantity: 1, unitCost: 0 }))
  }

  const handleAddAttachment = () => {
    if (!form.attachment.trim()) return
    setAttachments((prev) => [...prev, form.attachment.trim()])
    setForm((prev) => ({ ...prev, attachment: '' }))
  }

  const createReq = () => {
    if (!form.provider || !form.project || formItems.length === 0) {
      addToast('Completa proveedor, proyecto y agrega al menos un ítem.', 'warn')
      return
    }
    const totalAmount = formItems.reduce((acc, item) => acc + item.cantidad * item.costoUnitario, 0)
    const newReq: Requisition = {
      id: `REQ-${Math.floor(Math.random() * 900) + 200}`,
      provider: form.provider,
      project: form.project,
      category: form.category as Requisition['category'],
      status: 'Borrador',
      amount: totalAmount,
      owner: form.owner,
      urgency: form.urgency as Requisition['urgency'],
      created: new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }),
      due: form.due,
      items: formItems,
      history: [{ who: form.owner, when: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }), note: 'Solicitud creada' }],
      attachments,
    }
    setRequisitions((prev) => [newReq, ...prev])
    setSelectedId(newReq.id)
    setForm({
      provider: '',
      project: '',
      category: 'Materiales',
      item: '',
      quantity: 1,
      unitCost: 0,
      owner: 'Camila Restrepo',
      urgency: 'Normal',
      due: '22 jun 2026',
      attachment: '',
    })
    setFormItems([])
    setAttachments([])
    addToast('Requisición registrada', 'ok')
  }

  return (
    <div>
      <div className="g3" style={{ marginBottom: 18 }}>
        <Stat icon={<ShoppingCart size={16} />} tone="blu" label="Requisiciones" value={stats.total} />
        <Stat icon={<Truck size={16} />} tone="grn" label="Aprobadas" value={stats.approved} />
        <Stat icon={<Clock size={16} />} tone="amb" label="Pendientes" value={stats.pending} />
        <Stat icon={<Check size={16} />} tone="vio" label="Órdenes generadas" value={stats.oc} sub={`${Math.round((stats.oc / Math.max(1, stats.total)) * 100)}% del flujo`} />
      </div>

      <div className="card rise d1" style={{ marginBottom: 18 }}>
        <div className="chead" style={{ flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div className="ctitle">Requisiciones</div>
          </div>
          <TabBar value={filter} onChange={(status) => setFilter(status as typeof STATUS_FILTERS[number])} items={STATUS_FILTERS.map((s) => ({ key: s, label: s }))} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1, minWidth: 250 }}>
            <input className="field" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <button className="ibtn" onClick={() => setSearch('')}><X size={14} /></button>
          </div>
        </div>
        <div style={{ maxHeight: 300, overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>ID</th>
                <th>Proveedor</th>
                <th>Proyecto</th>
                <th>Categoria</th>
                <th>Monto</th>
                <th>Estado</th>
                <th>Urgencia</th>
                <th>Responsable</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req) => (
                <tr key={req.id} className="trow" onClick={() => setSelectedId(req.id)} style={req.id === selected?.id ? { background: 'var(--blus)' } : undefined}>
                  <td>
                    <div className="cename">{req.id}</div>
                    <div className="elsub">{req.created}</div>
                  </td>
                  <td>{req.provider}</td>
                  <td>
                    <div className="cename">{req.project}</div>
                    <div className="elsub">{req.category}</div>
                  </td>
                  <td>{req.category}</td>
                  <td>{req.amount.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</td>
                  <td><span className={`badge b-${req.status === 'Borrador' ? 'amb' : req.status === 'Pendiente' ? 'amb' : req.status === 'Aprobada' ? 'grn' : 'neu'} ${req.status === 'Borrador' ? 'filled-amb' : req.status === 'Pendiente' ? 'filled-amb' : req.status === 'Aprobada' ? 'filled-grn' : 'filled-neu'}`}><span className="bd" />{req.status}</span></td>
                  <td>{req.urgency}</td>
                  <td>{req.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="g2" style={{ marginBottom: 20 }}>
        <div className="card rise d1">
          <div className="chead">
            <div className="ctitle">Detalle y acciones</div>
            {selected && STATUS_FLOW[selected.status] && (
              <button className="btn pri" onClick={() => advanceStatus(selected.id)}>
                {selected.status === 'Borrador' && 'Solicitar aprobación'}
                {selected.status === 'Pendiente' && 'Autorizar compra'}
                {selected.status === 'Aprobada' && 'Generar OC'}
              </button>
            )}
          </div>
          <div className="cpad">
            {selected ? (
              <>
                <div className="elrow">
                  <div>
                    <div className="eltxt">Proveedor</div>
                    <div className="elsub">{selected.provider}</div>
                  </div>
                  <div>
                    <div className="eltxt">Proyecto</div>
                    <div className="elsub">{selected.project}</div>
                  </div>
                  <div>
                    <div className="eltxt">Monto</div>
                    <div className="cename">{selected.amount.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</div>
                  </div>
                </div>

                <div className="elrow">
                  <div>
                    <div className="eltxt">Estado</div>
                    <div className="elsub">{selected.status}</div>
                  </div>
                  <div>
                    <div className="eltxt">Urgencia</div>
                    <div className="elsub">{selected.urgency}</div>
                  </div>
                  <div>
                    <div className="eltxt">Vence</div>
                    <div className="elsub">{selected.due}</div>
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div className="elsub">Items</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                    {selected.items.map((item) => (
                      <div key={item.desc} className="elrow" style={{ padding: '6px 0' }}>
                        <div>
                          <div className="eltxt">{item.desc}</div>
                          <div className="elsub">{item.cantidad} × {item.unidad}</div>
                        </div>
                        <div style={{ fontWeight: 700 }}>{(item.cantidad * item.costoUnitario).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</div>
                      </div>
                    ))}
                  </div>
                  <div className="elrow" style={{ padding: '4px 0' }}>
                    <div className="eltxt">Documentos adjuntos</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {selected.attachments.length === 0 ? (
                        <span className="elsub">Sin adjuntos</span>
                      ) : (
                        selected.attachments.map((att) => (
                          <span key={att} className="badge filled-grn"><span className="bd" />{att}</span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div className="elsub">Historial</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                    {selected.history.map((entry) => (
                      <div key={`${entry.when}-${entry.who}`} className="elrow" style={{ padding: '6px 0' }}>
                        <div>
                          <div className="eltxt">{entry.note}</div>
                          <div className="elsub">{entry.who} · {entry.when}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="psub" style={{ fontSize: 10, color: 'rgba(255,255,255,.30)', marginTop: 2 }}>Selecciona una requisición para ver sus detalles.</p>
            )}
          </div>
        </div>

        <div className="card rise d1">
          <div className="chead">
            <div className="ctitle">Registrar requisición</div>
          </div>
          <div className="cpad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Datos generales */}
            <div className="elsub" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink3)' }}>Datos generales</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="elsub">Proveedor</label>
                <input className="field" placeholder="Nombre del proveedor" value={form.provider} onChange={(e) => setForm((prev) => ({ ...prev, provider: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="elsub">Proyecto</label>
                <input className="field" placeholder="Proyecto asociado" value={form.project} onChange={(e) => setForm((prev) => ({ ...prev, project: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="elsub">Categoría</label>
                <Select options={CATEGORIES} value={form.category} onChange={(v) => setForm((prev) => ({ ...prev, category: v as Requisition['category'] }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="elsub">Urgencia</label>
                <Select options={URGENCIES} value={form.urgency} onChange={(v) => setForm((prev) => ({ ...prev, urgency: v as Requisition['urgency'] }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="elsub">Responsable</label>
                <input className="field" placeholder="Nombre" value={form.owner} onChange={(e) => setForm((prev) => ({ ...prev, owner: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="elsub">Fecha requerida</label>
                <input className="field" placeholder="dd mes" value={form.due} onChange={(e) => setForm((prev) => ({ ...prev, due: e.target.value }))} />
              </div>
            </div>

            {/* Ítems */}
            <div className="elsub" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink3)' }}>Ítems</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 110px auto', gap: 8, alignItems: 'end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="elsub">Descripción</label>
                <input className="field" placeholder="Nombre del ítem" value={form.item} onChange={(e) => setForm((prev) => ({ ...prev, item: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="elsub">Cant</label>
                <input type="number" className="field" placeholder="0" value={form.quantity} onChange={(e) => setForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label className="elsub">Costo un.</label>
                <input type="number" className="field" placeholder="0" value={form.unitCost} onChange={(e) => setForm((prev) => ({ ...prev, unitCost: Number(e.target.value) }))} />
              </div>
              <button className="btn dark" style={{ height: 36 }} onClick={handleAddItem}><Plus size={14} />Agregar</button>
            </div>
            {formItems.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {formItems.map((item) => (
                  <div key={item.desc} className="elrow" style={{ padding: '5px 0' }}>
                    <div><div className="eltxt">{item.desc}</div><div className="elsub">{item.cantidad} × {item.unidad}</div></div>
                    <div style={{ fontWeight: 600 }}>{(item.cantidad * item.costoUnitario).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Adjuntos */}
            <div className="elsub" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink3)' }}>Adjuntos</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="field" placeholder="Nombre del archivo" value={form.attachment} onChange={(e) => setForm((prev) => ({ ...prev, attachment: e.target.value }))} />
              <button className="btn ghost" onClick={handleAddAttachment}><Paperclip size={14} />Adjuntar</button>
            </div>
            {attachments.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {attachments.map((file) => (
                  <span key={file} className="badge filled-neu"><span className="bd" />{file}</span>
                ))}
              </div>
            )}

            {/* Catálogo */}
            <div className="elsub" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--ink3)' }}>Catálogo sugerido</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 8 }}>
              {CATALOG.map((item) => (
                <div key={item.name} className="card" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{item.name}</div>
                  <div className="elsub" style={{ fontSize: 10 }}>Stock {item.stock} · {item.price.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</div>
                  <button className="btn ghost" style={{ fontSize: 10, height: 24, padding: '0 8px', marginTop: 4, alignSelf: 'flex-start' }} onClick={() => setForm((prev) => ({ ...prev, item: item.name }))}>Usar</button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              <button className="btn dark" onClick={createReq}><Plus size={14} />Registrar solicitud</button>
              <button className="btn ghost" onClick={() => addToast('Notificado a finanzas.', 'info')}><RotateCcw size={14} />Notificar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
