'use server'

import { createHash, randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission, requireMember } from '@/lib/auth/session'
import { isPermission, type Permission, type RoleKey } from '@/lib/auth/permissions'
import { isCompanyType, isModuleKey, moduleDef, MODULE_KEYS } from '@/lib/modules'
import { dependenciesOf, missingHardDependencies } from '@/lib/modules/registry'
import { lowestPlanWith, planAllows, planFor, seatsAvailable } from '@/lib/plans'
import { passwordSchema } from '@/lib/validation/auth'

/**
 * Server Functions for the configuración screen.
 *
 * Every one of these re-checks the caller's permission. A Server Function is a
 * public HTTP endpoint — being reachable only from a component the UI hides is
 * not a control.
 */

export type ActionResult = { ok: true } | { ok: false; error: string }

/**
 * The shape a role key has to have. Not *which* keys exist — that is a
 * database question now, answered by `assertRole` below.
 */
const roleKeySchema = z.string().trim().min(2, 'El nombre es muy corto.').max(40)

/**
 * Whether the organization actually defines this role.
 *
 * Since migration 24 there is no list of valid roles to compare against: they
 * are rows the customer creates. Validating against the tenant's own table is
 * both the only correct check and a tenant-boundary one — it cannot confirm a
 * role belonging to somebody else's organization, because RLS scopes the read
 * before the comparison happens.
 */
async function orgHasRole(orgId: string, role: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('roles')
    .select('key')
    .eq('org_id', orgId)
    .eq('key', role)
    .maybeSingle()
  return data !== null
}

/**
 * Turns the database's lockout guard into a sentence.
 *
 * Two DEFERRABLE constraint triggers (migration 24) abort any transaction that
 * leaves nobody holding `configuracion:manage`. The check lives there rather
 * than here on purpose — it has to hold for every path into the data, not just
 * the ones this file owns — but the raw exception is not a message for a
 * person, so every caller that can trip it translates it.
 */
function isLockoutError(message: string): boolean {
  return message.includes('al menos una persona que pueda administrarla')
}

const LOCKOUT_MESSAGE =
  'Al menos una persona debe conservar el permiso de administrar la organización. ' +
  'Asigna ese permiso a otro rol o a otra persona antes de quitarlo aquí.'

export async function setRolePermission(
  role: RoleKey,
  permission: Permission,
  granted: boolean,
): Promise<ActionResult> {
  try {
    const member = await requirePermission('configuracion:manage')

    if (!roleKeySchema.safeParse(role).success || !isPermission(permission)) {
      return { ok: false, error: 'Rol o permiso desconocido.' }
    }
    if (!(await orgHasRole(member.orgId, role))) {
      return { ok: false, error: 'Ese rol no existe en la organización.' }
    }

    // The "you cannot leave the account without an administrator" rule used to
    // be a name check here — `role === 'Administrador'`. With custom roles the
    // name means nothing: an organization may administer through «Dirección»,
    // or through three roles at once. The database counts the people who
    // actually hold the permission and refuses at COMMIT, which is the only
    // form of the rule that survives the customer renaming things.

    const supabase = await createClient()

    const { error } = granted
      ? await supabase
          .from('role_permissions')
          .upsert(
            { org_id: member.orgId, role, permission },
            { onConflict: 'org_id,role,permission' },
          )
      : await supabase
          .from('role_permissions')
          .delete()
          .eq('org_id', member.orgId)
          .eq('role', role)
          .eq('permission', permission)

    if (error) {
      if (isLockoutError(error.message)) return { ok: false, error: LOCKOUT_MESSAGE }
      console.error('[settings] setRolePermission', error)
      return { ok: false, error: 'No se pudo guardar el permiso.' }
    }

    revalidatePath('/dashboard', 'layout')
    return { ok: true }
  } catch {
    return { ok: false, error: 'No tienes permiso para esta acción.' }
  }
}

