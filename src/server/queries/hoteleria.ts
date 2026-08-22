import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { pageRange, totalOf, scoped, type Page } from './shared'
import { todayIn } from '@/lib/domain'

/**
 * Rooms and the reservations against them.
 *
 * Occupancy is computed for *today* rather than stored: it is a different
 * number every night, and a column holding it would be correct only on the day
 * something wrote it. The same reasoning as `contratos` deriving "Por vencer".
 */

export interface RoomRow {
  id: string
  number: string
  kind: string
  status: string
  floor: number | null
  capacity: number
  rateCents: number
  amenities: string
  notes: string
  /** Live reservations on this room whose checkout has not passed yet. */
  upcoming: number
  /** Sucursal where the room is, if one is assigned. */
  siteId: string | null
  siteName: string | null
}

export interface ReservationRow {
  id: string
  code: string | null
  roomId: string
  roomNumber: string
  guestName: string
  guestDocument: string
  guestEmail: string | null
  guestPhone: string
  status: string
  guests: number
  checkinOn: string
  checkoutOn: string
  nightlyRateCents: number
  totalCents: number
  paidCents: number
  channel: string
  notes: string
  /** Derived: `checkout_on - checkin_on`, which the check constraint keeps > 0. */
  nights: number
  balanceCents: number
}

export interface LimpiezaRow {
  id: string
  roomId: string
  roomNumber: string
  assignedId: string | null
  assignedName: string | null
  kind: string
  scheduledOn: string
  done: boolean
  doneOn: string | null
  notes: string
}

export interface SeasonRow {
  id: string
  name: string
  startsOn: string
  endsOn: string
  notes: string
  /** Tarifas por tipo de habitación. Las que faltan caen a la base. */
  rates: Array<{ kind: string; rateCents: number }>
  /** Temporada vigente hoy o por venir. */
  active: boolean
}

export interface HoteleriaData {
  habitaciones: RoomRow[]
  habitacionesTotal: number
  reservas: ReservationRow[]
  limpieza: LimpiezaRow[]
  seasons: SeasonRow[]
  /** Rooms occupied tonight over rooms that can be sold, as a percentage. */
  occupancyPct: number | null
  canWrite: boolean
  /** The company's sucursales, for the room form's site picker. */
  sites: Array<{ id: string; name: string }>
}

interface RoomRecord {
  id: string
  number: string
  kind: string
  status: string
  floor: number | null
  capacity: number
  rate_cents: number
  amenities: string
  notes: string
  site_id: string | null
  sites: { name: string } | null
}

interface ReservationRecord {
  id: string
  code: string | null
  room_id: string
  guest_name: string
  guest_document: string
  guest_email: string | null
  guest_phone: string
  status: string
  guests: number
  checkin_on: string
  checkout_on: string
  nightly_rate_cents: number
  total_cents: number
  paid_cents: number
  channel: string
  notes: string
}

interface CleaningTaskRecord {
  id: string
  room_id: string
  assigned_id: string | null
  kind: string
  scheduled_on: string
  done: boolean
  done_on: string | null
  notes: string
}

const ROOM_COLUMNS = 'id, number, kind, status, floor, capacity, rate_cents, amenities, notes, site_id, sites ( name )'
const RESERVATION_COLUMNS = `id, code, room_id, guest_name, guest_document, guest_email,
   guest_phone, status, guests, checkin_on, checkout_on, nightly_rate_cents, total_cents,
   paid_cents, channel, notes`

/** Whole nights between two ISO dates. */
export function nightsBetween(checkin: string, checkout: string): number {
  const from = new Date(`${checkin}T00:00:00`).getTime()
  const to = new Date(`${checkout}T00:00:00`).getTime()
  return Math.max(0, Math.round((to - from) / 86_400_000))
}

