'use client'

import { useMemo, useState, useTransition } from 'react'
import { Stethoscope, Check, Plus, Trash2, Calendar, AlertTriangle, Users } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import TabBar from '@/components/ui/TabBar'
import FormDrawer from '@/components/ui/FormDrawer'
import LoadMore from '@/components/ui/LoadMore'
import { useApp } from '@/lib/context/AppContext'
import { BLOOD_TYPES, PATIENT_STATUSES, VISIT_KINDS } from '@/lib/domain'
import { cop } from '@/lib/utils'
import type { PacientesData, PatientRow } from '@/server/queries/pacientes'
import {
  createPaciente, deletePaciente, registrarConsulta, setPacienteStatus,
} from '@/server/mutations/pacientes'
import { fetchMorePacientes } from '@/server/actions/pacientes'

const DATE = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

function formatDate(iso: string | null): string {
  return iso ? DATE.format(new Date(iso)) : '—'
}

function toCents(value: string): number {
  const n = Number(value.replace(/[^\d]/g, ''))
  return Number.isFinite(n) ? Math.round(n) * 100 : 0
}

function pesos(cents: number): string {
  return cop(Math.round(cents / 100))
}

function orNull(value: string): string | null {
  return value.trim() === '' ? null : value
}

const EMPTY_PATIENT = {
  fullName: '', documentId: '', birthDate: '', sex: '', bloodType: '', email: '',
  phone: '', address: '', insurer: '', allergies: '', conditions: '',
  emergencyContact: '', emergencyPhone: '',
}

const EMPTY_VISIT = {
  patientId: '', kind: 'Consulta', professionalId: '', reason: '', diagnosis: '',
  treatment: '', notes: '', fee: '', followUpOn: '',
}

