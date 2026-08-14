'use client'

import { useMemo, useState, useTransition } from 'react'
import { School, BookOpen, Check, Plus, Trash2, Award, Users, PenLine, Clock, FileSpreadsheet } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import TabBar from '@/components/ui/TabBar'
import FormDrawer from '@/components/ui/FormDrawer'
import LoadMore from '@/components/ui/LoadMore'
import { useApp } from '@/lib/context/AppContext'
import { useExport } from '@/lib/hooks/use-export'
import { ACADEMIC_ENROLLMENT_STATUSES, STUDENT_STATUSES } from '@/lib/domain'
import { cop } from '@/lib/utils'
import type { AsistenciaRow, EstudiantesData, HorarioRow, StudentRow } from '@/server/queries/estudiantes'
import {
  calificarMateria, createEstudiante, createHorario, createPrograma,
  deleteAsistencia, deleteEstudiante, deleteHorario, marcarAsistencia,
  matricularMateria, setAsistencia, setEstudianteStatus, updateEstudiante,
} from '@/server/mutations/estudiantes'
import { fetchMoreEstudiantes } from '@/server/actions/estudiantes'

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

const EMPTY_STUDENT = {
  fullName: '', documentId: '', birthDate: '', email: '', phone: '', address: '',
  programId: '', guardianName: '', guardianPhone: '',
}
const EMPTY_PROGRAM = {
  name: '', level: '', durationTerms: '', tuition: '', coordinatorId: '', description: '',
}
const EMPTY_SUBJECT = { studentId: '', subject: '', term: '', teacherId: '' }

const WEEKDAYS = [
  'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo',
]
const EMPTY_HORARIO = {
  subject: '', programId: '', teacherId: '', weekday: 'Lunes',
  startTime: '', endTime: '', classroom: '',
}

