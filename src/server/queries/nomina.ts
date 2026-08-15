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

/** `payroll_rules` del año del periodo actual; null si aún no existe. */
export interface PayrollRulesRow {
  year: number
  minWageCents: number
  transportCents: number
  cesantiasPct: number
  primaPct: number
  interesCesantiasPct: number
  vacacionesPct: number
  saludEmployeePct: number
  saludEmployerPct: number
  pensionEmployeePct: number
  pensionEmployerPct: number
  arlPct: number
  cajaPct: number
  vacationDays: number
}

export interface ConceptRow {
  id: string
  name: string
  kind: 'Devengo' | 'Deducción'
}

export interface ConceptLineRow {
  id: string
  name: string
  kind: 'Devengo' | 'Deducción'
  amountCents: number
}

/** Una línea de nómina del periodo actual con su desglose completo. */
export interface EmployeeLineRow {
  employeeId: string
  fullName: string
  department: string | null
  taxId: string
  lines: ConceptLineRow[]
  grossCents: number
  deductionsCents: number
  netCents: number
}

export interface NominaData {
  /** Newest period first. */
  periods: PayrollPointRow[]
  /** Department breakdown of the newest period. */
  areas: PayrollAreaRow[]
  beneficios: BeneficioRow[]
  currentPeriod: string | null
  canWrite: boolean
  /** Id of the newest period, for breakdown edits and the lock RPC. */
  periodId: string | null
  /** Newest period is closed: breakdown is read-only. */
  periodLocked: boolean
  /** Rules of the newest period's year; null until the accountant sets them. */
  rules: PayrollRulesRow | null
  concepts: ConceptRow[]
  /** Per-employee breakdown of the newest period. */
  breakdown: EmployeeLineRow[]
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

  const [periodsResult, benefitsResult, conceptsResult, rulesResult] = await Promise.all([
    supabase
      .from('payroll_periods')
      .select('id, period, status, locked_at')
      .eq('org_id', member.orgId)
      .order('period', { ascending: false })
      .limit(12),
    supabase
      .from('benefits')
      .select('id, name, kind, monthly_cost_cents, coverage_pct')
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('name', { ascending: true }),
    supabase
      .from('payroll_concepts')
      .select('id, name, kind')
      .eq('org_id', member.orgId)
      .order('position', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('payroll_rules')
      .select('*')
      .eq('org_id', member.orgId)
      .order('year', { ascending: false })
      .limit(1),
  ])

  if (periodsResult.error) {
    console.error('[nomina] getNomina', periodsResult.error)
    return {
      periods: [], areas: [], beneficios: [], currentPeriod: null, canWrite: false,
      periodId: null, periodLocked: false, rules: null, concepts: [], breakdown: [],
    }
  }

  const periodRows = (periodsResult.data ?? []) as Array<{
    id: string; period: string; status: string; locked_at: string | null
  }>

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

  // Per-employee breakdown of the newest period: the live source of truth is
  // the concept lines, so gross/net are summed here instead of trusting the
  // `payroll_lines` snapshot (which only moves when a line is edited or the
  // period is locked).
  let breakdown: EmployeeLineRow[] = []
  if (newest) {
    const { data: conceptRows } = await supabase
      .from('payroll_concept_lines')
      .select('id, employee_id, name, kind, amount_cents')
      .eq('payroll_period_id', newest.id)
      .order('position', { ascending: true })
      .order('name', { ascending: true })

    const byEmployee = new Map<string, ConceptLineRow[]>()
    for (const c of (conceptRows ?? []) as Array<{
      id: string; employee_id: string; name: string; kind: 'Devengo' | 'Deducción'; amount_cents: number
    }>) {
      const bucket = byEmployee.get(c.employee_id) ?? []
      bucket.push({ id: c.id, name: c.name, kind: c.kind, amountCents: Number(c.amount_cents) })
      byEmployee.set(c.employee_id, bucket)
    }

    const { data: lineRows } = await supabase
      .from('payroll_lines')
      .select('employee_id, gross_cents, deductions_cents, employees ( full_name, department, tax_id )')
      .eq('payroll_period_id', newest.id)

    breakdown = ((lineRows ?? []) as Array<{
      employee_id: string; gross_cents: number; deductions_cents: number
      employees: { full_name: string; department: string | null; tax_id: string | null } | null
    }>)
      .map((r) => {
      const employee = r.employees ?? { full_name: 'Empleado', department: null, tax_id: null }
      const employeeLines = byEmployee.get(r.employee_id) ?? []
      const gross = employeeLines
        .filter((l) => l.kind === 'Devengo')
        .reduce((s, l) => s + l.amountCents, 0)
      const deductions = employeeLines
        .filter((l) => l.kind === 'Deducción')
        .reduce((s, l) => s + l.amountCents, 0)
      return {
        employeeId: r.employee_id,
        fullName: employee.full_name,
        department: employee.department,
        taxId: employee.tax_id ?? '',
        lines: employeeLines,
        grossCents: gross,
        deductionsCents: deductions,
        netCents: gross - deductions,
      }
    })
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'))
  }

  const rulesRow = (rulesResult.data ?? [])[0] as Record<string, unknown> | null
  const numberFrom = (k: string) => Number(rulesRow?.[k] ?? 0)

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
    periodId: newest?.id ?? null,
    periodLocked: newest?.locked_at !== null && newest?.locked_at !== undefined,
    rules: rulesRow
      ? {
          year: numberFrom('year'),
          minWageCents: numberFrom('min_wage_cents'),
          transportCents: numberFrom('transport_cents'),
          cesantiasPct: numberFrom('cesantias_pct'),
          primaPct: numberFrom('prima_pct'),
          interesCesantiasPct: numberFrom('interes_cesantias_pct'),
          vacacionesPct: numberFrom('vacaciones_pct'),
          saludEmployeePct: numberFrom('salud_employee_pct'),
          saludEmployerPct: numberFrom('salud_employer_pct'),
          pensionEmployeePct: numberFrom('pension_employee_pct'),
          pensionEmployerPct: numberFrom('pension_employer_pct'),
          arlPct: numberFrom('arl_pct'),
          cajaPct: numberFrom('caja_pct'),
          vacationDays: numberFrom('vacation_days'),
        }
      : null,
    concepts: ((conceptsResult.data ?? []) as Array<{
      id: string; name: string; kind: 'Devengo' | 'Deducción'
    }>).map((c) => ({ id: c.id, name: c.name, kind: c.kind })),
    breakdown,
  }
}
