'use client'

import React, { useState, useEffect } from 'react'
import {
  Ticket, Clock, Check, Activity, LayoutGrid, List, Plus, FileSpreadsheet,
  Sparkles, X, PenLine, Trash2,
} from '@/lib/icons'
import { useApp } from '@/lib/context/AppContext'
import { useExport } from '@/lib/hooks/use-export'
import NuevoTicketModal from '@/components/ui/NuevoTicketModal'
import TabBar from '@/components/ui/TabBar'

type TicketItem = {
  id: string
  asunto: string
  quien: string
  area: string
  prio: string
  st: string
  t: string
  ai?: boolean
}

const TICKETS_SEED: TicketItem[] = [
  { id: 'TK-1287', asunto: 'Solicitud de certificado laboral', quien: 'Juan Pérez', area: 'Personas', prio: 'Media', st: 'Abierto', t: 'hace 2 h', ai: true },
  { id: 'TK-1286', asunto: 'Error al acceder al correo corporativo', quien: 'Valentina Ruiz', area: 'TI', prio: 'Alta', st: 'En proceso', t: 'hace 4 h' },
  { id: 'TK-1285', asunto: 'Solicitud de vacaciones', quien: 'Sebastián Cano', area: 'Personas', prio: 'Baja', st: 'Abierto', t: 'hace 5 h' },
  { id: 'TK-1284', asunto: 'Ajuste en liquidación de nómina de mayo', quien: 'Andrés Mora', area: 'Nómina', prio: 'Alta', st: 'Abierto', t: 'hace 6 h', ai: true },
  { id: 'TK-1283', asunto: 'Reembolso de gastos de viaje', quien: 'Laura Jiménez', area: 'Finanzas', prio: 'Baja', st: 'En proceso', t: 'Ayer' },
  { id: 'TK-1282', asunto: 'Cambio de equipo de cómputo', quien: 'Daniel Ospina', area: 'TI', prio: 'Media', st: 'En proceso', t: 'Ayer' },
  { id: 'TK-1281', asunto: 'Revisión de contrato de proveedor', quien: 'Camila Restrepo', area: 'Legal', prio: 'Media', st: 'Abierto', t: 'Ayer', ai: true },
  { id: 'TK-1280', asunto: 'Certificado de ingresos y retenciones', quien: 'María González', area: 'Finanzas', prio: 'Media', st: 'Resuelto', t: '18 jun' },
  { id: 'TK-1279', asunto: 'Restablecer contraseña de la VPN', quien: 'Juan Pérez', area: 'TI', prio: 'Alta', st: 'Resuelto', t: '18 jun' },
  { id: 'TK-1278', asunto: 'Actualización de datos de contacto', quien: 'Valentina Ruiz', area: 'Personas', prio: 'Baja', st: 'Resuelto', t: '17 jun' },
  { id: 'TK-1277', asunto: 'Anticipo de nómina', quien: 'Andrés Mora', area: 'Nómina', prio: 'Media', st: 'Resuelto', t: '16 jun' },
  { id: 'TK-1276', asunto: 'Consulta sobre afiliación a EPS', quien: 'Sebastián Cano', area: 'Personas', prio: 'Baja', st: 'Resuelto', t: '16 jun' },
]

const AREA: Record<string, string> = { TI: '#3b82f6', 'Nómina': '#8b5cf6', Personas: '#e5484d', Finanzas: '#1f9d63', Legal: '#bf8410' }
const AREA_GRAD: Record<string, [string, string]> = {
  TI: ['#7aa2ff', '#3b82f6'], 'Nómina': ['#b298f2', '#8b5cf6'], Personas: ['#ff8a8d', '#e5484d'],
  Finanzas: ['#3ed694', '#1f9d63'], Legal: ['#f0bd5a', '#bf8410'],
}
const COLDOT: Record<string, string> = { Abierto: '#9494a0', 'En proceso': '#bf8410', Resuelto: '#1f9d63' }

const TONE: Record<string, [string, string]> = {
  red: ['#ff8a8d', '#e5484d'], grn: ['#3ed694', '#1f9d63'], amb: ['#f0bd5a', '#bf8410'],
  blu: ['#7aa2ff', '#3b82f6'], vio: ['#b298f2', '#7c5cd6'], ink: ['#a6a6b2', '#6b6b76'],
  neu: ['#a6a6b2', '#6b6b76'],
}