export default function EstudiantesPage({ data }: { data: EstudiantesData }) {
  const { runExport, exporting } = useExport()
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [estudiantes, setEstudiantes] = useState<StudentRow[]>(data.estudiantes)
  const [total, setTotal] = useState(data.estudiantesTotal)
  const [programas, setProgramas] = useState(data.programas)
  const [materias, setMaterias] = useState(data.materias)
  const [horarios, setHorarios] = useState(data.horarios)
  const [asistencia, setAsistenciaRows] = useState(data.asistencia)
  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const [tab, setTab] = useState('estudiantes')
  const [statusFilter, setStatusFilter] = useState('Activo')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [studentOpen, setStudentOpen] = useState(false)
  const [programOpen, setProgramOpen] = useState(false)
  const [subjectOpen, setSubjectOpen] = useState(false)
  const [studentForm, setStudentForm] = useState(EMPTY_STUDENT)
  const [editingStudent, setEditingStudent] = useState<string | null>(null)
  const [programForm, setProgramForm] = useState(EMPTY_PROGRAM)
  const [subjectForm, setSubjectForm] = useState(EMPTY_SUBJECT)
  const [horarioOpen, setHorarioOpen] = useState(false)
  const [horarioForm, setHorarioForm] = useState(EMPTY_HORARIO)
  const [attendanceDate, setAttendanceDate] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })

  function apply(next: EstudiantesData) {
    setEstudiantes(next.estudiantes)
    setTotal(next.estudiantesTotal)
    setProgramas(next.programas)
    setMaterias(next.materias)
    setHorarios(next.horarios)
    setAsistenciaRows(next.asistencia)
  }

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreEstudiantes(estudiantes.length)
      if (!result.ok) { setLoadMoreError(result.error); return }
      setEstudiantes((prev) => {
        const seen = new Set(prev.map((r) => r.id))
        return [...prev, ...result.data.rows.filter((r) => !seen.has(r.id))]
      })
      setTotal(result.data.total)
    })
  }

  const teacherName = useMemo(() => {
    const byId = new Map(data.roster.map((r) => [r.employeeId, r.fullName]))
    return (id: string | null) => (id ? byId.get(id) ?? '—' : 'Sin asignar')
  }, [data.roster])

  const stats = useMemo(() => {
    const graded = estudiantes.filter((s) => s.average !== null)
    return {
      active: estudiantes.filter((s) => s.status === 'Activo').length,
      programs: programas.filter((p) => p.isActive).length,
      average: graded.length > 0
        ? Math.round((graded.reduce((s, r) => s + (r.average ?? 0), 0) / graded.length) * 10) / 10
        : null,
      failing: materias.filter((m) => m.status === 'Reprobado').length,
    }
  }, [estudiantes, programas, materias])

  const visible = estudiantes.filter((s) => statusFilter === 'Todos' || s.status === statusFilter)
  const studentOptions = estudiantes.map((s) => ({ value: s.id, label: s.fullName }))

  const exportRows = () => {
    void runExport(
      visible.map((s) => ({
        Código: s.code ?? '',
        Nombre: s.fullName,
        Programa: s.programName ?? '',
        Estado: s.status,
      })),
      'estudiantes-kigyo',
      'estudiantes',
    )
  }

  function changeStatus(s: StudentRow, status: string) {
    startTransition(async () => {
      const result = await setEstudianteStatus({ id: s.id, status: status as never })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast(`${s.fullName}: ${status.toLowerCase()}`, 'ok')
    })
  }

  function changeSubject(id: string, status: string) {
    startTransition(async () => {
      const result = await calificarMateria({
        id, status: status as never, grade: null, attendancePct: null,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
    })
  }

  function setGrade(id: string, current: number | null, value: string) {
    const next = value.trim() === '' ? null : Number(value)
    if (next === null || !Number.isFinite(next) || next === current) return
    startTransition(async () => {
      const result = await calificarMateria({
        id, grade: next, attendancePct: null, status: null,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
    })
  }

  function remove(s: StudentRow) {
    if (!window.confirm(`¿Eliminar a ${s.fullName}? Se eliminan también sus materias.`)) return
    startTransition(async () => {
      const result = await deleteEstudiante(s.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Estudiante eliminado', 'ok')
    })
  }

  function submitStudent() {
    startTransition(async () => {
      const result = await createEstudiante({
        fullName: studentForm.fullName,
        documentId: studentForm.documentId,
        birthDate: orNull(studentForm.birthDate),
        email: studentForm.email || null,
        phone: studentForm.phone,
        address: studentForm.address,
        programId: studentForm.programId || null,
        guardianName: studentForm.guardianName,
        guardianPhone: studentForm.guardianPhone,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setStudentForm(EMPTY_STUDENT)
      setStudentOpen(false)
      addToast('Estudiante registrado', 'ok')
    })
  }

  function startEdit(s: StudentRow) {
    setStudentForm({
      fullName: s.fullName,
      documentId: s.documentId,
      birthDate: s.birthDate ?? '',
      email: s.email ?? '',
      phone: s.phone,
      address: s.address,
      programId: s.programId ?? '',
      guardianName: s.guardianName,
      guardianPhone: s.guardianPhone,
    })
    setEditingStudent(s.id)
    setStudentOpen(true)
  }

  function submitEditStudent() {
    if (!editingStudent) return
    startTransition(async () => {
      const result = await updateEstudiante({
        id: editingStudent,
        fullName: studentForm.fullName,
        documentId: studentForm.documentId,
        birthDate: orNull(studentForm.birthDate),
        email: studentForm.email || null,
        phone: studentForm.phone,
        address: studentForm.address,
        programId: studentForm.programId || null,
        guardianName: studentForm.guardianName,
        guardianPhone: studentForm.guardianPhone,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setStudentForm(EMPTY_STUDENT)
      setEditingStudent(null)
      setStudentOpen(false)
      addToast('Estudiante actualizado', 'ok')
    })
  }

  function submitProgram() {
    startTransition(async () => {
      const result = await createPrograma({
        name: programForm.name,
        level: programForm.level,
        durationTerms: orNull(programForm.durationTerms),
        tuitionCents: toCents(programForm.tuition),
        coordinatorId: programForm.coordinatorId || null,
        description: programForm.description,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setProgramForm(EMPTY_PROGRAM)
      setProgramOpen(false)
      addToast('Programa creado', 'ok')
    })
  }

  function submitSubject() {
    startTransition(async () => {
      const result = await matricularMateria({
        studentId: subjectForm.studentId,
        subject: subjectForm.subject,
        term: subjectForm.term,
        teacherId: subjectForm.teacherId || null,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setSubjectForm(EMPTY_SUBJECT)
      setSubjectOpen(false)
      addToast('Materia matriculada', 'ok')
    })
  }

  function submitHorario() {
    startTransition(async () => {
      const result = await createHorario({
        programId: orNull(horarioForm.programId),
        subject: horarioForm.subject,
        teacherId: orNull(horarioForm.teacherId),
        weekday: horarioForm.weekday as never,
        startTime: horarioForm.startTime,
        endTime: horarioForm.endTime,
        classroom: horarioForm.classroom,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setHorarioForm(EMPTY_HORARIO)
      setHorarioOpen(false)
      addToast('Horario creado', 'ok')
    })
  }

  function removeHorario(h: HorarioRow) {
    if (!window.confirm(`¿Eliminar el horario de ${h.subject}?`)) return
    startTransition(async () => {
      const result = await deleteHorario(h.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Horario eliminado', 'ok')
    })
  }

  function markAttendance(s: StudentRow, present: boolean) {
    const existing = asistencia.find((a) => a.studentId === s.id && a.date === attendanceDate)
    if (existing?.present === present) return
    startTransition(async () => {
      const result = existing
        ? await setAsistencia({ id: existing.id, present })
        : await marcarAsistencia({ studentId: s.id, date: attendanceDate, present, scheduleId: null })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast(present ? `${s.fullName}: presente` : `${s.fullName}: ausente`, 'ok')
    })
  }

  function removeAttendance(a: AsistenciaRow) {
    if (!window.confirm(`¿Quitar la marca de asistencia de ${a.studentName}?`)) return
    startTransition(async () => {
      const result = await deleteAsistencia(a.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Marca eliminada', 'ok')
    })
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat icon={<Users size={16} />} tone="blu" label="Estudiantes activos"
            value={stats.active} sub={`de ${estudiantes.length} matriculados`} />
        </div>
        <div className="rise d2">
          <Stat icon={<BookOpen size={16} />} tone="vio" label="Programas activos"
            value={stats.programs} />
        </div>
        <div className="rise d3">
          <Stat icon={<Award size={16} />} tone="grn" label="Promedio general"
            value={stats.average === null ? '—' : stats.average} />
        </div>
        <div className="rise d4">
          <Stat icon={<School size={16} />} tone="red" label="Materias reprobadas"
            value={stats.failing} />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <TabBar
            items={[
              { key: 'estudiantes', label: 'Estudiantes' },
              { key: 'programas', label: 'Programas' },
              { key: 'materias', label: 'Materias' },
              { key: 'horarios', label: 'Horarios' },
              { key: 'asistencia', label: 'Asistencia' },
            ]}
            value={tab}
            onChange={setTab}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {tab === 'estudiantes' && (
              <button disabled={exporting} aria-busy={exporting} className="btn" onClick={exportRows}><FileSpreadsheet size={15} />Exportar</button>
            )}
            {data.canWrite && (
              <div style={{ display: 'flex', gap: 8 }}>
                {tab === 'programas' ? (
                  <button className="btn dark" disabled={pending} onClick={() => setProgramOpen(true)}>
                    <Plus size={15} />Programa
                  </button>
                ) : tab === 'materias' ? (
                  <button className="btn dark" disabled={pending || estudiantes.length === 0}
                    onClick={() => {
                      setSubjectForm({ ...EMPTY_SUBJECT, studentId: estudiantes[0]?.id ?? '' })
                      setSubjectOpen(true)
                    }}>
                    <Plus size={15} />Matricular
                  </button>
                ) : tab === 'horarios' ? (
                  <button className="btn dark" disabled={pending}
                    onClick={() => { setHorarioForm(EMPTY_HORARIO); setHorarioOpen(true) }}>
                    <Plus size={15} />Horario
                  </button>
                ) : (
                  <button className="btn dark" disabled={pending}
                    onClick={() => { setStudentForm(EMPTY_STUDENT); setEditingStudent(null); setStudentOpen(true) }}>
                    <Plus size={15} />Estudiante
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {tab === 'estudiantes' && (
          <>
            <div className="cpad" style={{ paddingBottom: 0 }}>
              <div style={{ maxWidth: 220 }}>
                <Select value={statusFilter} onChange={setStatusFilter}
                  options={['Todos', ...STUDENT_STATUSES]} />
              </div>
            </div>

            <div className="tblwrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Estudiante</th>
                    <th scope="col">Programa</th>
                    <th scope="col">Materias</th>
                    <th scope="col">Promedio</th>
                    <th scope="col">Acudiente</th>
                    <th scope="col">Estado</th>
                    {data.canWrite && <th scope="col" aria-label="Acciones" />}
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <tr>
                      <td colSpan={data.canWrite ? 7 : 6}>
                        <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                          {estudiantes.length === 0
                            ? 'Todavía no hay estudiantes matriculados.'
                            : 'No hay estudiantes con ese estado.'}
                        </div>
                      </td>
                    </tr>
                  ) : visible.map((s) => (
                    [
                      <tr key={s.id} className="trow"
                        onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                        <td>
                          <div className="cename">{s.fullName}</div>
                          <div className="elsub mono">
                            {s.code}{s.documentId && ` · ${s.documentId}`}
                          </div>
                        </td>
                        <td>{s.programName || '—'}</td>
                        <td>{s.subjects}</td>
                        <td>{s.average === null ? '—' : s.average}</td>
                        <td>
                          {s.guardianName || '—'}
                          {s.guardianPhone && <div className="elsub">{s.guardianPhone}</div>}
                        </td>
                        <td>
                          <Badge st={s.status}
                            tone={s.status === 'Activo' ? 'grn'
                              : s.status === 'Graduado' ? 'blu'
                              : s.status === 'Suspendido' ? 'amb' : 'neu'} />
                        </td>
                        {data.canWrite && (
                          <td onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <Select
                                value={s.status}
                                onChange={(next) => { if (next !== s.status) changeStatus(s, next) }}
                                options={[...STUDENT_STATUSES]}
                              />
                              <button className="ibtn" aria-label={`Editar a ${s.fullName}`}
                                disabled={pending} onClick={() => startEdit(s)}>
                                <PenLine size={14} />
                              </button>
                              <button className="ibtn" aria-label={`Eliminar a ${s.fullName}`}
                                disabled={pending} onClick={() => remove(s)}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>,
                      expanded === s.id ? (
                        <tr key={`${s.id}-subjects`}>
                          <td colSpan={data.canWrite ? 7 : 6} style={{ background: 'var(--bg2)' }}>
                            {materias.filter((m) => m.studentId === s.id).length === 0 ? (
                              <div className="dempty" style={{ padding: '12px 0' }}>
                                Este estudiante no tiene materias matriculadas.
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
                                {materias.filter((m) => m.studentId === s.id).map((m) => (
                                  <div className="elrow" key={m.id}>
                                    <div className="eltxt">
                                      <div className="cename">{m.subject}</div>
                                      <div className="elsub">
                                        {m.term || 'Sin periodo'} · {teacherName(m.teacherId)}
                                        {m.attendancePct !== null && ` · asistencia ${m.attendancePct}%`}
                                      </div>
                                    </div>
                                    <div className="elsub">
                                      {m.grade === null ? 'Sin nota' : m.grade}
                                    </div>
                                    <Badge st={m.status}
                                      tone={m.status === 'Aprobado' ? 'grn'
                                        : m.status === 'Reprobado' ? 'red'
                                        : m.status === 'Retirado' ? 'neu' : 'amb'} />
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ) : null,
                    ]
                  ))}
                </tbody>
              </table>
            </div>

            <LoadMore
              loaded={estudiantes.length}
              total={total}
              loading={loadingMore}
              error={loadMoreError}
              onLoadMore={loadMore}
              noun="estudiantes"
            />
          </>
        )}

        {tab === 'programas' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Programa</th>
                  <th scope="col">Nivel</th>
                  <th scope="col">Duración</th>
                  <th scope="col">Matrícula</th>
                  <th scope="col">Estudiantes</th>
                </tr>
              </thead>
              <tbody>
                {programas.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        No hay programas académicos creados.
                      </div>
                    </td>
                  </tr>
                ) : programas.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="cename">{p.name}</div>
                      <div className="elsub mono">{p.code ?? '—'}</div>
                    </td>
                    <td>{p.level || '—'}</td>
                    <td>{p.durationTerms !== null ? `${p.durationTerms} periodos` : '—'}</td>
                    <td>{p.tuitionCents > 0 ? pesos(p.tuitionCents) : '—'}</td>
                    <td>{p.students}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'materias' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Estudiante</th>
                  <th scope="col">Materia</th>
                  <th scope="col">Periodo</th>
                  <th scope="col">Docente</th>
                  <th scope="col">Nota</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {materias.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        No hay materias matriculadas.
                      </div>
                    </td>
                  </tr>
                ) : materias.map((m) => (
                  <tr key={m.id}>
                    <td><div className="cename">{m.studentName}</div></td>
                    <td>{m.subject}</td>
                    <td>{m.term || '—'}</td>
                    <td>{teacherName(m.teacherId)}</td>
                    <td>
                      {data.canWrite ? (
                        <input className="field" style={{ width: 80 }} type="number"
                          min={0} max={100} step="0.1"
                          defaultValue={m.grade ?? ''}
                          aria-label={`Nota de ${m.subject}`}
                          disabled={pending}
                          onBlur={(e) => setGrade(m.id, m.grade, e.target.value)} />
                      ) : (m.grade ?? '—')}
                    </td>
                    <td>
                      {data.canWrite ? (
                        <Select
                          value={m.status}
                          onChange={(next) => { if (next !== m.status) changeSubject(m.id, next) }}
                          options={[...ACADEMIC_ENROLLMENT_STATUSES]}
                        />
                      ) : (
                        <Badge st={m.status}
                          tone={m.status === 'Aprobado' ? 'grn'
                            : m.status === 'Reprobado' ? 'red' : 'amb'} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'horarios' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Materia</th>
                  <th scope="col">Programa</th>
                  <th scope="col">Docente</th>
                  <th scope="col">Día</th>
                  <th scope="col">Hora</th>
                  <th scope="col">Salón</th>
                  {data.canWrite && <th scope="col" aria-label="Acciones" />}
                </tr>
              </thead>
              <tbody>
                {horarios.length === 0 ? (
                  <tr>
                    <td colSpan={data.canWrite ? 7 : 6}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        No hay horarios creados.
                      </div>
                    </td>
                  </tr>
                ) : horarios.map((h) => (
                  <tr key={h.id}>
                    <td><div className="cename">{h.subject}</div></td>
                    <td>{h.programName || '—'}</td>
                    <td>{h.teacherName || '—'}</td>
                    <td>{h.weekday}</td>
                    <td className="mono">{h.startTime} – {h.endTime}</td>
                    <td>{h.classroom || '—'}</td>
                    {data.canWrite && (
                      <td>
                        <button className="ibtn" aria-label={`Eliminar horario de ${h.subject}`}
                          disabled={pending} onClick={() => removeHorario(h)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'asistencia' && (
          <>
            <div className="cpad" style={{ paddingBottom: 0 }}>
              <div style={{ maxWidth: 220 }}>
                <label className="flabel" htmlFor="att-date">Fecha</label>
                <input id="att-date" className="field" type="date" value={attendanceDate}
                  disabled={pending}
                  onChange={(e) => setAttendanceDate(e.target.value)} />
              </div>
            </div>

            <div className="tblwrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Estudiante</th>
                    <th scope="col">Presente</th>
                    {data.canWrite && <th scope="col" aria-label="Marcar ausente" />}
                    {data.canWrite && <th scope="col" aria-label="Acciones" />}
                  </tr>
                </thead>
                <tbody>
                  {estudiantes.length === 0 ? (
                    <tr>
                      <td colSpan={data.canWrite ? 4 : 2}>
                        <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                          Sin estudiantes para marcar.
                        </div>
                      </td>
                    </tr>
                  ) : estudiantes.map((s) => {
                    const mark = asistencia.find((a) => a.studentId === s.id && a.date === attendanceDate)
                    return (
                      <tr key={s.id}>
                        <td>
                          <div className="cename">{s.fullName}</div>
                          <div className="elsub mono">{s.code}</div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {data.canWrite && (
                              <input type="checkbox" checked={mark?.present ?? false}
                                disabled={pending || (mark?.present ?? false)}
                                aria-label={`Marcar presente a ${s.fullName}`}
                                onChange={() => markAttendance(s, true)} />
                            )}
                            {mark
                              ? <Badge st={mark.present ? 'Presente' : 'Ausente'}
                                tone={mark.present ? 'grn' : 'red'} />
                              : <span className="elsub">Sin marcar</span>}
                          </div>
                        </td>
                        {data.canWrite && (
                          <td>
                            <button className="btn" style={{ padding: '4px 10px' }}
                              disabled={pending || (mark?.present ?? false)}
                              onClick={() => markAttendance(s, false)}>
                              <Clock size={13} />Ausente
                            </button>
                          </td>
                        )}
                        {data.canWrite && (
                          <td>
                            {mark && (
                              <button className="ibtn" aria-label={`Quitar marca de ${s.fullName}`}
                                disabled={pending} onClick={() => removeAttendance(mark)}>
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <FormDrawer
        open={studentOpen}
        onClose={() => setStudentOpen(false)}
        title={editingStudent ? 'Editar estudiante' : 'Nuevo estudiante'}
        footer={
          <button className="btn dark" disabled={pending}
            onClick={editingStudent ? submitEditStudent : submitStudent}>
            <Check size={15} />{editingStudent ? 'Guardar cambios' : 'Matricular'}
          </button>
        }
      >
        <label className="flabel" htmlFor="est-name">Nombre completo</label>
        <input id="est-name" className="field" value={studentForm.fullName}
          onChange={(e) => setStudentForm({ ...studentForm, fullName: e.target.value })} />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="est-doc">Documento</label>
            <input id="est-doc" className="field" value={studentForm.documentId}
              onChange={(e) => setStudentForm({ ...studentForm, documentId: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="est-birth">Fecha de nacimiento</label>
            <input id="est-birth" className="field" type="date" value={studentForm.birthDate}
              onChange={(e) => setStudentForm({ ...studentForm, birthDate: e.target.value })} />
          </div>
        </div>

        <div className="flabel">Programa</div>
        <Select value={studentForm.programId}
          onChange={(v) => setStudentForm({ ...studentForm, programId: v })}
          placeholder="Sin programa"
          options={programas.map((p) => ({ value: p.id, label: p.name }))} />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="est-mail">Correo</label>
            <input id="est-mail" className="field" type="email" value={studentForm.email}
              onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="est-phone">Teléfono</label>
            <input id="est-phone" className="field" value={studentForm.phone}
              onChange={(e) => setStudentForm({ ...studentForm, phone: e.target.value })} />
          </div>
        </div>

        <label className="flabel" htmlFor="est-addr">Dirección</label>
        <input id="est-addr" className="field" value={studentForm.address}
          onChange={(e) => setStudentForm({ ...studentForm, address: e.target.value })} />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="est-guard">Acudiente</label>
            <input id="est-guard" className="field" value={studentForm.guardianName}
              onChange={(e) => setStudentForm({ ...studentForm, guardianName: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="est-gphone">Teléfono del acudiente</label>
            <input id="est-gphone" className="field" value={studentForm.guardianPhone}
              onChange={(e) => setStudentForm({ ...studentForm, guardianPhone: e.target.value })} />
          </div>
        </div>
      </FormDrawer>

      <FormDrawer
        open={programOpen}
        onClose={() => setProgramOpen(false)}
        title="Nuevo programa"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitProgram}>
            <Check size={15} />Crear programa
          </button>
        }
      >
        <label className="flabel" htmlFor="prg-name">Nombre</label>
        <input id="prg-name" className="field" value={programForm.name}
          onChange={(e) => setProgramForm({ ...programForm, name: e.target.value })}
          placeholder="Técnico en electricidad" />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="prg-level">Nivel</label>
            <input id="prg-level" className="field" value={programForm.level}
              onChange={(e) => setProgramForm({ ...programForm, level: e.target.value })}
              placeholder="Técnico, tecnólogo, pregrado…" />
          </div>
          <div>
            <label className="flabel" htmlFor="prg-dur">Duración (periodos)</label>
            <input id="prg-dur" className="field" type="number" min={1}
              value={programForm.durationTerms}
              onChange={(e) => setProgramForm({ ...programForm, durationTerms: e.target.value })} />
          </div>
        </div>

        <label className="flabel" htmlFor="prg-tuition">Matrícula (COP)</label>
        <input id="prg-tuition" className="field" inputMode="numeric" value={programForm.tuition}
          onChange={(e) => setProgramForm({ ...programForm, tuition: e.target.value })} />

        <div className="flabel">Coordinador</div>
        <Select value={programForm.coordinatorId}
          onChange={(v) => setProgramForm({ ...programForm, coordinatorId: v })}
          placeholder="Sin asignar"
          options={data.roster.map((r) => ({ value: r.employeeId, label: r.fullName }))} />

        <label className="flabel" htmlFor="prg-desc">Descripción</label>
        <textarea id="prg-desc" className="field" rows={3} value={programForm.description}
          onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={subjectOpen}
        onClose={() => setSubjectOpen(false)}
        title="Matricular materia"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitSubject}>
            <Check size={15} />Matricular
          </button>
        }
      >
        <div className="flabel">Estudiante</div>
        <Select value={subjectForm.studentId}
          onChange={(v) => setSubjectForm({ ...subjectForm, studentId: v })}
          placeholder="Elige el estudiante" options={studentOptions} />

        <label className="flabel" htmlFor="sub-name">Materia</label>
        <input id="sub-name" className="field" value={subjectForm.subject}
          onChange={(e) => setSubjectForm({ ...subjectForm, subject: e.target.value })}
          placeholder="Matemáticas" />

        <label className="flabel" htmlFor="sub-term">Periodo</label>
        <input id="sub-term" className="field" value={subjectForm.term}
          onChange={(e) => setSubjectForm({ ...subjectForm, term: e.target.value })}
          placeholder="2026-I" />

        <div className="flabel">Docente</div>
        <Select value={subjectForm.teacherId}
          onChange={(v) => setSubjectForm({ ...subjectForm, teacherId: v })}
          placeholder="Sin asignar"
          options={data.roster.map((r) => ({ value: r.employeeId, label: r.fullName }))} />
      </FormDrawer>

      <FormDrawer
        open={horarioOpen}
        onClose={() => setHorarioOpen(false)}
        title="Nuevo horario"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitHorario}>
            <Check size={15} />Crear horario
          </button>
        }
      >
        <label className="flabel" htmlFor="hor-subject">Materia</label>
        <input id="hor-subject" className="field" value={horarioForm.subject}
          onChange={(e) => setHorarioForm({ ...horarioForm, subject: e.target.value })}
          placeholder="Matemáticas" />

        <div className="flabel">Programa</div>
        <Select value={horarioForm.programId}
          onChange={(v) => setHorarioForm({ ...horarioForm, programId: v })}
          placeholder="Sin programa"
          options={programas.map((p) => ({ value: p.id, label: p.name }))} />

        <div className="flabel">Docente</div>
        <Select value={horarioForm.teacherId}
          onChange={(v) => setHorarioForm({ ...horarioForm, teacherId: v })}
          placeholder="Sin asignar"
          options={data.roster.map((r) => ({ value: r.employeeId, label: r.fullName }))} />

        <div className="flabel">Día</div>
        <Select value={horarioForm.weekday}
          onChange={(v) => setHorarioForm({ ...horarioForm, weekday: v })}
          options={WEEKDAYS.map((w) => ({ value: w, label: w }))} />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="hor-start">Hora de inicio</label>
            <input id="hor-start" className="field" type="time" value={horarioForm.startTime}
              onChange={(e) => setHorarioForm({ ...horarioForm, startTime: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="hor-end">Hora de fin</label>
            <input id="hor-end" className="field" type="time" value={horarioForm.endTime}
              onChange={(e) => setHorarioForm({ ...horarioForm, endTime: e.target.value })} />
          </div>
        </div>

        <label className="flabel" htmlFor="hor-room">Salón</label>
        <input id="hor-room" className="field" value={horarioForm.classroom}
          onChange={(e) => setHorarioForm({ ...horarioForm, classroom: e.target.value })}
          placeholder="Aula 101" />
      </FormDrawer>
    </>
  )
}