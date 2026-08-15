'use server'

import { getAsientosPage, type JournalEntryRow } from '@/server/queries/contabilidad'
import type { PageResult } from '@/server/queries/shared'

/** The next page of journal entries. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreAsientos(offset: number): Promise<PageResult<JournalEntryRow>> {
  try {
    return { ok: true, data: await getAsientosPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver la contabilidad.' }
  }
}