export async function setMemberRole(membershipId: string, role: RoleKey): Promise<ActionResult> {
  try {
    const member = await requirePermission('configuracion:manage')

    if (!roleKeySchema.safeParse(role).success) {
      return { ok: false, error: 'Rol desconocido.' }
    }
    if (!z.uuid().safeParse(membershipId).success) {
      return { ok: false, error: 'Miembro desconocido.' }
    }
    if (!(await orgHasRole(member.orgId, role))) {
      return { ok: false, error: 'Ese rol no existe en la organización.' }
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('memberships')
      .update({ role })
      .eq('id', membershipId)
      .eq('org_id', member.orgId)

    if (error) {
      if (isLockoutError(error.message)) return { ok: false, error: LOCKOUT_MESSAGE }
      console.error('[settings] setMemberRole', error)
      return { ok: false, error: 'No se pudo cambiar el rol.' }
    }

    revalidatePath('/dashboard', 'layout')
    return { ok: true }
  } catch {
    return { ok: false, error: 'No tienes permiso para esta acción.' }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Roles
 *
 * The four functions an administrator needs to own the vocabulary their
 * company actually uses. Until migration 24 there were none: roles were three
 * global rows, and «Médico», «Recepción» or «Residente de obra» could not be
 * expressed at all.
 *
 * `key` is the identity — it is the value stored in `memberships.role`,
 * `role_permissions.role`, `invitations.role` and `employees.intended_role` — so
 * it is set once at creation and never edited. `label` is the word on screen
 * and is freely editable. Renaming in place would mean cascading a primary key
 * through four tables to change a caption.
 * ═══════════════════════════════════════════════════════════════════════════ */

const createRoleSchema = z.object({
  label: z
    .string()
    .trim()
    .min(2, 'El nombre del rol es muy corto.')
    .max(40, 'El nombre del rol es muy largo.'),
  /**
   * Optional: a new role starts with a copy of another role's permissions.
   *
   * This is the difference between a feature people use and one they abandon.
   * Building «Médico» from nothing is thirty-nine switches; building it from
   * «Empleado» is three.
   */
  copyFrom: z.string().trim().max(40).optional(),
})

export async function createRole(
  input: z.input<typeof createRoleSchema>,
): Promise<ActionResult & { key?: string }> {
  try {
    const member = await requirePermission('configuracion:manage')
    const parsed = createRoleSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    }

    const { label, copyFrom } = parsed.data
    const supabase = await createClient()

    // The label doubles as the key for a role created through the UI. They can
    // diverge later — editing the label leaves the key alone — but starting
    // them equal keeps the stored value readable in the database, which is
    // where anyone debugging a permission problem will be looking.
    const { error } = await supabase.from('roles').insert({
      org_id: member.orgId,
      key: label,
      label,
      // Below every seeded role, so a new role sorts last until the
      // administrator says otherwise. Nothing derives authority from rank.
      rank: 60,
      is_system: false,
    })

    if (error) {
      const duplicate = error.code === '23505'
      return {
        ok: false,
        error: duplicate ? 'Ya existe un rol con ese nombre.' : 'No se pudo crear el rol.',
      }
    }

    if (copyFrom && copyFrom !== label) {
      const { data: source } = await supabase
        .from('role_permissions')
        .select('permission')
        .eq('org_id', member.orgId)
        .eq('role', copyFrom)

      if (source && source.length > 0) {
        const { error: copyError } = await supabase.from('role_permissions').insert(
          source.map((row) => ({
            org_id: member.orgId,
            role: label,
            permission: row.permission,
          })),
        )
        // The role exists and is usable; only the head start failed. Reporting
        // failure here would be worse than reporting success — it invites the
        // administrator to create the role a second time.
        if (copyError) console.error('[settings] createRole copy', copyError)
      }
    }

    revalidatePath('/dashboard', 'layout')
    return { ok: true, key: label }
  } catch {
    return { ok: false, error: 'No tienes permiso para esta acción.' }
  }
}

const updateRoleSchema = z.object({
  key: z.string().trim().min(2).max(40),
  label: z
    .string()
    .trim()
    .min(2, 'El nombre del rol es muy corto.')
    .max(40, 'El nombre del rol es muy largo.'),
  rank: z.number().int().min(1).max(999).optional(),
})

/** Renames a role and reorders it. The key — what memberships store — is untouched. */
export async function updateRole(
  input: z.input<typeof updateRoleSchema>,
): Promise<ActionResult> {
  try {
    const member = await requirePermission('configuracion:manage')
    const parsed = updateRoleSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('roles')
      .update({
        label: parsed.data.label,
        ...(parsed.data.rank === undefined ? {} : { rank: parsed.data.rank }),
      })
      .eq('org_id', member.orgId)
      .eq('key', parsed.data.key)

    if (error) {
      console.error('[settings] updateRole', error)
      return { ok: false, error: 'No se pudo actualizar el rol.' }
    }

    revalidatePath('/dashboard', 'layout')
    return { ok: true }
  } catch {
    return { ok: false, error: 'No tienes permiso para esta acción.' }
  }
}

/**
 * Deletes a role, with its grants.
 *
 * Refused by the database while anyone still holds it: `memberships.role` and
 * `employees.intended_role` reference it `on delete restrict`, so a person can
 * never be left with an undefined level of access. `role_permissions`
 * cascades, and the deferred lockout guard catches the case where the deleted
 * role was the last one carrying `configuracion:manage`.
 */
export async function deleteRole(key: string): Promise<ActionResult> {
  try {
    const member = await requirePermission('configuracion:manage')
    if (!roleKeySchema.safeParse(key).success) {
      return { ok: false, error: 'Rol desconocido.' }
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('org_id', member.orgId)
      .eq('key', key)

    if (error) {
      if (isLockoutError(error.message)) return { ok: false, error: LOCKOUT_MESSAGE }
      // 23503 — foreign key violation: somebody, or some employee record, is
      // still on this role.
      if (error.code === '23503') {
        return {
          ok: false,
          error: 'Todavía hay personas con este rol. Muévelas a otro rol y vuelve a intentarlo.',
        }
      }
      console.error('[settings] deleteRole', error)
      return { ok: false, error: 'No se pudo eliminar el rol.' }
    }

    revalidatePath('/dashboard', 'layout')
    return { ok: true }
  } catch {
    return { ok: false, error: 'No tienes permiso para esta acción.' }
  }
}

const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Ingresa tu nombre.').max(160),
})

export async function updateProfile(input: z.input<typeof profileSchema>): Promise<ActionResult> {
  try {
    const member = await requireMember()
    const parsed = profileSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: parsed.data.fullName })
      .eq('id', member.userId)

    if (error) return { ok: false, error: 'No se pudo actualizar tu perfil.' }

    revalidatePath('/dashboard', 'layout')
    return { ok: true }
  } catch {
    return { ok: false, error: 'Inicia sesión para continuar.' }
  }
}

