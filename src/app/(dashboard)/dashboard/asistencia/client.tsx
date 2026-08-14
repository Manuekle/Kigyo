'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { UserMinus, AlertCircle, Calendar, Plus, Check, Trash2, X, PenLine } from '@/lib/icons'
import type { IconProps } from '@/lib/icons'
import Avatar from '@/components/ui/Avatar'
import LoadMore from '@/components/ui/LoadMore'
import Select from '@/components/ui/Select'
import DatePicker from '@/components/ui/DatePicker'
import { tone } from '@/lib/utils'
import { useApp } from '@/lib/context/AppContext'
import { ABSENCE_KINDS, ABSENCE_STATUSES, dayCount } from '@/lib/domain'
import type { AsistenciaData, AusenciaRow } from '@/server/queries/asistencia'
import {
  createAusencia, deleteAusencia, setAusenciaStatus, updateAusencia,
  fetchSalidas, registrarSalida, deleteSalida,
} from '@/server/mutations/asistencia'
import type { SalidaRow } from '@/server/mutations/asistencia'
import { fetchMoreAusencias } from '@/server/actions/asistencia'

const DAY = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
const MONTH = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' })
const fmt = (iso: string) => DAY.format(new Date(`${iso}T00:00:00`))

const SALIDA_REASONS = ['Renuncia voluntaria', 'Mutuo acuerdo', 'Vencimiento contrato', 'Terminación con justa causa', 'Otro'] as const
type SalidaReason = (typeof SALIDA_REASONS)[number]

const Badge = ({ st }: { st: string }) => (
  <span className={`badge b-${tone(st)}`}><span className="bd" />{st}</span>
)

