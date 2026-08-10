import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { pageRange, totalOf, type Page } from './shared'

/**
 * Properties, their leases, and the rent that has or has not arrived.
 *
 * `lease_payments` is unique on (lease, period), which is what makes the
 * arrears report trustworthy: two rows for March would double count the debt,
 * and a missing row is the debt. `paid_cents` on each row rather than a
 * boolean, because part payments are the normal case in arrears.
 */

export interface PropertyRow {
  id: string
  code: string | null
  name: string
  kind: string
  status: string
  address: string
  city: string
  areaM2: number | null
  bedrooms: number | null
  bathrooms: number | null
  parkingSpots: number | null
  rentCents: number
  adminFeeCents: number
  salePriceCents: number
  ownerName: string
  notes: string
  activeLeases: number
}

export interface LeaseRow {
  id: string
  propertyId: string
  propertyName: string
  tenantName: string
  tenantDocument: string
  tenantEmail: string | null
  tenantPhone: string
  status: string
  rentCents: number
  depositCents: number
  dueDay: number
  startsOn: string
  endsOn: string | null
  notes: string
  /** Derived from `lease_payments`: what is owed and how many periods are late. */
  balanceCents: number
  overduePeriods: number
}

export interface PaymentRow {
  id: string
  leaseId: string
  period: string
  amountCents: number
  paidCents: number
  dueOn: string
  paidOn: string | null
  method: string
  reference: string
}

export interface InmobiliarioData {
  inmuebles: PropertyRow[]
  inmueblesTotal: number
  contratos: LeaseRow[]
  pagos: PaymentRow[]
  canWrite: boolean
}

interface PropertyRecord {
  id: string
  code: string | null
  name: string
  kind: string
  status: string
  address: string
  city: string
  area_m2: number | null
  bedrooms: number | null
  bathrooms: number | null
  parking_spots: number | null
  rent_cents: number
  admin_fee_cents: number
  sale_price_cents: number
  owner_name: string
  notes: string
}

interface LeaseRecord {
  id: string
  property_id: string
  tenant_name: string
  tenant_document: string
  tenant_email: string | null
  tenant_phone: string
  status: string
  rent_cents: number
  deposit_cents: number
  due_day: number
  starts_on: string
  ends_on: string | null
  notes: string
}

interface PaymentRecord {
  id: string
  lease_id: string
  period: string
  amount_cents: number
  paid_cents: number
  due_on: string
  paid_on: string | null
  method: string
  reference: string
}

const PROPERTY_COLUMNS = `id, code, name, kind, status, address, city, area_m2, bedrooms,
   bathrooms, parking_spots, rent_cents, admin_fee_cents, sale_price_cents, owner_name, notes`

const LEASE_COLUMNS = `id, property_id, tenant_name, tenant_document, tenant_email, tenant_phone,
   status, rent_cents, deposit_cents, due_day, starts_on, ends_on, notes`

/** Outstanding balance and late periods per lease. */
function arrears(rows: PaymentRecord[]) {
  const balance = new Map<string, number>()
  const late = new Map<string, number>()
  const today = new Date().toISOString().slice(0, 10)

  for (const row of rows) {
    const owed = row.amount_cents - row.paid_cents
    if (owed <= 0) continue
    balance.set(row.lease_id, (balance.get(row.lease_id) ?? 0) + owed)
    // Only a period whose due date has passed counts as late — this month's
    // rent, not yet due, is not arrears.
    if (row.due_on <= today) late.set(row.lease_id, (late.get(row.lease_id) ?? 0) + 1)
  }
  return { balance, late }
}

function toProperty(row: PropertyRecord, leases: Map<string, number>): PropertyRow {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    kind: row.kind,
    status: row.status,
    address: row.address,
    city: row.city,
    areaM2: row.area_m2,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    parkingSpots: row.parking_spots,
    rentCents: row.rent_cents,
    adminFeeCents: row.admin_fee_cents,
    salePriceCents: row.sale_price_cents,
    ownerName: row.owner_name,
    notes: row.notes,
    activeLeases: leases.get(row.id) ?? 0,
  }
}

