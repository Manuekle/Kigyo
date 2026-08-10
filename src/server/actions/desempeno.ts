'use server'

import { getCyclesPage, type CycleRow } from '@/server/queries/desempeno'
import type { PageResult } from '@/server/queries/shared'

/** The next page of cycles. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreCycles(offset: number): Promise<PageResult<CycleRow>> {
  try {
    return { ok: true, data: await getCyclesPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver los ciclos de evaluación.' }
  }
}
