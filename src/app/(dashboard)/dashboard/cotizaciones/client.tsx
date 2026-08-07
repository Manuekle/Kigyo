'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Receipt, Send, Check, TrendingUp, Calendar, PenLine, Plus, MoreHorizontal,
} from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Stat from '@/components/ui/Stat'
import TabBar from '@/components/ui/TabBar'
import Select from '@/components/ui/Select'
import { cop, tone } from '@/lib/utils'
import { useApp } from '@/lib/context/AppContext'

/* ------------------------------------------------------------------ */
interface ItemCotizacion {
  desc: string
  cantidad: number
  precioUnitario: number
}

interface CotizacionItem {
  id: string
  cliente: string
  proyecto: string
  monto: number
  estado: 'Borrador' | 'Enviada' | 'Aceptada' | 'Rechazado'
  fecha: string
  vencimiento: string
  responsable: string
  tipo: string
  probabilidad: number
  contacto: string
  notas: string
  items: ItemCotizacion[]
}

const COTIZACIONES_SEED: CotizacionItem[] = [
  {
    id: 'C-102',
    cliente: 'Hotel Aurora',
    proyecto: 'Sistema solar 120 kWp · Torre Sur',
    monto: 225000000,
    estado: 'Enviada',
    fecha: '09 jun 2026',
    vencimiento: '02 jul 2026',
    responsable: 'Camila Restrepo',
    tipo: 'Comercial',
    probabilidad: 75,
    contacto: 'andres.bravo@hotel.com · +57 312 555 0444',
    notas: 'Incluye monitoreo 24/7 y mantenimiento preventivo por 2 años.',
    items: [
      { desc: 'Paneles 540 W + microinversores', cantidad: 44, precioUnitario: 3750000 },
      { desc: 'Inversores centrales 150 kW', cantidad: 2, precioUnitario: 32000000 },
      { desc: 'Estructuras de montaje y cableado', cantidad: 1, precioUnitario: 18500000 },
    ],
  },
  {
    id: 'C-118',
    cliente: 'Finca El Bosque',
    proyecto: 'Autoconsumo rural 65 kWp',
    monto: 86000000,
    estado: 'Borrador',
    fecha: '12 jun 2026',
    vencimiento: '30 jun 2026',
    responsable: 'Valentina Ruiz',
    tipo: 'Rural',
    probabilidad: 60,
    contacto: 'nicolas.rios@finca.com',
    notas: 'Pendiente confirmación de conexión de Codensa y actualización del contrato de arrendamiento.',
    items: [
      { desc: 'Paneles 450 W monofaciales', cantidad: 120, precioUnitario: 455000 },
      { desc: 'Inversores string 8 kW', cantidad: 4, precioUnitario: 9500000 },
      { desc: 'Baterías elektro 50 kWh', cantidad: 1, precioUnitario: 28300000 },
    ],
  },
  {
    id: 'C-095',
    cliente: 'Fábrica Neumex',
    proyecto: 'Expansión planta de procesos',
    monto: 410000000,
    estado: 'Aceptada',
    fecha: '01 jun 2026',
    vencimiento: '15 jun 2026',
    responsable: 'Juan Pérez',
    tipo: 'Industrial',
    probabilidad: 90,
    contacto: 'operaciones@neumex.com',
    notas: 'Aprobada en comité de inversiones. Coordinar entrega de OC para el 20 de junio.',
    items: [
      { desc: 'Paneles 640 W bifaciales', cantidad: 128, precioUnitario: 4700000 },
      { desc: 'Inversores centrales 250 kW', cantidad: 2, precioUnitario: 41000000 },
      { desc: 'Sistema de monitoreo SCADA', cantidad: 1, precioUnitario: 11500000 },
    ],
  },
  {
    id: 'C-089',
    cliente: 'Centro Comercial Oasis',
    proyecto: 'Techos solares 200 kWp',
    monto: 367000000,
    estado: 'Rechazado',
    fecha: '21 may 2026',
    vencimiento: '05 jun 2026',
    responsable: 'Camila Restrepo',
    tipo: 'Comercial',
    probabilidad: 20,
    contacto: 'gerenciaoasis@oasis.com',
    notas: 'Cliente solicitó cotización con condiciones de pago más flexibles; volver a negociar con microfinanciación.',
    items: [
      { desc: 'Paneles 530 W monocristalinos', cantidad: 160, precioUnitario: 3600000 },
      { desc: 'Estructura metálica y anclajes', cantidad: 1, precioUnitario: 95000000 },
      { desc: 'Instalación y puesta en marcha', cantidad: 1, precioUnitario: 75000000 },
    ],
  },
]

