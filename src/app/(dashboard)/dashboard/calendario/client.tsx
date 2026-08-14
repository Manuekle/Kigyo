'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronLeft, ChevronRight, Plus, PenLine, Trash2, Users, X } from '@/lib/icons'
import { useApp } from '@/lib/context/AppContext'
import Select from '@/components/ui/Select'
import DatePicker from '@/components/ui/DatePicker'
import { EVENT_KINDS } from '@/lib/domain'
import LoadMore from '@/components/ui/LoadMore'
import type { CalendarioData, EventoRow } from '@/server/queries/calendario'
import { fetchMoreEventos } from '@/server/actions/calendario'
import {
  addAttendee,
  createEvento,
  deleteEvento,
  fetchAttendance,
  fetchMonth,
  removeAttendee,
  setAttendeeResponse,
  updateEvento,
  type AttendeeResponse,
  type CalendarioAttendee,
} from '@/server/mutations/calendario'

const MONTH = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' })
const MONTH_SHORT = new Intl.DateTimeFormat('es-CO', { month: 'short' })
const TIME = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' })

const KIND_TONE: Record<string, string> = {
  Entrevista: 'blu', Onboarding: 'grn', '1:1': 'vio', 'Consultoría': 'red',
  Interna: 'neu', Reclutamiento: 'amb', Confidencial: 'neu', Otro: 'neu',
}

/** Attendance response tones, for the read-only badge. */
const RESPONSE_TONE: Record<string, string> = {
  Pendiente: 'amb', Aceptada: 'grn', Rechazada: 'red',
}

/** Minutes between two instants, worded. Duration used to be typed free text. */
function duration(startsAt: string, endsAt: string): string {
  const minutes = Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000)
  if (minutes < 60) return `${minutes} min`
  const hours = minutes / 60
  return Number.isInteger(hours) ? `${hours} h` : `${hours.toFixed(1)} h`
}

/** `datetime-local` wants a local-time string with no zone suffix. */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const fromLocalInput = (value: string) => new Date(value).toISOString()

