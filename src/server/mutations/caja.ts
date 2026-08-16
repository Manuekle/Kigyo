'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { maybePostAutoEntry } from '@/server/contabilidad-auto'
import { CASH_MOVEMENT_KINDS, PAYMENT_METHODS } from '@/lib/domain'
import { expectedFor, getCaja, type CajaData } from '@/server/queries/caja'

export type CajaResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const DENIED = 'No tienes permiso para gestionar la caja.'

async function refreshed(): Promise<CajaResult<CajaData>> {
  revalidatePath('/dashboard/caja')
  return { ok: true, data: await getCaja() }
}

/** Quién está operando, para firmar la apertura y el cierre. */
async function currentEmployee(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('employees')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle()
  return data?.id ?? null
}

/* ─── Abrir turno ──────────────────────────────────────────────────────── */

const openSchema = z.object({
  openingFloatCents: z.coerce.number().int().min(0).max(1_000_000_00).default(0),
  notes: z.string().trim().max(1000).default(''),
  /** Sucursal del turno. Null = sin sucursal (la venta POS decide por turno). */
  siteId: z.string().uuid().nullable().default(null),
})

/**
 * Abre el turno.
 *
 * A lo sumo uno por empresa, y quien lo garantiza es el índice parcial
 * `cash_sessions_one_open` de la migración 25, no esta función. La comprobación
 * de abajo existe para dar una frase en vez de un `23505`; si dos personas
 * abren a la vez, la base rechaza la segunda y aquí se traduce igual.
 */
