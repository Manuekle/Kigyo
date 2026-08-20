'use client'

import { useMemo, useState, useTransition } from 'react'
import { Target, Star, Check, Plus, Trash2, Kanban, TrendingUp, FileSpreadsheet } from '@/lib/icons'
import { useExport } from '@/lib/hooks/use-export'
import Badge from '@/components/ui/Badge'
import DatePicker from '@/components/ui/DatePicker'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import TabBar from '@/components/ui/TabBar'
import FormDrawer from '@/components/ui/FormDrawer'
import LoadMore from '@/components/ui/LoadMore'
import { useApp } from '@/lib/context/AppContext'
import { CYCLE_STATUSES, GOAL_STATUSES, REVIEW_STATUSES } from '@/lib/domain'
import type { CycleRow, DesempenoData, GoalRow, ReviewRow } from '@/server/queries/desempeno'
import type { EncuestaRow } from '@/server/mutations/desempeno'
import {
  createCycle, createEncuesta, createGoal, createReview, deleteCycle, deleteEncuesta, deleteGoal, deleteReview,
  fetchEncuestas,
  setCycleStatus, setReviewStatus, updateGoal,
} from '@/server/mutations/desempeno'
import { fetchMoreCycles } from '@/server/actions/desempeno'

const DATE = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

function formatDate(iso: string | null): string {
  return iso ? DATE.format(new Date(`${iso}T00:00:00`)) : '—'
}

function orNull(value: string): string | null {
  return value.trim() === '' ? null : value
}

const TODAY = () => new Date().toISOString().slice(0, 10)

const EMPTY_CYCLE = { name: '', startsOn: '', endsOn: '', description: '' }
const EMPTY_REVIEW = {
  cycleId: '', employeeId: '', evaluatorId: '', periodLabel: '', score: '',
  objectivesDone: '0', objectivesTotal: '0', strengths: '', improvements: '', comments: '',
}
const EMPTY_GOAL = {
  employeeId: '', cycleId: '', title: '', detail: '', metric: '',
  targetValue: '', currentValue: '0', weight: '0', dueOn: '',
}
const EMPTY_ENCUESTA = { name: '', responses: '0', score: '', closedOn: '' }

/**
 * Progress towards a goal, as a percentage.
 *
 * A goal with no target is not measurable, so it returns null rather than 0 —
 * a bar sitting empty reads as "no progress", which is a different claim from
 * "nothing to measure against".
 */
function progressOf(goal: GoalRow): number | null {
  if (goal.targetValue === null || goal.targetValue === 0) return null
  return Math.max(0, Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100)))
}