const tone = (st: string): string =>
  ({ Resuelto: 'grn', 'En proceso': 'amb', Abierto: 'neu' }[st] || 'neu')

const Badge = ({ st }: { st: string }) => (
  <span className={`badge b-${tone(st)}`}><span className="bd" />{st}</span>
)

const PRIO: Record<string, string> = { Alta: 'red', Media: 'amb', Baja: 'neu' }
const Prio = ({ prio }: { prio: string }) => (
  <span className={`badge b-${PRIO[prio] || 'neu'}`}><span className="bd" />{prio}</span>
)

const AV_GRADS: [string, string][] = [
  ['#7aa2ff', '#3b82f6'], ['#3ed694', '#1f9d63'], ['#f0bd5a', '#bf8410'],
  ['#b298f2', '#7c5cd6'], ['#ff8a8d', '#e5484d'], ['#5ed3d6', '#1f9098'],
  ['#f79bc4', '#db5897'], ['#8fd16a', '#4f9e2e'],
]
const avHash = (n = '') => { let h = 0; for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) | 0; return Math.abs(h) % AV_GRADS.length }
const initials = (n = '') => n.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase()
const Avatar = ({ name, size = 34 }: { name: string; size?: number }) => {
  const [c1, c2] = AV_GRADS[avHash(name)]
  return (
    <div className="av" style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(145deg,${c1},${c2})`, boxShadow: `0 4px 10px -4px ${c2}88` }}>{initials(name)}</div>
  )
}

function Stat({
  ico: Ico,
  tone: t = 'ink',
  label,
  value,
  sub,
}: {
  ico: (p: { size?: number }) => React.ReactElement
  tone?: string
  label: string
  value: string | number
  sub?: string
}) {
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

const descOf = (t: TicketItem) => `${t.quien} solicita: ${t.asunto.toLowerCase()}. Pendiente de gestión por el equipo de ${t.area}.`
const aiSugOf = (t: TicketItem) => `Clasificado automáticamente para el área de ${t.area}. Prioridad sugerida: ${t.prio}. Tiempo de respuesta estimado: 5 h.`

function TicketCard({ t, onOpen }: { t: TicketItem; onOpen: (id: string) => void }) {
  return (
    <div className="tkcard" onClick={() => onOpen(t.id)}>
      <div className="tktop">
        <span className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: AREA[t.area] }} />{t.area}
        </span>
        <Prio prio={t.prio} />
      </div>
      <div className="tkas">{t.asunto}{t.ai && <Sparkles size={13} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 2 }} />}</div>
      <div className="ceid mono" style={{ marginTop: 4 }}>{t.id}</div>
      <div className="tkmeta">
        <span className="tkwho"><Avatar name={t.quien} size={22} />{t.quien.split(' ')[0]}</span>
        <span className="tltime mono">{t.t}</span>
      </div>
    </div>
  )
}

const ATAGS = ['TI', 'Nómina', 'Personas', 'Finanzas', 'Legal']

function TicketDrawer({
  t,
  onClose,
  onStatus,
  onUpdate,
  onDelete,
}: TicketDrawerProps) {
  // Keyed remount in the wrapper below gives each ticket a fresh draft, so
  // there is no effect syncing form state and no render where the drawer
  // still shows the previously selected ticket's values.
  if (!t) return null
  return <TicketDrawerBody key={t.id} t={t} onClose={onClose} onStatus={onStatus} onUpdate={onUpdate} onDelete={onDelete} />
}

type TicketDrawerProps = {
  t: TicketItem | null
  onClose: () => void
  onStatus: (id: string, to: string) => void
  onUpdate: (id: string, patch: Partial<TicketItem>) => void
  onDelete: (id: string) => void
}

function TicketDrawerBody({
  t,
  onClose,
  onStatus,
  onUpdate,
  onDelete,
}: TicketDrawerProps & { t: TicketItem }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<{ asunto: string; area: string; prio: string }>({
    asunto: t.asunto, area: t.area, prio: t.prio,
  })
  const trans = t.st === 'Abierto' ? { label: 'Tomar ticket', to: 'En proceso' }
    : t.st === 'En proceso' ? { label: 'Marcar como resuelto', to: 'Resuelto' }
    : { label: 'Reabrir ticket', to: 'Abierto' }
  let acts: { txt: string }[] = [{ txt: `${t.quien} creó el ticket` }]
  if (t.st !== 'Abierto') acts.push({ txt: `Asignado al equipo de ${t.area}` })
  if (t.st === 'Resuelto') acts.push({ txt: 'Resuelto y cerrado' })
  acts = acts.reverse()
  const [g1, g2] = AREA_GRAD[t.area] || ['#a6a6b2', '#6b6b76']
  const save = () => { onUpdate(t.id, form); setEditing(false) }
  return (
    <>
      <div className="ovl" onClick={onClose} />
      <aside className="drawer">
        <div className="dhead tkhead">
          <div className="kglow" style={{ background: g1 }} />
          <div className="dmark" style={{ background: `linear-gradient(145deg,${g1},${g2})`, boxShadow: `0 8px 18px -8px ${g2}99` }}>
            <Ticket size={19} color="#fff" />
          </div>
          <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
            <div className="dh-t mono">{t.id}</div>
            <div className="dh-s">{t.area} · creado {t.t}</div>
          </div>
          <button className="ibtn" onClick={onClose} style={{ position: 'relative', zIndex: 1 }}><X size={18} /></button>
        </div>
        <div className="dbody">
          {editing ? (
            <>
              <div className="flabel" style={{ marginTop: 0 }}>Asunto</div>
              <input className="field" value={form.asunto} onChange={(ev) => setForm((f) => f && ({ ...f, asunto: ev.target.value }))} />
              <div className="flabel">Área</div>
              <div className="chips">{ATAGS.map((a) => <button key={a} className={`chip ${form.area === a ? 'on' : ''}`} onClick={() => setForm((f) => f && ({ ...f, area: a }))}>{a}</button>)}</div>
              <div className="flabel">Prioridad</div>
              <div className="chips">{['Alta', 'Media', 'Baja'].map((p) => <button key={p} className={`chip ${form.prio === p ? 'on' : ''}`} onClick={() => setForm((f) => f && ({ ...f, prio: p }))}>{p}</button>)}</div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-.04em' }}>{t.asunto}</div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                <Badge st={t.st} />
                <Prio prio={t.prio} />
              </div>
              <div className="treq">
                <Avatar name={t.quien} size={24} />
                <span><b>{t.quien}</b> · equipo de</span>
                <span className="treqarea">
                  <span className="areadot" style={{ background: AREA[t.area] }} />{t.area}
                </span>
              </div>

              <div className="dsect">Sugerencia IA</div>
              <div className="aibox">
                <div className="kglow" />
                <div className="aii"><Sparkles size={16} /></div>
                <div><div className="at">Acción recomendada</div><div className="ad">{aiSugOf(t)}</div></div>
              </div>

              <div className="dsect">Descripción</div>
              <p style={{ fontSize: 13.5, color: 'var(--ink2)', margin: 0, lineHeight: 1.55 }}>{descOf(t)}</p>

              <div className="dsect">Actividad</div>
              <div>
                {acts.map((a, i) => (
                  <div className={`tli ${i === acts.length - 1 ? 'last' : ''}`} key={i}>
                    <div className="tlrail"><div className={`tlnode ${i === 0 ? 'red' : ''}`} /></div>
                    <div className="tlbody"><div className="tltxt">{a.txt}</div></div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="dacts">
          {editing ? (
            <>
              <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setEditing(false)}>Cancelar</button>
              <button className="btn dark" style={{ flex: 1, justifyContent: 'center' }} onClick={save}><Check size={15} />Guardar</button>
            </>
          ) : (
            <>
              <button className="btn pri" style={{ flex: 1, justifyContent: 'center' }} onClick={() => onStatus(t.id, trans.to)}>{trans.label}</button>
              <button className="btn" onClick={() => setEditing(true)}><PenLine size={15} /></button>
              <button className="ibtn" style={{ color: 'var(--redd)', borderColor: '#f7cbcb' }} title="Eliminar ticket" onClick={() => onDelete(t.id)}><Trash2 size={17} /></button>
            </>
          )}
        </div>
      </aside>
    </>
  )
}

export default function TicketsPage() {
  const { addToast } = useApp()
  const { runExport, exporting } = useExport()
  const [items, setItems] = useState<TicketItem[]>(TICKETS_SEED)
  const [area, setArea] = useState('Todos')
  const [mode, setMode] = useState('board')
  const [sel, setSel] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const areas = ['Todos', 'TI', 'Nómina', 'Personas', 'Finanzas', 'Legal']
  const cols = ['Abierto', 'En proceso', 'Resuelto']
  const rows = items.filter((t) => area === 'Todos' || t.area === area)
  const count = (st: string) => items.filter((t) => t.st === st).length
  const setStatus = (id: string, to: string, silent?: boolean) => {
    const prev = items.find((x) => x.id === id)?.st
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, st: to } : x)))
    setSel(null)
    if (!silent && prev) addToast(`Estado actualizado: ${to}`, to === 'Resuelto' ? 'ok' : 'info', 'Deshacer', () => setStatus(id, prev, true))
  }
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [dropIdx, setDropIdx] = useState<number | null>(null)

  const onDragStart = (e: React.DragEvent, id: string) => {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
    setTimeout(() => {
      document.querySelector(`[data-tkid="${id}"]`)?.classList.add('is-dragging')
    }, 0)
  }

  const getDropIdx = (e: React.DragEvent, cardEls: Element[], col: string) => {
    const colCards = items.filter((t) => t.st === col && (area === 'Todos' || t.area === area))
    for (let i = 0; i < cardEls.length; i++) {
      const rect = cardEls[i].getBoundingClientRect()
      if (e.clientY < rect.top + rect.height / 2) return i
    }
    return colCards.length
  }

  const onColDragOver = (e: React.DragEvent, col: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(col)
    const cardEls = [...e.currentTarget.querySelectorAll('[data-tkid]')]
    setDropIdx(getDropIdx(e, cardEls, col))
  }

  const onDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(null); setDropIdx(null)
    }
  }

  const onDrop = (e: React.DragEvent, col: string) => {
    e.preventDefault()
    if (!dragId) { setDragOver(null); setDropIdx(null); return }
    const dragged = items.find((x) => x.id === dragId)
    if (!dragged) { setDragId(null); setDragOver(null); setDropIdx(null); return }

    const withoutDragged = items.filter((x) => x.id !== dragId)
    const colItems = withoutDragged.filter((x) => x.st === col)
    const otherItems = withoutDragged.filter((x) => x.st !== col)
    const insertAt = Math.min(dropIdx ?? colItems.length, colItems.length)
    const updated = { ...dragged, st: col }
    colItems.splice(insertAt, 0, updated)
    setItems([...otherItems, ...colItems])

    const prevSt = dragged.st
    if (prevSt !== col) {
      addToast(`Movido a ${col}`, col === 'Resuelto' ? 'ok' : 'info',
        'Deshacer', () => setItems((prev) => {
          const w = prev.filter((x) => x.id !== dragId)
          return [...w, { ...(prev.find((x) => x.id === dragId) || dragged), st: prevSt }]
        }))
    }

    setTimeout(() => {
      const el = document.querySelector(`[data-tkid="${dragId}"]`)
      if (el) {
        el.classList.remove('card-enter'); void (el as HTMLElement).offsetWidth
        el.classList.add('card-enter')
        el.addEventListener('animationend', () => el.classList.remove('card-enter'), { once: true })
      }
    }, 20)

    setDragId(null); setDragOver(null); setDropIdx(null)
  }

  const onDragEnd = () => {
    document.querySelectorAll('.tkcard.is-dragging').forEach((el) => el.classList.remove('is-dragging'))
    setDragId(null); setDragOver(null); setDropIdx(null)
  }
  const updateTicket = (id: string, patch: Partial<TicketItem>) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    addToast('Ticket actualizado', 'ok')
  }
  const deleteTicket = (id: string) => {
    const removed = items.find((x) => x.id === id)
    setItems((xs) => xs.filter((x) => x.id !== id))
    setSel(null)
    if (removed) addToast(`Ticket ${id} eliminado`, 'info', 'Deshacer', () => setItems((xs) => [removed, ...xs]))
  }
  const selected = items.find((t) => t.id === sel) || null
  const exportRows = () => {
    void runExport(rows.map((t) => ({ ID: t.id, Asunto: t.asunto, Área: t.area, Solicitante: t.quien, Prioridad: t.prio, Estado: t.st, Creado: t.t })), 'tickets-kigyo', 'tickets')
  }
  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat ico={Ticket} tone="amb" label="Abiertos" value={count('Abierto')} /></div>
        <div className="rise d2"><Stat ico={Clock} tone="blu" label="En proceso" value={count('En proceso')} /></div>
        <div className="rise d3"><Stat ico={Check} tone="grn" label="Resueltos" value={count('Resuelto')} /></div>
        <div className="rise d4"><Stat ico={Activity} tone="vio" label="Tiempo medio" value="5.2 h" sub="primera respuesta" /></div>
      </div>

      {/* toolbar — sin card wrapper, limpio */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
        <TabBar
          value={area}
          onChange={setArea}
          items={areas.map((a) => ({
            key: a,
            label: (
              <>
                {a !== 'Todos' && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: AREA[a], marginRight: 5, verticalAlign: 'middle' }} />}
                {a}
              </>
            ),
          }))}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <TabBar
            value={mode}
            onChange={setMode}
            items={[
              { key: 'board', label: <><LayoutGrid size={14} />Tablero</> },
              { key: 'list', label: <><List size={14} />Lista</> },
            ]}
          />
          <button className="btn pri" onClick={() => setAddOpen(true)}><Plus size={15} />Nuevo ticket</button>
          <button disabled={exporting} aria-busy={exporting} className="btn" onClick={exportRows} title="Exportar"><FileSpreadsheet size={15} /></button>
        </div>
      </div>

      {mode === 'board' ? (
        <div className="board">
          {cols.map((c) => {
            const cards = rows.filter((t) => t.st === c)
            const isOver = dragOver === c
            return (
              <div className={`col${isOver ? ' drag-over' : ''}`} key={c}
                onDragOver={(e) => onColDragOver(e, c)}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, c)}>
                <div className="colh">
                  <span className="cdot" style={{ background: COLDOT[c] }} />
                  {c}
                  <span className="cn">{cards.length}</span>
                </div>
                <div className="col-cards">
                  {/* line before first card */}
                  {isOver && dropIdx === 0 && <div className="drop-line" key="dl-0" />}
                  {cards.length === 0 && !isOver && <div className="colempty">Sin tickets</div>}
                  {cards.length === 0 && isOver && <div className="colempty" style={{ opacity: .4 }}>Soltar aquí</div>}
                  {cards.map((t, idx) => (
                    <React.Fragment key={t.id}>
                      <div data-tkid={t.id} draggable
                        onDragStart={(e) => onDragStart(e, t.id)}
                        onDragEnd={onDragEnd}>
                        <TicketCard t={t} onOpen={setSel} />
                      </div>
                      {isOver && dropIdx === idx + 1 && <div className="drop-line" key={`dl-${idx + 1}`} />}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card rise d2">
          <table className="tbl">
            <thead><tr><th>Ticket</th><th>Solicitante</th><th>Área</th><th>Prioridad</th><th>Estado</th><th>Tiempo</th></tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6}><div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>No hay tickets.</div></td></tr>
              ) : rows.map((t) => (
                <tr className="trow" key={t.id} style={{ cursor: 'pointer' }} onClick={() => setSel(t.id)}>
                  <td><div className="cename" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>{t.asunto}{t.ai && <Sparkles size={13} style={{ color: 'var(--red)' }} />}</div><div className="ceid mono">{t.id}</div></td>
                  <td className="muted">{t.quien}</td>
                  <td><span className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: AREA[t.area] }} />{t.area}</span></td>
                  <td><Prio prio={t.prio} /></td>
                  <td><Badge st={t.st} /></td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{t.t}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <TicketDrawer t={selected} onClose={() => setSel(null)} onStatus={setStatus} onUpdate={updateTicket} onDelete={deleteTicket} />
      <NuevoTicketModal open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}
