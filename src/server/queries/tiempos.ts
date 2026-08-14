import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { rosterFor, scoped, type ProjectRef, type RosterEntry } from './shared'

/**
 * Horas facturables por persona, proyecto y tarifa — el módulo tiempos.
 *
 * No es asistencia ni nómina. Asistencia responde «¿estuvo?»; tiempos responde
 * «¿en qué gastó la hora y a cuánto la cobramos?». Una fila es una hora (o
 * fracción, en minutos): quién la trabajó, en qué proyecto, cuándo, cuánto
 * duró, a qué tarifa y una nota. La facturación se hace desde facturacion, con
 * los datos de aquí como insumo.
 *
 * `employee_id` y `project_id` son opcionales: borrar un proyecto no borra las
 * horas que alguien le facturó a un cliente, y hay horas que se trabajan para
 * la empresa sin proyecto ni persona asignados todavía.
 */

export interface TimeRow {
  id: string
  employeeId: string | null
  employeeName: string | null
  projectId: string | null
  projectName: string | null
  workDate: string
  minutes: number
  rateCents: number | null
  notes: string | null
}

export interface TiemposData {
  /** Horas registradas, de la más reciente hacia atrás. */
  entries: TimeRow[]
  /** El directorio, para el selector de persona. */
  employees: RosterEntry[]
  /** Proyectos vivos, para el selector de proyecto. */
  projects: ProjectRef[]
  /** Suma de minutos de `entries`. */
  totalMinutes: number
}

interface TimeRecord {
  id: string
  employee_id: string | null
  project_id: string | null
  work_date: string
  minutes: number
  rate_cents: number | null
  notes: string | null
  employees: { full_name: string } | null
  projects: { name: string } | null
}

function toTimeRow(row: TimeRecord): TimeRow {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employees?.full_name ?? null,
    projectId: row.project_id,
    projectName: row.projects?.name ?? null,
    workDate: row.work_date,
    minutes: row.minutes,
    rateCents: row.rate_cents,
    notes: row.notes,
  }
}

export async function getTiempos(): Promise<TiemposData> {
  const member = await requirePermission('tiempos:read')
  const supabase = await createClient()

  const [entriesResult, employees, projectsResult] = await Promise.all([
    scoped(supabase, member, 'time_entries')
      .select(
        'id, employee_id, project_id, work_date, minutes, rate_cents, notes, ' +
          'employees ( full_name ), projects ( name )',
      )
      .order('work_date', { ascending: false })
      .order('created_at', { ascending: false }),
    rosterFor(supabase, member),
    // Los proyectos son una dependencia blanda del módulo: sin `proyectos:read`
    // RLS devuelve una lista vacía, que es lo que el selector debe mostrar.
    scoped(supabase, member, 'projects')
      .select('id, code, name')
      .is('deleted_at', null)
      .order('name', { ascending: true }),
  ])

  const rows = ((entriesResult.data ?? []) as unknown as TimeRecord[]).map(toTimeRow)

  return {
    entries: rows,
    employees,
    projects: (projectsResult.data ?? []) as unknown as ProjectRef[],
    totalMinutes: rows.reduce((sum, row) => sum + row.minutes, 0),
  }
}
