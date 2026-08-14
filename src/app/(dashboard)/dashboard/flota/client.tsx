'use client'

import { useMemo, useState, useTransition } from 'react'
import { Car, AlertTriangle, Check, PenLine, Plus, Trash2, Wrench, Zap, FileSpreadsheet } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import TabBar from '@/components/ui/TabBar'
import FormDrawer from '@/components/ui/FormDrawer'
import LoadMore from '@/components/ui/LoadMore'
import { useApp } from '@/lib/context/AppContext'
import { useExport } from '@/lib/hooks/use-export'
import {
  FUEL_KINDS, VEHICLE_KINDS, VEHICLE_STATUSES, WORK_ORDER_KINDS,
} from '@/lib/domain'
import { cop } from '@/lib/utils'
import type { FlotaData, RouteRow, VehicleRow } from '@/server/queries/flota'
import {
  createRuta, createVehiculo, deleteRuta, deleteVehiculo, logCombustible, logServicio,
  setRutaStatus, setVehiculoStatus, updateVehiculo,
} from '@/server/mutations/flota'
import { fetchMoreVehiculos } from '@/server/actions/flota'

const RUTA_STATUSES = ['Planificada', 'En curso', 'Completada', 'Cancelada']

const DATE = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })

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

/** Days from today, negative once past. */
function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((new Date(`${iso}T00:00:00`).getTime() - today.getTime()) / 86_400_000)
}

/**
 * The soonest of a vehicle's three legal documents, and how long it has left.
 *
 * One number rather than three columns: what a fleet lead needs to know at a
 * glance is whether this vehicle is about to become undriveable, not which
 * particular certificate expires first.
 */
function soonestDoc(v: VehicleRow): { label: string; days: number } | null {
  const docs: Array<[string, string | null]> = [
    ['SOAT', v.soatExpiresOn],
    ['Tecnomecánica', v.inspectionExpiresOn],
    ['Seguro', v.insuranceExpiresOn],
  ]
  let best: { label: string; days: number } | null = null
  for (const [label, iso] of docs) {
    const days = daysUntil(iso)
    if (days === null) continue
    if (best === null || days < best.days) best = { label, days }
  }
  return best
}

const EMPTY_VEHICLE = {
  plate: '', kind: 'Camioneta', brand: '', model: '', modelYear: '', fuel: 'Gasolina',
  driverId: '', odometerKm: '0', capacityKg: '',
  soatExpiresOn: '', inspectionExpiresOn: '', insuranceExpiresOn: '', notes: '',
}

const EMPTY_SERVICE = {
  vehicleId: '', kind: 'Preventivo', description: '', provider: '',
  odometerKm: '', cost: '', servicedOn: '', nextServiceOn: '',
}

const EMPTY_FUEL = {
  vehicleId: '', liters: '', cost: '', odometerKm: '', station: '', driverId: '', filledOn: '',
}

const EMPTY_RUTA = {
  origin: '', destination: '', vehicleId: '', driverId: '', distanceKm: '', scheduledOn: '', notes: '',
}

