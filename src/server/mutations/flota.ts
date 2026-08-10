'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import {
  FUEL_KINDS, VEHICLE_KINDS, VEHICLE_STATUSES, WORK_ORDER_KINDS,
} from '@/lib/domain'
import { belongsToOrg } from '@/server/queries/shared'
import { getFlota, type FlotaData } from '@/server/queries/flota'

export type FlotaResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

/**
 * The vehicle must be this tenant's.
 *
 * `vehicle_services` and `fuel_logs` inherit RLS from the vehicle, so the
 * policy cannot vouch for the id being written into them — it only refuses
 * rows whose parent is invisible, which surfaces as an empty result rather
 * than an error.
 */
async function vehicleBelongs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  orgId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('vehicles')
    .select('id')
    .eq('id', id)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()
  return Boolean(data)
}

/* ─── Vehicles ─────────────────────────────────────────────────────────── */

const vehicleSchema = z.object({
  plate: z.string().trim().min(3, 'Escribe la placa.').max(20).toUpperCase(),
  kind: z.enum(VEHICLE_KINDS).default('Camioneta'),
  brand: z.string().trim().max(80).default(''),
  model: z.string().trim().max(80).default(''),
  modelYear: z.coerce.number().int().min(1950).max(2100).nullable().default(null),
  fuel: z.enum(FUEL_KINDS).default('Gasolina'),
  driverId: z.uuid().nullable().default(null),
  odometerKm: z.coerce.number().int().min(0).default(0),
  capacityKg: z.coerce.number().int().min(0).nullable().default(null),
  soatExpiresOn: z.string().date().nullable().default(null),
  inspectionExpiresOn: z.string().date().nullable().default(null),
  insuranceExpiresOn: z.string().date().nullable().default(null),
  notes: z.string().trim().max(1000).default(''),
})

export async function createVehiculo(
  input: z.input<typeof vehicleSchema>,
): Promise<FlotaResult<FlotaData>> {
  try {
    const member = await requirePermission('flota:write')
    const parsed = vehicleSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    if (!(await belongsToOrg(supabase, 'employees', parsed.data.driverId, member.orgId))) {
      return fail('Esa persona no está en el equipo de tu organización.')
    }

    const { error } = await supabase.from('vehicles').insert({
      org_id: member.orgId,
      plate: parsed.data.plate,
      kind: parsed.data.kind,
      brand: parsed.data.brand,
      model: parsed.data.model,
      model_year: parsed.data.modelYear,
      fuel: parsed.data.fuel,
      status: 'Disponible',
      driver_id: parsed.data.driverId,
      odometer_km: parsed.data.odometerKm,
      capacity_kg: parsed.data.capacityKg,
      soat_expires_on: parsed.data.soatExpiresOn,
      inspection_expires_on: parsed.data.inspectionExpiresOn,
      insurance_expires_on: parsed.data.insuranceExpiresOn,
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[flota] createVehiculo', error)
      if (error.code === '23505') return fail('Ya existe un vehículo con esa placa.')
      return fail('No se pudo registrar el vehículo.')
    }

    revalidatePath('/dashboard/flota')
    return { ok: true, data: await getFlota() }
  } catch {
    return fail('No tienes permiso para gestionar la flota.')
  }
}

const vehicleStatusSchema = z.object({ id: z.uuid(), status: z.enum(VEHICLE_STATUSES) })

export async function setVehiculoStatus(
  input: z.input<typeof vehicleStatusSchema>,
): Promise<FlotaResult<FlotaData>> {
  try {
    const member = await requirePermission('flota:write')
    const parsed = vehicleStatusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('vehicles')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[flota] setVehiculoStatus', error)
      return fail('No se pudo actualizar el vehículo.')
    }

    revalidatePath('/dashboard/flota')
    return { ok: true, data: await getFlota() }
  } catch {
    return fail('No tienes permiso para gestionar la flota.')
  }
}

export async function deleteVehiculo(id: string): Promise<FlotaResult<FlotaData>> {
  try {
    const member = await requirePermission('flota:write')
    if (!z.uuid().safeParse(id).success) return fail('Vehículo desconocido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('vehicles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[flota] deleteVehiculo', error)
      return fail('No se pudo eliminar el vehículo.')
    }

    revalidatePath('/dashboard/flota')
    return { ok: true, data: await getFlota() }
  } catch {
    return fail('No tienes permiso para gestionar la flota.')
  }
}

