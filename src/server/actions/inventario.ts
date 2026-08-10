'use server'

import {
  getActivosPage,
  getPedidosPage,
  type ActivoRow,
  type PedidoRow,
} from '@/server/queries/inventario'
import type { PageResult } from '@/server/queries/shared'

/** The next page of the asset register. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreActivos(offset: number): Promise<PageResult<ActivoRow>> {
  try {
    return { ok: true, data: await getActivosPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver el inventario.' }
  }
}

/** The next page of purchase orders. */
export async function fetchMorePedidos(offset: number): Promise<PageResult<PedidoRow>> {
  try {
    return { ok: true, data: await getPedidosPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver los pedidos.' }
  }
}
