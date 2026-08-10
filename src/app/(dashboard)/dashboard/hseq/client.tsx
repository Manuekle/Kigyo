'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  ShieldCheck, ShieldAlert, Check, Calendar, Plus, Send,
} from '@/lib/icons'
import Stat from '@/components/ui/Stat'
import type { StatusTone } from '@/lib/types'
import Badge from '@/components/ui/Badge'
import TabBar from '@/components/ui/TabBar'
import Select from '@/components/ui/Select'
import DatePicker from '@/components/ui/DatePicker'
import { useApp } from '@/lib/context/AppContext'
import { cop } from '@/lib/utils'
import {
  HSEQ_CATEGORIES, HSEQ_KINDS, HSEQ_PRIORITIES, HSEQ_SEVERITIES,
} from '@/lib/domain'
import LoadMore from '@/components/ui/LoadMore'
import type { HseqData, HseqRow } from '@/server/queries/hseq'
import { fetchMoreHseq } from '@/server/actions/hseq'
import {
  addHseqUpdate, createHseqReport, setHseqStatus, toggleHseqChecklistItem,
} from '@/server/mutations/hseq'

const DAY = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
const DATETIME = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
})
const fmtDate = (iso: string | null) => (iso ? DAY.format(new Date(`${iso}T00:00:00`)) : '—')

const STATUS_TABS = ['Todos', 'Pendiente', 'En curso', 'Cerrado'] as const
const STATUS_TONE: Record<string, StatusTone> = { Pendiente: 'amb', 'En curso': 'blu', Cerrado: 'grn' }
const PRIORITY_TONE: Record<string, StatusTone> = { Alta: 'red', Media: 'amb', Baja: 'neu' }

/** Where a report goes next, and what the button that moves it says. */
const STATUS_FLOW: Record<string, { next: string | null; action: string }> = {
  Pendiente: { next: 'En curso', action: 'Iniciar seguimiento' },
  'En curso': { next: 'Cerrado', action: 'Cerrar trámite' },
  Cerrado: { next: null, action: '' },
}

const EMPTY_FORM = {
  category: 'Seguridad',
  kind: 'Incidente',
  priority: 'Media',
  severity: 'Media',
  area: '',
  projectId: '',
  location: '',
  amount: '',
  ownerId: '',
  notes: '',
  dueOn: '',
  checklist: '',
}

