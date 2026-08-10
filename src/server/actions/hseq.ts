'use server'

import { getHseqPage, type HseqRow } from '@/server/queries/hseq'
import type { PageResult } from '@/server/queries/shared'

/** The next page of HSEQ reports. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreHseq(offset: number): Promise<PageResult<HseqRow>> {
  try {
    return { ok: true, data: await getHseqPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver los reportes HSEQ.' }
  }
}
