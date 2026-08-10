'use client'

import { useMemo, useState, useTransition } from 'react'
import { Home, Check, Plus, Trash2, AlertTriangle, Wallet } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import TabBar from '@/components/ui/TabBar'
import FormDrawer from '@/components/ui/FormDrawer'
import LoadMore from '@/components/ui/LoadMore'
import { useApp } from '@/lib/context/AppContext'
import {
  LEASE_STATUSES, PAYMENT_METHODS, PROPERTY_KINDS, PROPERTY_STATUSES,
} from '@/lib/domain'
import { cop } from '@/lib/utils'
import type { InmobiliarioData, PropertyRow } from '@/server/queries/inmobiliario'
import {
  createContratoArriendo, createInmueble, deleteInmueble, registrarArriendo,
  setContratoArriendoStatus, setInmuebleStatus,
} from '@/server/mutations/inmobiliario'
import { fetchMoreInmuebles } from '@/server/actions/inmobiliario'

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
const THIS_PERIOD = () => new Date().toISOString().slice(0, 7)

const EMPTY_PROPERTY = {
  name: '', kind: 'Apartamento', address: '', city: '', areaM2: '', bedrooms: '',
  bathrooms: '', parkingSpots: '', rent: '', adminFee: '', salePrice: '', ownerName: '', notes: '',
}
const EMPTY_LEASE = {
  propertyId: '', tenantName: '', tenantDocument: '', tenantEmail: '', tenantPhone: '',
  rent: '', deposit: '', dueDay: '5', startsOn: '', endsOn: '', notes: '',
}
const EMPTY_PAYMENT = {
  leaseId: '', period: '', amount: '', paid: '', method: 'Transferencia', reference: '',
}

