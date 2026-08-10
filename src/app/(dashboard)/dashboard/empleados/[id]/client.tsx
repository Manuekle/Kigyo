'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, MapPin, Shield, Users, AlertTriangle } from '@/lib/icons'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import { activatable } from '@/lib/a11y'
import type { EmpleadoDetail } from '@/server/queries/empleados'

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
  const { empleado: emp, managerName, reports, skills, journey, tickets } = data

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
            <Shield size={13} /> {emp.accessRole}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 400 }}>{s.skill}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink3)' }}>{s.level}/5</span>
                </div>
                <div className="bartrack">
                  <div className="barfill" style={{ width: `${(s.level / 5) * 100}%` }} />
                </div>
              </div>
            ))
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

          {/* Career journey, from `employee_events`. */}
          {journey.length > 0 && (
            <div className="card cpad">
              <div className="ctitle" style={{ marginBottom: 14 }}>Trayectoria</div>
              <div className="tl">
                {journey.map((ev, i) => {
                  const tone = TAG_TONE[ev.tag] ?? 'neu'
                  return (
                    <div key={`${ev.occurredOn}-${i}`} className={`tli${i === journey.length - 1 ? ' last' : ''}`}>
                      <div className="tlrail"><div className={`tlnode ${tone}`} /></div>
                      <div className="tlbody">
                        <div className="tltop">
                          <span className="tltxt">{ev.event}</span>
                          <span className="tltime">{DAY.format(new Date(ev.occurredOn))}</span>
                        </div>
                        <span className={`badge b-${tone}`} style={{ marginTop: 4, display: 'inline-flex' }}>
                          <span className="bd" />{ev.tag}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
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
