'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { CLIENT_KINDS, CLIENT_STATUSES, INTERACTION_KINDS } from '@/lib/domain'
import { belongsToOrg } from '@/server/queries/shared'
import { getClientes, type ClientesData } from '@/server/queries/clientes'

export type ClientesResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

/**
 * The client must be this tenant's.
 *
 * `client_contacts` and `client_interactions` inherit RLS from the client, so
 * the policy only refuses rows whose parent is invisible — which surfaces as an
 * empty result, not an error, and would let the screen report success.
 */
async function clientBelongs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  orgId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('clients')
    .select('id')
    .eq('id', id)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()
  return Boolean(data)
}

/* ─── Clients ──────────────────────────────────────────────────────────── */

const clientSchema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre del cliente.').max(160),
  legalName: z.string().trim().max(200).default(''),
  taxId: z.string().trim().max(40).default(''),
  kind: z.enum(CLIENT_KINDS).default('Empresa'),
  industry: z.string().trim().max(120).default(''),
  email: z.email('Escribe un correo válido.').max(160).toLowerCase().nullable().default(null),
  phone: z.string().trim().max(40).default(''),
  address: z.string().trim().max(200).default(''),
  city: z.string().trim().max(120).default(''),
  ownerId: z.uuid().nullable().default(null),
  creditLimitCents: z.coerce.number().int().min(0).default(0),
  paymentTermsDays: z.coerce.number().int().min(0).max(365).default(0),
  notes: z.string().trim().max(2000).default(''),
})

export async function createCliente(
  input: z.input<typeof clientSchema>,
): Promise<ClientesResult<ClientesData>> {
  try {
    const member = await requirePermission('clientes:write')
    const parsed = clientSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    if (!(await belongsToOrg(supabase, 'employees', parsed.data.ownerId, member.orgId))) {
      return fail('Esa persona no está en el equipo de tu organización.')
    }

    const { error } = await supabase.from('clients').insert({
      org_id: member.orgId,
      name: parsed.data.name,
      legal_name: parsed.data.legalName,
      tax_id: parsed.data.taxId,
      kind: parsed.data.kind,
      status: 'Prospecto',
      industry: parsed.data.industry,
      email: parsed.data.email,
      phone: parsed.data.phone,
      address: parsed.data.address,
      city: parsed.data.city,
      owner_id: parsed.data.ownerId,
      credit_limit_cents: parsed.data.creditLimitCents,
      payment_terms_days: parsed.data.paymentTermsDays,
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[clientes] createCliente', error)
      return fail('No se pudo crear el cliente.')
    }

    revalidatePath('/dashboard/clientes')
    return { ok: true, data: await getClientes() }
  } catch {
    return fail('No tienes permiso para gestionar clientes.')
  }
}

const updateSchema = clientSchema.extend({ id: z.uuid() })

export async function updateCliente(
  input: z.input<typeof updateSchema>,
): Promise<ClientesResult<ClientesData>> {
  try {
    const member = await requirePermission('clientes:write')
    const parsed = updateSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    if (!(await belongsToOrg(supabase, 'employees', parsed.data.ownerId, member.orgId))) {
      return fail('Esa persona no está en el equipo de tu organización.')
    }

    const { error } = await supabase
      .from('clients')
      .update({
        name: parsed.data.name,
        legal_name: parsed.data.legalName,
        tax_id: parsed.data.taxId,
        kind: parsed.data.kind,
        industry: parsed.data.industry,
        email: parsed.data.email,
        phone: parsed.data.phone,
        address: parsed.data.address,
        city: parsed.data.city,
        owner_id: parsed.data.ownerId,
        credit_limit_cents: parsed.data.creditLimitCents,
        payment_terms_days: parsed.data.paymentTermsDays,
        notes: parsed.data.notes,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[clientes] updateCliente', error)
      return fail('No se pudo actualizar el cliente.')
    }

    revalidatePath('/dashboard/clientes')
    return { ok: true, data: await getClientes() }
  } catch {
    return fail('No tienes permiso para gestionar clientes.')
  }
}

const statusSchema = z.object({ id: z.uuid(), status: z.enum(CLIENT_STATUSES) })

export async function setClienteStatus(
  input: z.input<typeof statusSchema>,
): Promise<ClientesResult<ClientesData>> {
  try {
    const member = await requirePermission('clientes:write')
    const parsed = statusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('clients')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[clientes] setClienteStatus', error)
      return fail('No se pudo actualizar el cliente.')
    }

    revalidatePath('/dashboard/clientes')
    return { ok: true, data: await getClientes() }
  } catch {
    return fail('No tienes permiso para gestionar clientes.')
  }
}

export async function deleteCliente(id: string): Promise<ClientesResult<ClientesData>> {
  try {
    const member = await requirePermission('clientes:write')
    if (!z.uuid().safeParse(id).success) return fail('Cliente desconocido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('clients')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[clientes] deleteCliente', error)
      return fail('No se pudo eliminar el cliente.')
    }

    revalidatePath('/dashboard/clientes')
    return { ok: true, data: await getClientes() }
  } catch {
    return fail('No tienes permiso para gestionar clientes.')
  }
}

