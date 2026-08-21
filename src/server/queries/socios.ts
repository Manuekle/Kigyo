import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { pageRange, rosterFor, scoped, totalOf, type Page, type RosterEntry } from './shared'
import { todayIn } from '@/lib/domain'

/**
 * Socios, membresías, clases y entradas.
 *
 * El vertical de Fitness y bienestar, que cubre cuatro subsectores con formas
 * de cobrar distintas: el gimnasio vende una mensualidad, el estudio un bono de
 * diez clases, el spa una sesión suelta y el centro terapéutico una membresía
 * junto a una historia clínica. Las cuatro caben en la misma tabla porque lo
 * que cambia es el `billing` del plan, no la estructura de lo vendido.
 *
 * Tres cosas se derivan aquí en vez de guardarse, por la misma razón que
 * `hoteleria` calcula la ocupación de esta noche: son distintas cada día y una
 * columna que las guarde solo es cierta el día que alguien la escribió.
 *
 *   · si una membresía está vencida  — `ends_on` contra hoy
 *   · cuántos socios están al día    — el conteo de lo anterior
 *   · cuánto cupo queda en una clase — `capacity` menos las reservas vivas
 */

export interface SocioRow {
  id: string
  code: string | null
  fullName: string
  documentId: string
  email: string | null
  phone: string
  status: string
  joinedOn: string
  notes: string
  /** La membresía vigente más reciente, o null si no tiene ninguna. */
  subscriptionId: string | null
  planName: string | null
  endsOn: string | null
  creditsLeft: number | null
  paid: boolean
  /**
   * Días que le quedan de membresía. Negativo si ya venció, null si no tiene.
   * Derivado: la fecha es el dato, esto es la lectura que hace la pantalla.
   */
  daysLeft: number | null
}

export interface PlanRow {
  id: string
  name: string
  description: string
  priceCents: number
  billing: string
  credits: number | null
  durationDays: number
  active: boolean
  /** Membresías vivas vendidas con este plan. */
  activeCount: number
}

export interface ClaseRow {
  id: string
  name: string
  instructorId: string | null
  instructorName: string | null
  startsAt: string
  durationMin: number
  capacity: number
  room: string
  status: string
  notes: string
  /** Reservas que ocupan cupo: «Cancelada» y «En espera» no cuentan. */
  booked: number
  waiting: number
  attended: number
}

export interface CheckinRow {
  id: string
  memberId: string
  memberName: string
  className: string | null
  enteredAt: string
  method: string
}

export interface SociosData {
  socios: SocioRow[]
  sociosTotal: number
  planes: PlanRow[]
  clases: ClaseRow[]
  checkins: CheckinRow[]
  /** Socios con membresía vigente hoy, sobre socios activos. */
  alDia: number
  activos: number
  /** Membresías que vencen dentro de los próximos siete días. */
  porVencer: number
  /** Entradas registradas hoy. */
  entradasHoy: number
  roster: RosterEntry[]
  canWrite: boolean
}

interface MemberRecord {
  id: string
  code: string | null
  full_name: string
  document_id: string
  email: string | null
  phone: string
  status: string
  joined_on: string
  notes: string
}

interface SubscriptionRecord {
  id: string
  member_id: string
  plan_name: string
  ends_on: string
  credits_left: number | null
  status: string
  paid: boolean
}

const MEMBER_COLUMNS =
  'id, code, full_name, document_id, email, phone, status, joined_on, notes'

/**
 * Días entre hoy y una fecha, negativo si ya pasó.
 *
 * Exportada porque la pantalla y las pruebas leen el mismo número: «vence en 3»
 * y «venció hace 3» son el mismo cálculo con el signo distinto, y escribirlo
 * dos veces es como se llega a que la lista diga una cosa y el detalle otra.
 */
export function daysUntil(date: string, from: string): number {
  const a = new Date(`${from}T00:00:00`).getTime()
  const b = new Date(`${date}T00:00:00`).getTime()
  return Math.round((b - a) / 86_400_000)
}

/**
 * La membresía que manda, cuando hay varias.
 *
 * Un socio renueva antes de vencer, así que puede tener dos filas vivas a la
 * vez. La que la pantalla debe mostrar es la que termina más tarde: es la que
 * le da acceso hoy, y decir que vence el día de la vieja sería negarle la
 * entrada a alguien que ya pagó.
 */
