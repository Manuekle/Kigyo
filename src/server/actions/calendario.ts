'use server'

import { getEventosPage, type EventoRow } from '@/server/queries/calendario'
import type { PageResult } from '@/server/queries/shared'

/** The next page of a month's events. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreEventos(
  monthIso: string,
  offset: number,
): Promise<PageResult<EventoRow>> {
  try {
    return { ok: true, data: await getEventosPage(monthIso, offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver el calendario.' }
  }
}
