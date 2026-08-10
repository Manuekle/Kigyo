'use server'

import { getDocumentosPage, type DocumentoRow } from '@/server/queries/documentos'
import type { PageResult } from '@/server/queries/shared'

/** The next page of the repository. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreDocumentos(offset: number): Promise<PageResult<DocumentoRow>> {
  try {
    return { ok: true, data: await getDocumentosPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver los documentos.' }
  }
}
