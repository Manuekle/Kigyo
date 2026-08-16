import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { rosterFor, scoped, type RosterEntry } from './shared'

/**
 * El turno de caja: qué se abrió, qué entró, qué salió y si cuadró.
 *
 * El módulo vivía dentro de «restaurante» desde la migración 25 y desde la 43
 * es transversal — la misma aritmética la hacen la tienda, la clínica, el hotel
 * y el gimnasio, y ninguno de los cuatro debería encender un módulo de
 * restaurantes para cuadrar su cajón.
 *
 * ─── De dónde sale «lo esperado» ─────────────────────────────────────────
 *
 * De tres sitios, y ese es justamente el motivo de que se calcule aquí y no en
 * una columna:
 *
 *   · base inicial       — `opening_float_cents`, lo que había antes de vender
 *   · ventas en efectivo — `pos_sales` y las comandas del restaurante
 *   · movimientos        — propinas pagadas, retiros, caja menor
 *
 * Solo cuenta el efectivo. Una venta con tarjeta no está en el cajón, y
 * sumarla al esperado hace que el arqueo dé una diferencia que no existe —
 * el error clásico, y el que más tiempo hace perder buscándolo.
 *
 * Al cerrar, el número se congela en `expected_cents` para que el arqueo de esa
 * tarde siga diciendo lo mismo dentro de un año, aunque después se anule una
 * venta vieja.
 */

export interface MovementRow {
  id: string
  kind: string
  amountCents: number
  concept: string
  method: string
  createdByName: string | null
  createdAt: string
}

export interface SaleSummary {
  id: string
  code: string | null
  totalCents: number
  paymentMethod: string
  status: string
  soldAt: string
  customerName: string
}

export interface SessionRow {
  id: string
  code: string | null
  openedByName: string | null
  openedAt: string
  openingFloatCents: number
  closedAt: string | null
  closedByName: string | null
  countedCents: number | null
  /** Congelado al cerrar; calculado en vivo mientras el turno está abierto. */
  expectedCents: number | null
  status: string
  notes: string
  /** `countedCents - expectedCents`. Null mientras no se haya contado. */
  differenceCents: number | null
  siteId: string | null
  siteName: string | null
}

export interface CajaData {
  /** El turno abierto, si lo hay. A lo sumo uno: índice parcial en la mig. 25. */
  abierta: SessionRow | null
  /** Movimientos del turno abierto. Vacío cuando no hay turno. */
  movimientos: MovementRow[]
  /** Ventas de mostrador cobradas en el turno abierto. */
  ventas: SaleSummary[]
  /** Turnos cerrados, del más reciente hacia atrás. */
  historial: SessionRow[]
  /** Desglose del turno abierto, en centavos. */
  resumen: {
    baseCents: number
    ventasEfectivoCents: number
    ventasOtrosCents: number
    ingresosCents: number
    egresosCents: number
    esperadoCents: number
  }
  roster: RosterEntry[]
  canWrite: boolean
  /** Si esta empresa también vende de mostrador, para enlazar las dos pantallas. */
  hasPos: boolean
  /** Sucursales activas, para elegir al abrir el turno. */
  sites: Array<{ id: string; name: string }>
}

interface SessionRecord {
  id: string
  code: string | null
  opened_by: string | null
  opened_at: string
  opening_float_cents: number
  closed_at: string | null
  closed_by: string | null
  counted_cents: number | null
  expected_cents: number | null
  status: string
  notes: string
  site_id: string | null
}

const SESSION_COLUMNS = `id, code, opened_by, opened_at, opening_float_cents,
   closed_at, closed_by, counted_cents, expected_cents, status, notes, site_id`

/** Solo el efectivo llega al cajón. Ver la nota de arriba. */
export function isCash(method: string): boolean {
  return method === 'Efectivo'
}

/**
 * Lo que debería haber en el cajón, dado lo que pasó en el turno.
 *
 * Pura y exportada para que la pantalla, los dos cierres y las pruebas usen la
 * misma aritmética. Hubo un momento en que existían dos: la de esta pantalla y
 * la de `restaurante.ts`, que sumaba solo las comandas y se olvidaba de la base
 * inicial. Dos cierres que no coinciden es peor que ninguno, porque el que
 * firma no sabe cuál de los dos leyó.
 *
 * `sales` mezcla las dos fuentes de venta —- mostrador y comandas—- porque para
 * el cajón son lo mismo: dinero que entró por vender algo. Lo que las distingue
 * es el medio de pago, y eso ya lo lleva cada fila.
 */
