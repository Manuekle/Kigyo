'use server'

import { getContratosPage, type ContractRow } from '@/server/queries/contratos'
import type { PageResult } from '@/server/queries/shared'

/** The next page of contracts. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreContratos(offset: number): Promise<PageResult<ContractRow>> {
  try {
    return { ok: true, data: await getContratosPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver los contratos.' }
  }
}
