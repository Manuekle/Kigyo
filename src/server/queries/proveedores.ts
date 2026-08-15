import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'

/**
 * The supplier directory (migration 87).
 *
 * Suppliers used to be free text on `supplier_invoices.supplier` and
 * `products.supplier` — the same vendor spelled three ways on three rows,
 * with no phone, no RUT, no way to ask "who do I owe". The directory is the
 * identity; the text columns remain as historical snapshots.
 *
 * The debt figure comes from `supplier_invoice_items`, because the invoice
 * itself carries no total: pending invoices are summed per supplier from the
 * item rows, the same way the CxP calendar prices them.
 */

export interface ProveedorRow {
  id: string
  name: string
  taxId: string
  contactName: string
  email: string
  phone: string
  city: string
  category: string
  notes: string
  isActive: boolean
  /** Facturas Pendiente o En revisión de este proveedor. */
  facturasPendientes: number
  /** Suma de `subtotal_cents` de esas facturas, en centavos. */
  deudaCents: number
}

export interface ProveedoresData {
  proveedores: ProveedorRow[]
  proveedoresTotal: number
  canWrite: boolean
}

export async function getProveedores(): Promise<ProveedoresData> {
  const member = await requirePermission('inventario:read')
  const supabase = await createClient()
  const canWrite =
    member.modules.has('inventario') && can(member.permissions, 'inventario:write')

  const [list, invoices] = await Promise.all([
    supabase
      .from('suppliers')
      .select(
        'id, name, tax_id, contact_name, email, phone, city, category, notes, is_active',
        { count: 'exact' },
      )
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('name', { ascending: true }),
    supabase
      .from('supplier_invoices')
      .select('id, supplier_id, status')
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .in('status', ['Pendiente', 'En revisión']),
  ])

  const openIds = (invoices.data ?? []).map((i) => i.id)
  const items =
    openIds.length > 0
      ? await supabase
          .from('supplier_invoice_items')
          .select('supplier_invoice_id, subtotal_cents')
          .in('supplier_invoice_id', openIds)
      : { data: [] as Array<{ supplier_invoice_id: string; subtotal_cents: number | null }> }

  // One pass: count invoices and sum items per supplier.
  const debtBySupplier = new Map<string, { count: number; cents: number }>()
  for (const inv of invoices.data ?? []) {
    if (!inv.supplier_id) continue
    const acc = debtBySupplier.get(inv.supplier_id) ?? { count: 0, cents: 0 }
    acc.count += 1
    debtBySupplier.set(inv.supplier_id, acc)
  }
  for (const item of items.data ?? []) {
    if (item.subtotal_cents == null) continue
    const inv = (invoices.data ?? []).find((i) => i.id === item.supplier_invoice_id)
    if (!inv?.supplier_id) continue
    const acc = debtBySupplier.get(inv.supplier_id)!
    acc.cents += item.subtotal_cents
  }

  const proveedores: ProveedorRow[] = (list.data ?? []).map((s) => {
    const debt = debtBySupplier.get(s.id) ?? { count: 0, cents: 0 }
    return {
      id: s.id,
      name: s.name,
      taxId: s.tax_id,
      contactName: s.contact_name,
      email: s.email,
      phone: s.phone,
      city: s.city,
      category: s.category,
      notes: s.notes,
      isActive: s.is_active,
      facturasPendientes: debt.count,
      deudaCents: debt.cents,
    }
  })

  return {
    proveedores,
    proveedoresTotal: list.count ?? proveedores.length,
    canWrite,
  }
}