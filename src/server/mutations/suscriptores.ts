'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import type { Supabase } from '@/server/queries/shared'
import { getSuscriptores, type SuscriptoresData } from '@/server/queries/suscriptores'

export type SuscriptoresResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const DENIED = 'No tienes permiso para gestionar los suscriptores.'

async function refreshed(): Promise<SuscriptoresResult<SuscriptoresData>> {
  revalidatePath('/dashboard/suscriptores')
  return { ok: true, data: await getSuscriptores() }
}

/**
 * Rechaza un FK que no es una fila viva de *esta* organización. RLS sobre
 * `subscribers` mira el `org_id` de la fila, no lo que la fila señala.
 *
 * No usa el `belongsToOrg` compartido: ese exige `deleted_at`, y un plan no se
 * borra suave — se elimina de verdad, y su suscriptor sobrevive con
 * `on delete set null`.
 */
async function planInOrg(
  supabase: Supabase,
  planId: string | null,
  orgId: string,
): Promise<boolean> {
  if (!planId) return true
  const { data } = await supabase
    .from('service_plans')
    .select('id')
    .eq('id', planId)
    .eq('org_id', orgId)
    .maybeSingle()
  return Boolean(data)
}

async function clientInOrg(
  supabase: Supabase,
  clientId: string | null,
  orgId: string,
): Promise<boolean> {
  if (!clientId) return true
  const { data } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()
  return Boolean(data)
}

/* ─── Planes ───────────────────────────────────────────────────────────── */

const addPlanSchema = z.object({
  name: z.string().trim().min(2).max(80),
  priceCents: z.coerce.number().int().min(0).max(1_000_000_000_00),
  description: z.string().trim().max(300).default(''),
})

/**
 * Crea una oferta de servicio.
 *
 * El plan es de la organización y nada más: se inserta con su `org_id`, y el
 * precio viaja en centavos para no perder precisión en decimales.
 */
export async function addPlan(
  input: z.input<typeof addPlanSchema>,
): Promise<SuscriptoresResult<SuscriptoresData>> {
  try {
    const member = await requirePermission('suscriptores:write')
    const parsed = addPlanSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    const { error } = await supabase.from('service_plans').insert({
      org_id: member.orgId,
      name: parsed.data.name,
      price_cents: parsed.data.priceCents,
      description: parsed.data.description,
    })

    if (error) {
      console.error('[suscriptores] addPlan', error)
      return fail('No se pudo crear el plan.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deletePlan(id: string): Promise<SuscriptoresResult<SuscriptoresData>> {
  try {
    const member = await requirePermission('suscriptores:write')
    if (!z.uuid().safeParse(id).success) return fail('Plan inválido.')

    const supabase = await createClient()
    // Borrado real, no suave: una oferta mal tecleada no es historia que
    // preservar. Los suscriptores del plan sobreviven con `on delete set
    // null`. `org_id` va explícito para que nadie pueda borrar por id lo que
    // no es de su empresa.
    const { error } = await supabase
      .from('service_plans')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[suscriptores] deletePlan', error)
      return fail('No se pudo eliminar el plan.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/* ─── Suscriptores ─────────────────────────────────────────────────────── */

const addSubscriberSchema = z.object({
  planId: z.string().uuid().nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().max(200).default(''),
  phone: z.string().trim().max(30).default(''),
  activatedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(500).default(''),
})

/**
 * Abre un suscriptor nuevo. Nace activo: se suspende o cancela, no se borra
 * la fila salvo que se elimine a mano.
 *
 * Plan y cliente son opcionales — hay servicios sin plan asignado y sin ficha
 * comercial —, y cuando vienen se validan contra *esta* organización: RLS
 * sobre `subscribers` mira el `org_id` de la fila, no lo que la fila señala.
 */
export async function addSubscriber(
  input: z.input<typeof addSubscriberSchema>,
): Promise<SuscriptoresResult<SuscriptoresData>> {
  try {
    const member = await requirePermission('suscriptores:write')
    const parsed = addSubscriberSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    if (!(await planInOrg(supabase, parsed.data.planId ?? null, member.orgId))) {
      return fail('Ese plan no pertenece a tu organización.')
    }
    if (!(await clientInOrg(supabase, parsed.data.clientId ?? null, member.orgId))) {
      return fail('Ese cliente no pertenece a tu organización.')
    }

    const { error } = await supabase.from('subscribers').insert({
      org_id: member.orgId,
      plan_id: parsed.data.planId ?? null,
      client_id: parsed.data.clientId ?? null,
      name: parsed.data.name,
      address: parsed.data.address || null,
      phone: parsed.data.phone || null,
      status: 'activo',
      activated_on: parsed.data.activatedOn,
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[suscriptores] addSubscriber', error)
      return fail('No se pudo crear el suscriptor.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function setSubscriberStatus(
  id: string,
  status: string,
): Promise<SuscriptoresResult<SuscriptoresData>> {
  try {
    const member = await requirePermission('suscriptores:write')
    if (!z.uuid().safeParse(id).success) return fail('Suscriptor inválido.')
    const parsedStatus = z.enum(['activo', 'suspendido', 'cancelado']).safeParse(status)
    if (!parsedStatus.success) return fail('Estado inválido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('subscribers')
      .update({ status: parsedStatus.data })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[suscriptores] setSubscriberStatus', error)
      return fail('No se pudo cambiar el estado.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deleteSubscriber(
  id: string,
): Promise<SuscriptoresResult<SuscriptoresData>> {
  try {
    const member = await requirePermission('suscriptores:write')
    if (!z.uuid().safeParse(id).success) return fail('Suscriptor inválido.')

    const supabase = await createClient()
    // Borrado real, no suave: un suscriptor mal tecleado no es historia que
    // preservar. `org_id` va explícito para que nadie pueda borrar por id lo
    // que no es de su empresa.
    const { error } = await supabase
      .from('subscribers')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[suscriptores] deleteSubscriber', error)
      return fail('No se pudo eliminar el suscriptor.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}
