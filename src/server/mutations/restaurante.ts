'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import {
  DELIVERY_STATUSES, INGREDIENT_UNITS, MENU_CATEGORIES, PAYMENT_METHODS,
  RESTAURANT_ORDER_STATUSES, TABLE_RESERVATION_STATUSES, TABLE_STATUSES,
} from '@/lib/domain'
import { belongsToOrg } from '@/server/queries/shared'
// La aritmética del arqueo vive en el módulo de caja, y este cierre la usa en
// vez de reescribirla. Ver la nota sobre `cerrarCaja` más abajo.
import { expectedFor, salesForSession } from '@/server/queries/caja'
import { getRestaurante, type RestauranteData } from '@/server/queries/restaurante'

export type RestauranteResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

/* ─── Menu ─────────────────────────────────────────────────────────────── */

const menuSchema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre del plato.').max(160),
  category: z.enum(MENU_CATEGORIES).default('Plato fuerte'),
  description: z.string().trim().max(1000).default(''),
  priceCents: z.coerce.number().int().min(0).default(0),
  costCents: z.coerce.number().int().min(0).default(0),
  prepMinutes: z.coerce.number().int().min(0).max(600).nullable().default(null),
  allergens: z.string().trim().max(500).default(''),
})

export async function createPlato(
  input: z.input<typeof menuSchema>,
): Promise<RestauranteResult<RestauranteData>> {
  try {
    const member = await requirePermission('restaurante:write')
    const parsed = menuSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    // Not a database constraint — a loss leader is a real decision — but it is
    // almost always a swapped pair of fields, and the margin report would
    // report the mistake as a fact.
    if (parsed.data.priceCents > 0 && parsed.data.costCents > parsed.data.priceCents) {
      return fail('El costo supera al precio. Revisa los valores.')
    }

    const supabase = await createClient()
    const { error } = await supabase.from('menu_items').insert({
      org_id: member.orgId,
      name: parsed.data.name,
      category: parsed.data.category,
      description: parsed.data.description,
      price_cents: parsed.data.priceCents,
      cost_cents: parsed.data.costCents,
      prep_minutes: parsed.data.prepMinutes,
      allergens: parsed.data.allergens,
    })

    if (error) {
      console.error('[restaurante] createPlato', error)
      return fail('No se pudo crear el plato.')
    }

    revalidatePath('/dashboard/restaurante')
    return { ok: true, data: await getRestaurante() }
  } catch {
    return fail('No tienes permiso para gestionar el restaurante.')
  }
}

const updatePlatoSchema = menuSchema.extend({ id: z.uuid() })

