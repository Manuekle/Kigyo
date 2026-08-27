'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireMember, requirePermission } from '@/lib/auth/session'
import { isModuleKey, MODULE_KEYS, moduleDef } from '@/lib/modules'
import { missingHardDependencies } from '@/lib/modules/registry'
import { lowestPlanWith, planAllows } from '@/lib/plans'
import { getRoles } from '@/server/queries/roles'

/**
 * The setup wizard's writes.
 *
 * Each step saves on its own, so the customer can leave and come back without
 * losing what they answered. That is why these are several small functions
 * rather than one submit: an onboarding that only persists at the end is an
 * onboarding people restart.
 *
 * Every one of them re-checks authorization. A Server Function is a public HTTP
 * endpoint, and "only the wizard calls it" is not a control.
 */

export type StepResult = { ok: true } | { ok: false; error: string }

/** A role as an invitation picker needs it: what to submit and what to show. */
export type RoleOption = { key: string; label: string }

/**
 * What saving the sector answers with.
 *
 * Wider than `StepResult` because this step changes what a *later* step can
 * offer. Picking «Salud → Consultorio» seeds «Médico/a», «Enfermero/a» and
 * «Recepcionista» into the organization, and the invitation picker two steps
 * on has to know about them — it was handed its list before the sector was
 * even asked, so it offered the three seeded generics to everybody.
 */
export type SectorResult = { ok: true; roles: RoleOption[] } | { ok: false; error: string }

/**
 * The account is no longer a step.
 *
 * `updateAccountName` used to open the wizard, asking the customer to name "the
 * group your companies hang off" before they had told us about even one
 * company. Almost nobody has two, so almost everybody answered a question about
 * a concept the product had not introduced yet — and then answered it again,
 * differently, on the very next screen when it asked for the company's name.
 *
 * The account is the subscription. It is named after the person who pays for it
 * at signup and renamed from Configuración → Facturación by the handful of
 * customers who grow into caring. Setting up a *company* is what this wizard is
 * for, which is also why finishing it now stamps the company and not the group.
 */

/* ─── Company identity and tax details ───────────────────────────────────── */

const profileSchema = z.object({
  name: z.string().trim().min(1, 'La empresa necesita un nombre.').max(120),
  legalName: z.string().trim().max(200).nullish(),
  taxId: z.string().trim().max(40).nullish(),
  // ISO-3166 alpha-2 and ISO-4217, matching the database's check constraints.
  country: z.string().trim().regex(/^[A-Z]{2}$/, 'País inválido.'),
  currency: z.string().trim().regex(/^[A-Z]{3}$/, 'Moneda inválida.'),
  timezone: z.string().trim().min(1).max(60),
})

/**
 * The details a document needs.
 *
 * Empty strings are stored as null rather than as `''`: "we did not ask yet"
 * and "they told us it is blank" are different facts, and an invoice template
 * that prints an empty tax id is a bug the data should not be able to describe.
 */
export async function updateCompanyProfile(
  input: z.input<typeof profileSchema>,
): Promise<StepResult> {
  try {
    const member = await requirePermission('configuracion:manage')
    const parsed = profileSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('organizations')
      .update({
        name: parsed.data.name,
        legal_name: parsed.data.legalName?.trim() || null,
        tax_id: parsed.data.taxId?.trim() || null,
        country: parsed.data.country,
        currency: parsed.data.currency,
        timezone: parsed.data.timezone,
      })
      .eq('id', member.orgId)

    if (error) {
      console.error('[onboarding] updateCompanyProfile', error)
      return { ok: false, error: 'No se pudieron guardar los datos de la empresa.' }
    }

    revalidatePath('/dashboard', 'layout')
    return { ok: true }
  } catch {
    return { ok: false, error: 'No tienes permiso para esta acción.' }
  }
}

/* ─── Sector, subsector and the modules they propose ─────────────────────── */

