'use client'

import { useMemo, useState, useTransition } from 'react'
import { MessageSquare, Clock, Check, Calendar, Plus, CalendarClock, X } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Stat from '@/components/ui/Stat'
import Select from '@/components/ui/Select'
import DatePicker from '@/components/ui/DatePicker'
import { useApp } from '@/lib/context/AppContext'
import { CONSULTATION_CATEGORIES } from '@/lib/domain'
import LoadMore from '@/components/ui/LoadMore'
import type { ConsultoriaData, ConsultaRow } from '@/server/queries/consultoria'
import { fetchMoreConsultas } from '@/server/actions/consultoria'
import { createConsulta, scheduleSesion, setConsultaStatus } from '@/server/mutations/consultoria'

const DATE = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' })
const DATETIME = new Intl.DateTimeFormat('es-CO', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
})

const DURATIONS = [
  { value: '30', label: '30 min' },
  { value: '60', label: '1 h' },
  { value: '90', label: '1 h 30 min' },
  { value: '120', label: '2 h' },
]

/** `datetime-local` wants a local-time string with no zone suffix. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function ConsultoriaPage({ data }: { data: ConsultoriaData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState<ConsultoriaData>(data)
  const [addOpen, setAddOpen] = useState(false)
  const [schedOpen, setSchedOpen] = useState(false)
  const [form, setForm] = useState({ topic: '', requesterId: '', category: 'Otro', advisor: '' })

  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const { consultas, sesiones, roster } = state

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreConsultas(consultas.length)
      if (!result.ok) {
        setLoadMoreError(result.error)
        return
      }
      setState((prev) => {
        const seen = new Set(prev.consultas.map((c) => c.id))
        return {
          ...prev,
          consultas: [...prev.consultas, ...result.data.rows.filter((c) => !seen.has(c.id))],
          consultasTotal: result.data.total,
        }
      })
    })
  }

  const stats = useMemo(() => ({
    pendientes: consultas.filter((c) => c.status === 'Agendada' || c.status === 'En curso').length,
    resueltas: consultas.filter((c) => c.status === 'Resuelta').length,
  }), [consultas])

  function advance(c: ConsultaRow) {
    const next = c.status === 'Agendada' ? 'En curso' : 'Resuelta'
    startTransition(async () => {
      const result = await setConsultaStatus({ id: c.id, status: next })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast(`Consulta ${next === 'Resuelta' ? 'resuelta' : 'iniciada'}`, 'ok')
    })
  }

  function submit() {
    if (!form.topic.trim()) { addToast('Describe el tema de la consulta', 'err'); return }
    startTransition(async () => {
      const result = await createConsulta({
        topic: form.topic.trim(),
        requesterId: form.requesterId || null,
        category: form.category as (typeof CONSULTATION_CATEGORIES)[number],
        advisor: form.advisor.trim(),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      setAddOpen(false)
      setForm({ topic: '', requesterId: '', category: 'Otro', advisor: '' })
      addToast('Consulta registrada', 'ok')
    })
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat icon={<MessageSquare size={16} />} tone="blu" label="Consultas totales" value={state.consultasTotal} /></div>
        <div className="rise d2"><Stat icon={<Clock size={16} />} tone="amb" label="Pendientes / En curso" value={stats.pendientes} /></div>
        <div className="rise d3"><Stat icon={<Check size={16} />} tone="grn" label="Resueltas" value={stats.resueltas} /></div>
        <div className="rise d4"><Stat icon={<Calendar size={16} />} tone="vio" label="Sesiones agendadas" value={sesiones.length} /></div>
      </div>

      <div className="g2">
        <div className="card rise d1">
          <div className="chead">
            <div className="ctitle">Solicitudes de consultoría</div>
            {state.canWrite && (
              <button className="btn pri" onClick={() => setAddOpen(true)}><Plus size={15} />Nueva consulta</button>
            )}
          </div>
          <div className="tblwrap">
            <table className="tbl">
              <thead><tr><th scope="col">Tema</th><th scope="col">Solicitante</th><th scope="col">Estado</th><th scope="col"></th></tr></thead>
              <tbody>
                {consultas.length === 0 ? (
                  <tr><td colSpan={4}><div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                    Todavía no hay consultas registradas.
                  </div></td></tr>
                ) : consultas.map((c) => (
                  <tr className="trow" key={c.id}>
                    <td>
                      <div className="cename">{c.topic}</div>
                      <div className="ceid mono">
                        {c.code ?? '—'} · {DATE.format(new Date(c.createdAt))} · {c.category}
                      </div>
                    </td>
                    <td className="muted">{c.requesterName ?? '—'}</td>
                    <td><Badge st={c.status} /></td>
                    <td style={{ textAlign: 'right' }}>
                      {state.canWrite && c.status !== 'Resuelta' && c.status !== 'Cancelada' && (
                        <button className="btn" disabled={pending} onClick={() => advance(c)}>
                          {c.status === 'Agendada' ? 'Iniciar' : 'Resolver'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <LoadMore
            loaded={consultas.length}
            total={state.consultasTotal}
            loading={loadingMore}
            error={loadMoreError}
            onLoadMore={loadMore}
            noun="consultas"
          />
        </div>

        <div className="card cpad rise d2" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="ctitle">Sesiones de asesoría</div>
          </div>
          <p style={{ color: 'var(--ink2)', fontSize: 13.5, margin: 0, lineHeight: 1.55 }}>
            Las sesiones que agendes aquí se crean como eventos de tipo Consultoría en el
            calendario de la organización.
          </p>

          {/*
            "Tiempo de respuesta: 24 h hábiles" and "Consultas este mes" used to
            sit here. The first was an SLA nobody had committed to and nothing
            measured; the second counted the whole fixture regardless of month.
          */}

          {sesiones.length === 0 ? (
            <div className="dempty" style={{ padding: '12px 0' }}>No hay sesiones próximas.</div>
          ) : (
            <>
              <div className="dsect" style={{ margin: 0 }}>Próximas sesiones</div>
              {sesiones.slice(0, 4).map((s) => (
                <div className="elrow" key={s.id}>
                  <div style={{ minWidth: 0 }}>
                    <div className="eltxt">{s.title}</div>
                    <div className="elsub">
                      {DATETIME.format(new Date(s.startsAt))}
                      {s.location ? ` · ${s.location}` : ''}
                    </div>
                  </div>
                  <Badge st="Agendada" />
                </div>
              ))}
            </>
          )}

          {state.canWrite && (
            state.canSchedule ? (
              <button className="btn pri" style={{ justifyContent: 'center', marginTop: 'auto' }} onClick={() => setSchedOpen(true)}>
                <CalendarClock size={15} />Agendar sesión
              </button>
            ) : (
              // The button is gone rather than disabled-with-a-tooltip: the
              // reason is org-wide configuration, not something the person can
              // fix by trying again.
              <p className="psub" style={{ marginTop: 'auto' }}>
                Para agendar sesiones necesitas el módulo Calendario activo y permiso para
                gestionarlo.
              </p>
            )
          )}
        </div>
      </div>

      {addOpen && (
        <div className="mwrap" onClick={() => setAddOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">Nueva consulta</div><button className="ibtn" onClick={() => setAddOpen(false)} aria-label="Cerrar"><X size={18} /></button></div>
            <div className="mbody">
              <div className="flabel" style={{ marginTop: 0 }}>Tema</div>
              <input className="field" value={form.topic} onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))} placeholder="Ej. Revisión de contrato laboral" />
              <div className="flabel">Categoría</div>
              <Select value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} options={[...CONSULTATION_CATEGORIES]} />
              {roster.length > 0 && (
                <>
                  <div className="flabel">Solicitante</div>
                  <Select
                    value={form.requesterId}
                    onChange={(v) => setForm((f) => ({ ...f, requesterId: v }))}
                    placeholder="Sin especificar"
                    options={[
                      { value: '', label: 'Sin especificar' },
                      ...roster.map((r) => ({ value: r.employeeId, label: r.fullName })),
                    ]}
                  />
                </>
              )}
              <div className="flabel">Asesor</div>
              <input className="field" value={form.advisor} onChange={(e) => setForm((f) => ({ ...f, advisor: e.target.value }))} placeholder="Ej. Asesor laboral externo" />
            </div>
            <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
              <button className="btn" onClick={() => setAddOpen(false)} disabled={pending}>Cancelar</button>
              <button className="btn dark" onClick={submit} disabled={pending} aria-busy={pending}>
                {pending ? 'Registrando…' : 'Registrar'}
              </button>
            </div></div>
          </div>
        </div>
      )}

      {schedOpen && (
        <SesionModal
          busy={pending}
          consultas={consultas.filter((c) => c.status !== 'Resuelta' && c.status !== 'Cancelada')}
          onClose={() => setSchedOpen(false)}
          onSubmit={(payload) =>
            startTransition(async () => {
              const result = await scheduleSesion(payload)
              if (!result.ok) { addToast(result.error, 'err'); return }
              setState(result.data)
              setSchedOpen(false)
              addToast('Sesión agendada en el calendario', 'ok')
            })
          }
        />
      )}
    </>
  )
}

