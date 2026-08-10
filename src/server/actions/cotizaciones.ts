'use server'

import { getCotizacionesPage, type CotizacionRow } from '@/server/queries/cotizaciones'
import type { PageResult } from '@/server/queries/shared'

/** The next page of quotes. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreCotizaciones(offset: number): Promise<PageResult<CotizacionRow>> {
  try {
    return { ok: true, data: await getCotizacionesPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver las cotizaciones.' }
  }
}
