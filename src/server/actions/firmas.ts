'use server'

import { getFirmasPage, type FirmaRow } from '@/server/queries/firmas'
import type { PageResult } from '@/server/queries/shared'

/** The next page of signature requests. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreFirmas(offset: number): Promise<PageResult<FirmaRow>> {
  try {
    return { ok: true, data: await getFirmasPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver las firmas.' }
  }
}
