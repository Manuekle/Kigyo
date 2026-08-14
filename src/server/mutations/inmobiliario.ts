'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import {
  LEASE_STATUSES, PAYMENT_METHODS, PROPERTY_KINDS, PROPERTY_STATUSES,
} from '@/lib/domain'
import { getInmobiliario, type InmobiliarioData } from '@/server/queries/inmobiliario'

export type InmobiliarioResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

/* ─── Properties ───────────────────────────────────────────────────────── */

const propertySchema = z.object({
  name: z.string().trim().min(2, 'Ponle nombre al inmueble.').max(160),
  kind: z.enum(PROPERTY_KINDS).default('Apartamento'),
  address: z.string().trim().max(200).default(''),
  city: z.string().trim().max(120).default(''),
  areaM2: z.coerce.number().min(0).max(1e7).nullable().default(null),
  bedrooms: z.coerce.number().int().min(0).max(99).nullable().default(null),
  bathrooms: z.coerce.number().int().min(0).max(99).nullable().default(null),
  parkingSpots: z.coerce.number().int().min(0).max(99).nullable().default(null),
  rentCents: z.coerce.number().int().min(0).default(0),
  adminFeeCents: z.coerce.number().int().min(0).default(0),
  salePriceCents: z.coerce.number().int().min(0).default(0),
  ownerName: z.string().trim().max(160).default(''),
  notes: z.string().trim().max(1000).default(''),
})

export async function createInmueble(
  input: z.input<typeof propertySchema>,
): Promise<InmobiliarioResult<InmobiliarioData>> {
  try {
    const member = await requirePermission('inmobiliario:write')
    const parsed = propertySchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase.from('properties').insert({
      org_id: member.orgId,
      name: parsed.data.name,
      kind: parsed.data.kind,
      address: parsed.data.address,
      city: parsed.data.city,
      area_m2: parsed.data.areaM2,
      bedrooms: parsed.data.bedrooms,
      bathrooms: parsed.data.bathrooms,
      parking_spots: parsed.data.parkingSpots,
      rent_cents: parsed.data.rentCents,
      admin_fee_cents: parsed.data.adminFeeCents,
      sale_price_cents: parsed.data.salePriceCents,
      owner_name: parsed.data.ownerName,
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[inmobiliario] createInmueble', error)
      return fail('No se pudo crear el inmueble.')
    }

    revalidatePath('/dashboard/inmobiliario')
    return { ok: true, data: await getInmobiliario() }
  } catch {
    return fail('No tienes permiso para gestionar inmuebles.')
  }
}

const propertyUpdateSchema = propertySchema.extend({ id: z.uuid() })

export async function updateInmueble(
  input: z.input<typeof propertyUpdateSchema>,
): Promise<InmobiliarioResult<InmobiliarioData>> {
  try {
    const member = await requirePermission('inmobiliario:write')
    const parsed = propertyUpdateSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('properties')
      .update({
        name: parsed.data.name,
        kind: parsed.data.kind,
        address: parsed.data.address,
        city: parsed.data.city,
        area_m2: parsed.data.areaM2,
        bedrooms: parsed.data.bedrooms,
        bathrooms: parsed.data.bathrooms,
        parking_spots: parsed.data.parkingSpots,
        rent_cents: parsed.data.rentCents,
        admin_fee_cents: parsed.data.adminFeeCents,
        sale_price_cents: parsed.data.salePriceCents,
        owner_name: parsed.data.ownerName,
        notes: parsed.data.notes,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[inmobiliario] updateInmueble', error)
      return fail('No se pudo actualizar el inmueble.')
    }

    revalidatePath('/dashboard/inmobiliario')
    return { ok: true, data: await getInmobiliario() }
  } catch {
    return fail('No tienes permiso para gestionar inmuebles.')
  }
}

const propertyStatusSchema = z.object({ id: z.uuid(), status: z.enum(PROPERTY_STATUSES) })

export async function setInmuebleStatus(
  input: z.input<typeof propertyStatusSchema>,
): Promise<InmobiliarioResult<InmobiliarioData>> {
  try {
    const member = await requirePermission('inmobiliario:write')
    const parsed = propertyStatusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('properties')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[inmobiliario] setInmuebleStatus', error)
      return fail('No se pudo actualizar el inmueble.')
    }

    revalidatePath('/dashboard/inmobiliario')
    return { ok: true, data: await getInmobiliario() }
  } catch {
    return fail('No tienes permiso para gestionar inmuebles.')
  }
}

export async function deleteInmueble(id: string): Promise<InmobiliarioResult<InmobiliarioData>> {
  try {
    const member = await requirePermission('inmobiliario:write')
    if (!z.uuid().safeParse(id).success) return fail('Inmueble desconocido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('properties')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[inmobiliario] deleteInmueble', error)
      return fail('No se pudo eliminar el inmueble.')
    }

    revalidatePath('/dashboard/inmobiliario')
    return { ok: true, data: await getInmobiliario() }
  } catch {
    return fail('No tienes permiso para gestionar inmuebles.')
  }
}

