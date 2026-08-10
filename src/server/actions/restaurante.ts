'use server'

import { getPedidosRestaurantePage, type OrderRow } from '@/server/queries/restaurante'
import type { PageResult } from '@/server/queries/shared'

/** The next page of comandas. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreComandas(offset: number): Promise<PageResult<OrderRow>> {
  try {
    return { ok: true, data: await getPedidosRestaurantePage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver las comandas.' }
  }
}
