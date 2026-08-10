'use server'

import { getOrdenesPage, type WorkOrderRow } from '@/server/queries/mantenimiento'
import type { PageResult } from '@/server/queries/shared'

/** The next page of work orders. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreOrdenes(offset: number): Promise<PageResult<WorkOrderRow>> {
  try {
    return { ok: true, data: await getOrdenesPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver las órdenes de trabajo.' }
  }
}
