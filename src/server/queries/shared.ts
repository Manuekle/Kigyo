import 'server-only'
import type { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'
import { can, type Permission } from '@/lib/auth/permissions'
import type { Member } from '@/lib/auth/session'

/**
 * Lookups that almost every screen needs alongside its own rows.
 *
 * Twelve of the fourteen pages offer a "who is this for" picker and half of
 * them a "which project" picker. Written per page, each one was a chance to
 * forget the `deleted_at` filter, the `org_id` filter, or — worse — the
 * permission check that decides whether the caller may see the directory at
 * all. One copy, checked once.
 */

export type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * Pagination.
 *
 * Every list used to end in `.limit(200)` or `.limit(500)`. Past that the rows
 * were simply gone — no error, no marker, the screen just looked like the
 * organization had 200 tickets. The cap is now the size of a page, the row
 * count comes back with it, and the screen can say how much it is showing and
 * ask for the rest.
 *
 * Offset rather than keyset here, unlike `audit_log`: these lists are sorted by
 * a business column that repeats (a date, a name) and can be edited, so there
 * is no stable cursor to key on. The tradeoff is that a row inserted while
 * someone pages can shift the window by one — acceptable for a directory,
 * which is why the append-only trail does not use this.
 */
export const PAGE_SIZE = 200

/** One page of a list, plus the size of the whole. */
export interface Page<T> {
  rows: T[]
  /** Rows matching the query, ignoring the window. */
  total: number
}

/**
 * What a "load more" Server Function answers.
 *
 * Same shape as the mutation results so the screens handle one thing: a
 * refusal is a value to show, never a thrown error to catch in the browser.
 */
export type PageResult<T> = { ok: true; data: Page<T> } | { ok: false; error: string }

/**
 * Turns a client-supplied offset into a PostgREST range.
 *
 * The offset is clamped: it arrives from the browser, and `range(-1, …)` or a
 * ten-million-row jump are both things a caller can ask for.
 */
export function pageRange(offset = 0, size = PAGE_SIZE): [number, number] {
  const from = Math.min(Math.max(Math.trunc(offset) || 0, 0), 100_000)
  return [from, from + size - 1]
}

/**
 * `total` for a query that came back without one.
 *
 * PostgREST returns `count: null` when the request had no `count` option, and
 * on an error there is no count either. Falling back to what was actually
 * returned keeps "mostrando 40 de 40" honest rather than "de 0".
 */
export function totalOf(count: number | null, rows: number, offset = 0): number {
  return count ?? offset + rows
}

export interface RosterEntry {
  employeeId: string
  fullName: string
  position: string
}

export interface ProjectRef {
  id: string
  code: string | null
  name: string
}

/** A client, reduced to what a picker on another module's screen needs. */
export interface ClientRef {
  id: string
  name: string
}

/**
 * Both gates, in the order the guards apply them: a module the organization
 * does not use hides the picker even from an administrator who holds the
 * permission.
 */
export function allows(member: Member, permission: Permission): boolean {
  return member.modules.has(permission.split(':')[0]) && can(member.permissions, permission)
}

/**
 * Tables that carry `org_id` themselves.
 *
 * Narrows the `scoped` parameter so calling it on a child table that inherits
 * its isolation from a parent (no `org_id` column of its own) is a compile
 * error instead of a runtime surprise.
 */
type OrgScopedTable = {
  [K in keyof Database['public']['Tables']]: 'org_id' extends keyof Database['public']['Tables'][K]['Row']
    ? K
    : never
}[keyof Database['public']['Tables']]

/**
 * A query already confined to the active company.
 *
 * The one filter no query may forget: `org_id = member.orgId`. As a function
 * argument it is impossible to omit — and because the parameter is narrowed
 * to tables with an `org_id` column, calling it on a child table that inherits
 * its isolation from a parent is refused by the compiler, which is how a table
 * that was never a tenant-owned one gets caught at the type level instead of
 * at a data leak.
 *
 * The filter is applied first, before `.select()`: PostgREST treats the first
 * `.eq` the same as any other, and the query shape reads "this table, for
 * this company, these columns" instead of "this table, these columns — oh
 * right, and the filter".
 */
export function scoped<Table extends OrgScopedTable>(
  supabase: Supabase,
  member: Member,
  table: Table,
) {
  // supabase-js collapses the row type to the whole catalogue when the table
  // name is generic, so its own `.eq` refuses to type-check here. The escape
  // is local on purpose: the *scope* guarantee lives in the parameter (typed,
  // not generic), and the return is the same builder the call site would have
  // had, with `.select()` promoted to the filter builder — which is where
  // `.eq` lives; the call site's own `.select(...)` replaces the star.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.from(table).select() as any).eq('org_id', member.orgId) as any
}

/**
 * The directory, for assignment pickers.
 *
 * Returns an empty list rather than throwing when the caller cannot read
 * `empleados`: the page still works, it just does not offer to assign anyone.
 * People who have left are excluded — assigning work to a former colleague is
 * not something the UI should make easy.
 *
 * Still capped, unlike the list screens. A `<Select>` cannot grow a "load
 * more" button and stay a picker: past a couple of hundred options the answer
 * is a typeahead that queries the server, not a longer dropdown. Until then
 * the cap is what it is, and it is written here rather than left as a bare
 * number at a call site.
 */
export async function rosterFor(
  supabase: Supabase,
  member: Member,
  limit = 200,
): Promise<RosterEntry[]> {
  if (!allows(member, 'empleados:read')) return []

  const { data, error } = await scoped(supabase, member, 'employees')
    .select('id, full_name, position')
    .is('deleted_at', null)
    .neq('status', 'Salida')
    .order('full_name', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('[shared] rosterFor', error)
    return []
  }

  return (data ?? []).map((r: { id: string; full_name: string; position: string | null }) => ({
    employeeId: r.id,
    fullName: r.full_name,
    position: r.position,
  }))
}

/** Live projects, for "which project is this against" pickers. */
export async function projectsFor(
  supabase: Supabase,
  member: Member,
  limit = 100,
): Promise<ProjectRef[]> {
  if (!allows(member, 'proyectos:read')) return []

  const { data, error } = await scoped(supabase, member, 'projects')
    .select('id, code, name')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[shared] projectsFor', error)
    return []
  }

  return (data ?? []).map((r: { id: string; code: string | null; name: string }) => ({
    id: r.id,
    code: r.code,
    name: r.name,
  }))
}

