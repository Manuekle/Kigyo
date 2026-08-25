'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Check, Building2, Plus, MapPin, Mail, Users } from '@/lib/icons'
import Select from '@/components/ui/Select'
import Toggle from '@/components/ui/Toggle'
import TabBar from '@/components/ui/TabBar'
import Badge from '@/components/ui/Badge'
import { modulesByGroup, moduleDef } from '@/lib/modules'
import { CORE_MODULES, dependenciesOf, missingHardDependencies } from '@/lib/modules/registry'
import { proposalForPlan, type SectorCatalogue } from '@/lib/sectors'
import { isSelfServePlan, lowestPlanWith, PLANS, planFor, planModules, type PlanKey } from '@/lib/plans'
import { CYCLES, PRICING, type Cycle } from '@/lib/pricing'
import { createSite } from '@/server/mutations/sites'
import { inviteMember } from '@/server/mutations/settings'
import { startPolarCheckout } from '@/server/mutations/billing'
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

/**
 * La moneda ya no se elige, y conviene decir por qué antes de que alguien la
 * eche de menos.
 *
 * Aquí había siete monedas. Se guardaban en `organizations.currency` y no las
 * leía nadie: `cop()` en lib/utils.ts está fijo en COP, así que una empresa que
 * elegía MXN veía pesos colombianos en las 41 pantallas que muestran dinero.
 * Un ajuste ofrecido que no hace nada es peor que no ofrecerlo — el cliente
 * cree haber configurado algo.
 *
 * Se midió lo que costaba cablearlo de verdad, porque era la otra salida: 111
 * llamadas en 41 archivos, de las cuales 30 usan `cop` desde helpers de módulo
 * o desde subcomponentes (`pos`, `restaurante`, `pacientes` y `flota` tienen
 * siete u ocho cada uno), así que no basta un hook: hay que enhebrar el
 * formateador por toda la pantalla.
 *
 * Y el beneficio de pagarlo sería un símbolo correcto para un mercado que el
 * producto todavía no puede servir: 67 archivos fijan el locale `es-CO`, la
 * nómina sigue el Código Sustantivo del Trabajo, DIAN y PILA son colombianas,
 * `tax_id` se rotula NIT y las tasas de IVA de la migración 104 son las de
 * Colombia. Arreglar el símbolo dejaría el producto *pareciendo* portable y
 * siendo colombiano, que es la misma clase de promesa falsa que el FAQ.
 *
 * La columna se queda —guardando COP— para el día en que internacionalizar sea
 * una decisión de verdad. Entonces el selector vuelve, con el cableado.
 *
 * El país SÍ se sigue preguntando: de él sale `timezone`, y eso funciona desde
 * que se corrigió el corte de día por UTC.
 */
const DEFAULT_CURRENCY = 'COP'
const TIMEZONE_FOR: Record<string, string> = {
  CO: 'America/Bogota', MX: 'America/Mexico_City', AR: 'America/Argentina/Buenos_Aires',
  CL: 'America/Santiago', PE: 'America/Lima', EC: 'America/Guayaquil',
  ES: 'Europe/Madrid', US: 'America/New_York',
}

/**
 * The steps, as names rather than numbers.
 *
 * `plan` is last because the subscription belongs to the account, not the
 * company — the wizard configures one company, and asking for payment before
 * the customer has seen what that company will look like is a wall where there
 * should be a door. The module step already named what the current plan leaves
 * out; this step is where that decision is offered again, with the work done
 * and the gap visible. "Saltar" keeps working: a customer who declines pays
 * nothing and lands on Starter.
 */
type StepId = 'empresa' | 'sector' | 'tipo' | 'modulos' | 'sucursales' | 'equipo' | 'plan'

