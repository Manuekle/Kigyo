'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { CROP_CYCLE_STATUSES, LOT_STATUSES } from '@/lib/domain'
import { belongsToOrg } from '@/server/queries/shared'
import { getAgro, type AgroData } from '@/server/queries/agro'

export type AgroResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

/* ─── Lots ─────────────────────────────────────────────────────────────── */

const lotSchema = z.object({
  name: z.string().trim().min(2, 'Ponle nombre al lote.').max(160),
  farm: z.string().trim().max(160).default(''),
  hectares: z.coerce.number().min(0).max(1e6).default(0),
  soilType: z.string().trim().max(80).default(''),
  location: z.string().trim().max(200).default(''),
  notes: z.string().trim().max(1000).default(''),
})

const lotUpdateSchema = lotSchema.extend({ id: z.uuid() })

export async function createLote(
  input: z.input<typeof lotSchema>,
): Promise<AgroResult<AgroData>> {
  try {
    const member = await requirePermission('agro:write')
    const parsed = lotSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase.from('farm_lots').insert({
      org_id: member.orgId,
      name: parsed.data.name,
      farm: parsed.data.farm,
      hectares: parsed.data.hectares,
      soil_type: parsed.data.soilType,
      location: parsed.data.location,
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[agro] createLote', error)
      return fail('No se pudo crear el lote.')
    }

    revalidatePath('/dashboard/agro')
    return { ok: true, data: await getAgro() }
  } catch {
    return fail('No tienes permiso para gestionar agro.')
  }
}

export async function updateLote(
  input: z.input<typeof lotUpdateSchema>,
): Promise<AgroResult<AgroData>> {
  try {
    const member = await requirePermission('agro:write')
    const parsed = lotUpdateSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('farm_lots')
      .update({
        name: parsed.data.name,
        farm: parsed.data.farm,
        hectares: parsed.data.hectares,
        soil_type: parsed.data.soilType,
        location: parsed.data.location,
        notes: parsed.data.notes,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[agro] updateLote', error)
      return fail('No se pudo actualizar el lote.')
    }

    revalidatePath('/dashboard/agro')
    return { ok: true, data: await getAgro() }
  } catch {
    return fail('No tienes permiso para gestionar agro.')
  }
}

const lotStatusSchema = z.object({ id: z.uuid(), status: z.enum(LOT_STATUSES) })

export async function setLoteStatus(
  input: z.input<typeof lotStatusSchema>,
): Promise<AgroResult<AgroData>> {
  try {
    const member = await requirePermission('agro:write')
    const parsed = lotStatusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('farm_lots')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[agro] setLoteStatus', error)
      return fail('No se pudo actualizar el lote.')
    }

    revalidatePath('/dashboard/agro')
    return { ok: true, data: await getAgro() }
  } catch {
    return fail('No tienes permiso para gestionar agro.')
  }
}

export async function deleteLote(id: string): Promise<AgroResult<AgroData>> {
  try {
    const member = await requirePermission('agro:write')
    if (!z.uuid().safeParse(id).success) return fail('Lote desconocido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('farm_lots')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[agro] deleteLote', error)
      return fail('No se pudo eliminar el lote.')
    }

    revalidatePath('/dashboard/agro')
    return { ok: true, data: await getAgro() }
  } catch {
    return fail('No tienes permiso para gestionar agro.')
  }
}

/* ─── Crop cycles ──────────────────────────────────────────────────────── */

const cycleSchema = z.object({
  lotId: z.uuid('Elige el lote.'),
  crop: z.string().trim().min(2, 'Escribe el cultivo.').max(120),
  variety: z.string().trim().max(120).default(''),
  hectares: z.coerce.number().min(0).max(1e6).default(0),
  sownOn: z.string().date().nullable().default(null),
  expectedHarvestOn: z.string().date().nullable().default(null),
  expectedYieldKg: z.coerce.number().min(0).max(1e9).nullable().default(null),
  inputCostCents: z.coerce.number().int().min(0).default(0),
  responsibleId: z.uuid().nullable().default(null),
  notes: z.string().trim().max(2000).default(''),
})

const cycleUpdateSchema = cycleSchema.extend({ id: z.uuid() })