export async function updatePlato(
  input: z.input<typeof updatePlatoSchema>,
): Promise<RestauranteResult<RestauranteData>> {
  try {
    const member = await requirePermission('restaurante:write')
    const parsed = updatePlatoSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    if (parsed.data.priceCents > 0 && parsed.data.costCents > parsed.data.priceCents) {
      return fail('El costo supera al precio. Revisa los valores.')
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('menu_items')
      .update({
        name: parsed.data.name,
        category: parsed.data.category,
        description: parsed.data.description,
        price_cents: parsed.data.priceCents,
        cost_cents: parsed.data.costCents,
        prep_minutes: parsed.data.prepMinutes,
        allergens: parsed.data.allergens,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[restaurante] updatePlato', error)
      return fail('No se pudo actualizar el plato.')
    }

    revalidatePath('/dashboard/restaurante')
    return { ok: true, data: await getRestaurante() }
  } catch {
    return fail('No tienes permiso para gestionar el restaurante.')
  }
}

const availabilitySchema = z.object({ id: z.uuid(), isAvailable: z.boolean() })

export async function setPlatoDisponible(
  input: z.input<typeof availabilitySchema>,
): Promise<RestauranteResult<RestauranteData>> {
  try {
    const member = await requirePermission('restaurante:write')
    const parsed = availabilitySchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('menu_items')
      .update({ is_available: parsed.data.isAvailable })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[restaurante] setPlatoDisponible', error)
      return fail('No se pudo actualizar el plato.')
    }

    revalidatePath('/dashboard/restaurante')
    return { ok: true, data: await getRestaurante() }
  } catch {
    return fail('No tienes permiso para gestionar el restaurante.')
  }
}

/* ─── Tables ───────────────────────────────────────────────────────────── */

const tableSchema = z.object({
  label: z.string().trim().min(1, 'Ponle nombre a la mesa.').max(40),
  zone: z.string().trim().max(80).default(''),
  seats: z.coerce.number().int().min(1).max(100).default(2),
})

export async function createMesa(
  input: z.input<typeof tableSchema>,
): Promise<RestauranteResult<RestauranteData>> {
  try {
    const member = await requirePermission('restaurante:write')
    const parsed = tableSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase.from('dining_tables').insert({
      org_id: member.orgId,
      label: parsed.data.label,
      zone: parsed.data.zone,
      seats: parsed.data.seats,
    })

    if (error) {
      console.error('[restaurante] createMesa', error)
      if (error.code === '23505') return fail('Ya existe una mesa con ese nombre.')
      return fail('No se pudo crear la mesa.')
    }

    revalidatePath('/dashboard/restaurante')
    return { ok: true, data: await getRestaurante() }
  } catch {
    return fail('No tienes permiso para gestionar el restaurante.')
  }
}

const updateTableSchema = tableSchema.extend({ id: z.uuid() })

export async function updateMesa(
  input: z.input<typeof updateTableSchema>,
): Promise<RestauranteResult<RestauranteData>> {
  try {
    const member = await requirePermission('restaurante:write')
    const parsed = updateTableSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('dining_tables')
      .update({
        label: parsed.data.label,
        zone: parsed.data.zone,
        seats: parsed.data.seats,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[restaurante] updateMesa', error)
      if (error.code === '23505') return fail('Ya existe una mesa con ese nombre.')
      return fail('No se pudo actualizar la mesa.')
    }

    revalidatePath('/dashboard/restaurante')
    return { ok: true, data: await getRestaurante() }
  } catch {
    return fail('No tienes permiso para gestionar el restaurante.')
  }
}

const tableStatusSchema = z.object({ id: z.uuid(), status: z.enum(TABLE_STATUSES) })

export async function setMesaStatus(
  input: z.input<typeof tableStatusSchema>,
): Promise<RestauranteResult<RestauranteData>> {
  try {
    const member = await requirePermission('restaurante:write')
    const parsed = tableStatusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('dining_tables')
      .update({ status: parsed.data.status })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[restaurante] setMesaStatus', error)
      return fail('No se pudo actualizar la mesa.')
    }

    revalidatePath('/dashboard/restaurante')
    return { ok: true, data: await getRestaurante() }
  } catch {
    return fail('No tienes permiso para gestionar el restaurante.')
  }
}

/* ─── Orders ───────────────────────────────────────────────────────────── */

const orderItemSchema = z.object({
  menuItemId: z.uuid().nullable().default(null),
  description: z.string().trim().min(1, 'Cada línea necesita una descripción.').max(300),
  quantity: z.coerce.number().int().positive().max(999),
  unitPriceCents: z.coerce.number().int().min(0),
  notes: z.string().trim().max(300).default(''),
})

const orderSchema = z.object({
  tableId: z.uuid().nullable().default(null),
  waiterId: z.uuid().nullable().default(null),
  guests: z.coerce.number().int().min(1).max(200).default(1),
  notes: z.string().trim().max(1000).default(''),
  items: z.array(orderItemSchema).min(1, 'Agrega al menos un plato.').max(200),
})

export async function abrirComanda(
  input: z.input<typeof orderSchema>,
): Promise<RestauranteResult<RestauranteData>> {
  try {
    const member = await requirePermission('restaurante:write')
    const parsed = orderSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    if (parsed.data.tableId) {
      const { data: table } = await supabase
        .from('dining_tables')
        .select('id')
        .eq('id', parsed.data.tableId)
        .eq('org_id', member.orgId)
        .is('deleted_at', null)
        .maybeSingle()
      if (!table) return fail('Esa mesa no existe en tu organización.')
    }

    if (!(await belongsToOrg(supabase, 'employees', parsed.data.waiterId, member.orgId))) {
      return fail('Esa persona no está en el equipo de tu organización.')
    }

    const subtotal = parsed.data.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPriceCents, 0,
    )

    const { data: order, error } = await supabase
      .from('restaurant_orders')
      .insert({
        org_id: member.orgId,
        table_id: parsed.data.tableId,
        waiter_id: parsed.data.waiterId,
        status: 'Abierta',
        guests: parsed.data.guests,
        subtotal_cents: subtotal,
        total_cents: subtotal,
        notes: parsed.data.notes,
      })
      .select('id')
      .single()

    if (error || !order) {
      console.error('[restaurante] abrirComanda', error)
      return fail('No se pudo abrir la comanda.')
    }

    const { error: itemsError } = await supabase.from('restaurant_order_items').insert(
      parsed.data.items.map((item, index) => ({
        order_id: order.id,
        menu_item_id: item.menuItemId,
        description: item.description,
        quantity: item.quantity,
        unit_price_cents: item.unitPriceCents,
        notes: item.notes,
        position: index,
      })),
    )

    if (itemsError) {
      console.error('[restaurante] abrirComanda items', itemsError)
      await supabase.from('restaurant_orders').delete().eq('id', order.id).eq('org_id', member.orgId)
      return fail('No se pudieron guardar los platos de la comanda.')
    }

    // The table follows the order. A comanda open on a table still marked
    // "Libre" is how two parties end up seated at the same table.
    if (parsed.data.tableId) {
      await supabase
        .from('dining_tables')
        .update({ status: 'Ocupada' })
        .eq('id', parsed.data.tableId)
        .eq('org_id', member.orgId)
    }

    revalidatePath('/dashboard/restaurante')
    return { ok: true, data: await getRestaurante() }
  } catch {
    return fail('No tienes permiso para gestionar el restaurante.')
  }
}