const STEP_LABELS: Record<StepId, string> = {
  empresa: 'Empresa',
  sector: 'Sector',
  tipo: 'Tipo',
  modulos: 'Módulos',
  sucursales: 'Sucursales',
  equipo: 'Equipo',
  plan: 'Plan',
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
  const [cycle, setCycle] = useState<Cycle>('mensual')

  const [profile, setProfile] = useState({
    name: companyName,
    legalName: '',
    taxId: '',
    country: 'CO',
    currency: DEFAULT_CURRENCY,
    timezone: 'America/Bogota',
  })

  const allowed = useMemo(() => planModules(plan), [plan])
  const planDef = planFor(plan)

  /**
   * The sector's proposal, cut down to what the subscription actually covers.
   *
   * A preset is a list of modules for the *business*, not for the plan: every
   * one of the twenty-three sectors proposes modules that Starter does not
   * carry, and eight of them propose modules only Enterprise carries. Seeding
   * the selection with the raw preset therefore produced a set the server
   * refuses — `updateSector` rejects any key outside the plan and saves
   * nothing — so «Continuar» on the module step failed for every Starter
   * customer, on every sector, with an error naming modules that were not even
   * on screen (the toggle list is filtered by the same plan). The wizard had no
   * way forward but «Saltar por ahora».
   *
   * Filtering here instead makes the proposal and the submission the same set.
   * What the plan leaves out is not silently dropped: `lockedBy` names it under
   * the module list, which is the honest version of the same fact.
   */
  const proposeFor = useCallback(
    (sectorKey: string | null, subKey: string | null = null) =>
      new Set(proposalForPlan(catalogue, allowed, sectorKey, subKey).included),
    [catalogue, allowed],
  )

  const [chosenSector, setChosenSector] = useState<string | null>(sector)
  const [chosenSub, setChosenSub] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(proposalForPlan(catalogue, planModules(plan), sector).included),
  )

  /** What this sector proposes that the plan does not reach, for the note below. */
  const lockedByPlan = useMemo(
    () =>
      proposalForPlan(catalogue, allowed, chosenSector, chosenSub).locked
        .filter((k) => !CORE_MODULES.includes(k))
        .map((k) => moduleDef(k))
        .filter((m): m is NonNullable<typeof m> => m !== null),
    [catalogue, chosenSector, chosenSub, allowed],
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
    'modulos', 'sucursales', 'equipo', 'plan',
  ]
  const current = stepIds[Math.min(step, stepIds.length - 1)]
  // `isLast` se fue con el botón «Terminar»: el último paso ya no termina en un
  // botón del pie, termina en un pago. `current === 'plan'` dice lo mismo y lo
  // dice por su nombre.

  /** Picking a sector replaces the selection with its proposal. */
  function chooseSector(key: string) {
    const next = key === '' ? null : key
    setChosenSector(next)
    // The subsector goes with it: it belongs to exactly one sector, and the
    // database refuses the mismatched pair on save.
    setChosenSub(null)
    setSelected(proposeFor(next))
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
    setSelected(proposeFor(chosenSector, next))
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

  /**
   * Hands the browser to Polar, then stamps the company setup done.
   *
   * `finishCompanySetup` runs *before* the redirect because the checkout is
   * external — once the browser leaves for `checkout.polar.sh`, this page is
   * gone. The customer comes back on `successUrl` pointing to `/dashboard`, and
   * the redirect from the dashboard layout to the wizard only fires when
   * setup is unfinished. If we stamped after the redirect we would never get
   * the chance: the webhook from Polar activates the plan, but it does not
   * stamp the company.
   *
   * The checkout URL is opened with `window.location.href` rather than
   * `router.push` because it is an external host — same reason the plan
   * switcher in `/dashboard/empresas` does it that way.
   *
   * ─── Por qué recibe el plan ──────────────────────────────────────────────
   *
   * It used to be `upgradeToGrowth()`, with `plan: 'growth'` written into the
   * call. The card it hung off was whichever tier was not the account's
   * current one, so on an account already on Growth the Starter card offered
   * "Subir a Starter" and charged for Growth. Nobody had hit it because a new
   * account is always Starter, and the second company an account configures is
   * exactly the case that is not.
   */
  function checkoutTier(tier: PlanKey) {
    if (!isSelfServePlan(tier)) return
    setError(null)
    startTransition(async () => {
      const finished = await finishCompanySetup()
      if (!finished.ok) {
        setError(finished.error)
        return
      }
      const result = await startPolarCheckout({
        plan: tier,
        interval: cycle === 'anual' ? 'yearly' : 'monthly',
        returnTo: '/dashboard',
      })
      if (!result.ok) {
        // Setup is already stamped, so the wizard will not take them back.
        // The dashboard bounces an unpaid account to `/suscripcion`, which is
        // the same choice as this step with none of the wizard around it —
        // the right place to land when the checkout could not be opened.
        setError(result.error)
        return
      }
      window.location.href = result.url
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
        next()
        return
      case 'plan':
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
              id="onb-country"
              value={profile.country}
              onChange={(v) => setProfile({
                ...profile,
                country: v,
                // De aquí sale la zona horaria, que es lo que decide qué día es
                // «hoy» para esta empresa. Rellenada, no forzada.
                timezone: TIMEZONE_FOR[v] ?? profile.timezone,
              })}
              options={COUNTRIES}
            />
            {/* Dicho aquí y no en la letra pequeña de la web: quien está
                configurando la empresa es quien puede darse cuenta ahora, y no
                dentro de un mes al abrir Nómina. */}
            {profile.country !== 'CO' && (
              <p className="onb-note onb-locked">
                Kigyo está hecho para Colombia: la nómina sigue el Código Sustantivo
                del Trabajo, la facturación electrónica es la de la DIAN y los
                importes van en pesos colombianos. Fuera de Colombia puedes usar
                clientes, inventario, proyectos y documentos, pero esos tres módulos
                no te van a servir.
              </p>
            )}

          </div>
        )}

        {current === 'sector' && (
          <div className="onb-body">
            <label className="flabel" htmlFor="onb-sector">¿A qué se dedica?</label>
            <Select
          id="onb-sector"
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
          id="onb-sub"
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
            {/*
              What the sector proposes and the plan does not carry.

              Named here rather than left to be discovered: for most sectors
              this list contains the module the sector is *about* — a clinic on
              Starter has no «Pacientes» — and a module missing from the sidebar
              with no explanation reads as the product being broken rather than
              as a plan that can be changed. Same rule the empty dashboard
              states in `PrimerosPasos`; said at the moment the sector is
              chosen, which is when it is still a decision.
            */}
            {lockedByPlan.length > 0 && (
              <p className="onb-note onb-locked">
                Tu plan {planDef.label} no incluye{' '}
                <b>{lockedByPlan.slice(0, 3).map((m) => m.label).join(', ')}</b>
                {lockedByPlan.length > 3 && ` y ${lockedByPlan.length - 3} módulo${lockedByPlan.length - 3 === 1 ? '' : 's'} más`}
                {(() => {
                  const need = lowestPlanWith(lockedByPlan[0].key)
                  return need ? `. Se activan desde el plan ${need.label}.` : '.'
                })()}{' '}
                Puedes terminar la configuración igual y cambiar de plan después.
              </p>
            )}
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
          id="onb-invite-role"
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

        {current === 'plan' && (
          <div className="onb-body">
            <p className="onb-note" style={{ marginTop: 0 }}>
              Configuraste tu empresa. Elige el plan con el que va a funcionar.
              {lockedByPlan.length > 0 && (
                <>
                  {' '}
                  {lockedByPlan.length} módulo{lockedByPlan.length === 1 ? '' : 's'} de tu sector
                  {lockedByPlan.length === 1 ? ' queda' : ' quedan'} fuera de {planDef.label}.
                </>
              )}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
              <TabBar items={CYCLES} value={cycle} onChange={(key) => setCycle(key as Cycle)} />
              {cycle === 'anual' && <span className="muted" style={{ fontSize: 12 }}>2 meses gratis</span>}
            </div>

            {PLANS.map((tier) => {
              const pricing = PRICING[tier.key]
              const isCurrent = tier.key === plan
              const price = cycle === 'anual' ? pricing.priceAnnual : pricing.priceMonthly
              const lockedCount = tier.key === 'growth'
                ? lockedByPlan.length
                : 0
              return (
                <div
                  key={tier.key}
                  className="card"
                  style={{
                    padding: 14, marginBottom: 10, display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 14.5 }}>{tier.label}</strong>
                      {isCurrent && <Badge st="Preseleccionado" tone="blu" />}
                      {pricing.featured && !isCurrent && <Badge st="Recomendado" tone="vio" />}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{tier.description}</div>
                    {lockedCount > 0 && (
                      <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
                        Activa tus {lockedCount} módulo{lockedCount === 1 ? '' : 's'} de {lockedByPlan[0]?.label ?? 'sector'}
                        {lockedByPlan.length > 1 && ` y ${lockedByPlan.length - 1} más`}
                      </div>
                    )}
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {price}
                      <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>
                        {cycle === 'anual' ? '/año' : '/mes'}
                      </span>
                    </div>
                    {/*
                      Every self-serve tier gets a checkout, including the one
                      the account already carries. That card used to say
                      "Continuar con Starter" and simply finish the wizard —
                      which is how a plan billed at $80.000/month was handed
                      out free to everybody who signed up. The tier on the
                      account is a default, not a purchase.
                    */}
                    {isSelfServePlan(tier.key) ? (
                      <button
                        className={isCurrent ? 'btn dark' : 'btn'}
                        style={{ marginTop: 6 }}
                        disabled={pending}
                        aria-busy={pending}
                        onClick={() => checkoutTier(tier.key)}
                      >
                        <ArrowRight size={14} />Pagar {tier.label}
                      </button>
                    ) : (
                      <Link href={pricing.href} className="btn" style={{ marginTop: 6 }}>
                        Contactar ventas
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/*
          El pie cambia en el último paso, y es el cambio que convierte el
          asistente en un embudo de venta.

          «Saltar por ahora» y «Terminar» existían también en el paso de plan, y
          los dos hacían lo mismo: `done()`, que estampa la configuración y
          manda al panel. Con eso, la pantalla que enseña tres precios tenía dos
          botones para no pagar ninguno — y era el camino que tomaba todo el
          mundo, porque era el único que no salía de la aplicación.

          En los pasos anteriores «Saltar» se queda: son preguntas de
          configuración, todas opcionales, y obligar a contestarlas antes de
          enseñar el producto es la clase de muro que este asistente evita a
          propósito. El plan no es una de esas preguntas.
        */}
        <div className="onb-foot">
          {current !== 'plan' && (
            <button className="btn" onClick={done} disabled={pending}>
              Saltar por ahora
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step > 0 && (
            <button className="btn" onClick={() => setStep(step - 1)} disabled={pending}>
              Atrás
            </button>
          )}
          {current !== 'plan' && (
            <button className="btn dark" disabled={pending} onClick={advance}>
              Continuar<ArrowRight size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