export default function FlotaPage({ data }: { data: FlotaData }) {
  const { runExport, exporting } = useExport()
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [vehiculos, setVehiculos] = useState<VehicleRow[]>(data.vehiculos)
  const [total, setTotal] = useState(data.vehiculosTotal)
  const [servicios, setServicios] = useState(data.servicios)
  const [combustible, setCombustible] = useState(data.combustible)
  const [rutas, setRutas] = useState(data.rutas)
  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const [tab, setTab] = useState('vehiculos')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [vehicleOpen, setVehicleOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [serviceOpen, setServiceOpen] = useState(false)
  const [fuelOpen, setFuelOpen] = useState(false)
  const [rutaOpen, setRutaOpen] = useState(false)
  const [vehicleForm, setVehicleForm] = useState(EMPTY_VEHICLE)
  const [serviceForm, setServiceForm] = useState(EMPTY_SERVICE)
  const [fuelForm, setFuelForm] = useState(EMPTY_FUEL)
  const [rutaForm, setRutaForm] = useState(EMPTY_RUTA)

  function apply(next: FlotaData) {
    setVehiculos(next.vehiculos)
    setTotal(next.vehiculosTotal)
    setServicios(next.servicios)
    setCombustible(next.combustible)
    setRutas(next.rutas)
  }

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreVehiculos(vehiculos.length)
      if (!result.ok) { setLoadMoreError(result.error); return }
      setVehiculos((prev) => {
        const seen = new Set(prev.map((r) => r.id))
        return [...prev, ...result.data.rows.filter((r) => !seen.has(r.id))]
      })
      setTotal(result.data.total)
    })
  }

  const driverName = useMemo(() => {
    const byId = new Map(data.roster.map((r) => [r.employeeId, r.fullName]))
    return (id: string | null) => (id ? byId.get(id) ?? '—' : 'Sin conductor')
  }, [data.roster])

  const stats = useMemo(() => {
    const expiring = vehiculos.filter((v) => {
      const doc = soonestDoc(v)
      return doc !== null && doc.days <= 30
    })
    const fuelSpend = combustible.reduce((s, f) => s + f.costCents, 0)
    const serviceSpend = servicios.reduce((s, r) => s + r.costCents, 0)
    return {
      available: vehiculos.filter((v) => v.status === 'Disponible').length,
      workshop: vehiculos.filter((v) => v.status === 'En taller').length,
      expiring: expiring.length,
      spend: fuelSpend + serviceSpend,
    }
  }, [vehiculos, combustible, servicios])

  const visible = vehiculos.filter((v) => statusFilter === 'Todos' || v.status === statusFilter)

  const exportRows = () => {
    void runExport(
      visible.map((v) => ({
        Placa: v.plate,
        Marca: v.brand,
        Modelo: v.model,
        Estado: v.status,
        Año: v.modelYear === null ? '' : String(v.modelYear),
      })),
      'flota-kigyo',
      'flota',
    )
  }
  const vehicleOptions = vehiculos.map((v) => ({
    value: v.id,
    label: v.brand ? `${v.plate} · ${v.brand} ${v.model}`.trim() : v.plate,
  }))

  function changeStatus(v: VehicleRow, status: string) {
    startTransition(async () => {
      const result = await setVehiculoStatus({ id: v.id, status: status as never })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast(`${v.plate}: ${status.toLowerCase()}`, 'ok')
    })
  }

  function remove(v: VehicleRow) {
    if (!window.confirm(`¿Eliminar ${v.plate}? Se eliminan también sus servicios y tanqueos.`)) return
    startTransition(async () => {
      const result = await deleteVehiculo(v.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Vehículo eliminado', 'ok')
    })
  }

  function changeRutaStatus(r: RouteRow, status: string) {
    startTransition(async () => {
      const result = await setRutaStatus({ id: r.id, status: status as never })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast(`Ruta a ${r.destination}: ${status.toLowerCase()}`, 'ok')
    })
  }

  function removeRuta(r: RouteRow) {
    if (!window.confirm(`¿Eliminar la ruta hacia ${r.destination}?`)) return
    startTransition(async () => {
      const result = await deleteRuta(r.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Ruta eliminada', 'ok')
    })
  }

  function submitRuta() {
    startTransition(async () => {
      const result = await createRuta({
        origin: rutaForm.origin,
        destination: rutaForm.destination,
        vehicleId: rutaForm.vehicleId || null,
        driverId: rutaForm.driverId || null,
        distanceKm: orNull(rutaForm.distanceKm),
        scheduledOn: rutaForm.scheduledOn || TODAY(),
        notes: rutaForm.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setRutaForm(EMPTY_RUTA)
      setRutaOpen(false)
      addToast('Ruta registrada', 'ok')
    })
  }

  function openEdit(v: VehicleRow) {
    setEditingId(v.id)
    setVehicleForm({
      plate: v.plate,
      kind: v.kind,
      brand: v.brand,
      model: v.model,
      modelYear: v.modelYear === null ? '' : String(v.modelYear),
      fuel: v.fuel,
      driverId: v.driverId ?? '',
      odometerKm: String(v.odometerKm),
      capacityKg: v.capacityKg === null ? '' : String(v.capacityKg),
      soatExpiresOn: v.soatExpiresOn ?? '',
      inspectionExpiresOn: v.inspectionExpiresOn ?? '',
      insuranceExpiresOn: v.insuranceExpiresOn ?? '',
      notes: v.notes,
    })
    setVehicleOpen(true)
  }

  function submitVehicle() {
    startTransition(async () => {
      const payload = {
        plate: vehicleForm.plate,
        kind: vehicleForm.kind as never,
        brand: vehicleForm.brand,
        model: vehicleForm.model,
        modelYear: orNull(vehicleForm.modelYear),
        fuel: vehicleForm.fuel as never,
        driverId: vehicleForm.driverId || null,
        odometerKm: vehicleForm.odometerKm || 0,
        capacityKg: orNull(vehicleForm.capacityKg),
        soatExpiresOn: orNull(vehicleForm.soatExpiresOn),
        inspectionExpiresOn: orNull(vehicleForm.inspectionExpiresOn),
        insuranceExpiresOn: orNull(vehicleForm.insuranceExpiresOn),
        notes: vehicleForm.notes,
      }
      const result = editingId
        ? await updateVehiculo({ id: editingId, ...payload })
        : await createVehiculo(payload)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast(editingId ? 'Vehículo actualizado' : 'Vehículo registrado', 'ok')
      setEditingId(null)
      setVehicleForm(EMPTY_VEHICLE)
      setVehicleOpen(false)
    })
  }

  function submitService() {
    startTransition(async () => {
      const result = await logServicio({
        vehicleId: serviceForm.vehicleId,
        kind: serviceForm.kind as never,
        description: serviceForm.description,
        provider: serviceForm.provider,
        odometerKm: orNull(serviceForm.odometerKm),
        costCents: toCents(serviceForm.cost),
        servicedOn: serviceForm.servicedOn || TODAY(),
        nextServiceOn: orNull(serviceForm.nextServiceOn),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setServiceForm(EMPTY_SERVICE)
      setServiceOpen(false)
      addToast('Servicio registrado', 'ok')
    })
  }

  function submitFuel() {
    startTransition(async () => {
      const result = await logCombustible({
        vehicleId: fuelForm.vehicleId,
        liters: fuelForm.liters,
        costCents: toCents(fuelForm.cost),
        odometerKm: orNull(fuelForm.odometerKm),
        station: fuelForm.station,
        driverId: fuelForm.driverId || null,
        filledOn: fuelForm.filledOn || TODAY(),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setFuelForm(EMPTY_FUEL)
      setFuelOpen(false)
      addToast('Tanqueo registrado', 'ok')
    })
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat icon={<Car size={16} />} tone="blu" label="Vehículos disponibles"
            value={stats.available} sub={`de ${vehiculos.length} en flota`} />
        </div>
        <div className="rise d2">
          <Stat icon={<Wrench size={16} />} tone="amb" label="En taller" value={stats.workshop} />
        </div>
        <div className="rise d3">
          <Stat icon={<AlertTriangle size={16} />} tone="red" label="Documentos por vencer"
            value={stats.expiring} sub="en los próximos 30 días" />
        </div>
        <div className="rise d4">
          <Stat icon={<Zap size={16} />} tone="vio" label="Gasto de flota"
            value={pesos(stats.spend)} sub="combustible y mantenimiento" />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <TabBar
            items={[
              { key: 'vehiculos', label: 'Vehículos' },
              { key: 'servicios', label: 'Servicios' },
              { key: 'combustible', label: 'Combustible' },
              { key: 'rutas', label: 'Rutas' },
            ]}
            value={tab}
            onChange={setTab}
          />
          {data.canWrite && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={exporting} aria-busy={exporting} className="btn" onClick={exportRows}><FileSpreadsheet size={15} />Exportar</button>
              {tab !== 'vehiculos' && (
                <button className="btn" disabled={pending || (tab !== 'rutas' && vehiculos.length === 0)}
                  onClick={() => {
                    if (tab === 'servicios') {
                      setServiceForm({ ...EMPTY_SERVICE, vehicleId: vehiculos[0]?.id ?? '', servicedOn: TODAY() })
                      setServiceOpen(true)
                    } else if (tab === 'combustible') {
                      setFuelForm({ ...EMPTY_FUEL, vehicleId: vehiculos[0]?.id ?? '', filledOn: TODAY() })
                      setFuelOpen(true)
                    } else {
                      setRutaForm({ ...EMPTY_RUTA, scheduledOn: TODAY() })
                      setRutaOpen(true)
                    }
                  }}>
                  <Plus size={15} />{tab === 'servicios' ? 'Servicio'
                    : tab === 'combustible' ? 'Tanqueo' : 'Ruta'}
                </button>
              )}
              <button className="btn dark" disabled={pending} onClick={() => setVehicleOpen(true)}>
                <Plus size={15} />Vehículo
              </button>
            </div>
          )}
        </div>

        {tab === 'vehiculos' && (
          <>
            <div className="cpad" style={{ paddingBottom: 0 }}>
              <div style={{ maxWidth: 220 }}>
                <Select value={statusFilter} onChange={setStatusFilter}
                  options={['Todos', ...VEHICLE_STATUSES]} />
              </div>
            </div>

            <div className="tblwrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Placa</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Conductor</th>
                    <th scope="col">Odómetro</th>
                    <th scope="col">Próximo vencimiento</th>
                    <th scope="col">Estado</th>
                    {data.canWrite && <th scope="col" aria-label="Acciones" />}
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <tr>
                      <td colSpan={data.canWrite ? 7 : 6}>
                        <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                          {vehiculos.length === 0
                            ? 'Todavía no hay vehículos registrados.'
                            : 'No hay vehículos con ese estado.'}
                        </div>
                      </td>
                    </tr>
                  ) : visible.map((v) => {
                    const doc = soonestDoc(v)
                    return (
                      <tr key={v.id}>
                        <td>
                          <div className="cename mono">{v.plate}</div>
                          <div className="elsub">
                            {[v.brand, v.model, v.modelYear].filter(Boolean).join(' ') || '—'}
                          </div>
                        </td>
                        <td>{v.kind}<div className="elsub">{v.fuel}</div></td>
                        <td>{driverName(v.driverId)}</td>
                        <td>{v.odometerKm.toLocaleString('es-CO')} km</td>
                        <td>
                          {doc === null ? '—' : (
                            <>
                              {doc.label}
                              <div className="elsub" style={{ color: doc.days < 0 ? 'var(--red)' : undefined }}>
                                {doc.days < 0 ? `vencido hace ${-doc.days} días` : `en ${doc.days} días`}
                              </div>
                            </>
                          )}
                        </td>
                        <td>
                          <Badge st={v.status}
                            tone={v.status === 'Disponible' ? 'grn'
                              : v.status === 'En ruta' ? 'blu'
                              : v.status === 'En taller' ? 'amb' : 'neu'} />
                        </td>
                        {data.canWrite && (
                          <td>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <Select
                                value={v.status}
                                onChange={(next) => { if (next !== v.status) changeStatus(v, next) }}
                                options={[...VEHICLE_STATUSES]}
                              />
                              <button className="ibtn" aria-label={`Editar ${v.plate}`}
                                disabled={pending} onClick={() => openEdit(v)}>
                                <PenLine size={14} />
                              </button>
                              <button className="ibtn" aria-label={`Eliminar ${v.plate}`}
                                disabled={pending} onClick={() => remove(v)}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <LoadMore
              loaded={vehiculos.length}
              total={total}
              loading={loadingMore}
              error={loadMoreError}
              onLoadMore={loadMore}
              noun="vehículos"
            />
          </>
        )}

        {tab === 'servicios' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Vehículo</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Descripción</th>
                  <th scope="col">Taller</th>
                  <th scope="col">Fecha</th>
                  <th scope="col">Costo</th>
                </tr>
              </thead>
              <tbody>
                {servicios.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        No hay servicios registrados.
                      </div>
                    </td>
                  </tr>
                ) : servicios.map((s) => (
                  <tr key={s.id}>
                    <td className="mono">{s.plate}</td>
                    <td>{s.kind}</td>
                    <td>
                      {s.description || '—'}
                      {s.nextServiceOn && (
                        <div className="elsub">Próximo: {formatDate(s.nextServiceOn)}</div>
                      )}
                    </td>
                    <td>{s.provider || '—'}</td>
                    <td>{formatDate(s.servicedOn)}</td>
                    <td>{pesos(s.costCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'combustible' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Vehículo</th>
                  <th scope="col">Litros</th>
                  <th scope="col">Costo</th>
                  <th scope="col">Odómetro</th>
                  <th scope="col">Estación</th>
                  <th scope="col">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {combustible.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        No hay tanqueos registrados.
                      </div>
                    </td>
                  </tr>
                ) : combustible.map((f) => (
                  <tr key={f.id}>
                    <td className="mono">{f.plate}</td>
                    <td>{f.liters} L</td>
                    <td>{pesos(f.costCents)}</td>
                    <td>{f.odometerKm === null ? '—' : `${f.odometerKm.toLocaleString('es-CO')} km`}</td>
                    <td>{f.station || '—'}</td>
                    <td>{formatDate(f.filledOn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'rutas' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Origen → Destino</th>
                  <th scope="col">Vehículo</th>
                  <th scope="col">Conductor</th>
                  <th scope="col">Distancia</th>
                  <th scope="col">Estado</th>
                  {data.canWrite && <th scope="col" aria-label="Acciones" />}
                </tr>
              </thead>
              <tbody>
                {rutas.length === 0 ? (
                  <tr>
                    <td colSpan={data.canWrite ? 7 : 6}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        Todavía no hay rutas planificadas.
                      </div>
                    </td>
                  </tr>
                ) : rutas.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.scheduledOn)}</td>
                    <td>
                      {r.origin || '—'} → {r.destination}
                      {r.notes && <div className="elsub">{r.notes}</div>}
                    </td>
                    <td>{r.vehicleId ? r.vehicleName || '—' : '—'}</td>
                    <td>{r.driverId ? r.driverName || '—' : '—'}</td>
                    <td>{r.distanceKm === null ? '—' : `${r.distanceKm.toLocaleString('es-CO')} km`}</td>
                    <td>
                      <Badge st={r.status}
                        tone={r.status === 'Completada' ? 'grn'
                          : r.status === 'En curso' ? 'blu'
                          : r.status === 'Cancelada' ? 'red' : 'neu'} />
                    </td>
                    {data.canWrite && (
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <Select
                            value={r.status}
                            onChange={(next) => { if (next !== r.status) changeRutaStatus(r, next) }}
                            options={[...RUTA_STATUSES]}
                          />
                          <button className="ibtn" aria-label={`Eliminar ruta a ${r.destination}`}
                            disabled={pending} onClick={() => removeRuta(r)}>
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
        )}
      </div>

      <FormDrawer
        open={vehicleOpen}
        onClose={() => { setEditingId(null); setVehicleOpen(false) }}
        title={editingId ? 'Editar vehículo' : 'Nuevo vehículo'}
        footer={
          <button className="btn dark" disabled={pending} onClick={submitVehicle}>
            <Check size={15} />{editingId ? 'Guardar' : 'Registrar'}
          </button>
        }
      >
        <label className="flabel" htmlFor="veh-plate">Placa</label>
        <input id="veh-plate" className="field" value={vehicleForm.plate}
          onChange={(e) => setVehicleForm({ ...vehicleForm, plate: e.target.value.toUpperCase() })}
          placeholder="ABC123" />

        <div className="fg2">
          <div>
            <div className="flabel">Tipo</div>
            <Select value={vehicleForm.kind}
              onChange={(v) => setVehicleForm({ ...vehicleForm, kind: v })}
              options={[...VEHICLE_KINDS]} />
          </div>
          <div>
            <div className="flabel">Combustible</div>
            <Select value={vehicleForm.fuel}
              onChange={(v) => setVehicleForm({ ...vehicleForm, fuel: v })}
              options={[...FUEL_KINDS]} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="veh-brand">Marca</label>
            <input id="veh-brand" className="field" value={vehicleForm.brand}
              onChange={(e) => setVehicleForm({ ...vehicleForm, brand: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="veh-model">Modelo</label>
            <input id="veh-model" className="field" value={vehicleForm.model}
              onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="veh-year">Año</label>
            <input id="veh-year" className="field" type="number" min={1950} max={2100}
              value={vehicleForm.modelYear}
              onChange={(e) => setVehicleForm({ ...vehicleForm, modelYear: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="veh-odo">Odómetro (km)</label>
            <input id="veh-odo" className="field" type="number" min={0}
              value={vehicleForm.odometerKm}
              onChange={(e) => setVehicleForm({ ...vehicleForm, odometerKm: e.target.value })} />
          </div>
        </div>

        <div className="flabel">Conductor asignado</div>
        <Select value={vehicleForm.driverId}
          onChange={(v) => setVehicleForm({ ...vehicleForm, driverId: v })}
          placeholder="Sin conductor"
          options={data.roster.map((r) => ({ value: r.employeeId, label: r.fullName }))} />

        <label className="flabel" htmlFor="veh-cap">Capacidad (kg)</label>
        <input id="veh-cap" className="field" type="number" min={0} value={vehicleForm.capacityKg}
          onChange={(e) => setVehicleForm({ ...vehicleForm, capacityKg: e.target.value })} />

        <div className="flabel">Vencimiento SOAT</div>
        <input className="field" type="date" aria-label="Vencimiento SOAT"
          value={vehicleForm.soatExpiresOn}
          onChange={(e) => setVehicleForm({ ...vehicleForm, soatExpiresOn: e.target.value })} />

        <div className="flabel">Vencimiento tecnomecánica</div>
        <input className="field" type="date" aria-label="Vencimiento tecnomecánica"
          value={vehicleForm.inspectionExpiresOn}
          onChange={(e) => setVehicleForm({ ...vehicleForm, inspectionExpiresOn: e.target.value })} />

        <div className="flabel">Vencimiento seguro</div>
        <input className="field" type="date" aria-label="Vencimiento seguro"
          value={vehicleForm.insuranceExpiresOn}
          onChange={(e) => setVehicleForm({ ...vehicleForm, insuranceExpiresOn: e.target.value })} />

        <label className="flabel" htmlFor="veh-notes">Notas</label>
        <textarea id="veh-notes" className="field" rows={3} value={vehicleForm.notes}
          onChange={(e) => setVehicleForm({ ...vehicleForm, notes: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={serviceOpen}
        onClose={() => setServiceOpen(false)}
        title="Registrar servicio"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitService}>
            <Check size={15} />Registrar
          </button>
        }
      >
        <div className="flabel">Vehículo</div>
        <Select value={serviceForm.vehicleId}
          onChange={(v) => setServiceForm({ ...serviceForm, vehicleId: v })}
          placeholder="Elige el vehículo" options={vehicleOptions} />

        <div className="flabel">Tipo</div>
        <Select value={serviceForm.kind}
          onChange={(v) => setServiceForm({ ...serviceForm, kind: v })}
          options={[...WORK_ORDER_KINDS]} />

        <label className="flabel" htmlFor="srv-desc">Descripción</label>
        <input id="srv-desc" className="field" value={serviceForm.description}
          onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
          placeholder="Cambio de aceite y filtros" />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="srv-prov">Taller</label>
            <input id="srv-prov" className="field" value={serviceForm.provider}
              onChange={(e) => setServiceForm({ ...serviceForm, provider: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="srv-odo">Odómetro (km)</label>
            <input id="srv-odo" className="field" type="number" min={0}
              value={serviceForm.odometerKm}
              onChange={(e) => setServiceForm({ ...serviceForm, odometerKm: e.target.value })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="srv-cost">Costo (COP)</label>
            <input id="srv-cost" className="field" inputMode="numeric" value={serviceForm.cost}
              onChange={(e) => setServiceForm({ ...serviceForm, cost: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="srv-date">Fecha</label>
            <input id="srv-date" className="field" type="date" value={serviceForm.servicedOn}
              onChange={(e) => setServiceForm({ ...serviceForm, servicedOn: e.target.value })} />
          </div>
        </div>

        <label className="flabel" htmlFor="srv-next">Próximo servicio</label>
        <input id="srv-next" className="field" type="date" value={serviceForm.nextServiceOn}
          onChange={(e) => setServiceForm({ ...serviceForm, nextServiceOn: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={fuelOpen}
        onClose={() => setFuelOpen(false)}
        title="Registrar tanqueo"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitFuel}>
            <Check size={15} />Registrar
          </button>
        }
      >
        <div className="flabel">Vehículo</div>
        <Select value={fuelForm.vehicleId}
          onChange={(v) => setFuelForm({ ...fuelForm, vehicleId: v })}
          placeholder="Elige el vehículo" options={vehicleOptions} />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="fuel-l">Litros</label>
            <input id="fuel-l" className="field" type="number" min={0} step="0.01"
              value={fuelForm.liters}
              onChange={(e) => setFuelForm({ ...fuelForm, liters: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="fuel-cost">Costo (COP)</label>
            <input id="fuel-cost" className="field" inputMode="numeric" value={fuelForm.cost}
              onChange={(e) => setFuelForm({ ...fuelForm, cost: e.target.value })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="fuel-odo">Odómetro (km)</label>
            <input id="fuel-odo" className="field" type="number" min={0}
              value={fuelForm.odometerKm}
              onChange={(e) => setFuelForm({ ...fuelForm, odometerKm: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="fuel-date">Fecha</label>
            <input id="fuel-date" className="field" type="date" value={fuelForm.filledOn}
              onChange={(e) => setFuelForm({ ...fuelForm, filledOn: e.target.value })} />
          </div>
        </div>

        <label className="flabel" htmlFor="fuel-st">Estación</label>
        <input id="fuel-st" className="field" value={fuelForm.station}
          onChange={(e) => setFuelForm({ ...fuelForm, station: e.target.value })} />

        <div className="flabel">Conductor</div>
        <Select value={fuelForm.driverId}
          onChange={(v) => setFuelForm({ ...fuelForm, driverId: v })}
          placeholder="Sin conductor"
          options={data.roster.map((r) => ({ value: r.employeeId, label: r.fullName }))} />
      </FormDrawer>

      <FormDrawer
        open={rutaOpen}
        onClose={() => setRutaOpen(false)}
        title="Nueva ruta"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitRuta}>
            <Check size={15} />Registrar
          </button>
        }
      >
        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="rta-orig">Origen</label>
            <input id="rta-orig" className="field" value={rutaForm.origin}
              onChange={(e) => setRutaForm({ ...rutaForm, origin: e.target.value })}
              placeholder="Bodega principal" />
          </div>
          <div>
            <label className="flabel" htmlFor="rta-dest">Destino</label>
            <input id="rta-dest" className="field" value={rutaForm.destination}
              onChange={(e) => setRutaForm({ ...rutaForm, destination: e.target.value })}
              placeholder="Centro comercial" />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="rta-date">Fecha</label>
            <input id="rta-date" className="field" type="date" value={rutaForm.scheduledOn}
              onChange={(e) => setRutaForm({ ...rutaForm, scheduledOn: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="rta-km">Distancia (km)</label>
            <input id="rta-km" className="field" type="number" min={0} value={rutaForm.distanceKm}
              onChange={(e) => setRutaForm({ ...rutaForm, distanceKm: e.target.value })} />
          </div>
        </div>

        <div className="flabel">Vehículo</div>
        <Select value={rutaForm.vehicleId}
          onChange={(v) => setRutaForm({ ...rutaForm, vehicleId: v })}
          placeholder="Sin vehículo" options={vehicleOptions} />

        <div className="flabel">Conductor</div>
        <Select value={rutaForm.driverId}
          onChange={(v) => setRutaForm({ ...rutaForm, driverId: v })}
          placeholder="Sin conductor"
          options={data.roster.map((r) => ({ value: r.employeeId, label: r.fullName }))} />

        <label className="flabel" htmlFor="rta-notes">Notas</label>
        <textarea id="rta-notes" className="field" rows={3} value={rutaForm.notes}
          onChange={(e) => setRutaForm({ ...rutaForm, notes: e.target.value })} />
      </FormDrawer>
    </>
  )
}
