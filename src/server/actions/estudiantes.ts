'use server'

import { getEstudiantesPage, type StudentRow } from '@/server/queries/estudiantes'
import type { PageResult } from '@/server/queries/shared'

/** The next page of students. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreEstudiantes(offset: number): Promise<PageResult<StudentRow>> {
  try {
    return { ok: true, data: await getEstudiantesPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver los estudiantes.' }
  }
}
