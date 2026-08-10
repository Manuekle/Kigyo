'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { CONTRACT_KINDS, CONTRACT_STATUSES } from '@/lib/domain'
import { belongsToOrg } from '@/server/queries/shared'
import { getContratos, type ContratosData } from '@/server/queries/contratos'

export type ContratosResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

/** `clients` is not in `belongsToOrg`'s table union, so it gets its own check. */
async function clientBelongs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string | null,
  orgId: string,
): Promise<boolean> {
  if (!id) return true
  const { data } = await supabase
    .from('clients')
    .select('id')
    .eq('id', id)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()
  return Boolean(data)
}

const contractSchema = z.object({
  title: z.string().trim().min(3, 'Escribe el nombre del contrato.').max(200),
  kind: z.enum(CONTRACT_KINDS).default('Cliente'),
  counterparty: z.string().trim().max(200).default(''),
  clientId: z.uuid().nullable().default(null),
  employeeId: z.uuid().nullable().default(null),
  ownerId: z.uuid().nullable().default(null),
  valueCents: z.coerce.number().int().min(0).default(0),
  startsOn: z.string().date().nullable().default(null),
  endsOn: z.string().date().nullable().default(null),
  noticeDays: z.coerce.number().int().min(0).max(365).default(30),
  autoRenew: z.boolean().default(false),
  notes: z.string().trim().max(2000).default(''),
})

export async function createContrato(
  input: z.input<typeof contractSchema>,
): Promise<ContratosResult<ContratosData>> {
  try {
    const member = await requirePermission('contratos:write')
    const parsed = contractSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    if (parsed.data.startsOn && parsed.data.endsOn && parsed.data.endsOn < parsed.data.startsOn) {
      return fail('La fecha de terminación no puede ser anterior a la de inicio.')
    }

    const supabase = await createClient()
    const [clientOk, employeeOk, ownerOk] = await Promise.all([
      clientBelongs(supabase, parsed.data.clientId, member.orgId),
      belongsToOrg(supabase, 'employees', parsed.data.employeeId, member.orgId),
      belongsToOrg(supabase, 'employees', parsed.data.ownerId, member.orgId),
    ])

    if (!clientOk) return fail('Ese cliente no existe en tu organización.')
    if (!employeeOk || !ownerOk) {
      return fail('Esa persona no está en el equipo de tu organización.')
    }

    const { error } = await supabase.from('contracts').insert({
      org_id: member.orgId,
      title: parsed.data.title,
      kind: parsed.data.kind,
      // A contract with a start date has started; one without is still being
      // drafted. Asking for the status separately is asking the same question
      // twice and inviting the two answers to disagree.
      status: parsed.data.startsOn ? 'Vigente' : 'Borrador',
      counterparty: parsed.data.counterparty,
      client_id: parsed.data.clientId,
      employee_id: parsed.data.employeeId,
      owner_id: parsed.data.ownerId,
      value_cents: parsed.data.valueCents,
      starts_on: parsed.data.startsOn,
      ends_on: parsed.data.endsOn,
      notice_days: parsed.data.noticeDays,
      auto_renew: parsed.data.autoRenew,
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[contratos] createContrato', error)
      return fail('No se pudo crear el contrato.')
    }

    revalidatePath('/dashboard/contratos')
    return { ok: true, data: await getContratos() }
  } catch {
    return fail('No tienes permiso para gestionar contratos.')
  }
}

const statusSchema = z.object({ id: z.uuid(), status: z.enum(CONTRACT_STATUSES) })

export async function setContratoStatus(
  input: z.input<typeof statusSchema>,
): Promise<ContratosResult<ContratosData>> {
  try {
    const member = await requirePermission('contratos:write')
    const parsed = statusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('contracts')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[contratos] setContratoStatus', error)
      return fail('No se pudo actualizar el contrato.')
    }

    revalidatePath('/dashboard/contratos')
    return { ok: true, data: await getContratos() }
  } catch {
    return fail('No tienes permiso para gestionar contratos.')
  }
}

const renewSchema = z.object({ id: z.uuid(), endsOn: z.string().date() })

