'use server'

import { getFacturasPage, type InvoiceRow } from '@/server/queries/facturacion'
import type { PageResult } from '@/server/queries/shared'

/** The next page of invoices. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreFacturas(offset: number): Promise<PageResult<InvoiceRow>> {
  try {
    return { ok: true, data: await getFacturasPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver las facturas.' }
  }
}
