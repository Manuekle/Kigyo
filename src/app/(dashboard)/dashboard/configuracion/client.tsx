'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, Bell, Lock, Building2, Shield, Check, Upload, PenLine, Ticket,
  Sparkles, Mail, LogOut, Globe, ChevronDown, Star,
  Eye, EyeOff, AlertTriangle,
} from '@/lib/icons'
import type { IconProps } from '@/lib/icons'
import { initials } from '@/lib/utils'
import { useApp } from '@/lib/context/AppContext'
import TabBar from '@/components/ui/TabBar'
import { PERMISSION_LABELS, permissionsByModule, ROLES, type Permission, type RoleKey } from '@/lib/auth/permissions'
import type { SettingsData } from '@/server/queries/settings'
import {
  changePassword,
  setMemberRole,
  setRolePermission,
  updateOrganization,
  updateProfile,
  type ActionResult,
} from '@/server/mutations/settings'

/* ------------------------------------------------------------------ */
/*  Page-local data                                                    */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const AV_GRADS: [string, string][] = [
  ['#7aa2ff', '#3b82f6'], ['#3ed694', '#1f9d63'], ['#f0bd5a', '#bf8410'],
  ['#b298f2', '#7c5cd6'], ['#ff8a8d', '#e5484d'], ['#5ed3d6', '#1f9098'],
  ['#f79bc4', '#db5897'], ['#8fd16a', '#4f9e2e'],
]
const avHash = (n = '') => { let h = 0; for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) | 0; return Math.abs(h) % AV_GRADS.length }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function passwordStrength(pw: string): { level: number; label: string; color: string; pct: number } {
  if (!pw) return { level: 0, label: '', color: 'transparent', pct: 0 }
  let score = 0
  if (pw.length >= 6) score++
  if (pw.length >= 10) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  if (score <= 1) return { level: 1, label: 'Débil', color: '#ef4444', pct: 20 }
  if (score <= 2) return { level: 2, label: 'Media', color: '#f59e0b', pct: 45 }
  if (score <= 3) return { level: 3, label: 'Buena', color: '#3b82f6', pct: 70 }
  return { level: 4, label: 'Fuerte', color: '#10b981', pct: 100 }
}