const organizationSchema = z.object({
  name: z.string().trim().min(1, 'El nombre de la empresa es obligatorio.').max(120),
  industry: z.string().trim().max(80).optional(),
})

export async function updateOrganization(
  input: z.input<typeof organizationSchema>,
): Promise<ActionResult> {
  try {
    const member = await requirePermission('configuracion:manage')
    const parsed = organizationSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('organizations')
      .update({ name: parsed.data.name, industry: parsed.data.industry || null })
      .eq('id', member.orgId)

    if (error) return { ok: false, error: 'No se pudo actualizar la organización.' }

    revalidatePath('/dashboard', 'layout')
    return { ok: true }
  } catch {
    return { ok: false, error: 'No tienes permiso para esta acción.' }
  }
}

/**
 * Company type and the modules the organization uses.
 *
 * Saved together because they are one decision made on one screen: picking a
 * type proposes a preset, the toggles amend it, and storing the amended list
 * is what makes the preset a starting point rather than a lock. Storing only
 * the type would silently rewrite an administrator's hand-picked selection
 * every time the presets in lib/modules.ts change.
 */
const modulesSchema = z.object({
  companyType: z
    .string()
    .refine(isCompanyType, 'Tipo de empresa desconocido.')
    .nullable(),
  /**
   * Optional, and validated by the database rather than here.
   *
   * The rule is "this subsector must belong to that sector", which needs both
   * values and the catalogue — a trigger has all three and this schema has one.
   * Checking it here as well would be a second copy of a relationship that is
   * already expressed where the rows are.
   */
  subsector: z.string().trim().min(1).max(40).nullish(),
  modules: z
    .array(z.string().refine(isModuleKey, 'Módulo desconocido.'))
    // Anything longer than the whole catalogue is not a UI submission.
    .max(MODULE_KEYS.length, 'Selección inválida.'),
})

