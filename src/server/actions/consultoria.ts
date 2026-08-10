'use server'

import { getConsultasPage, type ConsultaRow } from '@/server/queries/consultoria'
import type { PageResult } from '@/server/queries/shared'

/** The next page of consultations. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreConsultas(offset: number): Promise<PageResult<ConsultaRow>> {
  try {
    return { ok: true, data: await getConsultasPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver las consultorías.' }
  }
}
