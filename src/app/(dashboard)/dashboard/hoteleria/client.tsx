'use client'

import { useMemo, useState, useTransition } from 'react'
import { Bed, Check, Plus, Trash2, DollarSign, Calendar, Users } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import TabBar from '@/components/ui/TabBar'
import FormDrawer from '@/components/ui/FormDrawer'
import LoadMore from '@/components/ui/LoadMore'
import { useApp } from '@/lib/context/AppContext'
import { RESERVATION_STATUSES, ROOM_KINDS, ROOM_STATUSES } from '@/lib/domain'
import { cop } from '@/lib/utils'
import type { HoteleriaData, RoomRow } from '@/server/queries/hoteleria'
import {
  createHabitacion, createReserva, deleteHabitacion,
  setHabitacionStatus, setReservaStatus,
} from '@/server/mutations/hoteleria'
import { fetchMoreHabitaciones } from '@/server/actions/hoteleria'

const DATE = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

function formatDate(iso: string | null): string {
  return iso ? DATE.format(new Date(`${iso}T00:00:00`)) : '—'
}

function toCents(value: string): number {
  const n = Number(value.replace(/[^\d]/g, ''))
  return Number.isFinite(n) ? Math.round(n) * 100 : 0
}

function pesos(cents: number): string {
  return cop(Math.round(cents / 100))
}

function orNull(value: string): string | null {
  return value.trim() === '' ? null : value
}

const TODAY = () => new Date().toISOString().slice(0, 10)
const TOMORROW = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)

const EMPTY_ROOM = {
  number: '', kind: 'Sencilla', floor: '', capacity: '2', rate: '', amenities: '', notes: '',
}
const EMPTY_RESERVATION = {
  roomId: '', guestName: '', guestDocument: '', guestEmail: '', guestPhone: '',
  guests: '1', checkinOn: '', checkoutOn: '', nightlyRate: '', paid: '', channel: '', notes: '',
}