/* ------------------------------------------------------------------ */
/*  Page-local primitives                                              */
/* ------------------------------------------------------------------ */
function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const [c1, c2] = AV_GRADS[avHash(name)]
  return (
    <div className="av" style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(145deg,${c1},${c2})`, boxShadow: `0 4px 10px -4px ${c2}88` }}>{initials(name)}</div>
  )
}

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return <button className={`sw ${on ? 'on' : ''}`} onClick={onClick} disabled={disabled} aria-label="toggle" />
}


/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function ConfiguracionPage({ data }: { data: SettingsData }) {
  const { addToast } = useApp()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  /* ---- tab & dirty state ---- */
  const [tab, setTab] = useState('perfil')
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [fadeIdx, setFadeIdx] = useState(0)

  /* ---- form state, seeded from the server ---- */
  const [name, setName] = useState(data.profile.fullName)
  const email = data.profile.email  // changing it re-verifies the address; not here
  const role = data.profile.role
  const [notifs, setNotifs] = useState({ firmas: true, tickets: true, menciones: false, resumen: true })
  const [sec, setSec] = useState({ twofa: false })
  const [pw, setPw] = useState({ current: '', new: '', confirm: '' })
  const [showPw, setShowPw] = useState<Record<string, boolean>>({})
  const [company, setCompany] = useState(data.organization.name)
  const [industry, setIndustry] = useState(data.organization.industry ?? '')

  /**
   * The permission matrix and member roles are server state.
   *
   * They used to live in localStorage — editable by the very user they were
   * meant to restrict, and read by nothing on the server. They are now
   * `role_permissions` and `memberships`, which is also what RLS reads, so a
   * revoked permission is enforced by the database and not just hidden.
   */
  const permissions = data.matrix
  const members = data.members
  const canManage = data.canManage

  const mark = useCallback(() => setDirty(true), [])

  /* ---- tab switch with dirty guard ---- */
  const switchTab = (id: string) => {
    if (id === tab) return
    if (dirty && !window.confirm('Tienes cambios sin guardar. ¿Descartar y cambiar de pestaña?')) return
    setDirty(false)
    setErrors({})
    setFadeIdx((k) => k + 1)
    setTab(id)
  }

  /* ---- validation ---- */
  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (tab === 'perfil') {
      if (!name.trim()) e.name = 'El nombre es obligatorio'
      if (!email.trim()) e.email = 'El correo es obligatorio'
      else if (!EMAIL_RE.test(email)) e.email = 'Formato de correo inválido'
    }
    if (tab === 'seguridad') {
      if (pw.new && pw.new.length < 6) e.pwNew = 'Mínimo 6 caracteres'
      if (pw.new && pw.new !== pw.confirm) e.pwConfirm = 'Las contraseñas no coinciden'
      if (pw.new && !pw.current) e.pwCurrent = 'Ingresa tu contraseña actual'
    }
    if (tab === 'empresa') {
      if (!company.trim()) e.company = 'El nombre de la empresa es obligatorio'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  /* ---- save ---- */
  const save = () => {
    if (!validate()) {
      addToast('Corrige los errores antes de guardar', 'err')
      return
    }

    startTransition(async () => {
      let result: ActionResult = { ok: true }

      if (tab === 'perfil') result = await updateProfile({ fullName: name })
      else if (tab === 'empresa') result = await updateOrganization({ name: company, industry })
      else if (tab === 'seguridad' && pw.new) {
        result = await changePassword({ currentPassword: pw.current, newPassword: pw.new })
        if (result.ok) setPw({ current: '', new: '', confirm: '' })
      }

      if (!result.ok) { addToast(result.error, 'err'); return }

      setDirty(false)
      addToast('Cambios guardados correctamente', 'ok')
      router.refresh()
    })
  }

  /* ---- handlers ---- */
  const toggleNotif = (k: keyof typeof notifs) => { setNotifs((n) => ({ ...n, [k]: !n[k] })); mark() }

  // Permission changes save immediately. Batching them behind "Guardar" made
  // it possible to leave the page believing an access change had applied when
  // it had not.
  const togglePerm = (r: RoleKey, permission: Permission) => {
    const next = !permissions[r][permission]
    startTransition(async () => {
      const result = await setRolePermission(r, permission, next)
      if (!result.ok) { addToast(result.error, 'err'); return }
      router.refresh()
    })
  }

  const cycleMemberRole = (membershipId: string, current: RoleKey) => {
    const next = ROLES[(ROLES.indexOf(current) + 1) % ROLES.length]
    startTransition(async () => {
      const result = await setMemberRole(membershipId, next)
      if (!result.ok) { addToast(result.error, 'err'); return }
      addToast(`Rol actualizado a ${next}`, 'ok')
      router.refresh()
    })
  }

  const str = passwordStrength(pw.new)

  /* ---- tabs definition ---- */
  const TABS: { id: string; label: string; ico: (p: IconProps) => React.ReactElement }[] = [
    { id: 'perfil', label: 'Perfil', ico: Users },
    { id: 'notificaciones', label: 'Notificaciones', ico: Bell },
    { id: 'seguridad', label: 'Seguridad', ico: Lock },
    { id: 'empresa', label: 'Empresa', ico: Building2 },
    { id: 'roles', label: 'Roles y permisos', ico: Shield },
  ]

  /* ---- field error helper ---- */
  const fe = (key: string) => errors[key] ? <div style={{ fontSize: 11.5, color: '#ef4444', fontWeight: 500, marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}><AlertTriangle size={12} />{errors[key]}</div> : null
  const fi = (key: string) => errors[key] ? 'rgba(239,68,68,.35)' : undefined

  return (
    <div>
      {/* ---- tab bar ---- */}
      <TabBar items={TABS.map(t => ({ key: t.id, label: <><t.ico size={15} />{t.label}</> }))} value={tab} onChange={switchTab} style={{ marginBottom: 16 }} />

      {/* ---- content card ---- */}
      <div className="card cpad" key={fadeIdx} style={{ animation: 'fadein .2s ease-out both', padding: '20px 24px' }}>
        {/* ========== PERFIL ========== */}
        {tab === 'perfil' && (
          <>
            <div className="ctitle" style={{ marginBottom: 6 }}>Información personal</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '16px 0' }}>
              <Avatar name={name} size={64} />
              <div>
                <button className="btn" onClick={() => addToast('Selector de foto próximamente', 'info')}><Upload size={14} />Cambiar foto</button>
                <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 6 }}>PNG o JPG · máx. 4 MB</div>
              </div>
            </div>
            <div className="flabel">Nombre completo</div>
            <input className="field" value={name} onChange={(e) => { setName(e.target.value); mark() }} style={fi('name') ? { borderColor: fi('name') } : undefined} />
            {fe('name')}
            <div className="flabel">Rol en la organización</div>
            <input className="field" value={role} readOnly aria-readonly="true" />
            <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 4 }}>
              Solo una persona administradora puede cambiar roles, en la pestaña Roles y permisos.
            </div>
            <div className="flabel">Correo electrónico</div>
            <input className="field" value={email} readOnly aria-readonly="true" autoComplete="email" />
            <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 4 }}>
              Cambiar el correo requiere verificar la nueva dirección. Escríbenos para hacerlo.
            </div>
            <button className="btn dark" style={{ marginTop: 18 }} onClick={save}><Check size={15} />Guardar cambios</button>
          </>
        )}

        {/* ========== NOTIFICACIONES ========== */}
        {tab === 'notificaciones' && (
          <>
            <div className="ctitle" style={{ marginBottom: 4 }}>Preferencias de notificación</div>
            <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 10 }}>Elige qué notificaciones quieres recibir.</div>
            <div className="acc"><span className="acico"><PenLine size={16} /></span>
              <div style={{ flex: 1 }}><div className="act">Firmas pendientes</div><div className="acs">Recordatorios de documentos por firmar</div></div>
              <Toggle on={notifs.firmas} onClick={() => toggleNotif('firmas')} /></div>
            <div className="acc"><span className="acico"><Ticket size={16} /></span>
              <div style={{ flex: 1 }}><div className="act">Tickets asignados</div><div className="acs">Cuando un ticket se asigna a tu equipo</div></div>
              <Toggle on={notifs.tickets} onClick={() => toggleNotif('tickets')} /></div>
            <div className="acc"><span className="acico"><Sparkles size={16} /></span>
              <div style={{ flex: 1 }}><div className="act">Menciones en IA</div><div className="acs">Cuando el asistente te incluye en un resumen</div></div>
              <Toggle on={notifs.menciones} onClick={() => toggleNotif('menciones')} /></div>
            <div className="acc"><span className="acico"><Mail size={16} /></span>
              <div style={{ flex: 1 }}><div className="act">Resumen semanal por correo</div><div className="acs">Cada lunes a las 8:00 a. m.</div></div>
              <Toggle on={notifs.resumen} onClick={() => toggleNotif('resumen')} /></div>
            <button className="btn dark" style={{ marginTop: 18 }} onClick={save}><Check size={15} />Guardar cambios</button>
          </>
        )}

        {/* ========== SEGURIDAD ========== */}
        {tab === 'seguridad' && (
          <>
            <div className="ctitle" style={{ marginBottom: 6 }}>Cambiar contraseña</div>
            <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 6 }}>Actualiza tu contraseña para mantener tu cuenta segura.</div>

            <div className="flabel">Contraseña actual</div>
            <div style={{ position: 'relative' }}>
              <input className="field" type={showPw.current ? 'text' : 'password'} placeholder="••••••••" value={pw.current} onChange={(e) => { setPw((p) => ({ ...p, current: e.target.value })); mark() }} style={fi('pwCurrent') ? { borderColor: fi('pwCurrent') } : undefined} />
              <button onClick={() => setShowPw((s) => ({ ...s, current: !s.current }))} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink3)', cursor: 'pointer', background: 'none', border: 'none', padding: 0, lineHeight: 1 }} aria-label="Mostrar contraseña">{showPw.current ? <EyeOff size={15} /> : <Eye size={15} />}</button>
            </div>
            {fe('pwCurrent')}

            <div className="flabel">Nueva contraseña</div>
            <div style={{ position: 'relative' }}>
              <input className="field" type={showPw.new ? 'text' : 'password'} placeholder="Mínimo 8 caracteres" value={pw.new} onChange={(e) => { setPw((p) => ({ ...p, new: e.target.value })); mark() }} style={fi('pwNew') ? { borderColor: fi('pwNew') } : undefined} />
              <button onClick={() => setShowPw((s) => ({ ...s, new: !s.new }))} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink3)', cursor: 'pointer', background: 'none', border: 'none', padding: 0, lineHeight: 1 }} aria-label="Mostrar contraseña">{showPw.new ? <EyeOff size={15} /> : <Eye size={15} />}</button>
            </div>
            {fe('pwNew')}

            {pw.new && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ flex: 1, height: 4, background: 'var(--line2)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${str.pct}%`, height: '100%', borderRadius: 999, background: str.color, transition: 'width .3s ease-out, background .3s ease-out' }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: str.color, flexShrink: 0 }}>{str.label}</span>
                </div>
              </div>
            )}

            <div className="flabel">Confirmar nueva contraseña</div>
            <input className="field" type="password" placeholder="Repite la contraseña" value={pw.confirm} onChange={(e) => { setPw((p) => ({ ...p, confirm: e.target.value })); mark() }} style={fi('pwConfirm') ? { borderColor: fi('pwConfirm') } : undefined} />
            {fe('pwConfirm')}

            <button className="btn dark" style={{ marginTop: 18 }} onClick={save}><Check size={15} />Actualizar contraseña</button>

            <div style={{ height: 1, background: 'var(--line2)', margin: '24px 0' }} />

            <div className="ctitle" style={{ marginBottom: 10 }}>Seguridad de la cuenta</div>
            <div className="acc" style={{ padding: 0 }}><span className="acico"><Lock size={16} /></span>
              <div style={{ flex: 1 }}><div className="act">Verificación en dos pasos</div><div className="acs">Código adicional al iniciar sesión</div></div>
              <Toggle on={sec.twofa} onClick={() => { setSec((s) => ({ ...s, twofa: !s.twofa })); mark() }} /></div>

            <button className="btn danger" style={{ marginTop: 18 }} onClick={() => {
              if (window.confirm('¿Cerrar sesión en todos tus dispositivos? Tendrás que volver a iniciar sesión en cada uno.')) {
                addToast('Sesión cerrada en todos los dispositivos', 'ok')
              }
            }}><LogOut size={15} />Cerrar sesión en todos los dispositivos</button>
          </>
        )}

        {/* ========== EMPRESA ========== */}
        {tab === 'empresa' && (
          <>
            <div className="ctitle" style={{ marginBottom: 6 }}>Información de la organización</div>
            <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 10 }}>Estos datos se usan en reportes, facturación y comunicaciones oficiales.</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
              <div style={{ width: 56, height: 56, borderRadius: 'var(--r)', background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 500, color: '#fff', flexShrink: 0, boxShadow: '0 4px 14px rgba(59,130,246,.30)' }}>
                {company.charAt(0)}
              </div>
              <div>
                <button className="btn" onClick={() => addToast('Selector de logo próximamente', 'info')}><Upload size={14} />Cambiar logo</button>
                <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 6 }}>PNG con fondo transparente</div>
              </div>
            </div>
            <div className="flabel">Nombre de la empresa</div>
            <input className="field" value={company} onChange={(e) => { setCompany(e.target.value); mark() }} style={fi('company') ? { borderColor: fi('company') } : undefined} />
            {fe('company')}
            <div className="flabel">Industria</div>
            <input className="field" value={industry} onChange={(e) => { setIndustry(e.target.value); mark() }} />
            <div className="acc" style={{ marginTop: 6, padding: '11px 0' }}><span className="acico"><Globe size={16} /></span>
              <div style={{ flex: 1 }}><div className="act">Idioma y región</div><div className="acs">Español (Colombia) · COP</div></div>
              <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 500 }}>Próximamente</div></div>
            <button className="btn dark" style={{ marginTop: 18 }} onClick={save}><Check size={15} />Guardar cambios</button>
          </>
        )}

        {/* ========== ROLES Y PERMISOS ========== */}
        {tab === 'roles' && (
          <>
            <div className="ctitle" style={{ marginBottom: 6 }}>Permisos por rol</div>
            <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 14 }}>Define qué módulos puede ver y gestionar cada nivel de la organización.</div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: 14, marginBottom: 24 }}>
              {ROLES.map((r) => (
                <div key={r} className="card" style={{ padding: 16, background: 'var(--bg)', borderColor: 'var(--line2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--line2)' }}>
                    <span style={{
                      width: 30, height: 30, borderRadius: 'var(--r-sm)', display: 'grid', placeItems: 'center',
                      background: r === 'Administrador' ? 'rgba(239,68,68,.12)' : r === 'Líder de equipo' ? 'rgba(245,158,11,.12)' : 'rgb(var(--ink-rgb) / .06)',
                      color: r === 'Administrador' ? '#ef4444' : r === 'Líder de equipo' ? '#f59e0b' : 'var(--ink2)',
                    }}>
                      {r === 'Administrador' ? <Shield size={15} /> : r === 'Líder de equipo' ? <Star size={15} /> : <Users size={15} />}
                    </span>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{r}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--ink3)' }}>{r === 'Administrador' ? 'Acceso total' : r === 'Líder de equipo' ? 'Gestión de equipo' : 'Acceso básico'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {permissionsByModule().flatMap((group) =>
                      group.permissions.map((permission) => (
                        <div key={permission} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink2)' }}>{PERMISSION_LABELS[permission]}</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={permissions[r][permission]}
                            className={`sw ${permissions[r][permission] ? 'on' : ''}`}
                            onClick={() => togglePerm(r, permission)}
                            disabled={!canManage || pending || r === 'Administrador'}
                            aria-label={`${PERMISSION_LABELS[permission]} para ${r}`}
                            style={{ transform: 'scale(.85)', transformOrigin: 'right center' }}
                          />
                        </div>
                      )),
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="ctitle" style={{ marginBottom: 12 }}>Rol por persona</div>
            <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 10 }}>Asigna el nivel de acceso individual de cada colaborador.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {members.map((m) => (
                <div className="elrow" key={m.membershipId} style={{ padding: '10px 12px', borderRadius: 'var(--r)', background: 'var(--bg)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Avatar name={m.fullName} size={32} />
                    <div>
                      <div className="eltxt" style={{ fontSize: 13, fontWeight: 600 }}>
                        {m.fullName}{m.isSelf && <span style={{ color: 'var(--ink3)', fontWeight: 500 }}> · tú</span>}
                      </div>
                      <div className="elsub" style={{ fontSize: 11.5 }}>{m.email}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="prole"
                    disabled={!canManage || pending}
                    onClick={() => cycleMemberRole(m.membershipId, m.role)}
                    aria-label={`Cambiar el rol de ${m.fullName}, actualmente ${m.role}`}
                  >
                    {m.role} <ChevronDown size={12} />
                  </button>
                </div>
              ))}
              {members.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--ink3)' }}>
                  Todavía no hay más personas en la organización.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* ---- inline keyframes for tab fade ---- */}
      <style jsx>{`
        @keyframes fadein {
          from { opacity: 0; transform: translateY(6px) }
          to { opacity: 1; transform: translateY(0) }
        }
      `}</style>
    </div>
  )
}
