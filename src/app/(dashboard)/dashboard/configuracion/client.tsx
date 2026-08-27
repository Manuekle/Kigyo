'use client'

import { useCallback, useOptimistic, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Users, Bell, Lock, Building2, Shield, Check, Upload, PenLine, Ticket,
  Sparkles, Mail, LogOut, Globe, Star,
  Eye, EyeOff, AlertTriangle, LayoutGrid, Plus, Trash2, Copy, MapPin,
} from '@/lib/icons'
import type { IconProps } from '@/lib/icons'
import { initials } from '@/lib/utils'
import { useApp } from '@/lib/context/AppContext'
import { useConfirm } from '@/lib/context/ConfirmContext'
import TabBar from '@/components/ui/TabBar'
import Toggle from '@/components/ui/Toggle'
import OtpInput from '@/components/ui/OtpInput'
import { apiFetch, errorMessage } from '@/lib/api/client'
import type { MfaEnrollment } from '@/app/api/auth/mfa/route'
import {
  ACTION_LABELS, MODULE_LABELS, PERMISSION_LABELS, permissionsByModule, isSystemRole,
  type Permission, type RoleKey,
} from '@/lib/auth/permissions'
import { COMPANY_TYPES, MODULE_KEYS, modulesByGroup } from '@/lib/modules'
import { modulesInSuite, suitesOf, SUITES, type Suite } from '@/lib/modules/registry'
import { presetFromCatalogue } from '@/lib/sectors'
import { lowestPlanWith } from '@/lib/plans'
import { useMember } from '@/lib/context/MemberContext'
import type { SettingsData } from '@/server/queries/settings'
import type { SitesData } from '@/server/queries/sites'
import SucursalesTab from './SucursalesTab'
import Select from '@/components/ui/Select'
import {
  changePassword,
  createRole,
  deleteRole,
  inviteMember,
  revokeInvitation,
  seedSuggestedRoles,
  setMemberRole,
  setRolePermission,
  signOutEverywhere,
  updateModules,
  updateOrganization,
  updateProfile,
  updateRole,
  uploadAvatar,
  type ActionResult,
  uploadLogo,
} from '@/server/mutations/settings'

/* ------------------------------------------------------------------ */
/*  Page-local data                                                    */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const INVITE_DATE = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' })

const AV_GRADS: [string, string][] = [
  ['#7aa2ff', '#3b82f6'], ['#3ed694', '#1f9d63'], ['#f0bd5a', '#bf8410'],
  ['#b298f2', '#7c5cd6'], ['#ff8a8d', '#e5484d'], ['#5ed3d6', '#1f9098'],
  ['#f79bc4', '#db5897'], ['#8fd16a', '#4f9e2e'],
]
const avHash = (n = '') => { let h = 0; for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) | 0; return Math.abs(h) % AV_GRADS.length }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MODULE_COUNT = MODULE_KEYS.length

/**
 * Colour and caption for the seeded roles only.
 *
 * A custom role gets the neutral tone and a count of what it grants, because
 * inventing a description for «Recepción» would be putting words in the
 * administrator's mouth — and «Acceso total» under a role that grants four
 * permissions would be a lie the screen tells about its own data.
 */
