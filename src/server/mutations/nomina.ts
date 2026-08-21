'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { PAYROLL_STATUSES } from '@/lib/domain'
import { getNomina, type NominaData } from '@/server/queries/nomina'

export type NominaResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const BENEFIT_KINDS = ['Salud', 'Alimentación', 'Seguro', 'Transporte', 'Educación', 'Otro'] as const

const benefitSchema = z.object({
  name: z.string().trim().min(2, 'El nombre del beneficio es obligatorio.').max(120),
  kind: z.enum(BENEFIT_KINDS).default('Otro'),
  monthlyCostCents: z.number().int().min(0, 'El costo no puede ser negativo.').default(0),
  coveragePct: z.number().int().min(0).max(100).default(100),
})

export async function createBeneficio(
  input: z.input<typeof benefitSchema>,
): Promise<NominaResult<NominaData>> {
  try {
    const member = await requirePermission('nomina:write')
    const parsed = benefitSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase.from('benefits').insert({
      org_id: member.orgId,
      name: parsed.data.name,
      kind: parsed.data.kind,
      monthly_cost_cents: parsed.data.monthlyCostCents,
      coverage_pct: parsed.data.coveragePct,
    })

    if (error) {
      console.error('[nomina] createBeneficio', error)
      // 23505 = unique_violation on `(org_id, name)`.
      if (error.code === '23505') return fail('Ya existe un beneficio con ese nombre.')
      return fail('No se pudo crear el beneficio.')
    }

    revalidatePath('/dashboard/nomina')
    return { ok: true, data: await getNomina() }
  } catch {
    return fail('No tienes permiso para gestionar nómina.')
  }
}

const updateBenefitSchema = benefitSchema.extend({ id: z.uuid() })

export async function updateBeneficio(
  input: z.input<typeof updateBenefitSchema>,
): Promise<NominaResult<NominaData>> {
  try {
    const member = await requirePermission('nomina:write')
    const parsed = updateBenefitSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('benefits')
      .update({
        name: parsed.data.name,
        kind: parsed.data.kind,
        monthly_cost_cents: parsed.data.monthlyCostCents,
        coverage_pct: parsed.data.coveragePct,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[nomina] updateBeneficio', error)
      if (error.code === '23505') return fail('Ya existe un beneficio con ese nombre.')
      return fail('No se pudo actualizar el beneficio.')
    }

    revalidatePath('/dashboard/nomina')
    return { ok: true, data: await getNomina() }
  } catch {
    return fail('No tienes permiso para gestionar nómina.')
  }
}

export async function deleteBeneficio(id: string): Promise<NominaResult<NominaData>> {
  try {
    const member = await requirePermission('nomina:write')
    if (!z.uuid().safeParse(id).success) return fail('Beneficio desconocido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('benefits')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[nomina] deleteBeneficio', error)
      return fail('No se pudo eliminar el beneficio.')
    }

    revalidatePath('/dashboard/nomina')
    return { ok: true, data: await getNomina() }
  } catch {
    return fail('No tienes permiso para gestionar nómina.')
  }
}

const periodSchema = z.object({
  /** Any date inside the month; normalised to its first day. */
  period: z.string().date(),
})

/**
 * Open a payroll period, pre-filled with one line per active employee.
 *
 * There was no way to create a period at all before — the screen edited a
 * department's monthly cost directly, which is not a thing payroll has: cost
 * per department is the sum of what individual people are paid, and it moves
 * when they do.
 *
 * Lines start at zero. Filling them in is the payroll run; this just opens it.
 */