function latestOf(rows: SubscriptionRecord[]): SubscriptionRecord | null {
  let best: SubscriptionRecord | null = null
  for (const row of rows) {
    if (row.status === 'Cancelada') continue
    if (!best || row.ends_on > best.ends_on) best = row
  }
  return best
}

function toSocio(row: MemberRecord, subscription: SubscriptionRecord | null, today: string): SocioRow {
  return {
    id: row.id,
    code: row.code,
    fullName: row.full_name,
    documentId: row.document_id,
    email: row.email,
    phone: row.phone,
    status: row.status,
    joinedOn: row.joined_on,
    notes: row.notes,
    subscriptionId: subscription?.id ?? null,
    planName: subscription?.plan_name ?? null,
    endsOn: subscription?.ends_on ?? null,
    creditsLeft: subscription?.credits_left ?? null,
    paid: subscription?.paid ?? false,
    daysLeft: subscription ? daysUntil(subscription.ends_on, today) : null,
  }
}

/** Las membresías vivas de un conjunto de socios, ya reducidas a una por socio. */
async function latestSubscriptions(
  supabase: Awaited<ReturnType<typeof createClient>>,
  memberIds: string[],
): Promise<Map<string, SubscriptionRecord>> {
  if (memberIds.length === 0) return new Map()

  const { data, error } = await supabase
    .from('fitness_subscriptions')
    .select('id, member_id, plan_name, ends_on, credits_left, status, paid')
    .in('member_id', memberIds)
    .order('ends_on', { ascending: false })

  if (error) {
    console.error('[socios] latestSubscriptions', error)
    return new Map()
  }

  const byMember = new Map<string, SubscriptionRecord[]>()
  for (const row of (data ?? []) as SubscriptionRecord[]) {
    const list = byMember.get(row.member_id)
    if (list) list.push(row)
    else byMember.set(row.member_id, [row])
  }

  const out = new Map<string, SubscriptionRecord>()
  for (const [memberId, rows] of byMember) {
    const latest = latestOf(rows)
    if (latest) out.set(memberId, latest)
  }
  return out
}

