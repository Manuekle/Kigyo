'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { Stethoscope, Check, Plus, PenLine, Trash2, Calendar, AlertTriangle, Users, FileText, Activity } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import DatePicker from '@/components/ui/DatePicker'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import TabBar from '@/components/ui/TabBar'
import FormDrawer from '@/components/ui/FormDrawer'
import LoadMore from '@/components/ui/LoadMore'
import { useApp } from '@/lib/context/AppContext'
import { useConfirm } from '@/lib/context/ConfirmContext'
import { BLOOD_TYPES, PATIENT_STATUSES, VISIT_KINDS } from '@/lib/domain'
import { cop } from '@/lib/utils'
import type { PacientesData, PatientRow, TurnoRow, RecetaRow, LaboratorioRow } from '@/server/queries/pacientes'
import {
  createPaciente, deletePaciente, registrarConsulta, setPacienteStatus, updatePaciente,
  createTurno, setTurnoStatus, deleteTurno, createReceta, deleteReceta,
  atenderTurno,
  crearExamen, setExamenResultado, deleteExamen,
} from '@/server/mutations/pacientes'
import { fetchMorePacientes } from '@/server/actions/pacientes'
import type { OdontologiaData } from '@/server/queries/odontologia'
import type { VeterinariaData } from '@/server/queries/veterinaria'
import type { RadiografiasData } from '@/server/queries/radiografias'
import Odontologia from './Odontologia'
import Veterinaria, { type VeterinariaHandle, type VeterinariaSection } from './Veterinaria'
import ImagenesPaciente from './ImagenesPaciente'

const DATE = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

const DATETIME = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

function formatDate(iso: string | null): string {
  return iso ? DATE.format(new Date(iso)) : '—'
}

function formatDateTime(iso: string | null): string {
  return iso ? DATETIME.format(new Date(iso)) : '—'
}

const TURNO_KINDS = ['Consulta', 'Control', 'Vacunación', 'Examen', 'Otro'] as const
const TURNO_STATUSES = ['Programada', 'Confirmada', 'En sala', 'Atendida', 'Cancelada', 'No asistió'] as const

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

function toForm(p: PatientRow) {
  return {
    fullName: p.fullName, documentId: p.documentId, birthDate: p.birthDate ?? '',
    sex: p.sex ?? '', bloodType: p.bloodType ?? '', email: p.email ?? '',
    phone: p.phone, address: p.address, insurer: p.insurer, allergies: p.allergies,
    conditions: p.conditions, emergencyContact: p.emergencyContact,
    emergencyPhone: p.emergencyPhone,
  }
}

const EMPTY_VISIT = {
  patientId: '', kind: 'Consulta', professionalId: '', reason: '', diagnosis: '',
  treatment: '', notes: '', fee: '', followUpOn: '',
}

const EMPTY_TURNO = {
  patientId: '', kind: 'Consulta', scheduledFor: '', professionalId: '',
  reason: '', notes: '',
}

const EMPTY_RECETA = {
  patientId: '', medication: '', dose: '', frequency: '', instructions: '',
  prescribedOn: '', professionalId: '',
}

const EMPTY_EXAMEN = {
  patientId: '', testName: '', orderedOn: '',
}

interface Props {
  data: PacientesData
  /**
   * Lo dental, o null cuando esta clínica no es odontológica.
   *
   * Null es la señal de que las tres pestañas no se dibujan. Es presentación:
   * el permiso es el mismo (`pacientes:read`) y las tablas siguen siendo
   * legibles por RLS — una clínica que se reclasifica ve sus datos intactos.
   */
  odonto: OdontologiaData | null
  /**
   * Lo veterinario, o null cuando esta clínica no es veterinaria.
   *
   * Igual que `odonto`: es presentación, el permiso sigue siendo
   * `pacientes:read`.
   */
  vet: VeterinariaData | null
  /** Imágenes diagnósticas: todas las ramas de salud. */
  imagenes: RadiografiasData
  catalogo: Array<{ id: string; name: string; priceCents: number }>
}

