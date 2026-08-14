'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { belongsToOrg } from '@/server/queries/shared'
import { getTiempos, type TiemposData } from '@/server/queries/tiempos'

export type TiemposResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const DENIED = 'No tienes permiso para gestionar los tiempos.'

async function refreshed(): Promise<TiemposResult<TiemposData>> {
  revalidatePath('/dashboard/tiempos')
  return { ok: true, data: await getTiempos() }
}

/* ─── Registrar hora ───────────────────────────────────────────────────── */

const addSchema = z.object({
  employeeId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minutes: z.coerce.number().int().min(1).max(1440),
  rateCents: z.coerce.number().int().min(0).max(1_000_000_00).nullable().optional(),
  notes: z.string().trim().max(1000).default(''),
})

/**
 * Anota una hora trabajada.
 *
 * Persona y proyecto son opcionales — hay horas sin dueño y horas sin obra —,
 * y cuando vienen se validan contra *esta* organización: RLS sobre
 * `time_entries` mira el `org_id` de la fila, no lo que la fila señala.
 */
export async function addTimeEntry(
  input: z.input<typeof addSchema>,
): Promise<TiemposResult<TiemposData>> {
  try {
    const member = await requirePermission('tiempos:write')
    const parsed = addSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    if (!(await belongsToOrg(supabase, 'employees', parsed.data.employeeId ?? null, member.orgId))) {
      return fail('Esa persona no está en el equipo de tu organización.')
    }
    if (!(await belongsToOrg(supabase, 'projects', parsed.data.projectId ?? null, member.orgId))) {
      return fail('Ese proyecto no pertenece a tu organización.')
    }

    const { error } = await supabase.from('time_entries').insert({
      org_id: member.orgId,
      employee_id: parsed.data.employeeId ?? null,
      project_id: parsed.data.projectId ?? null,
      work_date: parsed.data.workDate,
      minutes: parsed.data.minutes,
      rate_cents: parsed.data.rateCents ?? null,
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[tiempos] addTimeEntry', error)
      return fail('No se pudo registrar la hora.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/* ─── Borrar hora ──────────────────────────────────────────────────────── */

export async function deleteTimeEntry(entryId: string): Promise<TiemposResult<TiemposData>> {
  try {
    const member = await requirePermission('tiempos:write')
    if (!z.uuid().safeParse(entryId).success) return fail('Registro inválido.')

    const supabase = await createClient()
    // Borrado real, no suave: una hora mal tecleada no es historia que
    // preservar. `org_id` va explícito para que nadie pueda borrar por id
    // lo que no es de su empresa.
    const { error } = await supabase
      .from('time_entries')
      .delete()
      .eq('id', entryId)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[tiempos] deleteTimeEntry', error)
      return fail('No se pudo eliminar el registro.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}
