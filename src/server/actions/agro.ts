'use server'

import { getLotesPage, type LotRow } from '@/server/queries/agro'
import type { PageResult } from '@/server/queries/shared'

/** The next page of plots. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreLotes(offset: number): Promise<PageResult<LotRow>> {
  try {
    return { ok: true, data: await getLotesPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver los lotes.' }
  }
}
