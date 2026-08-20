'use client'

import { useState, useTransition } from 'react'
import { Activity, Plus, RotateCcw, Trash2, X, XCircle } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import { useApp } from '@/lib/context/AppContext'
import { cop } from '@/lib/utils'
import type { StatusTone } from '@/lib/types'
import type { SuscriptoresData } from '@/server/queries/suscriptores'
import {
  addPlan,
  addSubscriber,
  deletePlan,
  deleteSubscriber,
  setSubscriberStatus,
} from '@/server/mutations/suscriptores'

const DAY = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtDate = (iso: string | null) => (iso ? DAY.format(new Date(`${iso}T00:00:00`)) : '—')
const todayIso = () => new Date().toISOString().slice(0, 10)

const STATUS_TONE: Record<string, StatusTone> = {
  activo: 'grn',
  suspendido: 'amb',
  cancelado: 'red',
}
const statusTone = (st: string): StatusTone => STATUS_TONE[st] ?? 'neu'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function pesos(cents: number): string {
  return cop(Math.round(cents / 100))
}

const EMPTY_PLAN = { name: '', price: '', description: '' }
const EMPTY_SUBSCRIBER = {
  name: '', planId: '', clientId: '', address: '', phone: '',
  activatedOn: todayIso(), notes: '',
}