/* ─── Services ─────────────────────────────────────────────────────────── */

const serviceSchema = z.object({
  vehicleId: z.uuid('Elige el vehículo.'),
  kind: z.enum(WORK_ORDER_KINDS).default('Preventivo'),
  description: z.string().trim().max(500).default(''),
  provider: z.string().trim().max(120).default(''),
  odometerKm: z.coerce.number().int().min(0).nullable().default(null),
  costCents: z.coerce.number().int().min(0).default(0),
  servicedOn: z.string().date(),
  nextServiceOn: z.string().date().nullable().default(null),
})

export async function logServicio(
  input: z.input<typeof serviceSchema>,
): Promise<FlotaResult<FlotaData>> {
  try {
    const member = await requirePermission('flota:write')
    const parsed = serviceSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    if (!(await vehicleBelongs(supabase, parsed.data.vehicleId, member.orgId))) {
      return fail('Ese vehículo no existe en tu organización.')
    }

    const { error } = await supabase.from('vehicle_services').insert({
      vehicle_id: parsed.data.vehicleId,
      kind: parsed.data.kind,
      description: parsed.data.description,
      provider: parsed.data.provider,
      odometer_km: parsed.data.odometerKm,
      cost_cents: parsed.data.costCents,
      serviced_on: parsed.data.servicedOn,
      next_service_on: parsed.data.nextServiceOn,
    })

    if (error) {
      console.error('[flota] logServicio', error)
      return fail('No se pudo registrar el servicio.')
    }

    // The odometer only ever moves forward: a reading taken at the workshop is
    // newer than whatever the record held, but a typo must not roll it back.
    if (parsed.data.odometerKm !== null) {
      await supabase
        .from('vehicles')
        .update({ odometer_km: parsed.data.odometerKm })
        .eq('id', parsed.data.vehicleId)
        .eq('org_id', member.orgId)
        .lt('odometer_km', parsed.data.odometerKm)
    }

    revalidatePath('/dashboard/flota')
    return { ok: true, data: await getFlota() }
  } catch {
    return fail('No tienes permiso para gestionar la flota.')
  }
}

/* ─── Fuel ─────────────────────────────────────────────────────────────── */

const fuelSchema = z.object({
  vehicleId: z.uuid('Elige el vehículo.'),
  liters: z.coerce.number().positive('Los litros deben ser mayores que cero.').max(100_000),
  costCents: z.coerce.number().int().min(0).default(0),
  odometerKm: z.coerce.number().int().min(0).nullable().default(null),
  station: z.string().trim().max(120).default(''),
  driverId: z.uuid().nullable().default(null),
  filledOn: z.string().date(),
})

export async function logCombustible(
  input: z.input<typeof fuelSchema>,
): Promise<FlotaResult<FlotaData>> {
  try {
    const member = await requirePermission('flota:write')
    const parsed = fuelSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const [vehicleOk, driverOk] = await Promise.all([
      vehicleBelongs(supabase, parsed.data.vehicleId, member.orgId),
      belongsToOrg(supabase, 'employees', parsed.data.driverId, member.orgId),
    ])

    if (!vehicleOk) return fail('Ese vehículo no existe en tu organización.')
    if (!driverOk) return fail('Esa persona no está en el equipo de tu organización.')

    const { error } = await supabase.from('fuel_logs').insert({
      vehicle_id: parsed.data.vehicleId,
      liters: parsed.data.liters,
      cost_cents: parsed.data.costCents,
      odometer_km: parsed.data.odometerKm,
      station: parsed.data.station,
      driver_id: parsed.data.driverId,
      filled_on: parsed.data.filledOn,
    })

    if (error) {
      console.error('[flota] logCombustible', error)
      return fail('No se pudo registrar el tanqueo.')
    }

    if (parsed.data.odometerKm !== null) {
      await supabase
        .from('vehicles')
        .update({ odometer_km: parsed.data.odometerKm })
        .eq('id', parsed.data.vehicleId)
        .eq('org_id', member.orgId)
        .lt('odometer_km', parsed.data.odometerKm)
    }

    revalidatePath('/dashboard/flota')
    return { ok: true, data: await getFlota() }
  } catch {
    return fail('No tienes permiso para gestionar la flota.')
  }
}