export async function getInmueblesPage(offset = 0): Promise<Page<PropertyRow>> {
  const member = await requirePermission('inmobiliario:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('properties')
    .select(PROPERTY_COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .range(from, to)

  if (error) {
    console.error('[inmobiliario] getInmueblesPage', error)
    return { rows: [], total: 0 }
  }

  const rows = data as unknown as PropertyRecord[]
  const { data: leaseRows } = await supabase
    .from('leases')
    .select('id, property_id, status')
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .in('property_id', rows.map((r) => r.id))

  const active = new Map<string, number>()
  for (const row of leaseRows ?? []) {
    if (row.status === 'Terminado') continue
    active.set(row.property_id, (active.get(row.property_id) ?? 0) + 1)
  }

  return {
    rows: rows.map((row) => toProperty(row, active)),
    total: totalOf(count, rows.length, from),
  }
}

export async function getInmobiliario(): Promise<InmobiliarioData> {
  const member = await requirePermission('inmobiliario:read')
  const supabase = await createClient()

  const [propertiesResult, leasesResult] = await Promise.all([
    supabase
      .from('properties')
      .select(PROPERTY_COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('name', { ascending: true })
      .range(...pageRange(0)),
    supabase
      .from('leases')
      .select(LEASE_COLUMNS)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('starts_on', { ascending: false })
      .limit(500),
  ])

  if (propertiesResult.error) {
    console.error('[inmobiliario] getInmobiliario', propertiesResult.error)
    return { inmuebles: [], inmueblesTotal: 0, contratos: [], pagos: [], canWrite: false }
  }
  if (leasesResult.error) console.error('[inmobiliario] leases', leasesResult.error)

  const propertyRows = propertiesResult.data as unknown as PropertyRecord[]
  const leaseRows = (leasesResult.data ?? []) as unknown as LeaseRecord[]
  const propertyNames = new Map(propertyRows.map((p) => [p.id, p.name]))

  const { data: paymentData, error: paymentError } = await supabase
    .from('lease_payments')
    .select('id, lease_id, period, amount_cents, paid_cents, due_on, paid_on, method, reference')
    .in('lease_id', leaseRows.map((l) => l.id))
    .order('due_on', { ascending: false })
    .limit(1000)

  if (paymentError) console.error('[inmobiliario] payments', paymentError)

  const paymentRows = (paymentData ?? []) as unknown as PaymentRecord[]
  const { balance, late } = arrears(paymentRows)

  const active = new Map<string, number>()
  for (const row of leaseRows) {
    if (row.status === 'Terminado') continue
    active.set(row.property_id, (active.get(row.property_id) ?? 0) + 1)
  }

  return {
    inmuebles: propertyRows.map((row) => toProperty(row, active)),
    inmueblesTotal: totalOf(propertiesResult.count, propertyRows.length),
    contratos: leaseRows.map((row) => ({
      id: row.id,
      propertyId: row.property_id,
      propertyName: propertyNames.get(row.property_id) ?? '',
      tenantName: row.tenant_name,
      tenantDocument: row.tenant_document,
      tenantEmail: row.tenant_email,
      tenantPhone: row.tenant_phone,
      status: row.status,
      rentCents: row.rent_cents,
      depositCents: row.deposit_cents,
      dueDay: row.due_day,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      notes: row.notes,
      balanceCents: balance.get(row.id) ?? 0,
      overduePeriods: late.get(row.id) ?? 0,
    })),
    pagos: paymentRows.map((row) => ({
      id: row.id,
      leaseId: row.lease_id,
      period: row.period,
      amountCents: row.amount_cents,
      paidCents: row.paid_cents,
      dueOn: row.due_on,
      paidOn: row.paid_on,
      method: row.method,
      reference: row.reference,
    })),
    canWrite: can(member.permissions, 'inmobiliario:write'),
  }
}
