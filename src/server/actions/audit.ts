'use server'

import { getAuditLog, type AuditPage } from '@/server/queries/audit'

/**
 * Server Actions that read.
 *
 * `src/server/queries` is `server-only` — those modules cannot be reached from
 * the browser at all. `src/server/mutations` is `use server`, and everything
 * exported from it writes. Paging a list is neither: a read the client has to
 * be able to trigger. It lives here rather than under a name that promises a
 * write it never performs.
 */

export type AuditPageResult = { ok: true; data: AuditPage } | { ok: false; error: string }

/**
 * The next screenful of the audit trail.
 *
 * The cursor is the id of the oldest entry already on screen. It is not
 * trusted: `getAuditLog` re-checks `trazabilidad:read` and RLS scopes the rows
 * to the caller's organization, so a forged cursor can only move the window
 * inside a trail the caller was already allowed to read.
 */
export async function loadMoreAudit(before: number): Promise<AuditPageResult> {
  if (!Number.isSafeInteger(before) || before < 0) {
    return { ok: false, error: 'No se pudo continuar la lista.' }
  }

  try {
    return { ok: true, data: await getAuditLog({ before }) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver la trazabilidad.' }
  }
}
