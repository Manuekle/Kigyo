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
