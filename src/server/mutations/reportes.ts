'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import type { Supabase } from '@/server/queries/shared'
import { getReportes, type ReportesData } from '@/server/queries/reportes'

export type ReportesResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const DENIED = 'No tienes permiso para gestionar los reportes.'

/** Client sin tipar: `saved_reports` aún no está en los tipos generados. */
function rawClient(supabase: Supabase): SupabaseClient {
  return supabase as unknown as SupabaseClient
}

async function refreshed(): Promise<ReportesResult<ReportesData>> {
  revalidatePath('/dashboard/reportes')
  return { ok: true, data: await getReportes() }
}

/**
 * Una vista guardada: qué módulo, qué periodo y una nota de quién la guardó.
 */
const saveSchema = z.object({
  name: z.string().trim().min(2).max(80),
  moduleKey: z.string().min(1),
  period: z.enum(['hoy', 'semana', 'mes', 'trimestre', 'todo']).default('mes'),
  notes: z.string().trim().max(500).default(''),
})

export async function saveReport(
  input: z.input<typeof saveSchema>,
): Promise<ReportesResult<ReportesData>> {
  try {
    const member = await requirePermission('reportes:write')
    const parsed = saveSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const client = rawClient(supabase)
    const { error } = await client.from('saved_reports').insert({
      org_id: member.orgId,
      name: parsed.data.name,
      module_key: parsed.data.moduleKey,
      period: parsed.data.period,
      notes: parsed.data.notes,
      created_by: member.userId,
    })

    if (error) {
      console.error('[reportes] saveReport', error)
      return fail('No se pudo guardar el reporte.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deleteReport(id: string): Promise<ReportesResult<ReportesData>> {
  try {
    const member = await requirePermission('reportes:write')
    if (!z.uuid().safeParse(id).success) return fail('Reporte inválido.')

    const supabase = await createClient()
    const client = rawClient(supabase)
    // Borrado real, no suave. `org_id` va explícito para que nadie pueda
    // borrar por id lo que no es de su empresa.
    const { error } = await client
      .from('saved_reports')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[reportes] deleteReport', error)
      return fail('No se pudo eliminar el reporte.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}