export async function getHabitacionesPage(offset = 0): Promise<Page<RoomRow>> {
  const member = await requirePermission('hoteleria:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('hotel_rooms')
    .select(ROOM_COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('number', { ascending: true })
    .range(from, to)

  if (error) {
    console.error('[hoteleria] getHabitacionesPage', error)
    return { rows: [], total: 0 }
  }

  const rows = data as unknown as RoomRecord[]
  // «Upcoming» means alive *and* not yet ended: without the date filter a
  // months-old Confirmada reservation counted toward the room forever.
  const { data: reservationRows } = await supabase
    .from('reservations')
    .select('room_id')
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .gt('checkout_on', todayIn(member.orgTimezone))
    .not('status', 'in', '(Cancelada,Check-out,No show)')

  const upcoming = new Map<string, number>()
  for (const row of reservationRows ?? []) {
    upcoming.set(row.room_id, (upcoming.get(row.room_id) ?? 0) + 1)
  }

  return {
    rows: rows.map((row) => ({
      id: row.id,
      number: row.number,
      kind: row.kind,
      status: row.status,
      floor: row.floor,
      capacity: row.capacity,
      rateCents: row.rate_cents,
      amenities: row.amenities,
      notes: row.notes,
      upcoming: upcoming.get(row.id) ?? 0,
      siteId: row.site_id,
      siteName: row.sites?.name ?? null,
    })),
    total: totalOf(count, rows.length, from),
  }
}

export async function getHoteleria(): Promise<HoteleriaData> {
  const member = await requirePermission('hoteleria:read')
  const supabase = await createClient()
  const today = todayIn(member.orgTimezone)

  const [roomsResult, reservationsResult, sitesResult, liveResult, sellableResult] = await Promise.all([
    supabase
      .from('hotel_rooms')
      .select(ROOM_COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('number', { ascending: true })
      .range(...pageRange(0)),
    supabase
      .from('reservations')
      .select(RESERVATION_COLUMNS)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('checkin_on', { ascending: false })
      .limit(500),
    scoped(supabase, member, 'sites')
      .select('id, name')
      .is('deleted_at', null)
      .order('name', { ascending: true }),
    // Reservations still live past today's checkout: the source for both the
    // per-room «upcoming» counts and tonight's occupancy, so neither depends
    // on the display list's 500-row cut.
    supabase
      .from('reservations')
      .select('room_id, checkin_on')
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .gt('checkout_on', today)
      .not('status', 'in', '(Cancelada,Check-out,No show)'),
    // The full occupancy denominator: counting only the first page broke the
    // percentage for any hotel with more rooms than PAGE_SIZE.
    supabase
      .from('hotel_rooms')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .not('status', 'in', '(Mantenimiento,Bloqueada)'),
  ])

  if (roomsResult.error) {
    console.error('[hoteleria] getHoteleria', roomsResult.error)
    return {
      habitaciones: [], habitacionesTotal: 0, reservas: [], limpieza: [],
      seasons: [], occupancyPct: null, canWrite: false, sites: [],
    }
  }
  if (reservationsResult.error) console.error('[hoteleria] reservations', reservationsResult.error)

  const roomRows = roomsResult.data as unknown as RoomRecord[]
  const reservationRows = (reservationsResult.data ?? []) as unknown as ReservationRecord[]
  const numbers = new Map(roomRows.map((r) => [r.id, r.number]))

  const { data: taskRows, error: tasksError } = await supabase
    .from('room_cleaning_tasks')
    .select('id, room_id, assigned_id, kind, scheduled_on, done, done_on, notes')
    .order('scheduled_on', { ascending: true })
    .order('done', { ascending: true })

  if (tasksError) console.error('[hoteleria] limpieza tasks', tasksError)

  // Temporadas con sus tarifas, en dos consultas.
  const [seasonsResult, ratesResult] = await Promise.all([
    supabase
      .from('hotel_seasons')
      .select('id, name, starts_on, ends_on, notes')
      .eq('org_id', member.orgId)
      .order('starts_on', { ascending: false })
      .limit(100),
    supabase
      .from('hotel_season_rates')
      .select('season_id, kind, rate_cents')
      .order('kind', { ascending: true })
      .limit(500),
  ])

  const ratesBySeason = new Map<string, Array<{ kind: string; rateCents: number }>>()
  for (const rate of (ratesResult.data ?? []) as unknown as Array<{
    season_id: string; kind: string; rate_cents: number
  }>) {
    const list = ratesBySeason.get(rate.season_id)
    if (list) list.push({ kind: rate.kind, rateCents: rate.rate_cents })
    else ratesBySeason.set(rate.season_id, [{ kind: rate.kind, rateCents: rate.rate_cents }])
  }

  const seasons: SeasonRow[] = ((seasonsResult.data ?? []) as unknown as Array<{
    id: string; name: string; starts_on: string; ends_on: string; notes: string
  }>).map((row) => ({
    id: row.id,
    name: row.name,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    notes: row.notes,
    rates: ratesBySeason.get(row.id) ?? [],
    active: row.starts_on <= today && row.ends_on >= today,
  }))

  const tasks = (taskRows ?? []) as unknown as CleaningTaskRecord[]
  const assignedIds = [...new Set(
    tasks.map((t) => t.assigned_id).filter((id): id is string => id !== null),
  )]
  const { data: employeeRows, error: employeesError } = await supabase
    .from('employees')
    .select('id, full_name')
    .in('id', assignedIds)
    .is('deleted_at', null)
  if (employeesError) console.error('[hoteleria] limpieza employees', employeesError)

  const assignedNames = new Map((employeeRows ?? []).map((r) => [r.id, r.full_name]))

  const liveRows = (liveResult.data ?? []) as Array<{ room_id: string; checkin_on: string }>
  const upcoming = new Map<string, number>()
  const occupiedRooms = new Set<string>()
  for (const row of liveRows) {
    upcoming.set(row.room_id, (upcoming.get(row.room_id) ?? 0) + 1)
    if (row.checkin_on <= today) occupiedRooms.add(row.room_id)
  }
  const sellableCount = (sellableResult as { count: number | null }).count

  return {
    habitaciones: roomRows.map((row) => ({
      id: row.id,
      number: row.number,
      kind: row.kind,
      status: row.status,
      floor: row.floor,
      capacity: row.capacity,
      rateCents: row.rate_cents,
      amenities: row.amenities,
      notes: row.notes,
      upcoming: upcoming.get(row.id) ?? 0,
      siteId: row.site_id,
      siteName: row.sites?.name ?? null,
    })),
    habitacionesTotal: totalOf(roomsResult.count, roomRows.length),
    reservas: reservationRows.map((row) => ({
      id: row.id,
      code: row.code,
      roomId: row.room_id,
      roomNumber: numbers.get(row.room_id) ?? '',
      guestName: row.guest_name,
      guestDocument: row.guest_document,
      guestEmail: row.guest_email,
      guestPhone: row.guest_phone,
      status: row.status,
      guests: row.guests,
      checkinOn: row.checkin_on,
      checkoutOn: row.checkout_on,
      nightlyRateCents: row.nightly_rate_cents,
      totalCents: row.total_cents,
      paidCents: row.paid_cents,
      channel: row.channel,
      notes: row.notes,
      nights: nightsBetween(row.checkin_on, row.checkout_on),
      balanceCents: row.total_cents - row.paid_cents,
    })),
    limpieza: tasks.map((row) => ({
      id: row.id,
      roomId: row.room_id,
      roomNumber: numbers.get(row.room_id) ?? '',
      assignedId: row.assigned_id,
      assignedName: row.assigned_id ? assignedNames.get(row.assigned_id) ?? null : null,
      kind: row.kind,
      scheduledOn: row.scheduled_on,
      done: row.done,
      doneOn: row.done_on,
      notes: row.notes,
    })),
    occupancyPct: sellableCount !== null && sellableCount > 0
      ? Math.round((occupiedRooms.size / sellableCount) * 100)
      : null,
    seasons,
    canWrite: can(member.permissions, 'hoteleria:write'),
    sites: ((sitesResult.data ?? []) as Array<{ id: string; name: string }>),
  }
}