export async function openPeriod(
  input: z.input<typeof periodSchema>,
): Promise<NominaResult<NominaData>> {
  try {
    const member = await requirePermission('nomina:write')
    const parsed = periodSchema.safeParse(input)
    if (!parsed.success) return fail('Periodo inválido.')

    // `payroll_periods.period` is "first day of the payroll month" — normalised
    // here so two clicks on different days of the same month collide on the
    // `(org_id, period)` unique key rather than opening two periods.
    const first = `${parsed.data.period.slice(0, 7)}-01`

    const supabase = await createClient()
    const { data: period, error } = await supabase
      .from('payroll_periods')
      .insert({ org_id: member.orgId, period: first, status: 'Borrador' })
      .select('id')
      .single()

    if (error || !period) {
      console.error('[nomina] openPeriod', error)
      if (error?.code === '23505') return fail('Ese periodo de nómina ya está abierto.')
      return fail('No se pudo abrir el periodo.')
    }

    const { data: employees } = await supabase
      .from('employees')
      .select('id')
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .in('status', ['Activo', 'Onboarding', 'En licencia'])

    if (employees && employees.length > 0) {
      await supabase.from('payroll_lines').insert(
        employees.map((e) => ({ payroll_period_id: period.id, employee_id: e.id })),
      )
    }

    revalidatePath('/dashboard/nomina')
    return { ok: true, data: await getNomina() }
  } catch {
    return fail('No tienes permiso para gestionar nómina.')
  }
}

// ─── Nómina legal: reglas, conceptos, desglose, cierre ──────────────────────

const rulesSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  minWageCents: z.number().int().min(0).default(0),
  transportCents: z.number().int().min(0).default(0),
  cesantiasPct: z.number().min(0).max(100).default(8.33),
  primaPct: z.number().min(0).max(100).default(8.33),
  interesCesantiasPct: z.number().min(0).max(100).default(1),
  vacacionesPct: z.number().min(0).max(100).default(4.17),
  saludEmployeePct: z.number().min(0).max(100).default(4),
  saludEmployerPct: z.number().min(0).max(100).default(8.5),
  pensionEmployeePct: z.number().min(0).max(100).default(4),
  pensionEmployerPct: z.number().min(0).max(100).default(12),
  arlPct: z.number().min(0).max(100).default(0.52),
  cajaPct: z.number().min(0).max(100).default(3),
  vacationDays: z.number().int().min(0).max(60).default(15),
})

/**
 * Upsert the legal parameters for one year. Values come from the accountant;
 * the screen ships zeros and 4.3 requires external validation before prod.
 */
export async function saveRules(
  input: z.input<typeof rulesSchema>,
): Promise<NominaResult<NominaData>> {
  try {
    const member = await requirePermission('nomina:write')
    const parsed = rulesSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase.from('payroll_rules').upsert(
      {
        org_id: member.orgId,
        year: parsed.data.year,
        min_wage_cents: parsed.data.minWageCents,
        transport_cents: parsed.data.transportCents,
        cesantias_pct: parsed.data.cesantiasPct,
        prima_pct: parsed.data.primaPct,
        interes_cesantias_pct: parsed.data.interesCesantiasPct,
        vacaciones_pct: parsed.data.vacacionesPct,
        salud_employee_pct: parsed.data.saludEmployeePct,
        salud_employer_pct: parsed.data.saludEmployerPct,
        pension_employee_pct: parsed.data.pensionEmployeePct,
        pension_employer_pct: parsed.data.pensionEmployerPct,
        arl_pct: parsed.data.arlPct,
        caja_pct: parsed.data.cajaPct,
        vacation_days: parsed.data.vacationDays,
      },
      { onConflict: 'org_id,year' },
    )

    if (error) {
      console.error('[nomina] saveRules', error)
      return fail('No se pudieron guardar las reglas.')
    }

    revalidatePath('/dashboard/nomina')
    return { ok: true, data: await getNomina() }
  } catch {
    return fail('No tienes permiso para gestionar nómina.')
  }
}

const conceptSchema = z.object({
  name: z.string().trim().min(1, 'El nombre del concepto es obligatorio.').max(120),
  kind: z.enum(['Devengo', 'Deducción']),
})

