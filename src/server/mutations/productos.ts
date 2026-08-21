'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { PRODUCT_UNITS } from '@/lib/domain'
import { getCatalogos, getTienda, type ProductosData } from '@/server/queries/productos'

/**
 * Products are written from the catalogue, which is the screen that owns them.
 * The storefront reads the same rows and only moves `stock` when an order is
 * placed — it does not get to invent products or set prices.
 */

export type ProductoResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const baseSchema = z.object({
  sku: z.string().trim().min(1, 'El SKU es obligatorio.').max(60),
  barcode: z.string().trim().max(64).default(''),
  name: z.string().trim().min(2, 'El nombre es obligatorio.').max(200),
  category: z.string().trim().max(80).default('Otro'),
  description: z.string().trim().max(1000).default(''),
  unit: z.enum(PRODUCT_UNITS).default('UN'),
  priceCents: z.number().int().min(0, 'El precio no puede ser negativo.').default(0),
  costCents: z.number().int().min(0, 'El costo no puede ser negativo.').default(0),
  // El precio ya lo incluye; esto solo declara cuánto de él es impuesto, para
  // que el POS lo pueda desglosar y la factura descontarlo. Ver migración 104.
  taxRate: z.number().min(0, 'La tasa no puede ser negativa.').max(100, 'La tasa no puede pasar de 100.').default(0),
  stock: z.number().int().min(0, 'El stock no puede ser negativo.').default(0),
  supplier: z.string().trim().max(160).default(''),
  isActive: z.boolean().default(true),
  inStorefront: z.boolean().default(true),
})

const updateSchema = baseSchema.extend({ id: z.uuid() })

export async function createProducto(
  input: z.input<typeof baseSchema>,
): Promise<ProductoResult<ProductosData>> {
  try {
    const member = await requirePermission('catalogos:write')
    const parsed = baseSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    // `stock` NO va en el insert: desde la migración 101 es una columna
    // derivada y solo la escribe el trigger del saldo. La cantidad inicial que
    // el formulario trae entra al libro como un asiento de apertura, abajo.
    const { data: created, error } = await supabase.from('products').insert({
      org_id: member.orgId,
      sku: parsed.data.sku,
      barcode: parsed.data.barcode,
      name: parsed.data.name,
      category: parsed.data.category,
      description: parsed.data.description,
      unit: parsed.data.unit,
      price_cents: parsed.data.priceCents,
      cost_cents: parsed.data.costCents,
      tax_rate: parsed.data.taxRate,
      supplier: parsed.data.supplier,
      is_active: parsed.data.isActive,
      in_storefront: parsed.data.inStorefront,
    }).select('id').single()

    if (error) {
      console.error('[productos] createProducto', error)
      // 23505 = unique_violation, on `(org_id, sku)` or `(org_id, barcode)`.
      if (error.code === '23505') {
        return fail(error.details?.includes('barcode')
          ? 'Ya existe un producto con ese código de barras.'
          : 'Ya existe un producto con ese SKU.')
      }
      return fail('No se pudo crear el producto.')
    }

    // Cero no genera asiento: `qty <> 0` lo rechazaría, y un movimiento de
    // apertura por cero no dice nada que la ausencia de movimientos no diga.
    if (parsed.data.stock !== 0 && created) {
      const { error: movError } = await supabase.from('inventory_movements').insert({
        org_id: member.orgId,
        product_id: created.id,
        site_id: null,
        qty: parsed.data.stock,
        kind: 'apertura',
        source_table: 'products',
        source_id: created.id,
        note: 'Existencia inicial al crear el producto',
      })
      // El producto ya existe; que falle el asiento no debe deshacerlo, pero sí
      // decirse — quedaría en catálogo con existencia cero y sin explicación.
      if (movError) {
        console.error('[productos] createProducto apertura', movError)
        return fail('El producto se creó, pero no se pudo registrar su existencia inicial.')
      }
    }

    revalidatePath('/dashboard/catalogos')
    revalidatePath('/dashboard/tienda')
    return { ok: true, data: await getCatalogos() }
  } catch {
    return fail('No tienes permiso para gestionar el catálogo.')
  }
}

