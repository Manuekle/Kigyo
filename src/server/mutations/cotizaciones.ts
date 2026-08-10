'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { QUOTE_KINDS, QUOTE_STATUSES } from '@/lib/domain'
import { belongsToOrg } from '@/server/queries/shared'
import { getCotizaciones, type CotizacionesData } from '@/server/queries/cotizaciones'

export type CotizacionResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const itemSchema = z.object({
  productId: z.uuid().nullable().default(null),
  description: z.string().trim().min(1, 'Cada línea necesita una descripción.').max(300),
  quantity: z.number().positive('La cantidad debe ser mayor que cero.').max(1_000_000),
  unitPriceCents: z.number().int().min(0, 'El precio no puede ser negativo.'),
})

const baseSchema = z.object({
  client: z.string().trim().min(2, 'El cliente es obligatorio.').max(160),
  contact: z.string().trim().max(160).default(''),
  projectId: z.uuid().nullable().default(null),
  ownerId: z.uuid().nullable().default(null),
  kind: z.enum(QUOTE_KINDS).default('Comercial'),
  probability: z.number().int().min(0).max(100).default(0),
  expiresOn: z.string().date().nullable().default(null),
  notes: z.string().trim().max(4000).default(''),
  items: z.array(itemSchema).max(100).default([]),
})

const updateSchema = baseSchema.extend({ id: z.uuid() })

/**
 * Replace the whole line set.
 *
 * Diffing individual lines against what the client thinks exists needs a
 * transaction to be safe, and PostgREST has none. Deleting and re-inserting is
 * correct as long as nothing else references a `quote_items.id` — nothing
 * does; the line is only ever read through its quote.
 */
async function replaceItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  quoteId: string,
  items: z.output<typeof itemSchema>[],
): Promise<boolean> {
  const { error: deleteError } = await supabase.from('quote_items').delete().eq('quote_id', quoteId)
  if (deleteError) {
    console.error('[cotizaciones] replaceItems delete', deleteError)
    return false
  }
  if (items.length === 0) return true

  const { error } = await supabase.from('quote_items').insert(
    items.map((item, position) => ({
      quote_id: quoteId,
      product_id: item.productId,
      description: item.description,
      quantity: item.quantity,
      unit_price_cents: item.unitPriceCents,
      position,
    })),
  )
  if (error) console.error('[cotizaciones] replaceItems insert', error)
  return !error
}

/** Both foreign keys must belong to *this* organization; RLS checks neither. */
async function refsValid(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  projectId: string | null,
  ownerId: string | null,
): Promise<string | null> {
  if (!(await belongsToOrg(supabase, 'projects', projectId, orgId))) {
    return 'Ese proyecto no pertenece a tu organización.'
  }
  if (!(await belongsToOrg(supabase, 'employees', ownerId, orgId))) {
    return 'Esa persona no está en el equipo de tu organización.'
  }
  return null
}

export async function createCotizacion(
  input: z.input<typeof baseSchema>,
): Promise<CotizacionResult<CotizacionesData>> {
  try {
    const member = await requirePermission('cotizaciones:write')
    const parsed = baseSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const refError = await refsValid(supabase, member.orgId, parsed.data.projectId, parsed.data.ownerId)
    if (refError) return fail(refError)

    const { data: quote, error } = await supabase
      .from('quotes')
      .insert({
        org_id: member.orgId,
        client: parsed.data.client,
        contact: parsed.data.contact,
        project_id: parsed.data.projectId,
        owner_id: parsed.data.ownerId,
        kind: parsed.data.kind,
        status: 'Borrador',
        probability: parsed.data.probability,
        expires_on: parsed.data.expiresOn,
        notes: parsed.data.notes,
      })
      .select('id')
      .single()

    if (error || !quote) {
      console.error('[cotizaciones] createCotizacion', error)
      return fail('No se pudo crear la cotización.')
    }

    if (!(await replaceItems(supabase, quote.id, parsed.data.items))) {
      return fail('La cotización se creó pero sus líneas no se guardaron.')
    }

    revalidatePath('/dashboard/cotizaciones')
    return { ok: true, data: await getCotizaciones() }
  } catch {
    return fail('No tienes permiso para gestionar cotizaciones.')
  }
}

export async function updateCotizacion(
  input: z.input<typeof updateSchema>,
): Promise<CotizacionResult<CotizacionesData>> {
  try {
    const member = await requirePermission('cotizaciones:write')
    const parsed = updateSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const refError = await refsValid(supabase, member.orgId, parsed.data.projectId, parsed.data.ownerId)
    if (refError) return fail(refError)

    const { error } = await supabase
      .from('quotes')
      .update({
        client: parsed.data.client,
        contact: parsed.data.contact,
        project_id: parsed.data.projectId,
        owner_id: parsed.data.ownerId,
        kind: parsed.data.kind,
        probability: parsed.data.probability,
        expires_on: parsed.data.expiresOn,
        notes: parsed.data.notes,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[cotizaciones] updateCotizacion', error)
      return fail('No se pudo actualizar la cotización.')
    }

    if (!(await replaceItems(supabase, parsed.data.id, parsed.data.items))) {
      return fail('No se pudieron guardar las líneas.')
    }

    revalidatePath('/dashboard/cotizaciones')
    return { ok: true, data: await getCotizaciones() }
  } catch {
    return fail('No tienes permiso para gestionar cotizaciones.')
  }
}

const statusSchema = z.object({ id: z.uuid(), status: z.enum(QUOTE_STATUSES) })

export async function setCotizacionStatus(
  input: z.input<typeof statusSchema>,
): Promise<CotizacionResult<CotizacionesData>> {
  try {
    const member = await requirePermission('cotizaciones:write')
    const parsed = statusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    // Probability follows the outcome: a quote that was accepted is not "60%
    // likely" any more, and the pipeline total would keep counting it.
    const probability =
      parsed.data.status === 'Aceptada' ? 100
        : parsed.data.status === 'Rechazada' || parsed.data.status === 'Vencida' ? 0
          : undefined

    const { error } = await supabase
      .from('quotes')
      .update(probability === undefined
        ? { status: parsed.data.status }
        : { status: parsed.data.status, probability })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[cotizaciones] setCotizacionStatus', error)
      return fail('No se pudo actualizar la cotización.')
    }

    revalidatePath('/dashboard/cotizaciones')
    return { ok: true, data: await getCotizaciones() }
  } catch {
    return fail('No tienes permiso para gestionar cotizaciones.')
  }
}

export async function deleteCotizacion(id: string): Promise<CotizacionResult<CotizacionesData>> {
  try {
    const member = await requirePermission('cotizaciones:write')
    if (!z.uuid().safeParse(id).success) return fail('Cotización desconocida.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('quotes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[cotizaciones] deleteCotizacion', error)
      return fail('No se pudo eliminar la cotización.')
    }

    revalidatePath('/dashboard/cotizaciones')
    return { ok: true, data: await getCotizaciones() }
  } catch {
    return fail('No tienes permiso para gestionar cotizaciones.')
  }
}