export async function createConcept(
  input: z.input<typeof conceptSchema>,
): Promise<NominaResult<NominaData>> {
  try {
    const member = await requirePermission('nomina:write')
    const parsed = conceptSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { data: position } = await supabase
      .from('payroll_concepts')
      .select('position')
      .eq('org_id', member.orgId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { error } = await supabase.from('payroll_concepts').insert({
      org_id: member.orgId,
      name: parsed.data.name,
      kind: parsed.data.kind,
      position: (position?.position ?? -1) + 1,
    })

    if (error) {
      console.error('[nomina] createConcept', error)
      if (error.code === '23505') return fail('Ya existe un concepto con ese nombre.')
      return fail('No se pudo crear el concepto.')
    }

    revalidatePath('/dashboard/nomina')
    return { ok: true, data: await getNomina() }
  } catch {
    return fail('No tienes permiso para gestionar nómina.')
  }
}

export async function deleteConcept(id: string): Promise<NominaResult<NominaData>> {
  try {
    const member = await requirePermission('nomina:write')
    if (!z.uuid().safeParse(id).success) return fail('Concepto desconocido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('payroll_concepts')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[nomina] deleteConcept', error)
      // 23503 = referenced by a concept line: history keeps the name copy.
      if (error.code === '23503') return fail('El concepto ya está en uso; no se puede borrar.')
      return fail('No se pudo eliminar el concepto.')
    }

    revalidatePath('/dashboard/nomina')
    return { ok: true, data: await getNomina() }
  } catch {
    return fail('No tienes permiso para gestionar nómina.')
  }
}

const lineSchema = z.object({
  periodId: z.uuid(),
  employeeId: z.uuid(),
  lineId: z.uuid().nullable().optional(),
  name: z.string().trim().min(1, 'El concepto es obligatorio.').max(120),
  kind: z.enum(['Devengo', 'Deducción']),
  amountCents: z.number().int().min(1, 'El valor debe ser mayor a cero.'),
})

/** Recompute the `payroll_lines` snapshot of one employee from the desglose. */
async function recalcLine(
  supabase: Awaited<ReturnType<typeof createClient>>,
  periodId: string,
  employeeId: string,
) {
  const { data } = await supabase
    .from('payroll_concept_lines')
    .select('kind, amount_cents')
    .eq('payroll_period_id', periodId)
    .eq('employee_id', employeeId)

  const rows = (data ?? []) as Array<{ kind: string; amount_cents: number }>
  const gross = rows.filter((r) => r.kind === 'Devengo').reduce((s, r) => s + Number(r.amount_cents), 0)
  const deductions = rows.filter((r) => r.kind === 'Deducción').reduce((s, r) => s + Number(r.amount_cents), 0)
  await supabase
    .from('payroll_lines')
    .update({ gross_cents: gross, deductions_cents: deductions })
    .eq('payroll_period_id', periodId)
    .eq('employee_id', employeeId)
}

export async function saveLine(
  input: z.input<typeof lineSchema>,
): Promise<NominaResult<NominaData>> {
  try {
    const member = await requirePermission('nomina:write')
    const parsed = lineSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    if (parsed.data.lineId) {
      const { error } = await supabase
        .from('payroll_concept_lines')
        .update({ amount_cents: parsed.data.amountCents })
        .eq('id', parsed.data.lineId)
        .eq('org_id', member.orgId)
      if (error) return fail(lockedOr('No se pudo actualizar la línea.', error))
    } else {
      const { error } = await supabase.from('payroll_concept_lines').insert({
        org_id: member.orgId,
        payroll_period_id: parsed.data.periodId,
        employee_id: parsed.data.employeeId,
        name: parsed.data.name,
        kind: parsed.data.kind,
        amount_cents: parsed.data.amountCents,
      })
      if (error) {
        console.error('[nomina] saveLine', error)
        if (error.code === '23505') return fail('Ese concepto ya está en la nómina del empleado.')
        return fail(lockedOr('No se pudo añadir la línea.', error))
      }
    }

    await recalcLine(supabase, parsed.data.periodId, parsed.data.employeeId)
    revalidatePath('/dashboard/nomina')
    return { ok: true, data: await getNomina() }
  } catch {
    return fail('No tienes permiso para gestionar nómina.')
  }
}

