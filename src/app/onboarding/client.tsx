'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, Building2, Plus, MapPin, Mail, Users } from '@/lib/icons'
import Select from '@/components/ui/Select'
import Toggle from '@/components/ui/Toggle'
import { modulesByGroup } from '@/lib/modules'
import { CORE_MODULES, dependenciesOf, missingHardDependencies } from '@/lib/modules/registry'
import { presetFromCatalogue, type SectorCatalogue } from '@/lib/sectors'
import { planFor, planModules, type PlanKey } from '@/lib/plans'
import { createSite } from '@/server/mutations/sites'
import { inviteMember } from '@/server/mutations/settings'
import {
  finishCompanySetup, updateCompanyProfile, updateSector,
} from '@/server/mutations/onboarding'

/**
 * Setting up **one company**, in the order the answers depend on each other.
 *
 *   1. who you are — the name and the details a document needs
 *   2. what business this is — the sector
 *   3. which kind — the subsector, only when the sector has one
 *   4. what you will use — modules, proposed by 2 and 3, editable
 *   5. where you operate — branches, if there is more than one
 *   6. who else — invitations
 *
 * It used to open by asking for the name of the *account* — the group the
 * companies hang off — which is a concept the product had not introduced yet and
 * which almost every customer will only ever have one of. They answered a
 * question about an abstraction, then answered what felt like the same question
 * again on the next screen. The account is the subscription; it is named after
 * whoever pays for it and renamed from Facturación by the few who grow into
 * caring.
 *
 * Every step saves on its own. The company already exists and already works
 * (signup builds the first one, `createCompany` the rest), so every step here is
 * an improvement rather than a precondition — which is why "Saltar" is on every
 * screen and not buried. A wizard a customer cannot leave is one they abandon at
 * the browser tab.
 *
 * The last two steps write immediately rather than on Continuar, because each
 * one adds a *list*: a branch and an invitation are created one at a time, and
 * a "save" button over a list is ambiguous about which rows it applies to.
 */

const COUNTRIES = [
  { value: 'CO', label: 'Colombia' },
  { value: 'MX', label: 'México' },
  { value: 'AR', label: 'Argentina' },
  { value: 'CL', label: 'Chile' },
  { value: 'PE', label: 'Perú' },
  { value: 'EC', label: 'Ecuador' },
  { value: 'ES', label: 'España' },
  { value: 'US', label: 'Estados Unidos' },
]

const CURRENCIES = [
  { value: 'COP', label: 'COP — Peso colombiano' },
  { value: 'MXN', label: 'MXN — Peso mexicano' },
  { value: 'ARS', label: 'ARS — Peso argentino' },
  { value: 'CLP', label: 'CLP — Peso chileno' },
  { value: 'PEN', label: 'PEN — Sol' },
  { value: 'USD', label: 'USD — Dólar' },
  { value: 'EUR', label: 'EUR — Euro' },
]

/** Sensible pairing, so picking a country fills the currency it almost always uses. */
const CURRENCY_FOR: Record<string, string> = {
  CO: 'COP', MX: 'MXN', AR: 'ARS', CL: 'CLP', PE: 'PEN', EC: 'USD', ES: 'EUR', US: 'USD',
}
const TIMEZONE_FOR: Record<string, string> = {
  CO: 'America/Bogota', MX: 'America/Mexico_City', AR: 'America/Argentina/Buenos_Aires',
  CL: 'America/Santiago', PE: 'America/Lima', EC: 'America/Guayaquil',
  ES: 'Europe/Madrid', US: 'America/New_York',
}

/** The steps, as names rather than numbers. */
type StepId = 'empresa' | 'sector' | 'tipo' | 'modulos' | 'sucursales' | 'equipo'

const STEP_LABELS: Record<StepId, string> = {
  empresa: 'Empresa',
  sector: 'Sector',
  tipo: 'Tipo',
  modulos: 'Módulos',
  sucursales: 'Sucursales',
  equipo: 'Equipo',
}

interface Props {
  companyName: string
  sector: string | null
  catalogue: SectorCatalogue
  plan: PlanKey
  roles: Array<{ key: string; label: string }>
  sites: Array<{ id: string; name: string; city: string | null }>
}

