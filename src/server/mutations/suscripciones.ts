'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import type { Supabase } from '@/server/queries/shared'
import { getSuscripciones, type SuscripcionesData } from '@/server/queries/suscripciones'

export type SusResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const DENIED = 'No tienes permiso para gestionar las suscripciones.'

async function refreshed(): Promise<SusResult<SuscripcionesData>> {
  revalidatePath('/dashboard/suscripciones')
  return { ok: true, data: await getSuscripciones() }
}

/**
 * Rechaza un FK que no es una fila viva de *esta* organización. RLS sobre
 * `subscriptions` mira el `org_id` de la fila, no lo que la fila señala.
 *
 * No usa el `belongsToOrg` compartido: ese exige `deleted_at`, y un plan no se
 * borra suave — se elimina de verdad, y su suscripción sobrevive con
 * `on delete set null`.
 */
async function planInOrg(supabase: Supabase, planId: string | null, orgId: string): Promise<boolean> {
  if (!planId) return true
  const { data } = await supabase
    .from('subscription_plans')
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
  priceCents: z.coerce.number().int().min(0).max(1_000_000_000),
  cycle: z.enum(['diario', 'semanal', 'mensual', 'trimestral', 'semestral', 'anual']).default('mensual'),
  description: z.string().trim().max(500).default(''),
})

/**
 * Crea una tarifa de cobro recurrente.
 *
 * El plan es de la organización y nada más: se inserta con su `org_id`, y el
 * ciclo queda fijo entre los seis que la pantalla ofrece.
 */
export async function addPlan(
  input: z.input<typeof addPlanSchema>,
): Promise<SusResult<SuscripcionesData>> {
  try {
    const member = await requirePermission('suscripciones:write')
    const parsed = addPlanSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    const { error } = await supabase.from('subscription_plans').insert({
      org_id: member.orgId,
      name: parsed.data.name,
      price_cents: parsed.data.priceCents,
      cycle: parsed.data.cycle,
      description: parsed.data.description,
    })

    if (error) {
      console.error('[suscripciones] addPlan', error)
      return fail('No se pudo crear el plan.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deletePlan(planId: string): Promise<SusResult<SuscripcionesData>> {
  try {
    const member = await requirePermission('suscripciones:write')
    if (!z.uuid().safeParse(planId).success) return fail('Plan inválido.')

    const supabase = await createClient()
    // Borrado real, no suave: una tarifa mal tecleada no es historia que
    // preservar. Las suscripciones del plan sobreviven con `on delete set
    // null` y su precio congelado. `org_id` va explícito para que nadie pueda
    // borrar por id lo que no es de su empresa.
    const { error } = await supabase
      .from('subscription_plans')
      .delete()
      .eq('id', planId)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[suscripciones] deletePlan', error)
      return fail('No se pudo eliminar el plan.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/* ─── Suscripciones ────────────────────────────────────────────────────── */

const addSubSchema = z.object({
  planId: z.string().uuid().nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  startedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  nextChargeOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  priceCents: z.preprocess(
    (v) => (v === '' ? null : v),
    z.coerce.number().int().min(0).max(1_000_000_000).nullable().optional(),
  ),
  notes: z.string().trim().max(500).default(''),
})

/**
 * Apunta un cliente a un plan.
 *
 * Plan y cliente son opcionales — hay cobros sin plan todavía y sin cliente
 * asignado —, y cuando vienen se validan contra *esta* organización: RLS
 * sobre `subscriptions` mira el `org_id` de la fila, no lo que la fila
 * señala. El precio vacío queda en null y hereda el del plan.
 */
export async function addSub(
  input: z.input<typeof addSubSchema>,
): Promise<SusResult<SuscripcionesData>> {
  try {
    const member = await requirePermission('suscripciones:write')
    const parsed = addSubSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    if (!(await planInOrg(supabase, parsed.data.planId ?? null, member.orgId))) {
      return fail('Ese plan no pertenece a tu organización.')
    }
    if (!(await clientInOrg(supabase, parsed.data.clientId ?? null, member.orgId))) {
      return fail('Ese cliente no pertenece a tu organización.')
    }

    const { error } = await supabase.from('subscriptions').insert({
      org_id: member.orgId,
      plan_id: parsed.data.planId ?? null,
      client_id: parsed.data.clientId ?? null,
      status: 'activa',
      started_on: parsed.data.startedOn,
      next_charge_on: parsed.data.nextChargeOn ?? null,
      price_cents: parsed.data.priceCents ?? null,
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[suscripciones] addSub', error)
      return fail('No se pudo crear la suscripción.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

const SUB_STATUS = ['activa', 'suspendida', 'cancelada', 'vencida'] as const

export async function setSubStatus(
  subId: string,
  status: string,
): Promise<SusResult<SuscripcionesData>> {
  try {
    const member = await requirePermission('suscripciones:write')
    if (!z.uuid().safeParse(subId).success) return fail('Suscripción inválida.')
    const parsedStatus = z.enum(SUB_STATUS).safeParse(status)
    if (!parsedStatus.success) return fail('Estado inválido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('subscriptions')
      .update({ status: parsedStatus.data })
      .eq('id', subId)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[suscripciones] setSubStatus', error)
      return fail('No se pudo cambiar el estado.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function deleteSub(subId: string): Promise<SusResult<SuscripcionesData>> {
  try {
    const member = await requirePermission('suscripciones:write')
    if (!z.uuid().safeParse(subId).success) return fail('Suscripción inválida.')

    const supabase = await createClient()
    // Borrado real, no suave: una suscripción mal tecleada no es historia que
    // preservar. `org_id` va explícito para que nadie pueda borrar por id lo
    // que no es de su empresa.
    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .eq('id', subId)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[suscripciones] deleteSub', error)
      return fail('No se pudo eliminar la suscripción.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}
