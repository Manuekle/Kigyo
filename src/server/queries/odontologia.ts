import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { scoped } from './shared'
import { todayIn, daysUntil } from '@/lib/domain'

/**
 * Odontograma, planes de tratamiento y laboratorio dental.
 *
 * Vive bajo `pacientes:read` / `pacientes:write` y no tiene permisos propios:
 * es profundidad de un módulo sectorial, no un módulo. Ver la migración 45.
 *
 * Se lee aparte de `getPacientes()` en vez de engordarlo, porque cinco de las
 * seis ramas de salud no lo usan: un laboratorio clínico no debería pagar tres
 * consultas más en cada carga de su pantalla de pacientes para traer tablas que
 * siempre le vuelven vacías.
 */

export interface ToothFinding {
  id: string
  tooth: number
  /** Null = el hallazgo es de la pieza entera. */
  surface: string | null
  condition: string
  notes: string
}

export interface ChartRow {
  id: string
  patientId: string
  patientName: string
  professionalName: string | null
  chartedOn: string
  kind: string
  notes: string
  findings: ToothFinding[]
  /** Piezas con algo distinto de «Sano». La cifra que se mira primero. */
  affected: number
}

export interface PlanItemRow {
  id: string
  tooth: number | null
  surface: string | null
  procedure: string
  priceCents: number
  status: string
  doneOn: string | null
  professionalName: string | null
  notes: string
}

export interface PlanRow {
  id: string
  code: string | null
  patientId: string
  patientName: string
  professionalName: string | null
  status: string
  proposedOn: string
  acceptedOn: string | null
  totalCents: number
  notes: string
  items: PlanItemRow[]
  /** Líneas hechas sobre líneas vivas. El avance real del tratamiento. */
  doneCount: number
  liveCount: number
}

export interface LabOrderRow {
  id: string
  code: string | null
  patientId: string
  patientName: string
  labName: string
  workType: string
  tooth: number | null
  sentOn: string
  dueOn: string | null
  receivedOn: string | null
  status: string
  costCents: number
  notes: string
  /** Días para la fecha de entrega. Negativo si ya se pasó. Null sin fecha. */
  daysLeft: number | null
}

export interface OdontologiaData {
  charts: ChartRow[]
  plans: PlanRow[]
  labOrders: LabOrderRow[]
  /** Trabajos fuera de la clínica que ya debieron volver. */
  labOverdue: number
  /** Procedimientos aceptados y todavía sin hacer. */
  pendingItems: number
  /** Valor de los planes aceptados o en curso, sin lo cancelado. */
  acceptedCents: number
  canWrite: boolean
}