export async function createCiclo(
  input: z.input<typeof cycleSchema>,
): Promise<AgroResult<AgroData>> {
  try {
    const member = await requirePermission('agro:write')
    const parsed = cycleSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    if (parsed.data.sownOn && parsed.data.expectedHarvestOn
        && parsed.data.expectedHarvestOn < parsed.data.sownOn) {
      return fail('La cosecha esperada no puede ser anterior a la siembra.')
    }

    const supabase = await createClient()
    const [{ data: lot }, responsibleOk] = await Promise.all([
      supabase
        .from('farm_lots')
        .select('id, hectares')
        .eq('id', parsed.data.lotId)
        .eq('org_id', member.orgId)
        .is('deleted_at', null)
        .maybeSingle(),
      belongsToOrg(supabase, 'employees', parsed.data.responsibleId, member.orgId),
    ])

    if (!lot) return fail('Ese lote no existe en tu organización.')
    if (!responsibleOk) return fail('Esa persona no está en el equipo de tu organización.')

    // Planting more hectares than the lot has is a typo, and it would make
    // every yield-per-hectare figure downstream quietly wrong.
    if (lot.hectares > 0 && parsed.data.hectares > lot.hectares) {
      return fail(`El lote tiene ${lot.hectares} ha. No puedes sembrar más que eso.`)
    }

    const sown = parsed.data.sownOn !== null
    const { error } = await supabase.from('crop_cycles').insert({
      org_id: member.orgId,
      lot_id: parsed.data.lotId,
      crop: parsed.data.crop,
      variety: parsed.data.variety,
      // A cycle with a sowing date has been sown; one without is still planned.
      status: sown ? 'Sembrado' : 'Planificado',
      hectares: parsed.data.hectares,
      sown_on: parsed.data.sownOn,
      expected_harvest_on: parsed.data.expectedHarvestOn,
      expected_yield_kg: parsed.data.expectedYieldKg,
      input_cost_cents: parsed.data.inputCostCents,
      responsible_id: parsed.data.responsibleId,
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[agro] createCiclo', error)
      return fail('No se pudo crear el ciclo de cultivo.')
    }

    // The lot follows its cycle, so the plot list never shows "Disponible"
    // for ground that has a crop standing on it.
    if (sown) {
      await supabase
        .from('farm_lots')
        .update({ status: 'Sembrado' })
        .eq('id', parsed.data.lotId)
        .eq('org_id', member.orgId)
    }

    revalidatePath('/dashboard/agro')
    return { ok: true, data: await getAgro() }
  } catch {
    return fail('No tienes permiso para gestionar agro.')
  }
}

export async function updateCiclo(
  input: z.input<typeof cycleUpdateSchema>,
): Promise<AgroResult<AgroData>> {
  try {
    const member = await requirePermission('agro:write')
    const parsed = cycleUpdateSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    if (parsed.data.sownOn && parsed.data.expectedHarvestOn
        && parsed.data.expectedHarvestOn < parsed.data.sownOn) {
      return fail('La cosecha esperada no puede ser anterior a la siembra.')
    }

    const supabase = await createClient()
    const { data: cycle } = await supabase
      .from('crop_cycles')
      .select('id, lot_id, status')
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!cycle) return fail('Ese ciclo no existe en tu organización.')
    if (cycle.status === 'Cosechado' || cycle.status === 'Perdido') {
      return fail('No se puede editar un ciclo ya cosechado o perdido.')
    }

    const [{ data: lot }, responsibleOk] = await Promise.all([
      supabase
        .from('farm_lots')
        .select('id, hectares')
        .eq('id', parsed.data.lotId)
        .eq('org_id', member.orgId)
        .is('deleted_at', null)
        .maybeSingle(),
      belongsToOrg(supabase, 'employees', parsed.data.responsibleId, member.orgId),
    ])

    if (!lot) return fail('Ese lote no existe en tu organización.')
    if (!responsibleOk) return fail('Esa persona no está en el equipo de tu organización.')

    if (lot.hectares > 0 && parsed.data.hectares > lot.hectares) {
      return fail(`El lote tiene ${lot.hectares} ha. No puedes sembrar más que eso.`)
    }

    const sown = parsed.data.sownOn !== null
    const { error } = await supabase
      .from('crop_cycles')
      .update({
        lot_id: parsed.data.lotId,
        crop: parsed.data.crop,
        variety: parsed.data.variety,
        status: sown ? 'Sembrado' : 'Planificado',
        hectares: parsed.data.hectares,
        sown_on: parsed.data.sownOn,
        expected_harvest_on: parsed.data.expectedHarvestOn,
        expected_yield_kg: parsed.data.expectedYieldKg,
        input_cost_cents: parsed.data.inputCostCents,
        responsible_id: parsed.data.responsibleId,
        notes: parsed.data.notes,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[agro] updateCiclo', error)
      return fail('No se pudo actualizar el ciclo de cultivo.')
    }

    if (sown) {
      await supabase
        .from('farm_lots')
        .update({ status: 'Sembrado' })
        .eq('id', parsed.data.lotId)
        .eq('org_id', member.orgId)
    }

    revalidatePath('/dashboard/agro')
    return { ok: true, data: await getAgro() }
  } catch {
    return fail('No tienes permiso para gestionar agro.')
  }
}

const cycleStatusSchema = z.object({ id: z.uuid(), status: z.enum(CROP_CYCLE_STATUSES) })

export async function setCicloStatus(
  input: z.input<typeof cycleStatusSchema>,
): Promise<AgroResult<AgroData>> {
  try {
    const member = await requirePermission('agro:write')
    const parsed = cycleStatusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { data: cycle } = await supabase
      .from('crop_cycles')
      .select('id, lot_id')
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!cycle) return fail('Ese ciclo no existe en tu organización.')

    const { error } = await supabase
      .from('crop_cycles')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[agro] setCicloStatus', error)
      return fail('No se pudo actualizar el ciclo.')
    }

    // A finished cycle releases its lot to rest; a live one keeps it sown.
    const done = parsed.data.status === 'Cosechado' || parsed.data.status === 'Perdido'
    await supabase
      .from('farm_lots')
      .update({ status: done ? 'En descanso' : 'Sembrado' })
      .eq('id', cycle.lot_id)
      .eq('org_id', member.orgId)

    revalidatePath('/dashboard/agro')
    return { ok: true, data: await getAgro() }
  } catch {
    return fail('No tienes permiso para gestionar agro.')
  }
}

