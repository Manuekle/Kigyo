import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { pageRange, rosterFor, totalOf, type Page, type RosterEntry } from './shared'

/**
 * Plots, the crop cycles running on them, and what came off.
 *
 * `crop_cycles` carries its own `org_id` rather than inheriting through the
 * lot: it is the row the module lists, filters and paginates, and a child
 * policy would turn every one of those queries into a join. `harvests` does
 * inherit, because it only ever exists inside a cycle.
 *
 * Yield per hectare is derived here rather than stored — it changes with every
 * harvest recorded, and a stored copy would be wrong between them.
 */

export interface LotRow {
  id: string
  code: string | null
  name: string
  farm: string
  hectares: number
  soilType: string
  location: string
  status: string
  notes: string
  activeCycles: number
}

export interface CycleRow {
  id: string
  lotId: string
  lotName: string
  crop: string
  variety: string
  status: string
  hectares: number
  sownOn: string | null
  expectedHarvestOn: string | null
  expectedYieldKg: number | null
  inputCostCents: number
  responsibleId: string | null
  notes: string
  harvestedKg: number
  revenueCents: number
  /** Derived: kilos per hectare actually harvested, null when nothing has been. */
  yieldPerHectare: number | null
}

export interface HarvestRow {
  id: string
  cycleId: string
  quantityKg: number
  quality: string
  pricePerKgCents: number
  buyer: string
  harvestedOn: string
  notes: string
}

export interface AgroData {
  lotes: LotRow[]
  lotesTotal: number
  ciclos: CycleRow[]
  cosechas: HarvestRow[]
  roster: RosterEntry[]
  canWrite: boolean
}

interface LotRecord {
  id: string
  code: string | null
  name: string
  farm: string
  hectares: number
  soil_type: string
  location: string
  status: string
  notes: string
}

interface CycleRecord {
  id: string
  lot_id: string
  crop: string
  variety: string
  status: string
  hectares: number
  sown_on: string | null
  expected_harvest_on: string | null
  expected_yield_kg: number | null
  input_cost_cents: number
  responsible_id: string | null
  notes: string
}

interface HarvestRecord {
  id: string
  cycle_id: string
  quantity_kg: number
  quality: string
  price_per_kg_cents: number
  buyer: string
  harvested_on: string
  notes: string
}

const LOT_COLUMNS = 'id, code, name, farm, hectares, soil_type, location, status, notes'
const CYCLE_COLUMNS = `id, lot_id, crop, variety, status, hectares, sown_on, expected_harvest_on,
   expected_yield_kg, input_cost_cents, responsible_id, notes`

/** Harvested kilos and revenue per cycle, in one pass. */
function tally(rows: HarvestRecord[]) {
  const kilos = new Map<string, number>()
  const revenue = new Map<string, number>()
  for (const row of rows) {
    kilos.set(row.cycle_id, (kilos.get(row.cycle_id) ?? 0) + row.quantity_kg)
    revenue.set(
      row.cycle_id,
      (revenue.get(row.cycle_id) ?? 0) + Math.round(row.quantity_kg * row.price_per_kg_cents),
    )
  }
  return { kilos, revenue }
}

export async function getLotesPage(offset = 0): Promise<Page<LotRow>> {
  const member = await requirePermission('agro:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('farm_lots')
    .select(LOT_COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .range(from, to)

  if (error) {
    console.error('[agro] getLotesPage', error)
    return { rows: [], total: 0 }
  }

  const rows = data as unknown as LotRecord[]
  const { data: cycleRows } = await supabase
    .from('crop_cycles')
    .select('id, lot_id, status')
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .in('lot_id', rows.map((r) => r.id))

  const active = new Map<string, number>()
  for (const row of cycleRows ?? []) {
    if (row.status === 'Cosechado' || row.status === 'Perdido') continue
    active.set(row.lot_id, (active.get(row.lot_id) ?? 0) + 1)
  }

  return {
    rows: rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      farm: row.farm,
      hectares: row.hectares,
      soilType: row.soil_type,
      location: row.location,
      status: row.status,
      notes: row.notes,
      activeCycles: active.get(row.id) ?? 0,
    })),
    total: totalOf(count, rows.length, from),
  }
}

export async function getAgro(): Promise<AgroData> {
  const member = await requirePermission('agro:read')
  const supabase = await createClient()

  const [lotsResult, cyclesResult, roster] = await Promise.all([
    supabase
      .from('farm_lots')
      .select(LOT_COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('name', { ascending: true })
      .range(...pageRange(0)),
    supabase
      .from('crop_cycles')
      .select(CYCLE_COLUMNS)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('sown_on', { ascending: false, nullsFirst: false })
      .limit(500),
    rosterFor(supabase, member),
  ])

  if (lotsResult.error) {
    console.error('[agro] getAgro', lotsResult.error)
    return { lotes: [], lotesTotal: 0, ciclos: [], cosechas: [], roster: [], canWrite: false }
  }
  if (cyclesResult.error) console.error('[agro] cycles', cyclesResult.error)

  const lotRows = lotsResult.data as unknown as LotRecord[]
  const cycleRows = (cyclesResult.data ?? []) as unknown as CycleRecord[]
  const lotNames = new Map(lotRows.map((l) => [l.id, l.name]))

  const { data: harvestData, error: harvestError } = await supabase
    .from('harvests')
    .select('id, cycle_id, quantity_kg, quality, price_per_kg_cents, buyer, harvested_on, notes')
    .in('cycle_id', cycleRows.map((c) => c.id))
    .order('harvested_on', { ascending: false })
    .limit(500)

  if (harvestError) console.error('[agro] harvests', harvestError)

  const harvestRows = (harvestData ?? []) as unknown as HarvestRecord[]
  const { kilos, revenue } = tally(harvestRows)

  const active = new Map<string, number>()
  for (const row of cycleRows) {
    if (row.status === 'Cosechado' || row.status === 'Perdido') continue
    active.set(row.lot_id, (active.get(row.lot_id) ?? 0) + 1)
  }

  return {
    lotes: lotRows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      farm: row.farm,
      hectares: row.hectares,
      soilType: row.soil_type,
      location: row.location,
      status: row.status,
      notes: row.notes,
      activeCycles: active.get(row.id) ?? 0,
    })),
    lotesTotal: totalOf(lotsResult.count, lotRows.length),
    ciclos: cycleRows.map((row) => {
      const harvested = kilos.get(row.id) ?? 0
      return {
        id: row.id,
        lotId: row.lot_id,
        lotName: lotNames.get(row.lot_id) ?? '',
        crop: row.crop,
        variety: row.variety,
        status: row.status,
        hectares: row.hectares,
        sownOn: row.sown_on,
        expectedHarvestOn: row.expected_harvest_on,
        expectedYieldKg: row.expected_yield_kg,
        inputCostCents: row.input_cost_cents,
        responsibleId: row.responsible_id,
        notes: row.notes,
        harvestedKg: harvested,
        revenueCents: revenue.get(row.id) ?? 0,
        yieldPerHectare: harvested > 0 && row.hectares > 0
          ? Math.round(harvested / row.hectares)
          : null,
      }
    }),
    cosechas: harvestRows.map((row) => ({
      id: row.id,
      cycleId: row.cycle_id,
      quantityKg: row.quantity_kg,
      quality: row.quality,
      pricePerKgCents: row.price_per_kg_cents,
      buyer: row.buyer,
      harvestedOn: row.harvested_on,
      notes: row.notes,
    })),
    roster,
    canWrite: can(member.permissions, 'agro:write'),
  }
}