export default function HoteleriaPage({ data }: { data: HoteleriaData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [habitaciones, setHabitaciones] = useState<RoomRow[]>(data.habitaciones)
  const [total, setTotal] = useState(data.habitacionesTotal)
  const [reservas, setReservas] = useState(data.reservas)
  const [occupancy, setOccupancy] = useState(data.occupancyPct)
  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const [tab, setTab] = useState('reservas')
  const [statusFilter, setStatusFilter] = useState('Todas')
  const [roomOpen, setRoomOpen] = useState(false)
  const [reservationOpen, setReservationOpen] = useState(false)
  const [roomForm, setRoomForm] = useState(EMPTY_ROOM)
  const [reservationForm, setReservationForm] = useState(EMPTY_RESERVATION)

  function apply(next: HoteleriaData) {
    setHabitaciones(next.habitaciones)
    setTotal(next.habitacionesTotal)
    setReservas(next.reservas)
    setOccupancy(next.occupancyPct)
  }

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreHabitaciones(habitaciones.length)
      if (!result.ok) { setLoadMoreError(result.error); return }
      setHabitaciones((prev) => {
        const seen = new Set(prev.map((r) => r.id))
        return [...prev, ...result.data.rows.filter((r) => !seen.has(r.id))]
      })
      setTotal(result.data.total)
    })
  }

  const stats = useMemo(() => {
    const today = TODAY()
    const live = reservas.filter((r) => r.status !== 'Cancelada' && r.status !== 'No show')
    return {
      arrivals: live.filter((r) => r.checkinOn === today && r.status === 'Confirmada').length,
      inHouse: reservas.filter((r) => r.status === 'Check-in').length,
      revenue: live.reduce((s, r) => s + r.totalCents, 0),
      pending: live.reduce((s, r) => s + r.balanceCents, 0),
    }
  }, [reservas])

  const visible = reservas.filter((r) => statusFilter === 'Todas' || r.status === statusFilter)

  function changeRoom(r: RoomRow, status: string) {
    startTransition(async () => {
      const result = await setHabitacionStatus({ id: r.id, status: status as never })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
    })
  }

  function changeReservation(id: string, status: string) {
    startTransition(async () => {
      const result = await setReservaStatus({ id, status: status as never, paidCents: null })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast(`Reserva: ${status.toLowerCase()}`, 'ok')
    })
  }

  function remove(r: RoomRow) {
    if (!window.confirm(`¿Eliminar la habitación ${r.number}? Se eliminan también sus reservas.`)) return
    startTransition(async () => {
      const result = await deleteHabitacion(r.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Habitación eliminada', 'ok')
    })
  }

  function submitRoom() {
    startTransition(async () => {
      const result = await createHabitacion({
        number: roomForm.number,
        kind: roomForm.kind as never,
        floor: orNull(roomForm.floor),
        capacity: roomForm.capacity || 2,
        rateCents: toCents(roomForm.rate),
        amenities: roomForm.amenities,
        notes: roomForm.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setRoomForm(EMPTY_ROOM)
      setRoomOpen(false)
      addToast('Habitación creada', 'ok')
    })
  }

  function submitReservation() {
    startTransition(async () => {
      const result = await createReserva({
        roomId: reservationForm.roomId,
        guestName: reservationForm.guestName,
        guestDocument: reservationForm.guestDocument,
        guestEmail: reservationForm.guestEmail || null,
        guestPhone: reservationForm.guestPhone,
        guests: reservationForm.guests || 1,
        checkinOn: reservationForm.checkinOn || TODAY(),
        checkoutOn: reservationForm.checkoutOn || TOMORROW(),
        nightlyRateCents: toCents(reservationForm.nightlyRate),
        paidCents: toCents(reservationForm.paid),
        channel: reservationForm.channel,
        notes: reservationForm.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setReservationForm(EMPTY_RESERVATION)
      setReservationOpen(false)
      addToast('Reserva creada', 'ok')
    })
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat icon={<Bed size={16} />} tone="blu" label="Ocupación"
            value={occupancy === null ? '—' : `${occupancy}%`}
            sub={`${habitaciones.length} habitaciones`} />
        </div>
        <div className="rise d2">
          <Stat icon={<Calendar size={16} />} tone="amb" label="Llegadas de hoy"
            value={stats.arrivals} />
        </div>
        <div className="rise d3">
          <Stat icon={<Users size={16} />} tone="grn" label="En casa" value={stats.inHouse} />
        </div>
        <div className="rise d4">
          <Stat icon={<DollarSign size={16} />} tone="vio" label="Por cobrar"
            value={pesos(stats.pending)} sub={`de ${pesos(stats.revenue)} reservados`} />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <TabBar
            items={[
              { key: 'reservas', label: 'Reservas' },
              { key: 'habitaciones', label: 'Habitaciones' },
            ]}
            value={tab}
            onChange={setTab}
          />
          {data.canWrite && (
            <div style={{ display: 'flex', gap: 8 }}>
              {tab === 'habitaciones' ? (
                <button className="btn dark" disabled={pending} onClick={() => setRoomOpen(true)}>
                  <Plus size={15} />Habitación
                </button>
              ) : (
                <button className="btn dark" disabled={pending || habitaciones.length === 0}
                  onClick={() => {
                    setReservationForm({
                      ...EMPTY_RESERVATION,
                      roomId: habitaciones[0]?.id ?? '',
                      checkinOn: TODAY(),
                      checkoutOn: TOMORROW(),
                    })
                    setReservationOpen(true)
                  }}>
                  <Plus size={15} />Reserva
                </button>
              )}
            </div>
          )}
        </div>

        {tab === 'reservas' && (
          <>
            <div className="cpad" style={{ paddingBottom: 0 }}>
              <div style={{ maxWidth: 220 }}>
                <Select value={statusFilter} onChange={setStatusFilter}
                  options={['Todas', ...RESERVATION_STATUSES]} />
              </div>
            </div>

            <div className="tblwrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Reserva</th>
                    <th scope="col">Huésped</th>
                    <th scope="col">Habitación</th>
                    <th scope="col">Estadía</th>
                    <th scope="col">Total</th>
                    <th scope="col">Saldo</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                          {reservas.length === 0
                            ? 'Todavía no hay reservas.'
                            : 'No hay reservas con ese estado.'}
                        </div>
                      </td>
                    </tr>
                  ) : visible.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div className="cename mono">{r.code}</div>
                        <div className="elsub">{r.channel || 'Directo'}</div>
                      </td>
                      <td>
                        <div className="cename">{r.guestName}</div>
                        <div className="elsub">
                          {[r.guestDocument, r.guestPhone].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </td>
                      <td>
                        {r.roomNumber}
                        <div className="elsub">
                          {r.guests} {r.guests === 1 ? 'persona' : 'personas'}
                        </div>
                      </td>
                      <td>
                        {formatDate(r.checkinOn)} → {formatDate(r.checkoutOn)}
                        <div className="elsub">
                          {r.nights} {r.nights === 1 ? 'noche' : 'noches'} · {pesos(r.nightlyRateCents)}/noche
                        </div>
                      </td>
                      <td>{pesos(r.totalCents)}</td>
                      <td>
                        {r.balanceCents > 0
                          ? <span style={{ color: 'var(--amb)' }}>{pesos(r.balanceCents)}</span>
                          : 'Pagada'}
                      </td>
                      <td>
                        {data.canWrite ? (
                          <Select
                            value={r.status}
                            onChange={(next) => { if (next !== r.status) changeReservation(r.id, next) }}
                            options={[...RESERVATION_STATUSES]}
                          />
                        ) : (
                          <Badge st={r.status}
                            tone={r.status === 'Check-in' ? 'grn'
                              : r.status === 'Confirmada' ? 'blu'
                              : r.status === 'Cancelada' || r.status === 'No show' ? 'red' : 'neu'} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'habitaciones' && (
          <>
            <div className="tblwrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Habitación</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Capacidad</th>
                    <th scope="col">Tarifa</th>
                    <th scope="col">Reservas</th>
                    <th scope="col">Estado</th>
                    {data.canWrite && <th scope="col" aria-label="Acciones" />}
                  </tr>
                </thead>
                <tbody>
                  {habitaciones.length === 0 ? (
                    <tr>
                      <td colSpan={data.canWrite ? 7 : 6}>
                        <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                          Todavía no hay habitaciones registradas.
                        </div>
                      </td>
                    </tr>
                  ) : habitaciones.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <div className="cename mono">{r.number}</div>
                        {r.floor !== null && <div className="elsub">Piso {r.floor}</div>}
                      </td>
                      <td>
                        {r.kind}
                        {r.amenities && <div className="elsub">{r.amenities}</div>}
                      </td>
                      <td>{r.capacity}</td>
                      <td>{r.rateCents > 0 ? pesos(r.rateCents) : '—'}</td>
                      <td>{r.upcoming}</td>
                      <td>
                        <Badge st={r.status}
                          tone={r.status === 'Disponible' ? 'grn'
                            : r.status === 'Ocupada' ? 'blu'
                            : r.status === 'Limpieza' ? 'amb' : 'neu'} />
                      </td>
                      {data.canWrite && (
                        <td>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <Select
                              value={r.status}
                              onChange={(next) => { if (next !== r.status) changeRoom(r, next) }}
                              options={[...ROOM_STATUSES]}
                            />
                            <button className="ibtn" aria-label={`Eliminar habitación ${r.number}`}
                              disabled={pending} onClick={() => remove(r)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <LoadMore
              loaded={habitaciones.length}
              total={total}
              loading={loadingMore}
              error={loadMoreError}
              onLoadMore={loadMore}
              noun="habitaciones"
            />
          </>
        )}
      </div>

      <FormDrawer
        open={roomOpen}
        onClose={() => setRoomOpen(false)}
        title="Nueva habitación"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitRoom}>
            <Check size={15} />Crear habitación
          </button>
        }
      >
        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="hab-num">Número</label>
            <input id="hab-num" className="field" value={roomForm.number}
              onChange={(e) => setRoomForm({ ...roomForm, number: e.target.value })}
              placeholder="301" />
          </div>
          <div>
            <label className="flabel" htmlFor="hab-floor">Piso</label>
            <input id="hab-floor" className="field" type="number" value={roomForm.floor}
              onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <div className="flabel">Tipo</div>
            <Select value={roomForm.kind}
              onChange={(v) => setRoomForm({ ...roomForm, kind: v })}
              options={[...ROOM_KINDS]} />
          </div>
          <div>
            <label className="flabel" htmlFor="hab-cap">Capacidad</label>
            <input id="hab-cap" className="field" type="number" min={1} max={20}
              value={roomForm.capacity}
              onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })} />
          </div>
        </div>

        <label className="flabel" htmlFor="hab-rate">Tarifa por noche (COP)</label>
        <input id="hab-rate" className="field" inputMode="numeric" value={roomForm.rate}
          onChange={(e) => setRoomForm({ ...roomForm, rate: e.target.value })} />

        <label className="flabel" htmlFor="hab-am">Amenidades</label>
        <input id="hab-am" className="field" value={roomForm.amenities}
          onChange={(e) => setRoomForm({ ...roomForm, amenities: e.target.value })}
          placeholder="Aire acondicionado, wifi, balcón…" />

        <label className="flabel" htmlFor="hab-notes">Notas</label>
        <textarea id="hab-notes" className="field" rows={3} value={roomForm.notes}
          onChange={(e) => setRoomForm({ ...roomForm, notes: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={reservationOpen}
        onClose={() => setReservationOpen(false)}
        title="Nueva reserva"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitReservation}>
            <Check size={15} />Crear reserva
          </button>
        }
      >
        <div className="flabel">Habitación</div>
        <Select value={reservationForm.roomId}
          onChange={(v) => {
            const room = habitaciones.find((r) => r.id === v)
            setReservationForm({
              ...reservationForm,
              roomId: v,
              nightlyRate: room && room.rateCents > 0
                ? String(Math.round(room.rateCents / 100))
                : reservationForm.nightlyRate,
            })
          }}
          placeholder="Elige la habitación"
          options={habitaciones.map((r) => ({
            value: r.id,
            label: `${r.number} · ${r.kind} · ${r.capacity} pers.`,
          }))} />

        <label className="flabel" htmlFor="res-guest">Huésped</label>
        <input id="res-guest" className="field" value={reservationForm.guestName}
          onChange={(e) => setReservationForm({ ...reservationForm, guestName: e.target.value })} />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="res-doc">Documento</label>
            <input id="res-doc" className="field" value={reservationForm.guestDocument}
              onChange={(e) => setReservationForm({ ...reservationForm, guestDocument: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="res-phone">Teléfono</label>
            <input id="res-phone" className="field" value={reservationForm.guestPhone}
              onChange={(e) => setReservationForm({ ...reservationForm, guestPhone: e.target.value })} />
          </div>
        </div>

        <label className="flabel" htmlFor="res-mail">Correo</label>
        <input id="res-mail" className="field" type="email" value={reservationForm.guestEmail}
          onChange={(e) => setReservationForm({ ...reservationForm, guestEmail: e.target.value })} />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="res-in">Entrada</label>
            <input id="res-in" className="field" type="date" value={reservationForm.checkinOn}
              onChange={(e) => setReservationForm({ ...reservationForm, checkinOn: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="res-out">Salida</label>
            <input id="res-out" className="field" type="date" value={reservationForm.checkoutOn}
              onChange={(e) => setReservationForm({ ...reservationForm, checkoutOn: e.target.value })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="res-guests">Personas</label>
            <input id="res-guests" className="field" type="number" min={1} max={20}
              value={reservationForm.guests}
              onChange={(e) => setReservationForm({ ...reservationForm, guests: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="res-rate">Tarifa por noche (COP)</label>
            <input id="res-rate" className="field" inputMode="numeric"
              value={reservationForm.nightlyRate}
              onChange={(e) => setReservationForm({ ...reservationForm, nightlyRate: e.target.value })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="res-paid">Anticipo (COP)</label>
            <input id="res-paid" className="field" inputMode="numeric" value={reservationForm.paid}
              onChange={(e) => setReservationForm({ ...reservationForm, paid: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="res-channel">Canal</label>
            <input id="res-channel" className="field" value={reservationForm.channel}
              onChange={(e) => setReservationForm({ ...reservationForm, channel: e.target.value })}
              placeholder="Directo, Booking, agencia…" />
          </div>
        </div>

        <label className="flabel" htmlFor="res-notes">Notas</label>
        <textarea id="res-notes" className="field" rows={3} value={reservationForm.notes}
          onChange={(e) => setReservationForm({ ...reservationForm, notes: e.target.value })} />
      </FormDrawer>
    </>
  )
}