/* ─── Harvests ─────────────────────────────────────────────────────────── */

const harvestSchema = z.object({
  cycleId: z.uuid('Elige el ciclo.'),
  quantityKg: z.coerce.number().min(0).max(1e9),
  quality: z.string().trim().max(80).default(''),
  pricePerKgCents: z.coerce.number().int().min(0).default(0),
  buyer: z.string().trim().max(160).default(''),
  harvestedOn: z.string().date(),
  notes: z.string().trim().max(1000).default(''),
})

export async function registrarCosecha(
  input: z.input<typeof harvestSchema>,
): Promise<AgroResult<AgroData>> {
  try {
    const member = await requirePermission('agro:write')
    const parsed = harvestSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    // `harvests` inherits RLS from the cycle, so the id has to be checked
    // against this tenant explicitly.
    const { data: cycle } = await supabase
      .from('crop_cycles')
      .select('id, lot_id')
      .eq('id', parsed.data.cycleId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!cycle) return fail('Ese ciclo no existe en tu organización.')

    const { error } = await supabase.from('harvests').insert({
      cycle_id: parsed.data.cycleId,
      quantity_kg: parsed.data.quantityKg,
      quality: parsed.data.quality,
      price_per_kg_cents: parsed.data.pricePerKgCents,
      buyer: parsed.data.buyer,
      harvested_on: parsed.data.harvestedOn,
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[agro] registrarCosecha', error)
      return fail('No se pudo registrar la cosecha.')
    }

    // The lot moves to 'En cosecha' the moment kilos come off it, so the plot
    // list reflects what is happening in the field without anyone updating it.
    //
    // The *cycle* status is deliberately left alone: a harvest is usually
    // several passes over the same ground, and closing the cycle is a decision
    // ("we are done with this crop") rather than a consequence of one pass.
    await supabase
      .from('farm_lots')
      .update({ status: 'En cosecha' })
      .eq('id', cycle.lot_id)
      .eq('org_id', member.orgId)

    revalidatePath('/dashboard/agro')
    return { ok: true, data: await getAgro() }
  } catch {
    return fail('No tienes permiso para gestionar agro.')
  }
}

/* ─── Insumos ──────────────────────────────────────────────────────────── */

const insumoSchema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre del insumo.').max(160),
  kind: z.enum(['Semilla', 'Fertilizante', 'Agroquímico', 'Biocontrol', 'Otro']),
  stockQty: z.coerce.number().min(0).max(1e10).default(0),
  unit: z.string().trim().max(20).default('kg'),
  supplier: z.string().trim().max(160).default(''),
  unitCostCents: z.coerce.number().int().min(0).default(0),
})

