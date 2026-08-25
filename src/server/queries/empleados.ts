import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can, type RoleKey } from '@/lib/auth/permissions'
import { getRoles, type RoleRow } from './roles'
import { pageRange, totalOf, scoped, type Page } from './shared'

/**
 * The employee directory, read through RLS.
 *
 * The screen used to render eight invented colleagues from
 * `src/lib/data/empleados.ts` held in `useState`. Adding someone appended to
 * that array; reloading the page dropped them. The `employees` table has been
 * there since the first migration, along with the org chart's `manager_id` and
 * the `EMP-0001` codes the `employees_code` trigger mints.
 */

export interface EmpleadoRow {
  id: string
  code: string | null
  fullName: string
  email: string | null
  position: string
  department: string
  location: string
  status: string
  employmentType: string
  intendedRole: RoleKey
  /** Null for the top of the org chart. Points at another row's `id`. */
  managerId: string | null
  hiredOn: string | null
  /** True for the row belonging to the signed-in user, if they have one. */
  isSelf: boolean
  /** Sucursal where this person works, if one is assigned. */
  siteId: string | null
  siteName: string | null
}

export interface EmpleadosData {
  empleados: EmpleadoRow[]
  /** People in the directory, of which `empleados` is the first page. */
  empleadosTotal: number
  canWrite: boolean
  /** Distinct values already in use, so the form offers what the org uses. */
  departments: string[]
  locations: string[]
  /**
   * The organization's roles, for the "Rol de acceso" picker.
   *
   * Passed down rather than imported by the client: the set is tenant data
   * since migration 24, so a hard-coded list here would offer three options to
   * an organization that defined eight and reject the other five at the write.
   */
  roles: RoleRow[]
  /** The company's sucursales, for the site picker on the forms. */
  sites: Array<{ id: string; name: string }>
}

/** Columns shared by the list and the detail read, so the two cannot drift. */
export const EMPLOYEE_COLUMNS =
  'id, code, full_name, email, position, department, location, status, employment_type, intended_role, manager_id, hired_on, user_id, site_id, sites ( name )'

interface EmployeeRecord {
  id: string
  code: string | null
  full_name: string
  email: string | null
  position: string
  department: string
  location: string
  status: string
  employment_type: string
  intended_role: string
  manager_id: string | null
  hired_on: string | null
  user_id: string | null
  site_id: string | null
  sites: { name: string } | null
}

function toRow(row: EmployeeRecord, userId: string): EmpleadoRow {
  return {
    id: row.id,
    code: row.code,
    fullName: row.full_name,
    email: row.email,
    position: row.position,
    department: row.department,
    location: row.location,
    status: row.status,
    employmentType: row.employment_type,
    // Passed through rather than checked against a whitelist. The column is a
    // composite FK to the organization's own `roles` table, so whatever is
    // stored is by definition a role this organization defines — and since
    // migration 24 that set is the customer's to extend. The old whitelist
    // would have silently relabelled «Médico» as «Empleado».
    intendedRole: row.intended_role,
    managerId: row.manager_id,
    hiredOn: row.hired_on,
    isSelf: row.user_id !== null && row.user_id === userId,
    siteId: row.site_id,
    siteName: row.sites?.name ?? null,
  }
}