export default function SuscriptoresPage({ data }: { data: SuscriptoresData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState(data)
  const [planForm, setPlanForm] = useState(EMPTY_PLAN)
  const [subscriberForm, setSubscriberForm] = useState(EMPTY_SUBSCRIBER)

  const planOpts = [
    { value: '', label: 'Sin plan' },
    ...state.plans.map((p) => ({ value: p.id, label: p.name })),
  ]
  const clientOpts = [
    { value: '', label: 'Sin cliente' },
    ...state.clients.map((c) => ({ value: c.id, label: c.name })),
  ]

  function submitPlan() {
    startTransition(async () => {
      const result = await addPlan({
        name: planForm.name,
        priceCents: Math.round(Number(planForm.price) * 100),
        description: planForm.description,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Plan añadido', 'ok')
      setPlanForm(EMPTY_PLAN)
    })
  }

  function removePlan(id: string) {
    if (!window.confirm('¿Eliminar este plan? Los suscriptores que lo usan se quedan, sin plan.')) return
    startTransition(async () => {
      const result = await deletePlan(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Plan eliminado', 'ok')
    })
  }

  function submitSubscriber() {
    startTransition(async () => {
      const result = await addSubscriber({
        planId: subscriberForm.planId || null,
        clientId: subscriberForm.clientId || null,
        name: subscriberForm.name,
        address: subscriberForm.address,
        phone: subscriberForm.phone,
        activatedOn: subscriberForm.activatedOn,
        notes: subscriberForm.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Suscriptor añadido', 'ok')
      setSubscriberForm({ ...EMPTY_SUBSCRIBER, activatedOn: todayIso() })
    })
  }

  function changeStatus(id: string, status: string) {
    startTransition(async () => {
      const result = await setSubscriberStatus(id, status)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Estado actualizado', 'ok')
    })
  }

  function removeSubscriber(id: string, name: string) {
    if (!window.confirm(`¿Eliminar a ${name}?`)) return
    startTransition(async () => {
      const result = await deleteSubscriber(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Suscriptor eliminado', 'ok')
    })
  }

  return (
    <>
      <div className="g3 g3--few" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat
            icon={<Activity size={16} />}
            tone="grn"
            label="Suscriptores"
            value={state.activosCount}
            sub={`${state.suspendidosCount} suspendidos`}
          />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <div className="ctitle">Nuevo plan</div>
        </div>

        <div className="cpad" style={{ paddingBottom: 0 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 150px', minWidth: 120 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Nombre</div>
              <input
                className="field"
                value={planForm.name}
                maxLength={80}
                placeholder="Ej: Hogar 50 megas"
                onChange={(e) => setPlanForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div style={{ flex: '0 1 110px', minWidth: 90 }}>
              <div className="flabel">Precio</div>
              <input
                type="number"
                className="field"
                min={0}
                value={planForm.price}
                placeholder="50000"
                onChange={(e) => setPlanForm((f) => ({ ...f, price: e.target.value }))}
              />
            </div>
            <div style={{ flex: '1 1 200px', minWidth: 160 }}>
              <div className="flabel">Descripción</div>
              <input
                className="field"
                value={planForm.description}
                maxLength={300}
                placeholder="Qué incluye"
                onChange={(e) => setPlanForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <button
              className="btn dark"
              disabled={pending || planForm.name.trim().length < 2 || !planForm.price}
              aria-busy={pending}
              onClick={submitPlan}
            >
              <Plus size={14} />Añadir plan
            </button>
          </div>
        </div>
      </div>

      <div className="card rise d3" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Planes</div>
        </div>

        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Precio</th>
                <th scope="col">Descripción</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {state.plans.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      Sin planes.
                    </div>
                  </td>
                </tr>
              ) : state.plans.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="cename">{p.name}</div>
                  </td>
                  <td className="mono">{pesos(p.priceCents)}</td>
                  <td className="muted">{p.description ?? '—'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      className="ibtn"
                      style={{ width: 28, height: 28, color: 'var(--redd)' }}
                      data-tip="Eliminar"
                      disabled={pending}
                      onClick={() => removePlan(p.id)}
                      aria-label={`Eliminar el plan ${p.name}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card rise d4" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Nuevo suscriptor</div>
        </div>

        <div className="cpad" style={{ paddingBottom: 0 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 160px', minWidth: 130 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Nombre</div>
              <input
                className="field"
                value={subscriberForm.name}
                maxLength={120}
                placeholder="Ej: Casa de la señora Ruiz"
                onChange={(e) => setSubscriberForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div style={{ flex: '1 1 150px', minWidth: 120 }}>
              <div className="flabel">Plan</div>
              <Select
                value={subscriberForm.planId}
                onChange={(v) => setSubscriberForm((f) => ({ ...f, planId: v }))}
                options={planOpts}
              />
            </div>
            <div style={{ flex: '1 1 150px', minWidth: 120 }}>
              <div className="flabel">Cliente</div>
              <Select
                value={subscriberForm.clientId}
                onChange={(v) => setSubscriberForm((f) => ({ ...f, clientId: v }))}
                options={clientOpts}
              />
            </div>
            <div style={{ flex: '1 1 180px', minWidth: 150 }}>
              <div className="flabel">Dirección</div>
              <input
                className="field"
                value={subscriberForm.address}
                maxLength={200}
                placeholder="Ej: Carrera 12 # 34-56"
                onChange={(e) => setSubscriberForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div style={{ flex: '0 1 150px', minWidth: 120 }}>
              <div className="flabel">Teléfono</div>
              <input
                className="field"
                value={subscriberForm.phone}
                maxLength={30}
                placeholder="300 123 4567"
                onChange={(e) => setSubscriberForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div style={{ flex: '0 1 140px', minWidth: 110 }}>
              <div className="flabel">Activación</div>
              <input
                type="date"
                className="field"
                value={subscriberForm.activatedOn}
                onChange={(e) => setSubscriberForm((f) => ({ ...f, activatedOn: e.target.value }))}
              />
            </div>
            <div style={{ flex: '1 1 180px', minWidth: 150 }}>
              <div className="flabel">Nota</div>
              <input
                className="field"
                value={subscriberForm.notes}
                maxLength={500}
                placeholder="Ej: instalación en la azotea"
                onChange={(e) => setSubscriberForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <button
              className="btn dark"
              disabled={
                pending || subscriberForm.name.trim().length < 2 || !subscriberForm.activatedOn
              }
              aria-busy={pending}
              onClick={submitSubscriber}
            >
              <Plus size={14} />Añadir suscriptor
            </button>
          </div>
        </div>
      </div>

      <div className="card rise d5" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Suscriptores</div>
        </div>

        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Plan</th>
                <th scope="col">Contacto</th>
                <th scope="col">Activado</th>
                <th scope="col">Estado</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {state.subscribers.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      Sin suscriptores.
                    </div>
                  </td>
                </tr>
              ) : state.subscribers.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="cename">{s.name}</div>
                    {s.notes && (
                      <div className="muted" style={{ fontSize: 12 }}>{s.notes}</div>
                    )}
                  </td>
                  <td className="muted">{s.planName ?? 'Sin plan'}</td>
                  <td>
                    {s.address || s.phone ? (
                      <>
                        {s.address && <div className="muted" style={{ fontSize: 12 }}>{s.address}</div>}
                        {s.phone && <div className="muted mono" style={{ fontSize: 12 }}>{s.phone}</div>}
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{fmtDate(s.activatedOn)}</td>
                  <td><Badge st={cap(s.status)} tone={statusTone(s.status)} /></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {s.status === 'activo' && (
                      <button
                        className="ibtn"
                        style={{ width: 28, height: 28 }}
                        data-tip="Suspender"
                        disabled={pending}
                        onClick={() => changeStatus(s.id, 'suspendido')}
                        aria-label={`Suspender a ${s.name}`}
                      >
                        <X size={13} />
                      </button>
                    )}
                    {s.status !== 'activo' && (
                      <button
                        className="ibtn"
                        style={{ width: 28, height: 28, color: 'var(--grnd)' }}
                        data-tip="Reactivar"
                        disabled={pending}
                        onClick={() => changeStatus(s.id, 'activo')}
                        aria-label={`Reactivar a ${s.name}`}
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}
                    {s.status !== 'cancelado' && (
                      <button
                        className="ibtn"
                        style={{ width: 28, height: 28, color: 'var(--amb)' }}
                        data-tip="Cancelar"
                        disabled={pending}
                        onClick={() => changeStatus(s.id, 'cancelado')}
                        aria-label={`Cancelar a ${s.name}`}
                      >
                        <XCircle size={13} />
                      </button>
                    )}
                    <button
                      className="ibtn"
                      style={{ width: 28, height: 28, color: 'var(--redd)' }}
                      data-tip="Eliminar"
                      disabled={pending}
                      onClick={() => removeSubscriber(s.id, s.name)}
                      aria-label={`Eliminar a ${s.name}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
