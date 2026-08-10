import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { PROJECT_KINDS, PROJECT_STATUSES } from '@/lib/domain'
import { pageRange, totalOf, type Page } from './shared'

// Re-exported so a server caller can reach them from one place; the values
// themselves live in lib/domain, which is safe for a client to import.
export { PROJECT_KINDS, PROJECT_STATUSES }

/**
 * Projects, read through RLS.
 *
 * The screen used to hold seven invented solar projects in `useState`, with
 * the team as an array of typed-in names (`['Andrés Mora', 'Juan Pérez']`)
 * that matched nobody in the directory. `projects` and `project_members` have
 * both existed since the first operations migration, and `canales` already
 * attaches real projects to messages — so the two screens were showing
 * different project lists to the same user.
 */

export interface ProyectoMember {
  employeeId: string
  fullName: string
  role: string
}

export interface ProyectoRow {
  id: string
  code: string | null
  name: string
  client: string
  location: string
  kind: string
  capacityKwp: number | null
  status: string
  progress: number
  /** Minor units. Every amount in this schema is cents; never a float peso. */
  budgetCents: number
  startsOn: string | null
  endsOn: string | null
  team: ProyectoMember[]
}

export interface ProyectosData {
  proyectos: ProyectoRow[]
  /** Projects in the organization, of which `proyectos` is the first page. */
  proyectosTotal: number
  /** Directory for the team picker; empty without `empleados:read`. */
  roster: Array<{ employeeId: string; fullName: string; position: string }>
  canWrite: boolean
}

interface ProjectRecord {
  id: string
  code: string | null
  name: string
  client: string
  location: string
  kind: string
  capacity_kwp: number | null
  status: string
  progress: number
  budget_cents: number
  starts_on: string | null
  ends_on: string | null
  project_members: Array<{
    employee_id: string
    role: string
    employees: { full_name: string } | null
  }> | null
}

export const PROJECT_COLUMNS =
  'id, code, name, client, location, kind, capacity_kwp, status, progress, budget_cents, starts_on, ends_on'

/** The list shape: every project with its team, which the cards all render. */
const PROJECT_LIST_COLUMNS =
  `${PROJECT_COLUMNS}, project_members ( employee_id, role, employees ( full_name ) )`

function toProyecto(row: ProjectRecord): ProyectoRow {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    client: row.client,
    location: row.location,
    kind: row.kind,
    capacityKwp: row.capacity_kwp,
    status: row.status,
    progress: row.progress,
    budgetCents: row.budget_cents,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    team: (row.project_members ?? []).map((m) => ({
      employeeId: m.employee_id,
      // Null when the colleague was removed from the roster. The membership
      // row survives on purpose — who worked on a project is history.
      fullName: m.employees?.full_name ?? 'Alguien que ya no está en la organización',
      role: m.role,
    })),
  }
}

/** One page of projects, newest first. */
export async function getProyectosPage(offset = 0): Promise<Page<ProyectoRow>> {
  const member = await requirePermission('proyectos:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('projects')
    .select(PROJECT_LIST_COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[proyectos] getProyectosPage', error)
    return { rows: [], total: 0 }
  }

  return {
    rows: (data as unknown as ProjectRecord[]).map(toProyecto),
    total: totalOf(count, data.length, from),
  }
}

export async function getProyectos(): Promise<ProyectosData> {
  const member = await requirePermission('proyectos:read')
  const supabase = await createClient()

  const canReadRoster =
    can(member.permissions, 'empleados:read') && member.modules.has('empleados')

  const [projectsResult, rosterResult] = await Promise.all([
    supabase
      .from('projects')
      // The team is embedded rather than fetched per project: seven projects
      // meant seven extra round trips, and the list renders every team.
      .select(PROJECT_LIST_COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(...pageRange(0)),
    canReadRoster
      ? supabase
          .from('employees')
          .select('id, full_name, position')
          .eq('org_id', member.orgId)
          .is('deleted_at', null)
          .neq('status', 'Salida')
          .order('full_name', { ascending: true })
          .limit(200)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (projectsResult.error) {
    console.error('[proyectos] getProyectos', projectsResult.error)
    return { proyectos: [], proyectosTotal: 0, roster: [], canWrite: false }
  }

  const proyectos = (projectsResult.data as unknown as ProjectRecord[]).map(toProyecto)

  return {
    proyectos,
    proyectosTotal: totalOf(projectsResult.count, proyectos.length),
    roster: ((rosterResult.data ?? []) as Array<{ id: string; full_name: string; position: string }>)
      .map((r) => ({ employeeId: r.id, fullName: r.full_name, position: r.position })),
    canWrite: can(member.permissions, 'proyectos:write'),
  }
}