export default function PacientesPage({ data, odonto: odontoInitial, vet: vetInitial, imagenes: imagenesInitial, catalogo }: Props) {
  const [odonto, setOdonto] = useState<OdontologiaData | null>(odontoInitial)
  const [vet, setVet] = useState<VeterinariaData | null>(vetInitial)
  const [imagenes, setImagenes] = useState<RadiografiasData>(imagenesInitial)
  const { addToast } = useApp()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()

  const [pacientes, setPacientes] = useState<PatientRow[]>(data.pacientes)
  const [total, setTotal] = useState(data.pacientesTotal)
  const [consultas, setConsultas] = useState(data.consultas)
  const [turnos, setTurnos] = useState(data.turnos)
  const [recetas, setRecetas] = useState(data.recetas)
  const [laboratorio, setLaboratorio] = useState(data.laboratorio)
  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const [tab, setTab] = useState('pacientes')
  const [statusFilter, setStatusFilter] = useState('Activo')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [patientOpen, setPatientOpen] = useState(false)
  const [visitOpen, setVisitOpen] = useState(false)
  const [turnoOpen, setTurnoOpen] = useState(false)
  const [recetaOpen, setRecetaOpen] = useState(false)
  const [examenOpen, setExamenOpen] = useState(false)
  const [patientForm, setPatientForm] = useState(EMPTY_PATIENT)
  const [editing, setEditing] = useState<PatientRow | null>(null)
  const [visitForm, setVisitForm] = useState(EMPTY_VISIT)
  const [turnoForm, setTurnoForm] = useState(EMPTY_TURNO)
  const [recetaForm, setRecetaForm] = useState(EMPTY_RECETA)
  const [examenForm, setExamenForm] = useState(EMPTY_EXAMEN)
  const [labResultFor, setLabResultFor] = useState<string | null>(null)
  const [labResultText, setLabResultText] = useState('')
  const vetRef = useRef<VeterinariaHandle>(null)

  function apply(next: PacientesData) {
    setPacientes(next.pacientes)
    setTotal(next.pacientesTotal)
    setConsultas(next.consultas)
    setTurnos(next.turnos)
    setRecetas(next.recetas)
    setLaboratorio(next.laboratorio)
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
      turnosToday: turnos.filter((t) => t.scheduledFor.slice(0, 10) === today).length,
      pendExamenes: laboratorio.filter((l) => l.status !== 'Resultado').length,
    }
  }, [pacientes, consultas, turnos, laboratorio])

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

  async function remove(p: PatientRow) {
    if (!(await confirm({ title: `¿Eliminar la historia de ${p.fullName}?`, description: 'Se eliminan también sus consultas.', tone: 'danger' }))) return
    startTransition(async () => {
      const result = await deletePaciente(p.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Paciente eliminado', 'ok')
    })
  }

  function edit(p: PatientRow) {
    setPatientForm(toForm(p))
    setEditing(p)
    setPatientOpen(true)
  }

  function submitPatient() {
    startTransition(async () => {
      const payload = {
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
      }
      const result = editing
        ? await updatePaciente({ ...payload, id: editing.id })
        : await createPaciente(payload)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setPatientForm(EMPTY_PATIENT)
      setEditing(null)
      setPatientOpen(false)
      addToast(editing ? 'Paciente actualizado' : 'Paciente registrado', 'ok')
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

  function changeTurnoStatus(t: TurnoRow, status: string) {
    startTransition(async () => {
      const result = await setTurnoStatus({ id: t.id, status: status as never })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast(`Turno de ${t.patientName}: ${status.toLowerCase()}`, 'ok')
    })
  }

  async function atender(t: TurnoRow) {
    if (!(await confirm({ title: `¿Registrar la consulta de ${t.patientName} y marcar el turno como atendido?` }))) return
    startTransition(async () => {
      const result = await atenderTurno(t.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Consulta registrada desde el turno', 'ok')
    })
  }

  async function removeTurno(t: TurnoRow) {
    if (!(await confirm({ title: `¿Eliminar el turno de ${t.patientName}?`, tone: 'danger' }))) return
    startTransition(async () => {
      const result = await deleteTurno(t.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Turno eliminado', 'ok')
    })
  }

  function submitTurno() {
    if (!turnoForm.scheduledFor) { addToast('Escribe una fecha y hora.', 'err'); return }
    startTransition(async () => {
      const result = await createTurno({
        patientId: turnoForm.patientId,
        kind: turnoForm.kind as never,
        scheduledFor: new Date(turnoForm.scheduledFor).toISOString(),
        professionalId: turnoForm.professionalId || null,
        reason: turnoForm.reason,
        notes: turnoForm.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setTurnoForm(EMPTY_TURNO)
      setTurnoOpen(false)
      addToast('Turno registrado', 'ok')
    })
  }

  async function removeReceta(r: RecetaRow) {
    if (!(await confirm({ title: `¿Eliminar la receta de ${r.medication}?`, tone: 'danger' }))) return
    startTransition(async () => {
      const result = await deleteReceta(r.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Receta eliminada', 'ok')
    })
  }

  function submitReceta() {
    startTransition(async () => {
      const result = await createReceta({
        patientId: recetaForm.patientId,
        medication: recetaForm.medication,
        dose: recetaForm.dose,
        frequency: recetaForm.frequency,
        instructions: recetaForm.instructions,
        prescribedOn: orNull(recetaForm.prescribedOn),
        professionalId: recetaForm.professionalId || null,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setRecetaForm(EMPTY_RECETA)
      setRecetaOpen(false)
      addToast('Receta registrada', 'ok')
    })
  }

  async function removeExamen(e: LaboratorioRow) {
    if (!(await confirm({ title: `¿Eliminar el examen ${e.testName}?`, tone: 'danger' }))) return
    startTransition(async () => {
      const result = await deleteExamen(e.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Examen eliminado', 'ok')
    })
  }

  function submitExamen() {
    startTransition(async () => {
      const result = await crearExamen({
        patientId: examenForm.patientId,
        testName: examenForm.testName,
        orderedOn: orNull(examenForm.orderedOn),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setExamenForm(EMPTY_EXAMEN)
      setExamenOpen(false)
      addToast('Examen solicitado', 'ok')
    })
  }

  function openLabResult(e: LaboratorioRow) {
    setLabResultFor(e.id)
    setLabResultText(e.result)
  }

  function submitLabResult() {
    startTransition(async () => {
      const result = await setExamenResultado({
        id: labResultFor ?? '',
        result: labResultText,
        status: 'Resultado',
        resultOn: new Date().toISOString().slice(0, 10),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setLabResultFor(null)
      setLabResultText('')
      addToast('Resultado guardado', 'ok')
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
        <div className="rise d5">
          <Stat icon={<Calendar size={16} />} tone="blu" label="Turnos hoy"
            value={stats.turnosToday} />
        </div>
        <div className="rise d6">
          <Stat icon={<Activity size={16} />} tone="vio" label="Exámenes pendientes"
            value={stats.pendExamenes} />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <TabBar
items={[
                { key: 'pacientes', label: 'Pacientes' },
                { key: 'consultas', label: 'Consultas' },
                { key: 'turnos', label: 'Turnos' },
                { key: 'recetas', label: 'Recetas' },
                { key: 'laboratorio', label: 'Laboratorio' },
                // Solo para odontología. Ver la nota sobre `odonto` arriba.
                ...(odonto ? [
                  { key: 'odontograma', label: 'Odontograma' },
                  { key: 'tratamientos', label: 'Tratamientos' },
                  { key: 'labdental', label: 'Lab. dental' },
                ] : []),
                // Solo para veterinaria. Mismo criterio que odonto.
                ...(vet ? [
                  { key: 'mascotas', label: 'Mascotas' },
                  { key: 'vacunas', label: 'Vacunas' },
                  { key: 'hospitalizacion', label: 'Hospitalización' },
                ] : []),
                // Todas las ramas de salud: la imagen diagnóstica es clínica.
                { key: 'imagenes', label: 'Imágenes' },
              ]}
              value={tab}
              onChange={setTab}
            />
            {data.canWrite && (
              <div style={{ display: 'flex', gap: 8 }}>
                {(tab === 'pacientes' || tab === 'consultas') && (
                  <>
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
                  </>
                )}
                {tab === 'turnos' && (
                  <button className="btn dark" disabled={pending} onClick={() => {
                    setTurnoForm({ ...EMPTY_TURNO, patientId: pacientes[0]?.id ?? '' })
                    setTurnoOpen(true)
                  }}>
                    <Calendar size={15} />Nuevo turno
                  </button>
                )}
                {tab === 'recetas' && (
                  <button className="btn dark" disabled={pending} onClick={() => {
                    setRecetaForm({ ...EMPTY_RECETA, patientId: pacientes[0]?.id ?? '' })
                    setRecetaOpen(true)
                  }}>
                    <FileText size={15} />Nueva receta
                  </button>
                )}
                {tab === 'laboratorio' && (
                  <button className="btn dark" disabled={pending} onClick={() => {
                    setExamenForm({ ...EMPTY_EXAMEN, patientId: pacientes[0]?.id ?? '' })
                    setExamenOpen(true)
                  }}>
                    <Activity size={15} />Solicitar examen
                  </button>
                )}
                {vet && (tab === 'mascotas' || tab === 'vacunas' || tab === 'hospitalizacion') && (
                  <button className="btn dark" disabled={pending || (tab === 'mascotas' ? pacientes.length === 0 : vet.pets.length === 0)}
                    onClick={() => vetRef.current?.open(tab as VeterinariaSection)}>
                    <Plus size={15} />{tab === 'mascotas' ? 'Nueva mascota' : tab === 'vacunas' ? 'Registrar vacuna' : 'Nuevo ingreso'}
                  </button>
                )}
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
                              <button className="ibtn" aria-label={`Editar a ${p.fullName}`}
                                disabled={pending} onClick={() => edit(p)}>
                                <PenLine size={14} />
                              </button>
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

        {tab === 'turnos' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Paciente</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Profesional</th>
                  <th scope="col">Estado</th>
                  {data.canWrite && <th scope="col" aria-label="Acciones" />}
                </tr>
              </thead>
              <tbody>
                {turnos.length === 0 ? (
                  <tr>
                    <td colSpan={data.canWrite ? 6 : 5}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        Todavía no hay turnos programados.
                      </div>
                    </td>
                  </tr>
                ) : turnos.map((t) => (
                  <tr key={t.id}>
                    <td>{formatDateTime(t.scheduledFor)}</td>
                    <td><div className="cename">{t.patientName}</div></td>
                    <td>{t.kind}</td>
                    <td>{professionalName(t.professionalId)}</td>
                    <td>
                      <Badge st={t.status}
                        tone={t.status === 'Atendida' ? 'grn'
                          : t.status === 'Cancelada' || t.status === 'No asistió' ? 'red' : 'amb'} />
                    </td>
                    {data.canWrite && (
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <Select
                            value={t.status}
                            onChange={(next) => { if (next !== t.status) changeTurnoStatus(t, next) }}
                            options={[...TURNO_STATUSES]}
                          />
                          {(t.status === 'Programada' || t.status === 'Confirmada') && (
                            <button className="btn" disabled={pending} onClick={() => atender(t)}>
                              <Stethoscope size={15} />Atender
                            </button>
                          )}
                          <button className="ibtn" aria-label={`Eliminar turno de ${t.patientName}`}
                            disabled={pending} onClick={() => removeTurno(t)}>
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

        {tab === 'recetas' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Medicamento</th>
                  <th scope="col">Paciente</th>
                  <th scope="col">Dosis</th>
                  <th scope="col">Frecuencia</th>
                  <th scope="col">Indicaciones</th>
                  <th scope="col">Fecha</th>
                  {data.canWrite && <th scope="col" aria-label="Acciones" />}
                </tr>
              </thead>
              <tbody>
                {recetas.length === 0 ? (
                  <tr>
                    <td colSpan={data.canWrite ? 7 : 6}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        Todavía no hay recetas registradas.
                      </div>
                    </td>
                  </tr>
                ) : recetas.map((r) => (
                  <tr key={r.id}>
                    <td><div className="cename">{r.medication}</div></td>
                    <td>{r.patientName}</td>
                    <td>{r.dose || '—'}</td>
                    <td>{r.frequency || '—'}</td>
                    <td>{r.instructions || '—'}</td>
                    <td>{r.prescribedOn ? formatDate(`${r.prescribedOn}T00:00:00`) : '—'}</td>
                    {data.canWrite && (
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button className="ibtn" aria-label={`Eliminar receta de ${r.medication}`}
                            disabled={pending} onClick={() => removeReceta(r)}>
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

        {tab === 'laboratorio' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Examen</th>
                  <th scope="col">Paciente</th>
                  <th scope="col">Solicitado</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Resultado</th>
                  {data.canWrite && <th scope="col" aria-label="Acciones" />}
                </tr>
              </thead>
              <tbody>
                {laboratorio.length === 0 ? (
                  <tr>
                    <td colSpan={data.canWrite ? 6 : 5}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        Todavía no hay exámenes solicitados.
                      </div>
                    </td>
                  </tr>
                ) : laboratorio.map((e) => (
                  <tr key={e.id}>
                    <td><div className="cename">{e.testName}</div></td>
                    <td>{e.patientName}</td>
                    <td>{e.orderedOn ? formatDate(`${e.orderedOn}T00:00:00`) : '—'}</td>
                    <td>
                      <Badge st={e.status}
                        tone={e.status === 'Resultado' ? 'grn'
                          : e.status === 'En proceso' ? 'amb' : 'blu'} />
                    </td>
                    <td>{e.status === 'Resultado' ? (e.result || '—') : '—'}</td>
                    {data.canWrite && (
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {e.status !== 'Resultado' && (
                            <button className="btn" disabled={pending}
                              onClick={() => openLabResult(e)}>
                              Resultado
                            </button>
                          )}
                          <button className="ibtn" aria-label={`Eliminar examen ${e.testName}`}
                            disabled={pending} onClick={() => removeExamen(e)}>
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

        {/* Las tres pantallas de odontología. Se dibujan dentro de la misma
            tarjeta y bajo el mismo permiso: son profundidad de `pacientes`,
            no un módulo aparte. Ver la migración 45. */}
        {odonto && (tab === 'odontograma' || tab === 'tratamientos' || tab === 'labdental') && (
          <Odontologia
            section={tab}
            data={odonto}
            onData={setOdonto}
            pacientes={pacientes.map((p) => ({ id: p.id, fullName: p.fullName }))}
            roster={data.roster}
            catalogo={catalogo}
          />
        )}

        {/* Lo veterinario, bajo el mismo permiso y dentro de la misma tarjeta.
            Ver la migración 65. */}
        {vet && (tab === 'mascotas' || tab === 'vacunas' || tab === 'hospitalizacion') && (
          <Veterinaria
            section={tab}
            data={vet}
            onData={setVet}
            pacientes={pacientes.map((p) => ({ id: p.id, fullName: p.fullName }))}
            ref={vetRef}
          />
        )}

        {/* La galería de imágenes diagnósticas. Ver la migración 66. */}
        {tab === 'imagenes' && (
          <ImagenesPaciente
            data={imagenes}
            onData={setImagenes}
            pacientes={pacientes.map((p) => ({ id: p.id, fullName: p.fullName }))}
          />
        )}
      </div>

      <FormDrawer
        open={patientOpen}
        onClose={() => setPatientOpen(false)}
        title={editing ? 'Editar paciente' : 'Nuevo paciente'}
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
            <div className="flabel">Fecha de nacimiento</div>
            <DatePicker ariaLabel="Fecha de nacimiento" value={patientForm.birthDate}
              onChange={(v) => setPatientForm({ ...patientForm, birthDate: v })} />
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
            <div className="flabel">Control el</div>
            <DatePicker ariaLabel="Control el" value={visitForm.followUpOn}
              onChange={(v) => setVisitForm({ ...visitForm, followUpOn: v })} />
          </div>
        </div>

        <label className="flabel" htmlFor="vis-notes">Notas</label>
        <textarea id="vis-notes" className="field" rows={2} value={visitForm.notes}
          onChange={(e) => setVisitForm({ ...visitForm, notes: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={turnoOpen}
        onClose={() => setTurnoOpen(false)}
        title="Nuevo turno"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitTurno}>
            <Check size={15} />Agendar
          </button>
        }
      >
        <div className="flabel">Paciente</div>
        <Select value={turnoForm.patientId}
          onChange={(v) => setTurnoForm({ ...turnoForm, patientId: v })}
          placeholder="Elige el paciente" options={patientOptions} />

        <div className="fg2">
          <div>
            <div className="flabel">Tipo</div>
            <Select value={turnoForm.kind}
              onChange={(v) => setTurnoForm({ ...turnoForm, kind: v })}
              options={[...TURNO_KINDS]} />
          </div>
          <div>
            <div className="flabel">Profesional</div>
            <Select value={turnoForm.professionalId}
              onChange={(v) => setTurnoForm({ ...turnoForm, professionalId: v })}
              placeholder="Sin asignar"
              options={data.roster.map((r) => ({ value: r.employeeId, label: r.fullName }))} />
          </div>
        </div>

        <div className="flabel">Fecha y hora</div>
        <DatePicker withTime ariaLabel="Fecha y hora" value={turnoForm.scheduledFor}
          onChange={(v) => setTurnoForm({ ...turnoForm, scheduledFor: v })} />

        <label className="flabel" htmlFor="tur-reason">Motivo</label>
        <input id="tur-reason" className="field" value={turnoForm.reason}
          onChange={(e) => setTurnoForm({ ...turnoForm, reason: e.target.value })} />

        <label className="flabel" htmlFor="tur-notes">Notas</label>
        <textarea id="tur-notes" className="field" rows={2} value={turnoForm.notes}
          onChange={(e) => setTurnoForm({ ...turnoForm, notes: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={recetaOpen}
        onClose={() => setRecetaOpen(false)}
        title="Nueva receta"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitReceta}>
            <Check size={15} />Registrar
          </button>
        }
      >
        <div className="flabel">Paciente</div>
        <Select value={recetaForm.patientId}
          onChange={(v) => setRecetaForm({ ...recetaForm, patientId: v })}
          placeholder="Elige el paciente" options={patientOptions} />

        <label className="flabel" htmlFor="rec-med">Medicamento</label>
        <input id="rec-med" className="field" value={recetaForm.medication}
          onChange={(e) => setRecetaForm({ ...recetaForm, medication: e.target.value })} />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="rec-dose">Dosis</label>
            <input id="rec-dose" className="field" value={recetaForm.dose}
              onChange={(e) => setRecetaForm({ ...recetaForm, dose: e.target.value })}
              placeholder="500 mg" />
          </div>
          <div>
            <label className="flabel" htmlFor="rec-freq">Frecuencia</label>
            <input id="rec-freq" className="field" value={recetaForm.frequency}
              onChange={(e) => setRecetaForm({ ...recetaForm, frequency: e.target.value })}
              placeholder="Cada 8 horas" />
          </div>
        </div>

        <label className="flabel" htmlFor="rec-inst">Indicaciones</label>
        <textarea id="rec-inst" className="field" rows={2} value={recetaForm.instructions}
          onChange={(e) => setRecetaForm({ ...recetaForm, instructions: e.target.value })} />

        <div className="fg2">
          <div>
            <div className="flabel">Fecha</div>
            <DatePicker ariaLabel="Fecha" value={recetaForm.prescribedOn}
              onChange={(v) => setRecetaForm({ ...recetaForm, prescribedOn: v })} />
          </div>
          <div>
            <div className="flabel">Profesional</div>
            <Select value={recetaForm.professionalId}
              onChange={(v) => setRecetaForm({ ...recetaForm, professionalId: v })}
              placeholder="Sin asignar"
              options={data.roster.map((r) => ({ value: r.employeeId, label: r.fullName }))} />
          </div>
        </div>
      </FormDrawer>

      <FormDrawer
        open={examenOpen}
        onClose={() => setExamenOpen(false)}
        title="Solicitar examen"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitExamen}>
            <Check size={15} />Solicitar
          </button>
        }
      >
        <div className="flabel">Paciente</div>
        <Select value={examenForm.patientId}
          onChange={(v) => setExamenForm({ ...examenForm, patientId: v })}
          placeholder="Elige el paciente" options={patientOptions} />

        <label className="flabel" htmlFor="ex-name">Nombre del examen</label>
        <input id="ex-name" className="field" value={examenForm.testName}
          onChange={(e) => setExamenForm({ ...examenForm, testName: e.target.value })}
          placeholder="Hemograma, TSH…" />

        <div className="flabel">Fecha de solicitud</div>
        <DatePicker ariaLabel="Fecha de solicitud" value={examenForm.orderedOn}
          onChange={(v) => setExamenForm({ ...examenForm, orderedOn: v })} />
      </FormDrawer>

      <FormDrawer
        open={labResultFor !== null}
        onClose={() => { setLabResultFor(null); setLabResultText('') }}
        title="Registrar resultado"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitLabResult}>
            <Check size={15} />Guardar
          </button>
        }
      >
        <label className="flabel" htmlFor="lab-result">Resultado</label>
        <textarea id="lab-result" className="field" rows={6} value={labResultText}
          onChange={(e) => setLabResultText(e.target.value)}
          placeholder="Valores, observaciones, rangos de referencia…" />
      </FormDrawer>
    </>
  )
}
