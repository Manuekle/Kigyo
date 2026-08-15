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

export interface InsumoRow {
  id: string
  name: string
  kind: string
  stockQty: number
  unit: string
  supplier: string
  unitCostCents: number
}

export interface MaquinaRow {
  id: string
  name: string
  kind: string
  serialNo: string
  status: string
  hoursUsed: number
  notes: string
}

export interface TreatmentRow {
  id: string
  cycleId: string
  crop: string
  kind: string
  product: string
  activeIngredient: string
  dose: string
  appliedOn: string
  withholdingDays: number | null
  notes: string
}

export interface IrrigationRow {
  id: string
  lotId: string
  lotName: string
  method: string
  durationMin: number
  waterM3: number
  startedOn: string
  notes: string
}

export interface AgroData {
  lotes: LotRow[]
  lotesTotal: number
  ciclos: CycleRow[]
  cosechas: HarvestRow[]
  insumos: InsumoRow[]
  maquinaria: MaquinaRow[]
  sanidad: TreatmentRow[]
  riegos: IrrigationRow[]
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

interface InsumoRecord {
  id: string
  name: string
  kind: string
  stock_qty: number
  unit: string
  supplier: string
  unit_cost_cents: number
}

interface MaquinaRecord {
  id: string
  name: string
  kind: string
  serial_no: string
  status: string
  hours_used: number
  notes: string
}

const LOT_COLUMNS = 'id, code, name, farm, hectares, soil_type, location, status, notes'
const CYCLE_COLUMNS = `id, lot_id, crop, variety, status, hectares, sown_on, expected_harvest_on,
   expected_yield_kg, input_cost_cents, responsible_id, notes`
const INSUMO_COLUMNS = 'id, name, kind, stock_qty, unit, supplier, unit_cost_cents'
const MAQUINA_COLUMNS = 'id, name, kind, serial_no, status, hours_used, notes'

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

  const [lotsResult, cyclesResult, inputsResult, machineryResult, roster] = await Promise.all([
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
    supabase
      .from('farm_inputs' as never)
      .select(INSUMO_COLUMNS)
      .eq('org_id', member.orgId)
      .order('name', { ascending: true })
      .limit(500),
    supabase
      .from('farm_machinery' as never)
      .select(MAQUINA_COLUMNS)
      .eq('org_id', member.orgId)
      .order('name', { ascending: true })
      .limit(500),
    rosterFor(supabase, member),
  ])

  if (lotsResult.error) {
    console.error('[agro] getAgro', lotsResult.error)
    return {
      lotes: [],
      lotesTotal: 0,
      ciclos: [],
      cosechas: [],
      insumos: [],
      maquinaria: [],
      sanidad: [],
      riegos: [],
      roster: [],
      canWrite: false,
    }
  }
  if (cyclesResult.error) console.error('[agro] cycles', cyclesResult.error)
  if (inputsResult.error) console.error('[agro] inputs', inputsResult.error)
  if (machineryResult.error) console.error('[agro] machinery', machineryResult.error)

  const lotRows = lotsResult.data as unknown as LotRecord[]
  const cycleRows = (cyclesResult.data ?? []) as unknown as CycleRecord[]
  const insumoRows = (inputsResult.data ?? []) as unknown as InsumoRecord[]
  const maquinaRows = (machineryResult.data ?? []) as unknown as MaquinaRecord[]
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

  // Sanidad (por ciclo) y riego (por lote), con los nombres de sus padres.
  const [treatmentsResult, irrigationResult] = await Promise.all([
    supabase
      .from('crop_treatments')
      .select('id, cycle_id, kind, product, active_ingredient, dose, applied_on, withholding_days, notes')
      .in('cycle_id', cycleRows.map((c) => c.id))
      .order('applied_on', { ascending: false })
      .limit(500),
    supabase
      .from('irrigation_events')
      .select('id, lot_id, method, duration_min, water_m3, started_on, notes')
      .in('lot_id', lotRows.map((l) => l.id))
      .order('started_on', { ascending: false })
      .limit(500),
  ])

  const cropName = new Map(cycleRows.map((c) => [c.id, c.crop]))
  const treatments = ((treatmentsResult.data ?? []) as unknown as Array<{
    id: string; cycle_id: string; kind: string; product: string
    active_ingredient: string; dose: string; applied_on: string
    withholding_days: number | null; notes: string
  }>).map((row) => ({
    id: row.id,
    cycleId: row.cycle_id,
    crop: cropName.get(row.cycle_id) ?? '—',
    kind: row.kind,
    product: row.product,
    activeIngredient: row.active_ingredient,
    dose: row.dose,
    appliedOn: row.applied_on,
    withholdingDays: row.withholding_days,
    notes: row.notes,
  }))

  const riegos = ((irrigationResult.data ?? []) as unknown as Array<{
    id: string; lot_id: string; method: string; duration_min: number
    water_m3: number; started_on: string; notes: string
  }>).map((row) => ({
    id: row.id,
    lotId: row.lot_id,
    lotName: lotNames.get(row.lot_id) ?? '—',
    method: row.method,
    durationMin: row.duration_min,
    waterM3: row.water_m3,
    startedOn: row.started_on,
    notes: row.notes,
  }))

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
    insumos: insumoRows.map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind,
      stockQty: row.stock_qty,
      unit: row.unit,
      supplier: row.supplier,
      unitCostCents: row.unit_cost_cents,
    })),
    maquinaria: maquinaRows.map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind,
      serialNo: row.serial_no,
      status: row.status,
      hoursUsed: row.hours_used,
      notes: row.notes,
    })),
    sanidad: treatments,
    riegos,
    roster,
    canWrite: can(member.permissions, 'agro:write'),
  }
}
