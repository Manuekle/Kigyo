'use client'

import React, { useMemo, useState, useTransition } from 'react'
import {
  Ticket, Clock, Check, Activity, LayoutGrid, List, Plus, FileSpreadsheet,
  X, PenLine, Trash2,
} from '@/lib/icons'
import { useApp } from '@/lib/context/AppContext'
import { useExport } from '@/lib/hooks/use-export'
import NuevoTicketModal from '@/components/ui/NuevoTicketModal'
import LoadMore from '@/components/ui/LoadMore'
import Drawer from '@/components/ui/Drawer'
import TabBar from '@/components/ui/TabBar'
import Select from '@/components/ui/Select'
import { activatable } from '@/lib/a11y'
import type { TicketsData, TicketRow } from '@/server/queries/tickets'
import { TICKET_AREAS, TICKET_PRIORITIES, TICKET_STATUSES } from '@/lib/domain'
import { createTicket, deleteTicket, moveTicket, updateTicket } from '@/server/mutations/tickets'
import { fetchMoreTickets } from '@/server/actions/tickets'

/* ------------------------------------------------------------------ */
/*  Formatting                                                         */
/* ------------------------------------------------------------------ */
const DAY = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' })

/**
 * "hace 2 h" computed from `created_at`.
 *
 * The fixture stored this as a literal string, so a ticket "opened 2 hours
 * ago" was still two hours old a week later.
 */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diff / 60_000)
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} días`
  return DAY.format(new Date(iso))
}

/** Mean hours from opened to resolved, over tickets that actually closed. */
function meanResolution(tickets: TicketRow[]): string {
  const closed = tickets.filter((t) => t.resolvedAt)
  if (closed.length === 0) return '—'
  const total = closed.reduce(
    (sum, t) => sum + (new Date(t.resolvedAt as string).getTime() - new Date(t.createdAt).getTime()),
    0,
  )
  const hours = total / closed.length / 3_600_000
  return hours < 1 ? '< 1 h' : `${hours.toFixed(1)} h`
}

/* ------------------------------------------------------------------ */
/*  Presentation                                                       */
/* ------------------------------------------------------------------ */
const AREA: Record<string, string> = {
  TI: '#3b82f6', 'Nómina': '#8b5cf6', Personas: '#e5484d', Finanzas: '#1f9d63',
  Legal: '#bf8410', Contratos: '#0ea5e9', Onboarding: '#14b8a6', Permisos: '#f97316',
  'Capacitación': '#a855f7', 'Administración': '#64748b', Beneficios: '#ec4899', Otro: '#94a3b8',
}
const AREA_GRAD: Record<string, [string, string]> = {
  TI: ['#7aa2ff', '#3b82f6'], 'Nómina': ['#b298f2', '#8b5cf6'], Personas: ['#ff8a8d', '#e5484d'],
  Finanzas: ['#3ed694', '#1f9d63'], Legal: ['#f0bd5a', '#bf8410'],
}
const COLDOT: Record<string, string> = {
  Abierto: '#9494a0', 'En proceso': '#bf8410', Resuelto: '#1f9d63', Cerrado: '#6b7280',
}

const tone = (st: string): string =>
  ({ Resuelto: 'grn', Cerrado: 'grn', 'En proceso': 'amb', Abierto: 'neu' }[st] || 'neu')

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

function Stat({ ico: Ico, tone: t = 'ink', label, value, sub }: {
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

function TicketCard({ t, onOpen }: { t: TicketRow; onOpen: (id: string) => void }) {
  return (
    <div className="tkcard" {...activatable(() => onOpen(t.id), `Abrir ticket ${t.code ?? ''}: ${t.subject}`)}>
      <div className="tktop">
        <span className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: AREA[t.area] ?? AREA.Otro }} />{t.area}
        </span>
        <Prio prio={t.priority} />
      </div>
      <div className="tkas">{t.subject}</div>
      <div className="ceid mono" style={{ marginTop: 4 }}>{t.code ?? '—'}</div>
      <div className="tkmeta">
        <span className="tkwho"><Avatar name={t.requesterName} size={22} />{t.requesterName.split(' ')[0]}</span>
        <span className="tltime mono">{relativeTime(t.createdAt)}</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Drawer                                                             */
/* ------------------------------------------------------------------ */
type DrawerProps = {
  t: TicketRow | null
  roster: TicketsData['roster']
  canWrite: boolean
  busy: boolean
  onClose: () => void
  onStatus: (t: TicketRow, to: string) => void
  onUpdate: (id: string, patch: { subject?: string; area?: string; priority?: string; assigneeId?: string | null }) => void
  onDelete: (t: TicketRow) => void
}

function TicketDrawer({ t, onClose, ...rest }: DrawerProps) {
  return (
    <Drawer value={t} onClose={onClose}>
      {/* Keyed remount gives each ticket a fresh draft, so there is no effect
          syncing form state and no render showing the previous ticket's
          values. */}
      {(ticket) => <TicketDrawerBody key={ticket.id} {...rest} t={ticket} onClose={onClose} />}
    </Drawer>
  )
}

function TicketDrawerBody({ t, roster, canWrite, busy, onClose, onStatus, onUpdate, onDelete }: DrawerProps & { t: TicketRow }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    subject: t.subject, area: t.area, priority: t.priority, assigneeId: t.assigneeId ?? '',
  })

  const trans = t.status === 'Abierto' ? { label: 'Tomar ticket', to: 'En proceso' }
    : t.status === 'En proceso' ? { label: 'Marcar como resuelto', to: 'Resuelto' }
    : { label: 'Reabrir ticket', to: 'Abierto' }

  const [g1, g2] = AREA_GRAD[t.area] ?? ['#a6a6b2', '#6b6b76']

  return (
    <>
      <div className="dhead tkhead">
        <div className="kglow" style={{ background: g1 }} />
        <div className="dmark" style={{ background: `linear-gradient(145deg,${g1},${g2})`, boxShadow: `0 8px 18px -8px ${g2}99` }}>
          <Ticket size={19} color="#fff" />
        </div>
        <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
          <div className="dh-t mono">{t.code ?? '—'}</div>
          <div className="dh-s">{t.area} · creado {relativeTime(t.createdAt)}</div>
        </div>
        <button className="ibtn" onClick={onClose} style={{ position: 'relative', zIndex: 1 }} aria-label="Cerrar"><X size={18} /></button>
      </div>
      <div className="dbody">
        {editing ? (
          <>
            <div className="flabel" style={{ marginTop: 0 }}>Asunto</div>
            <input className="field" value={form.subject} onChange={(ev) => setForm((f) => ({ ...f, subject: ev.target.value }))} />
            <div className="flabel">Área</div>
            <div className="chips">
              {TICKET_AREAS.map((a) => (
                <button key={a} className={`chip ${form.area === a ? 'on' : ''}`} onClick={() => setForm((f) => ({ ...f, area: a }))}>{a}</button>
              ))}
            </div>
            <div className="flabel">Prioridad</div>
            <div className="chips">
              {TICKET_PRIORITIES.map((p) => (
                <button key={p} className={`chip ${form.priority === p ? 'on' : ''}`} onClick={() => setForm((f) => ({ ...f, priority: p }))}>{p}</button>
              ))}
            </div>
            {roster.length > 0 && (
              <>
                <div className="flabel">Asignado a</div>
                <Select
                  value={form.assigneeId}
                  onChange={(v) => setForm((f) => ({ ...f, assigneeId: v }))}
                  placeholder="Sin asignar"
                  options={[
                    { value: '', label: 'Sin asignar' },
                    ...roster.map((r) => ({ value: r.employeeId, label: r.fullName })),
                  ]}
                />
              </>
            )}
          </>
        ) : (
          <>
            <div style={{ fontWeight: 500, fontSize: 17, letterSpacing: '-0.005em' }}>{t.subject}</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <Badge st={t.status} />
              <Prio prio={t.priority} />
            </div>
            <div className="treq">
              <Avatar name={t.requesterName} size={24} />
              <span><b>{t.requesterName}</b> · equipo de</span>
              <span className="treqarea">
                <span className="areadot" style={{ background: AREA[t.area] ?? AREA.Otro }} />{t.area}
              </span>
            </div>

            {/*
              A "Sugerencia IA" box used to sit here, printing
              "Clasificado automáticamente… Tiempo de respuesta estimado: 5 h"
              from a template string. No model ran, nothing was classified,
              and the five hours were typed into the source. Same for the
              description, which was `${quien} solicita: ${asunto}` restated.
              The ticket's own body is shown instead — and only if it has one.
            */}
            {t.body && (
              <>
                <div className="dsect">Descripción</div>
                <p style={{ fontSize: 13.5, color: 'var(--ink2)', margin: 0, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{t.body}</p>
              </>
            )}

            <div className="dsect">Detalles</div>
            <div className="elrow"><div className="eltxt">Asignado a</div><div className="elsub">{t.assigneeName ?? 'Sin asignar'}</div></div>
            <div className="elrow"><div className="eltxt">Comentarios</div><div className="elsub">{t.commentCount}</div></div>
            {t.resolvedAt && (
              <div className="elrow"><div className="eltxt">Resuelto</div><div className="elsub">{relativeTime(t.resolvedAt)}</div></div>
            )}
          </>
        )}
      </div>
      {canWrite && (
        <div className="dacts">
          {editing ? (
            <>
              <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setEditing(false)} disabled={busy}>Cancelar</button>
              <button
                className="btn dark"
                style={{ flex: 1, justifyContent: 'center' }}
                disabled={busy}
                onClick={() => {
                  onUpdate(t.id, {
                    subject: form.subject,
                    area: form.area,
                    priority: form.priority,
                    assigneeId: form.assigneeId || null,
                  })
                  setEditing(false)
                }}
              ><Check size={15} />Guardar</button>
            </>
          ) : (
            <>
              <button className="btn pri" style={{ flex: 1, justifyContent: 'center' }} disabled={busy} onClick={() => onStatus(t, trans.to)}>{trans.label}</button>
              <button className="btn" onClick={() => setEditing(true)} disabled={busy} aria-label="Editar ticket"><PenLine size={15} /></button>
              <button className="ibtn" style={{ color: 'var(--redd)', borderColor: '#f7cbcb' }} title="Eliminar ticket" disabled={busy} onClick={() => onDelete(t)}><Trash2 size={17} /></button>
            </>
          )}
        </div>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
const BOARD_COLUMNS = ['Abierto', 'En proceso', 'Resuelto'] as const

export default function TicketsPage({ data }: { data: TicketsData }) {
  const { addToast } = useApp()
  const { runExport, exporting } = useExport()
  const [pending, startTransition] = useTransition()

  // Server state. Twelve fixture tickets used to live in `useState`; a drag
  // between columns rearranged the array and a reload put it all back.
  const [items, setItems] = useState<TicketRow[]>(data.tickets)
  const [total, setTotal] = useState(data.ticketsTotal)
  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')
  const [area, setArea] = useState('Todos')
  const [mode, setMode] = useState('board')
  const [sel, setSel] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  // Only areas that actually appear, plus the standard five, so the filter is
  // not twelve tabs wide on an org that files everything under "TI".
  const areas = useMemo(() => {
    const used = new Set(items.map((t) => t.area))
    return ['Todos', ...TICKET_AREAS.filter((a) => used.has(a))]
  }, [items])

  const rows = items.filter((t) => area === 'Todos' || t.area === area)
  const count = (st: string) => items.filter((t) => t.status === st).length
  const selected = items.find((t) => t.id === sel) ?? null

  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [dropIdx, setDropIdx] = useState<number | null>(null)

  function apply(next: TicketsData, message?: string) {
    setItems(next.tickets)
    // A mutation re-reads the first page, so anything paged in is gone with it
    // — and the total it carries is the one that matches what is on screen.
    setTotal(next.ticketsTotal)
    if (message) addToast(message, 'ok')
  }

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreTickets(items.length)
      if (!result.ok) {
        setLoadMoreError(result.error)
        return
      }
      setItems((prev) => {
        const seen = new Set(prev.map((t) => t.id))
        return [...prev, ...result.data.rows.filter((t) => !seen.has(t.id))]
      })
      setTotal(result.data.total)
    })
  }

  function setStatus(t: TicketRow, to: string) {
    startTransition(async () => {
      const result = await updateTicket({ id: t.id, status: to as (typeof TICKET_STATUSES)[number] })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setSel(null)
      apply(result.data, `Estado actualizado: ${to}`)
    })
  }

  function patchTicket(id: string, patch: { subject?: string; area?: string; priority?: string; assigneeId?: string | null }) {
    startTransition(async () => {
      const result = await updateTicket({
        id,
        subject: patch.subject,
        area: patch.area as (typeof TICKET_AREAS)[number] | undefined,
        priority: patch.priority as (typeof TICKET_PRIORITIES)[number] | undefined,
        assigneeId: patch.assigneeId,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data, 'Ticket actualizado')
    })
  }

  function removeTicket(t: TicketRow) {
    if (!window.confirm(`¿Eliminar el ticket ${t.code ?? ''}? Se conservará su historial pero dejará de aparecer.`)) return
    startTransition(async () => {
      const result = await deleteTicket(t.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setSel(null)
      apply(result.data, `Ticket ${t.code ?? ''} eliminado`)
    })
  }

  /* ---- drag and drop ---- */
  const onDragStart = (e: React.DragEvent, id: string) => {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
    setTimeout(() => {
      document.querySelector(`[data-tkid="${id}"]`)?.classList.add('is-dragging')
    }, 0)
  }

  const onColDragOver = (e: React.DragEvent, col: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(col)
    const cardEls = [...e.currentTarget.querySelectorAll('[data-tkid]')]
    let idx = cardEls.length
    for (let i = 0; i < cardEls.length; i++) {
      const rect = cardEls[i].getBoundingClientRect()
      if (e.clientY < rect.top + rect.height / 2) { idx = i; break }
    }
    setDropIdx(idx)
  }

  const onDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(null); setDropIdx(null)
    }
  }

  /**
   * Fractional index between the two neighbours at the drop point.
   *
   * The board used to reorder the local array and persist nothing, so every
   * drag was undone by the next reload. Midpoints mean one row is written per
   * drop instead of renumbering the whole column.
   */
  function positionFor(col: string, insertAt: number, movingId: string): number {
    const colCards = items
      .filter((t) => t.status === col && t.id !== movingId)
      .sort((a, b) => a.boardPosition - b.boardPosition)
    const before = colCards[insertAt - 1]
    const after = colCards[insertAt]
    if (!before && !after) return 0
    if (!before) return after.boardPosition - 1
    if (!after) return before.boardPosition + 1
    return (before.boardPosition + after.boardPosition) / 2
  }

  const onDrop = (e: React.DragEvent, col: string) => {
    e.preventDefault()
    const id = dragId
    setDragId(null); setDragOver(null); setDropIdx(null)
    if (!id) return

    const dragged = items.find((x) => x.id === id)
    if (!dragged) return

    const insertAt = dropIdx ?? items.filter((t) => t.status === col).length
    const boardPosition = positionFor(col, insertAt, id)

    // Optimistic: the card lands where it was dropped and the write follows.
    // React rolls it back by replacing the list if the server refuses.
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, status: col, boardPosition } : t)))

    startTransition(async () => {
      const result = await moveTicket({
        id,
        status: col as (typeof TICKET_STATUSES)[number],
        boardPosition,
      })
      if (!result.ok) { addToast(result.error, 'err'); setItems(data.tickets); return }
      setItems(result.data.tickets)
      if (dragged.status !== col) addToast(`Movido a ${col}`, col === 'Resuelto' ? 'ok' : 'info')
    })
  }

  const onDragEnd = () => {
    document.querySelectorAll('.tkcard.is-dragging').forEach((el) => el.classList.remove('is-dragging'))
    setDragId(null); setDragOver(null); setDropIdx(null)
  }

  const exportRows = () => {
    void runExport(
      rows.map((t) => ({
        Código: t.code ?? '',
        Asunto: t.subject,
        Área: t.area,
        Solicitante: t.requesterName,
        Asignado: t.assigneeName ?? '',
        Prioridad: t.priority,
        Estado: t.status,
        Creado: new Date(t.createdAt).toISOString(),
      })),
      'tickets-kigyo',
      'tickets',
    )
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat ico={Ticket} tone="amb" label="Abiertos" value={count('Abierto')} /></div>
        <div className="rise d2"><Stat ico={Clock} tone="blu" label="En proceso" value={count('En proceso')} /></div>
        <div className="rise d3"><Stat ico={Check} tone="grn" label="Resueltos" value={count('Resuelto')} /></div>
        {/* Was a hardcoded "5.2 h". Computed from resolved_at − created_at, and
            "—" while nothing has been resolved yet. */}
        <div className="rise d4"><Stat ico={Activity} tone="vio" label="Tiempo medio" value={meanResolution(items)} sub="hasta resolver" /></div>
      </div>

      <div className="ptools">
        <TabBar
          value={area}
          onChange={setArea}
          items={areas.map((a) => ({
            key: a,
            label: (
              <>
                {a !== 'Todos' && <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: AREA[a] ?? AREA.Otro, marginRight: 5, verticalAlign: 'middle' }} />}
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
          {data.canWrite && (
            <button className="btn pri" onClick={() => setAddOpen(true)}><Plus size={15} />Nuevo ticket</button>
          )}
          <button disabled={exporting} aria-busy={exporting} className="btn" onClick={exportRows} title="Exportar"><FileSpreadsheet size={15} /></button>
        </div>
      </div>

      {mode === 'board' ? (
        <div className="board">
          {BOARD_COLUMNS.map((c) => {
            const cards = rows
              .filter((t) => t.status === c)
              .sort((a, b) => a.boardPosition - b.boardPosition)
            const isOver = dragOver === c
            return (
              <div className={`col${isOver ? ' drag-over' : ''}`} key={c}
                onDragOver={(e) => data.canWrite && onColDragOver(e, c)}
                onDragLeave={onDragLeave}
                onDrop={(e) => data.canWrite && onDrop(e, c)}>
                <div className="colh">
                  <span className="cdot" style={{ background: COLDOT[c] }} />
                  {c}
                  <span className="cn">{cards.length}</span>
                </div>
                <div className="col-cards">
                  {isOver && dropIdx === 0 && <div className="drop-line" key="dl-0" />}
                  {cards.length === 0 && !isOver && <div className="colempty">Sin tickets</div>}
                  {cards.length === 0 && isOver && <div className="colempty" style={{ opacity: .4 }}>Soltar aquí</div>}
                  {cards.map((t, idx) => (
                    <React.Fragment key={t.id}>
                      <div data-tkid={t.id} draggable={data.canWrite}
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
          <div className="tblwrap">
            <table className="tbl">
              <thead><tr><th scope="col">Ticket</th><th scope="col">Solicitante</th><th scope="col">Área</th><th scope="col">Prioridad</th><th scope="col">Estado</th><th scope="col">Tiempo</th></tr></thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={6}><div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                    {items.length === 0
                      ? (data.canWrite ? 'Todavía no hay tickets. Crea el primero.' : 'Todavía no hay tickets.')
                      : 'No hay tickets en esta área.'}
                  </div></td></tr>
                ) : rows.map((t) => (
                  <tr className="trow" key={t.id} style={{ cursor: 'pointer' }} {...activatable(() => setSel(t.id), `Abrir ticket ${t.code ?? ''}: ${t.subject}`)}>
                    <td><div className="cename">{t.subject}</div><div className="ceid mono">{t.code ?? '—'}</div></td>
                    <td className="muted">{t.requesterName}</td>
                    <td><span className="tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: AREA[t.area] ?? AREA.Otro }} />{t.area}</span></td>
                    <td><Prio prio={t.priority} /></td>
                    <td><Badge st={t.status} /></td>
                    <td className="muted mono" style={{ fontSize: 12 }}>{relativeTime(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Outside the board/list switch: both views render the same page of
          tickets, and both stop at the same place. */}
      <LoadMore
        loaded={items.length}
        total={total}
        loading={loadingMore}
        error={loadMoreError}
        onLoadMore={loadMore}
        noun="tickets"
      />

      <TicketDrawer
        t={selected}
        roster={data.roster}
        canWrite={data.canWrite}
        busy={pending}
        onClose={() => setSel(null)}
        onStatus={setStatus}
        onUpdate={patchTicket}
        onDelete={removeTicket}
      />

      {data.canWrite && (
        <NuevoTicketModal
          open={addOpen}
          busy={pending}
          areas={[...TICKET_AREAS]}
          roster={data.roster}
          onClose={() => setAddOpen(false)}
          onCreate={(form) =>
            startTransition(async () => {
              const result = await createTicket({
                subject: form.subject,
                body: form.body,
                area: form.area as (typeof TICKET_AREAS)[number],
                priority: form.priority as (typeof TICKET_PRIORITIES)[number],
                assigneeId: form.assigneeId,
              })
              if (!result.ok) { addToast(result.error, 'err'); return }
              setAddOpen(false)
              apply(result.data, 'Ticket creado')
            })
          }
        />
      )}
    </>
  )
}
