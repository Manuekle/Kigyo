'use server'

import { getOrdenesProduccionPage, type ProductionRow } from '@/server/queries/produccion'
import type { PageResult } from '@/server/queries/shared'

/** The next page of production orders. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreOrdenesProduccion(
  offset: number,
): Promise<PageResult<ProductionRow>> {
  try {
    return { ok: true, data: await getOrdenesProduccionPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver las órdenes de producción.' }
  }
}
