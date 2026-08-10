'use server'

import { getTicketsPage, type TicketRow } from '@/server/queries/tickets'
import type { PageResult } from '@/server/queries/shared'

/** The next page of the board. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreTickets(offset: number): Promise<PageResult<TicketRow>> {
  try {
    return { ok: true, data: await getTicketsPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver los tickets.' }
  }
}