export async function createInsumo(
  input: z.input<typeof insumoSchema>,
): Promise<AgroResult<AgroData>> {
  try {
    const member = await requirePermission('agro:write')
    const parsed = insumoSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const raw = supabase as unknown as SupabaseClient
    const { error } = await raw.from('farm_inputs').insert({
      org_id: member.orgId,
      name: parsed.data.name,
      kind: parsed.data.kind,
      stock_qty: parsed.data.stockQty,
      unit: parsed.data.unit,
      supplier: parsed.data.supplier,
      unit_cost_cents: parsed.data.unitCostCents,
    })

    if (error) {
      console.error('[agro] createInsumo', error)
      return fail('No se pudo crear el insumo.')
    }

    revalidatePath('/dashboard/agro')
    return { ok: true, data: await getAgro() }
  } catch {
    return fail('No tienes permiso para gestionar agro.')
  }
}

const stockSchema = z.object({ id: z.uuid(), stockQty: z.coerce.number().min(0).max(1e10) })

export async function setInsumoStock(
  input: z.input<typeof stockSchema>,
): Promise<AgroResult<AgroData>> {
  try {
    const member = await requirePermission('agro:write')
    const parsed = stockSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const raw = supabase as unknown as SupabaseClient
    const { error } = await raw
      .from('farm_inputs')
      .update({ stock_qty: parsed.data.stockQty })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[agro] setInsumoStock', error)
      return fail('No se pudo actualizar el stock.')
    }

    revalidatePath('/dashboard/agro')
    return { ok: true, data: await getAgro() }
  } catch {
    return fail('No tienes permiso para gestionar agro.')
  }
}

export async function deleteInsumo(id: string): Promise<AgroResult<AgroData>> {
  try {
    const member = await requirePermission('agro:write')
    if (!z.uuid().safeParse(id).success) return fail('Insumo desconocido.')

    const supabase = await createClient()
    const raw = supabase as unknown as SupabaseClient
    const { error } = await raw
      .from('farm_inputs')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[agro] deleteInsumo', error)
      return fail('No se pudo eliminar el insumo.')
    }

    revalidatePath('/dashboard/agro')
    return { ok: true, data: await getAgro() }
  } catch {
    return fail('No tienes permiso para gestionar agro.')
  }
}

/* ─── Maquinaria ───────────────────────────────────────────────────────── */

const maquinaSchema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre de la máquina.').max(160),
  kind: z.enum(['Tractor', 'Implemento', 'Cosechadora', 'Riego', 'Otro']),
  serialNo: z.string().trim().max(120).default(''),
  status: z.enum(['Operativa', 'En mantenimiento', 'Fuera de servicio']).default('Operativa'),
  hoursUsed: z.coerce.number().min(0).max(1e9).default(0),
  notes: z.string().trim().max(2000).default(''),
})

export async function createMaquina(
  input: z.input<typeof maquinaSchema>,
): Promise<AgroResult<AgroData>> {
  try {
    const member = await requirePermission('agro:write')
    const parsed = maquinaSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const raw = supabase as unknown as SupabaseClient
    const { error } = await raw.from('farm_machinery').insert({
      org_id: member.orgId,
      name: parsed.data.name,
      kind: parsed.data.kind,
      serial_no: parsed.data.serialNo,
      status: parsed.data.status,
      hours_used: parsed.data.hoursUsed,
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[agro] createMaquina', error)
      return fail('No se pudo registrar la máquina.')
    }

    revalidatePath('/dashboard/agro')
    return { ok: true, data: await getAgro() }
  } catch {
    return fail('No tienes permiso para gestionar agro.')
  }
}

const maquinaStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(['Operativa', 'En mantenimiento', 'Fuera de servicio']),
})

export async function setMaquinaStatus(
  input: z.input<typeof maquinaStatusSchema>,
): Promise<AgroResult<AgroData>> {
  try {
    const member = await requirePermission('agro:write')
    const parsed = maquinaStatusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const raw = supabase as unknown as SupabaseClient
    const { error } = await raw
      .from('farm_machinery')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[agro] setMaquinaStatus', error)
      return fail('No se pudo actualizar el estado de la máquina.')
    }

    revalidatePath('/dashboard/agro')
    return { ok: true, data: await getAgro() }
  } catch {
    return fail('No tienes permiso para gestionar agro.')
  }
}

export async function deleteMaquina(id: string): Promise<AgroResult<AgroData>> {
  try {
    const member = await requirePermission('agro:write')
    if (!z.uuid().safeParse(id).success) return fail('Máquina desconocida.')

    const supabase = await createClient()
    const raw = supabase as unknown as SupabaseClient
    const { error } = await raw
      .from('farm_machinery')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[agro] deleteMaquina', error)
      return fail('No se pudo eliminar la máquina.')
    }

    revalidatePath('/dashboard/agro')
    return { ok: true, data: await getAgro() }
  } catch {
    return fail('No tienes permiso para gestionar agro.')
  }
}

