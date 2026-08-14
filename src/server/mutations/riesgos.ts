'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { RISK_CATEGORIES, RISK_SEVERITIES, RISK_STATUSES } from '@/lib/domain'
import { belongsToOrg } from '@/server/queries/shared'
import { getRiesgos, type RiesgosData } from '@/server/queries/riesgos'

/** `org_id` comes from the session, never from the request. */
export type RiesgoResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const baseSchema = z.object({
  category: z.enum(RISK_CATEGORIES).default('Otro'),
  title: z.string().trim().max(160).default(''),
  employeeId: z.uuid().nullable().default(null),
  area: z.string().trim().max(120).default(''),
  severity: z.enum(RISK_SEVERITIES),
  detail: z.string().trim().min(3, 'Describe el riesgo identificado.').max(2000),
  action: z.string().trim().max(500).default(''),
  dueOn: z.string().date().nullable().default(null),
})

const updateSchema = baseSchema.extend({ id: z.uuid() })

export async function createRiesgo(
  input: z.input<typeof baseSchema>,
): Promise<RiesgoResult<RiesgosData>> {
  try {
    const member = await requirePermission('riesgos:write')
    const parsed = baseSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    if (!(await belongsToOrg(supabase, 'employees', parsed.data.employeeId, member.orgId))) {
      return fail('Esa persona no está en el equipo de tu organización.')
    }

    const { error } = await supabase.from('risks').insert({
      org_id: member.orgId,
      category: parsed.data.category,
      title: parsed.data.title,
      employee_id: parsed.data.employeeId,
      area: parsed.data.area,
      severity: parsed.data.severity,
      detail: parsed.data.detail,
      action: parsed.data.action,
      status: 'Abierto',
      due_on: parsed.data.dueOn,
    })

    if (error) {
      console.error('[riesgos] createRiesgo', error)
      return fail('No se pudo registrar el riesgo.')
    }

    revalidatePath('/dashboard/riesgos')
    return { ok: true, data: await getRiesgos() }
  } catch {
    return fail('No tienes permiso para gestionar riesgos.')
  }
}

export async function updateRiesgo(
  input: z.input<typeof updateSchema>,
): Promise<RiesgoResult<RiesgosData>> {
  try {
    const member = await requirePermission('riesgos:write')
    const parsed = updateSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    if (!(await belongsToOrg(supabase, 'employees', parsed.data.employeeId, member.orgId))) {
      return fail('Esa persona no está en el equipo de tu organización.')
    }

    const { error } = await supabase
      .from('risks')
      .update({
        category: parsed.data.category,
        title: parsed.data.title,
        employee_id: parsed.data.employeeId,
        area: parsed.data.area,
        severity: parsed.data.severity,
        detail: parsed.data.detail,
        action: parsed.data.action,
        due_on: parsed.data.dueOn,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[riesgos] updateRiesgo', error)
      return fail('No se pudo actualizar el riesgo.')
    }

    revalidatePath('/dashboard/riesgos')
    return { ok: true, data: await getRiesgos() }
  } catch {
    return fail('No tienes permiso para gestionar riesgos.')
  }
}

const statusSchema = z.object({
  id: z.uuid(),
  status: z.enum(RISK_STATUSES),
})

/**
 * "Gestionar" moves a risk to Mitigado or Cerrado — it does not delete it.
 *
 * The old button dropped the row from a local array, which is why the
 * "Gestionados" KPI was computed as `seed.length - current.length` and reset
 * to zero on reload. A risk register whose closed entries disappear cannot
 * answer the one question it exists for: what did we do about it.
 */
export async function setRiesgoStatus(
  input: z.input<typeof statusSchema>,
): Promise<RiesgoResult<RiesgosData>> {
  try {
    const member = await requirePermission('riesgos:write')
    const parsed = statusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const closed = parsed.data.status !== 'Abierto'
    const supabase = await createClient()
    const { error } = await supabase
      .from('risks')
      .update({
        status: parsed.data.status,
        // Cleared on reopen: a resolution date on an open risk is a lie the
        // reports would repeat.
        resolved_at: closed ? new Date().toISOString() : null,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[riesgos] setRiesgoStatus', error)
      return fail('No se pudo actualizar el riesgo.')
    }

    revalidatePath('/dashboard/riesgos')
    return { ok: true, data: await getRiesgos() }
  } catch {
    return fail('No tienes permiso para gestionar riesgos.')
  }
}

/** Soft delete, for a risk logged by mistake. Closing is `setRiesgoStatus`. */
export async function deleteRiesgo(id: string): Promise<RiesgoResult<RiesgosData>> {
  try {
    const member = await requirePermission('riesgos:write')
    if (!z.uuid().safeParse(id).success) return fail('Riesgo desconocido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('risks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[riesgos] deleteRiesgo', error)
      return fail('No se pudo eliminar el riesgo.')
    }

    revalidatePath('/dashboard/riesgos')
    return { ok: true, data: await getRiesgos() }
  } catch {
    return fail('No tienes permiso para gestionar riesgos.')
  }
}