export async function updateModules(
  input: z.input<typeof modulesSchema>,
): Promise<ActionResult> {
  try {
    const member = await requirePermission('configuracion:manage')
    const parsed = modulesSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    }

    // Duplicates would pass the array check and then sit in the column
    // forever, since nothing downstream dedupes before writing.
    const modules = [...new Set(parsed.data.modules)]

    /**
     * The plan gate, enforced on the way in as well as on the way out.
     *
     * `getMember` already filters plan-excluded modules out of what the app
     * reads, so storing one would be inert — but only until the account moved
     * to a plan that includes it, at which point a module nobody ever switched
     * on would appear in the sidebar. Refusing the write keeps the column
     * meaning what it says.
     *
     * Named individually rather than reported as a count: "Pacientes requiere
     * el plan Growth" is actionable, "3 módulos no están en tu plan" is not.
     */
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

    // An empty array is how the column says "never configured", which the app
    // resolves to a preset. Writing one deliberately would therefore not turn
    // everything off — it would silently turn the preset back on. Refuse, so
    // the screen has to say what it means.
    if (modules.length === 0) {
      return {
        ok: false,
        error: 'Deja al menos un módulo activo. Configuración y Dashboard siempre están disponibles.',
      }
    }

    /**
     * Hard dependencies, folded in rather than refused.
     *
     * `tienda` without `catalogos` is a storefront with nothing to sell;
     * `nomina` without `empleados` is a payroll for nobody. Both were
     * previously accepted, and the first sign was an empty screen with no
     * explanation — the module was on, so nothing in the product could say what
     * was wrong.
     *
     * Adding them is better than refusing. The customer asked for the store;
     * telling them "you may not have a store until you also tick a second box"
     * is a puzzle, not a safeguard. The result is reported so nothing appears
     * in their sidebar unannounced.
     *
     * The plan is re-checked over the additions, and there the answer *is* a
     * refusal: switching on a module the subscription excludes, as a side
     * effect of switching on a different one, would be the product buying
     * something on the customer's behalf.
     */
    const implied = missingHardDependencies(modules)
    if (implied.length > 0) {
      const unaffordable = implied.filter((key) => !planAllows(member.plan, key))
      if (unaffordable.length > 0) {
        const need = unaffordable.map((key) => moduleDef(key)?.label ?? key)
        const asked = modules.filter((m) => dependenciesOf(m, 'hard').some((d) => unaffordable.includes(d)))
        const askedLabels = asked.map((key) => moduleDef(key)?.label ?? key)
        return {
          ok: false,
          error:
            `${askedLabels.join(', ')} necesita ${need.join(', ')}, que tu plan no incluye.` +
            (lowestPlanWith(unaffordable[0])
              ? ` Está disponible desde el plan ${lowestPlanWith(unaffordable[0])!.label}.`
              : ''),
        }
      }
      modules.push(...implied)
    }

    const supabase = await createClient()

    /**
     * A downgrade hides, never deletes.
     *
     * The screen's list comes from `member.modules`, which is already filtered
     * by the plan — so after a downgrade the modules that fell off the plan are
     * invisible here, and saving this list would silently wipe them from
     * `enabled_modules`. They must survive: a plan that rises again must find
     * the configuration exactly as it was (the billing contract, K.3 of the
     * audit). The column is read as it stands and the plan-excluded modules are
     * carried over untouched; the rejection above still stops *adding* new ones.
     */
    const { data: orgRow } = await supabase
      .from('organizations')
      .select('enabled_modules')
      .eq('id', member.orgId)
      .single()
    const preserved = (orgRow?.enabled_modules ?? []).filter((key) => !planAllows(member.plan, key))
    modules.push(...preserved)

    const { error } = await supabase
      .from('organizations')
      .update({
        company_type: parsed.data.companyType,
        // Clearing the sector clears the subsector with it. The trigger refuses
        // a subsector with no parent, so leaving a stale one would make the
        // *next* save fail for a reason this screen could not explain.
        subsector: parsed.data.companyType ? parsed.data.subsector ?? null : null,
        enabled_modules: modules,
      })
      .eq('id', member.orgId)

    if (error) {
      console.error('[settings] updateModules', error)
      return {
        ok: false,
        error: error.message.includes('subsector')
          ? 'Ese subsector no pertenece al sector elegido.'
          : 'No se pudieron guardar los módulos.',
      }
    }

    // 'layout' scope: the sidebar is rendered by the dashboard layout and its
    // contents are derived from this column, so a page-scoped revalidate would
    // leave the nav advertising a module that was just switched off.
    revalidatePath('/dashboard', 'layout')
    return { ok: true }
  } catch {
    return { ok: false, error: 'No tienes permiso para esta acción.' }
  }
}

