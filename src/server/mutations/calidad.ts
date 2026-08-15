'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { belongsToOrg } from '@/server/queries/shared'
import { getCalidad, type CalidadData } from '@/server/queries/calidad'

export type CalidadResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const DENIED = 'No tienes permiso para gestionar los controles de calidad.'

async function refreshed(): Promise<CalidadResult<CalidadData>> {
  revalidatePath('/dashboard/calidad')
  return { ok: true, data: await getCalidad() }
}

/* ─── Controles ─────────────────────────────────────────────────────────── */

const addCheckSchema = z.object({
  productId: z.string().uuid().nullable().optional(),
  batch: z.string().trim().max(80).default(''),
  checkedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  result: z.enum(['aprobado', 'rechazado', 'condicional']).default('aprobado'),
  notes: z.string().trim().max(500).default(''),
})

/**
 * Registra una inspección con resultado. El producto es opcional, y cuando
 * viene se valida contra *esta* organización: RLS mira el `org_id` de la
 * fila propia, no lo que la fila señala.
 */
export async function addCheck(
  input: z.input<typeof addCheckSchema>,
): Promise<CalidadResult<CalidadData>> {
  try {
    const member = await requirePermission('calidad:write')
    const parsed = addCheckSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    if (!(await belongsToOrg(supabase, 'products', parsed.data.productId ?? null, member.orgId))) {
      return fail('Ese producto no pertenece a tu organización.')
    }

    const { error } = await supabase.from('quality_checks').insert({
      org_id: member.orgId,
      product_id: parsed.data.productId ?? null,
      batch: parsed.data.batch || null,
      checked_on: parsed.data.checkedOn,
      result: parsed.data.result,
      notes: parsed.data.notes || null,
    })

    if (error) {
      console.error('[calidad] addCheck', error)
      return fail('No se pudo registrar el control.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deleteCheck(id: string): Promise<CalidadResult<CalidadData>> {
  try {
    const member = await requirePermission('calidad:write')
    if (!z.uuid().safeParse(id).success) return fail('Control inválido.')

    const supabase = await createClient()
    // Borrado real, no suave, con `org_id` explícito: nadie borra por id lo
    // que no es de su empresa.
    const { error } = await supabase
      .from('quality_checks')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[calidad] deleteCheck', error)
      return fail('No se pudo eliminar el control.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/* ─── No conformidades ──────────────────────────────────────────────────── */

const addNonconformitySchema = z.object({
  productId: z.string().uuid().nullable().optional(),
  batch: z.string().trim().max(80).default(''),
  description: z.string().trim().min(2).max(500),
  severity: z.enum(['baja', 'media', 'alta']).default('media'),
  openedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

/**
 * Abre una no conformidad. Nace `abierta`; se cierra cuando se resuelve. El
 * producto es opcional y, cuando viene, se valida contra *esta* organización.
 */
export async function addNonconformity(
  input: z.input<typeof addNonconformitySchema>,
): Promise<CalidadResult<CalidadData>> {
  try {
    const member = await requirePermission('calidad:write')
    const parsed = addNonconformitySchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    if (!(await belongsToOrg(supabase, 'products', parsed.data.productId ?? null, member.orgId))) {
      return fail('Ese producto no pertenece a tu organización.')
    }

    const { error } = await supabase.from('nonconformities').insert({
      org_id: member.orgId,
      product_id: parsed.data.productId ?? null,
      batch: parsed.data.batch || null,
      description: parsed.data.description,
      severity: parsed.data.severity,
      status: 'abierta',
      opened_on: parsed.data.openedOn,
    })

    if (error) {
      console.error('[calidad] addNonconformity', error)
      return fail('No se pudo registrar la no conformidad.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function setNonconformityStatus(
  id: string,
  status: string,
): Promise<CalidadResult<CalidadData>> {
  try {
    const member = await requirePermission('calidad:write')
    if (!z.uuid().safeParse(id).success) return fail('No conformidad inválida.')
    const parsedStatus = z.enum(['abierta', 'en_proceso', 'cerrada']).safeParse(status)
    if (!parsedStatus.success) return fail('Estado inválido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('nonconformities')
      .update({ status: parsedStatus.data })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[calidad] setNonconformityStatus', error)
      return fail('No se pudo cambiar el estado.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function setNonconformityAction(
  id: string,
  actionTaken: string,
): Promise<CalidadResult<CalidadData>> {
  try {
    const member = await requirePermission('calidad:write')
    if (!z.uuid().safeParse(id).success) return fail('No conformidad inválida.')
    const parsedAction = z.string().trim().max(500).safeParse(actionTaken)
    if (!parsedAction.success) return fail('Acción inválida.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('nonconformities')
      .update({ action_taken: parsedAction.data })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[calidad] setNonconformityAction', error)
      return fail('No se pudo guardar la acción.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deleteNonconformity(id: string): Promise<CalidadResult<CalidadData>> {
  try {
    const member = await requirePermission('calidad:write')
    if (!z.uuid().safeParse(id).success) return fail('No conformidad inválida.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('nonconformities')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[calidad] deleteNonconformity', error)
      return fail('No se pudo eliminar la no conformidad.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}
