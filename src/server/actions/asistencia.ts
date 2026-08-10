'use server'

import { getAusencias, type AusenciaRow } from '@/server/queries/asistencia'
import type { PageResult } from '@/server/queries/shared'

/** The next page of the absence register. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreAusencias(offset: number): Promise<PageResult<AusenciaRow>> {
  try {
    return { ok: true, data: await getAusencias(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver las ausencias.' }
  }
}
