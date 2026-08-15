import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { scoped } from './shared'

/**
 * Puestos: dónde vigila la empresa y quién cubre cada turno.
 *
 * Un puesto es el lugar que no puede quedar sin nadie; un turno es quién lo
 * cubre y cuándo. El turno sin guarda no es un dato vacío — es una vacante,
 * y por eso la pantalla la cuenta y la hace visible.
 *
 * `client_id` y `employee_id` son opcionales: borrar un cliente o dar de baja
 * a un empleado no borra el puesto ni el turno — la cobertura puede quedar
 * por reasignar, que es justamente lo que el módulo vigila.
 */

export interface PostRow {
  id: string
  name: string
  clientId: string | null
  clientName: string | null
  address: string | null
  notes: string | null
  isActive: boolean
}

export interface ShiftRow {
  id: string
  postId: string
  postName: string
  employeeId: string | null
  employeeName: string | null
  startsAt: string
  endsAt: string
  status: string
  notes: string | null
}

export interface PuestosData {
  /** Puestos, por nombre. */
  posts: PostRow[]
  /** Turnos recientes, por inicio descendente. */
  shifts: ShiftRow[]
  /** Clientes vivos, para el selector de cliente. */
  clients: Array<{ id: string; name: string }>
  /** Empleados vivos, para el selector de guarda. */
  employees: Array<{ id: string; fullName: string }>
  /** Turnos programados sin guarda que empiezan de ahora en adelante. */
  vacantesCount: number
}

interface PostRecord {
  id: string
  name: string
  client_id: string | null
  address: string | null
  notes: string | null
  is_active: boolean
  clients: { name: string } | null
}

interface ShiftRecord {
  id: string
  post_id: string
  employee_id: string | null
  starts_at: string
  ends_at: string
  status: string
  notes: string | null
  guard_posts: { name: string } | null
  employees: { full_name: string } | null
}

function toPostRow(row: PostRecord): PostRow {
  return {
    id: row.id,
    name: row.name,
    clientId: row.client_id,
    clientName: row.clients?.name ?? null,
    address: row.address,
    notes: row.notes,
    isActive: row.is_active,
  }
}

function toShiftRow(row: ShiftRecord): ShiftRow {
  return {
    id: row.id,
    postId: row.post_id,
    postName: row.guard_posts?.name ?? '—',
    employeeId: row.employee_id,
    employeeName: row.employees?.full_name ?? null,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
    notes: row.notes,
  }
}

export async function getPuestos(): Promise<PuestosData> {
  const member = await requirePermission('puestos:read')
  const supabase = await createClient()

  const [postsResult, shiftsResult, clientsResult, employeesResult] = await Promise.all([
    scoped(supabase, member, 'guard_posts')
      .select('id, name, client_id, address, notes, is_active, clients ( name )')
      .order('name', { ascending: true }),
    scoped(supabase, member, 'post_shifts')
      .select(
        'id, post_id, employee_id, starts_at, ends_at, status, notes, ' +
          'guard_posts ( name ), employees ( full_name )',
      )
      .order('starts_at', { ascending: false })
      .limit(200),
    scoped(supabase, member, 'clients')
      .select('id, name')
      .is('deleted_at', null)
      .order('name', { ascending: true }),
    scoped(supabase, member, 'employees')
      .select('id, full_name')
      .is('deleted_at', null)
      .order('full_name', { ascending: true }),
  ])

  const posts = ((postsResult.data ?? []) as unknown as PostRecord[]).map(toPostRow)
  const shifts = ((shiftsResult.data ?? []) as unknown as ShiftRecord[]).map(toShiftRow)

  const now = Date.now()
  const vacantesCount = shifts.filter(
    (s) => s.status === 'programado' && s.employeeId === null && new Date(s.startsAt).getTime() >= now,
  ).length

  return {
    posts,
    shifts,
    clients: (clientsResult.data ?? []) as unknown as Array<{ id: string; name: string }>,
    employees: (employeesResult.data ?? []) as unknown as Array<{ id: string; fullName: string }>,
    vacantesCount,
  }
}