const STATUS_FILTERS = ['Todos', 'Borrador', 'Enviada', 'Aceptada', 'Rechazado']

const HISTORY: Record<string, string[]> = {
  Borrador: ['Definición de alcance y revisión interna', 'Se compartió plan técnico con liderazgo'],
  Enviada: ['Documento enviado al cliente', 'Follow-up vía WhatsApp y programada demo', 'Recordatorio automático 3 días antes'],
  Aceptada: ['Cliente devolvió aceptación firmada', 'Equipo de operaciones coordina entrega del contrato'],
  Rechazado: ['Cliente rechazó por condiciones de financiamiento', 'Se agendó llamada de renegociación'],
}

/* ------------------------------------------------------------------ */

export default function CotizacionesPage() {
  const { addToast } = useApp()
  const [quotes, setQuotes] = useState(COTIZACIONES_SEED)
  const [filter, setFilter] = useState('Todos')
  const [selected, setSelected] = useState(COTIZACIONES_SEED[0]?.id ?? null)
  const [form, setForm] = useState({
    cliente: '',
    proyecto: '',
    monto: '',
    vencimiento: '15 jul 2026',
    responsable: 'Camila Restrepo',
    tipo: 'Comercial',
    contacto: '',
    notas: '',
    probabilidad: 65,
  })
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null)
  const menuRef = useRef<HTMLButtonElement>(null)

  const placeMenu = () => {
    const r = menuRef.current?.getBoundingClientRect()
    if (!r) return
    const h = 140
    const below = window.innerHeight - r.bottom
    const top = below < h + 12 && r.top > h ? r.top - h - 6 : r.bottom + 6
    setMenuPos({ top, left: r.right - 180 })
  }

  useLayoutEffect(() => {
    if (menuOpen) placeMenu()
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    window.addEventListener('scroll', placeMenu, true)
    window.addEventListener('resize', placeMenu)
    return () => {
      window.removeEventListener('scroll', placeMenu, true)
      window.removeEventListener('resize', placeMenu)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const menuWasOpen = useRef(false)
  useEffect(() => {
    if (!menuOpen && menuWasOpen.current) menuRef.current?.focus()
    menuWasOpen.current = menuOpen
  }, [menuOpen])

  const filtered = useMemo(() => {
    if (filter === 'Todos') return quotes
    return quotes.filter((q) => q.estado === filter)
  }, [quotes, filter])

  // Derived, not synchronised. Clamping the selection in an effect meant an
  // extra render pass on every filter change, and one frame where the detail
  // pane still showed a quote the list no longer contained.
  const effectiveSelected = filtered.some((q) => q.id === selected)
    ? selected
    : (filtered[0]?.id ?? null)

  const current = quotes.find((q) => q.id === effectiveSelected) ?? filtered[0] ?? null

  const stats = useMemo(() => {
    const aceptadas = quotes.filter((q) => q.estado === 'Aceptada').length
    const enviadas = quotes.filter((q) => q.estado === 'Enviada').length
    const pipelineQuotes = quotes.filter((q) => q.estado !== 'Rechazado')
    const pipelineTotal = pipelineQuotes.reduce((acc, q) => acc + q.monto, 0)
    const tasa = Math.round((aceptadas / Math.max(1, pipelineQuotes.length)) * 100)
    return { total: quotes.length, enviadas, aceptadas, pipelineTotal, tasa }
  }, [quotes])

  const handleStatus = (id: string, estado: CotizacionItem['estado'], msg: string) => {
    setQuotes((prev) => prev.map((q) => (q.id === id ? { ...q, estado } : q)))
    setSelected(id)
    addToast(msg, estado === 'Aceptada' ? 'ok' : 'info')
  }

  const duplicateQuote = (quote: CotizacionItem) => {
    const nextId = `C-${Math.floor(Math.random() * 900) + 100}`
    const copy: CotizacionItem = {
      ...quote,
      id: nextId,
      estado: 'Borrador',
      fecha: 'Hoy',
      vencimiento: '08 jul 2026',
    }
    setQuotes((prev) => [...prev, copy])
    setSelected(nextId)
    addToast('Cotización duplicada en borrador', 'ok')
  }

  const createQuote = (estado: CotizacionItem['estado']) => {
    if (!form.cliente.trim() || !form.proyecto.trim() || Number(form.monto) <= 0) {
      addToast('Completa cliente, proyecto y monto', 'warn')
      return
    }
    const id = `C-${Math.floor(Math.random() * 900) + 100}`
    const nuevo: CotizacionItem = {
      id,
      cliente: form.cliente,
      proyecto: form.proyecto,
      monto: Number(form.monto),
      estado,
      fecha: 'Hoy',
      vencimiento: form.vencimiento,
      responsable: form.responsable,
      tipo: form.tipo,
      probabilidad: form.probabilidad,
      contacto: form.contacto || 'Contacto pendiente',
      notas: form.notas || 'Pendiente completar detalles.',
      items: [
        { desc: 'Propuesta base', cantidad: 1, precioUnitario: Number(form.monto) },
      ],
    }
    setQuotes((prev) => [...prev, nuevo])
    setForm({
      cliente: '',
      proyecto: '',
      monto: '',
      vencimiento: '15 jul 2026',
      responsable: 'Camila Restrepo',
      tipo: 'Comercial',
      contacto: '',
      notas: '',
      probabilidad: 65,
    })
    setSelected(id)
    addToast(`Cotización ${estado === 'Enviada' ? 'enviada' : 'guardada'} en ${estado}`, estado === 'Enviada' ? 'ok' : 'info')
  }

  const handleInput = (field: keyof typeof form, value: string | number) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div>
      <div className="gkpi">
        <Stat icon={<Receipt size={16} />} tone="blu" label="Cotizaciones activas" value={stats.total} />
        <Stat icon={<Send size={16} />} tone="grn" label="Enviadas" value={stats.enviadas} />
        <Stat icon={<Check size={16} />} tone="vio" label="Aceptadas" value={stats.aceptadas} />
        <Stat icon={<TrendingUp size={16} />} tone="amb" label="Pipeline potencial" value={cop(stats.pipelineTotal)} sub={`Tasa de cierre ${stats.tasa}%`} />
      </div>

      <div className="card rise d1" style={{ marginBottom: 18 }}>
        <div className="chead">
          <TabBar
            value={filter}
            onChange={setFilter}
            items={STATUS_FILTERS.map((s) => ({ key: s, label: s }))}
          />
          <button
            ref={menuRef}
            className="btn ghost"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreHorizontal size={14} />Acciones
          </button>
          {menuOpen && menuPos && createPortal(
            <>
              <div className="nselect-catch" onClick={() => setMenuOpen(false)} />
              <div className="nselect-menu" role="menu" aria-label="Acciones de cotizaciones" style={{ top: menuPos.top, left: menuPos.left, width: 180 }}>
                <button className="nselect-item action" role="menuitem" onClick={() => { setMenuOpen(false); duplicateQuote(current ?? COTIZACIONES_SEED[0]) }}><PenLine size={14} />Duplicar</button>
                <button className="nselect-item action" role="menuitem" onClick={() => { setMenuOpen(false); createQuote('Borrador') }}><Plus size={14} />Nueva cotización</button>
                <button className="nselect-item action" role="menuitem" onClick={() => { setMenuOpen(false); addToast('Tabla exportada a PDF', 'ok') }}><Calendar size={14} />Exportar</button>
              </div>
            </>,
            document.body,
          )}
        </div>
        <div style={{ maxHeight: 280, overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {filtered.length === 0 ? (
            <div className="dempty">No hay cotizaciones en esta categoría todavía.</div>
          ) : (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Referencia</th>
                  <th>Cliente · Proyecto</th>
                  <th>Tipo</th>
                  <th>Monto</th>
                  <th>Responsable</th>
                  <th>Estado</th>
                  <th>Vencimiento</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((quote) => (
                  <tr
                    key={quote.id}
                    className="trow"
                    onClick={() => setSelected(quote.id)}
                    style={quote.id === current?.id ? { background: 'var(--blus)' } : undefined}
                  >
                    <td>
                      <div className="cename">{quote.id}</div>
                      <div className="elsub">{quote.fecha}</div>
                    </td>
                    <td>
                      <div className="cename">{quote.cliente}</div>
                      <div className="elsub">{quote.proyecto}</div>
                    </td>
                    <td className="muted">{quote.tipo}</td>
                    <td>{cop(quote.monto)}</td>
                    <td>{quote.responsable}</td>
                    <td><Badge st={quote.estado} filled /></td>
                    <td className="muted">{quote.vencimiento}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {quote.estado === 'Borrador' && (
                        <button className="btn pri" onClick={() => handleStatus(quote.id, 'Enviada', 'Cotización enviada al cliente')}>
                          Enviar
                        </button>
                      )}
                      {quote.estado === 'Enviada' && (
                        <div style={{ display: 'inline-flex', gap: 4 }}>
                          <button className="btn pri" onClick={() => handleStatus(quote.id, 'Aceptada', 'Cotización aceptada')}>
                            Aceptar
                          </button>
                          <button className="btn" onClick={() => handleStatus(quote.id, 'Rechazado', 'Cotización rechazada')}>
                            Rechazar
                          </button>
                        </div>
                      )}
                      {quote.estado === 'Aceptada' && (
                        <button className="btn pri" onClick={() => addToast('Orden de compra generada automáticamente.', 'ok')}>
                          Generar OC
                        </button>
                      )}
                      {quote.estado === 'Rechazado' && (
                        <button className="btn" onClick={() => duplicateQuote(quote)}>
                          Renegociar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="g2">
        <div className="card rise d1">
          <div className="chead">
            <div>
              <div className="h1">{current?.id ?? 'Selecciona una cotización'}</div>
              <p className="psub" style={{ margin: 0 }}>{current?.proyecto}</p>
            </div>
            {current && <Badge st={current.estado} filled />}
          </div>
          <div className="cpad">
            {current ? (
              <>
                <div className="elrow">
                  <div>
                    <div className="eltxt">Cliente</div>
                    <div className="elsub">{current.cliente}</div>
                  </div>
                  <div>
                    <div className="eltxt">Responsable</div>
                    <div className="elsub">{current.responsable}</div>
                  </div>
                  <div>
                    <div className="eltxt">Contacto</div>
                    <div className="elsub">{current.contacto}</div>
                  </div>
                </div>
                <div className="elrow">
                  <div>
                    <div className="eltxt">Fecha</div>
                    <div className="elsub">{current.fecha}</div>
                  </div>
                  <div>
                    <div className="eltxt">Vencimiento</div>
                    <div className="elsub">{current.vencimiento}</div>
                  </div>
                  <div>
                    <div className="eltxt">Tipo</div>
                    <div className="elsub">{current.tipo}</div>
                  </div>
                </div>

                <div className="barrow">
                  <span className="barlabel">Probabilidad</span>
                  <div className="bartrack">
                    <div className={`barfill ${tone(current.estado) === 'grn' ? 'grn' : tone(current.estado) === 'amb' ? 'amb' : 'blu'}`} style={{ width: `${current.probabilidad}%` }} />
                  </div>
                  <span className="barval">{current.probabilidad}%</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 8 }}>
                  <div>
                    <div className="elsub">Monto propuesto</div>
                    <div className="cename">{cop(current.monto)}</div>
                  </div>
                  <div>
                    <div className="elsub">Items</div>
                    <div className="cename">{current.items.length}</div>
                  </div>
                  <div>
                    <div className="elsub">Notas</div>
                    <div className="cename" style={{ whiteSpace: 'normal' }}>{current.notas}</div>
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div className="elsub" style={{ marginBottom: 6 }}>Items</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {current.items.map((item) => (
                      <div key={item.desc} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 13 }}>
                        <div style={{ minWidth: 0 }}>
                          <div className="cename" style={{ fontSize: 13 }}>{item.desc}</div>
                          <div className="muted" style={{ fontSize: 11 }}>{item.cantidad} × {cop(item.precioUnitario)}</div>
                        </div>
                        <div style={{ fontWeight: 700 }}>{cop(item.cantidad * item.precioUnitario)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div className="elsub" style={{ marginBottom: 6 }}>Historial</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {HISTORY[current.estado].map((h) => (
                      <span key={h} className="badge filled-neu" style={{ color: 'var(--ink)' }}>{h}</span>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                  {current.estado === 'Borrador' && (
                    <button className="btn pri" onClick={() => handleStatus(current.id, 'Enviada', 'Cotización enviada al cliente')}>
                      <Send size={14} />Enviar al cliente
                    </button>
                  )}
                  {current.estado === 'Enviada' && (
                    <>
                      <button className="btn pri" onClick={() => handleStatus(current.id, 'Aceptada', 'Cotización aceptada')}>Aceptar</button>
                      <button className="btn danger" onClick={() => handleStatus(current.id, 'Rechazado', 'Cotización rechazada')}>Rechazar</button>
                    </>
                  )}
                  {current.estado === 'Aceptada' && (
                    <button className="btn pri" onClick={() => addToast('Agenda bloqueada para instalación', 'ok')}>Planificar instalación</button>
                  )}
                  <button className="btn" onClick={() => duplicateQuote(current)}>Duplicar</button>
                </div>
              </>
            ) : (
              <p className="psub" style={{ fontSize: 10, color: 'rgba(255,255,255,.30)', marginTop: 2 }}>Selecciona una cotización para ver el detalle.</p>
            )}
          </div>
        </div>

        <div className="card rise d1">
          <div className="chead">
            <div className="ctitle">Captura rápida</div>
            <span className="elsub" style={{ fontSize: 10, color: 'rgba(255,255,255,.30)' }}>Todos los campos se pueden ajustar después</span>
          </div>
          <div className="cpad">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label className="elsub">Cliente</label>
              <input className="field" value={form.cliente} onChange={(e) => handleInput('cliente', e.target.value)} placeholder="Empresa o proyecto" />
              <label className="elsub">Proyecto</label>
              <input className="field" value={form.proyecto} onChange={(e) => handleInput('proyecto', e.target.value)} placeholder="Resumen corto" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label className="elsub">Monto estimado</label>
                  <input
                    type="number"
                    className="field"
                    value={form.monto}
                    onChange={(e) => handleInput('monto', e.target.value)}
                    placeholder="COP"
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label className="elsub">Vencimiento</label>
                  <input className="field" value={form.vencimiento} onChange={(e) => handleInput('vencimiento', e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label className="elsub">Tipo de proyecto</label>
                  <Select options={['Comercial','Residencial','Industrial','Rural']} value={form.tipo} onChange={(v) => handleInput('tipo', v)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label className="elsub">Responsable</label>
                  <Select options={['Camila Restrepo','Valentina Ruiz','Juan Pérez','María González','Carlos Ríos']} value={form.responsable} onChange={(v) => handleInput('responsable', v)} />
                </div>
              </div>
              <label className="elsub">Contacto</label>
              <input className="field" value={form.contacto} onChange={(e) => handleInput('contacto', e.target.value)} placeholder="Correo o WhatsApp" />
              <label className="elsub">Probabilidad de cierre ({form.probabilidad}%)</label>
              <input
                type="range"
                className="sld"
                min={20}
                max={100}
                value={form.probabilidad}
                onChange={(e) => handleInput('probabilidad', Number(e.target.value))}
              />
              <label className="elsub">Notas</label>
              <textarea
                className="field"
                rows={3}
                style={{ resize: 'none' }}
                value={form.notas}
                onChange={(e) => handleInput('notas', e.target.value)}
                placeholder="Comentarios, entregables incluidos, condiciones especiales"
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => createQuote('Borrador')}>Guardar borrador</button>
              <button className="btn pri" onClick={() => createQuote('Enviada')}><Send size={14} />Enviar inmediatamente</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
