'use server'

import { getEmpleadosPage, type EmpleadoRow } from '@/server/queries/empleados'
import type { PageResult } from '@/server/queries/shared'

/** The next page of the directory. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreEmpleados(offset: number): Promise<PageResult<EmpleadoRow>> {
  try {
    return { ok: true, data: await getEmpleadosPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver el directorio.' }
  }
}
