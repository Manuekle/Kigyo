'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { getProveedores, type ProveedoresData } from '@/server/queries/proveedores'

export type ProveedoresResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

/* ─── Suppliers ────────────────────────────────────────────────────────── */

const proveedorSchema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre del proveedor.').max(160),
  taxId: z.string().trim().max(40).default(''),
  contactName: z.string().trim().max(160).default(''),
  email: z.union([z.email('Escribe un correo válido.'), z.literal('')]).default('').transform((v) => v.toLowerCase()),
  phone: z.string().trim().max(40).default(''),
  city: z.string().trim().max(120).default(''),
  category: z.string().trim().max(120).default(''),
  notes: z.string().trim().max(2000).default(''),
})

/**
 * The unique name per org surfaces as a Postgres 23505; the friendly version
 * belongs here because the constraint name is the only way to tell this
 * duplicate from any other.
 */
function friendlyInsertError(error: { code?: string; message?: string }): string {
  if (error.code === '23505') return 'Ya existe un proveedor con ese nombre.'
  return error.message?.includes('KG10') ? 'No tienes permiso para esta acción.' : 'No se pudo guardar el proveedor.'
}

export async function createProveedor(
  input: z.input<typeof proveedorSchema>,
): Promise<ProveedoresResult<ProveedoresData>> {
  try {
    const member = await requirePermission('inventario:write')
    const supabase = await createClient()
    const parsed = proveedorSchema.parse(input)

    const { error } = await supabase.from('suppliers').insert({
      org_id: member.orgId,
      name: parsed.name,
      tax_id: parsed.taxId,
      contact_name: parsed.contactName,
      email: parsed.email,
      phone: parsed.phone,
      city: parsed.city,
      category: parsed.category,
      notes: parsed.notes,
    })
    if (error) return fail(friendlyInsertError(error))

    revalidatePath('/dashboard/proveedores', 'layout')
    return { ok: true, data: await getProveedores() }
  } catch (e) {
    if (e instanceof z.ZodError) return fail(e.issues[0]?.message ?? 'Datos inválidos.')
    console.error('[proveedores] createProveedor', e)
    return fail('Inicia sesión para continuar.')
  }
}

export async function updateProveedor(
  input: z.input<typeof proveedorSchema> & { id: string },
): Promise<ProveedoresResult<ProveedoresData>> {
  try {
    const member = await requirePermission('inventario:write')
    const supabase = await createClient()
    const { id, ...rest } = input
    const parsed = proveedorSchema.parse(rest)

    const { error } = await supabase
      .from('suppliers')
      .update({
        name: rest.name,
        tax_id: rest.taxId,
        contact_name: rest.contactName,
        email: rest.email,
        phone: rest.phone,
        city: rest.city,
        category: rest.category,
        notes: rest.notes,
      })
      .eq('id', id)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
    if (error) return fail(friendlyInsertError(error))

    revalidatePath('/dashboard/proveedores', 'layout')
    return { ok: true, data: await getProveedores() }
  } catch (e) {
    if (e instanceof z.ZodError) return fail(e.issues[0]?.message ?? 'Datos inválidos.')
    console.error('[proveedores] updateProveedor', e)
    return fail('Inicia sesión para continuar.')
  }
}

/**
 * Soft delete, like the rest of the directory tables: invoices and products
 * keep their `supplier_id` (the FK is `on delete set null`, but a deleted
 * supplier still names their rows through the denormalised text).
 */
export async function deleteProveedor(id: string): Promise<ProveedoresResult<ProveedoresData>> {
  try {
    const member = await requirePermission('inventario:write')
    const supabase = await createClient()

    const { error } = await supabase
      .from('suppliers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
    if (error) return fail('No se pudo eliminar el proveedor.')

    revalidatePath('/dashboard/proveedores', 'layout')
    return { ok: true, data: await getProveedores() }
  } catch {
    return fail('Inicia sesión para continuar.')
  }
}