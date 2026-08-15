'use client'

import { useMemo, useState, useTransition } from 'react'
import { Bed, Check, Plus, Trash2, DollarSign, Calendar, Users, PenLine, FileSpreadsheet } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import TabBar from '@/components/ui/TabBar'
import FormDrawer from '@/components/ui/FormDrawer'
import LoadMore from '@/components/ui/LoadMore'
import { useApp } from '@/lib/context/AppContext'
import { useExport } from '@/lib/hooks/use-export'
import { RESERVATION_STATUSES, ROOM_KINDS, ROOM_STATUSES } from '@/lib/domain'
import { cop } from '@/lib/utils'
import type { HoteleriaData, LimpiezaRow, RoomRow, SeasonRow } from '@/server/queries/hoteleria'
import {
  createHabitacion, createReserva, createSeason, createTareaLimpieza, deleteHabitacion,
  deleteSeason, deleteTarea, getRateFor, saveSeasonRate,
  setHabitacionStatus, setReservaStatus, setTareaDone, setTareaFecha, updateHabitacion,
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
const TASK_KINDS = ['Limpieza', 'Cambio de ropa', 'Revisión', 'Aseo profundo'] as const
const EMPTY_TAREA = {
  roomId: '', assignedId: '', kind: 'Limpieza', scheduledOn: '', notes: '',
}
const EMPTY_SEASON = { name: '', startsOn: '', endsOn: '', notes: '' }

export default function HoteleriaPage({ data }: { data: HoteleriaData }) {
  const { runExport, exporting } = useExport()
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [habitaciones, setHabitaciones] = useState<RoomRow[]>(data.habitaciones)
  const [total, setTotal] = useState(data.habitacionesTotal)
  const [reservas, setReservas] = useState(data.reservas)
  const [limpieza, setLimpieza] = useState(data.limpieza ?? [])
  const [seasons, setSeasons] = useState(data.seasons ?? [])
  const [occupancy, setOccupancy] = useState(data.occupancyPct)
  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const [tab, setTab] = useState('reservas')
  const [statusFilter, setStatusFilter] = useState('Todas')
  const [roomOpen, setRoomOpen] = useState(false)
  const [reservationOpen, setReservationOpen] = useState(false)
  const [roomForm, setRoomForm] = useState(EMPTY_ROOM)
  const [reservationForm, setReservationForm] = useState(EMPTY_RESERVATION)
  const [editingRoom, setEditingRoom] = useState<RoomRow | null>(null)
  const [tareaOpen, setTareaOpen] = useState(false)
  const [tareaForm, setTareaForm] = useState(EMPTY_TAREA)
  const [seasonOpen, setSeasonOpen] = useState(false)
  const [seasonForm, setSeasonForm] = useState(EMPTY_SEASON)
  const [ratesFor, setRatesFor] = useState<SeasonRow | null>(null)
  const [ratesForm, setRatesForm] = useState<Record<string, string>>({})

  function apply(next: HoteleriaData) {
    setHabitaciones(next.habitaciones)
    setTotal(next.habitacionesTotal)
    setReservas(next.reservas)
    setLimpieza(next.limpieza)
    setSeasons(next.seasons)
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

  const exportRows = () => {
    void runExport(
      habitaciones.map((r) => ({
        Número: r.number,
        Tipo: r.kind,
        Tarifa: r.rateCents > 0 ? pesos(r.rateCents) : '',
        Estado: r.status,
        Piso: r.floor === null ? '' : String(r.floor),
      })),
      'hoteleria-kigyo',
      'hoteleria',
    )
  }

  const empleados = useMemo(() => {
    const seen = new Map<string, string>()
    for (const t of limpieza) {
      if (t.assignedId && t.assignedName) seen.set(t.assignedId, t.assignedName)
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label }))
  }, [limpieza])

  const tareas = useMemo(() => [...limpieza].sort((a, b) =>
    Number(a.done) - Number(b.done) || a.scheduledOn.localeCompare(b.scheduledOn),
  ), [limpieza])

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

  function startEditRoom(r: RoomRow) {
    setRoomForm({
      number: r.number,
      kind: r.kind,
      floor: r.floor === null ? '' : String(r.floor),
      capacity: String(r.capacity),
      rate: r.rateCents > 0 ? String(Math.round(r.rateCents / 100)) : '',
      amenities: r.amenities,
      notes: r.notes,
    })
    setEditingRoom(r)
    setRoomOpen(true)
  }

  function submitRoom() {
    startTransition(async () => {
      const result = editingRoom
        ? await updateHabitacion({
            id: editingRoom.id,
            number: roomForm.number,
            kind: roomForm.kind as never,
            floor: orNull(roomForm.floor),
            capacity: roomForm.capacity || 2,
            rateCents: toCents(roomForm.rate),
            amenities: roomForm.amenities,
            notes: roomForm.notes,
          })
        : await createHabitacion({
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
      setEditingRoom(null)
      setRoomOpen(false)
      addToast(editingRoom ? 'Habitación actualizada' : 'Habitación creada', 'ok')
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

  function submitTarea() {
    startTransition(async () => {
      const result = await createTareaLimpieza({        roomId: tareaForm.roomId,
        assignedId: tareaForm.assignedId || null,
        kind: tareaForm.kind as never,
        scheduledOn: tareaForm.scheduledOn || TODAY(),
        notes: tareaForm.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setTareaForm(EMPTY_TAREA)
      setTareaOpen(false)
      addToast('Tarea creada', 'ok')
    })
  }

  function submitSeason() {
    startTransition(async () => {
      const result = await createSeason({
        name: seasonForm.name,
        startsOn: seasonForm.startsOn,
        endsOn: seasonForm.endsOn,
        notes: seasonForm.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setSeasonForm(EMPTY_SEASON)
      setSeasonOpen(false)
      addToast('Temporada creada', 'ok')
    })
  }

  function removeSeason(id: string) {
    if (!window.confirm('¿Eliminar esta temporada y sus tarifas?')) return
    startTransition(async () => {
      const result = await deleteSeason(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Temporada eliminada', 'ok')
    })
  }

  function openRates(s: SeasonRow) {
    const base = new Map(habitaciones.map((r) => [r.kind, r.rateCents]))
    const form: Record<string, string> = {}
    for (const kind of ROOM_KINDS) {
      const existing = s.rates.find((r) => r.kind === kind)
      const cents = existing?.rateCents ?? base.get(kind) ?? 0
      form[kind] = String(Math.round(cents / 100))
    }
    setRatesForm(form)
    setRatesFor(s)
  }

  function submitRate(kind: string) {
    if (!ratesFor) return
    startTransition(async () => {
      const result = await saveSeasonRate({
        seasonId: ratesFor.id,
        kind: kind as 'Sencilla' | 'Doble' | 'Triple' | 'Suite' | 'Familiar',
        rateCents: toCents(ratesForm[kind] ?? ''),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Tarifa guardada', 'ok')
    })
  }

  /**
   * La tarifa de la noche viene de la temporada vigente. Se resuelve en el
   * servidor — el mismo RPC que usa la pantalla de reservas — y se ofrece
   * como sugerencia editable.
   */
  function resolveRate(roomId: string, checkinOn: string) {
    if (!roomId || !checkinOn) return
    startTransition(async () => {
      const result = await getRateFor(roomId, checkinOn)
      if (!result.ok) return
      if (result.rateCents === null || result.rateCents <= 0) return
      setReservationForm((f) => ({
        ...f,
        nightlyRate: String(Math.round(result.rateCents! / 100)),
      }))
    })
  }

  function toggleDone(t: LimpiezaRow) {
    startTransition(async () => {
      const result = await setTareaDone({ id: t.id, done: !t.done })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
    })
  }

  function changeFecha(t: LimpiezaRow, date: string) {
    if (!date || date === t.scheduledOn) return
    startTransition(async () => {
      const result = await setTareaFecha({ id: t.id, scheduledOn: date })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
    })
  }

  function removeTask(t: LimpiezaRow) {
    if (!window.confirm(`¿Eliminar la tarea de ${t.kind} de la habitación ${t.roomNumber}?`)) return
    startTransition(async () => {
      const result = await deleteTarea(t.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Tarea eliminada', 'ok')
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
              { key: 'temporadas', label: 'Temporadas' },
              { key: 'limpieza', label: 'Limpieza' },
            ]}
            value={tab}
            onChange={setTab}
          />
          {data.canWrite && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={exporting} aria-busy={exporting} className="btn" onClick={exportRows}><FileSpreadsheet size={15} />Exportar</button>
              {tab === 'habitaciones' ? (
                <button className="btn dark" disabled={pending} onClick={() => {
                  setRoomForm(EMPTY_ROOM)
                  setEditingRoom(null)
                  setRoomOpen(true)
                }}>
                  <Plus size={15} />Habitación
                </button>
              ) : tab === 'temporadas' ? (
                <button className="btn dark" disabled={pending} onClick={() => {
                  setSeasonForm(EMPTY_SEASON)
                  setSeasonOpen(true)
                }}>
                  <Plus size={15} />Temporada
                </button>
              ) : tab === 'limpieza' ? (
                <button className="btn dark" disabled={pending || habitaciones.length === 0}
                  onClick={() => {
                    setTareaForm({ ...EMPTY_TAREA, scheduledOn: TODAY() })
                    setTareaOpen(true)
                  }}>
                  <Plus size={15} />Tarea
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
                            <button className="ibtn" aria-label={`Editar habitación ${r.number}`}
                              disabled={pending} onClick={() => startEditRoom(r)}>
                              <PenLine size={14} />
                            </button>
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

        {tab === 'temporadas' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Temporada</th>
                  <th scope="col">Desde</th>
                  <th scope="col">Hasta</th>
                  <th scope="col">Tarifas</th>
                  <th scope="col">Estado</th>
                  <th scope="col" aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {seasons.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        Sin temporadas. Las reservas usan la tarifa base de cada habitación.
                      </div>
                    </td>
                  </tr>
                ) : seasons.map((s) => (
                  <tr key={s.id}>
                    <td><div className="cename">{s.name}</div></td>
                    <td className="muted mono" style={{ fontSize: 12 }}>{formatDate(s.startsOn)}</td>
                    <td className="muted mono" style={{ fontSize: 12 }}>{formatDate(s.endsOn)}</td>
                    <td>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {s.rates.length === 0
                          ? 'Usa la base'
                          : s.rates.map((r) => `${r.kind}: ${pesos(r.rateCents)}`).join(' · ')}
                      </div>
                    </td>
                    <td>
                      <Badge st={s.active ? 'Vigente' : 'Programada'} tone={s.active ? 'grn' : 'neu'} />
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="ibtn" style={{ width: 28, height: 28 }} data-tip="Editar tarifas"
                        disabled={pending} onClick={() => openRates(s)}
                        aria-label={`Editar tarifas de ${s.name}`}>
                        <PenLine size={13} />
                      </button>
                      <button className="ibtn" style={{ width: 28, height: 28, color: 'var(--redd)' }}
                        data-tip="Eliminar" disabled={pending}
                        onClick={() => removeSeason(s.id)}
                        aria-label={`Eliminar temporada ${s.name}`}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'limpieza' && (
          <>
            <div className="tblwrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Habitación</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Encargado</th>
                    <th scope="col">Fecha</th>
                    <th scope="col">Estado</th>
                    {data.canWrite && <th scope="col" aria-label="Acciones" />}
                  </tr>
                </thead>
                <tbody>
                  {tareas.length === 0 ? (
                    <tr>
                      <td colSpan={data.canWrite ? 6 : 5}>
                        <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                          Todavía no hay tareas de limpieza.
                        </div>
                      </td>
                    </tr>
                  ) : tareas.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <div className="cename mono">{t.roomNumber}</div>
                        {t.notes && <div className="elsub">{t.notes}</div>}
                      </td>
                      <td>{t.kind}</td>
                      <td>{t.assignedName ?? '—'}</td>
                      <td>
                        {data.canWrite ? (
                          <input className="field" type="date" value={t.scheduledOn}
                            disabled={pending}
                            onChange={(e) => changeFecha(t, e.target.value)} />
                        ) : formatDate(t.scheduledOn)}
                      </td>
                      <td>
                        <Badge st={t.done ? 'Hecha' : 'Pendiente'}
                          tone={t.done ? 'grn' : 'amb'} />
                      </td>
                      {data.canWrite && (
                        <td>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button className="ibtn"
                              aria-label={`${t.done ? 'Reabrir' : 'Completar'} tarea de ${t.roomNumber}`}
                              disabled={pending} onClick={() => toggleDone(t)}>
                              <Check size={14} />
                            </button>
                            <button className="ibtn"
                              aria-label={`Eliminar tarea de ${t.roomNumber}`}
                              disabled={pending} onClick={() => removeTask(t)}>
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
          </>
        )}
      </div>

      <FormDrawer
        open={roomOpen}
        onClose={() => setRoomOpen(false)}
        title={editingRoom ? `Editar habitación ${editingRoom.number}` : 'Nueva habitación'}
        footer={
          <button className="btn dark" disabled={pending} onClick={submitRoom}>
            <Check size={15} />{editingRoom ? 'Guardar cambios' : 'Crear habitación'}
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
            resolveRate(v, reservationForm.checkinOn || TODAY())
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
              onChange={(e) => {
                setReservationForm({ ...reservationForm, checkinOn: e.target.value })
                resolveRate(reservationForm.roomId, e.target.value)
              }} />
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

      <FormDrawer
        open={tareaOpen}
        onClose={() => setTareaOpen(false)}
        title="Nueva tarea de limpieza"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitTarea}>
            <Check size={15} />Crear tarea
          </button>
        }
      >
        <div className="flabel">Habitación</div>
        <Select value={tareaForm.roomId}
          onChange={(v) => setTareaForm({ ...tareaForm, roomId: v })}
          placeholder="Elige la habitación"
          options={habitaciones.map((r) => ({
            value: r.id,
            label: `${r.number} · ${r.kind} · ${r.capacity} pers.`,
          }))} />

        <div className="flabel">Tipo</div>
        <Select value={tareaForm.kind}
          onChange={(v) => setTareaForm({ ...tareaForm, kind: v })}
          options={[...TASK_KINDS]} />

        <label className="flabel" htmlFor="tarea-fecha">Fecha</label>
        <input id="tarea-fecha" className="field" type="date" value={tareaForm.scheduledOn}
          onChange={(e) => setTareaForm({ ...tareaForm, scheduledOn: e.target.value })} />

        {empleados.length > 0 && (
          <>
            <div className="flabel">Encargado</div>
            <Select value={tareaForm.assignedId}
              onChange={(v) => setTareaForm({ ...tareaForm, assignedId: v })}
              placeholder="Sin asignar"
              options={empleados} />
          </>
        )}

        <label className="flabel" htmlFor="tarea-notes">Notas</label>
        <textarea id="tarea-notes" className="field" rows={3} value={tareaForm.notes}
          onChange={(e) => setTareaForm({ ...tareaForm, notes: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={seasonOpen}
        onClose={() => setSeasonOpen(false)}
        title="Nueva temporada"
        footer={
          <button className="btn dark" disabled={pending || !seasonForm.name.trim() || !seasonForm.startsOn || !seasonForm.endsOn} onClick={submitSeason}>
            <Check size={15} />Crear temporada
          </button>
        }
      >
        <label className="flabel" htmlFor="season-name">Nombre</label>
        <input id="season-name" className="field" value={seasonForm.name}
          placeholder="Ej: Semana Santa, Puente festivo, Temporada baja"
          onChange={(e) => setSeasonForm({ ...seasonForm, name: e.target.value })} />
        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="season-from">Desde</label>
            <input id="season-from" className="field" type="date" value={seasonForm.startsOn}
              onChange={(e) => setSeasonForm({ ...seasonForm, startsOn: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="season-to">Hasta</label>
            <input id="season-to" className="field" type="date" value={seasonForm.endsOn}
              onChange={(e) => setSeasonForm({ ...seasonForm, endsOn: e.target.value })} />
          </div>
        </div>
        <label className="flabel" htmlFor="season-notes">Notas</label>
        <textarea id="season-notes" className="field" rows={2} value={seasonForm.notes}
          onChange={(e) => setSeasonForm({ ...seasonForm, notes: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={ratesFor !== null}
        onClose={() => setRatesFor(null)}
        title={ratesFor ? `Tarifas de ${ratesFor.name}` : 'Tarifas'}
        footer={
          <button className="btn dark" disabled={pending} onClick={() => setRatesFor(null)}>
            <Check size={15} />Listo
          </button>
        }
      >
        {ratesFor && (
          <>
            <div className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>
              Cada tipo cae a la tarifa base de la habitación cuando no tiene valor propio.
            </div>
            {ROOM_KINDS.map((kind) => (
              <div key={kind} className="fg2" style={{ alignItems: 'flex-end' }}>
                <div>
                  <label className="flabel" htmlFor={`rate-${kind}`}>{kind} (COP/noche)</label>
                  <input
                    id={`rate-${kind}`}
                    className="field"
                    inputMode="numeric"
                    value={ratesForm[kind] ?? ''}
                    onChange={(e) => setRatesForm({ ...ratesForm, [kind]: e.target.value })}
                  />
                </div>
                <button
                  className="btn"
                  disabled={pending || !ratesForm[kind]}
                  onClick={() => submitRate(kind)}
                >
                  Guardar
                </button>
              </div>
            ))}
          </>
        )}
      </FormDrawer>
    </>
  )
}