export async function abrirCaja(
  input: z.input<typeof openSchema>,
): Promise<CajaResult<CajaData>> {
  try {
    const member = await requirePermission('caja:write')
    const parsed = openSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    const employeeId = await currentEmployee(supabase, member.orgId, member.userId)

    // La política restrictive de `cash_sessions` ya rechaza un site ajeno, pero
    // un 42501 dice «política violada» y no «sucursal equivocada»; se pregunta
    // primero para dar la frase que corresponde. La consulta va por `scoped`,
    // así que un site de otra empresa no aparece y el fallo es honesto.
    if (parsed.data.siteId) {
      const { data: site } = await supabase
        .from('sites')
        .select('id')
        .eq('id', parsed.data.siteId)
        .is('deleted_at', null)
        .maybeSingle()
      if (!site) return fail('Esa sucursal no existe en esta empresa.')
    }

    const { error } = await supabase.from('cash_sessions').insert({
      org_id: member.orgId,
      opened_by: employeeId,
      opening_float_cents: parsed.data.openingFloatCents,
      notes: parsed.data.notes,
      status: 'Abierta',
      site_id: parsed.data.siteId,
    })

    if (error) {
      console.error('[caja] abrirCaja', error)
      if (error.code === '23505') return fail('Ya hay un turno de caja abierto.')
      return fail('No se pudo abrir la caja.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/* ─── Cerrar turno ─────────────────────────────────────────────────────── */

const closeSchema = z.object({
  sessionId: z.uuid(),
  countedCents: z.coerce.number().int().min(0).max(1_000_000_00),
  notes: z.string().trim().max(1000).default(''),
})

/**
 * Cierra el turno contra lo que se contó en el cajón.
 *
 * `expected_cents` se congela aquí, calculado con la misma función que la
 * pantalla venía usando todo el día (`expectedFor`). Cuando el cierre hacía su
 * propia suma, el arqueo daba una diferencia distinta a la que se veía en
 * vivo y no había forma de saber cuál de las dos estaba mal.
 *
 * Congelado y no derivado, porque después se anulan ventas: el arqueo de esa
 * tarde tiene que seguir diciendo lo mismo dentro de un año.
 */
export async function cerrarCaja(
  input: z.input<typeof closeSchema>,
): Promise<CajaResult<CajaData>> {
  try {
    const member = await requirePermission('caja:write')
    const parsed = closeSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    const { data: session } = await supabase
      .from('cash_sessions')
      .select('id, opening_float_cents, status')
      .eq('id', parsed.data.sessionId)
      .eq('org_id', member.orgId)
      .maybeSingle()

    if (!session) return fail('Ese turno no existe en esta empresa.')
    if (session.status === 'Cerrada') return fail('Ese turno ya estaba cerrado.')

    // Las dos fuentes de lo esperado. Las ventas solo si la empresa vende de
    // mostrador: sin el módulo la consulta sería un rechazo por permisos, no
    // una lista vacía.
    const [{ data: movements }, salesResult] = await Promise.all([
      supabase
        .from('cash_movements')
        .select('kind, amount_cents, method')
        .eq('session_id', session.id),
      member.modules.has('pos')
        ? supabase
            .from('pos_sales')
            .select('total_cents, payment_method, status')
            .eq('session_id', session.id)
        : Promise.resolve({ data: [] as Array<{
            total_cents: number; payment_method: string; status: string
          }> }),
    ])

    const expected = expectedFor(
      session.opening_float_cents,
      (salesResult.data ?? []).map((s) => ({
        totalCents: s.total_cents, paymentMethod: s.payment_method, status: s.status,
      })),
      (movements ?? []).map((m) => ({
        kind: m.kind, amountCents: m.amount_cents, method: m.method,
      })),
    )

    const employeeId = await currentEmployee(supabase, member.orgId, member.userId)

    const { error } = await supabase
      .from('cash_sessions')
      .update({
        status: 'Cerrada',
        closed_at: new Date().toISOString(),
        closed_by: employeeId,
        counted_cents: parsed.data.countedCents,
        // Nunca negativo: la columna tiene un check, y un turno con más egresos
        // que ingresos en efectivo es un error de captura, no un cajón que debe
        // dinero. Se guarda en cero y la diferencia lo delata.
        expected_cents: Math.max(expected, 0),
        notes: parsed.data.notes,
      })
      .eq('id', session.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[caja] cerrarCaja', error)
      return fail('No se pudo cerrar la caja.')
    }

    // La diferencia del arqueo es un hecho contable: faltante = gasto diverso,
    // sobrante = ingreso diverso. Cero = caja cuadrada, y el gancho no anota
    // nada (post_auto_entry devuelve null sin error).
    await maybePostAutoEntry(
      member, 'caja_diferencia', 'Caja', session.id,
      `Diferencia de caja`,
      new Date().toISOString().slice(0, 10),
      parsed.data.countedCents - Math.max(expected, 0),
    )

    revalidatePath('/dashboard/contabilidad')
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

/* ─── Movimientos ──────────────────────────────────────────────────────── */

const movementSchema = z.object({
  sessionId: z.uuid(),
  kind: z.enum(CASH_MOVEMENT_KINDS).default('Egreso'),
  amountCents: z.coerce.number().int().min(1, 'El monto debe ser mayor que cero.').max(1_000_000_00),
  concept: z.string().trim().min(1, 'Escribe el concepto.').max(200),
  method: z.enum(PAYMENT_METHODS).default('Efectivo'),
})

/**
 * Anota lo que entró o salió del cajón y no fue una venta.
 *
 * Las ventas no pasan por aquí: llegan solas desde `pos_sales` y desde las
 * comandas, y anotarlas además como movimiento las contaría dos veces en el
 * arqueo. Es el error más fácil de cometer y el más caro de encontrar después.
 */
export async function registrarMovimiento(
  input: z.input<typeof movementSchema>,
): Promise<CajaResult<CajaData>> {
  try {
    const member = await requirePermission('caja:write')
    const parsed = movementSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()

    const { data: session } = await supabase
      .from('cash_sessions')
      .select('id, status')
      .eq('id', parsed.data.sessionId)
      .eq('org_id', member.orgId)
      .maybeSingle()

    if (!session) return fail('Ese turno no existe en esta empresa.')
    if (session.status === 'Cerrada') {
      return fail('Ese turno ya está cerrado. Un arqueo firmado no se reescribe.')
    }

    const employeeId = await currentEmployee(supabase, member.orgId, member.userId)

    const { error } = await supabase.from('cash_movements').insert({
      session_id: session.id,
      kind: parsed.data.kind,
      amount_cents: parsed.data.amountCents,
      concept: parsed.data.concept,
      method: parsed.data.method,
      created_by: employeeId,
    })

    if (error) {
      console.error('[caja] registrarMovimiento', error)
      return fail('No se pudo registrar el movimiento.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}

export async function eliminarMovimiento(id: string): Promise<CajaResult<CajaData>> {
  try {
    await requirePermission('caja:write')
    if (!z.uuid().safeParse(id).success) return fail('Movimiento inválido.')

    const supabase = await createClient()
    // Borrado real, no suave: un movimiento mal tecleado hace cinco segundos no
    // es historia que preservar, y mientras el turno esté abierto el arqueo
    // todavía no ha firmado nada. La política de `cash_movements` solo permite
    // llegar aquí a quien puede escribir la caja de esta empresa.
    const { error } = await supabase.from('cash_movements').delete().eq('id', id)

    if (error) {
      console.error('[caja] eliminarMovimiento', error)
      return fail('No se pudo eliminar el movimiento.')
    }
    return refreshed()
  } catch {
    return fail(DENIED)
  }
}