/**
 * Extends a contract's term.
 *
 * A renewal is the reason the expiry list exists, so it is one action rather
 * than "edit the contract and change a date". Moving the end date also clears
 * "Por vencer" — which is derived at read time, so nothing else has to change.
 */
export async function renovarContrato(
  input: z.input<typeof renewSchema>,
): Promise<ContratosResult<ContratosData>> {
  try {
    const member = await requirePermission('contratos:write')
    const parsed = renewSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { data: current } = await supabase
      .from('contracts')
      .select('id, starts_on')
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!current) return fail('Ese contrato no existe en tu organización.')
    if (current.starts_on && parsed.data.endsOn < current.starts_on) {
      return fail('La nueva fecha no puede ser anterior al inicio del contrato.')
    }

    const { error } = await supabase
      .from('contracts')
      .update({ ends_on: parsed.data.endsOn, status: 'Vigente' })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[contratos] renovarContrato', error)
      return fail('No se pudo renovar el contrato.')
    }

    revalidatePath('/dashboard/contratos')
    return { ok: true, data: await getContratos() }
  } catch {
    return fail('No tienes permiso para gestionar contratos.')
  }
}

export async function deleteContrato(id: string): Promise<ContratosResult<ContratosData>> {
  try {
    const member = await requirePermission('contratos:write')
    if (!z.uuid().safeParse(id).success) return fail('Contrato desconocido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('contracts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[contratos] deleteContrato', error)
      return fail('No se pudo eliminar el contrato.')
    }

    revalidatePath('/dashboard/contratos')
    return { ok: true, data: await getContratos() }
  } catch {
    return fail('No tienes permiso para gestionar contratos.')
  }
}

/* ─── Milestones ───────────────────────────────────────────────────────── */

const milestoneSchema = z.object({
  contractId: z.uuid(),
  title: z.string().trim().min(2, 'Escribe el hito.').max(200),
  dueOn: z.string().date().nullable().default(null),
  amountCents: z.coerce.number().int().min(0).default(0),
  position: z.coerce.number().int().min(0).max(999).default(0),
})

export async function addHito(
  input: z.input<typeof milestoneSchema>,
): Promise<ContratosResult<ContratosData>> {
  try {
    const member = await requirePermission('contratos:write')
    const parsed = milestoneSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    // `contract_milestones` inherits RLS from the contract, so the id has to be
    // checked against this tenant explicitly.
    const { data: contract } = await supabase
      .from('contracts')
      .select('id')
      .eq('id', parsed.data.contractId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!contract) return fail('Ese contrato no existe en tu organización.')

    const { error } = await supabase.from('contract_milestones').insert({
      contract_id: parsed.data.contractId,
      title: parsed.data.title,
      due_on: parsed.data.dueOn,
      amount_cents: parsed.data.amountCents,
      position: parsed.data.position,
    })

    if (error) {
      console.error('[contratos] addHito', error)
      return fail('No se pudo agregar el hito.')
    }

    revalidatePath('/dashboard/contratos')
    return { ok: true, data: await getContratos() }
  } catch {
    return fail('No tienes permiso para gestionar contratos.')
  }
}

const milestoneDoneSchema = z.object({ id: z.uuid(), done: z.boolean() })

export async function setHitoDone(
  input: z.input<typeof milestoneDoneSchema>,
): Promise<ContratosResult<ContratosData>> {
  try {
    const member = await requirePermission('contratos:write')
    const parsed = milestoneDoneSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { data: owned } = await supabase
      .from('contract_milestones')
      .select('id, contracts!inner ( org_id )')
      .eq('id', parsed.data.id)
      .eq('contracts.org_id', member.orgId)
      .maybeSingle()

    if (!owned) return fail('Ese hito no existe en tu organización.')

    const { error } = await supabase
      .from('contract_milestones')
      .update({ completed_at: parsed.data.done ? new Date().toISOString() : null })
      .eq('id', parsed.data.id)

    if (error) {
      console.error('[contratos] setHitoDone', error)
      return fail('No se pudo actualizar el hito.')
    }

    revalidatePath('/dashboard/contratos')
    return { ok: true, data: await getContratos() }
  } catch {
    return fail('No tienes permiso para gestionar contratos.')
  }
}