/* ─── Leases ───────────────────────────────────────────────────────────── */

const leaseSchema = z.object({
  propertyId: z.uuid('Elige el inmueble.'),
  tenantName: z.string().trim().min(2, 'Escribe el nombre del inquilino.').max(160),
  tenantDocument: z.string().trim().max(40).default(''),
  tenantEmail: z.email('Escribe un correo válido.').max(160).toLowerCase().nullable().default(null),
  tenantPhone: z.string().trim().max(40).default(''),
  rentCents: z.coerce.number().int().min(0).default(0),
  depositCents: z.coerce.number().int().min(0).default(0),
  dueDay: z.coerce.number().int().min(1).max(28).default(5),
  startsOn: z.string().date(),
  endsOn: z.string().date().nullable().default(null),
  notes: z.string().trim().max(1000).default(''),
})

export async function createContratoArriendo(
  input: z.input<typeof leaseSchema>,
): Promise<InmobiliarioResult<InmobiliarioData>> {
  try {
    const member = await requirePermission('inmobiliario:write')
    const parsed = leaseSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    if (parsed.data.endsOn && parsed.data.endsOn < parsed.data.startsOn) {
      return fail('La fecha de terminación no puede ser anterior al inicio.')
    }

    const supabase = await createClient()
    const { data: property } = await supabase
      .from('properties')
      .select('id')
      .eq('id', parsed.data.propertyId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!property) return fail('Ese inmueble no existe en tu organización.')

    // A property cannot be let twice at once. Checked here rather than by
    // constraint, because a lease that ended and one that starts tomorrow are
    // both valid rows against the same property.
    const { data: existing } = await supabase
      .from('leases')
      .select('id')
      .eq('property_id', parsed.data.propertyId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .neq('status', 'Terminado')
      .maybeSingle()

    if (existing) return fail('Ese inmueble ya tiene un contrato de arriendo vigente.')

    const { error } = await supabase.from('leases').insert({
      org_id: member.orgId,
      property_id: parsed.data.propertyId,
      tenant_name: parsed.data.tenantName,
      tenant_document: parsed.data.tenantDocument,
      tenant_email: parsed.data.tenantEmail,
      tenant_phone: parsed.data.tenantPhone,
      status: 'Activo',
      rent_cents: parsed.data.rentCents,
      deposit_cents: parsed.data.depositCents,
      due_day: parsed.data.dueDay,
      starts_on: parsed.data.startsOn,
      ends_on: parsed.data.endsOn,
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[inmobiliario] createContratoArriendo', error)
      return fail('No se pudo crear el contrato de arriendo.')
    }

    // The property follows its lease, so the availability list is never a
    // separate thing someone has to remember to update.
    await supabase
      .from('properties')
      .update({ status: 'Arrendado' })
      .eq('id', parsed.data.propertyId)
      .eq('org_id', member.orgId)

    revalidatePath('/dashboard/inmobiliario')
    return { ok: true, data: await getInmobiliario() }
  } catch {
    return fail('No tienes permiso para gestionar inmuebles.')
  }
}

const leaseUpdateSchema = leaseSchema.extend({ id: z.uuid() })

export async function updateContratoArriendo(
  input: z.input<typeof leaseUpdateSchema>,
): Promise<InmobiliarioResult<InmobiliarioData>> {
  try {
    const member = await requirePermission('inmobiliario:write')
    const parsed = leaseUpdateSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    if (parsed.data.endsOn && parsed.data.endsOn < parsed.data.startsOn) {
      return fail('La fecha de terminación no puede ser anterior al inicio.')
    }

    const supabase = await createClient()
    const { data: lease } = await supabase
      .from('leases')
      .select('id, property_id')
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!lease) return fail('Ese contrato no existe en tu organización.')

    const { data: property } = await supabase
      .from('properties')
      .select('id')
      .eq('id', parsed.data.propertyId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!property) return fail('Ese inmueble no existe en tu organización.')

    // The lease being edited is excluded, so an untouched property still
    // passes: the conflict is another contract on the same property.
    const { data: existing } = await supabase
      .from('leases')
      .select('id')
      .eq('property_id', parsed.data.propertyId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .neq('id', parsed.data.id)
      .neq('status', 'Terminado')
      .maybeSingle()

    if (existing) return fail('Ese inmueble ya tiene un contrato de arriendo vigente.')

    const { error } = await supabase
      .from('leases')
      .update({
        property_id: parsed.data.propertyId,
        tenant_name: parsed.data.tenantName,
        tenant_document: parsed.data.tenantDocument,
        tenant_email: parsed.data.tenantEmail,
        tenant_phone: parsed.data.tenantPhone,
        rent_cents: parsed.data.rentCents,
        deposit_cents: parsed.data.depositCents,
        due_day: parsed.data.dueDay,
        starts_on: parsed.data.startsOn,
        ends_on: parsed.data.endsOn,
        notes: parsed.data.notes,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[inmobiliario] updateContratoArriendo', error)
      return fail('No se pudo actualizar el contrato.')
    }

    // The property follows its lease, as on create: a moved contract leaves
    // the old property available and marks the new one as rented.
    if (lease.property_id !== parsed.data.propertyId) {
      await supabase
        .from('properties')
        .update({ status: 'Arrendado' })
        .eq('id', parsed.data.propertyId)
        .eq('org_id', member.orgId)

      const { data: others } = await supabase
        .from('leases')
        .select('id')
        .eq('property_id', lease.property_id)
        .eq('org_id', member.orgId)
        .is('deleted_at', null)
        .neq('id', parsed.data.id)
        .neq('status', 'Terminado')
        .maybeSingle()

      if (!others) {
        await supabase
          .from('properties')
          .update({ status: 'Disponible' })
          .eq('id', lease.property_id)
          .eq('org_id', member.orgId)
      }
    }

    revalidatePath('/dashboard/inmobiliario')
    return { ok: true, data: await getInmobiliario() }
  } catch {
    return fail('No tienes permiso para gestionar inmuebles.')
  }
}

const leaseStatusSchema = z.object({ id: z.uuid(), status: z.enum(LEASE_STATUSES) })

export async function setContratoArriendoStatus(
  input: z.input<typeof leaseStatusSchema>,
): Promise<InmobiliarioResult<InmobiliarioData>> {
  try {
    const member = await requirePermission('inmobiliario:write')
    const parsed = leaseStatusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { data: lease } = await supabase
      .from('leases')
      .select('id, property_id')
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!lease) return fail('Ese contrato no existe en tu organización.')

    const { error } = await supabase
      .from('leases')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[inmobiliario] setContratoArriendoStatus', error)
      return fail('No se pudo actualizar el contrato.')
    }

    // Ending a lease frees the property for the next tenant.
    if (parsed.data.status === 'Terminado') {
      await supabase
        .from('properties')
        .update({ status: 'Disponible' })
        .eq('id', lease.property_id)
        .eq('org_id', member.orgId)
    }

    revalidatePath('/dashboard/inmobiliario')
    return { ok: true, data: await getInmobiliario() }
  } catch {
    return fail('No tienes permiso para gestionar inmuebles.')
  }
}

/* ─── Rent ─────────────────────────────────────────────────────────────── */

const paymentSchema = z.object({
  leaseId: z.uuid('Elige el contrato.'),
  period: z.string().trim().regex(/^\d{4}-\d{2}$/, 'El periodo es AAAA-MM.'),
  amountCents: z.coerce.number().int().min(0).default(0),
  paidCents: z.coerce.number().int().min(0).default(0),
  method: z.enum(PAYMENT_METHODS).default('Transferencia'),
  reference: z.string().trim().max(120).default(''),
})

/**
 * Records the rent for a period, or updates what has been paid against it.
 *
 * Upsert rather than insert: the row for a month is created when the rent falls
 * due and amended when money arrives, and `unique (lease_id, period)` is what
 * keeps that a single row. Inserting instead would raise a constraint error on
 * the second, entirely normal, action.
 */
export async function registrarArriendo(
  input: z.input<typeof paymentSchema>,
): Promise<InmobiliarioResult<InmobiliarioData>> {
  try {
    const member = await requirePermission('inmobiliario:write')
    const parsed = paymentSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    if (parsed.data.paidCents > parsed.data.amountCents && parsed.data.amountCents > 0) {
      return fail('Lo pagado no puede superar el canon del periodo.')
    }

    const supabase = await createClient()
    const { data: lease } = await supabase
      .from('leases')
      .select('id, rent_cents, due_day')
      .eq('id', parsed.data.leaseId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!lease) return fail('Ese contrato no existe en tu organización.')

    // Defaults to the lease's own rent, so the common case is one field.
    const amount = parsed.data.amountCents > 0 ? parsed.data.amountCents : lease.rent_cents
    const dueOn = `${parsed.data.period}-${String(lease.due_day).padStart(2, '0')}`
    const settled = parsed.data.paidCents >= amount && amount > 0

    const { error } = await supabase.from('lease_payments').upsert(
      {
        lease_id: parsed.data.leaseId,
        period: parsed.data.period,
        amount_cents: amount,
        paid_cents: parsed.data.paidCents,
        due_on: dueOn,
        paid_on: settled ? new Date().toISOString().slice(0, 10) : null,
        method: parsed.data.method,
        reference: parsed.data.reference,
      },
      { onConflict: 'lease_id,period' },
    )

    if (error) {
      console.error('[inmobiliario] registrarArriendo', error)
      return fail('No se pudo registrar el pago del arriendo.')
    }

    revalidatePath('/dashboard/inmobiliario')
    return { ok: true, data: await getInmobiliario() }
  } catch {
    return fail('No tienes permiso para gestionar inmuebles.')
  }
}