export function expectedFor(
  openingFloatCents: number,
  sales: ReadonlyArray<{ totalCents: number; paymentMethod: string; status: string }>,
  movements: ReadonlyArray<{ kind: string; amountCents: number; method: string }>,
): number {
  let total = openingFloatCents

  for (const sale of sales) {
    // «Anulada» cubre las dos vocabularios: una venta de mostrador anulada y
    // una comanda anulada se llaman igual, que es lo que permite tratarlas
    // juntas aquí.
    if (sale.status === 'Anulada' || !isCash(sale.paymentMethod)) continue
    total += sale.totalCents
  }

  for (const movement of movements) {
    if (!isCash(movement.method)) continue
    // «Ingreso» suma; «Egreso», «Retiro» y «Gasto» restan. El signo lo pone el
    // tipo y nunca el monto — ver el check de la migración 43.
    total += movement.kind === 'Ingreso' ? movement.amountCents : -movement.amountCents
  }

  return total
}

/** Una venta, venga del mostrador o de una mesa. Ver `expectedFor`. */
export interface SessionSale {
  totalCents: number
  paymentMethod: string
  status: string
  /** De dónde vino, para que la pantalla pueda desglosarlo. */
  source: 'pos' | 'restaurante'
}

/**
 * Todo lo que se vendió en un turno, de las dos fuentes que existen.
 *
 * Una función y no dos consultas sueltas porque los dos cierres —- el de esta
 * pantalla y el de restaurante—- tienen que ver exactamente lo mismo. Cuando
 * cada uno leía por su cuenta, el del restaurante sumaba solo comandas y el de
 * caja solo ventas de mostrador, y un local que usara ambos cerraba con la
 * mitad del dinero según el botón que hubiera tocado.
 *
 * Cada fuente se lee solo si la empresa tiene ese módulo: sin él la consulta
 * vuelve vacía por RLS, que es indistinguible de «no hubo ventas» y produce un
 * faltante inventado.
 */
export async function salesForSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  modules: ReadonlySet<string>,
  orgId: string,
  sessionId: string,
): Promise<SessionSale[]> {
  const [posResult, orderResult] = await Promise.all([
    modules.has('pos')
      ? supabase
          .from('pos_sales')
          .select('total_cents, payment_method, status')
          .eq('org_id', orgId)
          .eq('session_id', sessionId)
      : Promise.resolve({ data: [] as Array<{
          total_cents: number; payment_method: string; status: string
        }> }),
    modules.has('restaurante')
      ? supabase
          .from('restaurant_orders')
          .select('total_cents, payment_method, status')
          .eq('org_id', orgId)
          .eq('cash_session_id', sessionId)
          .is('deleted_at', null)
      : Promise.resolve({ data: [] as Array<{
          total_cents: number; payment_method: string; status: string
        }> }),
  ])

  return [
    ...(posResult.data ?? []).map((s) => ({
      totalCents: s.total_cents,
      paymentMethod: s.payment_method,
      status: s.status,
      source: 'pos' as const,
    })),
    // Solo las cobradas. Una comanda «Servida» todavía no puso dinero en el
    // cajón, y una «Abierta» menos.
    ...(orderResult.data ?? [])
      .filter((o) => o.status === 'Pagada')
      .map((o) => ({
        totalCents: o.total_cents,
        paymentMethod: o.payment_method,
        status: o.status,
        source: 'restaurante' as const,
      })),
  ]
}

function toSession(
  row: SessionRecord,
  names: Map<string, string>,
  siteNames: Map<string, string>,
  liveExpected: number | null,
): SessionRow {
  const expected = row.expected_cents ?? liveExpected
  return {
    id: row.id,
    code: row.code,
    openedByName: row.opened_by ? names.get(row.opened_by) ?? null : null,
    openedAt: row.opened_at,
    openingFloatCents: row.opening_float_cents,
    closedAt: row.closed_at,
    closedByName: row.closed_by ? names.get(row.closed_by) ?? null : null,
    countedCents: row.counted_cents,
    expectedCents: expected,
    status: row.status,
    notes: row.notes,
    differenceCents:
      row.counted_cents !== null && expected !== null ? row.counted_cents - expected : null,
    siteId: row.site_id,
    siteName: row.site_id ? siteNames.get(row.site_id) ?? null : null,
  }
}

