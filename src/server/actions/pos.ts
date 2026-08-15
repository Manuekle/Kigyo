'use server'

import { getPos, type PosData } from '@/server/queries/pos'

/**
 * Refresco de solo lectura para el modal del QR.
 *
 * El sondeo NUNCA paga la venta — solo relee el estado: la confirmación
 * llega por el webhook firmado (plan CRM/ERP/POS 3.3). Esto es lo que el
 * plan llama "el cliente no cobra"; el cliente aquí solo mira.
 */
export async function fetchPos(): Promise<PosData | null> {
  try {
    return await getPos()
  } catch {
    return null
  }
}
