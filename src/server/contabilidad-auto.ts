import { createClient } from '@/lib/supabase/server'
import type { Member } from '@/lib/auth/session'

export type AutoConcept = 'venta_credito' | 'cobro' | 'compra' | 'pago_proveedor' | 'caja_diferencia'
export type AutoSource = 'Venta' | 'Cobro' | 'Compra' | 'Pago' | 'Caja'

/**
 * El gancho de los asientos automáticos.
 *
 * Cada mutation que mueve dinero lo llama cuando la empresa tiene
 * `contabilidad` activo. El trabajo lo hace `public.post_auto_entry`
 * (migración 80): mapea el concepto a sus dos cuentas (las de
 * `org_account_mappings` si existen, si no los códigos fijos), valida la
 * membresía dentro del definer e inserta un asiento Publicado — una sola vez
 * por evento, que es lo que el índice único parcial sobre source/source_id
 * garantiza.
 *
 * Un monto cero no contabiliza nada y el RPC devuelve null sin error: un
 * cierre de caja cuadrado no produce asiento, y no debe.
 */
export async function maybePostAutoEntry(
  member: Member,
  concepto: AutoConcept,
  source: AutoSource,
  sourceId: string | null,
  memo: string,
  entryDate: string,
  amountCents: number,
): Promise<void> {
  if (!member.modules.has('contabilidad') || !member.permissions.has('contabilidad:write')) return
  if (!sourceId) return
  if (amountCents === 0) return

  const supabase = await createClient()
  const { error } = await supabase.rpc('post_auto_entry', {
    p_org_id: member.orgId,
    p_concepto: concepto,
    p_source: source,
    p_source_id: sourceId,
    p_memo: memo.slice(0, 400),
    p_entry_date: entryDate,
    p_amount_cents: amountCents,
  })
  if (error) {
    // El asiento automático no debe romper la operación que lo origina: la
    // venta ya se cobró. Se registra y el contador lo ve en los logs.
    console.error('[contabilidad] maybePostAutoEntry', error)
  }
}
