'use server'

import { getDianDetalle, type DianDocumentRow, type DianEventRow } from '@/server/queries/dian'

/**
 * Detalle de un documento DIAN + sus eventos.
 *
 * Read envuelta en acción `'use server'` porque la query vive en un módulo
 * `server-only` y el cliente no puede importarla directo (next/headers rompe
 * el browser bundle). Ver `actions/facturacion.ts` para el patrón.
 */
export type DianDetalleResult =
  | { ok: true; data: { documento: DianDocumentRow; eventos: DianEventRow[] } }
  | { ok: false; error: string }

export async function fetchDianDetalle(dianDocumentId: string): Promise<DianDetalleResult> {
  try {
    const data = await getDianDetalle(dianDocumentId)
    if (!data) return { ok: false, error: 'No se pudo leer el detalle DIAN.' }
    return { ok: true, data }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver ese documento DIAN.' }
  }
}