export default function PacientesPage({ data }: { data: PacientesData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [pacientes, setPacientes] = useState<PatientRow[]>(data.pacientes)
  const [total, setTotal] = useState(data.pacientesTotal)
  const [consultas, setConsultas] = useState(data.consultas)
  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const [tab, setTab] = useState('pacientes')
  const [statusFilter, setStatusFilter] = useState('Activo')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [patientOpen, setPatientOpen] = useState(false)
  const [visitOpen, setVisitOpen] = useState(false)
  const [patientForm, setPatientForm] = useState(EMPTY_PATIENT)
  const [visitForm, setVisitForm] = useState(EMPTY_VISIT)

  function apply(next: PacientesData) {
    setPacientes(next.pacientes)
    setTotal(next.pacientesTotal)
    setConsultas(next.consultas)
  }

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMorePacientes(pacientes.length)
      if (!result.ok) { setLoadMoreError(result.error); return }
      setPacientes((prev) => {
        const seen = new Set(prev.map((r) => r.id))
        return [...prev, ...result.data.rows.filter((r) => !seen.has(r.id))]
      })
      setTotal(result.data.total)
    })
  }

  const professionalName = useMemo(() => {
    const byId = new Map(data.roster.map((r) => [r.employeeId, r.fullName]))
    return (id: string | null) => (id ? byId.get(id) ?? '—' : 'Sin asignar')
  }, [data.roster])

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return {
      active: pacientes.filter((p) => p.status === 'Activo').length,
      visits: consultas.length,
      // Follow-ups already due and not yet turned into a visit. This is the
      // recall list a clinic works from.
      followUps: consultas.filter((c) => c.followUpOn !== null && c.followUpOn <= today).length,
      allergies: pacientes.filter((p) => p.allergies.trim() !== '').length,
    }
  }, [pacientes, consultas])

  const visible = pacientes.filter((p) => statusFilter === 'Todos' || p.status === statusFilter)
  const patientOptions = pacientes.map((p) => ({
    value: p.id,
    label: p.documentId ? `${p.fullName} · ${p.documentId}` : p.fullName,
  }))

  function changeStatus(p: PatientRow, status: string) {
    startTransition(async () => {
      const result = await setPacienteStatus({ id: p.id, status: status as never })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast(`${p.fullName}: ${status.toLowerCase()}`, 'ok')
    })
  }

  function remove(p: PatientRow) {
    if (!window.confirm(`¿Eliminar la historia de ${p.fullName}? Se eliminan también sus consultas.`)) return
    startTransition(async () => {
      const result = await deletePaciente(p.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Paciente eliminado', 'ok')
    })
  }

  function submitPatient() {
    startTransition(async () => {
      const result = await createPaciente({
        fullName: patientForm.fullName,
        documentId: patientForm.documentId,
        birthDate: orNull(patientForm.birthDate),
        sex: (orNull(patientForm.sex) as 'F' | 'M' | 'Otro' | null),
        bloodType: (orNull(patientForm.bloodType) as never),
        email: patientForm.email || null,
        phone: patientForm.phone,
        address: patientForm.address,
        insurer: patientForm.insurer,
        allergies: patientForm.allergies,
        conditions: patientForm.conditions,
        emergencyContact: patientForm.emergencyContact,
        emergencyPhone: patientForm.emergencyPhone,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setPatientForm(EMPTY_PATIENT)
      setPatientOpen(false)
      addToast('Paciente registrado', 'ok')
    })
  }

  function submitVisit() {
    startTransition(async () => {
      const result = await registrarConsulta({
        patientId: visitForm.patientId,
        kind: visitForm.kind as never,
        professionalId: visitForm.professionalId || null,
        reason: visitForm.reason,
        diagnosis: visitForm.diagnosis,
        treatment: visitForm.treatment,
        notes: visitForm.notes,
        feeCents: toCents(visitForm.fee),
        followUpOn: orNull(visitForm.followUpOn),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setVisitForm(EMPTY_VISIT)
      setVisitOpen(false)
      addToast('Consulta registrada', 'ok')
    })
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat icon={<Users size={16} />} tone="blu" label="Pacientes activos"
            value={stats.active} sub={`de ${pacientes.length} en la historia`} />
        </div>
        <div className="rise d2">
          <Stat icon={<Stethoscope size={16} />} tone="vio" label="Consultas registradas"
            value={stats.visits} />
        </div>
        <div className="rise d3">
          <Stat icon={<Calendar size={16} />} tone="amb" label="Controles pendientes"
            value={stats.followUps} sub="con fecha ya cumplida" />
        </div>
        <div className="rise d4">
          <Stat icon={<AlertTriangle size={16} />} tone="red" label="Con alergias registradas"
            value={stats.allergies} />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <TabBar
            items={[
              { key: 'pacientes', label: 'Pacientes' },
              { key: 'consultas', label: 'Consultas' },
            ]}
            value={tab}
            onChange={setTab}
          />
          {data.canWrite && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" disabled={pending || pacientes.length === 0}
                onClick={() => {
                  setVisitForm({ ...EMPTY_VISIT, patientId: pacientes[0]?.id ?? '' })
                  setVisitOpen(true)
                }}>
                <Stethoscope size={15} />Consulta
              </button>
              <button className="btn dark" disabled={pending} onClick={() => setPatientOpen(true)}>
                <Plus size={15} />Paciente
              </button>
            </div>
          )}
        </div>

        {tab === 'pacientes' && (
          <>
            <div className="cpad" style={{ paddingBottom: 0 }}>
              <div style={{ maxWidth: 220 }}>
                <Select value={statusFilter} onChange={setStatusFilter}
                  options={['Todos', ...PATIENT_STATUSES]} />
              </div>
            </div>

            <div className="tblwrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Paciente</th>
                    <th scope="col">Edad</th>
                    <th scope="col">Asegurador</th>
                    <th scope="col">Consultas</th>
                    <th scope="col">Última</th>
                    <th scope="col">Estado</th>
                    {data.canWrite && <th scope="col" aria-label="Acciones" />}
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <tr>
                      <td colSpan={data.canWrite ? 7 : 6}>
                        <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                          {pacientes.length === 0
                            ? 'Todavía no hay pacientes registrados.'
                            : 'No hay pacientes con ese estado.'}
                        </div>
                      </td>
                    </tr>
                  ) : visible.map((p) => (
                    [
                      <tr key={p.id} className="trow"
                        onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                        <td>
                          <div className="cename">
                            {p.fullName}
                            {p.allergies.trim() !== '' && (
                              <Badge st="Alergias" tone="red" className="badge-inline" />
                            )}
                          </div>
                          <div className="elsub mono">
                            {p.code}{p.documentId && ` · ${p.documentId}`}
                            {p.bloodType && ` · ${p.bloodType}`}
                          </div>
                        </td>
                        <td>{p.age === null ? '—' : `${p.age} años`}</td>
                        <td>{p.insurer || '—'}</td>
                        <td>{p.visits}</td>
                        <td>{formatDate(p.lastVisitAt)}</td>
                        <td>
                          <Badge st={p.status}
                            tone={p.status === 'Activo' ? 'grn'
                              : p.status === 'Egresado' ? 'blu' : 'neu'} />
                        </td>
                        {data.canWrite && (
                          <td onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <Select
                                value={p.status}
                                onChange={(next) => { if (next !== p.status) changeStatus(p, next) }}
                                options={[...PATIENT_STATUSES]}
                              />
                              <button className="ibtn" aria-label={`Eliminar a ${p.fullName}`}
                                disabled={pending} onClick={() => remove(p)}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>,
                      expanded === p.id ? (
                        <tr key={`${p.id}-detail`}>
                          <td colSpan={data.canWrite ? 7 : 6} style={{ background: 'var(--bg2)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
                              {p.allergies && (
                                <div className="elrow">
                                  <div className="eltxt">
                                    <div className="cename">Alergias</div>
                                    <div className="elsub">{p.allergies}</div>
                                  </div>
                                </div>
                              )}
                              {p.conditions && (
                                <div className="elrow">
                                  <div className="eltxt">
                                    <div className="cename">Antecedentes</div>
                                    <div className="elsub">{p.conditions}</div>
                                  </div>
                                </div>
                              )}
                              {p.emergencyContact && (
                                <div className="elrow">
                                  <div className="eltxt">
                                    <div className="cename">Contacto de emergencia</div>
                                    <div className="elsub">
                                      {p.emergencyContact}
                                      {p.emergencyPhone && ` · ${p.emergencyPhone}`}
                                    </div>
                                  </div>
                                </div>
                              )}
                              {consultas.filter((c) => c.patientId === p.id).slice(0, 5).map((c) => (
                                <div className="elrow" key={c.id}>
                                  <div className="eltxt">
                                    <div className="cename">{c.kind} · {formatDate(c.visitedAt)}</div>
                                    <div className="elsub">
                                      {c.diagnosis || c.reason || 'Sin diagnóstico registrado'}
                                    </div>
                                  </div>
                                  <div className="elsub">{professionalName(c.professionalId)}</div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ) : null,
                    ]
                  ))}
                </tbody>
              </table>
            </div>

            <LoadMore
              loaded={pacientes.length}
              total={total}
              loading={loadingMore}
              error={loadMoreError}
              onLoadMore={loadMore}
              noun="pacientes"
            />
          </>
        )}

        {tab === 'consultas' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Paciente</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Diagnóstico</th>
                  <th scope="col">Profesional</th>
                  <th scope="col">Fecha</th>
                  <th scope="col">Control</th>
                  <th scope="col">Valor</th>
                </tr>
              </thead>
              <tbody>
                {consultas.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        No hay consultas registradas.
                      </div>
                    </td>
                  </tr>
                ) : consultas.map((c) => (
                  <tr key={c.id}>
                    <td><div className="cename">{c.patientName}</div></td>
                    <td>{c.kind}</td>
                    <td>
                      {c.diagnosis || '—'}
                      {c.treatment && <div className="elsub">{c.treatment}</div>}
                    </td>
                    <td>{professionalName(c.professionalId)}</td>
                    <td>{formatDate(c.visitedAt)}</td>
                    <td>{c.followUpOn ? formatDate(`${c.followUpOn}T00:00:00`) : '—'}</td>
                    <td>{c.feeCents > 0 ? pesos(c.feeCents) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FormDrawer
        open={patientOpen}
        onClose={() => setPatientOpen(false)}
        title="Nuevo paciente"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitPatient}>
            <Check size={15} />Registrar
          </button>
        }
      >
        <label className="flabel" htmlFor="pac-name">Nombre completo</label>
        <input id="pac-name" className="field" value={patientForm.fullName}
          onChange={(e) => setPatientForm({ ...patientForm, fullName: e.target.value })} />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="pac-doc">Documento</label>
            <input id="pac-doc" className="field" value={patientForm.documentId}
              onChange={(e) => setPatientForm({ ...patientForm, documentId: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="pac-birth">Fecha de nacimiento</label>
            <input id="pac-birth" className="field" type="date" value={patientForm.birthDate}
              onChange={(e) => setPatientForm({ ...patientForm, birthDate: e.target.value })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <div className="flabel">Sexo</div>
            <Select value={patientForm.sex}
              onChange={(v) => setPatientForm({ ...patientForm, sex: v })}
              placeholder="Sin especificar"
              options={[
                { value: 'F', label: 'Femenino' },
                { value: 'M', label: 'Masculino' },
                { value: 'Otro', label: 'Otro' },
              ]} />
          </div>
          <div>
            <div className="flabel">Tipo de sangre</div>
            <Select value={patientForm.bloodType}
              onChange={(v) => setPatientForm({ ...patientForm, bloodType: v })}
              placeholder="Sin especificar"
              options={[...BLOOD_TYPES]} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="pac-mail">Correo</label>
            <input id="pac-mail" className="field" type="email" value={patientForm.email}
              onChange={(e) => setPatientForm({ ...patientForm, email: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="pac-phone">Teléfono</label>
            <input id="pac-phone" className="field" value={patientForm.phone}
              onChange={(e) => setPatientForm({ ...patientForm, phone: e.target.value })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="pac-addr">Dirección</label>
            <input id="pac-addr" className="field" value={patientForm.address}
              onChange={(e) => setPatientForm({ ...patientForm, address: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="pac-ins">Asegurador / EPS</label>
            <input id="pac-ins" className="field" value={patientForm.insurer}
              onChange={(e) => setPatientForm({ ...patientForm, insurer: e.target.value })} />
          </div>
        </div>

        <label className="flabel" htmlFor="pac-all">Alergias</label>
        <textarea id="pac-all" className="field" rows={2} value={patientForm.allergies}
          onChange={(e) => setPatientForm({ ...patientForm, allergies: e.target.value })}
          placeholder="Penicilina, látex…" />

        <label className="flabel" htmlFor="pac-cond">Antecedentes</label>
        <textarea id="pac-cond" className="field" rows={3} value={patientForm.conditions}
          onChange={(e) => setPatientForm({ ...patientForm, conditions: e.target.value })} />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="pac-ec">Contacto de emergencia</label>
            <input id="pac-ec" className="field" value={patientForm.emergencyContact}
              onChange={(e) => setPatientForm({ ...patientForm, emergencyContact: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="pac-ep">Teléfono de emergencia</label>
            <input id="pac-ep" className="field" value={patientForm.emergencyPhone}
              onChange={(e) => setPatientForm({ ...patientForm, emergencyPhone: e.target.value })} />
          </div>
        </div>
      </FormDrawer>

      <FormDrawer
        open={visitOpen}
        onClose={() => setVisitOpen(false)}
        title="Registrar consulta"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitVisit}>
            <Check size={15} />Registrar
          </button>
        }
      >
        <div className="flabel">Paciente</div>
        <Select value={visitForm.patientId}
          onChange={(v) => setVisitForm({ ...visitForm, patientId: v })}
          placeholder="Elige el paciente" options={patientOptions} />

        <div className="fg2">
          <div>
            <div className="flabel">Tipo</div>
            <Select value={visitForm.kind}
              onChange={(v) => setVisitForm({ ...visitForm, kind: v })}
              options={[...VISIT_KINDS]} />
          </div>
          <div>
            <div className="flabel">Profesional</div>
            <Select value={visitForm.professionalId}
              onChange={(v) => setVisitForm({ ...visitForm, professionalId: v })}
              placeholder="Sin asignar"
              options={data.roster.map((r) => ({ value: r.employeeId, label: r.fullName }))} />
          </div>
        </div>

        <label className="flabel" htmlFor="vis-reason">Motivo de consulta</label>
        <input id="vis-reason" className="field" value={visitForm.reason}
          onChange={(e) => setVisitForm({ ...visitForm, reason: e.target.value })} />

        <label className="flabel" htmlFor="vis-diag">Diagnóstico</label>
        <textarea id="vis-diag" className="field" rows={3} value={visitForm.diagnosis}
          onChange={(e) => setVisitForm({ ...visitForm, diagnosis: e.target.value })} />

        <label className="flabel" htmlFor="vis-treat">Tratamiento</label>
        <textarea id="vis-treat" className="field" rows={3} value={visitForm.treatment}
          onChange={(e) => setVisitForm({ ...visitForm, treatment: e.target.value })} />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="vis-fee">Valor (COP)</label>
            <input id="vis-fee" className="field" inputMode="numeric" value={visitForm.fee}
              onChange={(e) => setVisitForm({ ...visitForm, fee: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="vis-follow">Control el</label>
            <input id="vis-follow" className="field" type="date" value={visitForm.followUpOn}
              onChange={(e) => setVisitForm({ ...visitForm, followUpOn: e.target.value })} />
          </div>
        </div>

        <label className="flabel" htmlFor="vis-notes">Notas</label>
        <textarea id="vis-notes" className="field" rows={2} value={visitForm.notes}
          onChange={(e) => setVisitForm({ ...visitForm, notes: e.target.value })} />
      </FormDrawer>
    </>
  )
}
