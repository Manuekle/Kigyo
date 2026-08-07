'use client'

import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, MapPin, Shield, Users, TrendingUp, AlertTriangle } from '@/lib/icons'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import { EMPLEADOS, SKILL_LEVELS, SKILLS_LIST, EMP_JOURNEY, ROTATION_RISK } from '@/lib/data/empleados'
import { TICKETS } from '@/lib/data/tickets'

const SKILL_COLORS = ['#e5484d', '#bf8410', '#1f9d63', '#3b82f6', '#7c5cd6']

export default function EmpleadoDetailPage() {
  const { id } = useParams()
  const router = useRouter()

  const emp = EMPLEADOS.find((e) => e.id === Number(id))
  if (!emp) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink3)' }}>
      Empleado no encontrado.
      <br />
      <button className="btn" style={{ marginTop: 16 }} onClick={() => router.back()}>
        <ArrowLeft size={14} /> Volver
      </button>
    </div>
  )

  const skills = SKILL_LEVELS[emp.name] ?? {}
  const journey = EMP_JOURNEY[emp.name] ?? []
  const risk = ROTATION_RISK.find((r) => r.name === emp.name)
  const relatedTickets = TICKETS.filter((t) => t.req === emp.name || t.assigned === emp.name)

  const riskColor = !risk ? 'var(--grn)' : risk.riesgo >= 70 ? 'var(--red)' : risk.riesgo >= 40 ? 'var(--amb)' : 'var(--grn)'

  return (
    <div>
      {/* Back + header */}
      <div className="phead" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button className="ibtn" onClick={() => router.back()} style={{ flexShrink: 0 }}>
            <ArrowLeft size={16} />
          </button>
          <Avatar name={emp.name} size={48} />
          <div>
            <div className="h1" style={{ fontSize: 20 }}>{emp.name}</div>
            <div className="psub">{emp.role} · {emp.dept}</div>
          </div>
          <Badge st={emp.st} filled />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink2)', fontSize: 13 }}>
            <MapPin size={13} /> {emp.loc}
          </div>
          {emp.manager && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink2)', fontSize: 13, marginLeft: 12 }}>
              <Users size={13} /> {emp.manager}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--ink2)', fontSize: 13, marginLeft: 12 }}>
            <Shield size={13} /> {emp.perm}
          </div>
        </div>
      </div>

      <div className="g2b" style={{ marginBottom: 16 }}>
        {/* Skills */}
        <div className="card cpad">
          <div className="ctitle" style={{ marginBottom: 16 }}>Habilidades</div>
          {SKILLS_LIST.map((s, i) => {
            const val = skills[s] ?? 0
            return (
              <div key={s} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{s}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink3)' }}>{val}/5</span>
                </div>
                <div className="bartrack">
                  <div
                    className="barfill"
                    style={{ width: `${(val / 5) * 100}%`, background: SKILL_COLORS[i % SKILL_COLORS.length] }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Risk + Journey */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Rotation risk */}
          <div className="card cpad">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="ctitle">Riesgo de rotación</div>
                <div className="psub" style={{ marginTop: 4 }}>
                  {risk?.factores.length ? risk.factores.join(' · ') : 'Sin factores de riesgo identificados'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: riskColor, letterSpacing: '-.05em' }}>
                  {risk?.riesgo ?? 0}
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink3)' }}>/ 100</div>
              </div>
            </div>
            {risk && (
              <div className="bartrack" style={{ marginTop: 12 }}>
                <div className="barfill" style={{ width: `${risk.riesgo}%`, background: riskColor }} />
              </div>
            )}
          </div>

          {/* Career journey */}
          {journey.length > 0 && (
            <div className="card cpad">
              <div className="ctitle" style={{ marginBottom: 14 }}>Trayectoria</div>
              <div className="tl">
                {journey.map((ev, i) => (
                  <div key={i} className={`tli${i === journey.length - 1 ? ' last' : ''}`}>
                    <div className="tlrail">
                      <div className={`tlnode ${ev.tone}`} />
                    </div>
                    <div className="tlbody">
                      <div className="tltop">
                        <span className="tltxt">{ev.ev}</span>
                        <span className="tltime">{ev.date}</span>
                      </div>
                      <span className={`badge b-${ev.tone}`} style={{ marginTop: 4, display: 'inline-flex' }}>
                        <span className="bd" />{ev.tag}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Related tickets */}
      {relatedTickets.length > 0 && (
        <div className="card">
          <div className="chead">
            <span className="ctitle">Tickets relacionados</span>
            <span className="muted">{relatedTickets.length} tickets</span>
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
                {relatedTickets.map((t) => (
                  <tr key={t.id} className="trow">
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <AlertTriangle size={13} style={{ color: t.prio === 'Alta' ? 'var(--red)' : t.prio === 'Media' ? 'var(--amb)' : 'var(--ink3)', flexShrink: 0 }} />
                        {t.title}
                      </div>
                    </td>
                    <td className="muted">{t.area}</td>
                    <td className="muted">{t.req === emp.name ? 'Solicitante' : 'Asignado'}</td>
                    <td><Badge st={t.st} filled /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {relatedTickets.length === 0 && (
        <div className="card cpad" style={{ textAlign: 'center', color: 'var(--ink3)', padding: '28px' }}>
          <TrendingUp size={22} style={{ margin: '0 auto 8px', opacity: .4 }} />
          <div style={{ fontWeight: 700 }}>Sin tickets activos</div>
          <div style={{ fontSize: 12.5, marginTop: 4 }}>Este empleado no tiene tickets asignados</div>
        </div>
      )}
    </div>
  )
}
