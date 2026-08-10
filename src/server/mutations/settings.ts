'use server'

import { createHash, randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission, requireMember } from '@/lib/auth/session'
import { isPermission, ROLES, type Permission, type RoleKey } from '@/lib/auth/permissions'
import { isCompanyType, isModuleKey, moduleDef, MODULE_KEYS } from '@/lib/modules'
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

const roleSchema = z.enum(ROLES)

export async function setRolePermission(
  role: RoleKey,
  permission: Permission,
  granted: boolean,
): Promise<ActionResult> {
  try {
    const member = await requirePermission('configuracion:manage')

    if (!roleSchema.safeParse(role).success || !isPermission(permission)) {
      return { ok: false, error: 'Rol o permiso desconocido.' }
    }

    // Without this an administrator could revoke configuracion:manage from
    // Administrador and lock every human out of the permission screen, with
    // no way back short of a database console.
    if (role === 'Administrador' && permission === 'configuracion:manage' && !granted) {
      return {
        ok: false,
        error: 'El rol Administrador no puede perder la administración de la organización.',
      }
    }

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

    if (!roleSchema.safeParse(role).success) {
      return { ok: false, error: 'Rol desconocido.' }
    }
    if (!z.uuid().safeParse(membershipId).success) {
      return { ok: false, error: 'Miembro desconocido.' }
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('memberships')
      .update({ role })
      .eq('id', membershipId)
      .eq('org_id', member.orgId)

    if (error) {
      // The database refuses to leave an organization without an
      // administrator; surface that rule rather than a generic failure.
      const lastAdmin = error.message.includes('al menos un administrador')
      return {
        ok: false,
        error: lastAdmin
          ? 'La organización debe conservar al menos una persona administradora.'
          : 'No se pudo cambiar el rol.',
      }
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

    const supabase = await createClient()
    const { error } = await supabase
      .from('organizations')
      .update({ company_type: parsed.data.companyType, enabled_modules: modules })
      .eq('id', member.orgId)

    if (error) {
      console.error('[settings] updateModules', error)
      return { ok: false, error: 'No se pudieron guardar los módulos.' }
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
  role: z.enum(ROLES),
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