export async function updateProducto(
  input: z.input<typeof updateSchema>,
): Promise<ProductoResult<ProductosData>> {
  try {
    const member = await requirePermission('catalogos:write')
    const parsed = updateSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('products')
      .update({
        sku: parsed.data.sku,
        barcode: parsed.data.barcode,
        name: parsed.data.name,
        category: parsed.data.category,
        description: parsed.data.description,
        unit: parsed.data.unit,
        price_cents: parsed.data.priceCents,
        cost_cents: parsed.data.costCents,
        tax_rate: parsed.data.taxRate,
        // `stock` fuera: es derivada. El cambio de existencia que este
        // formulario proponga se convierte en un ajuste, más abajo.
        supplier: parsed.data.supplier,
        is_active: parsed.data.isActive,
        in_storefront: parsed.data.inStorefront,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[productos] updateProducto', error)
      if (error.code === '23505') {
        return fail(error.details?.includes('barcode')
          ? 'Ya existe un producto con ese código de barras.'
          : 'Ya existe un producto con ese SKU.')
      }
      return fail('No se pudo actualizar el producto.')
    }

    /**
     * La existencia que trae el formulario se convierte en un ajuste.
     *
     * Antes esta pantalla escribía `stock` directamente, que es la operación
     * que hacía imposible responder «¿por qué tengo 7 y no 9?»: quedaba un
     * UPDATE en `audit_log` sin razón de negocio, indistinguible de una venta
     * que se hubiera perdido. Ahora la diferencia entra al libro como lo que
     * es — un conteo que corrigió el saldo — y el trigger recalcula el total.
     *
     * Contra el saldo de empresa (`site_id is null`) y no contra
     * `products.stock`, porque el total suma todas las sucursales: en una
     * empresa con dos locales, escribir «20» aquí significa «la empresa tiene
     * 20 en total», y repartir ese número entre sedes es un traslado, no un
     * ajuste. Mientras nadie tenga sucursales —hoy, nadie— las dos cifras
     * coinciden.
     */
    const { data: saldo } = await supabase
      .from('product_stock')
      .select('qty')
      .eq('product_id', parsed.data.id)
      .is('site_id', null)
      .maybeSingle()

    const delta = parsed.data.stock - (saldo?.qty ?? 0)
    if (delta !== 0) {
      const { error: ajusteError } = await supabase.from('inventory_movements').insert({
        org_id: member.orgId,
        product_id: parsed.data.id,
        site_id: null,
        qty: delta,
        kind: 'ajuste',
        source_table: 'products',
        source_id: parsed.data.id,
        note: 'Existencia corregida desde la ficha del producto',
      })
      if (ajusteError) {
        console.error('[productos] updateProducto ajuste', ajusteError)
        // KG103: el trigger rechaza dejar el saldo en negativo y nombra el
        // producto. Su mensaje es mejor que cualquiera que se escriba aquí.
        return fail(
          ajusteError.code === 'KG103'
            ? ajusteError.message
            : 'El producto se actualizó, pero no se pudo ajustar la existencia.',
        )
      }
    }

    revalidatePath('/dashboard/catalogos')
    revalidatePath('/dashboard/tienda')
    return { ok: true, data: await getCatalogos() }
  } catch {
    return fail('No tienes permiso para gestionar el catálogo.')
  }
}

/**
 * Soft delete.
 *
 * `quote_items.product_id` and `purchase_order_items.product_id` are
 * `on delete set null`, so a hard delete quietly strips the product off every
 * quote and order that referenced it — the line survives with a description
 * and no link to what was actually sold.
 */
export async function deleteProducto(id: string): Promise<ProductoResult<ProductosData>> {
  try {
    const member = await requirePermission('catalogos:write')
    if (!z.uuid().safeParse(id).success) return fail('Producto desconocido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('products')
      .update({ deleted_at: new Date().toISOString(), is_active: false, in_storefront: false })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[productos] deleteProducto', error)
      return fail('No se pudo eliminar el producto.')
    }

    revalidatePath('/dashboard/catalogos')
    revalidatePath('/dashboard/tienda')
    return { ok: true, data: await getCatalogos() }
  } catch {
    return fail('No tienes permiso para gestionar el catálogo.')
  }
}

const orderSchema = z.object({
  items: z
    .array(z.object({ productId: z.uuid(), quantity: z.number().int().min(1).max(9999) }))
    .min(1, 'El carrito está vacío.')
    .max(50),
})

/**
 * Place a storefront order.
 *
 * The old checkout toasted "Pedido generado por $…" and emptied a local cart;
 * no stock moved and no order existed afterwards. Its replacement moved stock
 * one UPDATE at a time and then filed the order — but through PostgREST each
 * of those statements is its own transaction, so a connection lost halfway
 * left stock deducted for goods nobody had ordered.
 *
 * All of it now happens inside `place_storefront_order` (migration 12), which
 * PostgREST runs in a single transaction: stock moves and the order exists, or
 * neither does. The stock check, the row locks and the tenant and permission
 * checks live in there too — a check is only worth anything inside the
 * transaction that acts on it. `requirePermission` stays because it is what
 * turns a refusal into an explanation about modules and roles rather than a
 * database error.
 */
export async function placeOrder(
  input: z.input<typeof orderSchema>,
): Promise<ProductoResult<ProductosData>> {
  try {
    const member = await requirePermission('tienda:write')
    const parsed = orderSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase.rpc('place_storefront_order', {
      p_org_id: member.orgId,
      p_items: parsed.data.items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
      })),
    })

    if (error) {
      console.error('[productos] placeOrder', error)
      // A `KG…` SQLSTATE is raised by the function itself and its message is
      // written for the buyer to read — "el panel solo tiene 2 unidades". Any
      // other code is a database failure and says nothing useful.
      if (error.code?.startsWith('KG')) return fail(error.message)
      return fail('No se pudo completar el pedido.')
    }

    revalidatePath('/dashboard/tienda')
    revalidatePath('/dashboard/catalogos')
    revalidatePath('/dashboard/inventario')
    return { ok: true, data: await getTienda() }
  } catch {
    return fail('No tienes permiso para comprar en la tienda.')
  }
}