export async function deleteLine(id: string): Promise<NominaResult<NominaData>> {
  try {
    const member = await requirePermission('nomina:write')
    if (!z.uuid().safeParse(id).success) return fail('Línea desconocida.')

    const supabase = await createClient()
    const { data: line } = await supabase
      .from('payroll_concept_lines')
      .select('payroll_period_id, employee_id')
      .eq('id', id)
      .eq('org_id', member.orgId)
      .maybeSingle()

    if (!line) return fail('La línea ya no existe.')

    const { error } = await supabase
      .from('payroll_concept_lines')
      .delete()
      .eq('id', id)
      .eq('org_id', member.orgId)
    if (error) return fail(lockedOr('No se pudo eliminar la línea.', error))

    await recalcLine(supabase, line.payroll_period_id, line.employee_id)
    revalidatePath('/dashboard/nomina')
    return { ok: true, data: await getNomina() }
  } catch {
    return fail('No tienes permiso para gestionar nómina.')
  }
}

/** Map the database guard codes (KG301/302/303) to human messages. */
function lockedOr(fallback: string, error: { message?: string; code?: string }): string {
  if (error.code === 'KG301') return 'El periodo está cerrado: no se puede modificar.'
  if (error.code === 'KG302') return 'Solo un administrador cierra periodos.'
  if (error.code === 'KG303') return 'El periodo ya está cerrado.'
  if (error.code === '23514') return 'El periodo está cerrado: no se puede modificar.'
  return `${fallback} (${error.message ?? error.code ?? 'error'})`
}

export async function lockPeriod(periodId: string): Promise<NominaResult<NominaData>> {
  try {
    await requirePermission('nomina:write')
    if (!z.uuid().safeParse(periodId).success) return fail('Periodo desconocido.')

    const supabase = await createClient()
    const { error } = await supabase.rpc('lock_payroll_period', { p_period_id: periodId })

    if (error) {
      console.error('[nomina] lockPeriod', error)
      return fail(lockedOr('No se pudo cerrar el periodo.', error))
    }

    revalidatePath('/dashboard/nomina')
    return { ok: true, data: await getNomina() }
  } catch {
    return fail('No tienes permiso para gestionar nómina.')
  }
}

/** Flat PILA export of the locked period, for manual upload. */
export async function exportPila(periodId: string) {
  await requirePermission('nomina:read')
  if (!z.uuid().safeParse(periodId).success) return []
  const supabase = await createClient()
  const { data } = await supabase.rpc('export_payroll_pila', { p_period_id: periodId })
  return (data ?? []) as Array<{
    tipo_documento: string
    documento: string
    nombre: string
    tipo_cotizante: string
    salario_base_cents: number
    salud_cents: number
    pension_cents: number
    arl_cents: number
    caja_cents: number
    total_aportes_cents: number
  }>
}

const statusSchema = z.object({
  period: z.string().date(),
  status: z.enum(PAYROLL_STATUSES),
})

export async function setPeriodStatus(
  input: z.input<typeof statusSchema>,
): Promise<NominaResult<NominaData>> {
  try {
    const member = await requirePermission('nomina:write')
    const parsed = statusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('payroll_periods')
      .update({ status: parsed.data.status })
      .eq('org_id', member.orgId)
      .eq('period', parsed.data.period)

    if (error) {
      console.error('[nomina] setPeriodStatus', error)
      return fail('No se pudo actualizar el periodo.')
    }

    revalidatePath('/dashboard/nomina')
    return { ok: true, data: await getNomina() }
  } catch {
    return fail('No tienes permiso para gestionar nómina.')
  }
}