/* ─── Sanidad (aplicaciones fitosanitarias) ──────────────────────────────── */

const addTreatmentSchema = z.object({
  cycleId: z.string().uuid(),
  kind: z.enum(['Fertilización', 'Herbicida', 'Fungicida', 'Insecticida', 'Foliar', 'Otro']).default('Fertilización'),
  product: z.string().trim().min(1).max(160),
  activeIngredient: z.string().trim().max(160).default(''),
  dose: z.string().trim().max(80).default(''),
  appliedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  withholdingDays: z.string().default(''),
  notes: z.string().trim().max(300).default(''),
})

export async function addTreatment(
  input: z.input<typeof addTreatmentSchema>,
): Promise<AgroResult<AgroData>> {
  try {
    const member = await requirePermission('agro:write')
    const parsed = addTreatmentSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { data: cycle } = await supabase
      .from('crop_cycles')
      .select('id')
      .eq('id', parsed.data.cycleId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!cycle) return fail('Ese ciclo no pertenece a tu organización.')

    const { error } = await supabase.from('crop_treatments').insert({
      cycle_id: parsed.data.cycleId,
      kind: parsed.data.kind,
      product: parsed.data.product,
      active_ingredient: parsed.data.activeIngredient,
      dose: parsed.data.dose,
      applied_on: parsed.data.appliedOn,
      withholding_days: parsed.data.withholdingDays ? Number(parsed.data.withholdingDays) : null,
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[agro] addTreatment', error)
      return fail('No se pudo registrar la aplicación.')
    }

    revalidatePath('/dashboard/agro')
    return { ok: true, data: await getAgro() }
  } catch {
    return fail('No tienes permiso para gestionar agro.')
  }
}

export async function deleteTreatment(id: string): Promise<AgroResult<AgroData>> {
  try {
    await requirePermission('agro:write')
    if (!z.uuid().safeParse(id).success) return fail('Aplicación desconocida.')

    const supabase = await createClient()
    const { error } = await supabase.from('crop_treatments').delete().eq('id', id)

    if (error) {
      console.error('[agro] deleteTreatment', error)
      return fail('No se pudo eliminar la aplicación.')
    }

    revalidatePath('/dashboard/agro')
    return { ok: true, data: await getAgro() }
  } catch {
    return fail('No tienes permiso para gestionar agro.')
  }
}

/* ─── Riego ──────────────────────────────────────────────────────────────── */

const addIrrigationSchema = z.object({
  lotId: z.string().uuid(),
  method: z.enum(['Goteo', 'Aspersión', 'Gravedad', 'Pivote', 'Manual', 'Otro']).default('Goteo'),
  durationMin: z.coerce.number().int().min(0).max(1440),
  waterM3: z.coerce.number().min(0).max(1_000_000),
  startedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(300).default(''),
})

export async function addIrrigation(
  input: z.input<typeof addIrrigationSchema>,
): Promise<AgroResult<AgroData>> {
  try {
    const member = await requirePermission('agro:write')
    const parsed = addIrrigationSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { data: lot } = await supabase
      .from('farm_lots')
      .select('id')
      .eq('id', parsed.data.lotId)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!lot) return fail('Ese lote no pertenece a tu organización.')

    const { error } = await supabase.from('irrigation_events').insert({
      lot_id: parsed.data.lotId,
      method: parsed.data.method,
      duration_min: parsed.data.durationMin,
      water_m3: parsed.data.waterM3,
      started_on: parsed.data.startedOn,
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[agro] addIrrigation', error)
      return fail('No se pudo registrar el riego.')
    }

    revalidatePath('/dashboard/agro')
    return { ok: true, data: await getAgro() }
  } catch {
    return fail('No tienes permiso para gestionar agro.')
  }
}

export async function deleteIrrigation(id: string): Promise<AgroResult<AgroData>> {
  try {
    await requirePermission('agro:write')
    if (!z.uuid().safeParse(id).success) return fail('Riego desconocido.')

    const supabase = await createClient()
    const { error } = await supabase.from('irrigation_events').delete().eq('id', id)

    if (error) {
      console.error('[agro] deleteIrrigation', error)
      return fail('No se pudo eliminar el riego.')
    }

    revalidatePath('/dashboard/agro')
    return { ok: true, data: await getAgro() }
  } catch {
    return fail('No tienes permiso para gestionar agro.')
  }
}
