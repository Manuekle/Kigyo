'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission, requireMember } from '@/lib/auth/session'
import { isPermission, ROLES, type Permission, type RoleKey } from '@/lib/auth/permissions'
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
