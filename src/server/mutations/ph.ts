'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { getPh, type PhData } from '@/server/queries/ph'
import { todayIn } from '@/lib/domain'

export type PhResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const DENIED = 'No tienes permiso para gestionar la propiedad horizontal.'

async function refreshed(): Promise<PhResult<PhData>> {
  revalidatePath('/dashboard/ph')
  return { ok: true, data: await getPh() }
}

/* ─── Asambleas ──────────────────────────────────────────────────────────── */

const addAsambleaSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tema: z.string().trim().min(2).max(160),
  tipo: z.enum(['ordinaria', 'extraordinaria']).default('ordinaria'),
})

export async function addAsamblea(
  input: z.input<typeof addAsambleaSchema>,
): Promise<PhResult<PhData>> {
  try {
    const member = await requirePermission('ph:write')
    const parsed = addAsambleaSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase.from('ph_asambleas').insert({
      org_id: member.orgId,
      fecha: parsed.data.fecha,
      tema: parsed.data.tema,
      tipo: parsed.data.tipo,
      estado: 'convocada',
    })

    if (error) {
      console.error('[ph] addAsamblea', error)
      return fail('No se pudo convocar la asamblea.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

const ASAMBLEA_ESTADOS = ['convocada', 'realizada', 'acta_firmada'] as const

export async function setAsambleaEstado(id: string, estado: string): Promise<PhResult<PhData>> {
  try {
    const member = await requirePermission('ph:write')
    if (!z.uuid().safeParse(id).success) return fail('Asamblea inválida.')
    const parsed = z.enum(ASAMBLEA_ESTADOS).safeParse(estado)
    if (!parsed.success) return fail('Estado inválido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('ph_asambleas')
      .update({ estado: parsed.data })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[ph] setAsambleaEstado', error)
      return fail('No se pudo cambiar el estado.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deleteAsamblea(id: string): Promise<PhResult<PhData>> {
  try {
    const member = await requirePermission('ph:write')
    if (!z.uuid().safeParse(id).success) return fail('Asamblea inválida.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('ph_asambleas')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[ph] deleteAsamblea', error)
      return fail('No se pudo eliminar la asamblea.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/* ─── Cuotas ─────────────────────────────────────────────────────────────── */

const addCuotaSchema = z.object({
  unidad: z.string().trim().min(2).max(40),
  periodo: z.string().trim().min(2).max(20),
  tipo: z.enum(['ordinaria', 'extraordinaria']).default('ordinaria'),
  monto: z.coerce.number().min(0).max(999_999_999_999),
  vence: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function addCuota(input: z.input<typeof addCuotaSchema>): Promise<PhResult<PhData>> {
  try {
    const member = await requirePermission('ph:write')
    const parsed = addCuotaSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase.from('ph_cuotas').insert({
      org_id: member.orgId,
      unidad: parsed.data.unidad,
      periodo: parsed.data.periodo,
      tipo: parsed.data.tipo,
      monto: parsed.data.monto,
      vence: parsed.data.vence || null,
    })

    if (error) {
      console.error('[ph] addCuota', error)
      return fail('No se pudo registrar la cuota.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function setCuotaPagada(id: string, pagada: boolean): Promise<PhResult<PhData>> {
  try {
    const member = await requirePermission('ph:write')
    if (!z.uuid().safeParse(id).success) return fail('Cuota inválida.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('ph_cuotas')
      .update({
        estado: pagada ? 'pagada' : 'pendiente',
        pagada_on: pagada ? todayIn(member.orgTimezone) : null,
      })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[ph] setCuotaPagada', error)
      return fail('No se pudo actualizar la cuota.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deleteCuota(id: string): Promise<PhResult<PhData>> {
  try {
    const member = await requirePermission('ph:write')
    if (!z.uuid().safeParse(id).success) return fail('Cuota inválida.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('ph_cuotas')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[ph] deleteCuota', error)
      return fail('No se pudo eliminar la cuota.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/* ─── Zonas comunes ──────────────────────────────────────────────────────── */

const addZonaSchema = z.object({
  name: z.string().trim().min(2).max(120),
  tipo: z.enum(['salon', 'piscina', 'gimnasio', 'parqueadero', 'otro']).default('otro'),
  notas: z.string().trim().max(500).default(''),
})

export async function addZona(input: z.input<typeof addZonaSchema>): Promise<PhResult<PhData>> {
  try {
    const member = await requirePermission('ph:write')
    const parsed = addZonaSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase.from('ph_zonas').insert({
      org_id: member.orgId,
      name: parsed.data.name,
      tipo: parsed.data.tipo,
      notas: parsed.data.notas || null,
    })

    if (error) {
      console.error('[ph] addZona', error)
      return fail('No se pudo registrar la zona.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

const ZONA_ESTADOS = ['operativa', 'mantenimiento', 'cerrada'] as const

export async function setZonaEstado(id: string, estado: string): Promise<PhResult<PhData>> {
  try {
    const member = await requirePermission('ph:write')
    if (!z.uuid().safeParse(id).success) return fail('Zona inválida.')
    const parsed = z.enum(ZONA_ESTADOS).safeParse(estado)
    if (!parsed.success) return fail('Estado inválido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('ph_zonas')
      .update({ estado: parsed.data })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[ph] setZonaEstado', error)
      return fail('No se pudo cambiar el estado.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deleteZona(id: string): Promise<PhResult<PhData>> {
  try {
    const member = await requirePermission('ph:write')
    if (!z.uuid().safeParse(id).success) return fail('Zona inválida.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('ph_zonas')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[ph] deleteZona', error)
      return fail('No se pudo eliminar la zona.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}
