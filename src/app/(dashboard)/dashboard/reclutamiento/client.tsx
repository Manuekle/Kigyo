'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  UserSearch, FileSpreadsheet, UserPlus, Check, Clock, Plus, Trash2, Star, Briefcase, PenLine,
} from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import TabBar from '@/components/ui/TabBar'
import FormDrawer from '@/components/ui/FormDrawer'
import LoadMore from '@/components/ui/LoadMore'
import { useApp } from '@/lib/context/AppContext'
import { useConfirm } from '@/lib/context/ConfirmContext'
import { useExport } from '@/lib/hooks/use-export'
import { CANDIDATE_STAGES, EMPLOYMENT_TYPES, OPENING_STATUSES } from '@/lib/domain'
import { cop } from '@/lib/utils'
import type { CandidateRow, OpeningRow, ReclutamientoData } from '@/server/queries/reclutamiento'
import {
  createCandidate, createOpening, deleteCandidate, deleteOpening,
  setCandidateStage, setOpeningStatus, updateCandidate, updateOpening,
} from '@/server/mutations/reclutamiento'
import { fetchMoreOpenings } from '@/server/actions/reclutamiento'

/**
 * The funnel, minus its terminal states.
 *
 * 'Contratado' and 'Descartado' are outcomes, not steps: rendering them as
 * board columns puts every candidate the company has ever rejected on screen
 * beside the three it is actively interviewing.
 */
const BOARD_STAGES = CANDIDATE_STAGES.filter(
  (s) => s !== 'Contratado' && s !== 'Descartado',
)

const EMPTY_OPENING = {
  title: '', department: '', location: '', employmentType: 'Tiempo completo',
  openings: '1', salaryMin: '', salaryMax: '', hiringManagerId: '', description: '',
}

const EMPTY_CANDIDATE = {
  openingId: '', fullName: '', email: '', phone: '', source: '',
  expectedSalary: '', rating: '', notes: '',
}

/** Pesos in the form, minor units in the column. One place does the maths. */
function toCents(value: string): number {
  const n = Number(value.replace(/[^\d]/g, ''))
  return Number.isFinite(n) ? Math.round(n) * 100 : 0
}

/** Minor units back to a readable amount; `cop` takes pesos, not cents. */
function pesos(cents: number): string {
  return cop(Math.round(cents / 100))
}