/**
 * Active clients, for "who is this for" pickers on commercial documents.
 *
 * Gated on `clientes:read` like every other helper here, and that gate is the
 * reason a caller must treat an empty list as "you may not look" rather than
 * as "there are no clients": a salesperson without the directory still writes
 * quotes, and the name they type stays the authoritative one on the document.
 */
export async function clientsFor(
  supabase: Supabase,
  member: Member,
  limit = 300,
): Promise<ClientRef[]> {
  if (!allows(member, 'clientes:read')) return []

  const { data, error } = await scoped(supabase, member, 'clients')
    .select('id, name')
    .is('deleted_at', null)
    .eq('status', 'Activo')
    .order('name', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('[shared] clientsFor', error)
    return []
  }

  return (data ?? []).map((r: { id: string; name: string }) => ({
    id: r.id,
    name: r.name,
  }))
}

/** The employee row behind the signed-in user, if they have one. */
export async function currentEmployeeId(
  supabase: Supabase,
  orgId: string,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('employees')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()
  return data?.id ?? null
}

/**
 * Rejects a foreign-key target that is not a live row of *this* organization.
 *
 * RLS on a child table inherits from its parent, so it cannot vouch for the
 * other side of the row: without this check an `employee_id` or `project_id`
 * from another tenant is accepted as a valid reference.
 */
export async function belongsToOrg(
  supabase: Supabase,
  /**
   * Every table listed here must carry both `org_id` and `deleted_at` — the
   * query below filters on both, and adding one without `deleted_at` would
   * make the call throw at runtime for a mistake the type system accepted.
   */
  table:
    | 'employees' | 'projects' | 'products' | 'documents'
    | 'dining_tables' | 'menu_items' | 'restaurant_orders' | 'clients'
    | 'sites',
  id: string | null,
  orgId: string,
): Promise<boolean> {
  if (!id) return true
  const { data } = await supabase
    .from(table)
    .select('id')
    .eq('id', id)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()
  return Boolean(data)
}
