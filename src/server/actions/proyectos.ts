'use server'

import { getProyectosPage, type ProyectoRow } from '@/server/queries/proyectos'
import type { PageResult } from '@/server/queries/shared'

/** The next page of projects. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreProyectos(offset: number): Promise<PageResult<ProyectoRow>> {
  try {
    return { ok: true, data: await getProyectosPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver los proyectos.' }
  }
}