export default function Client({
  companyName, sector, catalogue, plan, roles, sites,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const [profile, setProfile] = useState({
    name: companyName,
    legalName: '',
    taxId: '',
    country: 'CO',
    currency: 'COP',
    timezone: 'America/Bogota',
  })

  const [chosenSector, setChosenSector] = useState<string | null>(sector)
  const [chosenSub, setChosenSub] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(presetFromCatalogue(catalogue, sector)),
  )

  /** Branches created so far, seeded from the server and appended to as we go. */
  const [branches, setBranches] = useState(sites)
  const [branchForm, setBranchForm] = useState({ name: '', city: '' })

  /** Invitations sent from this screen. Not read back: the row is the invite. */
  const [invited, setInvited] = useState<Array<{ email: string; role: string }>>([])
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: roles.find((r) => r.label === 'Empleado')?.key ?? roles[roles.length - 1]?.key ?? '',
  })

  const allowed = useMemo(() => planModules(plan), [plan])
  const planDef = planFor(plan)
  const subsectors = chosenSector ? catalogue.subsectors[chosenSector] ?? [] : []

  /**
   * The step list, which changes shape with the answers.
   *
   * `tipo` only exists for a sector that has subsectors — asking "which kind"
   * with an empty dropdown is worse than not asking. Held as ids rather than
   * indices because the conditional step used to make every comparison in this
   * file an off-by-one waiting to happen.
   */
  const stepIds: StepId[] = [
    'empresa', 'sector',
    ...(subsectors.length > 0 ? (['tipo'] as StepId[]) : []),
    'modulos', 'sucursales', 'equipo',
  ]
  const current = stepIds[Math.min(step, stepIds.length - 1)]
  const isLast = step === stepIds.length - 1

  /** Picking a sector replaces the selection with its proposal. */
  function chooseSector(key: string) {
    const next = key === '' ? null : key
    setChosenSector(next)
    // The subsector goes with it: it belongs to exactly one sector, and the
    // database refuses the mismatched pair on save.
    setChosenSub(null)
    setSelected(new Set(presetFromCatalogue(catalogue, next)))
  }

  /**
   * Picking a kind of business re-proposes, it does not merely record.
   *
   * The subsector amends its parent's proposal — a bakery gains `produccion`, a
   * single practice loses the safety programme it will never run — so the
   * module step has to be re-derived rather than left as the parent set it. The
   * customer answered a second question; showing them the same answer is worse
   * than not having asked.
   *
   * Re-derived from the sector, not layered on the current selection: applying
   * a delta twice, or onto modules the customer had already toggled by hand,
   * produces a set nobody can explain.
   */
  function chooseSubsector(key: string) {
    const next = key === '' ? null : key
    setChosenSub(next)
    setSelected(new Set(presetFromCatalogue(catalogue, chosenSector, next)))
  }

  /**
   * Toggling a module carries its hard dependencies with it, in both
   * directions.
   *
   * Switching `tienda` on without `catalogos` would be saved and then silently
   * corrected by the server; switching `catalogos` off while `tienda` is on
   * would produce a storefront with nothing to sell. Doing it here means the
   * customer sees the consequence at the moment they cause it, rather than
   * discovering it on a screen two days later.
   */
  function toggle(key: string) {
    const next = new Set(selected)
    if (next.has(key)) {
      next.delete(key)
      // Anything that hard-depends on it goes too.
      for (const other of [...next]) {
        if (dependenciesOf(other, 'hard').includes(key)) next.delete(other)
      }
    } else {
      next.add(key)
      for (const required of missingHardDependencies([...next])) {
        if (allowed.has(required)) next.add(required)
      }
    }
    setSelected(next)
  }

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, after: () => void) {
    setError(null)
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) {
        setError(result.error)
        return
      }
      after()
    })
  }

  function done() {
    run(finishCompanySetup, () => {
      router.push('/dashboard')
      router.refresh()
    })
  }

  /** Saves the current step, if it has anything to save, then moves on. */
  function advance() {
    const next = () => setStep(step + 1)

    switch (current) {
      case 'empresa':
        run(
          () => updateCompanyProfile({
            name: profile.name,
            legalName: profile.legalName || null,
            taxId: profile.taxId || null,
            country: profile.country,
            currency: profile.currency,
            timezone: profile.timezone,
          }),
          next,
        )
        return
      case 'modulos':
        // The sector, the subsector and the modules are one decision and one
        // write — see updateSector.
        run(
          () => updateSector({
            sector: chosenSector,
            subsector: chosenSub,
            modules: [...selected].filter((k) => !CORE_MODULES.includes(k)),
          }),
          next,
        )
        return
      // "Configurar manualmente" means exactly that: the manual start set is
      // already applied, so the wizard has nothing left to propose — it goes
      // straight to a working dashboard and the rest is set up from
      // Configuración. Walking the remaining steps would be asking for answers
      // the customer already declined to give.
      case 'sector':
        if (chosenSector === null) {
          done()
          return
        }
        next()
        return
      case 'equipo':
        done()
        return
      // `sector`, `tipo` and `sucursales` hold nothing unsaved of their own:
      // the first two are folded into the module write, and a branch is created
      // the moment it is added.
      default:
        next()
    }
  }

  function addBranch() {
    if (!branchForm.name.trim()) return
    run(
      () => createSite({ name: branchForm.name, city: branchForm.city || null }),
      () => {
        // Optimistic in shape only: the row exists by the time this runs. The
        // id is a placeholder — nothing on this screen addresses a branch by
        // id, and refetching the list to learn one would be a round trip for a
        // value with no reader.
        setBranches([...branches, { id: `${Date.now()}`, name: branchForm.name.trim(), city: branchForm.city.trim() || null }])
        setBranchForm({ name: '', city: '' })
      },
    )
  }

  function addInvite() {
    if (!inviteForm.email.trim() || !inviteForm.role) return
    run(
      () => inviteMember({ email: inviteForm.email, role: inviteForm.role }),
      () => {
        setInvited([...invited, { email: inviteForm.email.trim().toLowerCase(), role: inviteForm.role }])
        setInviteForm({ ...inviteForm, email: '' })
      },
    )
  }

  return (
    <div className="onb">
      <div className="onb-card">
        <div className="onb-head">
          <Building2 size={18} />
          <div>
            <h1 className="onb-title">Configura {profile.name}</h1>
            <p className="onb-sub">
              {stepIds.length} pasos, todos opcionales. Cambia lo que quieras después en
              Configuración.
            </p>
          </div>
        </div>

        <ol className="onb-steps">
          {stepIds.map((id, i) => (
            <li key={id} className={i === step ? 'on' : i < step ? 'done' : ''}>
              <span className="onb-dot">{i < step ? <Check size={12} /> : i + 1}</span>
              {STEP_LABELS[id]}
            </li>
          ))}
        </ol>

        {error && <p className="onb-error" role="alert">{error}</p>}

        {current === 'empresa' && (
          <div className="onb-body">
            <label className="flabel" htmlFor="onb-name">Nombre comercial</label>
            <input
              id="onb-name" className="field" value={profile.name} maxLength={120}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />

            <label className="flabel" htmlFor="onb-legal">Razón social</label>
            <input
              id="onb-legal" className="field" value={profile.legalName} maxLength={200}
              placeholder="Opcional — si difiere del nombre comercial"
              onChange={(e) => setProfile({ ...profile, legalName: e.target.value })}
            />

            <label className="flabel" htmlFor="onb-tax">NIT / identificación fiscal</label>
            <input
              id="onb-tax" className="field" value={profile.taxId} maxLength={40}
              placeholder="Opcional — aparece en facturas y contratos"
              onChange={(e) => setProfile({ ...profile, taxId: e.target.value })}
            />

            <label className="flabel" htmlFor="onb-country">País</label>
            <Select
              value={profile.country}
              onChange={(v) => setProfile({
                ...profile,
                country: v,
                // Filled in, not forced: both stay editable below.
                currency: CURRENCY_FOR[v] ?? profile.currency,
                timezone: TIMEZONE_FOR[v] ?? profile.timezone,
              })}
              options={COUNTRIES}
            />

            <label className="flabel" htmlFor="onb-currency">Moneda</label>
            <Select
              value={profile.currency}
              onChange={(v) => setProfile({ ...profile, currency: v })}
              options={CURRENCIES}
            />
          </div>
        )}

        {current === 'sector' && (
          <div className="onb-body">
            <label className="flabel" htmlFor="onb-sector">¿A qué se dedica?</label>
            <Select
              value={chosenSector ?? ''}
              onChange={chooseSector}
              options={[
                { value: '', label: 'Configurar manualmente' },
                ...catalogue.sectors.map((s) => ({ value: s.key, label: s.label })),
              ]}
            />
            {/* Said before the choice and not after: the sector proposes
                modules, which is reversible, but it also decides which vertical
                this company runs on — and that stops being reversible the moment
                the company has records in it. Somebody who finds that out later
                has to delete the company and start again. */}
            <p className="onb-note">
              {chosenSector
                ? 'El sector propone qué módulos activar; los cambias uno a uno cuando quieras. ' +
                  'El sector en sí queda fijo en cuanto la empresa tenga datos propios de ese sector: ' +
                  'para operar otro, se crea otra empresa.'
                : 'Empezarás con lo esencial y activarás el resto a mano. Podrás elegir sector después.'}
            </p>
          </div>
        )}

        {current === 'tipo' && (
          <div className="onb-body">
            <label className="flabel" htmlFor="onb-sub">¿De qué tipo?</label>
            <Select
              value={chosenSub ?? ''}
              onChange={chooseSubsector}
              options={[
                { value: '', label: 'Prefiero no precisar' },
                ...subsectors.map((s) => ({ value: s.key, label: s.label })),
              ]}
            />
            <p className="onb-note">
              Afina la sugerencia. Una panadería y un bar son el mismo sector y no usan
              lo mismo.
            </p>
          </div>
        )}

        {current === 'modulos' && (
          <div className="onb-body">
            <p className="onb-note" style={{ marginTop: 0 }}>
              {selected.size} módulos activos. Plan {planDef.label}.
            </p>
            {modulesByGroup().map(({ group, modules }) => {
              const usable = modules.filter((m) => allowed.has(m.key))
              if (usable.length === 0) return null
              return (
                <div key={group} className="onb-group">
                  <div className="onb-group-label">{group}</div>
                  {usable.map((m) => {
                    // Held on by something else that is on. Shown as locked
                    // rather than silently re-ticked, so the reason is visible.
                    const heldBy = [...selected].filter((k) =>
                      dependenciesOf(k, 'hard').includes(m.key),
                    )
                    return (
                      <div key={m.key} className="onb-module">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="onb-module-name">{m.label}</div>
                          <div className="onb-module-desc">
                            {heldBy.length > 0
                              ? `Necesario para ${heldBy.map((k) => modules.find((x) => x.key === k)?.label ?? k).join(', ')}.`
                              : m.description}
                          </div>
                        </div>
                        <Toggle
                          on={selected.has(m.key)}
                          onChange={() => toggle(m.key)}
                          ariaLabel={`${m.label}: ${selected.has(m.key) ? 'activo' : 'inactivo'}`}
                        />
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}

        {current === 'sucursales' && (
          <div className="onb-body">
            <p className="onb-note" style={{ marginTop: 0 }}>
              {planDef.maxSitesPerCompany === null
                ? 'Agrega las sedes, locales o puntos donde opera esta empresa.'
                : `Tu plan ${planDef.label} permite ${planDef.maxSitesPerCompany} ` +
                  `${planDef.maxSitesPerCompany === 1 ? 'sucursal' : 'sucursales'} por empresa.`}
              {' '}Puedes dejarlo para después: una empresa sin sucursales funciona igual.
            </p>

            {branches.map((b) => (
              <div key={b.id} className="onb-module">
                <MapPin size={15} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="onb-module-name">{b.name}</div>
                  <div className="onb-module-desc">{b.city ?? 'Sin ciudad'}</div>
                </div>
              </div>
            ))}

            <label className="flabel" htmlFor="onb-branch">Nombre de la sucursal</label>
            <input
              id="onb-branch" className="field" value={branchForm.name} maxLength={120}
              placeholder="Sede norte"
              onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
            />

            <label className="flabel" htmlFor="onb-branch-city">Ciudad</label>
            <input
              id="onb-branch-city" className="field" value={branchForm.city} maxLength={80}
              placeholder="Opcional"
              onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
            />

            <button
              className="btn"
              style={{ marginTop: 10 }}
              disabled={pending || !branchForm.name.trim()}
              onClick={addBranch}
            >
              <Plus size={15} />Agregar sucursal
            </button>
          </div>
        )}

        {current === 'equipo' && (
          <div className="onb-body">
            <p className="onb-note" style={{ marginTop: 0 }}>
              {planDef.seats === null
                ? 'Invita a quien trabajará contigo. El rol decide qué módulos verá.'
                : `Tu plan ${planDef.label} incluye ${planDef.seats} personas. ` +
                  'El rol decide qué módulos verá cada una.'}
            </p>

            {invited.map((i) => (
              <div key={i.email} className="onb-module">
                <Users size={15} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="onb-module-name">{i.email}</div>
                  <div className="onb-module-desc">
                    {roles.find((r) => r.key === i.role)?.label ?? i.role} · invitación pendiente
                  </div>
                </div>
              </div>
            ))}

            <label className="flabel" htmlFor="onb-invite">Correo</label>
            <input
              id="onb-invite" className="field" type="email" value={inviteForm.email} maxLength={160}
              placeholder="persona@empresa.com"
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
            />

            <label className="flabel" htmlFor="onb-invite-role">Rol</label>
            <Select
              value={inviteForm.role}
              onChange={(v) => setInviteForm({ ...inviteForm, role: v })}
              options={roles.map((r) => ({ value: r.key, label: r.label }))}
            />

            <button
              className="btn"
              style={{ marginTop: 10 }}
              disabled={pending || !inviteForm.email.trim()}
              onClick={addInvite}
            >
              <Mail size={15} />Invitar
            </button>
          </div>
        )}

        <div className="onb-foot">
          <button className="btn" onClick={done} disabled={pending}>
            Saltar por ahora
          </button>
          <div style={{ flex: 1 }} />
          {step > 0 && (
            <button className="btn" onClick={() => setStep(step - 1)} disabled={pending}>
              Atrás
            </button>
          )}
          <button className="btn dark" disabled={pending} onClick={advance}>
            {isLast
              ? <><Check size={15} />Terminar</>
              : <>Continuar<ArrowRight size={15} /></>}
          </button>
        </div>
      </div>
    </div>
  )
}