/** One page of the directory, alphabetical. */
export async function getEmpleadosPage(offset = 0): Promise<Page<EmpleadoRow>> {
  const member = await requirePermission('empleados:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('employees')
    .select(EMPLOYEE_COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('full_name', { ascending: true })
    .range(from, to)

  if (error) {
    console.error('[empleados] getEmpleadosPage', error)
    return { rows: [], total: 0 }
  }

  return {
    rows: (data as EmployeeRecord[]).map((row) => toRow(row, member.userId)),
    total: totalOf(count, data.length, from),
  }
}

export async function getEmpleados(): Promise<EmpleadosData> {
  const member = await requirePermission('empleados:read')
  const supabase = await createClient()

  const [pageResult, facetsResult, roles, sitesResult] = await Promise.all([
    supabase
      .from('employees')
      .select(EMPLOYEE_COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('full_name', { ascending: true })
      .range(...pageRange(0)),
    // Two text columns over the whole directory. The form offers "what this
    // organization already uses", and deriving that from the first page would
    // quietly drop every department whose people sort after the letter M.
    supabase
      .from('employees')
      .select('department, location')
      .eq('org_id', member.orgId)
      .is('deleted_at', null),
    getRoles(member.orgId),
    scoped(supabase, member, 'sites')
      .select('id, name')
      .is('deleted_at', null)
      .order('name', { ascending: true }),
  ])

  if (pageResult.error) {
    console.error('[empleados] getEmpleados', pageResult.error)
    return {
      empleados: [], empleadosTotal: 0, canWrite: false,
      departments: [], locations: [], roles, sites: [],
    }
  }

  const empleados = (pageResult.data as EmployeeRecord[]).map((row) => toRow(row, member.userId))
  const facets = (facetsResult.data ?? []) as Array<{ department: string; location: string }>
  const sites = ((sitesResult.data ?? []) as Array<{ id: string; name: string }>)

  return {
    empleados,
    empleadosTotal: totalOf(pageResult.count, empleados.length),
    canWrite: can(member.permissions, 'empleados:write'),
    departments: [...new Set(facets.map((e) => e.department).filter(Boolean))].sort(),
    locations: [...new Set(facets.map((e) => e.location).filter(Boolean))].sort(),
    roles,
    sites,
  }
}

export interface EmpleadoSkill { skill: string; level: number }
// `id` viaja porque la ficha ya no solo lee la trayectoria: también borra un
// hito mal registrado, y para eso hace falta nombrarlo.
export interface EmpleadoEvent { id: string; occurredOn: string; event: string; tag: string }
export interface EmpleadoTicket {
  id: string
  code: string | null
  subject: string
  area: string
  priority: string
  status: string
  /** How this person relates to the ticket, for the "Rol" column. */
  relation: 'Solicitante' | 'Asignado'
}

export interface EmpleadoDetail {
  empleado: EmpleadoRow
  managerName: string | null
  reports: Array<{ id: string; fullName: string; position: string }>
  skills: EmpleadoSkill[]
  journey: EmpleadoEvent[]
  tickets: EmpleadoTicket[]
  canWrite: boolean
}

/**
 * One employee, with everything the profile shows.
 *
 * `id` is not trusted: the `.eq` runs under RLS, so an id belonging to another
 * organization returns nothing rather than someone else's personnel record.
 *
 * Skills, journey and tickets all used to be keyed by the person's *name*
 * against fixtures in `lib/data` — `SKILL_LEVELS['Valentina Torres']`. Every
 * one of them has had a table since the first migration.
 */
export async function getEmpleadoDetail(id: string): Promise<EmpleadoDetail | null> {
  const member = await requirePermission('empleados:read')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('employees')
    .select(EMPLOYEE_COLUMNS)
    .eq('id', id)
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !data) return null
  const empleado = toRow(data as EmployeeRecord, member.userId)

  const canReadTickets = can(member.permissions, 'tickets:read') && member.modules.has('tickets')

  const [managerResult, reportsResult, skillsResult, journeyResult, ticketsResult] =
    await Promise.all([
      empleado.managerId
        ? supabase.from('employees').select('full_name').eq('id', empleado.managerId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from('employees')
        .select('id, full_name, position')
        .eq('manager_id', id)
        .eq('org_id', member.orgId)
        .is('deleted_at', null)
        .order('full_name', { ascending: true }),
      supabase
        .from('employee_skills')
        .select('skill, level')
        .eq('employee_id', id)
        .order('level', { ascending: false }),
      supabase
        .from('employee_events')
        .select('id, occurred_on, event, tag')
        .eq('employee_id', id)
        .order('occurred_on', { ascending: false })
        .limit(20),
      // The profile is under `empleados:read`; the tickets it lists are not.
      // Someone who may see the directory but not the ticket queue should not
      // read a colleague's open requests through this page.
      canReadTickets
        ? supabase
            .from('tickets')
            .select('id, code, subject, area, priority, status, requester_id, assignee_id')
            .eq('org_id', member.orgId)
            .is('deleted_at', null)
            .or(`requester_id.eq.${id},assignee_id.eq.${id}`)
            .order('created_at', { ascending: false })
            .limit(25)
        : Promise.resolve({ data: [], error: null }),
    ])

  const manager = managerResult.data as { full_name: string } | null

  return {
    empleado,
    managerName: manager?.full_name ?? null,
    reports: ((reportsResult.data ?? []) as Array<{ id: string; full_name: string; position: string }>)
      .map((r) => ({ id: r.id, fullName: r.full_name, position: r.position })),
    skills: ((skillsResult.data ?? []) as Array<{ skill: string; level: number }>)
      .map((r) => ({ skill: r.skill, level: r.level })),
    journey: ((journeyResult.data ?? []) as Array<{ id: string; occurred_on: string; event: string; tag: string }>)
      .map((r) => ({ id: r.id, occurredOn: r.occurred_on, event: r.event, tag: r.tag })),
    tickets: ((ticketsResult.data ?? []) as Array<{
      id: string
      code: string | null
      subject: string
      area: string
      priority: string
      status: string
      requester_id: string | null
      assignee_id: string | null
    }>).map((t) => ({
      id: t.id,
      code: t.code,
      subject: t.subject,
      area: t.area,
      priority: t.priority,
      status: t.status,
      relation: t.requester_id === id ? 'Solicitante' : 'Asignado',
    })),
    canWrite: can(member.permissions, 'empleados:write'),
  }
}
