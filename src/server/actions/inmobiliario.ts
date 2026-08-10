'use server'

import { getInmueblesPage, type PropertyRow } from '@/server/queries/inmobiliario'
import type { PageResult } from '@/server/queries/shared'

/** The next page of properties. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreInmuebles(offset: number): Promise<PageResult<PropertyRow>> {
  try {
    return { ok: true, data: await getInmueblesPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver los inmuebles.' }
  }
}