export default function ReclutamientoPage({ data }: { data: ReclutamientoData }) {
  const { addToast } = useApp()
  const confirm = useConfirm()
  const { runExport, exporting } = useExport()
  const [pending, startTransition] = useTransition()

  const [openings, setOpenings] = useState<OpeningRow[]>(data.openings)
  const [total, setTotal] = useState(data.openingsTotal)
  const [candidates, setCandidates] = useState<CandidateRow[]>(data.candidates)
  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const [tab, setTab] = useState('pipeline')
  const [statusFilter, setStatusFilter] = useState('Todas')
  const [openingFilter, setOpeningFilter] = useState('Todas')
  const [openingForm, setOpeningForm] = useState(EMPTY_OPENING)
  const [candidateForm, setCandidateForm] = useState(EMPTY_CANDIDATE)
  const [openingOpen, setOpeningOpen] = useState(false)
  const [candidateOpen, setCandidateOpen] = useState(false)
  const [editingOpeningId, setEditingOpeningId] = useState<string | null>(null)
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null)

  /** A mutation returns the fresh first page, and the totals that match it. */
  function apply(next: ReclutamientoData) {
    setOpenings(next.openings)
    setTotal(next.openingsTotal)
    setCandidates(next.candidates)
  }

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreOpenings(openings.length)
      if (!result.ok) { setLoadMoreError(result.error); return }
      setOpenings((prev) => {
        const seen = new Set(prev.map((r) => r.id))
        return [...prev, ...result.data.rows.filter((r) => !seen.has(r.id))]
      })
      setTotal(result.data.total)
    })
  }

  const live = useMemo(
    () => openings.filter((o) => o.status === 'Abierta' || o.status === 'En proceso'),
    [openings],
  )

  const counts = useMemo(() => ({
    active: candidates.filter((c) => c.stage !== 'Descartado' && c.stage !== 'Contratado').length,
    offer: candidates.filter((c) => c.stage === 'Oferta').length,
    hired: candidates.filter((c) => c.stage === 'Contratado').length,
    seats: live.reduce((sum, o) => sum + o.openings, 0),
  }), [candidates, live])

  const managerName = useMemo(() => {
    const byId = new Map(data.roster.map((r) => [r.employeeId, r.fullName]))
    return (id: string | null) => (id ? byId.get(id) ?? '—' : '—')
  }, [data.roster])

  const visibleCandidates = candidates.filter(
    (c) => openingFilter === 'Todas' || c.openingId === openingFilter,
  )
  const visibleOpenings = openings.filter(
    (o) => statusFilter === 'Todas' || o.status === statusFilter,
  )

  const candidateRows = visibleCandidates.map((c) => ({
    Nombre: c.fullName,
    Cargo: c.openingTitle,
    Etapa: c.stage,
    Estado: openings.find((o) => o.id === c.openingId)?.status ?? '',
    Fecha: c.appliedOn,
  }))

  const openingRows = visibleOpenings.map((o) => ({
    Cargo: o.title,
    Área: o.department,
    Estado: o.status,
    Plazas: String(o.openings),
    Salario: o.salaryMinCents === 0 && o.salaryMaxCents === 0 ? '' : `${pesos(o.salaryMinCents)} – ${pesos(o.salaryMaxCents)}`,
  }))

  const exportRows = () => {
    void runExport(
      candidateRows.length > 0 ? candidateRows : openingRows,
      'reclutamiento-kigyo',
      'reclutamiento',
    )
  }

  function move(candidate: CandidateRow, stage: string) {
    startTransition(async () => {
      const result = await setCandidateStage({ id: candidate.id, stage: stage as never })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast(`${candidate.fullName}: ${stage}`, 'ok', 'Deshacer', () => {
        startTransition(async () => {
          const undo = await setCandidateStage({
            id: candidate.id,
            stage: candidate.stage as never,
          })
          if (undo.ok) apply(undo.data)
        })
      })
    })
  }

  async function removeCandidate(candidate: CandidateRow) {
    if (!(await confirm({ title: `¿Eliminar a ${candidate.fullName}?`, description: 'Esta acción no se puede deshacer.', tone: 'danger' }))) return
    startTransition(async () => {
      const result = await deleteCandidate(candidate.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Candidato eliminado', 'ok')
    })
  }

  function changeOpeningStatus(opening: OpeningRow, status: string) {
    startTransition(async () => {
      const result = await setOpeningStatus({ id: opening.id, status: status as never })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast(`Vacante ${status.toLowerCase()}`, 'ok')
    })
  }

  async function removeOpening(opening: OpeningRow) {
    if (!(await confirm({ title: '¿Eliminar esta vacante?', description: 'Úsalo solo si se creó por error; para terminarla, ciérrala.', tone: 'danger' }))) return
    startTransition(async () => {
      const result = await deleteOpening(opening.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Vacante eliminada', 'ok')
    })
  }

  function editOpening(opening: OpeningRow) {
    setOpeningForm({
      title: opening.title,
      department: opening.department,
      location: opening.location,
      employmentType: opening.employmentType,
      openings: String(opening.openings),
      salaryMin: opening.salaryMinCents ? pesos(opening.salaryMinCents) : '',
      salaryMax: opening.salaryMaxCents ? pesos(opening.salaryMaxCents) : '',
      hiringManagerId: opening.hiringManagerId ?? '',
      description: opening.description,
    })
    setEditingOpeningId(opening.id)
    setOpeningOpen(true)
  }

  function submitOpening() {
    const editingId = editingOpeningId
    startTransition(async () => {
      const payload = {
        title: openingForm.title,
        department: openingForm.department,
        location: openingForm.location,
        employmentType: openingForm.employmentType as never,
        openings: openingForm.openings,
        salaryMinCents: toCents(openingForm.salaryMin),
        salaryMaxCents: toCents(openingForm.salaryMax),
        hiringManagerId: openingForm.hiringManagerId || null,
        description: openingForm.description,
      }
      const result = editingId
        ? await updateOpening({ id: editingId, ...payload })
        : await createOpening(payload)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setOpeningForm(EMPTY_OPENING)
      setEditingOpeningId(null)
      setOpeningOpen(false)
      addToast(editingId ? 'Actualizado' : 'Vacante creada', 'ok')
    })
  }

  function editCandidate(candidate: CandidateRow) {
    setCandidateForm({
      openingId: candidate.openingId,
      fullName: candidate.fullName,
      email: candidate.email ?? '',
      phone: candidate.phone,
      source: candidate.source,
      expectedSalary: candidate.expectedSalaryCents ? pesos(candidate.expectedSalaryCents) : '',
      rating: candidate.rating ? String(candidate.rating) : '',
      notes: candidate.notes,
    })
    setEditingCandidateId(candidate.id)
    setCandidateOpen(true)
  }

  function submitCandidate() {
    const editingId = editingCandidateId
    startTransition(async () => {
      const payload = {
        openingId: candidateForm.openingId,
        fullName: candidateForm.fullName,
        email: candidateForm.email || null,
        phone: candidateForm.phone,
        source: candidateForm.source,
        expectedSalaryCents: toCents(candidateForm.expectedSalary),
        rating: candidateForm.rating ? Number(candidateForm.rating) : null,
        notes: candidateForm.notes,
      }
      const result = editingId
        ? await updateCandidate({ id: editingId, ...payload })
        : await createCandidate(payload)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setCandidateForm(EMPTY_CANDIDATE)
      setEditingCandidateId(null)
      setCandidateOpen(false)
      addToast(editingId ? 'Actualizado' : 'Candidato registrado', 'ok')
    })
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat icon={<Briefcase size={16} />} tone="blu" label="Vacantes abiertas"
            value={live.length}
            sub={`${counts.seats} ${counts.seats === 1 ? 'plaza' : 'plazas'} por cubrir`} />
        </div>
        <div className="rise d2">
          <Stat icon={<UserSearch size={16} />} tone="amb" label="Candidatos en proceso"
            value={counts.active} />
        </div>
        <div className="rise d3">
          <Stat icon={<Clock size={16} />} tone="vio" label="En oferta" value={counts.offer} />
        </div>
        <div className="rise d4">
          <Stat icon={<Check size={16} />} tone="grn" label="Contratados" value={counts.hired} />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <TabBar
            items={[
              { key: 'pipeline', label: 'Pipeline' },
              { key: 'vacantes', label: 'Vacantes' },
            ]}
            value={tab}
            onChange={setTab}
          />
          <button disabled={exporting} aria-busy={exporting} className="btn" onClick={exportRows}><FileSpreadsheet size={15} />Exportar</button>
          {data.canWrite && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" disabled={pending || openings.length === 0}
                onClick={() => {
                  setCandidateForm({ ...EMPTY_CANDIDATE, openingId: live[0]?.id ?? openings[0]?.id ?? '' })
                  setEditingCandidateId(null)
                  setCandidateOpen(true)
                }}>
                <UserPlus size={15} />Candidato
              </button>
              <button className="btn dark" disabled={pending}
                onClick={() => { setEditingOpeningId(null); setOpeningOpen(true) }}>
                <Plus size={15} />Vacante
              </button>
            </div>
          )}
        </div>

        {tab === 'pipeline' && (
          <div className="cpad">
            <div style={{ maxWidth: 280, marginBottom: 14 }}>
              <Select
                value={openingFilter}
                onChange={setOpeningFilter}
                options={[
                  { value: 'Todas', label: 'Todas las vacantes' },
                  ...openings.map((o) => ({ value: o.id, label: o.title })),
                ]}
              />
            </div>

            {openings.length === 0 ? (
              <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                Todavía no hay vacantes. Crea una para empezar a registrar candidatos.
              </div>
            ) : (
              <div className="funnel">
                {BOARD_STAGES.map((stage) => {
                  const inStage = visibleCandidates.filter((c) => c.stage === stage)
                  return (
                    <div className="funnel-col" key={stage}>
                      <div className="funnel-head">
                        <span>{stage}</span>
                        <span className="funnel-count">{inStage.length}</span>
                      </div>
                      {inStage.length === 0 && <div className="funnel-empty">—</div>}
                      {inStage.map((c) => (
                        <div className="funnel-card" key={c.id}>
                          <div className="funnel-name">{c.fullName}</div>
                          <div className="elsub">{c.openingTitle}</div>
                          {c.rating !== null && (
                            <div className="elsub" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Star size={11} />{c.rating} / 5
                            </div>
                          )}
                          {c.expectedSalaryCents > 0 && (
                            <div className="elsub">Aspira {pesos(c.expectedSalaryCents)}</div>
                          )}
                          {data.canWrite && (
                            <div className="funnel-actions">
                              <button className="ibtn" aria-label={`Editar a ${c.fullName}`}
                                disabled={pending} onClick={() => editCandidate(c)}>
                                <PenLine size={14} />
                              </button>
                              <Select
                                value={c.stage}
                                onChange={(next) => { if (next !== c.stage) move(c, next) }}
                                options={[...CANDIDATE_STAGES]}
                              />
                              <button className="ibtn" aria-label={`Eliminar a ${c.fullName}`}
                                disabled={pending} onClick={() => removeCandidate(c)}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'vacantes' && (
          <>
            <div className="cpad" style={{ paddingBottom: 0 }}>
              <div style={{ maxWidth: 240 }}>
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={['Todas', ...OPENING_STATUSES]}
                />
              </div>
            </div>

            <div className="tblwrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Cargo</th>
                    <th scope="col">Área</th>
                    <th scope="col">Responsable</th>
                    <th scope="col">Rango salarial</th>
                    <th scope="col">Candidatos</th>
                    <th scope="col">Estado</th>
                    {data.canWrite && <th scope="col" aria-label="Acciones" />}
                  </tr>
                </thead>
                <tbody>
                  {visibleOpenings.length === 0 ? (
                    <tr>
                      <td colSpan={data.canWrite ? 7 : 6}>
                        <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                          {openings.length === 0
                            ? 'Todavía no hay vacantes.'
                            : 'No hay vacantes con ese estado.'}
                        </div>
                      </td>
                    </tr>
                  ) : visibleOpenings.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <div className="cename">{o.title}</div>
                        <div className="elsub mono">
                          {o.code} · {o.employmentType}{o.location && ` · ${o.location}`}
                        </div>
                      </td>
                      <td>{o.department || '—'}</td>
                      <td>{managerName(o.hiringManagerId)}</td>
                      <td>
                        {o.salaryMinCents === 0 && o.salaryMaxCents === 0
                          ? '—'
                          : `${pesos(o.salaryMinCents)} – ${pesos(o.salaryMaxCents)}`}
                      </td>
                      <td>{o.activeCandidates} / {o.openings}</td>
                      <td>
                        <Badge st={o.status}
                          tone={o.status === 'Abierta' ? 'grn' : o.status === 'En proceso' ? 'amb' : 'neu'} />
                      </td>
                      {data.canWrite && (
                        <td>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <Select
                              value={o.status}
                              onChange={(next) => { if (next !== o.status) changeOpeningStatus(o, next) }}
                              options={[...OPENING_STATUSES]}
                            />
                            <button className="ibtn" aria-label={`Editar ${o.title}`}
                              disabled={pending} onClick={() => editOpening(o)}>
                              <PenLine size={14} />
                            </button>
                            <button className="ibtn" aria-label={`Eliminar ${o.title}`}
                              disabled={pending} onClick={() => removeOpening(o)}>
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
              loaded={openings.length}
              total={total}
              loading={loadingMore}
              error={loadMoreError}
              onLoadMore={loadMore}
              noun="vacantes"
            />
          </>
        )}
      </div>

      <FormDrawer
        open={openingOpen}
        onClose={() => setOpeningOpen(false)}
        title={editingOpeningId ? 'Editar vacante' : 'Nueva vacante'}
        footer={
          <button className="btn dark" disabled={pending} onClick={submitOpening}>
            <Check size={15} />{editingOpeningId ? 'Guardar cambios' : 'Crear vacante'}
          </button>
        }
      >
        <label className="flabel" htmlFor="vac-title">Cargo</label>
        <input id="vac-title" className="field" value={openingForm.title}
          onChange={(e) => setOpeningForm({ ...openingForm, title: e.target.value })}
          placeholder="Ingeniero de instalaciones" />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="vac-dep">Área</label>
            <input id="vac-dep" className="field" value={openingForm.department}
              onChange={(e) => setOpeningForm({ ...openingForm, department: e.target.value })}
              placeholder="Operaciones" />
          </div>
          <div>
            <label className="flabel" htmlFor="vac-loc">Ubicación</label>
            <input id="vac-loc" className="field" value={openingForm.location}
              onChange={(e) => setOpeningForm({ ...openingForm, location: e.target.value })}
              placeholder="Bogotá / Remoto" />
          </div>
        </div>

        <div className="fg2">
          <div>
            <div className="flabel">Tipo de contrato</div>
            <Select
              value={openingForm.employmentType}
              onChange={(v) => setOpeningForm({ ...openingForm, employmentType: v })}
              options={[...EMPLOYMENT_TYPES]}
            />
          </div>
          <div>
            <label className="flabel" htmlFor="vac-n">Plazas</label>
            <input id="vac-n" className="field" type="number" min={1} value={openingForm.openings}
              onChange={(e) => setOpeningForm({ ...openingForm, openings: e.target.value })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="vac-min">Salario mínimo (COP)</label>
            <input id="vac-min" className="field" inputMode="numeric" value={openingForm.salaryMin}
              onChange={(e) => setOpeningForm({ ...openingForm, salaryMin: e.target.value })}
              placeholder="3.500.000" />
          </div>
          <div>
            <label className="flabel" htmlFor="vac-max">Salario máximo (COP)</label>
            <input id="vac-max" className="field" inputMode="numeric" value={openingForm.salaryMax}
              onChange={(e) => setOpeningForm({ ...openingForm, salaryMax: e.target.value })}
              placeholder="4.800.000" />
          </div>
        </div>

        <div className="flabel">Responsable de la contratación</div>
        <Select
          value={openingForm.hiringManagerId}
          onChange={(v) => setOpeningForm({ ...openingForm, hiringManagerId: v })}
          placeholder="Sin asignar"
          options={data.roster.map((r) => ({ value: r.employeeId, label: r.fullName }))}
        />

        <label className="flabel" htmlFor="vac-desc">Descripción</label>
        <textarea id="vac-desc" className="field" rows={4} value={openingForm.description}
          onChange={(e) => setOpeningForm({ ...openingForm, description: e.target.value })}
          placeholder="Responsabilidades, requisitos y condiciones." />
      </FormDrawer>

      <FormDrawer
        open={candidateOpen}
        onClose={() => setCandidateOpen(false)}
        title={editingCandidateId ? 'Editar candidato' : 'Nuevo candidato'}
        footer={
          <button className="btn dark" disabled={pending} onClick={submitCandidate}>
            <Check size={15} />{editingCandidateId ? 'Guardar cambios' : 'Registrar'}
          </button>
        }
      >
        <div className="flabel">Vacante</div>
        <Select
          value={candidateForm.openingId}
          onChange={(v) => setCandidateForm({ ...candidateForm, openingId: v })}
          placeholder="Elige la vacante"
          options={openings.map((o) => ({ value: o.id, label: o.title }))}
        />

        <label className="flabel" htmlFor="cand-name">Nombre completo</label>
        <input id="cand-name" className="field" value={candidateForm.fullName}
          onChange={(e) => setCandidateForm({ ...candidateForm, fullName: e.target.value })} />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="cand-mail">Correo</label>
            <input id="cand-mail" className="field" type="email" value={candidateForm.email}
              onChange={(e) => setCandidateForm({ ...candidateForm, email: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="cand-phone">Teléfono</label>
            <input id="cand-phone" className="field" value={candidateForm.phone}
              onChange={(e) => setCandidateForm({ ...candidateForm, phone: e.target.value })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="cand-src">Fuente</label>
            <input id="cand-src" className="field" value={candidateForm.source}
              onChange={(e) => setCandidateForm({ ...candidateForm, source: e.target.value })}
              placeholder="LinkedIn, referido, portal…" />
          </div>
          <div>
            <label className="flabel" htmlFor="cand-sal">Aspiración (COP)</label>
            <input id="cand-sal" className="field" inputMode="numeric"
              value={candidateForm.expectedSalary}
              onChange={(e) => setCandidateForm({ ...candidateForm, expectedSalary: e.target.value })} />
          </div>
        </div>

        <div className="flabel">Calificación</div>
        <Select
          value={candidateForm.rating}
          onChange={(v) => setCandidateForm({ ...candidateForm, rating: v })}
          placeholder="Sin calificar"
          options={['1', '2', '3', '4', '5'].map((n) => ({ value: n, label: `${n} / 5` }))}
        />

        <label className="flabel" htmlFor="cand-notes">Notas</label>
        <textarea id="cand-notes" className="field" rows={3} value={candidateForm.notes}
          onChange={(e) => setCandidateForm({ ...candidateForm, notes: e.target.value })} />
      </FormDrawer>
    </>
  )
}