export default function HseqPage({ data }: { data: HseqData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState<HseqData>(data)
  const [filter, setFilter] = useState<(typeof STATUS_TABS)[number]>('Todos')
  const [selectedId, setSelectedId] = useState<string | null>(data.reports[0]?.id ?? null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [note, setNote] = useState('')

  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const { reports } = state

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreHseq(reports.length)
      if (!result.ok) {
        setLoadMoreError(result.error)
        return
      }
      setState((prev) => {
        const seen = new Set(prev.reports.map((r) => r.id))
        return {
          ...prev,
          reports: [...prev.reports, ...result.data.rows.filter((r) => !seen.has(r.id))],
          reportsTotal: result.data.total,
        }
      })
    })
  }
  const selected = reports.find((r) => r.id === selectedId) ?? null
  const filtered = filter === 'Todos' ? reports : reports.filter((r) => r.status === filter)

  const stats = useMemo(() => {
    const closed = reports.filter((r) => r.status === 'Cerrado').length
    return {
      total: reports.length,
      pending: reports.filter((r) => r.status === 'Pendiente').length,
      // Rounded from real counts, and 0 rather than NaN on an empty board.
      compliance: reports.length > 0 ? Math.round((closed / reports.length) * 100) : 0,
      overdue: reports.filter((r) => r.overdue).length,
    }
  }, [reports])

  const checklistDone = selected?.checklist.filter((c) => c.isDone).length ?? 0

  function apply(next: HseqData, message: string) {
    setState(next)
    addToast(message, 'ok')
  }

  function changeStatus(r: HseqRow, status: string) {
    startTransition(async () => {
      const result = await setHseqStatus({ id: r.id, status: status as 'Cerrado' })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data, status === 'Cerrado' ? 'Trámite cerrado' : `Trámite ${status.toLowerCase()}`)
    })
  }

  function toggleItem(itemId: string, isDone: boolean) {
    startTransition(async () => {
      const result = await toggleHseqChecklistItem({ itemId, isDone })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
    })
  }

  function submitNote() {
    if (!selected || !note.trim()) return
    startTransition(async () => {
      const result = await addHseqUpdate({ reportId: selected.id, note: note.trim() })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setNote('')
      apply(result.data, 'Novedad registrada')
    })
  }

  function submitReport() {
    startTransition(async () => {
      const result = await createHseqReport({
        category: form.category as (typeof HSEQ_CATEGORIES)[number],
        kind: form.kind as (typeof HSEQ_KINDS)[number],
        priority: form.priority as (typeof HSEQ_PRIORITIES)[number],
        severity: form.severity as (typeof HSEQ_SEVERITIES)[number],
        area: form.area.trim(),
        projectId: form.projectId || null,
        location: form.location.trim(),
        // Pesos in the field, cents in the column. The fixture stored the
        // amount as the string '$4,200' — US separators, unparseable.
        amountCents: Math.round((Number(form.amount) || 0) * 100),
        ownerId: form.ownerId || null,
        notes: form.notes.trim(),
        dueOn: form.dueOn || null,
        checklist: form.checklist
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(0, 30),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      setForm(EMPTY_FORM)
      setSelectedId(result.data.reports[0]?.id ?? null)
      addToast('Trámite registrado', 'ok')
    })
  }

  return (
    <div>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat icon={<ShieldCheck size={16} />} tone="blu" label="Trámites registrados" value={stats.total} /></div>
        <div className="rise d2"><Stat icon={<ShieldAlert size={16} />} tone="amb" label="Pendientes" value={stats.pending} /></div>
        <div className="rise d3"><Stat icon={<Check size={16} />} tone="grn" label="Cumplimiento" value={`${stats.compliance}%`} sub="trámites cerrados" /></div>
        <div className="rise d4"><Stat icon={<Calendar size={16} />} tone="vio" label="Vencidos" value={stats.overdue} sub="sin cerrar" /></div>
      </div>

      {/* "Coordinadores: Carlos Ríos · Valentina Ruiz" was here — two names
          typed into the source, belonging to nobody in the directory. */}

      <div className="card rise d1" style={{ marginBottom: 18 }}>
        <div className="chead">
          <div>
            <div className="ctitle">Trámites registrados</div>
            <div className="elsub" style={{ marginTop: 2 }}>Filtra por estado para priorizar acciones.</div>
          </div>
          <TabBar
            value={filter}
            onChange={(status) => setFilter(status as (typeof STATUS_TABS)[number])}
            items={STATUS_TABS.map((s) => ({ key: s, label: s }))}
          />
        </div>
        <div style={{ maxHeight: 320, overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Tipo · Categoría</th>
                  <th scope="col">Proyecto · Área</th>
                  <th scope="col">Responsable</th>
                  <th scope="col">Prioridad</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Vence</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7}><div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                    {reports.length === 0 ? 'Todavía no hay trámites registrados.' : 'No hay trámites en este estado.'}
                  </div></td></tr>
                ) : filtered.map((report) => (
                  <tr
                    key={report.id}
                    className="trow"
                    onClick={() => setSelectedId(report.id)}
                    style={report.id === selected?.id ? { background: 'var(--blus)' } : undefined}
                  >
                    <td>
                      <div className="cename">{report.code ?? '—'}</div>
                      <div className="elsub">{fmtDate(report.reportedOn)}</div>
                    </td>
                    <td>
                      <div className="cename">{report.kind}</div>
                      <div className="elsub">{report.category}</div>
                    </td>
                    <td>
                      <div className="cename">{report.projectLabel ?? '—'}</div>
                      <div className="elsub">{report.area || '—'}</div>
                    </td>
                    <td>{report.ownerName ?? '—'}</td>
                    <td><Badge st={report.priority} tone={PRIORITY_TONE[report.priority]} /></td>
                    <td><Badge st={report.status} tone={STATUS_TONE[report.status]} /></td>
                    <td className="muted">
                      {fmtDate(report.dueOn)}
                      {report.overdue && <div style={{ color: 'var(--redd)', fontSize: 11 }}>vencido</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <LoadMore
            loaded={reports.length}
            total={state.reportsTotal}
            loading={loadingMore}
            error={loadMoreError}
            onLoadMore={loadMore}
            noun="trámites"
          />
        </div>
      </div>

      <div className="g2" style={{ marginBottom: 20 }}>
        <div className="card rise d1">
          <div className="chead">
            <div className="ctitle">Detalle del trámite</div>
            {selected && state.canWrite && (
              <div style={{ display: 'flex', gap: 8 }}>
                {STATUS_FLOW[selected.status]?.next && (
                  <button className="btn pri" disabled={pending} onClick={() => changeStatus(selected, STATUS_FLOW[selected.status].next as string)}>
                    {STATUS_FLOW[selected.status].action}
                  </button>
                )}
                {selected.status === 'Cerrado' && (
                  <button className="btn" disabled={pending} onClick={() => changeStatus(selected, 'Pendiente')}>Reabrir</button>
                )}
              </div>
            )}
          </div>
          <div className="cpad">
            {selected ? (
              <>
                <div className="elrow">
                  <div><div className="eltxt">Código</div><div className="elsub mono">{selected.code ?? '—'}</div></div>
                  <div><div className="eltxt">Estado</div><Badge st={selected.status} tone={STATUS_TONE[selected.status]} /></div>
                  <div><div className="eltxt">Severidad</div><Badge st={selected.severity} /></div>
                </div>
                <div className="elrow">
                  <div><div className="eltxt">Categoría</div><div className="elsub">{selected.category}</div></div>
                  <div><div className="eltxt">Tipo</div><div className="elsub">{selected.kind}</div></div>
                  <div><div className="eltxt">Ubicación</div><div className="elsub">{selected.location || '—'}</div></div>
                </div>
                <div className="elrow">
                  <div><div className="eltxt">Monto relacionado</div><div className="elsub">{cop(selected.amountCents / 100)}</div></div>
                  <div><div className="eltxt">Responsable</div><div className="elsub">{selected.ownerName ?? '—'}</div></div>
                  <div><div className="eltxt">Vencimiento</div><div className="elsub">{fmtDate(selected.dueOn)}</div></div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div className="elsub" style={{ marginBottom: 8 }}>
                    Checklist · {checklistDone} de {selected.checklist.length}
                  </div>
                  {selected.checklist.length === 0 ? (
                    <div className="elsub">Sin checklist.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {/* Clickable now. The seed rendered these as static
                          badges: a checklist you cannot tick is a picture. */}
                      {selected.checklist.map((item) => (
                        <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: state.canWrite ? 'pointer' : 'default' }}>
                          <input
                            type="checkbox"
                            checked={item.isDone}
                            disabled={!state.canWrite || pending}
                            onChange={(e) => toggleItem(item.id, e.target.checked)}
                          />
                          <span style={{ color: item.isDone ? 'var(--ink3)' : 'var(--ink)', textDecoration: item.isDone ? 'line-through' : 'none' }}>
                            {item.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {selected.notes && (
                  <div style={{ marginTop: 14 }}>
                    <div className="elsub" style={{ marginBottom: 4 }}>Notas</div>
                    <p style={{ fontSize: 13, color: 'var(--ink2)', margin: 0, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{selected.notes}</p>
                  </div>
                )}

                <div style={{ marginTop: 16 }}>
                  <div className="elsub" style={{ marginBottom: 8 }}>Novedades</div>
                  {selected.updates.length === 0 ? (
                    <div className="elsub">Sin novedades registradas.</div>
                  ) : selected.updates.map((u) => (
                    <div className="elrow" key={u.id}>
                      <div style={{ minWidth: 0 }}>
                        <div className="eltxt" style={{ fontSize: 13 }}>{u.note}</div>
                        <div className="elsub">{u.actorName ?? 'Alguien que ya no está'} · {DATETIME.format(new Date(u.occurredAt))}</div>
                      </div>
                    </div>
                  ))}

                  {state.canWrite && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <input
                        className="field"
                        placeholder="Registrar una novedad…"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') submitNote() }}
                      />
                      <button className="btn dark" onClick={submitNote} disabled={pending || !note.trim()} aria-label="Registrar novedad">
                        <Send size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="dempty">Selecciona un trámite de la tabla.</div>
            )}
          </div>
        </div>

        {state.canWrite && (
          <div className="card rise d2">
            <div className="chead"><div className="ctitle">Registrar trámite</div></div>
            <div className="cpad">
              <div className="fg2">
                <div>
                  <div className="flabel" style={{ marginTop: 0 }}>Categoría</div>
                  <Select value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} options={[...HSEQ_CATEGORIES]} />
                </div>
                <div>
                  <div className="flabel" style={{ marginTop: 0 }}>Tipo</div>
                  <Select value={form.kind} onChange={(v) => setForm((f) => ({ ...f, kind: v }))} options={[...HSEQ_KINDS]} />
                </div>
              </div>
              <div className="fg2">
                <div>
                  <div className="flabel">Prioridad</div>
                  <Select value={form.priority} onChange={(v) => setForm((f) => ({ ...f, priority: v }))} options={[...HSEQ_PRIORITIES]} />
                </div>
                <div>
                  {/* Four levels against priority's three, on purpose: how bad
                      it was and how urgent the follow-up is are two questions. */}
                  <div className="flabel">Severidad</div>
                  <Select value={form.severity} onChange={(v) => setForm((f) => ({ ...f, severity: v }))} options={[...HSEQ_SEVERITIES]} />
                </div>
              </div>
              {state.proyectos.length > 0 && (
                <>
                  <div className="flabel">Proyecto</div>
                  <Select
                    value={form.projectId}
                    onChange={(v) => setForm((f) => ({ ...f, projectId: v }))}
                    placeholder="Sin proyecto"
                    options={[
                      { value: '', label: 'Sin proyecto' },
                      ...state.proyectos.map((p) => ({
                        value: p.id,
                        label: [p.code, p.name].filter(Boolean).join(' · '),
                      })),
                    ]}
                  />
                </>
              )}
              {state.roster.length > 0 && (
                <>
                  <div className="flabel">Responsable</div>
                  <Select
                    value={form.ownerId}
                    onChange={(v) => setForm((f) => ({ ...f, ownerId: v }))}
                    placeholder="Sin responsable"
                    options={[
                      { value: '', label: 'Sin responsable' },
                      ...state.roster.map((r) => ({ value: r.employeeId, label: r.fullName })),
                    ]}
                  />
                </>
              )}
              <div className="fg2">
                <div>
                  <div className="flabel">Área</div>
                  <input className="field" value={form.area} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))} placeholder="Ej. Obras" />
                </div>
                <div>
                  <div className="flabel">Ubicación</div>
                  <input className="field" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
                </div>
              </div>
              <div className="fg2">
                <div>
                  <div className="flabel">Monto (COP)</div>
                  <input className="field" type="number" min={0} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <div className="flabel">Vence</div>
                  <DatePicker ariaLabel="Vence" value={form.dueOn} onChange={(v) => setForm((f) => ({ ...f, dueOn: v }))} />
                </div>
              </div>
              <div className="flabel">Checklist (una línea por ítem)</div>
              <textarea className="field" rows={3} style={{ resize: 'none' }} value={form.checklist} onChange={(e) => setForm((f) => ({ ...f, checklist: e.target.value }))} placeholder={'Permiso de trabajo en alturas\nChecklist eléctrico'} />
              <div className="flabel">Notas</div>
              <textarea className="field" rows={2} style={{ resize: 'none' }} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              {/* "Compartir con HSEQ" used to sit here and toast "Plantilla
                  enviada a HSEQ" — this *is* the HSEQ module, and nothing was
                  sent anywhere. */}
              <button className="btn dark" style={{ width: '100%', marginTop: 14 }} onClick={submitReport} disabled={pending} aria-busy={pending}>
                <Plus size={15} />{pending ? 'Registrando…' : 'Registrar trámite'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
