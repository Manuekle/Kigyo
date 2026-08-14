'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { planFor } from '@/lib/plans'

/**
 * Branches, and who is limited to which.
 *
 * Governed by `configuracion:manage` rather than by a module of its own: a
 * branch is a structural fact about the business, like its tax id, not an
 * operational record. Giving it a module would have meant a company could
 * switch its own org chart off.
 *
 * The assignment functions write `membership_sites`, whose rows are always a
 * *restriction* and never a grant. Somebody with no rows sees every branch, so
 * removing every assignment returns a person to unrestricted — never to blind.
 * That direction is asserted in supabase/tests/rls/009_sites.sql, because
 * getting it backwards would lock people out of their own company.
 */

export type SiteResult = { ok: true } | { ok: false; error: string }

const siteSchema = z.object({
  name: z.string().trim().min(1, 'La sucursal necesita un nombre.').max(120),
  code: z.string().trim().max(20).nullish(),
  address: z.string().trim().max(200).nullish(),
  city: z.string().trim().max(80).nullish(),
  phone: z.string().trim().max(40).nullish(),
})

export async function createSite(input: z.input<typeof siteSchema>): Promise<SiteResult> {
  try {
    const member = await requirePermission('configuracion:manage')
    const parsed = siteSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    }

    const supabase = await createClient()

    /**
     * The plan limit is checked here and enforced by a trigger.
     *
     * The trigger is what makes it true; this exists so the refusal names the
     * plan and the number instead of surfacing a constraint violation. Counted
     * with a HEAD request rather than by fetching the rows — the answer is a
     * number and the rows are not wanted.
     */
    const plan = planFor(member.plan)
    if (plan.maxSitesPerCompany !== null) {
      const { count } = await supabase
        .from('sites')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', member.orgId)
        .is('deleted_at', null)

      if ((count ?? 0) >= plan.maxSitesPerCompany) {
        return {
          ok: false,
          error:
            `Tu plan ${plan.label} permite ${plan.maxSitesPerCompany} ` +
            `${plan.maxSitesPerCompany === 1 ? 'sucursal' : 'sucursales'} por empresa. ` +
            'Cambia de plan para agregar otra.',
        }
      }
    }

    // The first branch of a company becomes its default, so a form that needs
    // one always has an answer. A partial unique index makes "at most one"
    // true regardless of what this decides.
    const { count: existing } = await supabase
      .from('sites')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)

    const { error } = await supabase.from('sites').insert({
      org_id: member.orgId,
      name: parsed.data.name,
      code: parsed.data.code?.trim() || null,
      address: parsed.data.address?.trim() || null,
      city: parsed.data.city?.trim() || null,
      phone: parsed.data.phone?.trim() || null,
      is_default: (existing ?? 0) === 0,
    })

    if (error) {
      console.error('[sites] createSite', error)
      return {
        ok: false,
        error: error.message.includes('permite')
          ? error.message
          : error.code === '23505'
            ? 'Ya existe una sucursal con ese código.'
            : 'No se pudo crear la sucursal.',
      }
    }

    revalidatePath('/dashboard/configuracion')
    return { ok: true }
  } catch {
    return { ok: false, error: 'No tienes permiso para esta acción.' }
  }
}

const updateSiteSchema = siteSchema.extend({ id: z.uuid() })

export async function updateSite(
  input: z.input<typeof updateSiteSchema>,
): Promise<SiteResult> {
  try {
    const member = await requirePermission('configuracion:manage')
    const parsed = updateSiteSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' }
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('sites')
      .update({
        name: parsed.data.name,
        code: parsed.data.code?.trim() || null,
        address: parsed.data.address?.trim() || null,
        city: parsed.data.city?.trim() || null,
        phone: parsed.data.phone?.trim() || null,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[sites] updateSite', error)
      return { ok: false, error: 'No se pudo actualizar la sucursal.' }
    }

    revalidatePath('/dashboard/configuracion')
    return { ok: true }
  } catch {
    return { ok: false, error: 'No tienes permiso para esta acción.' }
  }
}

/**
 * Retires a branch without destroying what happened there.
 *
 * Soft delete, because the rows that reference it are history: an employee who
 * worked at a closed branch, a till that was opened there. `site_id` is
 * `on delete set null`, so a hard delete would quietly turn every one of those
 * records company-wide — visible to people the branch restriction had been
 * keeping them from.
 */
export async function archiveSite(id: string): Promise<SiteResult> {
  try {
    const member = await requirePermission('configuracion:manage')
    if (!z.uuid().safeParse(id).success) {
      return { ok: false, error: 'Sucursal desconocida.' }
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('sites')
      // `is_default` cleared with it: a retired branch must not stay the answer
      // to "where does this go by default".
      .update({ deleted_at: new Date().toISOString(), is_default: false })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[sites] archiveSite', error)
      return { ok: false, error: 'No se pudo archivar la sucursal.' }
    }

    revalidatePath('/dashboard/configuracion')
    return { ok: true }
  } catch {
    return { ok: false, error: 'No tienes permiso para esta acción.' }
  }
}

const assignmentSchema = z.object({
  userId: z.uuid(),
  /**
   * The complete set of branches this person is limited to. An empty array
   * means "no restriction", which is what removing every assignment must mean —
   * never "no access".
   */
  siteIds: z.array(z.uuid()).max(100),
})

/**
 * Replaces somebody's branch restriction wholesale.
 *
 * Delete-then-insert rather than a diff: the input is the intended final state,
 * and computing a minimal change would be more code for the same result, with
 * a window in which the person is assigned to a mixture of old and new.
 */
export async function setMemberSites(
  input: z.input<typeof assignmentSchema>,
): Promise<SiteResult> {
  try {
    const member = await requirePermission('configuracion:manage')
    const parsed = assignmentSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: 'Datos inválidos.' }
    }

    const supabase = await createClient()

    const { error: clearError } = await supabase
      .from('membership_sites')
      .delete()
      .eq('org_id', member.orgId)
      .eq('user_id', parsed.data.userId)

    if (clearError) {
      console.error('[sites] setMemberSites clear', clearError)
      return { ok: false, error: 'No se pudo actualizar la asignación.' }
    }

    if (parsed.data.siteIds.length > 0) {
      const { error } = await supabase.from('membership_sites').insert(
        parsed.data.siteIds.map((siteId) => ({
          org_id: member.orgId,
          user_id: parsed.data.userId,
          site_id: siteId,
        })),
      )

      if (error) {
        console.error('[sites] setMemberSites insert', error)
        // The foreign key refuses a branch from another company, and the
        // composite key to `memberships` refuses a person who is not in this
        // one. Both surface here as the same thing the caller can act on.
        return { ok: false, error: 'Alguna sucursal o persona no pertenece a esta empresa.' }
      }
    }

    revalidatePath('/dashboard', 'layout')
    return { ok: true }
  } catch {
    return { ok: false, error: 'No tienes permiso para esta acción.' }
  }
}