const sectorSchema = z.object({
  /** Null means "configurar manualmente", which is a decision, not an absence. */
  sector: z.string().trim().min(1).max(40).nullable(),
  subsector: z.string().trim().min(1).max(40).nullish(),
  modules: z
    .array(z.string().refine(isModuleKey, 'Módulo desconocido.'))
    .max(MODULE_KEYS.length, 'Selección inválida.'),
})

/**
 * Saves the sector, the subsector and the module selection together.
 *
 * One write because they are one decision: the sector proposes, the customer
 * amends, and storing the amended list is what makes the proposal a starting
 * point rather than a lock. Saving the sector alone would let a later change to
 * the presets silently rewrite a hand-picked selection.
 *
 * The subsector is validated by the database — a trigger refuses one that does
 * not belong to the chosen sector — because two nullable foreign keys to the
 * same table cannot express that between themselves.
 */
export async function updateSector(
  input: z.input<typeof sectorSchema>,
): Promise<SectorResult> {
  try {
    const member = await requirePermission('configuracion:manage')
    const parsed = sectorSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    }

    const modules = [...new Set(parsed.data.modules)]

    const locked = modules.filter((key) => !planAllows(member.plan, key))
    if (locked.length > 0) {
      const labels = locked.map((key) => moduleDef(key)?.label ?? key)
      const required = lowestPlanWith(locked[0])
      return {
        ok: false,
        error:
          `Tu plan no incluye ${labels.join(', ')}.` +
          (required ? ` Está disponible desde el plan ${required.label}.` : ''),
      }
    }

    if (modules.length === 0) {
      return {
        ok: false,
        error: 'Deja al menos un módulo activo. Configuración y Dashboard siempre están disponibles.',
      }
    }

    // Hard dependencies are folded in, exactly as `updateModules` does. Two
    // screens writing the same column must agree about what a valid selection
    // is, or the wizard produces one Configuración would have corrected.
    const implied = missingHardDependencies(modules).filter((key) =>
      planAllows(member.plan, key),
    )
    modules.push(...implied)

    const supabase = await createClient()

    /**
     * Modules outside the plan are carried over rather than dropped.
     *
     * The same rule `updateModules` follows, for the same reason: the list this
     * screen submits was already filtered by the plan, so saving it verbatim
     * would erase anything the subscription no longer covers — and a plan that
     * rises again must find the configuration exactly as it was. The wizard
     * usually runs on a fresh company where the column is empty and this is a
     * no-op; the case it covers is somebody who never finished setup and comes
     * back after a downgrade.
     */
    const { data: orgRow } = await supabase
      .from('organizations')
      .select('enabled_modules')
      .eq('id', member.orgId)
      .single()
    modules.push(
      ...(orgRow?.enabled_modules ?? []).filter((key) => !planAllows(member.plan, key)),
    )

    const { error } = await supabase
      .from('organizations')
      .update({
        company_type: parsed.data.sector,
        // Clearing the sector must clear the subsector with it: the database
        // trigger refuses a subsector without a parent, and leaving a stale one
        // would make the next save fail for a reason the screen cannot explain.
        subsector: parsed.data.sector ? parsed.data.subsector?.trim() || null : null,
        enabled_modules: modules,
      })
      .eq('id', member.orgId)

    if (error) {
      console.error('[onboarding] updateSector', error)
      // The lock's own message is written for a person and names the way out,
      // so it is passed through rather than replaced. See migration 41: the
      // sector is free to change until the company has data in the vertical it
      // named, and refused afterwards.
      if (error.message.includes('ya tiene datos del sector')) {
        return { ok: false, error: error.message }
      }
      return {
        ok: false,
        error: error.message.includes('subsector')
          ? 'Ese subsector no pertenece al sector elegido.'
          : 'No se pudo guardar el sector.',
      }
    }

    /**
     * The sector's own roles, seeded the moment the sector is known.
     *
     * The catalogue has existed since migration 46 — 94 sets of roles by sector
     * and subsector, with hand-tuned permissions — and the only door to it was
     * a button in Configuración → Roles y permisos. So the wizard's own
     * «Equipo» step invited people into the three generics: a clinic's
     * receptionist arrived as «Empleado», with no `pacientes`, no `caja` and no
     * `facturacion`, and the sector's answer was never offered.
     *
     * After the write, not before: `app.seed_default_roles` reads
     * `coalesce(subsector, company_type)` off the organization itself. It is
     * idempotent (`on conflict do nothing` on both roles and grants), so
     * changing sector adds the new sector's roles without touching what is
     * already there — which is the safe direction, since deleting a role would
     * leave whoever held it without one. Configuración can remove them.
     *
     * A failure here does not fail the step. The sector is saved, the wizard
     * moves on, and the button in Configuración is still there.
     */
    const { error: seedError } = await supabase.rpc('seed_suggested_roles', {
      p_org_id: member.orgId,
    })
    if (seedError) console.error('[onboarding] seed_suggested_roles', seedError)

    revalidatePath('/dashboard', 'layout')
    const roles = await getRoles(member.orgId)
    return { ok: true, roles: roles.map((r) => ({ key: r.key, label: r.label })) }
  } catch {
    return { ok: false, error: 'No tienes permiso para esta acción.' }
  }
}