export async function getSociosPage(offset = 0): Promise<Page<SocioRow>> {
  const member = await requirePermission('socios:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await scoped(supabase, member, 'fitness_members')
    .select(MEMBER_COLUMNS, { count: 'exact' })
    .is('deleted_at', null)
    .order('full_name', { ascending: true })
    .range(from, to)

  if (error) {
    console.error('[socios] getSociosPage', error)
    return { rows: [], total: 0 }
  }

  const rows = (data ?? []) as MemberRecord[]
  const subscriptions = await latestSubscriptions(supabase, rows.map((r) => r.id))

  return {
    rows: rows.map((row) => toSocio(row, subscriptions.get(row.id) ?? null, todayIn(member.orgTimezone))),
    total: totalOf(count, rows.length, from),
  }
}

export async function getSocios(): Promise<SociosData> {
  const member = await requirePermission('socios:read')
  const supabase = await createClient()
  const now = todayIn(member.orgTimezone)

  const [membersResult, plansResult, classesResult] = await Promise.all([
    scoped(supabase, member, 'fitness_members')
      .select(MEMBER_COLUMNS, { count: 'exact' })
      .is('deleted_at', null)
      .order('full_name', { ascending: true })
      .range(...pageRange(0)),
    scoped(supabase, member, 'fitness_plans')
      .select('id, name, description, price_cents, billing, credits, duration_days, active')
      .is('deleted_at', null)
      .order('name', { ascending: true }),
    scoped(supabase, member, 'fitness_classes')
      .select('id, name, instructor_id, starts_at, duration_min, capacity, room, status, notes')
      .is('deleted_at', null)
      .order('starts_at', { ascending: false })
      .limit(100),
  ])

  const memberRows = (membersResult.data ?? []) as MemberRecord[]
  const subscriptions = await latestSubscriptions(supabase, memberRows.map((r) => r.id))
  const socios = memberRows.map((row) => toSocio(row, subscriptions.get(row.id) ?? null, now))

  const planRows = (plansResult.data ?? []) as Array<{
    id: string; name: string; description: string; price_cents: number
    billing: string; credits: number | null; duration_days: number; active: boolean
  }>
  const classRows = (classesResult.data ?? []) as Array<{
    id: string; name: string; instructor_id: string | null; starts_at: string
    duration_min: number; capacity: number; room: string; status: string; notes: string
  }>

  // Reservas y entradas se leen contra las clases y socios ya cargados, no
  // contra la empresa: las dos tablas son hijas y no tienen `org_id` propio,
  // así que su aislamiento viene del padre — y filtrar por padres que ya
  // pasaron por `scoped` es lo que mantiene esa promesa en esta consulta.
  const classIds = classRows.map((c) => c.id)
  const memberIds = memberRows.map((m) => m.id)

  const [bookingsResult, checkinsResult, roster] = await Promise.all([
    classIds.length > 0
      ? supabase.from('fitness_bookings').select('class_id, status').in('class_id', classIds)
      : Promise.resolve({ data: [] as Array<{ class_id: string; status: string }> }),
    memberIds.length > 0
      ? supabase
          .from('fitness_checkins')
          .select('id, member_id, class_id, entered_at, method')
          .in('member_id', memberIds)
          .order('entered_at', { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] as Array<{
          id: string; member_id: string; class_id: string | null
          entered_at: string; method: string
        }> }),
    rosterFor(supabase, member),
  ])

  const booked = new Map<string, { booked: number; waiting: number; attended: number }>()
  for (const row of bookingsResult.data ?? []) {
    const entry = booked.get(row.class_id) ?? { booked: 0, waiting: 0, attended: 0 }
    if (row.status === 'En espera') entry.waiting += 1
    else if (row.status !== 'Cancelada') entry.booked += 1
    if (row.status === 'Asistió') entry.attended += 1
    booked.set(row.class_id, entry)
  }

  const instructorName = new Map(roster.map((r) => [r.employeeId, r.fullName]))
  const memberName = new Map(memberRows.map((m) => [m.id, m.full_name]))
  const className = new Map(classRows.map((c) => [c.id, c.name]))

  const clases: ClaseRow[] = classRows.map((row) => {
    const counts = booked.get(row.id) ?? { booked: 0, waiting: 0, attended: 0 }
    return {
      id: row.id,
      name: row.name,
      instructorId: row.instructor_id,
      instructorName: row.instructor_id ? instructorName.get(row.instructor_id) ?? null : null,
      startsAt: row.starts_at,
      durationMin: row.duration_min,
      capacity: row.capacity,
      room: row.room,
      status: row.status,
      notes: row.notes,
      ...counts,
    }
  })

  const checkins: CheckinRow[] = (checkinsResult.data ?? []).map((row) => ({
    id: row.id,
    memberId: row.member_id,
    memberName: memberName.get(row.member_id) ?? '—',
    className: row.class_id ? className.get(row.class_id) ?? null : null,
    enteredAt: row.entered_at,
    method: row.method,
  }))

  // Los planes reportan cuántas membresías vivas vendieron, que es la única
  // cifra que dice si un plan sirve. Contado sobre las membresías ya cargadas.
  const perPlan = new Map<string, number>()
  for (const socio of socios) {
    if (!socio.planName || socio.daysLeft === null || socio.daysLeft < 0) continue
    perPlan.set(socio.planName, (perPlan.get(socio.planName) ?? 0) + 1)
  }

  const planes: PlanRow[] = planRows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    billing: row.billing,
    credits: row.credits,
    durationDays: row.duration_days,
    active: row.active,
    activeCount: perPlan.get(row.name) ?? 0,
  }))

  const activos = socios.filter((s) => s.status === 'Activo').length
  const alDia = socios.filter((s) => s.daysLeft !== null && s.daysLeft >= 0).length
  const porVencer = socios.filter(
    (s) => s.daysLeft !== null && s.daysLeft >= 0 && s.daysLeft <= 7,
  ).length
  const entradasHoy = checkins.filter((c) => c.enteredAt.slice(0, 10) === now).length

  return {
    socios,
    sociosTotal: totalOf(membersResult.count, memberRows.length, 0),
    planes,
    clases,
    checkins,
    alDia,
    activos,
    porVencer,
    entradasHoy,
    roster,
    canWrite: can(member.permissions, 'socios:write'),
  }
}
