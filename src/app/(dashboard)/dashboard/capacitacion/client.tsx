'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import {
  GraduationCap, Award, AlertTriangle, Check, PenLine, Plus, Trash2, UserPlus, Clock,
} from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import DatePicker from '@/components/ui/DatePicker'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import TabBar from '@/components/ui/TabBar'
import Toggle from '@/components/ui/Toggle'
import FormDrawer from '@/components/ui/FormDrawer'
import LoadMore from '@/components/ui/LoadMore'
import { useApp } from '@/lib/context/AppContext'
import { useConfirm } from '@/lib/context/ConfirmContext'
import { COURSE_MODES, ENROLLMENT_STATUSES, daysUntil, todayIn } from '@/lib/domain'
import { cop } from '@/lib/utils'
import type { CapacitacionData, CourseRow, EnrollmentRow } from '@/server/queries/capacitacion'
import {
  createCourse, updateCourse, deleteCourse, enroll, removeEnrollment, setEnrollmentStatus,
  fetchCertificaciones, createCertificacion, deleteCertificacion,
  type CertificacionRow,
} from '@/server/mutations/capacitacion'
import { fetchMoreCourses } from '@/server/actions/capacitacion'
import { useMember } from '@/lib/context/MemberContext'

const EMPTY_CERT = {
  employeeId: '', name: '', provider: '', issuedOn: '', expiresOn: '',
}

const EMPTY_COURSE = {
  name: '', category: '', mode: 'Presencial', provider: '', instructor: '',
  durationHours: '', cost: '', seats: '', validityMonths: '', isMandatory: false,
  startsOn: '', endsOn: '', description: '',
}

function toCents(value: string): number {
  const n = Number(value.replace(/[^\d]/g, ''))
  return Number.isFinite(n) ? Math.round(n) * 100 : 0
}

function pesos(cents: number): string {
  return cop(Math.round(cents / 100))
}

/** `''` from an empty form field is not the same as `0`. */
function orNull(value: string): string | null {
  return value.trim() === '' ? null : value
}

const DATE = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

function formatDate(iso: string | null): string {
  return iso ? DATE.format(new Date(`${iso}T00:00:00`)) : '—'
}

/**
 * Days until a certification lapses.
 *
 * Negative means it already has. Computed against the start of today so a
 * certificate expiring later today does not read as expired.
 */