export default function CalendarioPage({ data }: { data: CalendarioData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState<CalendarioData>(data)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<EventoRow | null>(null)

  /** Expanded event id, per-event attendance, and the add row's fields. */
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [attending, setAttending] = useState<Record<string, CalendarioAttendee[] | null>>({})
  const [addRow, setAddRow] = useState<Record<string, { employeeId: string; email: string }>>({})

  // `?agendar=1` is how the topbar's "Agendar" lands here with the form
  // already open. Read straight out of the URL rather than copied into state
  // by an effect: the topbar can push that param while this page is already
  // mounted, and a `useState` initializer would only ever see it once.
  const router = useRouter()
  const params = useSearchParams()
  const wantsAdd = params.get('agendar') === '1' && state.canWrite
  const showAdd = addOpen || wantsAdd
  function closeAdd() {
    setAddOpen(false)
    // Drop the param on the way out, so Back and reload do not reopen it.
    if (wantsAdd) router.replace('/dashboard/calendario')
  }

  const monthStart = useMemo(() => new Date(state.monthStart), [state.monthStart])

  /**
   * Grid geometry for the displayed month.
   *
   * Computed rather than the fixed 35 cells the old page assumed: a month can
   * need six rows, and the leading blanks depend on which weekday the 1st
   * falls on. The week starts Monday, matching the L-M-X-J-V-S-D header.
   */
  const grid = useMemo(() => {
    const year = monthStart.getUTCFullYear()
    const month = monthStart.getUTCMonth()
    const first = new Date(year, month, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const lead = (first.getDay() + 6) % 7
    const cells: Array<number | null> = Array.from({ length: lead }, () => null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return { year, month, cells }
  }, [monthStart])

  const now = new Date()
  const isCurrentMonth =
    now.getFullYear() === grid.year && now.getMonth() === grid.month
  const today = isCurrentMonth ? now.getDate() : null

  const byDay = useMemo(() => {
    const map = new Map<number, EventoRow[]>()
    for (const e of state.eventos) {
      const d = new Date(e.startsAt)
      if (d.getFullYear() !== grid.year || d.getMonth() !== grid.month) continue
      const bucket = map.get(d.getDate())
      if (bucket) bucket.push(e)
      else map.set(d.getDate(), [e])
    }
    return map
  }, [state.eventos, grid.year, grid.month])

  /**
   * "Próximas" against the actual clock, not against a hardcoded 21st.
   *
   * The reference instant is pinned once in a lazy initializer rather than
   * read in render: `Date.now()` in a render body is impure, so the list would
   * re-derive on every unrelated re-render and an event could drop out of the
   * list mid-interaction.
   */
  const [nowMs] = useState(() => Date.now())
  const upcoming = useMemo(
    () => state.eventos
      .filter((e) => new Date(e.endsAt).getTime() >= nowMs)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, 12),
    [state.eventos, nowMs],
  )

  function goMonth(delta: number) {
    const next = new Date(Date.UTC(grid.year, grid.month + delta, 1))
    startTransition(async () => {
      const result = await fetchMonth(next.toISOString())
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
    })
  }

  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  /**
   * The rest of this month.
   *
   * Both the grid and the "próximas reuniones" list read `state.eventos`, so a
   * month busier than one page was missing days from the calendar itself, not
   * merely entries from a list.
   */
  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreEventos(state.monthStart, state.eventos.length)
      if (!result.ok) {
        setLoadMoreError(result.error)
        return
      }
      setState((prev) => {
        const seen = new Set(prev.eventos.map((e) => e.id))
        return {
          ...prev,
          eventos: [...prev.eventos, ...result.data.rows.filter((e) => !seen.has(e.id))],
          eventosTotal: result.data.total,
        }
      })
    })
  }

  function remove(e: EventoRow) {
    startTransition(async () => {
      const result = await deleteEvento(e.id, state.monthStart)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      setEditing(null)
      addToast('Reunión eliminada', 'info')
    })
  }

  /** Expand on first click, lazy-fetch attendance; collapse on the second. */
  function toggleAttendance(m: EventoRow) {
    if (expandedId === m.id) { setExpandedId(null); return }
    setExpandedId(m.id)
    if (attending[m.id] !== undefined) return
    setAttending((p) => ({ ...p, [m.id]: null }))
    startTransition(async () => {
      const result = await fetchAttendance(m.id)
      if (!result.ok) {
        addToast(result.error, 'err')
        setAttending((p) => ({ ...p, [m.id]: [] }))
        return
      }
      setAttending((p) => ({ ...p, [m.id]: result.data }))
    })
  }

  function setResponse(eventId: string, a: CalendarioAttendee, response: string) {
    startTransition(async () => {
      const result = await setAttendeeResponse(a.id, response as AttendeeResponse)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setAttending((p) => ({
        ...p,
        [eventId]: p[eventId]?.map((x) => (x.id === a.id ? { ...x, response: response as AttendeeResponse } : x)) ?? null,
      }))
    })
  }

  function addOne(eventId: string) {
    const row = addRow[eventId] ?? { employeeId: '', email: '' }
    startTransition(async () => {
      const result = await addAttendee({
        calendarEventId: eventId,
        employeeId: row.employeeId || null,
        email: row.email || null,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setAttending((p) => ({ ...p, [eventId]: result.data }))
      setAddRow((p) => ({ ...p, [eventId]: { employeeId: '', email: '' } }))
      addToast('Asistente agregado', 'ok')
    })
  }

  function removeOne(eventId: string, a: CalendarioAttendee) {
    startTransition(async () => {
      const result = await removeAttendee(a.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setAttending((p) => ({ ...p, [eventId]: result.data }))
    })
  }

  return (
    <div className="g2 calgrid">
      <div className="card cpad rise d1">
        <div className="calhead">
          {/* The arrows used to be `disabled`: the month was a string. */}
          <button className="ibtn" onClick={() => goMonth(-1)} disabled={pending} aria-label="Mes anterior"><ChevronLeft size={16} /></button>
          {/* `cap-first`, not `capitalize`: the latter title-cases every word
              and prints "Agosto De 2026". */}
          <div className="ctitle cap-first">
            {MONTH.format(new Date(grid.year, grid.month, 1))}
          </div>
          <button className="ibtn" onClick={() => goMonth(1)} disabled={pending} aria-label="Mes siguiente"><ChevronRight size={16} /></button>
        </div>
        <div className="calgridwrap">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <div className="caldow" key={d}>{d}</div>)}
          {grid.cells.map((d, i) => (
            <div key={i} className={`calcell ${d && d === today ? 'today' : ''} ${!d ? 'empty' : ''}`}>
              {d && (
                <>
                  <span className="caldnum">{d}</span>
                  <div className="caldots">
                    {(byDay.get(d) ?? []).slice(0, 4).map((m) => (
                      <span key={m.id} className={`caldot ${KIND_TONE[m.kind] ?? 'neu'}`} />
                    ))}
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
          {state.canWrite && (
            <button className="btn pri" onClick={() => setAddOpen(true)}><Plus size={14} />Agendar</button>
          )}
        </div>
        {upcoming.length === 0 ? (
          <div className="dempty">No hay reuniones próximas.</div>
        ) : upcoming.map((m) => {
          const start = new Date(m.startsAt)
          const expanded = expandedId === m.id
          const attendees = attending[m.id]
          const addValue = addRow[m.id] ?? { employeeId: '', email: '' }
          return (
            <div className="meetrow" key={m.id} style={expanded ? { flexWrap: 'wrap' } : undefined}>
              <div className={`meetdate ${KIND_TONE[m.kind] ?? 'neu'}`}>
                <div className="meetday">{start.getDate()}</div>
                <div className="meetmon">{MONTH_SHORT.format(start).replace('.', '')}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="eltxt">{m.title}</div>
                <div className="elsub">
                  {TIME.format(start)} · {duration(m.startsAt, m.endsAt)}
                  {m.location ? ` · ${m.location}` : ''}
                  {m.attendees.length > 0 ? ` · ${m.attendees.map((a) => a.fullName).join(', ')}` : ''}
                </div>
              </div>
              <span className={`badge b-${KIND_TONE[m.kind] ?? 'neu'}`}>{m.kind}</span>
              <button
                className="ibtn"
                style={{ height: 28, padding: '0 8px', gap: 5, flexShrink: 0 }}
                data-tip={expanded ? 'Ocultar asistentes' : 'Ver asistentes'}
                aria-expanded={expanded}
                onClick={() => toggleAttendance(m)}
              >
                <Users size={13} />
                <span style={{ fontSize: 11 }}>{m.attendees.length}</span>
                <ChevronDown size={13} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform .18s ease' }} />
              </button>
              {state.canWrite && (
                <>
                  <button className="ibtn" style={{ width: 28, height: 28, flexShrink: 0 }} data-tip="Editar" onClick={() => setEditing(m)} aria-label={`Editar ${m.title}`}>
                    <PenLine size={13} />
                  </button>
                  <button className="ibtn" style={{ width: 28, height: 28, flexShrink: 0 }} data-tip="Eliminar" disabled={pending} onClick={() => remove(m)} aria-label={`Eliminar ${m.title}`}>
                    <Trash2 size={13} />
                  </button>
                </>
              )}
              {expanded && (
                <div style={{ flexBasis: '100%', marginTop: 2, paddingTop: 10, borderTop: '1px solid var(--line2)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {attendees === null ? (
                    <div className="dempty">Cargando asistentes…</div>
                  ) : (attendees ?? []).length === 0 ? (
                    <div className="dempty">Sin asistentes aún.</div>
                  ) : (attendees ?? []).map((a) => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
                      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}>{a.employeeName || a.email || 'Invitado'}</span>
                      {state.canWrite ? (
                        <>
                          <Select
                            value={a.response}
                            onChange={(v) => setResponse(m.id, a, v)}
                            options={['Pendiente', 'Aceptada', 'Rechazada']}
                            style={{ width: 132 }}
                          />
                          <button className="ibtn" style={{ width: 26, height: 26, flexShrink: 0 }} data-tip="Quitar" onClick={() => removeOne(m.id, a)} aria-label={`Quitar ${a.employeeName ?? a.email ?? 'invitado'}`}>
                            <Trash2 size={13} />
                          </button>
                        </>
                      ) : (
                        <span className={`badge b-${RESPONSE_TONE[a.response] ?? 'neu'}`}>{a.response}</span>
                      )}
                    </div>
                  ))}
                  {state.canWrite && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      {state.roster.length > 0 ? (
                        <Select
                          value={addValue.employeeId}
                          onChange={(v) => setAddRow((p) => ({ ...p, [m.id]: { employeeId: v, email: '' } }))}
                          options={[{ value: '', label: 'Agregar empleado…' }, ...state.roster.map((r) => ({ value: r.employeeId, label: r.fullName }))]}
                          style={{ flex: 1 }}
                        />
                      ) : (
                        <input
                          className="field"
                          style={{ flex: 1, width: 'auto' }}
                          placeholder="Correo del invitado…"
                          value={addValue.email}
                          onChange={(e) => setAddRow((p) => ({ ...p, [m.id]: { employeeId: '', email: e.target.value } }))}
                        />
                      )}
                      <button
                        className="btn pri"
                        disabled={state.roster.length > 0 ? !addValue.employeeId : !addValue.email.trim()}
                        onClick={() => addOne(m.id)}
                      >
                        <Plus size={14} />Agregar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        <LoadMore
          loaded={state.eventos.length}
          total={state.eventosTotal}
          loading={loadingMore}
          error={loadMoreError}
          onLoadMore={loadMore}
          noun="eventos este mes"
        />
      </div>

      {showAdd && (
        <EventoModal
          title="Agendar reunión"
          busy={pending}
          onClose={closeAdd}
          onSubmit={(form) =>
            startTransition(async () => {
              const result = await createEvento({ ...form, monthIso: state.monthStart })
              if (!result.ok) { addToast(result.error, 'err'); return }
              setState(result.data)
              closeAdd()
              addToast('Reunión agendada', 'ok')
            })
          }
        />
      )}

      {editing && (
        <EventoModal
          title="Editar reunión"
          busy={pending}
          initial={editing}
          onClose={() => setEditing(null)}
          onDelete={() => remove(editing)}
          onSubmit={(form) =>
            startTransition(async () => {
              const result = await updateEvento({ ...form, id: editing.id, monthIso: state.monthStart })
              if (!result.ok) { addToast(result.error, 'err'); return }
              setState(result.data)
              setEditing(null)
              addToast('Reunión actualizada', 'ok')
            })
          }
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Modal                                                              */
/* ------------------------------------------------------------------ */
interface EventoForm {
  title: string
  kind: (typeof EVENT_KINDS)[number]
  startsAt: string
  endsAt: string
  location: string
  notes: string
}

function EventoModal({
  title, busy, initial, onClose, onSubmit, onDelete,
}: {
  title: string
  busy: boolean
  initial?: EventoRow
  onClose: () => void
  onSubmit: (form: EventoForm) => void
  onDelete?: () => void
}) {
  // Defaults to the next round hour, an hour long — the common case, and it
  // beats making somebody type a full timestamp to schedule a 1:1.
  const defaultStart = useMemo(() => {
    const d = new Date()
    d.setMinutes(0, 0, 0)
    d.setHours(d.getHours() + 1)
    return d
  }, [])

  const [form, setForm] = useState({
    title: initial?.title ?? '',
    kind: (initial?.kind ?? 'Interna') as (typeof EVENT_KINDS)[number],
    startsAt: initial ? toLocalInput(initial.startsAt) : toLocalInput(defaultStart.toISOString()),
    endsAt: initial
      ? toLocalInput(initial.endsAt)
      : toLocalInput(new Date(defaultStart.getTime() + 3_600_000).toISOString()),
    location: initial?.location ?? '',
    notes: initial?.notes ?? '',
  })

  return (
    <div className="mwrap" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead"><div className="mtitle">{title}</div><button className="ibtn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></div>
        <div className="mbody">
          <div className="flabel" style={{ marginTop: 0 }}>Título</div>
          <input className="field" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ej. Entrevista — Backend Senior" />
          <div className="flabel">Tipo</div>
          <Select value={form.kind} onChange={(v) => setForm((f) => ({ ...f, kind: v as (typeof EVENT_KINDS)[number] }))} options={[...EVENT_KINDS]} />
          <div className="fg2">
            <div>
              <div className="flabel">Inicio</div>
              <DatePicker withTime ariaLabel="Inicio" value={form.startsAt} onChange={(v) => setForm((f) => ({ ...f, startsAt: v }))} />
            </div>
            <div>
              <div className="flabel">Fin</div>
              <DatePicker withTime ariaLabel="Fin" value={form.endsAt} onChange={(v) => setForm((f) => ({ ...f, endsAt: v }))} />
            </div>
          </div>
          <div className="flabel">Lugar</div>
          <input className="field" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Ej. Sala 2 · Bogotá / Virtual" />
          <div className="flabel">Notas</div>
          <textarea className="field" rows={2} style={{ resize: 'none' }} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
        <div className="mfoot">
          {onDelete ? <button className="btn danger" onClick={onDelete} disabled={busy}>Eliminar</button> : <span />}
          <div style={{ display: 'flex', gap: 9 }}>
            <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
            <button
              className="btn dark"
              disabled={busy}
              aria-busy={busy}
              onClick={() => {
                if (!form.title.trim()) return
                onSubmit({
                  ...form,
                  title: form.title.trim(),
                  startsAt: fromLocalInput(form.startsAt),
                  endsAt: fromLocalInput(form.endsAt),
                })
              }}
            >
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