function SesionModal({
  busy, consultas, onClose, onSubmit,
}: {
  busy: boolean
  consultas: ConsultaRow[]
  onClose: () => void
  onSubmit: (payload: {
    title: string; startsAt: string; minutes: number; advisor: string; consultationId: string | null
  }) => void
}) {
  // Next round hour, an hour long — the common case for a booked session.
  const [defaultStart] = useState(() => {
    const d = new Date()
    d.setMinutes(0, 0, 0)
    d.setHours(d.getHours() + 1)
    return d
  })

  const [form, setForm] = useState({
    title: 'Sesión de consultoría',
    startsAt: toLocalInput(defaultStart),
    minutes: '60',
    advisor: '',
    consultationId: '',
  })

  return (
    <div className="mwrap" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead"><div className="mtitle">Agendar sesión</div><button className="ibtn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></div>
        <div className="mbody">
          <div className="flabel" style={{ marginTop: 0 }}>Título de la sesión</div>
          <input className="field" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          {consultas.length > 0 && (
            <>
              <div className="flabel">Consulta relacionada</div>
              <Select
                value={form.consultationId}
                onChange={(v) => setForm((f) => ({ ...f, consultationId: v }))}
                placeholder="Ninguna"
                options={[
                  { value: '', label: 'Ninguna' },
                  ...consultas.map((c) => ({ value: c.id, label: c.topic })),
                ]}
              />
            </>
          )}
          <div className="fg2">
            <div>
              <div className="flabel">Inicio</div>
              <DatePicker withTime ariaLabel="Inicio" value={form.startsAt} onChange={(v) => setForm((f) => ({ ...f, startsAt: v }))} />
            </div>
            <div>
              <div className="flabel">Duración</div>
              <Select value={form.minutes} onChange={(v) => setForm((f) => ({ ...f, minutes: v }))} options={DURATIONS} />
            </div>
          </div>
          <div className="flabel">Asesor</div>
          <input className="field" value={form.advisor} onChange={(e) => setForm((f) => ({ ...f, advisor: e.target.value }))} placeholder="Ej. Asesor laboral externo" />
        </div>
        <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
          <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
          <button
            className="btn dark"
            disabled={busy || !form.title.trim()}
            aria-busy={busy}
            onClick={() => onSubmit({
              title: form.title.trim(),
              startsAt: new Date(form.startsAt).toISOString(),
              minutes: Number(form.minutes),
              advisor: form.advisor.trim(),
              consultationId: form.consultationId || null,
            })}
          >
            <CalendarClock size={14} />{busy ? 'Agendando…' : 'Agendar'}
          </button>
        </div></div>
      </div>
    </div>
  )
}