/**
 * Revoke every session this user has, on every device.
 *
 * The button for this used to pop a confirm and then a success toast, and
 * revoke nothing — the sessions it claimed to have closed stayed valid until
 * they expired on their own. That is the worst kind of security control: one
 * that reports success. `scope: 'global'` is what actually invalidates the
 * refresh tokens.
 *
 * The caller's own session goes with them, which is correct — "todos tus
 * dispositivos" includes this one — so the client redirects to /login after.
 */
export async function signOutEverywhere(): Promise<ActionResult> {
  try {
    await requireMember()
    const supabase = await createClient()
    const { error } = await supabase.auth.signOut({ scope: 'global' })

    if (error) {
      console.error('[settings] signOutEverywhere', error)
      return { ok: false, error: 'No se pudieron cerrar las sesiones. Inténtalo de nuevo.' }
    }

    return { ok: true }
  } catch {
    return { ok: false, error: 'No tienes una sesión activa.' }
  }
}

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Ingresa tu contraseña actual.'),
  newPassword: passwordSchema,
})

export async function changePassword(
  input: z.input<typeof passwordChangeSchema>,
): Promise<ActionResult> {
  try {
    const member = await requireMember()
    const parsed = passwordChangeSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    }

    const supabase = await createClient()

    // Re-authenticate first. Supabase's updateUser only requires a valid
    // session, so without this an unattended open tab is enough to take over
    // the account permanently.
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: member.email,
      password: parsed.data.currentPassword,
    })
    if (reauthError) return { ok: false, error: 'La contraseña actual no es correcta.' }

    const { error } = await supabase.auth.updateUser({ password: parsed.data.newPassword })
    if (error) return { ok: false, error: error.message }

    return { ok: true }
  } catch {
    return { ok: false, error: 'Inicia sesión para continuar.' }
  }
}

/* ------------------------------------------------------------------ */
/*  Invitations                                                        */
/* ------------------------------------------------------------------ */

/**
 * How long an invitation stays usable. Long enough to survive a holiday,
 * short enough that a forgotten row does not become a standing way in.
 */
const INVITE_TTL_DAYS = 14

const inviteSchema = z.object({
  email: z.email('Escribe un correo válido.').max(160).transform((v) => v.trim().toLowerCase()),
  role: roleKeySchema,
})

/**
 * Invites someone to the organization.
 *
 * There is no email being sent from here, and the invitation does not depend
 * on one: `handle_new_user` (migration 01) looks for a pending, unexpired
 * invitation matching the address of every new signup and puts that person in
 * this organization with this role instead of creating one for them. So the
 * row *is* the invitation, and the administrator passes on the link.
 *
 * The token is generated and stored hashed even though the trigger matches on
 * the address. It costs nothing now and it is what a mailed, single-use link
 * will need; storing the raw token instead would mean a database read is
 * enough to accept somebody else's invitation.
 */