/* ─── Contacts ─────────────────────────────────────────────────────────── */

const contactSchema = z.object({
  clientId: z.uuid('Elige el cliente.'),
  fullName: z.string().trim().min(2, 'Escribe el nombre del contacto.').max(160),
  position: z.string().trim().max(120).default(''),
  email: z.email('Escribe un correo válido.').max(160).toLowerCase().nullable().default(null),
  phone: z.string().trim().max(40).default(''),
  isPrimary: z.boolean().default(false),
})

export async function addContacto(
  input: z.input<typeof contactSchema>,
): Promise<ClientesResult<ClientesData>> {
  try {
    const member = await requirePermission('clientes:write')
    const parsed = contactSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    if (!(await clientBelongs(supabase, parsed.data.clientId, member.orgId))) {
      return fail('Ese cliente no existe en tu organización.')
    }

    // `client_contacts_primary_key` is a partial unique index: at most one
    // primary contact per client. Demoting the incumbent first is what turns
    // "make this the main contact" into an action rather than an error.
    if (parsed.data.isPrimary) {
      await supabase
        .from('client_contacts')
        .update({ is_primary: false })
        .eq('client_id', parsed.data.clientId)
        .eq('is_primary', true)
    }

    const { error } = await supabase.from('client_contacts').insert({
      client_id: parsed.data.clientId,
      full_name: parsed.data.fullName,
      position: parsed.data.position,
      email: parsed.data.email,
      phone: parsed.data.phone,
      is_primary: parsed.data.isPrimary,
    })

    if (error) {
      console.error('[clientes] addContacto', error)
      return fail('No se pudo agregar el contacto.')
    }

    revalidatePath('/dashboard/clientes')
    return { ok: true, data: await getClientes() }
  } catch {
    return fail('No tienes permiso para gestionar clientes.')
  }
}

export async function deleteContacto(id: string): Promise<ClientesResult<ClientesData>> {
  try {
    const member = await requirePermission('clientes:write')
    if (!z.uuid().safeParse(id).success) return fail('Contacto desconocido.')

    const supabase = await createClient()
    const { data: owned } = await supabase
      .from('client_contacts')
      .select('id, clients!inner ( org_id )')
      .eq('id', id)
      .eq('clients.org_id', member.orgId)
      .maybeSingle()

    if (!owned) return fail('Ese contacto no existe en tu organización.')

    const { error } = await supabase.from('client_contacts').delete().eq('id', id)

    if (error) {
      console.error('[clientes] deleteContacto', error)
      return fail('No se pudo eliminar el contacto.')
    }

    revalidatePath('/dashboard/clientes')
    return { ok: true, data: await getClientes() }
  } catch {
    return fail('No tienes permiso para gestionar clientes.')
  }
}

/* ─── Interactions ─────────────────────────────────────────────────────── */

const interactionSchema = z.object({
  clientId: z.uuid('Elige el cliente.'),
  kind: z.enum(INTERACTION_KINDS).default('Nota'),
  subject: z.string().trim().max(200).default(''),
  detail: z.string().trim().max(4000).default(''),
  employeeId: z.uuid().nullable().default(null),
  followUpOn: z.string().date().nullable().default(null),
})

export async function logInteraccion(
  input: z.input<typeof interactionSchema>,
): Promise<ClientesResult<ClientesData>> {
  try {
    const member = await requirePermission('clientes:write')
    const parsed = interactionSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const [clientOk, employeeOk] = await Promise.all([
      clientBelongs(supabase, parsed.data.clientId, member.orgId),
      belongsToOrg(supabase, 'employees', parsed.data.employeeId, member.orgId),
    ])

    if (!clientOk) return fail('Ese cliente no existe en tu organización.')
    if (!employeeOk) return fail('Esa persona no está en el equipo de tu organización.')

    const { error } = await supabase.from('client_interactions').insert({
      client_id: parsed.data.clientId,
      kind: parsed.data.kind,
      subject: parsed.data.subject,
      detail: parsed.data.detail,
      employee_id: parsed.data.employeeId,
      follow_up_on: parsed.data.followUpOn,
    })

    if (error) {
      console.error('[clientes] logInteraccion', error)
      return fail('No se pudo registrar la interacción.')
    }

    revalidatePath('/dashboard/clientes')
    return { ok: true, data: await getClientes() }
  } catch {
    return fail('No tienes permiso para gestionar clientes.')
  }
}
