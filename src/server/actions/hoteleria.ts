'use server'

import { getHabitacionesPage, type RoomRow } from '@/server/queries/hoteleria'
import type { PageResult } from '@/server/queries/shared'

/** The next page of rooms. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreHabitaciones(offset: number): Promise<PageResult<RoomRow>> {
  try {
    return { ok: true, data: await getHabitacionesPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver las habitaciones.' }
  }
}