function Stat({ ico: Ico, tone: t = 'ink', label, value, sub }: {
  ico: (p: IconProps) => React.ReactElement
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

const todayIso = () => new Date().toISOString().slice(0, 10)

export default function AsistenciaPage({ data }: { data: AsistenciaData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState<AsistenciaData>(data)
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<AusenciaRow | null>(null)
  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')
  const [salidas, setSalidas] = useState<SalidaRow[] | null>(null)
  const [salidaOpen, setSalidaOpen] = useState(false)

  const { ausencias, vacaciones, roster } = state

  /**
   * The next page of the register.
   *
   * Filtered by id on the way in: an absence registered by someone else while
   * this page was open shifts the offset window, and the row at the seam would
   * otherwise arrive twice.
   */
  function loadMoreAusencias() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreAusencias(ausencias.length)
      if (!result.ok) {
        setLoadMoreError(result.error)
        return
      }
      setState((prev) => {
        const seen = new Set(prev.ausencias.map((a) => a.id))
        return {
          ...prev,
          ausencias: [...prev.ausencias, ...result.data.rows.filter((a) => !seen.has(a.id))],
          ausenciasTotal: result.data.total,
        }
      })
    })
  }

  const stats = useMemo(() => {
    const today = todayIso()
    return {
      // "Activa" derived from the dates rather than trusted from a status that
      // nothing ever advanced: an absence whose range covers today is active.
      activas: ausencias.filter((a) => a.startsOn <= today && a.endsOn >= today && a.status !== 'Rechazada').length,
      incapacidades: ausencias.filter((a) => a.kind === 'Incapacidad').length,
      programadas: ausencias.filter((a) => a.startsOn > today).length,
      vacPendientes: vacaciones.reduce((s, v) => s + Math.max(0, v.remainingDays), 0),
    }
  }, [ausencias, vacaciones])

  /**
   * Absentee count per day of the current month, from the absences themselves.
   *
   * This used to be `HEATMAP_JUNE`, thirty-five integers typed into the source
   * — a chart of numbers nobody had entered, pinned to June 2026.
   */
  const heat = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const days = new Date(year, month + 1, 0).getDate()
    const counts = new Array<number>(days).fill(0)

    for (const a of ausencias) {
      if (a.status === 'Rechazada') continue
      for (let d = 1; d <= days; d++) {
        const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        if (a.startsOn <= iso && a.endsOn >= iso) counts[d - 1]++
      }
    }

    const first = new Date(year, month, 1)
    return { counts, days, lead: (first.getDay() + 6) % 7, label: MONTH.format(first) }
  }, [ausencias])

  function apply(next: AsistenciaData, message: string) {
    setState(next)
    addToast(message, 'ok')
  }

  function resolve(a: AusenciaRow) {
    startTransition(async () => {
      const result = await setAusenciaStatus({ id: a.id, status: 'Resuelta' })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data, 'Ausencia marcada como resuelta')
    })
  }

  function remove(a: AusenciaRow) {
    if (!window.confirm(`¿Eliminar la ausencia de ${a.employeeName}? Si eran vacaciones, los días vuelven a su saldo.`)) return
    startTransition(async () => {
      const result = await deleteAusencia(a.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data, 'Ausencia eliminada')
    })
  }

  useEffect(() => {
    startTransition(async () => {
      const result = await fetchSalidas()
      if (!result.ok) { addToast(result.error, 'err'); return }
      setSalidas(result.data)
    })
  }, [addToast, startTransition])

  function removeSalida(s: SalidaRow) {
    if (!window.confirm(`¿Eliminar la salida de ${s.fullName}?`)) return
    startTransition(async () => {
      const result = await deleteSalida(s.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setSalidas(result.data)
      addToast('Salida eliminada', 'ok')
    })
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat ico={UserMinus} tone="amb" label="Ausencias hoy" value={stats.activas} /></div>
        <div className="rise d2"><Stat ico={AlertCircle} tone="red" label="Incapacidades" value={stats.incapacidades} sub="registradas" /></div>
        {/* "Horas extra (mes)" was here with a hardcoded figure. There is no
            overtime table and no clock-in data, so there is nothing to count. */}
        <div className="rise d3"><Stat ico={Calendar} tone="blu" label="Programadas" value={stats.programadas} sub="a futuro" /></div>
        <div className="rise d4"><Stat ico={Calendar} tone="grn" label="Vacaciones pendientes" value={`${stats.vacPendientes} días`} sub={`saldo ${state.year}`} /></div>
      </div>

      <div className="g2">
        <div className="card rise d2">
          <div className="chead">
            <div className="ctitle">Registro de ausencias</div>
            {state.canWrite && (
              <button className="btn pri" onClick={() => setAddOpen(true)}><Plus size={14} />Registrar</button>
            )}
          </div>
          <div className="tblwrap">
            <table className="tbl">
              <thead><tr><th scope="col">Empleado</th><th scope="col">Tipo</th><th scope="col">Desde</th><th scope="col">Días</th><th scope="col">Estado</th><th scope="col"></th></tr></thead>
              <tbody>
                {ausencias.length === 0 ? (
                  <tr><td colSpan={6}><div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                    {state.canWrite ? 'Todavía no hay ausencias registradas.' : 'Todavía no hay ausencias registradas.'}
                  </div></td></tr>
                ) : ausencias.map((a) => (
                  <tr className="trow" key={a.id}>
                    <td><div className="cemp"><Avatar name={a.employeeName} size={26} /><div className="cename">{a.employeeName}</div></div></td>
                    <td className="muted">{a.kind}</td>
                    <td className="muted mono" style={{ fontSize: 12 }}>{fmt(a.startsOn)}</td>
                    <td className="muted">{a.days}d</td>
                    <td><Badge st={a.status} /></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {state.canWrite && (
                        <>
                          {a.status !== 'Resuelta' && a.status !== 'Finalizada' && (
                            <button className="ibtn" style={{ width: 28, height: 28 }} data-tip="Resolver" disabled={pending} onClick={() => resolve(a)} aria-label={`Resolver la ausencia de ${a.employeeName}`}>
                              <Check size={13} />
                            </button>
                          )}
                          <button className="ibtn" style={{ width: 28, height: 28 }} data-tip="Editar" onClick={() => setEditing(a)} aria-label={`Editar la ausencia de ${a.employeeName}`}>
                            <PenLine size={13} />
                          </button>
                          <button className="ibtn" style={{ width: 28, height: 28, color: 'var(--redd)' }} data-tip="Eliminar" disabled={pending} onClick={() => remove(a)} aria-label={`Eliminar la ausencia de ${a.employeeName}`}>
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <LoadMore
            loaded={ausencias.length}
            total={state.ausenciasTotal}
            loading={loadingMore}
            error={loadMoreError}
            onLoadMore={loadMoreAusencias}
            noun="ausencias"
          />
        </div>

        <div className="card cpad rise d3">
          <div className="ctitle" style={{ marginBottom: 12 }}>Vacaciones por persona · {state.year}</div>
          {vacaciones.length === 0 ? (
            <div className="dempty" style={{ padding: '18px 0' }}>
              Todavía no hay saldos de vacaciones para {state.year}. Se crean al registrar la primera ausencia de tipo Vacaciones.
            </div>
          ) : vacaciones.map((v) => (
            <div className="elrow" key={v.employeeId}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div className="eltxt">{v.employeeName}</div>
                  <div className="elsub">{Math.max(0, v.remainingDays)}d disp.</div>
                </div>
                <div className="bartrack">
                  <div
                    className="barfill grn"
                    style={{ width: `${v.entitledDays ? Math.min(100, (v.takenDays / v.entitledDays) * 100) : 0}%` }}
                  />
                </div>
                <div className="elsub" style={{ marginTop: 4 }}>{v.takenDays}/{v.entitledDays} días tomados</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card rise d4" style={{ marginTop: 16 }}>
        <div className="chead">
          {/* Only the month is transformed. `capitalize` on the whole title
              title-cased the connective too — "Ausentismo — Agosto De 2026". */}
          <div className="ctitle">Ausentismo — <span className="cap-first" style={{ display: 'inline-block' }}>{heat.label}</span></div>
        </div>
        <div className="cpad">
          <div className="heatdows">{['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <div key={d} className="heatdow">{d}</div>)}</div>
          <div className="heatgrid">
            {Array.from({ length: heat.lead }, (_, i) => <div key={`lead-${i}`} className="heatcell e" />)}
            {heat.counts.map((count, i) => {
              const level = count === 0 ? 'l0' : count === 1 ? 'l1' : count === 2 ? 'l2' : count <= 4 ? 'l3' : 'l4'
              return (
                <div key={i} className={`heatcell ${level}`} title={`Día ${i + 1} · ${count} ausencia${count !== 1 ? 's' : ''}`}>
                  {i + 1}
                </div>
              )
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

      <div className="card rise d3" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Salidas</div>
          {state.canWrite && (
            <button className="btn pri" onClick={() => setSalidaOpen(true)}><Plus size={14} />Registrar salida</button>
          )}
        </div>
        <div className="tblwrap">
          <table className="tbl">
            <thead><tr><th scope="col">Persona</th><th scope="col">Área</th><th scope="col">Motivo</th><th scope="col">Fecha</th><th scope="col"></th></tr></thead>
            <tbody>
              {salidas === null ? (
                <tr><td colSpan={5}><div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>Cargando salidas…</div></td></tr>
              ) : salidas.length === 0 ? (
                <tr><td colSpan={5}><div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>Todavía no hay salidas registradas.</div></td></tr>
              ) : salidas.map((s) => (
                <tr className="trow" key={s.id}>
                  <td><div className="cemp"><Avatar name={s.fullName} size={26} /><div className="cename">{s.fullName}</div></div></td>
                  <td className="muted">{s.department || '—'}</td>
                  <td className="muted">{s.reason}</td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{fmt(s.departedOn)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {state.canWrite && (
                      <button className="ibtn" style={{ width: 28, height: 28, color: 'var(--redd)' }} data-tip="Eliminar" disabled={pending} onClick={() => removeSalida(s)} aria-label={`Eliminar la salida de ${s.fullName}`}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(addOpen || editing) && (
        <AusenciaModal
          busy={pending}
          roster={roster}
          initial={editing}
          onClose={() => { setAddOpen(false); setEditing(null) }}
          onSubmit={(form) =>
            startTransition(async () => {
              const result = editing
                ? await updateAusencia({ ...form, id: editing.id })
                : await createAusencia(form)
              if (!result.ok) { addToast(result.error, 'err'); return }
              setAddOpen(false)
              setEditing(null)
              apply(result.data, editing ? 'Ausencia actualizada' : 'Ausencia registrada')
            })
          }
        />
      )}

      {salidaOpen && (
        <SalidaModal
          busy={pending}
          onClose={() => setSalidaOpen(false)}
          onSubmit={(form) =>
            startTransition(async () => {
              const result = await registrarSalida(form)
              if (!result.ok) { addToast(result.error, 'err'); return }
              setSalidaOpen(false)
              setSalidas(result.data)
              addToast('Salida registrada', 'ok')
            })
          }
        />
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Modal                                                              */
/* ------------------------------------------------------------------ */
interface AusenciaForm {
  employeeId: string
  kind: (typeof ABSENCE_KINDS)[number]
  startsOn: string
  endsOn: string
  status: (typeof ABSENCE_STATUSES)[number]
  notes: string
}

function AusenciaModal({
  busy, roster, initial, onClose, onSubmit,
}: {
  busy: boolean
  roster: AsistenciaData['roster']
  initial: AusenciaRow | null
  onClose: () => void
  onSubmit: (form: AusenciaForm) => void
}) {
  const [form, setForm] = useState<AusenciaForm>({
    employeeId: initial?.employeeId ?? roster[0]?.employeeId ?? '',
    kind: (initial?.kind ?? 'Vacaciones') as (typeof ABSENCE_KINDS)[number],
    startsOn: initial?.startsOn ?? todayIso(),
    endsOn: initial?.endsOn ?? todayIso(),
    status: (initial?.status ?? 'Programada') as (typeof ABSENCE_STATUSES)[number],
    notes: initial?.notes ?? '',
  })

  // Same function the server debits the vacation balance with, so the preview
  // and the stored figure cannot disagree.
  const days = useMemo(
    () => dayCount(form.startsOn, form.endsOn),
    [form.startsOn, form.endsOn],
  )

  return (
    <div className="mwrap" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead">
          <div className="mtitle">{initial ? 'Editar ausencia' : 'Registrar ausencia'}</div>
          <button className="ibtn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="mbody">
          {roster.length === 0 ? (
            <p className="psub">
              No puedes registrar ausencias sin acceso al directorio de empleados.
            </p>
          ) : (
            <>
              <div className="flabel" style={{ marginTop: 0 }}>Empleado</div>
              <Select
                value={form.employeeId}
                onChange={(v) => setForm((f) => ({ ...f, employeeId: v }))}
                options={roster.map((r) => ({ value: r.employeeId, label: r.fullName }))}
              />
              <div className="flabel">Tipo de ausencia</div>
              <Select
                value={form.kind}
                onChange={(v) => setForm((f) => ({ ...f, kind: v as (typeof ABSENCE_KINDS)[number] }))}
                options={[...ABSENCE_KINDS]}
              />
              <div className="fg2">
                <div>
                  <div className="flabel">Desde</div>
                  <DatePicker ariaLabel="Desde" value={form.startsOn} onChange={(v) => setForm((f) => ({ ...f, startsOn: v }))} />
                </div>
                <div>
                  <div className="flabel">Hasta</div>
                  <DatePicker ariaLabel="Hasta" min={form.startsOn} value={form.endsOn} onChange={(v) => setForm((f) => ({ ...f, endsOn: v }))} />
                </div>
              </div>
              {/* Derived, not typed. The fixture stored `dias` next to the dates
                  and the two could disagree. */}
              <p className="psub" style={{ marginTop: 6 }}>
                {days > 0 ? `${days} ${days === 1 ? 'día' : 'días'}` : 'El rango de fechas no es válido.'}
                {form.kind === 'Vacaciones' && days > 0 ? ' · se descuentan del saldo' : ''}
              </p>
              <div className="flabel">Estado</div>
              <Select
                value={form.status}
                onChange={(v) => setForm((f) => ({ ...f, status: v as (typeof ABSENCE_STATUSES)[number] }))}
                options={[...ABSENCE_STATUSES]}
              />
              <div className="flabel">Notas</div>
              <textarea className="field" rows={2} style={{ resize: 'none' }} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </>
          )}
        </div>
        <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
          <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
          <button
            className="btn dark"
            disabled={busy || days <= 0 || !form.employeeId}
            aria-busy={busy}
            onClick={() => onSubmit(form)}
          >
            <Check size={14} />{busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div></div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Salidas                                                            */
/* ------------------------------------------------------------------ */
interface SalidaForm {
  fullName: string
  department: string
  reason: SalidaReason
  departedOn: string
  employeeId: string | null
}

function SalidaModal({
  busy, onClose, onSubmit,
}: {
  busy: boolean
  onClose: () => void
  onSubmit: (form: SalidaForm) => void
}) {
  const [form, setForm] = useState<SalidaForm>({
    fullName: '',
    department: '',
    reason: SALIDA_REASONS[0],
    departedOn: todayIso(),
    employeeId: null,
  })

  return (
    <div className="mwrap" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mhead">
          <div className="mtitle">Registrar salida</div>
          <button className="ibtn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="mbody">
          <div className="flabel" style={{ marginTop: 0 }}>Nombre completo</div>
          <input className="field" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="Ej: María López" />
          <div className="flabel">Área</div>
          <input className="field" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} placeholder="Ej: Producción" />
          <div className="flabel">Motivo</div>
          <Select
            value={form.reason}
            onChange={(v) => setForm((f) => ({ ...f, reason: v as SalidaReason }))}
            options={[...SALIDA_REASONS]}
          />
          <div className="flabel">Fecha de salida</div>
          <DatePicker ariaLabel="Fecha de salida" value={form.departedOn} onChange={(v) => setForm((f) => ({ ...f, departedOn: v }))} />
        </div>
        <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
          <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
          <button
            className="btn dark"
            disabled={busy || !form.fullName.trim() || !form.departedOn}
            aria-busy={busy}
            onClick={() => onSubmit(form)}
          >
            <Check size={14} />{busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div></div>
      </div>
    </div>
  )
}
