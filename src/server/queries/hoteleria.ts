import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { pageRange, totalOf, type Page } from './shared'

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
  /** Reservations on this room that have not been cancelled or checked out. */
  upcoming: number
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

export interface HoteleriaData {
  habitaciones: RoomRow[]
  habitacionesTotal: number
  reservas: ReservationRow[]
  /** Rooms occupied tonight over rooms that can be sold, as a percentage. */
  occupancyPct: number | null
  canWrite: boolean
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

const ROOM_COLUMNS = 'id, number, kind, status, floor, capacity, rate_cents, amenities, notes'
const RESERVATION_COLUMNS = `id, code, room_id, guest_name, guest_document, guest_email,
   guest_phone, status, guests, checkin_on, checkout_on, nightly_rate_cents, total_cents,
   paid_cents, channel, notes`

/** Whole nights between two ISO dates. */
export function nightsBetween(checkin: string, checkout: string): number {
  const from = new Date(`${checkin}T00:00:00`).getTime()
  const to = new Date(`${checkout}T00:00:00`).getTime()
  return Math.max(0, Math.round((to - from) / 86_400_000))
}

/** A reservation counts against a night when it spans it and is still live. */
function occupiesTonight(row: ReservationRecord, today: string): boolean {
  if (row.status === 'Cancelada' || row.status === 'No show' || row.status === 'Check-out') {
    return false
  }
  return row.checkin_on <= today && row.checkout_on > today
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
  const { data: reservationRows } = await supabase
    .from('reservations')
    .select('id, room_id, status')
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .in('room_id', rows.map((r) => r.id))

  const upcoming = new Map<string, number>()
  for (const row of reservationRows ?? []) {
    if (row.status === 'Cancelada' || row.status === 'Check-out' || row.status === 'No show') continue
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
    })),
    total: totalOf(count, rows.length, from),
  }
}

export async function getHoteleria(): Promise<HoteleriaData> {
  const member = await requirePermission('hoteleria:read')
  const supabase = await createClient()

  const [roomsResult, reservationsResult] = await Promise.all([
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
  ])

  if (roomsResult.error) {
    console.error('[hoteleria] getHoteleria', roomsResult.error)
    return { habitaciones: [], habitacionesTotal: 0, reservas: [], occupancyPct: null, canWrite: false }
  }
  if (reservationsResult.error) console.error('[hoteleria] reservations', reservationsResult.error)

  const roomRows = roomsResult.data as unknown as RoomRecord[]
  const reservationRows = (reservationsResult.data ?? []) as unknown as ReservationRecord[]
  const numbers = new Map(roomRows.map((r) => [r.id, r.number]))
  const today = new Date().toISOString().slice(0, 10)

  const upcoming = new Map<string, number>()
  const occupiedRooms = new Set<string>()
  for (const row of reservationRows) {
    if (occupiesTonight(row, today)) occupiedRooms.add(row.room_id)
    if (row.status === 'Cancelada' || row.status === 'Check-out' || row.status === 'No show') continue
    upcoming.set(row.room_id, (upcoming.get(row.room_id) ?? 0) + 1)
  }

  // Rooms out of service are excluded from the denominator: a hotel with two
  // rooms under repair is not running at lower occupancy, it has fewer rooms.
  const sellable = roomRows.filter((r) => r.status !== 'Mantenimiento' && r.status !== 'Bloqueada')

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
    occupancyPct: sellable.length > 0
      ? Math.round((occupiedRooms.size / sellable.length) * 100)
      : null,
    canWrite: can(member.permissions, 'hoteleria:write'),
  }
}