const ROLE_TONE: Record<string, string> = {
  'Administrador': 'is-admin',
  'Líder de equipo': 'is-lead',
  'Empleado': 'is-member',
}
const ROLE_SUB: Record<string, string> = {
  'Administrador': 'Acceso total',
  'Líder de equipo': 'Gestión de equipo',
  'Empleado': 'Acceso básico',
}

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
function Avatar({ name, size = 34, src }: { name: string; size?: number; src?: string | null }) {
  const [c1, c2] = AV_GRADS[avHash(name)]
  return (
    <div className="av" style={{ width: size, height: size, fontSize: size * 0.36, background: `linear-gradient(145deg,${c1},${c2})`, boxShadow: `0 4px 10px -4px ${c2}88` }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
      ) : (
        initials(name)
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
export default function ConfiguracionPage({ data, sites }: { data: SettingsData; sites: SitesData }) {
  const { addToast } = useApp()
  const confirm = useConfirm()
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
  const [pw, setPw] = useState({ current: '', new: '', confirm: '' })
  const [showPw, setShowPw] = useState<Record<string, boolean>>({})
  const [company, setCompany] = useState(data.organization.name)
  const [industry, setIndustry] = useState(data.organization.industry ?? '')
  const [legalName, setLegalName] = useState(data.organization.legalName ?? '')
  const [taxId, setTaxId] = useState(data.organization.taxId ?? '')
  const [city, setCity] = useState(data.organization.city ?? '')
  const [address, setAddress] = useState(data.organization.address ?? '')

  /**
   * Modules are the only thing on this screen that is org-wide rather than
   * per-person, so they get their own tab rather than a section under Empresa.
   *
   * Kept as local state behind a Guardar, unlike the permission switches:
   * switching a module off removes pages from everyone's sidebar at once, and
   * choosing a company type replaces the whole selection. Saving each toggle
   * the instant it moves would make picking a preset a stream of a dozen
   * writes, and would leave no moment to change your mind.
   */
  const member = useMember()

  /* ---- avatar: optimistic URL from the session, replaced on upload ---- */
  const [avatarUrl, setAvatarUrl] = useState(member.avatarUrl)
  /* ---- logo: misma mecánica optimista que el avatar ---- */
  const [logoUrl, setLogoUrl] = useState(data.organization.logoUrl)
  const [companyTypeKey, setCompanyTypeKey] = useState(data.organization.companyType)
  /**
   * The subsector, when the chosen sector has any.
   *
   * Cleared whenever the sector changes: a subsector belongs to exactly one
   * parent, and the database refuses a mismatched pair — so carrying the old
   * value across would turn the next save into an error the screen could not
   * explain.
   */
  const [subsectorKey, setSubsectorKey] = useState(data.organization.subsector)

  /**
   * The subsectors of whichever sector is selected right now.
   *
   * Read from the catalogue rather than from a narrowed payload, so clicking a
   * different sector offers its children immediately. It used to go empty until
   * the page reloaded, which read as "this sector has no kinds" — a wrong
   * answer that looked like a real one.
   */
  const subsectorOptions = companyTypeKey ? data.catalogue.subsectors[companyTypeKey] ?? [] : []

  /**
   * The sector cards.
   *
   * `COMPANY_TYPES` first, for its descriptions — those are product copy and
   * live in code. Anything the database has that TypeScript does not is
   * appended, so a sector added as data (migrations 29 and 34 exist to make
   * that possible without a deploy) is pickable here and not only in the setup
   * wizard.
   */
  const sectorCards = [
    ...COMPANY_TYPES.map((t) => ({ key: t.key as string, label: t.label, description: t.description })),
    ...data.catalogue.sectors
      .filter((s) => !COMPANY_TYPES.some((t) => t.key === s.key))
      .map((s) => ({ key: s.key, label: s.label, description: 'Sector del catálogo de tu cuenta.' })),
  ]
  const sectorLabel =
    sectorCards.find((t) => t.key === companyTypeKey)?.label.toLowerCase() ?? 'empresa'

  /**
   * Whether the sector has settled.
   *
   * The soft lock from migration 41: free while the company has no records in
   * the vertical its sector names, refused once it has. The database is what
   * makes it true — this only decides whether the screen offers a choice it
   * would then have to take back.
   *
   * A sector chosen but never saved does not count. `canChangeSector` describes
   * the row as it stands on the server, and somebody mid-edit is by definition
   * still allowed.
   */
  const sectorLocked = !data.organization.canChangeSector
  /** Sector and kind, spelled out, since the cards and the select are gone. */
  const lockedSectorLabel = [
    sectorCards.find((t) => t.key === data.organization.companyType)?.label,
    data.catalogue.subsectors[data.organization.companyType ?? '']
      ?.find((s) => s.key === data.organization.subsector)?.label,
  ].filter(Boolean).join(' · ') || 'Sin sector'
  const [modules, setModules] = useState<Set<string>>(new Set(data.organization.modules))
  /**
   * Por qué segmento se está mirando el catálogo. `null` es el catálogo entero.
   *
   * No se guarda: el rail sí recuerda su lente porque es la navegación de todos
   * los días, y esto es una pantalla de administración a la que se entra a
   * hacer una cosa concreta. Un filtro recordado aquí sería un catálogo al que
   * le faltan módulos sin que nadie recuerde por qué.
   */
  const [modFilter, setModFilter] = useState<Suite | null>(null)
  /**
   * The sector's preset, narrowed to what the plan actually allows.
   *
   * A clinic on Starter should still be able to pick "Salud" — the sector is a
   * true statement about the business regardless of what it pays for. What it
   * must not do is propose `pacientes` and then have the save refused by the
   * server, which is what an unfiltered preset would produce.
   *
   * The subsector amends it: a bakery gains `produccion`, a single practice
   * loses the safety programme it will never run.
   */
  const preset = presetFromCatalogue(data.catalogue, companyTypeKey, subsectorKey)
    .filter((key) => member.planIncludes(key))
  // Whether the selection still matches the type's preset, so the screen can
  // say "personalizado" instead of implying the type describes what is on.
  const matchesPreset =
    modules.size === preset.length && preset.every((m) => modules.has(m))
  /** How much of the catalogue this plan can reach, for the summary line. */
  const availableCount = MODULE_KEYS.filter((key) => member.planIncludes(key)).length

  /**
   * Companies under *this* account, not every company the caller belongs to.
   *
   * Since multi-account, `member.companies` spans groups — counting it here
   * would tell somebody on Starter that they are using three of one.
   */
  const companiesUsed = member.companies.filter(
    (c) => c.accountId === member.account.accountId,
  ).length

  /**
   * The permission matrix and member roles are server state.
   *
   * They used to live in localStorage — editable by the very user they were
   * meant to restrict, and read by nothing on the server. They are now
   * `role_permissions` and `memberships`, which is also what RLS reads, so a
   * revoked permission is enforced by the database and not just hidden.
   *
   * Because the truth is on the server, the switch used to sit still until the
   * action and the `router.refresh()` behind it had both come back — long
   * enough to read as a dead control and get clicked twice. The optimistic
   * copy moves it now and React rolls it back on its own if the write fails.
   */
  const [permissions, applyPermission] = useOptimistic(
    data.matrix,
    (matrix, patch: { role: RoleKey; permission: Permission; on: boolean }) => ({
      ...matrix,
      [patch.role]: { ...matrix[patch.role], [patch.permission]: patch.on },
    }),
  )
  const members = data.members
  const canManage = data.canManage
  /**
   * The organization's roles, in rank order.
   *
   * Server state, like the matrix — created and deleted through the Server
   * Functions below and re-read by `router.refresh()`. Nothing here is derived
   * from a constant: an organization that renamed «Empleado» to «Colaborador»
   * and added «Recepción» sees exactly that, everywhere.
   */
  const roles = data.roles
  /** How many people would lose their way in if this permission went away. */
  const adminRoles = roles.filter((r) => permissions[r.key]?.['configuracion:manage'])
  const adminHolders = adminRoles.reduce((total, r) => total + r.members, 0)

  const mark = useCallback(() => setDirty(true), [])

  /* ---- tab switch with dirty guard ---- */
  const switchTab = async (id: string) => {
    if (id === tab) return
    if (dirty && !(await confirm({ title: '¿Descartar los cambios?', description: 'Tienes cambios sin guardar en esta pestaña.', confirmLabel: 'Descartar', tone: 'danger' }))) return
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

  /* ---- avatar upload ---- */
  function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = '' // reset so picking the same file again still fires

    if (!file.type.startsWith('image/')) {
      addToast('El archivo no es una imagen.', 'err')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      addToast('La imagen supera los 2 MB.', 'err')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      startTransition(async () => {
        const result = await uploadAvatar({ dataUrl, mimeType: file.type })
        if (!result.ok) {
          addToast(result.error, 'err')
          return
        }
        setAvatarUrl(dataUrl) // optimistic: the real signed URL arrives on router.refresh
        addToast('Foto actualizada', 'ok')
        router.refresh()
      })
    }
    reader.readAsDataURL(file)
  }

  /**
   * Subida del logo.
   *
   * Gemela de `onAvatarChange`. El botón que había aquí contestaba
   * `addToast('Selector de logo próximamente')` — era el último control muerto
   * del producto, y lo era por falta de bucket, no de idea: `branding.logo_url`
   * existe desde la migración 30 y `updateBranding` ya sabía escribirlo.
   */
  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (!file.type.startsWith('image/')) {
      addToast('El archivo no es una imagen.', 'err')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      addToast('La imagen supera los 2 MB.', 'err')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      startTransition(async () => {
        const result = await uploadLogo({ dataUrl, mimeType: file.type })
        if (!result.ok) {
          addToast(result.error, 'err')
          return
        }
        // Optimista: la URL firmada de verdad llega con el router.refresh.
        setLogoUrl(dataUrl)
        addToast('Logo actualizado', 'ok')
        router.refresh()
      })
    }
    reader.readAsDataURL(file)
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
      else if (tab === 'empresa') result = await updateOrganization({ name: company, industry, legalName, taxId, city, address })
      else if (tab === 'modulos') {
        result = await updateModules({
          companyType: companyTypeKey,
          subsector: subsectorKey,
          modules: [...modules],
        })
      }
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
      applyPermission({ role: r, permission, on: next })
      const result = await setRolePermission(r, permission, next)
      if (!result.ok) { addToast(result.error, 'err'); return }
      router.refresh()
    })
  }

  /* ---- roles ---- */
  /**
   * Filters the matrix by module name.
   *
   * Thirty-nine modules is a long way to scroll to answer one question, and
   * the question is almost always about one module — «who can open pacientes».
   * Matched against the label the row actually shows, not the key, so typing
   * "nómina" finds it and typing "nomina" does too.
   */
  const [permQuery, setPermQuery] = useState('')
  const permGroups = (() => {
    const needle = permQuery.trim().toLowerCase()
    const groups = permissionsByModule()
    if (!needle) return groups
    const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    const folded = fold(needle)
    return groups.filter((g) =>
      fold(MODULE_LABELS[g.module] ?? g.module).includes(folded) || fold(g.module).includes(folded),
    )
  })()

  const [newRole, setNewRole] = useState('')
  const [copyFrom, setCopyFrom] = useState('')
  const [renaming, setRenaming] = useState<{ key: string; label: string } | null>(null)

  const addRole = () => {
    const label = newRole.trim()
    if (!label) return
    startTransition(async () => {
      const result = await createRole({ label, copyFrom: copyFrom || undefined })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setNewRole('')
      setCopyFrom('')
      addToast(
        copyFrom
          ? `Rol ${label} creado con los permisos de ${copyFrom}`
          : `Rol ${label} creado. Ahora dale permisos en la matriz.`,
        'ok',
      )
      router.refresh()
    })
  }

  const seedRoles = () => {
    startTransition(async () => {
      const result = await seedSuggestedRoles()
      if (!result.ok) { addToast(result.error, 'err'); return }
      addToast('Roles sugeridos añadidos.', 'ok')
      router.refresh()
    })
  }

  const renameRole = (key: string, label: string) => {
    const trimmed = label.trim()
    if (!trimmed) return
    startTransition(async () => {
      const result = await updateRole({ key, label: trimmed })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setRenaming(null)
      router.refresh()
    })
  }

  const removeRole = async (key: string, memberCount: number) => {
    const warning = memberCount > 0
      ? `${key} lo tienen ${memberCount} persona(s). Muévelas a otro rol antes de eliminarlo.`
      : `¿Eliminar el rol ${key}? Se borran también sus permisos. Esta acción no se puede deshacer.`
    if (memberCount > 0) { addToast(warning, 'err'); return }
    if (!(await confirm({ title: warning }))) return
    startTransition(async () => {
      const result = await deleteRole(key)
      if (!result.ok) { addToast(result.error, 'err'); return }
      addToast(`Rol ${key} eliminado`, 'info')
      router.refresh()
    })
  }

  /* ---- two-step verification ---- */
  const [enrolment, setEnrolment] = useState<MfaEnrollment | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaBusy, setMfaBusy] = useState(false)
  const [disabling, setDisabling] = useState(false)

  const startMfa = async () => {
    setMfaBusy(true)
    try {
      const data = await apiFetch<MfaEnrollment>('/api/auth/mfa', { method: 'POST' })
      setMfaCode('')
      setEnrolment(data)
    } catch (err) {
      addToast(errorMessage(err, 'No se pudo iniciar la verificación en dos pasos.'), 'err')
    } finally {
      setMfaBusy(false)
    }
  }

  const confirmMfa = async () => {
    if (!enrolment || mfaCode.length !== 6) return
    setMfaBusy(true)
    try {
      await apiFetch('/api/auth/mfa', {
        method: 'PUT',
        body: JSON.stringify({ factorId: enrolment.factorId, code: mfaCode }),
      })
      setEnrolment(null)
      setMfaCode('')
      addToast('Verificación en dos pasos activada', 'ok')
      router.refresh()
    } catch (err) {
      setMfaCode('')
      addToast(errorMessage(err, 'El código no es válido.'), 'err')
    } finally {
      setMfaBusy(false)
    }
  }

  const disableMfa = async () => {
    if (mfaCode.length !== 6) return
    setMfaBusy(true)
    try {
      await apiFetch('/api/auth/mfa', {
        method: 'DELETE',
        body: JSON.stringify({ code: mfaCode }),
      })
      setDisabling(false)
      setMfaCode('')
      addToast('Verificación en dos pasos desactivada', 'info')
      router.refresh()
    } catch (err) {
      setMfaCode('')
      addToast(errorMessage(err, 'El código no es válido.'), 'err')
    } finally {
      setMfaBusy(false)
    }
  }

  /* ---- invitations ---- */
  const [inviteEmail, setInviteEmail] = useState('')
  /**
   * Opens on the narrowest role the organization defines — `data.roles` is
   * ordered by rank, so that is the last one. An invitation submitted without
   * touching the select must not hand out more access than was asked for.
   */
  const [inviteRole, setInviteRole] = useState<RoleKey>(
    data.roles.length > 0 ? data.roles[data.roles.length - 1].key : '',
  )

  const invite = () => {
    const email = inviteEmail.trim()
    if (!email) return
    startTransition(async () => {
      const result = await inviteMember({ email, role: inviteRole })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setInviteEmail('')
      addToast(`Invitación creada para ${email}`, 'ok')
      // The list is server-rendered, so it needs the route re-read to appear.
      router.refresh()
    })
  }

  const revoke = (id: string, email: string) => {
    startTransition(async () => {
      const result = await revokeInvitation(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      addToast(`Invitación a ${email} cancelada`, 'info')
      router.refresh()
    })
  }

  /**
   * The address is what the signup trigger matches on, so the link only
   * prefills the form — it is not a credential, and a copied link used with a
   * different address creates a new organization instead of joining this one.
   */
  const copyInviteLink = async (email: string) => {
    const url = `${window.location.origin}/register?email=${encodeURIComponent(email)}`
    try {
      await navigator.clipboard.writeText(url)
      addToast('Enlace copiado', 'ok')
    } catch {
      addToast('No se pudo copiar el enlace.', 'err')
    }
  }

  /**
   * Assigns a role directly instead of cycling through the list.
   *
   * Cycling worked while there were exactly three: reaching the third took two
   * clicks and two round trips. With an organization free to define eight, it
   * would take seven of each, and every intermediate step is a real write that
   * really changes what that person can open.
   */
  const changeMemberRole = (membershipId: string, next: RoleKey) => {
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
    { id: 'modulos', label: 'Módulos', ico: LayoutGrid },
    // Between Módulos and Roles on purpose: a branch is structure, like a
    // module, and the roles tab reads better once the structure is settled.
    { id: 'sucursales', label: 'Sucursales', ico: MapPin },
    { id: 'roles', label: 'Roles y permisos', ico: Shield },
  ]

  /* ---- field error helper ---- */
  const fe = (key: string) => errors[key] ? <div style={{ fontSize: 11.5, color: '#ef4444', fontWeight: 400, marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}><AlertTriangle size={12} />{errors[key]}</div> : null
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
              <Avatar name={name} size={64} src={avatarUrl} />
              <div>
                <label className="btn" style={{ cursor: 'pointer' }}>
                  <Upload size={14} />Cambiar foto
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={onAvatarChange}
                    style={{ display: 'none' }}
                  />
                </label>
                <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 6 }}>PNG o JPG · máx. 2 MB</div>
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
            {/* These four switches have never been persisted: `save()` has no
                branch for this tab, so "Cambios guardados correctamente" was
                reporting a write that did not happen, and the selection reset
                on the next load. Kigyo also sends no mail yet. Said plainly
                until there is a preferences table and something that reads it. */}
            <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 10 }}>
              Elige qué notificaciones quieres recibir. Kigyo todavía no envía correos:
              esta selección queda anotada para cuando se activen los envíos.
            </div>
            <div className="acc"><span className="acico"><PenLine size={16} /></span>
              <div style={{ flex: 1 }}><div className="act">Firmas pendientes</div><div className="acs">Recordatorios de documentos por firmar</div></div>
              <Toggle on={notifs.firmas} onChange={() => toggleNotif('firmas')} ariaLabel="Firmas pendientes" /></div>
            <div className="acc"><span className="acico"><Ticket size={16} /></span>
              <div style={{ flex: 1 }}><div className="act">Tickets asignados</div><div className="acs">Cuando un ticket se asigna a tu equipo</div></div>
              <Toggle on={notifs.tickets} onChange={() => toggleNotif('tickets')} ariaLabel="Tickets asignados" /></div>
            <div className="acc"><span className="acico"><Sparkles size={16} /></span>
              <div style={{ flex: 1 }}><div className="act">Menciones en IA</div><div className="acs">Cuando el asistente te incluye en un resumen</div></div>
              <Toggle on={notifs.menciones} onChange={() => toggleNotif('menciones')} ariaLabel="Menciones en IA" /></div>
            <div className="acc"><span className="acico"><Mail size={16} /></span>
              <div style={{ flex: 1 }}><div className="act">Resumen semanal por correo</div><div className="acs">Cada lunes a las 8:00 a. m.</div></div>
              <Toggle on={notifs.resumen} onChange={() => toggleNotif('resumen')} ariaLabel="Resumen semanal por correo" /></div>
            {/* No Guardar button: `save()` has no branch for this tab, so the
                one that used to be here always fell through to the generic
                "Cambios guardados correctamente". A button whose only effect
                is a success message is the thing worth deleting. */}
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
                  <span style={{ fontSize: 11, fontWeight: 400, color: str.color, flexShrink: 0 }}>{str.label}</span>
                </div>
              </div>
            )}

            <div className="flabel">Confirmar nueva contraseña</div>
            <input className="field" type="password" placeholder="Repite la contraseña" value={pw.confirm} onChange={(e) => { setPw((p) => ({ ...p, confirm: e.target.value })); mark() }} style={fi('pwConfirm') ? { borderColor: fi('pwConfirm') } : undefined} />
            {fe('pwConfirm')}

            <button className="btn dark" style={{ marginTop: 18 }} onClick={save}><Check size={15} />Actualizar contraseña</button>

            <div style={{ height: 1, background: 'var(--line2)', margin: '24px 0' }} />

            <div className="ctitle" style={{ marginBottom: 10 }}>Seguridad de la cuenta</div>

            {/* The switch here used to flip, mark the form dirty and get
                dropped on save — nothing sent it anywhere, and a control that
                reports "activada" while enrolling nothing is worse than one
                that is missing. It enrols now: Supabase Auth speaks TOTP, so
                the factor is real, and `getMember` refuses a session that
                stopped at the password on an enrolled account. */}
            <div className="acc"><span className="acico"><Lock size={16} /></span>
              <div style={{ flex: 1 }}>
                <div className="act">Verificación en dos pasos</div>
                <div className="acs">
                  {data.mfaEnabled
                    ? 'Activa · te pedimos un código al iniciar sesión'
                    : 'Código adicional al iniciar sesión, desde tu app de autenticación'}
                </div>
              </div>
              {data.mfaEnabled ? (
                <button
                  className="btn"
                  disabled={mfaBusy}
                  onClick={() => { setDisabling((v) => !v); setMfaCode('') }}
                >
                  {disabling ? 'Cancelar' : 'Desactivar'}
                </button>
              ) : (
                <button
                  className="btn dark"
                  disabled={mfaBusy}
                  aria-busy={mfaBusy}
                  onClick={() => { if (enrolment) setEnrolment(null); else void startMfa() }}
                >
                  {enrolment ? 'Cancelar' : 'Activar'}
                </button>
              )}
            </div>

            {enrolment && (
              <div className="card cpad" style={{ marginTop: 10, background: 'var(--bg)' }}>
                <div className="act" style={{ marginBottom: 8 }}>Escanea el código</div>
                <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  {/* Supabase hands back the QR as an SVG data URI, so it goes
                      in an <img> rather than anywhere near innerHTML. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={enrolment.qrCode}
                    alt="Código QR para tu app de autenticación"
                    width={168}
                    height={168}
                    style={{ background: '#fff', borderRadius: 'var(--r)', padding: 8 }}
                  />
                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <p style={{ fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.55, marginTop: 0 }}>
                      Ábrelo con Google Authenticator, 1Password, Authy o el gestor que uses.
                      ¿Sin cámara? Escribe esta clave a mano:
                    </p>
                    <code
                      className="mono"
                      style={{ fontSize: 12, wordBreak: 'break-all', display: 'block', marginBottom: 12 }}
                    >
                      {enrolment.secret}
                    </code>
                    <div className="flabel" style={{ marginTop: 0 }}>Código de 6 dígitos</div>
                    <OtpInput value={mfaCode} onChange={setMfaCode} disabled={mfaBusy} />
                    <button
                      className="btn dark"
                      style={{ marginTop: 12 }}
                      disabled={mfaBusy || mfaCode.length !== 6}
                      aria-busy={mfaBusy}
                      onClick={() => void confirmMfa()}
                    ><Check size={15} />Activar</button>
                  </div>
                </div>
              </div>
            )}

            {data.mfaEnabled && disabling && (
              <div className="card cpad" style={{ marginTop: 10, background: 'var(--bg)' }}>
                <div className="act" style={{ marginBottom: 4 }}>Confirma con un código</div>
                <p style={{ fontSize: 12.5, color: 'var(--ink3)', lineHeight: 1.55, marginTop: 0 }}>
                  Pedimos un código para desactivarla: si bastara con esta sesión, una pestaña
                  abierta alcanzaría para quitarle la protección a la cuenta.
                </p>
                <OtpInput value={mfaCode} onChange={setMfaCode} disabled={mfaBusy} />
                <button
                  className="btn danger"
                  style={{ marginTop: 12 }}
                  disabled={mfaBusy || mfaCode.length !== 6}
                  aria-busy={mfaBusy}
                  onClick={() => void disableMfa()}
                >Desactivar</button>
              </div>
            )}

            <button
              className="btn danger"
              style={{ marginTop: 18 }}
              disabled={pending}
              onClick={async () => {
                if (!(await confirm({ title: '¿Cerrar sesión en todos tus dispositivos?', description: 'Tendrás que volver a iniciar sesión en cada uno, incluido este.' }))) return
                startTransition(async () => {
                  const result = await signOutEverywhere()
                  if (!result.ok) { addToast(result.error, 'err'); return }
                  // This session was revoked too, so there is nothing left to
                  // render here. `replace` keeps the dashboard out of history.
                  router.replace('/login')
                })
              }}
            ><LogOut size={15} />Cerrar sesión en todos los dispositivos</button>
          </>
        )}

        {/* ========== EMPRESA ========== */}
        {tab === 'empresa' && (
          <>
            <div className="ctitle" style={{ marginBottom: 6 }}>Información de la organización</div>
            <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 10 }}>Estos datos se usan en reportes, facturación y comunicaciones oficiales.</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
              {logoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element --
                   la fuente es una URL firmada de Supabase Storage que caduca,
                   así que no hay una ruta estable que `next/image` pueda
                   optimizar, y su loader tampoco puede firmarla. Mismo caso que
                   los dos SVG locales documentados en la fase 7. */
                <img
                  src={logoUrl}
                  alt={`Logo de ${company}`}
                  width={56}
                  height={56}
                  style={{ width: 56, height: 56, borderRadius: 'var(--r)', objectFit: 'contain', background: 'var(--bg2)', flexShrink: 0 }}
                />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: 'var(--r)', background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 400, color: '#fff', flexShrink: 0, boxShadow: '0 4px 14px rgba(59,130,246,.30)' }}>
                  {company.charAt(0)}
                </div>
              )}
              <div>
                {data.canManage ? (
                  <label className="btn" style={{ cursor: 'pointer' }}>
                    <Upload size={14} />Cambiar logo
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={onLogoChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                ) : (
                  <div className="muted" style={{ fontSize: 12.5 }}>
                    Solo quien administra la empresa puede cambiar el logo.
                  </div>
                )}
                <div style={{ fontSize: 11.5, color: 'var(--ink3)', marginTop: 6 }}>PNG, JPG o WebP · máx. 2 MB</div>
              </div>
            </div>
            <div className="flabel">Nombre de la empresa</div>
            <input className="field" value={company} onChange={(e) => { setCompany(e.target.value); mark() }} style={fi('company') ? { borderColor: fi('company') } : undefined} />
            {fe('company')}
            <div className="flabel">Industria</div>
            <input className="field" value={industry} onChange={(e) => { setIndustry(e.target.value); mark() }} />
            {/*
              Las cuatro de abajo se preguntaban **una sola vez**, en el
              asistente, y no había dónde corregirlas: un NIT mal tecleado el
              primer día se quedaba en todas las facturas de la empresa y la
              única salida era crear otra. Aquí, donde ya se edita el nombre.
            */}
            <div className="flabel">Razón social</div>
            <input
              className="field" value={legalName} maxLength={200}
              placeholder="Si difiere del nombre comercial"
              onChange={(e) => { setLegalName(e.target.value); mark() }}
            />
            <div className="flabel">NIT / identificación fiscal</div>
            <input
              className="field" value={taxId} maxLength={40}
              placeholder="Aparece en facturas y contratos"
              onChange={(e) => { setTaxId(e.target.value); mark() }}
            />
            <div className="flabel">Ciudad</div>
            <input
              className="field" value={city} maxLength={80}
              placeholder="Domicilio de la empresa"
              onChange={(e) => { setCity(e.target.value); mark() }}
            />
            <div className="flabel">Dirección</div>
            <input
              className="field" value={address} maxLength={200}
              placeholder="Calle, número, oficina"
              onChange={(e) => { setAddress(e.target.value); mark() }}
            />
            {/*
              Decía «Próximamente», que es una promesa y no una descripción.
              Kigyo es colombiano por dentro: 67 archivos fijan `es-CO`, la
              nómina, la DIAN y el PILA son de Colombia, y las tasas de IVA de la
              migración 104 también. La fase 5 ya retiró el selector de moneda
              justo por esto — ofrecer un ajuste que no hace nada. Anunciar el
              cambio de región es la misma promesa, dicha en el mismo sitio.
            */}
            <div className="acc" style={{ marginTop: 6 }}><span className="acico"><Globe size={16} /></span>
              <div style={{ flex: 1 }}><div className="act">Idioma y región</div><div className="acs">Español (Colombia) · COP</div></div>
              <div style={{ fontSize: 11.5, color: 'var(--ink3)', fontWeight: 400 }}>Fijo</div></div>
            <button className="btn dark" style={{ marginTop: 18 }} onClick={save}><Check size={15} />Guardar cambios</button>
          </>
        )}

        {/* ========== MÓDULOS ========== */}
        {tab === 'modulos' && (
          <>
            <div className="ctitle" style={{ marginBottom: 6 }}>Módulos de la plataforma</div>
            <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 16, maxWidth: 620, lineHeight: 1.55 }}>
              Kigyo trae {MODULE_COUNT} módulos y ninguna empresa usa todos. Elige el sector de
              tu empresa para partir de una selección razonable y ajusta lo que sobre o falte.
              Un módulo apagado desaparece del menú para toda la organización, incluida
              administración. Dashboard y Configuración siempre están activos.
            </div>

            {/* The plan, stated before the toggles rather than discovered
                through a locked one. Two different limits get named: which
                modules are reachable at all, and how many people fit. */}
            <div className="plan-banner">
              <div className="plan-banner-main">
                <div className="plan-banner-name">
                  Plan {member.planDef.label}
                  <span className="plan-banner-count">
                    {availableCount} de {MODULE_COUNT} módulos disponibles
                  </span>
                </div>
                <div className="plan-banner-desc">
                  {member.planDef.description}
                </div>
                {/* What the plan allows against what is being used, stated as
                    numbers. "Hasta 10 colaboradores" was a rule; "3 de 10" is
                    an answer — and it is the number somebody checks before
                    inviting the eleventh person or opening a second branch. */}
                <div className="plan-banner-desc">
                  Empresas {companiesUsed}
                  {member.planDef.maxCompanies === null ? ' · sin límite' : ` de ${member.planDef.maxCompanies}`}
                  {' · '}
                  Sucursales {sites.sites.length}
                  {member.planDef.maxSitesPerCompany === null ? ' · sin límite' : ` de ${member.planDef.maxSitesPerCompany}`}
                  {' · '}
                  Personas {data.members.length}
                  {member.planDef.seats === null ? ' · sin límite' : ` de ${member.planDef.seats}`}
                </div>
              </div>
              {availableCount < MODULE_COUNT && (
                <Link className="btn" href="/pricing">Ver planes</Link>
              )}
            </div>

            <div className="flabel" style={{ marginTop: 0 }}>Sector de tu empresa</div>
            {/* Said above the cards, not inside a refusal after the click.
                The sector is the one choice on this screen that stops being a
                choice: it decides which vertical the company runs on, and once
                there are records in it there is nowhere for them to go. Modules
                stay editable underneath, which is the part people actually
                change. */}
            {!sectorLocked ? (
              <div style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 10, maxWidth: 620, lineHeight: 1.55 }}>
                Aún puedes cambiarlo: esta empresa todavía no tiene datos propios de su
                sector. En cuanto los tenga, queda fijo.
              </div>
            ) : (
              <div className="mod-sector-locked" role="note">
                <strong>{lockedSectorLabel}</strong> — el sector queda fijo porque esta
                empresa ya tiene datos propios de él. Para operar otro sector,{' '}
                <Link href="/dashboard/empresas">crea otra empresa</Link>. Los módulos
                siguen siendo tuyos para activar y desactivar.
              </div>
            )}
            <div className="mod-types" hidden={sectorLocked}>
              {sectorCards.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={`mod-type${companyTypeKey === t.key ? ' on' : ''}`}
                  disabled={!canManage || pending || sectorLocked}
                  aria-pressed={companyTypeKey === t.key}
                  // Picking a type replaces the selection outright. Merging
                  // would make the button do nothing visible on a second click
                  // and would quietly keep modules from a type you moved away
                  // from — the point of choosing a type is to start over.
                  onClick={() => {
                    setCompanyTypeKey(t.key)
                    // The subsector belongs to exactly one sector, and the
                    // database refuses a mismatched pair on save.
                    setSubsectorKey(null)
                    setModules(new Set(
                      presetFromCatalogue(data.catalogue, t.key)
                        .filter((k) => member.planIncludes(k)),
                    ))
                    mark()
                  }}
                >
                  <span className="mod-type-name">{t.label}</span>
                  <span className="mod-type-desc">{t.description}</span>
                </button>
              ))}
            </div>

            {subsectorOptions.length > 0 && !sectorLocked && (
              <>
                <div className="flabel">Tipo de {sectorLabel}</div>
                <Select
                  value={subsectorKey ?? ''}
                  // Re-proposes rather than merely recording. The kind of
                  // business is the second half of the same question, and
                  // storing the answer without acting on it is what this
                  // control did until now.
                  //
                  // Derived from the sector, never layered on the current
                  // selection: applying a delta twice, or onto modules somebody
                  // had already toggled by hand, produces a set nobody can
                  // explain. Everything stays individually switchable below.
                  onChange={(v) => {
                    const next = v || null
                    setSubsectorKey(next)
                    setModules(new Set(
                      presetFromCatalogue(data.catalogue, companyTypeKey, next)
                        .filter((k) => member.planIncludes(k)),
                    ))
                    mark()
                  }}
                  options={[
                    { value: '', label: 'Prefiero no precisar' },
                    ...subsectorOptions.map((o) => ({ value: o.key, label: o.label })),
                  ]}
                />
                <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 6, marginBottom: 4 }}>
                  Afina la sugerencia de módulos. Una panadería y un bar son el mismo sector
                  y no usan lo mismo.
                </div>
              </>
            )}

            {/*
              El catálogo, por la misma división con la que se vende el producto.

              Cincuenta y siete módulos en una lista plana obligan a leerla
              entera para contestar «¿tengo puesto el mostrador?». Las pastillas
              contestan eso de un vistazo, con la cuenta al lado, y el filtro no
              se guarda: esta pantalla se abre a hacer una cosa y se cierra.
            */}
            <div className="nav-lens mod-lens" role="group" aria-label="Filtrar por segmento">
              <button
                type="button"
                className={`nav-lens-chip${modFilter === null ? ' on' : ''}`}
                aria-pressed={modFilter === null}
                onClick={() => setModFilter(null)}
              >
                Todo · {modules.size}/{availableCount}
              </button>
              {SUITES.map((suite) => {
                // Contra el plan, no contra el catálogo entero: ofrecer «3/12»
                // donde nueve de esos doce no se pueden encender es contar algo
                // que no está en juego.
                const inPlan = modulesInSuite(suite.key).filter((k) => member.planIncludes(k))
                const on = inPlan.filter((k) => modules.has(k)).length
                return (
                  <button
                    key={suite.key}
                    type="button"
                    className={`nav-lens-chip${modFilter === suite.key ? ' on' : ''}`}
                    aria-pressed={modFilter === suite.key}
                    title={`${suite.name}: ${suite.description}`}
                    onClick={() => setModFilter(modFilter === suite.key ? null : suite.key)}
                  >
                    {suite.label} · {on}/{inPlan.length}
                  </button>
                )
              })}
            </div>

            <div className="mod-summary">
              <span>
                {modules.size} de {availableCount} módulos activos
              </span>
              {/* Always rendered, `visibility`-gated: mounting/unmounting this
                  button changes the summary's height and scroll anchoring
                  jumps the page on every toggle. A hidden button keeps the
                  layout height constant. */}
              <button
                type="button"
                className="mod-reset"
                disabled={!canManage || pending}
                tabIndex={companyTypeKey && !matchesPreset ? undefined : -1}
                style={{ visibility: companyTypeKey && !matchesPreset ? 'visible' : 'hidden' }}
                onClick={() => { setModules(new Set(preset)); mark() }}
              >
                Selección personalizada · restablecer el preset
              </button>
            </div>

            {modulesByGroup().map(({ group, modules: all }) => {
              const defs = all.filter(
                (m) => modFilter === null || suitesOf(m.key).includes(modFilter),
              )
              if (defs.length === 0) return null
              return (
              <div key={group} style={{ marginTop: 18 }}>
                <div className="mod-group">{group}</div>
                {defs.map((m) => {
                  // Three states, not two. A module outside the plan is not
                  // "off" — no toggle here will turn it on — so it says which
                  // plan it needs instead of pretending to be switchable.
                  const locked = !member.planIncludes(m.key)
                  const required = locked ? lowestPlanWith(m.key) : null
                  return (
                    <div className="acc" key={m.key} data-locked={locked ? 'true' : undefined}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="act">
                          {m.label}
                          {locked && (
                            <span className="mod-lock">
                              <Lock size={11} aria-hidden="true" />
                              {required ? required.label : 'No disponible'}
                            </span>
                          )}
                        </div>
                        <div className="acs">{m.description}</div>
                      </div>
                      {locked ? (
                        <Link className="btn mod-upgrade" href="/pricing">
                          Ver planes
                        </Link>
                      ) : (
                        <Toggle
                          on={modules.has(m.key)}
                          disabled={!canManage || pending}
                          ariaLabel={`Módulo ${m.label}`}
                          onChange={(next) => {
                            setModules((prev) => {
                              const copy = new Set(prev)
                              if (next) copy.add(m.key)
                              else copy.delete(m.key)
                              return copy
                            })
                            mark()
                          }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
              )
            })}

            {!canManage ? (
              <p style={{ fontSize: 12.5, color: 'var(--ink3)', marginTop: 18 }}>
                Solo una persona administradora puede cambiar los módulos de la organización.
              </p>
            ) : (
              /*
                Sticky, because the toggles are thirty-five rows long and the
                button used to sit under the last of them. Switching something
                on at the top meant scrolling past everything to commit it —
                and the tab guard would then ask whether to discard changes the
                user believed they had already made. The bar follows the work
                and says what is unsaved, so Guardar is never out of reach.
              */
              <div className="mod-save" data-dirty={dirty ? 'true' : undefined}>
                <span className="mod-save-state">
                  {dirty
                    ? `${modules.size} módulo${modules.size === 1 ? '' : 's'} seleccionado${modules.size === 1 ? '' : 's'} · sin guardar`
                    : 'Todo guardado'}
                </span>
                <button className="btn dark" onClick={save} disabled={pending || !dirty}>
                  <Check size={15} />Guardar módulos
                </button>
              </div>
            )}
          </>
        )}

        {/* ========== ROLES Y PERMISOS ========== */}
        {tab === 'sucursales' && (
          <SucursalesTab
            data={sites}
            members={members.map((m) => ({ userId: m.userId, fullName: m.fullName, role: m.role }))}
            canManage={canManage}
          />
        )}

        {tab === 'roles' && (
          <>
            <div className="ctitle" style={{ marginBottom: 6 }}>Roles de la organización</div>
            <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 14, maxWidth: 640, lineHeight: 1.55 }}>
              Los roles son tuyos: créalos con los nombres que usa tu empresa —«Médico»,
              «Recepción», «Residente de obra»— y decide en la matriz qué abre cada uno.
              Los tres que vienen de fábrica se pueden renombrar y eliminar como cualquier otro.
            </div>

            {canManage && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
                <input
                  className="field"
                  placeholder="Nombre del nuevo rol"
                  value={newRole}
                  maxLength={40}
                  onChange={(e) => setNewRole(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addRole() }}
                  style={{ flex: '1 1 220px', minWidth: 0 }}
                  aria-label="Nombre del nuevo rol"
                />
                {/* Copying is what makes this usable. Building a role from
                    nothing is thirty-nine switches; building it from an
                    existing one is the two or three that differ. */}
                <Select
                  value={copyFrom}
                  onChange={setCopyFrom}
                  placeholder="Sin copiar permisos"
                  options={[
                    { value: '', label: 'Sin copiar permisos' },
                    ...roles.map((r) => ({ value: r.key, label: `Copiar de ${r.label}` })),
                  ]}
                  style={{ width: 220 }}
                />
                <button
                  className="btn dark"
                  disabled={pending || newRole.trim() === ''}
                  aria-busy={pending}
                  onClick={addRole}
                >
                  <Plus size={15} />Crear rol
                </button>
                {data.organization.companyType && (
                  <button
                    className="btn"
                    disabled={pending}
                    aria-busy={pending}
                    onClick={seedRoles}
                  >
                    <Sparkles size={15} />Añadir roles sugeridos
                  </button>
                )}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
              {roles.map((r) => (
                <div
                  className="elrow"
                  key={r.key}
                  style={{ padding: '10px 12px', borderRadius: 'var(--r)', background: 'var(--bg)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <span className={`permrole-ico ${ROLE_TONE[r.key] ?? ''}`} style={{ marginBottom: 0 }}>
                      {permissions[r.key]?.['configuracion:manage']
                        ? <Shield size={14} />
                        : isSystemRole(r.key) ? <Star size={14} /> : <Users size={14} />}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      {renaming?.key === r.key ? (
                        <input
                          className="field"
                          autoFocus
                          value={renaming.label}
                          maxLength={40}
                          style={{ height: 30, fontSize: 13 }}
                          onChange={(e) => setRenaming({ key: r.key, label: e.target.value })}
                          onBlur={() => renameRole(r.key, renaming.label)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') renameRole(r.key, renaming.label)
                            if (e.key === 'Escape') setRenaming(null)
                          }}
                          aria-label={`Nuevo nombre para el rol ${r.label}`}
                        />
                      ) : (
                        <div className="eltxt" style={{ fontSize: 13, fontWeight: 400 }}>
                          {r.label}
                          {r.isSystem && (
                            <span style={{ color: 'var(--ink3)', fontSize: 11 }}> · de fábrica</span>
                          )}
                        </div>
                      )}
                      <div className="elsub" style={{ fontSize: 11.5 }}>
                        {r.members === 0 ? 'Nadie lo tiene' : `${r.members} persona${r.members === 1 ? '' : 's'}`}
                        {' · '}
                        {Object.values(permissions[r.key] ?? {}).filter(Boolean).length} permisos
                      </div>
                    </div>
                  </div>
                  {canManage && (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button
                        className="ibtn"
                        style={{ width: 28, height: 28 }}
                        data-tip="Renombrar"
                        disabled={pending}
                        onClick={() => setRenaming({ key: r.key, label: r.label })}
                        aria-label={`Renombrar el rol ${r.label}`}
                      ><PenLine size={13} /></button>
                      <button
                        className="ibtn"
                        style={{ width: 28, height: 28, color: 'var(--redd)' }}
                        data-tip={r.members > 0 ? 'Todavía hay personas con este rol' : 'Eliminar rol'}
                        disabled={pending}
                        onClick={() => removeRole(r.key, r.members)}
                        aria-label={`Eliminar el rol ${r.label}`}
                      ><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="ctitle" style={{ marginBottom: 6 }}>Permisos por rol</div>
            <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 10 }}>Define qué módulos puede ver y gestionar cada rol.</div>

            {/* Thirty-nine modules, and the question is nearly always about
                one of them. Scrolling to it was the whole cost of answering. */}
            <input
              className="field"
              type="search"
              placeholder="Buscar módulo…"
              value={permQuery}
              onChange={(e) => setPermQuery(e.target.value)}
              style={{ marginBottom: 10 }}
              aria-label="Filtrar la matriz por módulo"
            />

            {/*
              One matrix instead of a list per role. The previous layout
              repeated all 39 permission labels once per role — 117 labelled
              rows to read — and threw away the module grouping the data
              already carries. Here each label is written once and the roles
              line up in columns, which is the comparison this screen exists to
              make. The column count is now the organization's, so it rides on
              a CSS variable instead of being fixed at three.
            */}
            <div className="permwrap">
              <div className="permmatrix" style={{ ['--perm-cols' as string]: roles.length }}>
                <div className="permcorner">Módulo</div>
                {roles.map((r) => (
                  <div key={r.key} className="permrole">
                    <span className={`permrole-ico ${ROLE_TONE[r.key] ?? ''}`}>
                      {permissions[r.key]?.['configuracion:manage']
                        ? <Shield size={14} />
                        : isSystemRole(r.key) ? <Star size={14} /> : <Users size={14} />}
                    </span>
                    <span className="permrole-name">{r.label}</span>
                    <span className="permrole-sub">
                      {ROLE_SUB[r.key] ??
                        `${Object.values(permissions[r.key] ?? {}).filter(Boolean).length} permisos`}
                    </span>
                  </div>
                ))}

                {permGroups.length === 0 && (
                  <div className="permempty">
                    Ningún módulo coincide con «{permQuery.trim()}».
                  </div>
                )}

                {permGroups.flatMap((group) => [
                  <div key={`m-${group.module}`} className="permmodule">
                    {/* Sticky-left inside its full-width banner, so the module
                        name stays readable while the switches scroll sideways. */}
                    <span>{MODULE_LABELS[group.module] ?? group.module}</span>
                  </div>,
                  ...group.permissions.flatMap((permission) => [
                    <div key={`l-${permission}`} className="permlabel">
                      {ACTION_LABELS[permission.split(':')[1]] ?? PERMISSION_LABELS[permission]}
                    </div>,
                    ...roles.map((r) => (
                      <div key={`c-${permission}-${r.key}`} className="permcell">
                        <Toggle
                          size="sm"
                          on={permissions[r.key]?.[permission] ?? false}
                          onChange={() => togglePerm(r.key, permission)}
                          /* Not gated on `pending`: one in-flight write used to
                             grey out every switch, and the flip is optimistic
                             anyway. Nor is any role locked out of editing —
                             administration is no longer a name, and the
                             database refuses at COMMIT the one change that
                             would leave nobody able to administer. */
                          disabled={!canManage}
                          ariaLabel={`${PERMISSION_LABELS[permission]} para ${r.label}`}
                        />
                      </div>
                    )),
                  ]),
                ])}
              </div>
            </div>

            {!canManage && (
              <p style={{ fontSize: 12.5, color: 'var(--ink3)', marginTop: 10 }}>
                Solo una persona administradora puede cambiar estos permisos.
              </p>
            )}
            {canManage && (
              <p style={{ fontSize: 12.5, color: 'var(--ink3)', marginTop: 10, maxWidth: 640, lineHeight: 1.55 }}>
                Los cambios se guardan al instante. Administrar la organización lo tienen{' '}
                {adminHolders} persona{adminHolders === 1 ? '' : 's'} en{' '}
                {adminRoles.length} rol{adminRoles.length === 1 ? '' : 'es'}; el sistema no
                permite dejar la cuenta sin nadie que pueda administrarla.
              </p>
            )}

            <div className="ctitle" style={{ marginBottom: 12 }}>Rol por persona</div>
            <div style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 10 }}>Asigna el nivel de acceso individual de cada colaborador.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {members.map((m) => (
                <div className="elrow" key={m.membershipId} style={{ padding: '10px 12px', borderRadius: 'var(--r)', background: 'var(--bg)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Avatar name={m.fullName} size={32} />
                    <div>
                      <div className="eltxt" style={{ fontSize: 13, fontWeight: 400 }}>
                        {m.fullName}{m.isSelf && <span style={{ color: 'var(--ink3)', fontWeight: 400 }}> · tú</span>}
                      </div>
                      <div className="elsub" style={{ fontSize: 11.5 }}>{m.email}</div>
                    </div>
                  </div>
                  {canManage ? (
                    <Select
                      value={m.role}
                      onChange={(v) => changeMemberRole(m.membershipId, v)}
                      /* The person's current role is unioned in so a role
                         deleted elsewhere still renders as their value instead
                         of the select snapping to whatever sorts first. */
                      options={
                        roles.some((r) => r.key === m.role)
                          ? roles.map((r) => ({ value: r.key, label: r.label }))
                          : [...roles.map((r) => ({ value: r.key, label: r.label })),
                             { value: m.role, label: m.role }]
                      }
                      style={{ width: 190, flexShrink: 0 }}
                    />
                  ) : (
                    <span className="prole" style={{ cursor: 'default' }}>{m.role}</span>
                  )}
                </div>
              ))}
              {members.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--ink3)' }}>
                  Todavía no hay más personas en la organización.
                </p>
              )}
            </div>

            {canManage && (
              <>
                <div style={{ height: 1, background: 'var(--line2)', margin: '24px 0' }} />

                <div className="ctitle" style={{ marginBottom: 6 }}>Invitar a alguien</div>
                {/*
                  No email leaves Kigyo yet — that needs a mail provider this
                  install does not have. The invitation still works without
                  one: the signup trigger looks for a pending invitation
                  matching the address, so whoever registers with that correo
                  lands in this organization with this role. What the
                  administrator sends, and how, is up to them.
                */}
                <p style={{ fontSize: 13, color: 'var(--ink3)', marginBottom: 12, maxWidth: 620, lineHeight: 1.55 }}>
                  Quien se registre con ese correo entra directo a {data.organization.name} con
                  el rol que elijas, sin crear otra organización. Todavía no enviamos el correo
                  desde aquí: copia el enlace y hazlo llegar tú.
                </p>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    className="field"
                    type="email"
                    placeholder="persona@empresa.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') invite() }}
                    style={{ flex: '1 1 240px', minWidth: 0 }}
                    aria-label="Correo de la persona a invitar"
                  />
                  <Select
                    value={inviteRole}
                    onChange={(v) => setInviteRole(v as RoleKey)}
                    options={roles.map((r) => ({ value: r.key, label: r.label }))}
                    style={{ width: 190 }}
                  />
                  <button
                    className="btn dark"
                    disabled={pending || inviteEmail.trim() === ''}
                    aria-busy={pending}
                    onClick={invite}
                  >
                    <Plus size={15} />Invitar
                  </button>
                </div>

                {data.invitations.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
                    {data.invitations.map((inv) => (
                      <div
                        className="elrow"
                        key={inv.id}
                        style={{ padding: '10px 12px', borderRadius: 'var(--r)', background: 'var(--bg)' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          <span className="acico"><Mail size={15} /></span>
                          <div style={{ minWidth: 0 }}>
                            <div className="eltxt" style={{ fontSize: 13, fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {inv.email}
                            </div>
                            <div className="elsub" style={{ fontSize: 11.5 }}>
                              {inv.role} · vence el {INVITE_DATE.format(new Date(inv.expiresAt))}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          <button
                            className="ibtn"
                            style={{ width: 28, height: 28 }}
                            data-tip="Copiar enlace de registro"
                            onClick={() => void copyInviteLink(inv.email)}
                            aria-label={`Copiar el enlace de registro de ${inv.email}`}
                          ><Copy size={13} /></button>
                          <button
                            className="ibtn"
                            style={{ width: 28, height: 28, color: 'var(--redd)' }}
                            data-tip="Cancelar invitación"
                            disabled={pending}
                            onClick={() => revoke(inv.id, inv.email)}
                            aria-label={`Cancelar la invitación de ${inv.email}`}
                          ><Trash2 size={13} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
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
