'use server'

import { getRiesgosPage, type RiesgoRow } from '@/server/queries/riesgos'
import type { PageResult } from '@/server/queries/shared'

/** The next page of the register. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreRiesgos(offset: number): Promise<PageResult<RiesgoRow>> {
  try {
    return { ok: true, data: await getRiesgosPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver los riesgos.' }
  }
}