const orderStatusSchema = z.object({
  id: z.uuid(),
  status: z.enum(RESTAURANT_ORDER_STATUSES),
  tipCents: z.coerce.number().int().min(0).nullable().default(null),
  /**
   * Con qué se pagó. Solo se pregunta al cobrar, y solo entonces se guarda.
   *
   * Existe desde la migración 44 y es lo que decide si la comanda cuenta para
   * el arqueo: una mesa pagada con datáfono se cobró y no está en el cajón.
   * Sin esta columna, un restaurante que acepta tarjeta cerraba con un
   * faltante igual a lo cobrado con ella, todas las noches.
   */
  paymentMethod: z.enum(PAYMENT_METHODS).nullable().default(null),
})

/**
 * Moves a comanda along, and frees its table when it closes.
 *
 * Paying is the only transition that touches the total, because the tip is
 * only known then. Releasing the table is what stops the floor plan drifting
 * out of step with the room over a service.
 *
 * ─── Y ahora, la comanda entra al arqueo ───────────────────────────────────
 *
 * `restaurant_orders.cash_session_id` existe desde la migración 25 con este
 * comentario: «Set when the order is paid; what expected_cents is summed
 * from». Nada la escribía. El cierre de caja sumaba exactamente esa columna, y
 * por eso daba cero todas las noches — no fallaba, respondía cero, que es la
 * forma más silenciosa de estar roto.
 *
 * Aquí se cierra: al marcar «Pagada», la comanda queda atada al turno que
 * estuviera abierto. Nulo si no hay ninguno, lo cual es legítimo — un local que
 * no lleva caja sigue cobrando igual — y es lo que hace que la cifra del arqueo
 * signifique algo cuando sí la lleva.
 */
