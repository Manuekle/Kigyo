'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  GraduationCap, Award, AlertTriangle, Check, Plus, Trash2, UserPlus, Clock,
} from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import TabBar from '@/components/ui/TabBar'
import Toggle from '@/components/ui/Toggle'
import FormDrawer from '@/components/ui/FormDrawer'
import LoadMore from '@/components/ui/LoadMore'
import { useApp } from '@/lib/context/AppContext'
import { COURSE_MODES, ENROLLMENT_STATUSES } from '@/lib/domain'
import { cop } from '@/lib/utils'
import type { CapacitacionData, CourseRow, EnrollmentRow } from '@/server/queries/capacitacion'
import {
  createCourse, deleteCourse, enroll, removeEnrollment, setEnrollmentStatus,
} from '@/server/mutations/capacitacion'
import { fetchMoreCourses } from '@/server/actions/capacitacion'

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
function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((new Date(`${iso}T00:00:00`).getTime() - today.getTime()) / 86_400_000)
}

export default function CapacitacionPage({ data }: { data: CapacitacionData }) {
  const { addToast } = useApp()
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
  const [enrollForm, setEnrollForm] = useState({ courseId: '', employeeId: '' })

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
      const days = daysUntil(e.expiresOn)
      return days !== null && days <= 60
    })
    const invested = courses.reduce((sum, c) => sum + c.costCents * c.enrolled, 0)
    return { active: active.length, certified: certified.length, expiring: expiring.length, invested }
  }, [enrollments, courses])

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

  function drop(row: EnrollmentRow) {
    if (!window.confirm(`¿Quitar a ${row.employeeName} de ${row.courseName}?`)) return
    startTransition(async () => {
      const result = await removeEnrollment(row.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Inscripción eliminada', 'ok')
    })
  }

  function removeCourse(course: CourseRow) {
    if (!window.confirm(`¿Eliminar ${course.name}? Se eliminan también sus inscripciones.`)) return
    startTransition(async () => {
      const result = await deleteCourse(course.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Curso eliminado', 'ok')
    })
  }

  function submitCourse() {
    startTransition(async () => {
      const result = await createCourse({
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
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setCourseForm(EMPTY_COURSE)
      setCourseOpen(false)
      addToast('Curso creado', 'ok')
    })
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
              <button className="btn dark" disabled={pending} onClick={() => setCourseOpen(true)}>
                <Plus size={15} />Curso
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
                          <button className="ibtn" aria-label={`Eliminar ${c.name}`}
                            disabled={pending} onClick={() => removeCourse(c)}>
                            <Trash2 size={14} />
                          </button>
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
                    const days = daysUntil(e.expiresOn)
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
      </div>

      <FormDrawer
        open={courseOpen}
        onClose={() => setCourseOpen(false)}
        title="Nuevo curso"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitCourse}>
            <Check size={15} />Crear curso
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
            <label className="flabel" htmlFor="cur-from">Inicia</label>
            <input id="cur-from" className="field" type="date" value={courseForm.startsOn}
              onChange={(e) => setCourseForm({ ...courseForm, startsOn: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="cur-to">Termina</label>
            <input id="cur-to" className="field" type="date" value={courseForm.endsOn}
              onChange={(e) => setCourseForm({ ...courseForm, endsOn: e.target.value })} />
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
    </>
  )
}
