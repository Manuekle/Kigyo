'use server'

import { getOpeningsPage, type OpeningRow } from '@/server/queries/reclutamiento'
import type { PageResult } from '@/server/queries/shared'

/** The next page of vacancies. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreOpenings(offset: number): Promise<PageResult<OpeningRow>> {
  try {
    return { ok: true, data: await getOpeningsPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver las vacantes.' }
  }
}