export async function setComandaStatus(
  input: z.input<typeof orderStatusSchema>,
): Promise<RestauranteResult<RestauranteData>> {
  try {
    const member = await requirePermission('restaurante:write')
    const parsed = orderStatusSchema.safeParse(input)
    if (!parsed.success) return fail('Datos inválidos.')

    const supabase = await createClient()
    const { data: order } = await supabase
      .from('restaurant_orders')
      .select('id, table_id, subtotal_cents, tip_cents')
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!order) return fail('Esa comanda no existe en tu organización.')

    const closed = parsed.data.status === 'Pagada' || parsed.data.status === 'Anulada'
    const tip = parsed.data.tipCents ?? order.tip_cents

    /**
     * El turno abierto, solo al cobrar.
     *
     * Se busca aquí y no se recibe del navegador: el turno es un hecho del
     * servidor, y aceptarlo del cliente permitiría cargar una venta al arqueo
     * de ayer. `cash_sessions_one_open` garantiza que haya a lo sumo uno, así
     * que no hay que desempatar.
     *
     * Solo si la empresa lleva caja. Sin el módulo la consulta sería un rechazo
     * por RLS, y anotarlo como «no había turno» es la lectura correcta igual.
     */
    let sessionId: string | null = null
    if (parsed.data.status === 'Pagada' && member.modules.has('caja')) {
      const { data: session } = await supabase
        .from('cash_sessions')
        .select('id')
        .eq('org_id', member.orgId)
        .eq('status', 'Abierta')
        .maybeSingle()
      sessionId = session?.id ?? null
    }

    const { error } = await supabase
      .from('restaurant_orders')
      .update({
        status: parsed.data.status,
        tip_cents: tip,
        total_cents: order.subtotal_cents + tip,
        closed_at: closed ? new Date().toISOString() : null,
        // Ausentes cuando no se está cobrando: marcar una comanda «Servida» no
        // debe borrar el medio de pago ni desatarla de un turno al que ya
        // entró, cosa que un `null` incondicional haría.
        ...(parsed.data.status === 'Pagada'
          ? {
              cash_session_id: sessionId,
              ...(parsed.data.paymentMethod ? { payment_method: parsed.data.paymentMethod } : {}),
            }
          : {}),
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[restaurante] setComandaStatus', error)
      return fail('No se pudo actualizar la comanda.')
    }

    if (closed && order.table_id) {
      await supabase
        .from('dining_tables')
        .update({ status: 'Libre' })
        .eq('id', order.table_id)
        .eq('org_id', member.orgId)
    }

    revalidatePath('/dashboard/restaurante')
    return { ok: true, data: await getRestaurante() }
  } catch {
    return fail('No tienes permiso para gestionar el restaurante.')
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Reservas
 *
 * A booking is taken by phone before anything else exists — no table, no
 * order, sometimes no confirmed party size. So almost everything is optional
 * and only the name and the moment are required: a reservation form that
 * refuses to save until a table is picked is a form nobody can use while the
 * customer is still on the line.
 * ═══════════════════════════════════════════════════════════════════════════ */

const reservaSchema = z.object({
  guestName: z.string().trim().min(2, 'Escribe a nombre de quién.').max(160),
  guestPhone: z.string().trim().max(40).default(''),
  partySize: z.coerce.number().int().min(1, 'Al menos una persona.').max(200).default(2),
  reservedAt: z.string().min(1, 'Indica fecha y hora.'),
  tableId: z.uuid().nullable().default(null),
  status: z.enum(TABLE_RESERVATION_STATUSES).default('Confirmada'),
  notes: z.string().trim().max(1000).default(''),
})

export async function crearReserva(
  input: z.input<typeof reservaSchema>,
): Promise<RestauranteResult<RestauranteData>> {
  try {
    const member = await requirePermission('restaurante:write')
    const parsed = reservaSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const when = new Date(parsed.data.reservedAt)
    if (Number.isNaN(when.getTime())) return fail('La fecha de la reserva no es válida.')

    const supabase = await createClient()
    // The table is a pointer into this organization, and the foreign key alone
    // would accept one belonging to another tenant only to have RLS refuse the
    // read later — checked here so the refusal is a sentence.
    if (parsed.data.tableId
        && !(await belongsToOrg(supabase, 'dining_tables', parsed.data.tableId, member.orgId))) {
      return fail('Esa mesa ya no existe.')
    }

    const { error } = await supabase.from('restaurant_reservations').insert({
      org_id: member.orgId,
      table_id: parsed.data.tableId,
      guest_name: parsed.data.guestName,
      guest_phone: parsed.data.guestPhone,
      party_size: parsed.data.partySize,
      reserved_at: when.toISOString(),
      status: parsed.data.status,
      notes: parsed.data.notes,
    })

    if (error) {
      console.error('[restaurante] crearReserva', error)
      return fail('No se pudo crear la reserva.')
    }

    revalidatePath('/dashboard/restaurante')
    return { ok: true, data: await getRestaurante() }
  } catch {
    return fail('No tienes permiso para gestionar el restaurante.')
  }
}

export async function setReservaStatus(
  id: string,
  status: (typeof TABLE_RESERVATION_STATUSES)[number],
): Promise<RestauranteResult<RestauranteData>> {
  try {
    const member = await requirePermission('restaurante:write')
    if (!z.uuid().safeParse(id).success) return fail('Reserva desconocida.')
    if (!TABLE_RESERVATION_STATUSES.includes(status)) return fail('Estado desconocido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('restaurant_reservations')
      .update({ status })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[restaurante] setReservaStatus', error)
      return fail('No se pudo actualizar la reserva.')
    }

    revalidatePath('/dashboard/restaurante')
    return { ok: true, data: await getRestaurante() }
  } catch {
    return fail('No tienes permiso para gestionar el restaurante.')
  }
}

export async function eliminarReserva(id: string): Promise<RestauranteResult<RestauranteData>> {
  try {
    const member = await requirePermission('restaurante:write')
    if (!z.uuid().safeParse(id).success) return fail('Reserva desconocida.')

    const supabase = await createClient()
    // Soft delete: a cancelled booking that vanishes takes the no-show record
    // with it, and no-shows are the reason anyone keeps this list.
    const { error } = await supabase
      .from('restaurant_reservations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[restaurante] eliminarReserva', error)
      return fail('No se pudo eliminar la reserva.')
    }

    revalidatePath('/dashboard/restaurante')
    return { ok: true, data: await getRestaurante() }
  } catch {
    return fail('No tienes permiso para gestionar el restaurante.')
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Costeo — los insumos de cada plato
 *
 * `menu_items.cost_cents` is maintained by a trigger from these rows
 * (migration 25), so nothing here writes it: a mutation that also set the cost
 * by hand would be a second author for one number.
 * ═══════════════════════════════════════════════════════════════════════════ */

const insumoSchema = z.object({
  menuItemId: z.uuid(),
  name: z.string().trim().min(1, 'Escribe el insumo.').max(120),
  quantity: z.coerce.number().positive('La cantidad debe ser mayor que cero.').max(100000),
  unit: z.enum(INGREDIENT_UNITS).default('g'),
  costCents: z.coerce.number().int().min(0).default(0),
})

export async function agregarInsumo(
  input: z.input<typeof insumoSchema>,
): Promise<RestauranteResult<RestauranteData>> {
  try {
    const member = await requirePermission('restaurante:write')
    const parsed = insumoSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    if (!(await belongsToOrg(supabase, 'menu_items', parsed.data.menuItemId, member.orgId))) {
      return fail('Ese plato ya no existe.')
    }

    const { error } = await supabase.from('menu_item_ingredients').insert({
      menu_item_id: parsed.data.menuItemId,
      name: parsed.data.name,
      quantity: parsed.data.quantity,
      unit: parsed.data.unit,
      cost_cents: parsed.data.costCents,
    })

    if (error) {
      console.error('[restaurante] agregarInsumo', error)
      return fail('No se pudo agregar el insumo.')
    }

    revalidatePath('/dashboard/restaurante')
    return { ok: true, data: await getRestaurante() }
  } catch {
    return fail('No tienes permiso para gestionar el restaurante.')
  }
}

export async function eliminarInsumo(id: string): Promise<RestauranteResult<RestauranteData>> {
  try {
    await requirePermission('restaurante:write')
    if (!z.uuid().safeParse(id).success) return fail('Insumo desconocido.')

    const supabase = await createClient()
    // Hard delete, and no org filter: a recipe line only exists inside its
    // dish, and child RLS refuses a row belonging to another tenant before
    // this statement can touch it.
    const { error } = await supabase.from('menu_item_ingredients').delete().eq('id', id)

    if (error) {
      console.error('[restaurante] eliminarInsumo', error)
      return fail('No se pudo eliminar el insumo.')
    }

    revalidatePath('/dashboard/restaurante')
    return { ok: true, data: await getRestaurante() }
  } catch {
    return fail('No tienes permiso para gestionar el restaurante.')
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Caja — apertura, cierre y arqueo
 * ═══════════════════════════════════════════════════════════════════════════ */

const abrirCajaSchema = z.object({
  openedBy: z.uuid().nullable().default(null),
  openingFloatCents: z.coerce.number().int().min(0).default(0),
  notes: z.string().trim().max(1000).default(''),
})

export async function abrirCaja(
  input: z.input<typeof abrirCajaSchema>,
): Promise<RestauranteResult<RestauranteData>> {
  try {
    const member = await requirePermission('restaurante:write')
    const parsed = abrirCajaSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    if (parsed.data.openedBy
        && !(await belongsToOrg(supabase, 'employees', parsed.data.openedBy, member.orgId))) {
      return fail('Esa persona ya no está en el equipo.')
    }

    const { error } = await supabase.from('cash_sessions').insert({
      org_id: member.orgId,
      opened_by: parsed.data.openedBy,
      opening_float_cents: parsed.data.openingFloatCents,
      notes: parsed.data.notes,
    })

    if (error) {
      // 23505 here is `cash_sessions_one_open`, the partial unique index that
      // allows a single open till per organization. Two open sessions would
      // make every order's arqueo a guess, so the refusal is the feature.
      if (error.code === '23505') {
        return fail('Ya hay una caja abierta. Ciérrala antes de abrir otra.')
      }
      console.error('[restaurante] abrirCaja', error)
      return fail('No se pudo abrir la caja.')
    }

    revalidatePath('/dashboard/restaurante')
    return { ok: true, data: await getRestaurante() }
  } catch {
    return fail('No tienes permiso para gestionar el restaurante.')
  }
}

const cerrarCajaSchema = z.object({
  id: z.uuid(),
  countedCents: z.coerce.number().int().min(0),
  closedBy: z.uuid().nullable().default(null),
  notes: z.string().trim().max(1000).default(''),
})

/**
 * Cierra la caja y congela el arqueo.
 *
 * `expected_cents` se guarda en vez de recalcularse en cada lectura, para que
 * lo que el cajón debía tener el martes siga siendo eso aunque el jueves se
 * corrija una comanda del martes.
 *
 * ─── Por qué ya no suma por su cuenta ──────────────────────────────────────
 *
 * Lo hacía, y sumaba mal dos veces. Contaba solo las comandas —- ignorando la
 * base inicial, que el propio comentario de la columna dice que es parte del
 * conteo, y los movimientos, que ni existían—- y como nada escribía
 * `cash_session_id`, esa suma daba cero. Un cierre que siempre reporta cero no
 * se ve roto: se ve como un local que no vendió nada.
 *
 * Ahora usa `expectedFor` y `salesForSession`, las mismas que la pantalla de
 * Caja. Dos cierres con aritmética distinta es peor que uno solo, porque quien
 * firma no sabe cuál de los dos leyó — y este cierre y el de /dashboard/caja
 * pueden cerrar el mismo turno.
 */
export async function cerrarCaja(
  input: z.input<typeof cerrarCajaSchema>,
): Promise<RestauranteResult<RestauranteData>> {
  try {
    const member = await requirePermission('restaurante:write')
    const parsed = cerrarCajaSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    const { data: session } = await supabase
      .from('cash_sessions')
      .select('id, status, opening_float_cents')
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)
      .maybeSingle()

    if (!session) return fail('Esa caja ya no existe.')
    if (session.status === 'Cerrada') return fail('Esa caja ya está cerrada.')

    if (parsed.data.closedBy
        && !(await belongsToOrg(supabase, 'employees', parsed.data.closedBy, member.orgId))) {
      return fail('Esa persona ya no está en el equipo.')
    }

    // Las tres fuentes, con la misma aritmética que /dashboard/caja.
    const [sales, { data: movements }] = await Promise.all([
      salesForSession(supabase, member.modules, member.orgId, session.id),
      supabase
        .from('cash_movements')
        .select('kind, amount_cents, method')
        .eq('session_id', session.id),
    ])

    const expected = expectedFor(
      session.opening_float_cents,
      sales,
      (movements ?? []).map((m) => ({
        kind: m.kind, amountCents: m.amount_cents, method: m.method,
      })),
    )

    const { error } = await supabase
      .from('cash_sessions')
      .update({
        status: 'Cerrada',
        closed_at: new Date().toISOString(),
        closed_by: parsed.data.closedBy,
        counted_cents: parsed.data.countedCents,
        // Nunca negativo: la columna tiene un check, y un turno con más egresos
        // que ingresos en efectivo es un error de captura, no un cajón que deba
        // dinero. La diferencia lo delata igual.
        expected_cents: Math.max(expected, 0),
        notes: parsed.data.notes,
      })
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[restaurante] cerrarCaja', error)
      return fail('No se pudo cerrar la caja.')
    }

    revalidatePath('/dashboard/restaurante')
    return { ok: true, data: await getRestaurante() }
  } catch {
    return fail('No tienes permiso para gestionar el restaurante.')
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Domicilios
 * ═══════════════════════════════════════════════════════════════════════════ */

const domicilioSchema = z.object({
  orderId: z.uuid(),
  address: z.string().trim().min(4, 'Escribe la dirección de entrega.').max(240),
  phone: z.string().trim().max(40).default(''),
  courierId: z.uuid().nullable().default(null),
  feeCents: z.coerce.number().int().min(0).default(0),
})

/**
 * Turns an order into a delivery.
 *
 * Also moves `service_kind` off «Salón», because the two are one fact: an
 * order with a delivery row that still claims to be served at a table would
 * appear in the floor's covers and in the courier's list at once.
 */
export async function crearDomicilio(
  input: z.input<typeof domicilioSchema>,
): Promise<RestauranteResult<RestauranteData>> {
  try {
    const member = await requirePermission('restaurante:write')
    const parsed = domicilioSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    if (!(await belongsToOrg(supabase, 'restaurant_orders', parsed.data.orderId, member.orgId))) {
      return fail('Esa comanda ya no existe.')
    }
    if (parsed.data.courierId
        && !(await belongsToOrg(supabase, 'employees', parsed.data.courierId, member.orgId))) {
      return fail('Esa persona ya no está en el equipo.')
    }

    const { error } = await supabase.from('restaurant_deliveries').insert({
      order_id: parsed.data.orderId,
      address: parsed.data.address,
      phone: parsed.data.phone,
      courier_id: parsed.data.courierId,
      fee_cents: parsed.data.feeCents,
    })

    if (error) {
      // `unique (order_id)`: one bill, one address.
      if (error.code === '23505') return fail('Esa comanda ya tiene un domicilio.')
      console.error('[restaurante] crearDomicilio', error)
      return fail('No se pudo crear el domicilio.')
    }

    const { error: kindError } = await supabase
      .from('restaurant_orders')
      .update({ service_kind: 'Domicilio' })
      .eq('id', parsed.data.orderId)
      .eq('org_id', member.orgId)

    if (kindError) console.error('[restaurante] crearDomicilio kind', kindError)

    revalidatePath('/dashboard/restaurante')
    return { ok: true, data: await getRestaurante() }
  } catch {
    return fail('No tienes permiso para gestionar el restaurante.')
  }
}

export async function setDomicilioStatus(
  id: string,
  status: (typeof DELIVERY_STATUSES)[number],
): Promise<RestauranteResult<RestauranteData>> {
  try {
    await requirePermission('restaurante:write')
    if (!z.uuid().safeParse(id).success) return fail('Domicilio desconocido.')
    if (!DELIVERY_STATUSES.includes(status)) return fail('Estado desconocido.')

    const supabase = await createClient()
    // `dispatched_at` and `delivered_at` are stamped by the trigger in
    // migration 25, so they are deliberately absent here: a delivery cannot
    // claim to have arrived before it left, whichever path wrote the status.
    const { error } = await supabase
      .from('restaurant_deliveries')
      .update({ status })
      .eq('id', id)

    if (error) {
      console.error('[restaurante] setDomicilioStatus', error)
      return fail('No se pudo actualizar el domicilio.')
    }

    revalidatePath('/dashboard/restaurante')
    return { ok: true, data: await getRestaurante() }
  } catch {
    return fail('No tienes permiso para gestionar el restaurante.')
  }
}
