'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { ACTIVITY_KINDS, LEAD_SOURCES, LEAD_STAGES } from '@/lib/leads'
import { getLeads, type LeadsData } from '@/server/queries/leads'

export type LeadResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const DENIED = 'No tienes permiso para gestionar leads.'

async function refreshed(): Promise<LeadResult<LeadsData>> {
  revalidatePath('/dashboard/leads')
  // La conversión crea un cliente: el directorio cambió.
  revalidatePath('/dashboard/clientes')
  return { ok: true, data: await getLeads() }
}

const baseSchema = z.object({
  name: z.string().trim().min(2, 'El nombre es obligatorio.').max(160),
  companyName: z.string().trim().max(160).default(''),
  email: z.string().trim().toLowerCase().max(200).default(''),
  phone: z.string().trim().max(60).default(''),
  source: z.enum(LEAD_SOURCES).default('Otro'),
  stage: z.enum(LEAD_STAGES).default('Nuevo'),
  ownerId: z.string().trim().max(60).nullable().default(null),
  lostReason: z.string().trim().max(200).default(''),
  notes: z.string().trim().max(2000).default(''),
})

const updateSchema = baseSchema.extend({ id: z.uuid() })

export async function createLead(
  input: z.input<typeof baseSchema>,
): Promise<LeadResult<LeadsData>> {
  try {
    const member = await requirePermission('leads:write')
    const parsed = baseSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase.from('leads').insert({
      org_id: member.orgId,
      name: parsed.data.name,
      company_name: parsed.data.companyName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      source: parsed.data.source,
      stage: parsed.data.stage,
      owner_id: parsed.data.ownerId,
      lost_reason: parsed.data.lostReason,
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[leads] createLead', error)
      return fail('No se pudo crear el lead.')
    }
    return refreshed()
  } catch (e) {
    console.error('[leads] createLead throw', e)
    return fail(DENIED)
  }
}

export async function updateLead(
  input: z.input<typeof updateSchema>,
): Promise<LeadResult<LeadsData>> {
  try {
    await requirePermission('leads:write')
    const parsed = updateSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('leads')
      .update({
        name: parsed.data.name,
        company_name: parsed.data.companyName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        source: parsed.data.source,
        stage: parsed.data.stage,
        owner_id: parsed.data.ownerId,
        lost_reason: parsed.data.lostReason,
        notes: parsed.data.notes,
      })
      .eq('id', parsed.data.id)

    if (error) {
      console.error('[leads] updateLead', error)
      return fail('No se pudo actualizar el lead.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/** Soft delete, como el resto del catálogo: la actividad queda en su sitio. */
export async function deleteLead(id: string): Promise<LeadResult<LeadsData>> {
  try {
    await requirePermission('leads:write')
    if (!z.uuid().safeParse(id).success) return fail('Lead desconocido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('leads')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('[leads] deleteLead', error)
      return fail('No se pudo eliminar el lead.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

const activitySchema = z.object({
  leadId: z.uuid(),
  kind: z.enum(ACTIVITY_KINDS).default('Nota'),
  note: z.string().trim().min(1, 'Escribe qué pasó.').max(2000),
  occurredAt: z.string().trim().datetime({ offset: true }).optional(),
})

export async function addLeadActivity(
  input: z.input<typeof activitySchema>,
): Promise<LeadResult<LeadsData>> {
  try {
    const member = await requirePermission('leads:write')
    const parsed = activitySchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    // El FK valida que el lead exista; esto valida que sea de ESTA empresa.
    // Sin el check, un activity huérfano (org_id propio, lead ajeno) pasaría
    // la RLS y no aparecería en ninguna pantalla — basura con permiso.
    const { data: owned } = await supabase
      .from('leads')
      .select('id')
      .eq('id', parsed.data.leadId)
      .eq('org_id', member.orgId)
      .maybeSingle()
    if (!owned) return fail('El lead no existe o no puedes verlo.')

    const { error } = await supabase.from('lead_activities').insert({
      org_id: member.orgId,
      lead_id: parsed.data.leadId,
      kind: parsed.data.kind,
      note: parsed.data.note,
      occurred_at: parsed.data.occurredAt ?? new Date().toISOString(),
    })

    if (error) {
      console.error('[leads] addLeadActivity', error)
      return fail('No se pudo registrar la actividad.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/**
 * Convierte el lead en cliente.
 *
 * El trabajo lo hace `leads_convert` (migración 75) en una sola transacción:
 * el cliente nace y el lead queda Convertido, o no pasa nada. Exige además
 * `clientes:write`: crear la fila en el directorio pasa por su RLS, que es
 * exactamente el semáforo correcto — convertir es escribir en clientes.
 */
export async function convertLead(id: string): Promise<LeadResult<LeadsData>> {
  try {
    const member = await requirePermission('leads:write')
    if (!member.permissions.has('clientes:write')) {
      return fail('Para convertir un lead necesitas permiso sobre Clientes.')
    }
    if (!z.uuid().safeParse(id).success) return fail('Lead desconocido.')

    const supabase = await createClient()
    const { error } = await supabase.rpc('leads_convert', { p_lead_id: id })

    if (error) {
      console.error('[leads] convertLead', error)
      if (error.code === 'KG101') return fail('El lead no existe o no puedes verlo.')
      if (error.code === 'KG102') return fail('Este lead ya fue convertido.')
      return fail('No se pudo convertir el lead.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}
