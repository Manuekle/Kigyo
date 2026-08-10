'use server'

import { getVehiculosPage, type VehicleRow } from '@/server/queries/flota'
import type { PageResult } from '@/server/queries/shared'

/** The next page of vehicles. See `actions/audit.ts` for why reads live here. */
export async function fetchMoreVehiculos(offset: number): Promise<PageResult<VehicleRow>> {
  try {
    return { ok: true, data: await getVehiculosPage(offset) }
  } catch {
    return { ok: false, error: 'No tienes permiso para ver la flota.' }
  }
}