export async function inviteMember(
  input: z.input<typeof inviteSchema>,
): Promise<ActionResult> {
  try {
    const member = await requirePermission('configuracion:manage')
    const parsed = inviteSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    }
    // The foreign key would refuse an unknown role anyway, but as an opaque
    // constraint violation rather than a sentence — and the invitation is the
    // one place where the error surfaces long after the mistake was made.
    if (!(await orgHasRole(member.orgId, parsed.data.role))) {
      return { ok: false, error: 'Ese rol no existe en la organización.' }
    }

    const supabase = await createClient()

    // Someone already inside does not need an invitation, and issuing one
    // would look like it did something. Checked against profiles + memberships
    // rather than the auth table, which is not readable from here.
    const { data: existing } = await supabase
      .from('memberships')
      .select('id, profiles!inner(email)')
      .eq('org_id', member.orgId)
      .eq('profiles.email', parsed.data.email)
      .maybeSingle()

    if (existing) {
      return { ok: false, error: 'Esa persona ya pertenece a la organización.' }
    }

    /**
     * The seat limit.
     *
     * Counted as members *plus* outstanding invitations. Counting members
     * alone lets a full organization invite its way past the cap: every
     * invitation is accepted eventually, and by then the seat is taken.
     *
     * Checked after the "already a member" branch on purpose — re-inviting
     * someone who is already inside should say so, not report the account full.
     *
     * This is an application-level check, not RLS. Only an administrator can
     * write invitations at all, so the worst case is a customer exceeding the
     * plan they pay for — a billing discrepancy, not a tenant leak.
     */
    const plan = planFor(member.plan)
    if (plan.seats !== null) {
      const [{ count: members }, { count: pending }] = await Promise.all([
        supabase
          .from('memberships')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', member.orgId),
        supabase
          .from('invitations')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', member.orgId)
          .is('accepted_at', null)
          .gt('expires_at', new Date().toISOString()),
      ])

      const used = (members ?? 0) + (pending ?? 0)
      if (!seatsAvailable(member.plan, used)) {
        return {
          ok: false,
          error:
            `Tu plan ${plan.label} permite ${plan.seats} personas y ya usas ${used} ` +
            '(incluye invitaciones pendientes). Cambia de plan para agregar más.',
        }
      }
    }

    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000)

    // Re-inviting the same address replaces the pending row rather than
    // failing on `unique (org_id, email)`: the intent is "invite them", and a
    // second attempt usually means the first link went astray.
    const { error } = await supabase.from('invitations').upsert(
      {
        org_id: member.orgId,
        email: parsed.data.email,
        role: parsed.data.role,
        token_hash: createHash('sha256').update(token).digest('hex'),
        invited_by: member.userId,
        expires_at: expiresAt.toISOString(),
        accepted_at: null,
      },
      { onConflict: 'org_id,email' },
    )

    if (error) {
      console.error('[settings] inviteMember', error)
      return { ok: false, error: 'No se pudo crear la invitación.' }
    }

    revalidatePath('/dashboard/configuracion')
    return { ok: true }
  } catch {
    return { ok: false, error: 'No tienes permiso para invitar a la organización.' }
  }
}

/** Withdraws a pending invitation. */
export async function revokeInvitation(id: string): Promise<ActionResult> {
  try {
    const member = await requirePermission('configuracion:manage')
    if (!z.uuid().safeParse(id).success) return { ok: false, error: 'Invitación desconocida.' }

    const supabase = await createClient()
    const { error } = await supabase
      .from('invitations')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)
      .is('accepted_at', null)

    if (error) {
      console.error('[settings] revokeInvitation', error)
      return { ok: false, error: 'No se pudo cancelar la invitación.' }
    }

    revalidatePath('/dashboard/configuracion')
    return { ok: true }
  } catch {
    return { ok: false, error: 'No tienes permiso para gestionar invitaciones.' }
  }
}
