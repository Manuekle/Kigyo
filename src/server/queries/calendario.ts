import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { pageRange, rosterFor, totalOf, type Page, type RosterEntry } from './shared'

/**
 * Calendar events, read through RLS.
 *
 * The screen used to hold eight meetings whose date was a bare day-of-month
 * integer (`day: 9`) with the month hardcoded to "Junio 2026" and today
 * hardcoded to the 21st. The month arrows were `disabled`, so there was no
 * other month to go to — which is the only reason the model held together.
 *
 * `calendar_events` stores real `timestamptz` bounds, so a month is a range
 * query and "próximas" means later than now.
 */

export interface EventoRow {
  id: string
  code: string | null
  title: string
  kind: string
  /** ISO instants. The client formats them in the org's locale. */
  startsAt: string
  endsAt: string
  location: string
  notes: string
  attendees: Array<{ employeeId: string; fullName: string }>
}

export interface CalendarioData {
  eventos: EventoRow[]
  /** Events in the visible month, of which `eventos` is the first page. */
  eventosTotal: number
  roster: RosterEntry[]
  canWrite: boolean
  /** First instant of the window that was loaded, as an ISO string. */
  monthStart: string
}

interface EventRecord {
  id: string
  code: string | null
  title: string
  kind: string
  starts_at: string
  ends_at: string
  location: string
  notes: string
  calendar_attendees: Array<{
    employee_id: string
    employees: { full_name: string } | null
  }> | null
}

/**
 * One month, plus a margin either side.
 *
 * The margin is what fills the leading and trailing cells of the grid: a month
 * view shows the tail of the previous month and the head of the next, and
 * querying exactly `[first, last]` left those cells blank even when something
 * was scheduled in them.
 */
const EVENT_COLUMNS = `id, code, title, kind, starts_at, ends_at, location, notes,
   calendar_attendees ( employee_id, employees ( full_name ) )`

function toEvento(row: EventRecord): EventoRow {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    kind: row.kind,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    location: row.location,
    notes: row.notes,
    attendees: (row.calendar_attendees ?? []).map((a) => ({
      employeeId: a.employee_id,
      fullName: a.employees?.full_name ?? 'Alguien que ya no está en la organización',
    })),
  }
}

/** The window the grid draws: the month plus a week either side. */
function monthWindow(monthIso?: string): { monthStart: Date; from: Date; to: Date } {
  const anchor = monthIso && !Number.isNaN(Date.parse(monthIso)) ? new Date(monthIso) : new Date()
  const monthStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1))
  const from = new Date(monthStart)
  from.setUTCDate(from.getUTCDate() - 7)
  const to = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1))
  to.setUTCDate(to.getUTCDate() + 7)
  return { monthStart, from, to }
}

/**
 * One page of a month's events.
 *
 * The month is already the coarse window, so this only matters for a month
 * busier than a page — but "busier than a page" used to mean the rest of the
 * month simply did not appear on the grid.
 */
export async function getEventosPage(monthIso: string, offset = 0): Promise<Page<EventoRow>> {
  const member = await requirePermission('calendario:read')
  const supabase = await createClient()
  const { from: windowFrom, to: windowTo } = monthWindow(monthIso)
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('calendar_events')
    .select(EVENT_COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .gte('starts_at', windowFrom.toISOString())
    .lt('starts_at', windowTo.toISOString())
    .order('starts_at', { ascending: true })
    .range(from, to)

  if (error) {
    console.error('[calendario] getEventosPage', error)
    return { rows: [], total: 0 }
  }

  return {
    rows: (data as unknown as EventRecord[]).map(toEvento),
    total: totalOf(count, data.length, from),
  }
}

export async function getCalendario(monthIso?: string): Promise<CalendarioData> {
  const member = await requirePermission('calendario:read')
  const supabase = await createClient()

  const { monthStart, from, to } = monthWindow(monthIso)

  const [eventsResult, roster] = await Promise.all([
    supabase
      .from('calendar_events')
      .select(EVENT_COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .gte('starts_at', from.toISOString())
      .lt('starts_at', to.toISOString())
      .order('starts_at', { ascending: true })
      .range(...pageRange(0)),
    rosterFor(supabase, member),
  ])

  if (eventsResult.error) {
    console.error('[calendario] getCalendario', eventsResult.error)
    return {
      eventos: [], eventosTotal: 0, roster: [], canWrite: false,
      monthStart: monthStart.toISOString(),
    }
  }

  const eventos = (eventsResult.data as unknown as EventRecord[]).map(toEvento)

  return {
    eventos,
    eventosTotal: totalOf(eventsResult.count, eventos.length),
    roster,
    canWrite: can(member.permissions, 'calendario:write'),
    monthStart: monthStart.toISOString(),
  }
}
