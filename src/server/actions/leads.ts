'use server'

import { getLeadsPage, type LeadRow } from '@/server/queries/leads'
import type { PageResult } from '@/server/queries/shared'

/** The next page of leads. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreLeads(offset: number): Promise<PageResult<LeadRow>> {
  try {
    return { ok: true, data: await getLeadsPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver los leads.' }
  }
}
