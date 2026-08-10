'use server'

import {
  getProductosPage,
  type ProductoRow,
  type ProductScope,
} from '@/server/queries/productos'
import type { PageResult } from '@/server/queries/shared'

/**
 * The next page of the catalogue or the storefront.
 *
 * The scope is validated rather than passed through: it decides both the
 * permission checked and whether `cost_cents` is included, so an unexpected
 * value must not fall through to the wider of the two.
 */
export async function fetchMoreProductos(
  scope: ProductScope,
  offset: number,
): Promise<PageResult<ProductoRow>> {
  if (scope !== 'catalogos' && scope !== 'tienda') {
    return { ok: false, error: 'No se pudo cargar el catálogo.' }
  }
  try {
    return { ok: true, data: await getProductosPage(scope, offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver estos productos.' }
  }
}
