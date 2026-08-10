'use server'

import {
  getComprasPage,
  getOrdenesPage,
  type CompraRow,
  type OrdenRow,
} from '@/server/queries/compras'
import type { PageResult } from '@/server/queries/shared'

/** The next page of requisitions. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreCompras(offset: number): Promise<PageResult<CompraRow>> {
  try {
    return { ok: true, data: await getComprasPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver las requisiciones.' }
  }
}

/** The next page of purchase orders. */
export async function fetchMoreOrdenes(offset: number): Promise<PageResult<OrdenRow>> {
  try {
    return { ok: true, data: await getOrdenesPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver las órdenes de compra.' }
  }
}
