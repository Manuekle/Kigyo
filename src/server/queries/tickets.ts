import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { TICKET_AREAS, TICKET_PRIORITIES, TICKET_STATUSES } from '@/lib/domain'
import { pageRange, totalOf, type Page } from './shared'

// Re-exported so a server caller can reach them from one place; the values
// themselves live in lib/domain, which is safe for a client to import.
export { TICKET_AREAS, TICKET_PRIORITIES, TICKET_STATUSES }

/**
 * Tickets, read through RLS.
 *
 * The board used to hold twelve fixture tickets in `useState`, with the
 * requester as a typed name and the timestamp as the literal string
 * "hace 2 h" — a relative time that never moved, so a ticket "opened 2 hours
 * ago" stayed two hours old forever. `tickets` and `ticket_comments` have both
 * existed since the operations migration, and the employee profile already
 * reads real tickets, so the two screens disagreed.
 */

export interface TicketRow {
  id: string
  code: string | null
  subject: string
  body: string
  area: string
  priority: string
  status: string
  requesterId: string | null
  requesterName: string
  assigneeId: string | null
  assigneeName: string | null
  boardPosition: number
  /** ISO. The client formats it, so "hace 2 h" is computed, not stored. */
  createdAt: string
  resolvedAt: string | null
  /** ISO deadline, owned by a DB trigger (priority-based). */
  slaDueAt: string | null
  commentCount: number
}

export interface TicketsData {
  tickets: TicketRow[]
  /** Tickets in the organization, of which `tickets` is the first page. */
  ticketsTotal: number
  roster: Array<{ employeeId: string; fullName: string }>
  canWrite: boolean
  /** The signed-in user's own employee row, used to file a ticket as them. */
  meEmployeeId: string | null
}

interface TicketRecord {
  id: string
  code: string | null
  subject: string
  body: string
  area: string
  priority: string
  status: string
  requester_id: string | null
  assignee_id: string | null
  board_position: number
  created_at: string
  resolved_at: string | null
  sla_due_at: string | null
  requester: { full_name: string } | null
  assignee: { full_name: string } | null
  ticket_comments: Array<{ count: number }> | null
}

const UNKNOWN_AUTHOR = 'Alguien que ya no está en la organización'

const TICKET_COLUMNS = `id, code, subject, body, area, priority, status, requester_id, assignee_id,
   board_position, created_at, resolved_at, sla_due_at,
   requester:employees!tickets_requester_id_fkey ( full_name ),
   assignee:employees!tickets_assignee_id_fkey ( full_name ),
   ticket_comments ( count )`

function toTicket(row: TicketRecord): TicketRow {
  return {
    id: row.id,
    code: row.code,
    subject: row.subject,
    body: row.body,
    area: row.area,
    priority: row.priority,
    status: row.status,
    requesterId: row.requester_id,
    requesterName: row.requester?.full_name ?? UNKNOWN_AUTHOR,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee?.full_name ?? null,
    boardPosition: row.board_position,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    slaDueAt: row.sla_due_at,
    // PostgREST returns an aggregate embed as a one-element array.
    commentCount: row.ticket_comments?.[0]?.count ?? 0,
  }
}

/** One page of the board, in the order the columns render it. */
export async function getTicketsPage(offset = 0): Promise<Page<TicketRow>> {
  const member = await requirePermission('tickets:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('tickets')
    .select(TICKET_COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('board_position', { ascending: true })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[tickets] getTicketsPage', error)
    return { rows: [], total: 0 }
  }

  return {
    rows: (data as unknown as TicketRecord[]).map(toTicket),
    total: totalOf(count, data.length, from),
  }
}

export async function getTickets(): Promise<TicketsData> {
  const member = await requirePermission('tickets:read')
  const supabase = await createClient()

  const canReadRoster =
    can(member.permissions, 'empleados:read') && member.modules.has('empleados')

  const [ticketsResult, meResult, rosterResult] = await Promise.all([
    supabase
      .from('tickets')
      .select(TICKET_COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('board_position', { ascending: true })
      .order('created_at', { ascending: false })
      .range(...pageRange(0)),
    supabase
      .from('employees')
      .select('id')
      .eq('org_id', member.orgId)
      .eq('user_id', member.userId)
      .is('deleted_at', null)
      .maybeSingle(),
    canReadRoster
      ? supabase
          .from('employees')
          .select('id, full_name')
          .eq('org_id', member.orgId)
          .is('deleted_at', null)
          .neq('status', 'Salida')
          .order('full_name', { ascending: true })
          .limit(200)
      : Promise.resolve({ data: [], error: null }),
  ])

  if (ticketsResult.error) {
    console.error('[tickets] getTickets', ticketsResult.error)
    return { tickets: [], ticketsTotal: 0, roster: [], canWrite: false, meEmployeeId: null }
  }

  const tickets = (ticketsResult.data as unknown as TicketRecord[]).map(toTicket)

  return {
    tickets,
    ticketsTotal: totalOf(ticketsResult.count, tickets.length),
    roster: ((rosterResult.data ?? []) as Array<{ id: string; full_name: string }>)
      .map((r) => ({ employeeId: r.id, fullName: r.full_name })),
    canWrite: can(member.permissions, 'tickets:write'),
    meEmployeeId: meResult.data?.id ?? null,
  }
}
