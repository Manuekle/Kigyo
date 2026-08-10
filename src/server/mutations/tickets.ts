'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import {
  getTickets,
  TICKET_AREAS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketsData,
} from '@/server/queries/tickets'

/**
 * Server Functions for the tickets screen.
 *
 * `org_id` comes from the session, never from the request. RLS refuses a
 * cross-tenant write a second time at the database.
 */

export type TicketResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

/** The employee row behind the signed-in user, which tickets hang off. */
async function currentEmployeeId(
  supabase: Awaited<ReturnType<typeof createClient>>,
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

/** Rejects an assignee who is not a live employee of this organization. */
async function validEmployee(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  employeeId: string | null,
): Promise<boolean> {
  if (!employeeId) return true
  const { data } = await supabase
    .from('employees')
    .select('id')
    .eq('id', employeeId)
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()
  return Boolean(data)
}

const createSchema = z.object({
  subject: z.string().trim().min(3, 'El asunto es obligatorio.').max(200),
  body: z.string().trim().max(4000).default(''),
  area: z.enum(TICKET_AREAS).default('Otro'),
  priority: z.enum(TICKET_PRIORITIES).default('Media'),
  assigneeId: z.uuid().nullable().default(null),
})

export async function createTicket(
  input: z.input<typeof createSchema>,
): Promise<TicketResult<TicketsData>> {
  try {
    const member = await requirePermission('tickets:write')
    const parsed = createSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    if (!(await validEmployee(supabase, member.orgId, parsed.data.assigneeId))) {
      return fail('La persona asignada ya no está en el equipo.')
    }

    // The requester is whoever is signed in, taken from the session rather
    // than from the form: a ticket filed "as" a colleague is a different
    // feature, and letting the client name the requester is how it happens by
    // accident.
    const requesterId = await currentEmployeeId(supabase, member.orgId, member.userId)

    const { error } = await supabase.from('tickets').insert({
      org_id: member.orgId,
      subject: parsed.data.subject,
      body: parsed.data.body,
      area: parsed.data.area,
      priority: parsed.data.priority,
      status: 'Abierto',
      requester_id: requesterId,
      assignee_id: parsed.data.assigneeId,
    })

    if (error) {
      console.error('[tickets] createTicket', error)
      return fail('No se pudo crear el ticket.')
    }

    revalidatePath('/dashboard/tickets')
    return { ok: true, data: await getTickets() }
  } catch {
    return fail('No tienes permiso para gestionar tickets.')
  }
}

const updateSchema = z.object({
  id: z.uuid(),
  subject: z.string().trim().min(3, 'El asunto es obligatorio.').max(200).optional(),
  body: z.string().trim().max(4000).optional(),
  area: z.enum(TICKET_AREAS).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  status: z.enum(TICKET_STATUSES).optional(),
  assigneeId: z.uuid().nullable().optional(),
})

export async function updateTicket(
  input: z.input<typeof updateSchema>,
): Promise<TicketResult<TicketsData>> {
  try {
    const member = await requirePermission('tickets:write')
    const parsed = updateSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    if (
      parsed.data.assigneeId !== undefined &&
      !(await validEmployee(supabase, member.orgId, parsed.data.assigneeId))
    ) {
      return fail('La persona asignada ya no está en el equipo.')
    }

    // Explicitly shaped rather than `Record<string, unknown>`: the generated
    // table types reject an index signature, and losing them here is how a
    // typo'd column name reaches the database as a silent no-op.
    const patch: {
      subject?: string
      body?: string
      area?: (typeof TICKET_AREAS)[number]
      priority?: (typeof TICKET_PRIORITIES)[number]
      assignee_id?: string | null
      status?: (typeof TICKET_STATUSES)[number]
      resolved_at?: string | null
    } = {}
    if (parsed.data.subject !== undefined) patch.subject = parsed.data.subject
    if (parsed.data.body !== undefined) patch.body = parsed.data.body
    if (parsed.data.area !== undefined) patch.area = parsed.data.area
    if (parsed.data.priority !== undefined) patch.priority = parsed.data.priority
    if (parsed.data.assigneeId !== undefined) patch.assignee_id = parsed.data.assigneeId

    if (parsed.data.status !== undefined) {
      patch.status = parsed.data.status
      // `resolved_at` is the column reports read to answer "how long did this
      // take". Leaving it behind when a ticket is reopened would keep a
      // resolution date on an open ticket.
      const closed = parsed.data.status === 'Resuelto' || parsed.data.status === 'Cerrado'
      patch.resolved_at = closed ? new Date().toISOString() : null
    }

    if (Object.keys(patch).length === 0) {
      return { ok: true, data: await getTickets() }
    }

    const { error } = await supabase
      .from('tickets')
      .update(patch)
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[tickets] updateTicket', error)
      return fail('No se pudo actualizar el ticket.')
    }

    revalidatePath('/dashboard/tickets')
    return { ok: true, data: await getTickets() }
  } catch {
    return fail('No tienes permiso para gestionar tickets.')
  }
}

/**
 * Soft delete. `ticket_comments` cascades on a hard delete, taking the thread
 * with it — and a ticket's thread is the record of what was decided.
 */
export async function deleteTicket(id: string): Promise<TicketResult<TicketsData>> {
  try {
    const member = await requirePermission('tickets:write')
    if (!z.uuid().safeParse(id).success) return fail('Ticket desconocido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('tickets')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[tickets] deleteTicket', error)
      return fail('No se pudo eliminar el ticket.')
    }

    revalidatePath('/dashboard/tickets')
    return { ok: true, data: await getTickets() }
  } catch {
    return fail('No tienes permiso para gestionar tickets.')
  }
}

const moveSchema = z.object({
  id: z.uuid(),
  status: z.enum(TICKET_STATUSES),
  /** Fractional index, so a drop between two cards needs no reindexing pass. */
  boardPosition: z.number().finite(),
})

/** Kanban drop: the column *and* the slot within it, both persisted. */
export async function moveTicket(
  input: z.input<typeof moveSchema>,
): Promise<TicketResult<TicketsData>> {
  try {
    const member = await requirePermission('tickets:write')
    const parsed = moveSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const closed = parsed.data.status === 'Resuelto' || parsed.data.status === 'Cerrado'

    const { error } = await supabase
      .from('tickets')
      .update({
        status: parsed.data.status,
        board_position: parsed.data.boardPosition,
        resolved_at: closed ? new Date().toISOString() : null,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[tickets] moveTicket', error)
      return fail('No se pudo mover el ticket.')
    }

    revalidatePath('/dashboard/tickets')
    return { ok: true, data: await getTickets() }
  } catch {
    return fail('No tienes permiso para gestionar tickets.')
  }
}