export default function CapacitacionPage({ data }: { data: CapacitacionData }) {
  // El «hoy» de la empresa, no el del reloj de quien mira.
  const hoy = todayIn(useMember().timezone)
  const { addToast } = useApp()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()

  const [courses, setCourses] = useState<CourseRow[]>(data.courses)
  const [total, setTotal] = useState(data.coursesTotal)
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>(data.enrollments)
  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const [tab, setTab] = useState('cursos')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [courseOpen, setCourseOpen] = useState(false)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [courseForm, setCourseForm] = useState(EMPTY_COURSE)
  const [courseId, setCourseId] = useState<string | null>(null)
  const [enrollForm, setEnrollForm] = useState({ courseId: '', employeeId: '' })
  const [certificaciones, setCertificaciones] = useState<CertificacionRow[] | null>(null)
  const [certTried, setCertTried] = useState(false)
  const certTriedRef = useRef(false)
  const [certOpen, setCertOpen] = useState(false)
  const [certForm, setCertForm] = useState(EMPTY_CERT)

  function apply(next: CapacitacionData) {
    setCourses(next.courses)
    setTotal(next.coursesTotal)
    setEnrollments(next.enrollments)
  }

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreCourses(courses.length)
      if (!result.ok) { setLoadMoreError(result.error); return }
      setCourses((prev) => {
        const seen = new Set(prev.map((r) => r.id))
        return [...prev, ...result.data.rows.filter((r) => !seen.has(r.id))]
      })
      setTotal(result.data.total)
    })
  }

  const stats = useMemo(() => {
    const active = enrollments.filter((e) => e.status === 'Inscrito' || e.status === 'En curso')
    const certified = enrollments.filter((e) => e.status === 'Aprobado')
    // Within 60 days is the window worth acting on: shorter and there is no
    // time to schedule a course, longer and the list is permanently full.
    const expiring = certified.filter((e) => {
      const days = daysUntil(e.expiresOn, hoy)
      return days !== null && days <= 60
    })
    const invested = courses.reduce((sum, c) => sum + c.costCents * c.enrolled, 0)
    return { active: active.length, certified: certified.length, expiring: expiring.length, invested }
  }, [enrollments, courses, hoy])

  const visibleEnrollments = enrollments.filter(
    (e) => statusFilter === 'Todos' || e.status === statusFilter,
  )

  function changeStatus(row: EnrollmentRow, status: string) {
    startTransition(async () => {
      const result = await setEnrollmentStatus({ id: row.id, status: status as never, score: row.score })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast(`${row.employeeName}: ${status.toLowerCase()}`, 'ok')
    })
  }

  async function drop(row: EnrollmentRow) {
    if (!(await confirm({ title: `¿Quitar a ${row.employeeName} de ${row.courseName}?`, tone: 'danger' }))) return
    startTransition(async () => {
      const result = await removeEnrollment(row.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Inscripción eliminada', 'ok')
    })
  }

  async function removeCourse(course: CourseRow) {
    if (!(await confirm({ title: `¿Eliminar ${course.name}?`, description: 'Se eliminan también sus inscripciones.', tone: 'danger' }))) return
    startTransition(async () => {
      const result = await deleteCourse(course.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Curso eliminado', 'ok')
    })
  }

  function submitCourse() {
    startTransition(async () => {
      const payload = {
        name: courseForm.name,
        category: courseForm.category,
        mode: courseForm.mode as never,
        provider: courseForm.provider,
        instructor: courseForm.instructor,
        durationHours: orNull(courseForm.durationHours),
        costCents: toCents(courseForm.cost),
        seats: orNull(courseForm.seats),
        validityMonths: orNull(courseForm.validityMonths),
        isMandatory: courseForm.isMandatory,
        startsOn: orNull(courseForm.startsOn),
        endsOn: orNull(courseForm.endsOn),
        description: courseForm.description,
      }
      const result = courseId
        ? await updateCourse({ id: courseId, ...payload })
        : await createCourse(payload)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setCourseForm(EMPTY_COURSE)
      setCourseId(null)
      setCourseOpen(false)
      addToast(courseId ? 'Curso actualizado' : 'Curso creado', 'ok')
    })
  }

  function openEdit(course: CourseRow) {
    setCourseForm({
      name: course.name,
      category: course.category,
      mode: course.mode as never,
      provider: course.provider,
      instructor: course.instructor,
      durationHours: course.durationHours !== null ? String(course.durationHours) : '',
      cost: course.costCents > 0 ? String(Math.round(course.costCents / 100)) : '',
      seats: course.seats !== null ? String(course.seats) : '',
      validityMonths: course.validityMonths !== null ? String(course.validityMonths) : '',
      isMandatory: course.isMandatory,
      startsOn: course.startsOn ?? '',
      endsOn: course.endsOn ?? '',
      description: course.description,
    })
    setCourseId(course.id)
    setCourseOpen(true)
  }

  function submitEnroll() {
    startTransition(async () => {
      const result = await enroll(enrollForm)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setEnrollForm({ courseId: '', employeeId: '' })
      setEnrollOpen(false)
      addToast('Persona inscrita', 'ok')
    })
  }

  useEffect(() => {
    // The ref, not the state, is the idempotence guard: mutating it is not a
    // render, so the fetch can start from inside the effect without tripping
    // the set-state-in-effect rule — and the effect cannot re-run a fetch that
    // is still in flight. The state flips only in the async continuation,
    // where it is the "cargando → no se pudo cargar" message.
    if (tab !== 'certificados' || certTriedRef.current) return
    certTriedRef.current = true
    startTransition(async () => {
      const result = await fetchCertificaciones()
      if (!result.ok) { setCertTried(true); addToast(result.error, 'err'); return }
      setCertificaciones(result.data)
    })
  }, [tab, addToast, startTransition])

  function submitCertificacion() {
    startTransition(async () => {
      const result = await createCertificacion({
        employeeId: certForm.employeeId === '' ? null : certForm.employeeId,
        name: certForm.name,
        provider: certForm.provider,
        issuedOn: orNull(certForm.issuedOn),
        expiresOn: orNull(certForm.expiresOn),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setCertificaciones(result.data)
      setCertForm(EMPTY_CERT)
      setCertOpen(false)
      addToast('Certificación creada', 'ok')
    })
  }

  async function removeCertificacion(row: CertificacionRow) {
    if (!(await confirm({ title: `¿Eliminar ${row.name}?`, tone: 'danger' }))) return
    startTransition(async () => {
      const result = await deleteCertificacion(row.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setCertificaciones(result.data)
      addToast('Certificación eliminada', 'ok')
    })
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat icon={<GraduationCap size={16} />} tone="blu" label="Cursos activos"
            value={courses.length} />
        </div>
        <div className="rise d2">
          <Stat icon={<Clock size={16} />} tone="amb" label="En formación" value={stats.active} />
        </div>
        <div className="rise d3">
          <Stat icon={<Award size={16} />} tone="grn" label="Certificaciones vigentes"
            value={stats.certified} />
        </div>
        <div className="rise d4">
          <Stat icon={<AlertTriangle size={16} />} tone="red" label="Por vencer"
            value={stats.expiring} sub="en los próximos 60 días" />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <TabBar
            items={[
              { key: 'cursos', label: 'Cursos' },
              { key: 'inscripciones', label: 'Inscripciones' },
              { key: 'certificados', label: 'Certificados' },
            ]}
            value={tab}
            onChange={setTab}
          />
          {data.canWrite && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" disabled={pending || courses.length === 0}
                onClick={() => {
                  setEnrollForm({ courseId: courses[0]?.id ?? '', employeeId: '' })
                  setEnrollOpen(true)
                }}>
                <UserPlus size={15} />Inscribir
              </button>
<button className="btn dark" disabled={pending} onClick={() => {
                  setCourseId(null)
                  setCourseOpen(true)
                }}>
                  <Plus size={15} />Curso
                </button>
              <button className="btn dark" disabled={pending} onClick={() => {
                  setCertForm(EMPTY_CERT)
                  setCertOpen(true)
                }}>
                  <Plus size={15} />Certificado
                </button>
            </div>
          )}
        </div>

        {tab === 'cursos' && (
          <>
            <div className="tblwrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Curso</th>
                    <th scope="col">Modalidad</th>
                    <th scope="col">Duración</th>
                    <th scope="col">Costo</th>
                    <th scope="col">Inscritos</th>
                    <th scope="col">Vigencia</th>
                    {data.canWrite && <th scope="col" aria-label="Acciones" />}
                  </tr>
                </thead>
                <tbody>
                  {courses.length === 0 ? (
                    <tr>
                      <td colSpan={data.canWrite ? 7 : 6}>
                        <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                          Todavía no hay cursos registrados.
                        </div>
                      </td>
                    </tr>
                  ) : courses.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div className="cename">
                          {c.name}
                          {c.isMandatory && (
                            <Badge st="Obligatorio" tone="red" className="badge-inline" />
                          )}
                        </div>
                        <div className="elsub mono">
                          {c.code ?? '—'}{c.provider && ` · ${c.provider}`}
                          {c.startsOn && ` · ${formatDate(c.startsOn)}`}
                        </div>
                      </td>
                      <td>{c.mode}</td>
                      <td>{c.durationHours !== null ? `${c.durationHours} h` : '—'}</td>
                      <td>{c.costCents > 0 ? pesos(c.costCents) : '—'}</td>
                      <td>
                        {c.enrolled}{c.seats !== null && ` / ${c.seats}`}
                        <div className="elsub">{c.approved} aprobados</div>
                      </td>
                      <td>{c.validityMonths !== null ? `${c.validityMonths} meses` : 'No vence'}</td>
                      {data.canWrite && (
                        <td>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button className="ibtn" aria-label={`Editar ${c.name}`}
                              disabled={pending} onClick={() => openEdit(c)}>
                              <PenLine size={14} />
                            </button>
                            <button className="ibtn" aria-label={`Eliminar ${c.name}`}
                              disabled={pending} onClick={() => removeCourse(c)}>
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
              loaded={courses.length}
              total={total}
              loading={loadingMore}
              error={loadMoreError}
              onLoadMore={loadMore}
              noun="cursos"
            />
          </>
        )}

        {tab === 'inscripciones' && (
          <>
            <div className="cpad" style={{ paddingBottom: 0 }}>
              <div style={{ maxWidth: 240 }}>
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={['Todos', ...ENROLLMENT_STATUSES]}
                />
              </div>
            </div>

            <div className="tblwrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Persona</th>
                    <th scope="col">Curso</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Nota</th>
                    <th scope="col">Vence</th>
                    {data.canWrite && <th scope="col" aria-label="Acciones" />}
                  </tr>
                </thead>
                <tbody>
                  {visibleEnrollments.length === 0 ? (
                    <tr>
                      <td colSpan={data.canWrite ? 6 : 5}>
                        <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                          {enrollments.length === 0
                            ? 'Nadie está inscrito todavía.'
                            : 'No hay inscripciones en ese estado.'}
                        </div>
                      </td>
                    </tr>
                  ) : visibleEnrollments.map((e) => {
                    const days = daysUntil(e.expiresOn, hoy)
                    const lapsed = days !== null && days < 0
                    return (
                      <tr key={e.id}>
                        <td><div className="cename">{e.employeeName}</div></td>
                        <td>{e.courseName}</td>
                        <td>
                          <Badge st={e.status}
                            tone={e.status === 'Aprobado' ? 'grn'
                              : e.status === 'Reprobado' ? 'red'
                              : e.status === 'Cancelado' ? 'neu' : 'amb'} />
                        </td>
                        <td>{e.score !== null ? e.score : '—'}</td>
                        <td>
                          {e.expiresOn === null ? '—' : (
                            <>
                              {formatDate(e.expiresOn)}
                              <div className="elsub" style={{ color: lapsed ? 'var(--red)' : undefined }}>
                                {lapsed ? 'Vencida' : `en ${days} días`}
                              </div>
                            </>
                          )}
                        </td>
                        {data.canWrite && (
                          <td>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <Select
                                value={e.status}
                                onChange={(next) => { if (next !== e.status) changeStatus(e, next) }}
                                options={[...ENROLLMENT_STATUSES]}
                              />
                              <button className="ibtn" aria-label={`Quitar a ${e.employeeName}`}
                                disabled={pending} onClick={() => drop(e)}>
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
          </>
        )}

        {tab === 'certificados' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Certificado</th>
                  <th scope="col">Empleado</th>
                  <th scope="col">Proveedor</th>
                  <th scope="col">Emitido</th>
                  <th scope="col">Vence</th>
                  {data.canWrite && <th scope="col" aria-label="Acciones" />}
                </tr>
              </thead>
              <tbody>
                {certificaciones === null ? (
                  <tr>
                    <td colSpan={data.canWrite ? 6 : 5}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        {certTried
                          ? 'No se pudieron cargar las certificaciones.'
                          : 'Cargando certificaciones…'}
                      </div>
                    </td>
                  </tr>
                ) : certificaciones.length === 0 ? (
                  <tr>
                    <td colSpan={data.canWrite ? 6 : 5}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        Todavía no hay certificaciones registradas.
                      </div>
                    </td>
                  </tr>
                ) : certificaciones.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.employeeName || '—'}</td>
                    <td>{c.provider || '—'}</td>
                    <td>{formatDate(c.issuedOn)}</td>
                    <td>{formatDate(c.expiresOn)}</td>
                    {data.canWrite && (
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="ibtn" aria-label={`Eliminar ${c.name}`}
                            disabled={pending} onClick={() => removeCertificacion(c)}>
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
      </div>

      <FormDrawer
        open={courseOpen}
        onClose={() => setCourseOpen(false)}
        title={courseId ? 'Editar curso' : 'Nuevo curso'}
        footer={
          <button className="btn dark" disabled={pending} onClick={submitCourse}>
            <Check size={15} />{courseId ? 'Guardar cambios' : 'Crear curso'}
          </button>
        }
      >
        <label className="flabel" htmlFor="cur-name">Nombre</label>
        <input id="cur-name" className="field" value={courseForm.name}
          onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
          placeholder="Trabajo seguro en alturas" />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="cur-cat">Categoría</label>
            <input id="cur-cat" className="field" value={courseForm.category}
              onChange={(e) => setCourseForm({ ...courseForm, category: e.target.value })}
              placeholder="HSEQ" />
          </div>
          <div>
            <div className="flabel">Modalidad</div>
            <Select
              value={courseForm.mode}
              onChange={(v) => setCourseForm({ ...courseForm, mode: v })}
              options={[...COURSE_MODES]}
            />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="cur-prov">Proveedor</label>
            <input id="cur-prov" className="field" value={courseForm.provider}
              onChange={(e) => setCourseForm({ ...courseForm, provider: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="cur-inst">Instructor</label>
            <input id="cur-inst" className="field" value={courseForm.instructor}
              onChange={(e) => setCourseForm({ ...courseForm, instructor: e.target.value })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="cur-hrs">Duración (horas)</label>
            <input id="cur-hrs" className="field" type="number" min={0} step="0.5"
              value={courseForm.durationHours}
              onChange={(e) => setCourseForm({ ...courseForm, durationHours: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="cur-cost">Costo por persona (COP)</label>
            <input id="cur-cost" className="field" inputMode="numeric" value={courseForm.cost}
              onChange={(e) => setCourseForm({ ...courseForm, cost: e.target.value })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="cur-seats">Cupos</label>
            <input id="cur-seats" className="field" type="number" min={1} value={courseForm.seats}
              onChange={(e) => setCourseForm({ ...courseForm, seats: e.target.value })}
              placeholder="Sin límite" />
          </div>
          <div>
            <label className="flabel" htmlFor="cur-val">Vigencia (meses)</label>
            <input id="cur-val" className="field" type="number" min={1}
              value={courseForm.validityMonths}
              onChange={(e) => setCourseForm({ ...courseForm, validityMonths: e.target.value })}
              placeholder="No vence" />
          </div>
        </div>

        <div className="fg2">
          <div>
            <div className="flabel">Inicia</div>
            <DatePicker ariaLabel="Inicia" value={courseForm.startsOn}
              onChange={(v) => setCourseForm({ ...courseForm, startsOn: v })} />
          </div>
          <div>
            <div className="flabel">Termina</div>
            <DatePicker ariaLabel="Termina" value={courseForm.endsOn}
              onChange={(v) => setCourseForm({ ...courseForm, endsOn: v })} />
          </div>
        </div>

        <div className="acc" style={{ marginTop: 14 }}>
          <div style={{ flex: 1 }}>
            <div className="act">Curso obligatorio</div>
            <div className="acs">Aparece como pendiente para todo el equipo hasta aprobarse.</div>
          </div>
          <Toggle
            on={courseForm.isMandatory}
            ariaLabel="Curso obligatorio"
            onChange={(next) => setCourseForm({ ...courseForm, isMandatory: next })}
          />
        </div>

        <label className="flabel" htmlFor="cur-desc">Descripción</label>
        <textarea id="cur-desc" className="field" rows={3} value={courseForm.description}
          onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        title="Inscribir a una persona"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitEnroll}>
            <Check size={15} />Inscribir
          </button>
        }
      >
        <div className="flabel">Curso</div>
        <Select
          value={enrollForm.courseId}
          onChange={(v) => setEnrollForm({ ...enrollForm, courseId: v })}
          placeholder="Elige el curso"
          options={courses.map((c) => ({ value: c.id, label: c.name }))}
        />

        <div className="flabel">Persona</div>
        <Select
          value={enrollForm.employeeId}
          onChange={(v) => setEnrollForm({ ...enrollForm, employeeId: v })}
          placeholder="Elige a la persona"
          options={data.roster.map((r) => ({ value: r.employeeId, label: r.fullName }))}
        />
      </FormDrawer>

      <FormDrawer
        open={certOpen}
        onClose={() => setCertOpen(false)}
        title="Nueva certificación"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitCertificacion}>
            <Check size={15} />Crear certificación
          </button>
        }
      >
        <div className="flabel">Persona (opcional)</div>
        <Select
          value={certForm.employeeId}
          onChange={(v) => setCertForm({ ...certForm, employeeId: v })}
          placeholder="Elige a la persona"
          options={[
            { value: '', label: 'Sin asignar' },
            ...data.roster.map((r) => ({ value: r.employeeId, label: r.fullName })),
          ]}
        />

        <label className="flabel" htmlFor="cert-name">Nombre</label>
        <input id="cert-name" className="field" value={certForm.name}
          onChange={(e) => setCertForm({ ...certForm, name: e.target.value })}
          placeholder="Certificación en alturas" />

        <label className="flabel" htmlFor="cert-prov">Proveedor</label>
        <input id="cert-prov" className="field" value={certForm.provider}
          onChange={(e) => setCertForm({ ...certForm, provider: e.target.value })} />

        <div className="fg2">
          <div>
            <div className="flabel">Emitido</div>
            <DatePicker ariaLabel="Emitido" value={certForm.issuedOn}
              onChange={(v) => setCertForm({ ...certForm, issuedOn: v })} />
          </div>
          <div>
            <div className="flabel">Vence</div>
            <DatePicker ariaLabel="Vence" value={certForm.expiresOn}
              onChange={(v) => setCertForm({ ...certForm, expiresOn: v })} />
          </div>
        </div>
      </FormDrawer>
    </>
  )
}
