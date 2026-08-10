import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { pageRange, rosterFor, totalOf, type Page, type RosterEntry } from './shared'

/**
 * Vehicles, what has been done to them, and what they have burned.
 *
 * The three expiry dates — SOAT, técnico-mecánica, seguro — are the reason the
 * module exists rather than being three columns on an inventory asset: a
 * vehicle whose SOAT lapsed is not "an asset needing attention", it is a
 * vehicle that legally cannot leave the yard, and the answer to "what expires
 * this month" has to be one query.
 */

export interface VehicleRow {
  id: string
  plate: string
  kind: string
  brand: string
  model: string
  modelYear: number | null
  fuel: string
  status: string
  driverId: string | null
  odometerKm: number
  capacityKg: number | null
  soatExpiresOn: string | null
  inspectionExpiresOn: string | null
  insuranceExpiresOn: string | null
  notes: string
}

export interface ServiceRow {
  id: string
  vehicleId: string
  plate: string
  kind: string
  description: string
  provider: string
  odometerKm: number | null
  costCents: number
  servicedOn: string
  nextServiceOn: string | null
}

export interface FuelRow {
  id: string
  vehicleId: string
  plate: string
  liters: number
  costCents: number
  odometerKm: number | null
  station: string
  driverId: string | null
  filledOn: string
}

export interface FlotaData {
  vehiculos: VehicleRow[]
  vehiculosTotal: number
  servicios: ServiceRow[]
  combustible: FuelRow[]
  roster: RosterEntry[]
  canWrite: boolean
}

interface VehicleRecord {
  id: string
  plate: string
  kind: string
  brand: string
  model: string
  model_year: number | null
  fuel: string
  status: string
  driver_id: string | null
  odometer_km: number
  capacity_kg: number | null
  soat_expires_on: string | null
  inspection_expires_on: string | null
  insurance_expires_on: string | null
  notes: string
}

interface ServiceRecord {
  id: string
  vehicle_id: string
  kind: string
  description: string
  provider: string
  odometer_km: number | null
  cost_cents: number
  serviced_on: string
  next_service_on: string | null
}

interface FuelRecord {
  id: string
  vehicle_id: string
  liters: number
  cost_cents: number
  odometer_km: number | null
  station: string
  driver_id: string | null
  filled_on: string
}

const VEHICLE_COLUMNS = `id, plate, kind, brand, model, model_year, fuel, status, driver_id,
   odometer_km, capacity_kg, soat_expires_on, inspection_expires_on,
   insurance_expires_on, notes`

function toVehicle(row: VehicleRecord): VehicleRow {
  return {
    id: row.id,
    plate: row.plate,
    kind: row.kind,
    brand: row.brand,
    model: row.model,
    modelYear: row.model_year,
    fuel: row.fuel,
    status: row.status,
    driverId: row.driver_id,
    odometerKm: row.odometer_km,
    capacityKg: row.capacity_kg,
    soatExpiresOn: row.soat_expires_on,
    inspectionExpiresOn: row.inspection_expires_on,
    insuranceExpiresOn: row.insurance_expires_on,
    notes: row.notes,
  }
}

export async function getVehiculosPage(offset = 0): Promise<Page<VehicleRow>> {
  const member = await requirePermission('flota:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('vehicles')
    .select(VEHICLE_COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('plate', { ascending: true })
    .range(from, to)

  if (error) {
    console.error('[flota] getVehiculosPage', error)
    return { rows: [], total: 0 }
  }

  const rows = data as unknown as VehicleRecord[]
  return { rows: rows.map(toVehicle), total: totalOf(count, rows.length, from) }
}

export async function getFlota(): Promise<FlotaData> {
  const member = await requirePermission('flota:read')
  const supabase = await createClient()

  const [vehiclesResult, roster] = await Promise.all([
    supabase
      .from('vehicles')
      .select(VEHICLE_COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('plate', { ascending: true })
      .range(...pageRange(0)),
    rosterFor(supabase, member),
  ])

  if (vehiclesResult.error) {
    console.error('[flota] getFlota', vehiclesResult.error)
    return { vehiculos: [], vehiculosTotal: 0, servicios: [], combustible: [], roster: [], canWrite: false }
  }

  const vehicleRows = vehiclesResult.data as unknown as VehicleRecord[]
  const ids = vehicleRows.map((r) => r.id)
  const plates = new Map(vehicleRows.map((r) => [r.id, r.plate]))

  // Both child tables read isolation through the vehicle, so the `in` filter is
  // about which page is on screen, not about tenant scoping.
  const [servicesResult, fuelResult] = await Promise.all([
    supabase
      .from('vehicle_services')
      .select('id, vehicle_id, kind, description, provider, odometer_km, cost_cents, serviced_on, next_service_on')
      .in('vehicle_id', ids)
      .order('serviced_on', { ascending: false })
      .limit(300),
    supabase
      .from('fuel_logs')
      .select('id, vehicle_id, liters, cost_cents, odometer_km, station, driver_id, filled_on')
      .in('vehicle_id', ids)
      .order('filled_on', { ascending: false })
      .limit(300),
  ])

  if (servicesResult.error) console.error('[flota] services', servicesResult.error)
  if (fuelResult.error) console.error('[flota] fuel', fuelResult.error)

  return {
    vehiculos: vehicleRows.map(toVehicle),
    vehiculosTotal: totalOf(vehiclesResult.count, vehicleRows.length),
    servicios: ((servicesResult.data ?? []) as unknown as ServiceRecord[]).map((row) => ({
      id: row.id,
      vehicleId: row.vehicle_id,
      plate: plates.get(row.vehicle_id) ?? '',
      kind: row.kind,
      description: row.description,
      provider: row.provider,
      odometerKm: row.odometer_km,
      costCents: row.cost_cents,
      servicedOn: row.serviced_on,
      nextServiceOn: row.next_service_on,
    })),
    combustible: ((fuelResult.data ?? []) as unknown as FuelRecord[]).map((row) => ({
      id: row.id,
      vehicleId: row.vehicle_id,
      plate: plates.get(row.vehicle_id) ?? '',
      liters: row.liters,
      costCents: row.cost_cents,
      odometerKm: row.odometer_km,
      station: row.station,
      driverId: row.driver_id,
      filledOn: row.filled_on,
    })),
    roster,
    canWrite: can(member.permissions, 'flota:write'),
  }
}
