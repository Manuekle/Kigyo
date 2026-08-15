'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { getContratacion, type ContratacionData } from '@/server/queries/contratacion'
import type { Supabase } from '@/server/queries/shared'

export type ContratacionResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const DENIED = 'No tienes permiso para gestionar la contratación.'

async function refreshed(): Promise<ContratacionResult<ContratacionData>> {
  revalidatePath('/dashboard/contratacion')
  return { ok: true, data: await getContratacion() }
}

/** Rechaza un FK de proceso que no es de *esta* organización. */
async function procesoOwnedByOrg(
  supabase: Supabase,
  procesoId: string | null,
  orgId: string,
): Promise<boolean> {
  if (!procesoId) return false
  const { data } = await supabase
    .from('contratacion_procesos')
    .select('id')
    .eq('id', procesoId)
    .eq('org_id', orgId)
    .maybeSingle()
  return Boolean(data)
}

const money = z.coerce.number().min(0).max(999_999_999_999)

/* ─── Procesos ───────────────────────────────────────────────────────────── */

const addProcesoSchema = z.object({
  numero: z.string().trim().min(2).max(40),
  objeto: z.string().trim().min(2).max(300),
  modalidad: z
    .enum(['licitacion', 'seleccion_abreviada', 'minima_cuantia', 'contratacion_directa'])
    .default('licitacion'),
  valor: money,
  cierreOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function addProceso(
  input: z.input<typeof addProcesoSchema>,
): Promise<ContratacionResult<ContratacionData>> {
  try {
    const member = await requirePermission('contratacion:write')
    const parsed = addProcesoSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase.from('contratacion_procesos').insert({
      org_id: member.orgId,
      numero: parsed.data.numero,
      objeto: parsed.data.objeto,
      modalidad: parsed.data.modalidad,
      valor: parsed.data.valor,
      cierre_on: parsed.data.cierreOn || null,
    })

    if (error) {
      console.error('[contratacion] addProceso', error)
      return fail('No se pudo crear el proceso.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

const PROCESO_ESTADOS = ['borrador', 'publicado', 'en_evaluacion', 'adjudicado', 'cancelado'] as const

/**
 * Cambia el estado. Publicar sella la fecha de publicación; adjudicar o
 * cancelar son estados finales y no se pueden deshacer desde aquí.
 */
export async function setProcesoEstado(
  id: string,
  estado: string,
): Promise<ContratacionResult<ContratacionData>> {
  try {
    const member = await requirePermission('contratacion:write')
    if (!z.uuid().safeParse(id).success) return fail('Proceso inválido.')
    const parsed = z.enum(PROCESO_ESTADOS).safeParse(estado)
    if (!parsed.success) return fail('Estado inválido.')

    const supabase = await createClient()
    const query = supabase.from('contratacion_procesos')
    const update = parsed.data === 'publicado'
      ? { estado: parsed.data, publicado_on: new Date().toISOString().slice(0, 10) }
      : { estado: parsed.data }

    const { error } = await query.update(update).eq('id', id).eq('org_id', member.orgId)

    if (error) {
      console.error('[contratacion] setProcesoEstado', error)
      return fail('No se pudo cambiar el estado.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deleteProceso(id: string): Promise<ContratacionResult<ContratacionData>> {
  try {
    const member = await requirePermission('contratacion:write')
    if (!z.uuid().safeParse(id).success) return fail('Proceso inválido.')

    const supabase = await createClient()
    // Cascada: pliegos y oferentes se van con el proceso.
    const { error } = await supabase
      .from('contratacion_procesos')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[contratacion] deleteProceso', error)
      return fail('No se pudo eliminar el proceso.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/* ─── Pliegos ────────────────────────────────────────────────────────────── */

const addPliegoSchema = z.object({
  procesoId: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(500),
  obligatorio: z.boolean().default(true),
})

export async function addPliego(
  input: z.input<typeof addPliegoSchema>,
): Promise<ContratacionResult<ContratacionData>> {
  try {
    const member = await requirePermission('contratacion:write')
    const parsed = addPliegoSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    if (!(await procesoOwnedByOrg(supabase, parsed.data.procesoId, member.orgId))) {
      return fail('Ese proceso no pertenece a tu organización.')
    }

    const { error } = await supabase.from('contratacion_pliegos').insert({
      org_id: member.orgId,
      proceso_id: parsed.data.procesoId,
      name: parsed.data.name,
      description: parsed.data.description,
      obligatorio: parsed.data.obligatorio,
    })

    if (error) {
      console.error('[contratacion] addPliego', error)
      return fail('No se pudo registrar el requisito.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deletePliego(id: string): Promise<ContratacionResult<ContratacionData>> {
  try {
    const member = await requirePermission('contratacion:write')
    if (!z.uuid().safeParse(id).success) return fail('Requisito inválido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('contratacion_pliegos')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[contratacion] deletePliego', error)
      return fail('No se pudo eliminar el requisito.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/* ─── Oferentes ──────────────────────────────────────────────────────────── */

const addOferenteSchema = z.object({
  procesoId: z.string().uuid(),
  name: z.string().trim().min(2).max(160),
  contacto: z.string().trim().max(160).default(''),
  valorOferta: money,
  notas: z.string().trim().max(500).default(''),
})

export async function addOferente(
  input: z.input<typeof addOferenteSchema>,
): Promise<ContratacionResult<ContratacionData>> {
  try {
    const member = await requirePermission('contratacion:write')
    const parsed = addOferenteSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    if (!(await procesoOwnedByOrg(supabase, parsed.data.procesoId, member.orgId))) {
      return fail('Ese proceso no pertenece a tu organización.')
    }

    const { error } = await supabase.from('contratacion_oferentes').insert({
      org_id: member.orgId,
      proceso_id: parsed.data.procesoId,
      name: parsed.data.name,
      contacto: parsed.data.contacto || null,
      valor_oferta: parsed.data.valorOferta,
      notas: parsed.data.notas || null,
    })

    if (error) {
      console.error('[contratacion] addOferente', error)
      return fail('No se pudo registrar el oferente.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

const OFERENTE_ESTADOS = ['invitado', 'presentado', 'habilitado', 'adjudicado', 'rechazado'] as const

export async function setOferenteEstado(
  id: string,
  estado: string,
): Promise<ContratacionResult<ContratacionData>> {
  try {
    const member = await requirePermission('contratacion:write')
    if (!z.uuid().safeParse(id).success) return fail('Oferente inválido.')
    const parsed = z.enum(OFERENTE_ESTADOS).safeParse(estado)
    if (!parsed.success) return fail('Estado inválido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('contratacion_oferentes')
      .update({ estado: parsed.data })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[contratacion] setOferenteEstado', error)
      return fail('No se pudo cambiar el estado.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deleteOferente(id: string): Promise<ContratacionResult<ContratacionData>> {
  try {
    const member = await requirePermission('contratacion:write')
    if (!z.uuid().safeParse(id).success) return fail('Oferente inválido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('contratacion_oferentes')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[contratacion] deleteOferente', error)
      return fail('No se pudo eliminar el oferente.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}