export default function DesempenoPage({ data }: { data: DesempenoData }) {
  const { addToast } = useApp()
  const { runExport, exporting } = useExport()
  const [pending, startTransition] = useTransition()

  const [cycles, setCycles] = useState<CycleRow[]>(data.cycles)
  const [total, setTotal] = useState(data.cyclesTotal)
  const [reviews, setReviews] = useState<ReviewRow[]>(data.reviews)
  const [goals, setGoals] = useState<GoalRow[]>(data.goals)
  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const [tab, setTab] = useState('ciclos')
  const [cycleOpen, setCycleOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [goalOpen, setGoalOpen] = useState(false)
  const [cycleForm, setCycleForm] = useState(EMPTY_CYCLE)
  const [reviewForm, setReviewForm] = useState(EMPTY_REVIEW)
  const [goalForm, setGoalForm] = useState(EMPTY_GOAL)
  const [encuestas, setEncuestas] = useState<EncuestaRow[] | null>(null)
  const [, startEncuestasLoad] = useTransition()
  const [encuestaOpen, setEncuestaOpen] = useState(false)
  const [encuestaForm, setEncuestaForm] = useState(EMPTY_ENCUESTA)

  function apply(next: DesempenoData) {
    setCycles(next.cycles)
    setTotal(next.cyclesTotal)
    setReviews(next.reviews)
    setGoals(next.goals)
  }

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreCycles(cycles.length)
      if (!result.ok) { setLoadMoreError(result.error); return }
      setCycles((prev) => {
        const seen = new Set(prev.map((r) => r.id))
        return [...prev, ...result.data.rows.filter((r) => !seen.has(r.id))]
      })
      setTotal(result.data.total)
    })
  }

  const stats = useMemo(() => {
    const done = reviews.filter((r) => r.status === 'Completada' || r.status === 'Calibrada')
    const scored = done.filter((r) => r.score !== null)
    const average = scored.length > 0
      ? Math.round((scored.reduce((s, r) => s + (r.score ?? 0), 0) / scored.length) * 10) / 10
      : null
    return {
      openCycles: cycles.filter((c) => c.status === 'Abierto' || c.status === 'En calibración').length,
      pending: reviews.length - done.length,
      average,
      goalsMet: goals.filter((g) => g.status === 'Cumplido').length,
    }
  }, [cycles, reviews, goals])

  function changeCycle(cycle: CycleRow, status: string) {
    startTransition(async () => {
      const result = await setCycleStatus({ id: cycle.id, status: status as never })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast(`Ciclo ${status.toLowerCase()}`, 'ok')
    })
  }

  function changeReview(review: ReviewRow, status: string) {
    startTransition(async () => {
      const result = await setReviewStatus({ id: review.id, status: status as never })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast(`${review.employeeName}: ${status.toLowerCase()}`, 'ok')
    })
  }

  function changeGoal(goal: GoalRow, status: string) {
    startTransition(async () => {
      const result = await updateGoal({ id: goal.id, status: status as never, currentValue: null })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast(`Objetivo ${status.toLowerCase()}`, 'ok')
    })
  }

  function bumpGoal(goal: GoalRow, value: string) {
    const next = Number(value)
    if (!Number.isFinite(next) || next === goal.currentValue) return
    startTransition(async () => {
      const result = await updateGoal({ id: goal.id, currentValue: next, status: null })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
    })
  }

  function loadEncuestas() {
    if (encuestas !== null) return
    startEncuestasLoad(async () => {
      setEncuestas(await fetchEncuestas())
    })
  }

  function remove(kind: 'cycle' | 'review' | 'goal', id: string, label: string) {
    if (!window.confirm(`¿Eliminar ${label}?`)) return
    startTransition(async () => {
      const result = kind === 'cycle' ? await deleteCycle(id)
        : kind === 'review' ? await deleteReview(id)
        : await deleteGoal(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Eliminado', 'ok')
    })
  }

  function removeEncuesta(id: string, label: string) {
    if (!window.confirm(`¿Eliminar ${label}?`)) return
    startTransition(async () => {
      const result = await deleteEncuesta(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setEncuestas(result.data)
      addToast('Eliminado', 'ok')
    })
  }

  function submitCycle() {
    startTransition(async () => {
      const result = await createCycle({
        name: cycleForm.name,
        startsOn: cycleForm.startsOn || TODAY(),
        endsOn: orNull(cycleForm.endsOn),
        description: cycleForm.description,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setCycleForm(EMPTY_CYCLE)
      setCycleOpen(false)
      addToast('Ciclo creado', 'ok')
    })
  }

  function submitReview() {
    startTransition(async () => {
      const result = await createReview({
        cycleId: reviewForm.cycleId || null,
        employeeId: reviewForm.employeeId,
        evaluatorId: reviewForm.evaluatorId || null,
        periodLabel: reviewForm.periodLabel,
        score: reviewForm.score === '' ? null : reviewForm.score,
        objectivesDone: reviewForm.objectivesDone,
        objectivesTotal: reviewForm.objectivesTotal,
        strengths: reviewForm.strengths,
        improvements: reviewForm.improvements,
        comments: reviewForm.comments,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setReviewForm(EMPTY_REVIEW)
      setReviewOpen(false)
      addToast('Evaluación creada', 'ok')
    })
  }

  function submitGoal() {
    startTransition(async () => {
      const result = await createGoal({
        employeeId: goalForm.employeeId,
        cycleId: goalForm.cycleId || null,
        title: goalForm.title,
        detail: goalForm.detail,
        metric: goalForm.metric,
        targetValue: goalForm.targetValue === '' ? null : goalForm.targetValue,
        currentValue: goalForm.currentValue || 0,
        weight: goalForm.weight || 0,
        dueOn: orNull(goalForm.dueOn),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setGoalForm(EMPTY_GOAL)
      setGoalOpen(false)
      addToast('Objetivo creado', 'ok')
    })
  }

  function submitEncuesta() {
    startTransition(async () => {
      const result = await createEncuesta({
        name: encuestaForm.name,
        responses: encuestaForm.responses || 0,
        score: encuestaForm.score === '' ? null : encuestaForm.score,
        closedOn: orNull(encuestaForm.closedOn),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setEncuestas(result.data)
      setEncuestaForm(EMPTY_ENCUESTA)
      setEncuestaOpen(false)
      addToast('Encuesta creada', 'ok')
    })
  }

  const cycleOptions = [
    { value: '', label: 'Sin ciclo' },
    ...cycles.map((c) => ({ value: c.id, label: c.name })),
  ]
  const rosterOptions = data.roster.map((r) => ({ value: r.employeeId, label: r.fullName }))

  const exportRows = () => {
    void runExport(
      reviews.map((r) => ({
        Empleado: r.employeeName ?? '',
        Ciclo: r.cycleName ?? '',
        Periodo: r.periodLabel ?? '',
        Puntaje: r.score === null ? '' : String(r.score) ?? '',
        Estado: r.status ?? '',
      })),
      'desempeno-kigyo',
      'desempeno',
    )
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat icon={<Kanban size={16} />} tone="blu" label="Ciclos en curso"
            value={stats.openCycles} />
        </div>
        <div className="rise d2">
          <Stat icon={<Target size={16} />} tone="amb" label="Evaluaciones pendientes"
            value={stats.pending} />
        </div>
        <div className="rise d3">
          <Stat icon={<Star size={16} />} tone="vio" label="Calificación promedio"
            value={stats.average === null ? '—' : `${stats.average} / 5`} />
        </div>
        <div className="rise d4">
          <Stat icon={<TrendingUp size={16} />} tone="grn" label="Objetivos cumplidos"
            value={stats.goalsMet} sub={`de ${goals.length}`} />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <TabBar
            items={[
              { key: 'ciclos', label: 'Ciclos' },
              { key: 'evaluaciones', label: 'Evaluaciones' },
              { key: 'objetivos', label: 'Objetivos' },
              { key: 'encuestas', label: 'Encuestas' },
            ]}
            value={tab}
            onChange={(next) => { setTab(next); if (next === 'encuestas') loadEncuestas() }}
          />
          <button disabled={exporting} aria-busy={exporting} className="btn" onClick={exportRows}><FileSpreadsheet size={15} />Exportar</button>
          {data.canWrite && (
            <div style={{ display: 'flex', gap: 8 }}>
              {tab === 'ciclos' && (
                <button className="btn dark" disabled={pending}
                  onClick={() => { setCycleForm({ ...EMPTY_CYCLE, startsOn: TODAY() }); setCycleOpen(true) }}>
                  <Plus size={15} />Ciclo
                </button>
              )}
              {tab === 'evaluaciones' && (
                <button className="btn dark" disabled={pending} onClick={() => setReviewOpen(true)}>
                  <Plus size={15} />Evaluación
                </button>
              )}
              {tab === 'objetivos' && (
                <button className="btn dark" disabled={pending} onClick={() => setGoalOpen(true)}>
                  <Plus size={15} />Objetivo
                </button>
              )}
              {tab === 'encuestas' && (
                <button className="btn dark" disabled={pending}
                  onClick={() => { setEncuestaForm(EMPTY_ENCUESTA); setEncuestaOpen(true) }}>
                  <Plus size={15} />Encuesta
                </button>
              )}
            </div>
          )}
        </div>

        {tab === 'ciclos' && (
          <>
            <div className="tblwrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Ciclo</th>
                    <th scope="col">Periodo</th>
                    <th scope="col">Avance</th>
                    <th scope="col">Promedio</th>
                    <th scope="col">Estado</th>
                    {data.canWrite && <th scope="col" aria-label="Acciones" />}
                  </tr>
                </thead>
                <tbody>
                  {cycles.length === 0 ? (
                    <tr>
                      <td colSpan={data.canWrite ? 6 : 5}>
                        <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                          Todavía no hay ciclos de evaluación.
                        </div>
                      </td>
                    </tr>
                  ) : cycles.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="cename">{c.name}</div>
                        {c.description && <div className="elsub">{c.description}</div>}
                      </td>
                      <td>{formatDate(c.startsOn)} — {formatDate(c.endsOn)}</td>
                      <td>{c.completed} / {c.reviews}</td>
                      <td>{c.averageScore === null ? '—' : `${c.averageScore} / 5`}</td>
                      <td>
                        <Badge st={c.status}
                          tone={c.status === 'Abierto' ? 'grn'
                            : c.status === 'En calibración' ? 'amb'
                            : c.status === 'Cerrado' ? 'neu' : 'blu'} />
                      </td>
                      {data.canWrite && (
                        <td>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <Select
                              value={c.status}
                              onChange={(next) => { if (next !== c.status) changeCycle(c, next) }}
                              options={[...CYCLE_STATUSES]}
                            />
                            <button className="ibtn" aria-label={`Eliminar ${c.name}`}
                              disabled={pending} onClick={() => remove('cycle', c.id, c.name)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <LoadMore
              loaded={cycles.length}
              total={total}
              loading={loadingMore}
              error={loadMoreError}
              onLoadMore={loadMore}
              noun="ciclos"
            />
          </>
        )}

        {tab === 'evaluaciones' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Persona</th>
                  <th scope="col">Ciclo</th>
                  <th scope="col">Objetivos</th>
                  <th scope="col">Calificación</th>
                  <th scope="col">Estado</th>
                  {data.canWrite && <th scope="col" aria-label="Acciones" />}
                </tr>
              </thead>
              <tbody>
                {reviews.length === 0 ? (
                  <tr>
                    <td colSpan={data.canWrite ? 6 : 5}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        No hay evaluaciones registradas.
                      </div>
                    </td>
                  </tr>
                ) : reviews.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="cename">{r.employeeName}</div>
                      <div className="elsub mono">{r.code ?? '—'}{r.periodLabel && ` · ${r.periodLabel}`}</div>
                    </td>
                    <td>{r.cycleName || '—'}</td>
                    <td>{r.objectivesDone} / {r.objectivesTotal}</td>
                    <td>{r.score === null ? '—' : `${r.score} / 5`}</td>
                    <td>
                      <Badge st={r.status}
                        tone={r.status === 'Calibrada' ? 'grn'
                          : r.status === 'Completada' ? 'blu'
                          : r.status === 'En revisión' ? 'amb' : 'neu'} />
                    </td>
                    {data.canWrite && (
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <Select
                            value={r.status}
                            onChange={(next) => { if (next !== r.status) changeReview(r, next) }}
                            options={[...REVIEW_STATUSES]}
                          />
                          <button className="ibtn" aria-label={`Eliminar evaluación de ${r.employeeName}`}
                            disabled={pending}
                            onClick={() => remove('review', r.id, `la evaluación de ${r.employeeName}`)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'objetivos' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Objetivo</th>
                  <th scope="col">Persona</th>
                  <th scope="col">Avance</th>
                  <th scope="col">Peso</th>
                  <th scope="col">Vence</th>
                  <th scope="col">Estado</th>
                  {data.canWrite && <th scope="col" aria-label="Acciones" />}
                </tr>
              </thead>
              <tbody>
                {goals.length === 0 ? (
                  <tr>
                    <td colSpan={data.canWrite ? 7 : 6}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        No hay objetivos registrados.
                      </div>
                    </td>
                  </tr>
                ) : goals.map((g) => {
                  const pct = progressOf(g)
                  return (
                    <tr key={g.id}>
                      <td>
                        <div className="cename">{g.title}</div>
                        {g.metric && <div className="elsub">{g.metric}</div>}
                      </td>
                      <td>{g.employeeName}</td>
                      <td>
                        {data.canWrite ? (
                          <input
                            className="field"
                            style={{ width: 90 }}
                            type="number"
                            defaultValue={g.currentValue}
                            aria-label={`Avance de ${g.title}`}
                            disabled={pending}
                            onBlur={(e) => bumpGoal(g, e.target.value)}
                          />
                        ) : g.currentValue}
                        <div className="elsub">
                          {g.targetValue === null ? 'Sin meta' : `meta ${g.targetValue}`}
                          {pct !== null && ` · ${pct}%`}
                        </div>
                      </td>
                      <td>{g.weight > 0 ? `${g.weight}%` : '—'}</td>
                      <td>{formatDate(g.dueOn)}</td>
                      <td>
                        <Badge st={g.status}
                          tone={g.status === 'Cumplido' ? 'grn'
                            : g.status === 'No cumplido' ? 'red'
                            : g.status === 'Cancelado' ? 'neu' : 'amb'} />
                      </td>
                      {data.canWrite && (
                        <td>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <Select
                              value={g.status}
                              onChange={(next) => { if (next !== g.status) changeGoal(g, next) }}
                              options={[...GOAL_STATUSES]}
                            />
                            <button className="ibtn" aria-label={`Eliminar ${g.title}`}
                              disabled={pending} onClick={() => remove('goal', g.id, g.title)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'encuestas' && (
          encuestas === null ? (
            <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
              Cargando encuestas…
            </div>
          ) : (
            <div className="tblwrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Encuesta</th>
                    <th scope="col">Respuestas</th>
                    <th scope="col">Score</th>
                    <th scope="col">Cierre</th>
                    {data.canWrite && <th scope="col" aria-label="Acciones" />}
                  </tr>
                </thead>
                <tbody>
                  {encuestas.length === 0 ? (
                    <tr>
                      <td colSpan={data.canWrite ? 5 : 4}>
                        <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                          No hay encuestas registradas.
                        </div>
                      </td>
                    </tr>
                  ) : encuestas.map((e) => (
                    <tr key={e.id}>
                      <td><div className="cename">{e.name}</div></td>
                      <td>{e.responses}</td>
                      <td>{e.score === null ? '—' : e.score}</td>
                      <td>{formatDate(e.closedOn)}</td>
                      {data.canWrite && (
                        <td>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button className="ibtn" aria-label={`Eliminar ${e.name}`}
                              disabled={pending} onClick={() => removeEncuesta(e.id, e.name)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      <FormDrawer
        open={cycleOpen}
        onClose={() => setCycleOpen(false)}
        title="Nuevo ciclo de evaluación"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitCycle}>
            <Check size={15} />Crear ciclo
          </button>
        }
      >
        <label className="flabel" htmlFor="cyc-name">Nombre</label>
        <input id="cyc-name" className="field" value={cycleForm.name}
          onChange={(e) => setCycleForm({ ...cycleForm, name: e.target.value })}
          placeholder="Evaluación semestral 2026-I" />

        <div className="fg2">
          <div>
            <div className="flabel">Inicia</div>
            <DatePicker ariaLabel="Inicia" value={cycleForm.startsOn}
              onChange={(v) => setCycleForm({ ...cycleForm, startsOn: v })} />
          </div>
          <div>
            <div className="flabel">Cierra</div>
            <DatePicker ariaLabel="Cierra" value={cycleForm.endsOn}
              onChange={(v) => setCycleForm({ ...cycleForm, endsOn: v })} />
          </div>
        </div>

        <label className="flabel" htmlFor="cyc-desc">Descripción</label>
        <textarea id="cyc-desc" className="field" rows={3} value={cycleForm.description}
          onChange={(e) => setCycleForm({ ...cycleForm, description: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title="Nueva evaluación"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitReview}>
            <Check size={15} />Crear evaluación
          </button>
        }
      >
        <div className="flabel">Persona evaluada</div>
        <Select value={reviewForm.employeeId}
          onChange={(v) => setReviewForm({ ...reviewForm, employeeId: v })}
          placeholder="Elige a la persona" options={rosterOptions} />

        <div className="flabel">Evaluador</div>
        <Select value={reviewForm.evaluatorId}
          onChange={(v) => setReviewForm({ ...reviewForm, evaluatorId: v })}
          placeholder="Sin asignar" options={rosterOptions} />

        <div className="flabel">Ciclo</div>
        <Select value={reviewForm.cycleId}
          onChange={(v) => setReviewForm({ ...reviewForm, cycleId: v })}
          options={cycleOptions} />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="rev-per">Periodo</label>
            <input id="rev-per" className="field" value={reviewForm.periodLabel}
              onChange={(e) => setReviewForm({ ...reviewForm, periodLabel: e.target.value })}
              placeholder="2026-I" />
          </div>
          <div>
            <label className="flabel" htmlFor="rev-score">Calificación (0–5)</label>
            <input id="rev-score" className="field" type="number" min={0} max={5} step="0.1"
              value={reviewForm.score}
              onChange={(e) => setReviewForm({ ...reviewForm, score: e.target.value })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="rev-done">Objetivos cumplidos</label>
            <input id="rev-done" className="field" type="number" min={0}
              value={reviewForm.objectivesDone}
              onChange={(e) => setReviewForm({ ...reviewForm, objectivesDone: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="rev-total">Objetivos totales</label>
            <input id="rev-total" className="field" type="number" min={0}
              value={reviewForm.objectivesTotal}
              onChange={(e) => setReviewForm({ ...reviewForm, objectivesTotal: e.target.value })} />
          </div>
        </div>

        <label className="flabel" htmlFor="rev-str">Fortalezas</label>
        <textarea id="rev-str" className="field" rows={3} value={reviewForm.strengths}
          onChange={(e) => setReviewForm({ ...reviewForm, strengths: e.target.value })} />

        <label className="flabel" htmlFor="rev-imp">Oportunidades de mejora</label>
        <textarea id="rev-imp" className="field" rows={3} value={reviewForm.improvements}
          onChange={(e) => setReviewForm({ ...reviewForm, improvements: e.target.value })} />

        <label className="flabel" htmlFor="rev-com">Comentarios</label>
        <textarea id="rev-com" className="field" rows={2} value={reviewForm.comments}
          onChange={(e) => setReviewForm({ ...reviewForm, comments: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={goalOpen}
        onClose={() => setGoalOpen(false)}
        title="Nuevo objetivo"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitGoal}>
            <Check size={15} />Crear objetivo
          </button>
        }
      >
        <label className="flabel" htmlFor="goal-title">Objetivo</label>
        <input id="goal-title" className="field" value={goalForm.title}
          onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
          placeholder="Reducir el tiempo de respuesta a tickets" />

        <div className="flabel">Persona</div>
        <Select value={goalForm.employeeId}
          onChange={(v) => setGoalForm({ ...goalForm, employeeId: v })}
          placeholder="Elige a la persona" options={rosterOptions} />

        <div className="flabel">Ciclo</div>
        <Select value={goalForm.cycleId}
          onChange={(v) => setGoalForm({ ...goalForm, cycleId: v })}
          options={cycleOptions} />

        <label className="flabel" htmlFor="goal-metric">Métrica</label>
        <input id="goal-metric" className="field" value={goalForm.metric}
          onChange={(e) => setGoalForm({ ...goalForm, metric: e.target.value })}
          placeholder="Horas promedio de primera respuesta" />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="goal-cur">Valor actual</label>
            <input id="goal-cur" className="field" type="number" value={goalForm.currentValue}
              onChange={(e) => setGoalForm({ ...goalForm, currentValue: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="goal-tgt">Meta</label>
            <input id="goal-tgt" className="field" type="number" value={goalForm.targetValue}
              onChange={(e) => setGoalForm({ ...goalForm, targetValue: e.target.value })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="goal-w">Peso (%)</label>
            <input id="goal-w" className="field" type="number" min={0} max={100}
              value={goalForm.weight}
              onChange={(e) => setGoalForm({ ...goalForm, weight: e.target.value })} />
          </div>
          <div>
            <div className="flabel">Vence</div>
            <DatePicker ariaLabel="Vence" value={goalForm.dueOn}
              onChange={(v) => setGoalForm({ ...goalForm, dueOn: v })} />
          </div>
        </div>

        <label className="flabel" htmlFor="goal-det">Detalle</label>
        <textarea id="goal-det" className="field" rows={3} value={goalForm.detail}
          onChange={(e) => setGoalForm({ ...goalForm, detail: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={encuestaOpen}
        onClose={() => setEncuestaOpen(false)}
        title="Nueva encuesta"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitEncuesta}>
            <Check size={15} />Crear encuesta
          </button>
        }
      >
        <label className="flabel" htmlFor="enc-name">Nombre</label>
        <input id="enc-name" className="field" value={encuestaForm.name}
          onChange={(e) => setEncuestaForm({ ...encuestaForm, name: e.target.value })}
          placeholder="Encuesta de clima laboral" />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="enc-resp">Respuestas</label>
            <input id="enc-resp" className="field" type="number" min={0} value={encuestaForm.responses}
              onChange={(e) => setEncuestaForm({ ...encuestaForm, responses: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="enc-score">Score</label>
            <input id="enc-score" className="field" type="number" min={-100} max={100} step="0.1"
              value={encuestaForm.score}
              onChange={(e) => setEncuestaForm({ ...encuestaForm, score: e.target.value })} />
          </div>
        </div>

        <div className="flabel">Cierre</div>
        <DatePicker ariaLabel="Cierre" value={encuestaForm.closedOn}
          onChange={(v) => setEncuestaForm({ ...encuestaForm, closedOn: v })} />
      </FormDrawer>
    </>
  )
}
