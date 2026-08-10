'use server'

import { getPacientesPage, type PatientRow } from '@/server/queries/pacientes'
import type { PageResult } from '@/server/queries/shared'

/** The next page of patients. See `actions/audit.ts` for why reads live here. */
export async function fetchMorePacientes(offset: number): Promise<PageResult<PatientRow>> {
  try {
    return { ok: true, data: await getPacientesPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver los pacientes.' }
  }
}