export async function getCaja(): Promise<CajaData> {
  const member = await requirePermission('caja:read')
  const supabase = await createClient()

  const [openResult, historyResult, roster, sitesResult] = await Promise.all([
    scoped(supabase, member, 'cash_sessions')
      .select(SESSION_COLUMNS)
      .eq('status', 'Abierta')
      .maybeSingle(),
    scoped(supabase, member, 'cash_sessions')
      .select(SESSION_COLUMNS)
      .eq('status', 'Cerrada')
      .order('closed_at', { ascending: false })
      .limit(60),
    rosterFor(supabase, member),
    scoped(supabase, member, 'sites')
      .select('id, name')
      .is('deleted_at', null)
      .order('name', { ascending: true }),
  ])

  const names = new Map(roster.map((r) => [r.employeeId, r.fullName]))
  const sites = ((sitesResult.data ?? []) as Array<{ id: string; name: string }>)
  const siteNames = new Map(sites.map((s) => [s.id, s.name]))
  const open = (openResult.data ?? null) as SessionRecord | null
  const historyRows = (historyResult.data ?? []) as SessionRecord[]

  let movimientos: MovementRow[] = []
  let ventas: SaleSummary[] = []

  /** Todo lo vendido en el turno, para el cálculo. Las dos fuentes juntas. */
  let sales: Awaited<ReturnType<typeof salesForSession>> = []

  if (open) {
    // La lista detallada de ventas de mostrador se lee solo si esta empresa
    // tiene el módulo: `pos_sales` exige `pos:read`, y una clínica con caja y
    // sin mostrador recibiría una lista vacía por permisos, que es
    // indistinguible de «no hubo ventas».
    const wantsSales = member.modules.has('pos') && can(member.permissions, 'pos:read')

    const [movementsResult, salesResult, allSales] = await Promise.all([
      supabase
        .from('cash_movements')
        .select('id, kind, amount_cents, concept, method, created_by, created_at')
        .eq('session_id', open.id)
        .order('created_at', { ascending: false }),
      wantsSales
        ? supabase
            .from('pos_sales')
            .select('id, code, total_cents, payment_method, status, sold_at, customer_name')
            .eq('session_id', open.id)
            .order('sold_at', { ascending: false })
        : Promise.resolve({ data: [] as Array<Record<string, never>> }),
      salesForSession(supabase, member.modules, member.orgId, open.id),
    ])

    movimientos = ((movementsResult.data ?? []) as Array<{
      id: string; kind: string; amount_cents: number; concept: string
      method: string; created_by: string | null; created_at: string
    }>).map((row) => ({
      id: row.id,
      kind: row.kind,
      amountCents: row.amount_cents,
      concept: row.concept,
      method: row.method,
      createdByName: row.created_by ? names.get(row.created_by) ?? null : null,
      createdAt: row.created_at,
    }))

    ventas = ((salesResult.data ?? []) as unknown as Array<{
      id: string; code: string | null; total_cents: number; payment_method: string
      status: string; sold_at: string; customer_name: string
    }>).map((row) => ({
      id: row.id,
      code: row.code,
      totalCents: row.total_cents,
      paymentMethod: row.payment_method,
      status: row.status,
      soldAt: row.sold_at,
      customerName: row.customer_name,
    }))

    sales = allSales
  }

  const liveExpected = open
    ? expectedFor(open.opening_float_cents, sales, movimientos)
    : null

  // Sobre `sales`, no sobre `ventas`: el desglose tiene que contar también las
  // comandas del restaurante, o un local que vende por mesa ve «$0 en ventas»
  // sobre un esperado que sí las incluye — dos números en la misma tarjeta que
  // se contradicen.
  const vivas = sales.filter((v) => v.status !== 'Anulada')

  return {
    abierta: open ? toSession(open, names, siteNames, liveExpected) : null,
    movimientos,
    ventas,
    historial: historyRows.map((row) => toSession(row, names, siteNames, null)),
    resumen: {
      baseCents: open?.opening_float_cents ?? 0,
      ventasEfectivoCents: vivas.filter((v) => isCash(v.paymentMethod))
        .reduce((sum, v) => sum + v.totalCents, 0),
      ventasOtrosCents: vivas.filter((v) => !isCash(v.paymentMethod))
        .reduce((sum, v) => sum + v.totalCents, 0),
      ingresosCents: movimientos.filter((m) => m.kind === 'Ingreso' && isCash(m.method))
        .reduce((sum, m) => sum + m.amountCents, 0),
      egresosCents: movimientos.filter((m) => m.kind !== 'Ingreso' && isCash(m.method))
        .reduce((sum, m) => sum + m.amountCents, 0),
      esperadoCents: liveExpected ?? 0,
    },
    roster,
    canWrite: can(member.permissions, 'caja:write'),
    hasPos: member.modules.has('pos') && can(member.permissions, 'pos:read'),
    sites,
  }
}
