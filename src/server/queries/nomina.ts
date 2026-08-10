import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'

/**
 * Payroll, read through RLS.
 *
 * The screen used to hold six departments with typed-in monthly costs, three
 * benefits, and a six-point history array `[178, 182, …]` labelled Ene–Jun
 * that the chart multiplied by a million. Editing a department's cost wrote to
 * `useState`; the history never moved at all, so "Variación mensual" was a
 * constant computed from two literals.
 *
 * `payroll_periods` + `payroll_lines` carry real figures per employee per
 * month, so the department breakdown is a group-by and the history is the
 * periods themselves.
 */

export interface PayrollAreaRow {
  area: string
  headcount: number
  costCents: number
}

export interface PayrollPointRow {
  /** First day of the month, ISO date. */
  period: string
  status: string
  totalCents: number
}

export interface BeneficioRow {
  id: string
  name: string
  kind: string
  monthlyCostCents: number
  coveragePct: number
}

export interface NominaData {
  /** Newest period first. */
  periods: PayrollPointRow[]
  /** Department breakdown of the newest period. */
  areas: PayrollAreaRow[]
  beneficios: BeneficioRow[]
  currentPeriod: string | null
  canWrite: boolean
}

interface LineRecord {
  gross_cents: number
  deductions_cents: number
  payroll_period_id: string
  employees: { department: string } | null
}

export async function getNomina(): Promise<NominaData> {
  const member = await requirePermission('nomina:read')
  const supabase = await createClient()

  const [periodsResult, benefitsResult] = await Promise.all([
    supabase
      .from('payroll_periods')
      .select('id, period, status')
      .eq('org_id', member.orgId)
      .order('period', { ascending: false })
      .limit(12),
    supabase
      .from('benefits')
      .select('id, name, kind, monthly_cost_cents, coverage_pct')
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('name', { ascending: true }),
  ])

  if (periodsResult.error) {
    console.error('[nomina] getNomina', periodsResult.error)
    return { periods: [], areas: [], beneficios: [], currentPeriod: null, canWrite: false }
  }

  const periodRows = (periodsResult.data ?? []) as Array<{ id: string; period: string; status: string }>

  // Totals for every loaded period in one pass, rather than a query per point
  // on the chart. RLS on `payroll_lines` inherits from `payroll_periods`, so
  // this cannot reach another organization's payroll.
  const { data: lineData } = periodRows.length
    ? await supabase
        .from('payroll_lines')
        .select('payroll_period_id, gross_cents, deductions_cents, employees ( department )')
        .in('payroll_period_id', periodRows.map((p) => p.id))
    : { data: [] }

  const lines = (lineData ?? []) as unknown as LineRecord[]

  const totalByPeriod = new Map<string, number>()
  for (const line of lines) {
    // Cost to the company is gross; deductions are withheld from the employee,
    // not saved by the employer. Summing net here would understate payroll.
    const prev = totalByPeriod.get(line.payroll_period_id) ?? 0
    totalByPeriod.set(line.payroll_period_id, prev + Number(line.gross_cents))
  }

  const periods: PayrollPointRow[] = periodRows.map((p) => ({
    period: p.period,
    status: p.status,
    totalCents: totalByPeriod.get(p.id) ?? 0,
  }))

  const newest = periodRows[0]
  const areaMap = new Map<string, { headcount: number; costCents: number }>()
  if (newest) {
    for (const line of lines) {
      if (line.payroll_period_id !== newest.id) continue
      const area = line.employees?.department || 'Sin área'
      const bucket = areaMap.get(area) ?? { headcount: 0, costCents: 0 }
      bucket.headcount += 1
      bucket.costCents += Number(line.gross_cents)
      areaMap.set(area, bucket)
    }
  }

  return {
    periods,
    areas: [...areaMap.entries()]
      .map(([area, v]) => ({ area, headcount: v.headcount, costCents: v.costCents }))
      .sort((a, b) => b.costCents - a.costCents),
    beneficios: ((benefitsResult.data ?? []) as Array<{
      id: string; name: string; kind: string; monthly_cost_cents: number; coverage_pct: number
    }>).map((b) => ({
      id: b.id,
      name: b.name,
      kind: b.kind,
      monthlyCostCents: Number(b.monthly_cost_cents),
      coveragePct: b.coverage_pct,
    })),
    currentPeriod: newest?.period ?? null,
    canWrite: can(member.permissions, 'nomina:write'),
  }
}
