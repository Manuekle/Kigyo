'use server'

import { getClientesPage, type ClientRow } from '@/server/queries/clientes'
import type { PageResult } from '@/server/queries/shared'

/** The next page of clients. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreClientes(offset: number): Promise<PageResult<ClientRow>> {
  try {
    return { ok: true, data: await getClientesPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver los clientes.' }
  }
}