/* ─── Branding ───────────────────────────────────────────────────────────── */

const brandingSchema = z.object({
  accent: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Usa un color en formato #RRGGBB.')
    .nullish(),
  logoUrl: z.url('El logo debe ser una URL https.').startsWith('https://').max(500).nullish(),
})

/**
 * Per-company branding.
 *
 * The accent is interpolated into a CSS custom property, so the hex shape is
 * enforced here *and* by a check constraint. An unvalidated value in that
 * position is a style injection rather than a cosmetic problem, and a rule that
 * only the application enforces is a rule the next writer can skip.
 */
export async function updateBranding(
  input: z.input<typeof brandingSchema>,
): Promise<StepResult> {
  try {
    const member = await requirePermission('configuracion:manage')
    const parsed = brandingSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    }

    // Absent keys rather than null values: the constraint accepts only the two
    // it knows, and `{"accent": null}` is a key that means nothing.
    const branding: Record<string, string> = {}
    if (parsed.data.accent) branding.accent = parsed.data.accent
    if (parsed.data.logoUrl) branding.logo_url = parsed.data.logoUrl

    const supabase = await createClient()
    const { error } = await supabase
      .from('organizations')
      .update({ branding })
      .eq('id', member.orgId)

    if (error) {
      console.error('[onboarding] updateBranding', error)
      return { ok: false, error: 'No se pudo guardar la marca.' }
    }

    revalidatePath('/dashboard', 'layout')
    return { ok: true }
  } catch {
    return { ok: false, error: 'No tienes permiso para esta acción.' }
  }
}

/* ─── Finishing ──────────────────────────────────────────────────────────── */

/**
 * Marks *this company's* setup done, which is what stops the dashboard
 * redirecting here.
 *
 * Stamped on the company rather than on the account, and that is the whole
 * change. While the flag lived on `accounts`, the second company an account
 * created was never configured at all: the account had been stamped when the
 * first one was set up, so nobody was ever asked what the new business does,
 * which modules it needs or who works there. It simply inherited whatever the
 * first company had answered.
 *
 * Reachable at any step: skipping is allowed, because the company the signup
 * trigger built already works and a wizard nobody can leave is a trap. A
 * customer who skips gets a usable company with a sector they can set later.
 */
export async function finishCompanySetup(): Promise<StepResult> {
  try {
    const member = await requireMember()
    const supabase = await createClient()

    const { error } = await supabase.rpc('complete_company_setup', { p_org_id: member.orgId })

    if (error) {
      console.error('[onboarding] finishCompanySetup', error)
      return { ok: false, error: 'No se pudo terminar la configuración.' }
    }

    revalidatePath('/dashboard', 'layout')
    return { ok: true }
  } catch {
    return { ok: false, error: 'Inicia sesión para continuar.' }
  }
}