export default function InmobiliarioPage({ data }: { data: InmobiliarioData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [inmuebles, setInmuebles] = useState<PropertyRow[]>(data.inmuebles)
  const [total, setTotal] = useState(data.inmueblesTotal)
  const [contratos, setContratos] = useState(data.contratos)
  const [pagos, setPagos] = useState(data.pagos)
  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const [tab, setTab] = useState('inmuebles')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [propertyOpen, setPropertyOpen] = useState(false)
  const [leaseOpen, setLeaseOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [propertyForm, setPropertyForm] = useState(EMPTY_PROPERTY)
  const [leaseForm, setLeaseForm] = useState(EMPTY_LEASE)
  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT)

  function apply(next: InmobiliarioData) {
    setInmuebles(next.inmuebles)
    setTotal(next.inmueblesTotal)
    setContratos(next.contratos)
    setPagos(next.pagos)
  }

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreInmuebles(inmuebles.length)
      if (!result.ok) { setLoadMoreError(result.error); return }
      setInmuebles((prev) => {
        const seen = new Set(prev.map((r) => r.id))
        return [...prev, ...result.data.rows.filter((r) => !seen.has(r.id))]
      })
      setTotal(result.data.total)
    })
  }

  const stats = useMemo(() => {
    const live = contratos.filter((c) => c.status !== 'Terminado')
    return {
      rented: inmuebles.filter((p) => p.status === 'Arrendado').length,
      available: inmuebles.filter((p) => p.status === 'Disponible').length,
      monthly: live.reduce((s, c) => s + c.rentCents, 0),
      arrears: live.reduce((s, c) => s + c.balanceCents, 0),
    }
  }, [inmuebles, contratos])

  const visible = inmuebles.filter((p) => statusFilter === 'Todos' || p.status === statusFilter)
  const leaseOptions = contratos
    .filter((c) => c.status !== 'Terminado')
    .map((c) => ({ value: c.id, label: `${c.propertyName} · ${c.tenantName}` }))

  function changeProperty(p: PropertyRow, status: string) {
    startTransition(async () => {
      const result = await setInmuebleStatus({ id: p.id, status: status as never })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
    })
  }

  function changeLease(id: string, status: string) {
    startTransition(async () => {
      const result = await setContratoArriendoStatus({ id, status: status as never })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast(`Contrato ${status.toLowerCase()}`, 'ok')
    })
  }

  function remove(p: PropertyRow) {
    if (!window.confirm(`¿Eliminar ${p.name}? Se eliminan también sus contratos y pagos.`)) return
    startTransition(async () => {
      const result = await deleteInmueble(p.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Inmueble eliminado', 'ok')
    })
  }

  function submitProperty() {
    startTransition(async () => {
      const result = await createInmueble({
        name: propertyForm.name,
        kind: propertyForm.kind as never,
        address: propertyForm.address,
        city: propertyForm.city,
        areaM2: orNull(propertyForm.areaM2),
        bedrooms: orNull(propertyForm.bedrooms),
        bathrooms: orNull(propertyForm.bathrooms),
        parkingSpots: orNull(propertyForm.parkingSpots),
        rentCents: toCents(propertyForm.rent),
        adminFeeCents: toCents(propertyForm.adminFee),
        salePriceCents: toCents(propertyForm.salePrice),
        ownerName: propertyForm.ownerName,
        notes: propertyForm.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setPropertyForm(EMPTY_PROPERTY)
      setPropertyOpen(false)
      addToast('Inmueble creado', 'ok')
    })
  }

  function submitLease() {
    startTransition(async () => {
      const result = await createContratoArriendo({
        propertyId: leaseForm.propertyId,
        tenantName: leaseForm.tenantName,
        tenantDocument: leaseForm.tenantDocument,
        tenantEmail: leaseForm.tenantEmail || null,
        tenantPhone: leaseForm.tenantPhone,
        rentCents: toCents(leaseForm.rent),
        depositCents: toCents(leaseForm.deposit),
        dueDay: leaseForm.dueDay || 5,
        startsOn: leaseForm.startsOn || TODAY(),
        endsOn: orNull(leaseForm.endsOn),
        notes: leaseForm.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setLeaseForm(EMPTY_LEASE)
      setLeaseOpen(false)
      addToast('Contrato de arriendo creado', 'ok')
    })
  }

  function submitPayment() {
    startTransition(async () => {
      const result = await registrarArriendo({
        leaseId: paymentForm.leaseId,
        period: paymentForm.period || THIS_PERIOD(),
        amountCents: toCents(paymentForm.amount),
        paidCents: toCents(paymentForm.paid),
        method: paymentForm.method as never,
        reference: paymentForm.reference,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setPaymentForm(EMPTY_PAYMENT)
      setPaymentOpen(false)
      addToast('Arriendo registrado', 'ok')
    })
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat icon={<Home size={16} />} tone="blu" label="Arrendados"
            value={stats.rented} sub={`de ${inmuebles.length} inmuebles`} />
        </div>
        <div className="rise d2">
          <Stat icon={<Check size={16} />} tone="grn" label="Disponibles"
            value={stats.available} />
        </div>
        <div className="rise d3">
          <Stat icon={<Wallet size={16} />} tone="vio" label="Canon mensual"
            value={pesos(stats.monthly)} />
        </div>
        <div className="rise d4">
          <Stat icon={<AlertTriangle size={16} />} tone="red" label="En mora"
            value={pesos(stats.arrears)} />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <TabBar
            items={[
              { key: 'inmuebles', label: 'Inmuebles' },
              { key: 'contratos', label: 'Contratos' },
              { key: 'pagos', label: 'Pagos' },
            ]}
            value={tab}
            onChange={setTab}
          />
          {data.canWrite && (
            <div style={{ display: 'flex', gap: 8 }}>
              {tab === 'contratos' ? (
                <button className="btn dark" disabled={pending || inmuebles.length === 0}
                  onClick={() => {
                    setLeaseForm({ ...EMPTY_LEASE, propertyId: inmuebles[0]?.id ?? '', startsOn: TODAY() })
                    setLeaseOpen(true)
                  }}>
                  <Plus size={15} />Contrato
                </button>
              ) : tab === 'pagos' ? (
                <button className="btn dark" disabled={pending || leaseOptions.length === 0}
                  onClick={() => {
                    setPaymentForm({ ...EMPTY_PAYMENT, leaseId: leaseOptions[0]?.value ?? '', period: THIS_PERIOD() })
                    setPaymentOpen(true)
                  }}>
                  <Plus size={15} />Pago
                </button>
              ) : (
                <button className="btn dark" disabled={pending} onClick={() => setPropertyOpen(true)}>
                  <Plus size={15} />Inmueble
                </button>
              )}
            </div>
          )}
        </div>

        {tab === 'inmuebles' && (
          <>
            <div className="cpad" style={{ paddingBottom: 0 }}>
              <div style={{ maxWidth: 220 }}>
                <Select value={statusFilter} onChange={setStatusFilter}
                  options={['Todos', ...PROPERTY_STATUSES]} />
              </div>
            </div>

            <div className="tblwrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Inmueble</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Características</th>
                    <th scope="col">Canon</th>
                    <th scope="col">Propietario</th>
                    <th scope="col">Estado</th>
                    {data.canWrite && <th scope="col" aria-label="Acciones" />}
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <tr>
                      <td colSpan={data.canWrite ? 7 : 6}>
                        <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                          {inmuebles.length === 0
                            ? 'Todavía no hay inmuebles registrados.'
                            : 'No hay inmuebles con ese estado.'}
                        </div>
                      </td>
                    </tr>
                  ) : visible.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="cename">{p.name}</div>
                        <div className="elsub mono">
                          {p.code}{p.address && ` · ${p.address}`}{p.city && `, ${p.city}`}
                        </div>
                      </td>
                      <td>{p.kind}</td>
                      <td>
                        {[
                          p.areaM2 !== null && `${p.areaM2} m²`,
                          p.bedrooms !== null && `${p.bedrooms} hab`,
                          p.bathrooms !== null && `${p.bathrooms} baños`,
                          p.parkingSpots !== null && `${p.parkingSpots} parq`,
                        ].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td>
                        {p.rentCents > 0 ? pesos(p.rentCents) : '—'}
                        {p.adminFeeCents > 0 && (
                          <div className="elsub">admin {pesos(p.adminFeeCents)}</div>
                        )}
                      </td>
                      <td>{p.ownerName || '—'}</td>
                      <td>
                        <Badge st={p.status}
                          tone={p.status === 'Disponible' ? 'grn'
                            : p.status === 'Arrendado' ? 'blu'
                            : p.status === 'En mantenimiento' ? 'amb' : 'neu'} />
                      </td>
                      {data.canWrite && (
                        <td>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <Select
                              value={p.status}
                              onChange={(next) => { if (next !== p.status) changeProperty(p, next) }}
                              options={[...PROPERTY_STATUSES]}
                            />
                            <button className="ibtn" aria-label={`Eliminar ${p.name}`}
                              disabled={pending} onClick={() => remove(p)}>
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
              loaded={inmuebles.length}
              total={total}
              loading={loadingMore}
              error={loadMoreError}
              onLoadMore={loadMore}
              noun="inmuebles"
            />
          </>
        )}

        {tab === 'contratos' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Inmueble</th>
                  <th scope="col">Inquilino</th>
                  <th scope="col">Canon</th>
                  <th scope="col">Vigencia</th>
                  <th scope="col">Saldo</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {contratos.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        No hay contratos de arriendo.
                      </div>
                    </td>
                  </tr>
                ) : contratos.map((c) => (
                  <tr key={c.id}>
                    <td><div className="cename">{c.propertyName}</div></td>
                    <td>
                      <div className="cename">{c.tenantName}</div>
                      <div className="elsub">
                        {[c.tenantDocument, c.tenantPhone].filter(Boolean).join(' · ') || '—'}
                      </div>
                    </td>
                    <td>
                      {pesos(c.rentCents)}
                      <div className="elsub">vence el {c.dueDay}</div>
                    </td>
                    <td>
                      {formatDate(c.startsOn)}
                      <div className="elsub">
                        {c.endsOn ? `hasta ${formatDate(c.endsOn)}` : 'sin término'}
                      </div>
                    </td>
                    <td>
                      {c.balanceCents > 0 ? (
                        <>
                          <span style={{ color: 'var(--red)' }}>{pesos(c.balanceCents)}</span>
                          <div className="elsub">
                            {c.overduePeriods} {c.overduePeriods === 1 ? 'periodo' : 'periodos'}
                          </div>
                        </>
                      ) : 'Al día'}
                    </td>
                    <td>
                      {data.canWrite ? (
                        <Select
                          value={c.status}
                          onChange={(next) => { if (next !== c.status) changeLease(c.id, next) }}
                          options={[...LEASE_STATUSES]}
                        />
                      ) : (
                        <Badge st={c.status}
                          tone={c.status === 'Activo' ? 'grn'
                            : c.status === 'En mora' ? 'red'
                            : c.status === 'Por vencer' ? 'amb' : 'neu'} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'pagos' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Contrato</th>
                  <th scope="col">Periodo</th>
                  <th scope="col">Canon</th>
                  <th scope="col">Pagado</th>
                  <th scope="col">Vence</th>
                  <th scope="col">Medio</th>
                </tr>
              </thead>
              <tbody>
                {pagos.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        No hay pagos registrados.
                      </div>
                    </td>
                  </tr>
                ) : pagos.map((p) => {
                  const lease = contratos.find((c) => c.id === p.leaseId)
                  const owed = p.amountCents - p.paidCents
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="cename">{lease?.propertyName ?? '—'}</div>
                        <div className="elsub">{lease?.tenantName ?? ''}</div>
                      </td>
                      <td className="mono">{p.period}</td>
                      <td>{pesos(p.amountCents)}</td>
                      <td>
                        {pesos(p.paidCents)}
                        {owed > 0 && (
                          <div className="elsub" style={{ color: 'var(--red)' }}>
                            debe {pesos(owed)}
                          </div>
                        )}
                      </td>
                      <td>{formatDate(p.dueOn)}</td>
                      <td>
                        {p.paidOn ? p.method : '—'}
                        {p.reference && <div className="elsub">{p.reference}</div>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FormDrawer
        open={propertyOpen}
        onClose={() => setPropertyOpen(false)}
        title="Nuevo inmueble"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitProperty}>
            <Check size={15} />Crear inmueble
          </button>
        }
      >
        <label className="flabel" htmlFor="inm-name">Nombre</label>
        <input id="inm-name" className="field" value={propertyForm.name}
          onChange={(e) => setPropertyForm({ ...propertyForm, name: e.target.value })}
          placeholder="Apto 501 — Torre Norte" />

        <div className="flabel">Tipo</div>
        <Select value={propertyForm.kind}
          onChange={(v) => setPropertyForm({ ...propertyForm, kind: v })}
          options={[...PROPERTY_KINDS]} />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="inm-addr">Dirección</label>
            <input id="inm-addr" className="field" value={propertyForm.address}
              onChange={(e) => setPropertyForm({ ...propertyForm, address: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="inm-city">Ciudad</label>
            <input id="inm-city" className="field" value={propertyForm.city}
              onChange={(e) => setPropertyForm({ ...propertyForm, city: e.target.value })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="inm-area">Área (m²)</label>
            <input id="inm-area" className="field" type="number" min={0} step="0.01"
              value={propertyForm.areaM2}
              onChange={(e) => setPropertyForm({ ...propertyForm, areaM2: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="inm-bed">Habitaciones</label>
            <input id="inm-bed" className="field" type="number" min={0}
              value={propertyForm.bedrooms}
              onChange={(e) => setPropertyForm({ ...propertyForm, bedrooms: e.target.value })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="inm-bath">Baños</label>
            <input id="inm-bath" className="field" type="number" min={0}
              value={propertyForm.bathrooms}
              onChange={(e) => setPropertyForm({ ...propertyForm, bathrooms: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="inm-park">Parqueaderos</label>
            <input id="inm-park" className="field" type="number" min={0}
              value={propertyForm.parkingSpots}
              onChange={(e) => setPropertyForm({ ...propertyForm, parkingSpots: e.target.value })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="inm-rent">Canon (COP)</label>
            <input id="inm-rent" className="field" inputMode="numeric" value={propertyForm.rent}
              onChange={(e) => setPropertyForm({ ...propertyForm, rent: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="inm-admin">Administración (COP)</label>
            <input id="inm-admin" className="field" inputMode="numeric" value={propertyForm.adminFee}
              onChange={(e) => setPropertyForm({ ...propertyForm, adminFee: e.target.value })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="inm-sale">Precio de venta (COP)</label>
            <input id="inm-sale" className="field" inputMode="numeric" value={propertyForm.salePrice}
              onChange={(e) => setPropertyForm({ ...propertyForm, salePrice: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="inm-owner">Propietario</label>
            <input id="inm-owner" className="field" value={propertyForm.ownerName}
              onChange={(e) => setPropertyForm({ ...propertyForm, ownerName: e.target.value })} />
          </div>
        </div>

        <label className="flabel" htmlFor="inm-notes">Notas</label>
        <textarea id="inm-notes" className="field" rows={3} value={propertyForm.notes}
          onChange={(e) => setPropertyForm({ ...propertyForm, notes: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={leaseOpen}
        onClose={() => setLeaseOpen(false)}
        title="Nuevo contrato de arriendo"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitLease}>
            <Check size={15} />Crear contrato
          </button>
        }
      >
        <div className="flabel">Inmueble</div>
        <Select value={leaseForm.propertyId}
          onChange={(v) => {
            const property = inmuebles.find((p) => p.id === v)
            setLeaseForm({
              ...leaseForm,
              propertyId: v,
              // The property's canon is the starting point; negotiating it down
              // is normal, so the field stays editable.
              rent: property && property.rentCents > 0
                ? String(Math.round(property.rentCents / 100))
                : leaseForm.rent,
            })
          }}
          placeholder="Elige el inmueble"
          options={inmuebles.map((p) => ({
            value: p.id,
            label: p.status === 'Disponible' ? p.name : `${p.name} · ${p.status}`,
          }))} />

        <label className="flabel" htmlFor="lea-tenant">Inquilino</label>
        <input id="lea-tenant" className="field" value={leaseForm.tenantName}
          onChange={(e) => setLeaseForm({ ...leaseForm, tenantName: e.target.value })} />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="lea-doc">Documento</label>
            <input id="lea-doc" className="field" value={leaseForm.tenantDocument}
              onChange={(e) => setLeaseForm({ ...leaseForm, tenantDocument: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="lea-phone">Teléfono</label>
            <input id="lea-phone" className="field" value={leaseForm.tenantPhone}
              onChange={(e) => setLeaseForm({ ...leaseForm, tenantPhone: e.target.value })} />
          </div>
        </div>

        <label className="flabel" htmlFor="lea-mail">Correo</label>
        <input id="lea-mail" className="field" type="email" value={leaseForm.tenantEmail}
          onChange={(e) => setLeaseForm({ ...leaseForm, tenantEmail: e.target.value })} />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="lea-rent">Canon (COP)</label>
            <input id="lea-rent" className="field" inputMode="numeric" value={leaseForm.rent}
              onChange={(e) => setLeaseForm({ ...leaseForm, rent: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="lea-dep">Depósito (COP)</label>
            <input id="lea-dep" className="field" inputMode="numeric" value={leaseForm.deposit}
              onChange={(e) => setLeaseForm({ ...leaseForm, deposit: e.target.value })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="lea-day">Día de pago</label>
            <input id="lea-day" className="field" type="number" min={1} max={28}
              value={leaseForm.dueDay}
              onChange={(e) => setLeaseForm({ ...leaseForm, dueDay: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="lea-start">Inicia</label>
            <input id="lea-start" className="field" type="date" value={leaseForm.startsOn}
              onChange={(e) => setLeaseForm({ ...leaseForm, startsOn: e.target.value })} />
          </div>
        </div>

        <label className="flabel" htmlFor="lea-end">Termina</label>
        <input id="lea-end" className="field" type="date" value={leaseForm.endsOn}
          onChange={(e) => setLeaseForm({ ...leaseForm, endsOn: e.target.value })} />

        <label className="flabel" htmlFor="lea-notes">Notas</label>
        <textarea id="lea-notes" className="field" rows={3} value={leaseForm.notes}
          onChange={(e) => setLeaseForm({ ...leaseForm, notes: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        title="Registrar arriendo"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitPayment}>
            <Check size={15} />Registrar
          </button>
        }
      >
        <div className="flabel">Contrato</div>
        <Select value={paymentForm.leaseId}
          onChange={(v) => setPaymentForm({ ...paymentForm, leaseId: v })}
          placeholder="Elige el contrato" options={leaseOptions} />

        <label className="flabel" htmlFor="pay-period">Periodo (AAAA-MM)</label>
        <input id="pay-period" className="field" value={paymentForm.period}
          onChange={(e) => setPaymentForm({ ...paymentForm, period: e.target.value })}
          placeholder="2026-08" />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="pay-amount">Canon del periodo (COP)</label>
            <input id="pay-amount" className="field" inputMode="numeric" value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              placeholder="Toma el del contrato" />
          </div>
          <div>
            <label className="flabel" htmlFor="pay-paid">Pagado (COP)</label>
            <input id="pay-paid" className="field" inputMode="numeric" value={paymentForm.paid}
              onChange={(e) => setPaymentForm({ ...paymentForm, paid: e.target.value })} />
          </div>
        </div>

        <div className="flabel">Medio de pago</div>
        <Select value={paymentForm.method}
          onChange={(v) => setPaymentForm({ ...paymentForm, method: v })}
          options={[...PAYMENT_METHODS]} />

        <label className="flabel" htmlFor="pay-ref">Referencia</label>
        <input id="pay-ref" className="field" value={paymentForm.reference}
          onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} />
      </FormDrawer>
    </>
  )
}
