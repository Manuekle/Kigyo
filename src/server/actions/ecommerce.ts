'use server'

import { getPedidosPage, type OnlineOrderRow } from '@/server/queries/ecommerce'
import type { PageResult } from '@/server/queries/shared'

/** The next page of online orders. See `actions/audit.ts` for why reads live here. */
export async function fetchMorePedidos(offset: number): Promise<PageResult<OnlineOrderRow>> {
  try {
    return { ok: true, data: await getPedidosPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver los pedidos.' }
  }
}
