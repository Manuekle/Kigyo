'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ArrowLeft, MapPin, Shield, Users, AlertTriangle, Plus, Trash2 } from '@/lib/icons'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import DatePicker from '@/components/ui/DatePicker'
import Select from '@/components/ui/Select'
import { activatable } from '@/lib/a11y'
import { useApp } from '@/lib/context/AppContext'
import { useConfirm } from '@/lib/context/ConfirmContext'
import type { EmpleadoDetail } from '@/server/queries/empleados'
import { EMPLOYEE_EVENT_TAGS } from '@/lib/domain'
import {
  addEmpleadoEvent, deleteEmpleadoEvent, deleteEmpleadoSkill, saveEmpleadoSkill,
} from '@/server/mutations/empleados'

const DAY = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })

/** Timeline dot colour by lifecycle tag, matching the `.tlnode` tones. */
const TAG_TONE: Record<string, string> = {
  Ingreso: 'grn',
  Ascenso: 'grn',
  Reconocimiento: 'blu',
  Traslado: 'amb',
  Salida: 'red',
  Otro: 'neu',
}

export default function EmpleadoDetailPage({ data }: { data: EmpleadoDetail }) {
  const router = useRouter()
  const { addToast } = useApp()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()
  const { empleado: emp, managerName, reports, skills, journey, tickets } = data

  const [skillForm, setSkillForm] = useState({ skill: '', level: '3' })
  const [eventForm, setEventForm] = useState({ occurredOn: '', event: '', tag: 'Otro' })

  /**
   * Las dos secciones se escriben desde aquí por primera vez.
   *
   * `employee_skills` y `employee_events` tienen tabla, RLS y unicidad desde la
   * migración 02, y la ficha las leía desde entonces. No existía ni un `insert`
   * en el repositorio, así que «Habilidades» y «Trayectoria» estaban vacías en
   * todas las empresas y no había forma de llenarlas.
   *
   * `router.refresh()` en vez de estado local: la ficha es un server component
   * que ya trae estos datos, y duplicar la lista en el cliente es cómo dos
   * copias se van separando.
   */
  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, ok: string) {
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) { addToast(result.error, 'err'); return }
      addToast(ok, 'ok')
      router.refresh()
    })
  }

  function submitSkill() {
    if (skillForm.skill.trim().length < 2) { addToast('La habilidad necesita un nombre.', 'err'); return }
    run(
      () => saveEmpleadoSkill({
        employeeId: emp.id, skill: skillForm.skill, level: Number(skillForm.level),
      }),
      'Habilidad guardada',
    )
    setSkillForm({ skill: '', level: '3' })
  }

  async function removeSkill(skill: string) {
    if (!(await confirm({ title: `¿Quitar «${skill}»?`, tone: 'danger' }))) return
    run(() => deleteEmpleadoSkill(emp.id, skill), 'Habilidad quitada')
  }

  function submitEvent() {
    if (eventForm.event.trim().length < 2) { addToast('Describe qué pasó.', 'err'); return }
    if (!eventForm.occurredOn) { addToast('Elige la fecha del hito.', 'err'); return }
    run(
      () => addEmpleadoEvent({
        employeeId: emp.id,
        occurredOn: eventForm.occurredOn,
        event: eventForm.event,
        tag: eventForm.tag as (typeof EMPLOYEE_EVENT_TAGS)[number],
      }),
      'Hito registrado',
    )
    setEventForm({ occurredOn: '', event: '', tag: 'Otro' })
  }

  async function removeEvent(id: string, label: string) {
    if (!(await confirm({ title: `¿Borrar «${label}»?`, tone: 'danger' }))) return
    run(() => deleteEmpleadoEvent(emp.id, id), 'Hito borrado')
  }

  return (
    <div>
      {/* Back + header */}
      <div className="phead" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="ibtn" onClick={() => router.back()} style={{ flexShrink: 0 }} aria-label="Volver">
            <ArrowLeft size={16} />
          </button>
          <Avatar name={emp.fullName} size={48} />
          <div>
            <div className="h1" style={{ fontSize: 20 }}>{emp.fullName}</div>
            <div className="psub">
              {[emp.position, emp.department].filter(Boolean).join(' · ') || 'Sin cargo asignado'}
            </div>
          </div>
          <Badge st={emp.status} filled />
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {emp.location && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink2)', fontSize: 13 }}>
              <MapPin size={13} /> {emp.location}
            </div>
          )}
          {managerName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink2)', fontSize: 13, marginLeft: 12 }}>
              <Users size={13} /> {managerName}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink2)', fontSize: 13, marginLeft: 12 }}>
            <Shield size={13} /> {emp.intendedRole}
          </div>
        </div>
      </div>

      <div className="g2b" style={{ marginBottom: 16 }}>
        {/* Skills */}
        <div className="card cpad">
          <div className="ctitle" style={{ marginBottom: 16 }}>Habilidades</div>
          {/* Levels come from `employee_skills`. They used to come from a
              fixture keyed by full name, so every real employee scored 0 on a
              fixed list of eight skills somebody chose once. Only skills that
              have actually been recorded are shown. */}
          {skills.length === 0 ? (
            <p className="psub">Todavía no hay habilidades registradas para esta persona.</p>
          ) : (
            skills.map((s) => (
              <div key={s.skill} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 400 }}>{s.skill}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--ink3)' }}>{s.level}/5</span>
                    {data.canWrite && (
                      <button
                        className="ibtn"
                        style={{ width: 22, height: 22, color: 'var(--redd)' }}
                        disabled={pending}
                        onClick={() => removeSkill(s.skill)}
                        aria-label={`Quitar la habilidad ${s.skill}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </span>
                </div>
                <div className="bartrack">
                  <div className="barfill" style={{ width: `${(s.level / 5) * 100}%` }} />
                </div>
              </div>
            ))
          )}

          {data.canWrite && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 140px', minWidth: 120 }}>
                <label className="flabel" style={{ marginTop: 0 }} htmlFor="emp-skill">Habilidad</label>
                <input
                  id="emp-skill"
                  className="field"
                  maxLength={80}
                  placeholder="Excel avanzado, soldadura…"
                  value={skillForm.skill}
                  onChange={(e) => setSkillForm((f) => ({ ...f, skill: e.target.value }))}
                />
              </div>
              <div style={{ flex: '0 0 78px' }}>
                <label className="flabel" style={{ marginTop: 0 }} htmlFor="emp-level">Nivel</label>
                <input
                  id="emp-level"
                  type="number"
                  className="field"
                  min={1}
                  max={5}
                  value={skillForm.level}
                  onChange={(e) => setSkillForm((f) => ({ ...f, level: e.target.value }))}
                />
              </div>
              <button className="btn" disabled={pending} onClick={submitSkill}>
                <Plus size={14} />Añadir
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/*
            "Riesgo de rotación" was here: a 0–100 score with contributing
            factors ("Bajo salario", "Sin ascenso"), rendered against a named
            employee's profile. The numbers were a hardcoded list in
            lib/data/empleados.ts — no model, no table, no input data. Showing
            an invented attrition score on a real person's record is worse than
            showing nothing, so it is gone rather than zeroed out.
          */}

          {/* Direct reports — real, and the org chart already depends on it. */}
          <div className="card cpad">
            <div className="ctitle" style={{ marginBottom: 10 }}>Equipo a cargo</div>
            {reports.length === 0 ? (
              <p className="psub">No tiene personas a cargo.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {reports.map((r) => (
                  <div
                    key={r.id}
                    className="elrow"
                    style={{ cursor: 'pointer' }}
                    {...activatable(() => router.push(`/dashboard/empleados/${r.id}`), `Ver perfil de ${r.fullName}`)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Avatar name={r.fullName} size={28} />
                      <div>
                        <div className="eltxt" style={{ fontSize: 13 }}>{r.fullName}</div>
                        {r.position && <div className="elsub" style={{ fontSize: 11.5 }}>{r.position}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/*
            Career journey, from `employee_events`.

            La tarjeta se ocultaba cuando la lista estaba vacía —y estaba vacía
            siempre, porque nada escribía en la tabla—. Ahora se muestra a quien
            puede escribir aunque no haya nada: es el único sitio desde el que
            se puede empezar.
          */}
          {(journey.length > 0 || data.canWrite) && (
            <div className="card cpad">
              <div className="ctitle" style={{ marginBottom: 14 }}>Trayectoria</div>
              {journey.length === 0 ? (
                <p className="psub">
                  Sin hitos todavía. Registra el ingreso, un ascenso o un traslado para
                  construir la historia de esta persona.
                </p>
              ) : (
                <div className="tl">
                  {journey.map((ev, i) => {
                    const tone = TAG_TONE[ev.tag] ?? 'neu'
                    return (
                      <div key={ev.id} className={`tli${i === journey.length - 1 ? ' last' : ''}`}>
                        <div className="tlrail"><div className={`tlnode ${tone}`} /></div>
                        <div className="tlbody">
                          <div className="tltop">
                            <span className="tltxt">{ev.event}</span>
                            <span className="tltime">
                              {DAY.format(new Date(`${ev.occurredOn}T00:00:00`))}
                              {data.canWrite && (
                                <button
                                  className="ibtn"
                                  style={{ width: 22, height: 22, marginLeft: 6, color: 'var(--redd)' }}
                                  disabled={pending}
                                  onClick={() => removeEvent(ev.id, ev.event)}
                                  aria-label={`Borrar el hito ${ev.event}`}
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </span>
                          </div>
                          <span className={`badge b-${tone}`} style={{ marginTop: 4, display: 'inline-flex' }}>
                            <span className="bd" />{ev.tag}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {data.canWrite && (
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <label className="flabel" style={{ marginTop: 0 }} htmlFor="emp-event">Qué pasó</label>
                    <input
                      id="emp-event"
                      className="field"
                      maxLength={200}
                      placeholder="Ascenso a Coordinadora de Operaciones"
                      value={eventForm.event}
                      onChange={(e) => setEventForm((f) => ({ ...f, event: e.target.value }))}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 130px', minWidth: 120 }}>
                      <label className="flabel" style={{ marginTop: 0 }} htmlFor="emp-event-date">Fecha</label>
                      <DatePicker
                        ariaLabel="Fecha del hito"
                        value={eventForm.occurredOn}
                        onChange={(v) => setEventForm((f) => ({ ...f, occurredOn: v }))}
                      />
                    </div>
                    <div style={{ flex: '1 1 130px', minWidth: 120 }}>
                      <label className="flabel" style={{ marginTop: 0 }} htmlFor="emp-event-tag">Tipo</label>
                      <Select
                        id="emp-event-tag"
                        value={eventForm.tag}
                        onChange={(v) => setEventForm((f) => ({ ...f, tag: v }))}
                        options={EMPLOYEE_EVENT_TAGS.map((t) => ({ value: t, label: t }))}
                      />
                    </div>
                    <button className="btn" disabled={pending} onClick={submitEvent}>
                      <Plus size={14} />Registrar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Related tickets — only loaded when the reader may see tickets at all. */}
      {tickets.length > 0 && (
        <div className="card">
          <div className="chead">
            <span className="ctitle">Tickets relacionados</span>
            <span className="muted">{tickets.length === 1 ? '1 ticket' : `${tickets.length} tickets`}</span>
          </div>
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Título</th>
                  <th scope="col">Área</th>
                  <th scope="col">Rol</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} className="trow">
                    <td style={{ fontWeight: 400 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <AlertTriangle
                          size={13}
                          style={{ color: t.priority === 'Alta' ? 'var(--red)' : t.priority === 'Media' ? 'var(--amb)' : 'var(--ink3)', flexShrink: 0 }}
                          aria-hidden="true"
                        />
                        {t.subject}
                      </div>
                    </td>
                    <td className="muted">{t.area}</td>
                    <td className="muted">{t.relation}</td>
                    <td><Badge st={t.status} filled /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