export async function getOdontologia(): Promise<OdontologiaData> {
  const member = await requirePermission('pacientes:read')
  const supabase = await createClient()
  const today = todayIn(member.orgTimezone)

  const [chartsResult, plansResult, labResult, patientsResult] = await Promise.all([
    scoped(supabase, member, 'dental_charts')
      .select('id, patient_id, professional_id, charted_on, kind, notes')
      .order('charted_on', { ascending: false })
      .limit(200),
    scoped(supabase, member, 'treatment_plans')
      .select('id, code, patient_id, professional_id, status, proposed_on, accepted_on, total_cents, notes')
      .is('deleted_at', null)
      .order('proposed_on', { ascending: false })
      .limit(200),
    scoped(supabase, member, 'dental_lab_orders')
      .select('id, code, patient_id, lab_name, work_type, tooth, sent_on, due_on, received_on, status, cost_cents, notes')
      .order('sent_on', { ascending: false })
      .limit(200),
    // Los nombres, una vez. Los tres listados los necesitan y hacer tres joins
    // anidados por PostgREST cuesta más que un diccionario.
    scoped(supabase, member, 'patients')
      .select('id, full_name')
      .is('deleted_at', null)
      .limit(2000),
  ])

  const patientName = new Map(
    ((patientsResult.data ?? []) as unknown as Array<{ id: string; full_name: string }>)
      .map((p) => [p.id, p.full_name]),
  )

  const chartRows = (chartsResult.data ?? []) as unknown as Array<{
    id: string; patient_id: string; professional_id: string | null
    charted_on: string; kind: string; notes: string
  }>
  const planRows = (plansResult.data ?? []) as unknown as Array<{
    id: string; code: string | null; patient_id: string; professional_id: string | null
    status: string; proposed_on: string; accepted_on: string | null
    total_cents: number; notes: string
  }>

  // Los hijos, en dos consultas y no en 2N. `in` sobre los padres ya leídos es
  // lo que mantiene esta pantalla en cinco round trips en vez de doscientos.
  const [findingsResult, itemsResult, staffResult] = await Promise.all([
    chartRows.length > 0
      ? supabase
          .from('dental_chart_teeth')
          .select('id, chart_id, tooth, surface, condition, notes')
          .in('chart_id', chartRows.map((c) => c.id))
          .order('tooth', { ascending: true })
      : Promise.resolve({ data: [] as Array<{
          id: string; chart_id: string; tooth: number
          surface: string | null; condition: string; notes: string
        }> }),
    planRows.length > 0
      ? supabase
          .from('treatment_plan_items')
          .select('id, plan_id, tooth, surface, procedure, price_cents, status, done_on, professional_id, notes, sort')
          .in('plan_id', planRows.map((p) => p.id))
          .order('sort', { ascending: true })
      : Promise.resolve({ data: [] as Array<{
          id: string; plan_id: string; tooth: number | null; surface: string | null
          procedure: string; price_cents: number; status: string; done_on: string | null
          professional_id: string | null; notes: string; sort: number
        }> }),
    scoped(supabase, member, 'employees')
      .select('id, full_name')
      .is('deleted_at', null)
      .limit(500),
  ])

  const staffName = new Map(
    ((staffResult.data ?? []) as unknown as Array<{ id: string; full_name: string }>)
      .map((e) => [e.id, e.full_name]),
  )

  const findingsByChart = new Map<string, ToothFinding[]>()
  for (const row of findingsResult.data ?? []) {
    const finding: ToothFinding = {
      id: row.id,
      tooth: row.tooth,
      surface: row.surface,
      condition: row.condition,
      notes: row.notes,
    }
    const list = findingsByChart.get(row.chart_id)
    if (list) list.push(finding)
    else findingsByChart.set(row.chart_id, [finding])
  }

  const itemsByPlan = new Map<string, PlanItemRow[]>()
  for (const row of itemsResult.data ?? []) {
    const item: PlanItemRow = {
      id: row.id,
      tooth: row.tooth,
      surface: row.surface,
      procedure: row.procedure,
      priceCents: row.price_cents,
      status: row.status,
      doneOn: row.done_on,
      professionalName: row.professional_id ? staffName.get(row.professional_id) ?? null : null,
      notes: row.notes,
    }
    const list = itemsByPlan.get(row.plan_id)
    if (list) list.push(item)
    else itemsByPlan.set(row.plan_id, [item])
  }

  const charts: ChartRow[] = chartRows.map((row) => {
    const findings = findingsByChart.get(row.id) ?? []
    return {
      id: row.id,
      patientId: row.patient_id,
      patientName: patientName.get(row.patient_id) ?? '—',
      professionalName: row.professional_id ? staffName.get(row.professional_id) ?? null : null,
      chartedOn: row.charted_on,
      kind: row.kind,
      notes: row.notes,
      findings,
      // Piezas distintas, no hallazgos: una pieza con caries en dos caras es
      // una pieza afectada, y contarla dos veces exagera el cuadro.
      affected: new Set(
        findings.filter((f) => f.condition !== 'Sano').map((f) => f.tooth),
      ).size,
    }
  })

  const plans: PlanRow[] = planRows.map((row) => {
    const items = itemsByPlan.get(row.id) ?? []
    const live = items.filter((i) => i.status !== 'Cancelado')
    return {
      id: row.id,
      code: row.code,
      patientId: row.patient_id,
      patientName: patientName.get(row.patient_id) ?? '—',
      professionalName: row.professional_id ? staffName.get(row.professional_id) ?? null : null,
      status: row.status,
      proposedOn: row.proposed_on,
      acceptedOn: row.accepted_on,
      totalCents: row.total_cents,
      notes: row.notes,
      items,
      doneCount: live.filter((i) => i.status === 'Hecho').length,
      liveCount: live.length,
    }
  })

  const labOrders: LabOrderRow[] = ((labResult.data ?? []) as unknown as Array<{
    id: string; code: string | null; patient_id: string; lab_name: string
    work_type: string; tooth: number | null; sent_on: string; due_on: string | null
    received_on: string | null; status: string; cost_cents: number; notes: string
  }>).map((row) => ({
    id: row.id,
    code: row.code,
    patientId: row.patient_id,
    patientName: patientName.get(row.patient_id) ?? '—',
    labName: row.lab_name,
    workType: row.work_type,
    tooth: row.tooth,
    sentOn: row.sent_on,
    dueOn: row.due_on,
    receivedOn: row.received_on,
    status: row.status,
    costCents: row.cost_cents,
    notes: row.notes,
    // Solo cuenta mientras no haya vuelto: un trabajo recibido tarde ya no es
    // un problema, y dejarlo en rojo entrena a ignorar el rojo.
    daysLeft: row.due_on && !row.received_on ? daysUntil(row.due_on, today) : null,
  }))

  const accepted = plans.filter((p) => p.status === 'Aceptado' || p.status === 'En curso')

  return {
    charts,
    plans,
    labOrders,
    labOverdue: labOrders.filter((l) => l.daysLeft !== null && l.daysLeft < 0).length,
    pendingItems: accepted.reduce(
      (sum, p) => sum + p.items.filter((i) => i.status === 'Pendiente').length, 0,
    ),
    acceptedCents: accepted.reduce((sum, p) => sum + p.totalCents, 0),
    canWrite: can(member.permissions, 'pacientes:write'),
  }
}
