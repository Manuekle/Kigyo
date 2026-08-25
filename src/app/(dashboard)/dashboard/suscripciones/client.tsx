'use client'

import { useState, useTransition } from 'react'
import { Check, Plus, RotateCcw, Trash2, Users, X, XCircle } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import DatePicker from '@/components/ui/DatePicker'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import { useApp } from '@/lib/context/AppContext'
import { useConfirm } from '@/lib/context/ConfirmContext'
import { cop } from '@/lib/utils'
import type { StatusTone } from '@/lib/types'
import type { SuscripcionesData } from '@/server/queries/suscripciones'
import { addPlan, addSub, deletePlan, deleteSub, setSubStatus } from '@/server/mutations/suscripciones'

const DAY = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtDate = (iso: string | null) => (iso ? DAY.format(new Date(`${iso}T00:00:00`)) : '—')
const todayIso = () => new Date().toISOString().slice(0, 10)

const CYCLES = ['diario', 'semanal', 'mensual', 'trimestral', 'semestral', 'anual'] as const
type Cycle = (typeof CYCLES)[number]

const SUB_TONE: Record<string, StatusTone> = {
  activa: 'grn',
  suspendida: 'amb',
  cancelada: 'red',
  vencida: 'red',
}
const subTone = (st: string): StatusTone => SUB_TONE[st] ?? 'neu'
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function pesos(cents: number): string {
  return cop(Math.round(cents / 100))
}

const EMPTY_PLAN: { name: string; price: string; cycle: Cycle; description: string } = { name: '', price: '', cycle: 'mensual', description: '' }
const EMPTY_SUB = {
  clientId: '', planId: '', startedOn: todayIso(), nextChargeOn: '', price: '', notes: '',
}

export default function SuscripcionesPage({ data }: { data: SuscripcionesData }) {
  const { addToast } = useApp()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState(data)
  const [planForm, setPlanForm] = useState(EMPTY_PLAN)
  const [subForm, setSubForm] = useState(EMPTY_SUB)

  const clientOpts = [
    { value: '', label: 'Sin cliente' },
    ...state.clients.map((c) => ({ value: c.id, label: c.name })),
  ]
  const planOpts = [
    { value: '', label: 'Sin plan' },
    ...state.plans.map((p) => ({ value: p.id, label: p.name })),
  ]

  function submitPlan() {
    startTransition(async () => {
      const result = await addPlan({
        name: planForm.name,
        priceCents: Math.round(Number(planForm.price) * 100),
        cycle: planForm.cycle,
        description: planForm.description,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Plan creado', 'ok')
      setPlanForm(EMPTY_PLAN)
    })
  }

  async function removePlan(id: string) {
    if (!(await confirm({ title: '¿Eliminar este plan?', description: 'Las suscripciones que lo usan se quedan, con su precio congelado.', tone: 'danger' }))) return
    startTransition(async () => {
      const result = await deletePlan(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Plan eliminado', 'ok')
    })
  }

  function submitSub() {
    startTransition(async () => {
      const result = await addSub({
        clientId: subForm.clientId || null,
        planId: subForm.planId || null,
        startedOn: subForm.startedOn,
        nextChargeOn: subForm.nextChargeOn || null,
        priceCents: subForm.price.trim() ? Math.round(Number(subForm.price) * 100) : null,
        notes: subForm.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Suscripción creada', 'ok')
      setSubForm({ ...EMPTY_SUB, startedOn: todayIso() })
    })
  }

  function changeStatus(subId: string, status: string) {
    startTransition(async () => {
      const result = await setSubStatus(subId, status)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Estado actualizado', 'ok')
    })
  }

  async function removeSub(subId: string) {
    if (!(await confirm({ title: '¿Eliminar esta suscripción?', tone: 'danger' }))) return
    startTransition(async () => {
      const result = await deleteSub(subId)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Suscripción eliminada', 'ok')
    })
  }

  return (
    <>
      <div className="g3 g3--few" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat
            icon={<Users size={16} />}
            tone="grn"
            label="Suscripciones activas"
            value={state.activeCount}
            sub={`${pesos(state.monthlyCents)}/mes`}
          />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <div className="ctitle">Planes</div>
        </div>

        <div className="cpad" style={{ paddingBottom: 0 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 150px', minWidth: 120 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Nombre</div>
              <input
                className="field"
                value={planForm.name}
                maxLength={80}
                placeholder="Ej: Plan básico"
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
            <div style={{ flex: '0 1 140px', minWidth: 110 }}>
              <div className="flabel">Ciclo</div>
              <Select
                value={planForm.cycle}
                onChange={(v) => setPlanForm((f) => ({ ...f, cycle: v as Cycle }))}
                options={[...CYCLES]}
              />
            </div>
            <div style={{ flex: '1 1 200px', minWidth: 160 }}>
              <div className="flabel">Descripción</div>
              <input
                className="field"
                value={planForm.description}
                maxLength={500}
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

        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Precio</th>
                <th scope="col">Ciclo</th>
                <th scope="col">Descripción</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {state.plans.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      Sin planes todavía.
                    </div>
                  </td>
                </tr>
              ) : state.plans.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="cename">{p.name}</div>
                  </td>
                  <td className="mono">{pesos(p.priceCents)}</td>
                  <td><Badge st={cap(p.cycle)} tone="neu" /></td>
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

      <div className="card rise d3" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Suscripciones</div>
        </div>

        {/*
          «Próximo cobro» es una fecha, no un cobro.

          Nada la ejecuta y nada la adelanta: no hay proceso programado en el
          repositorio, así que la fecha se queda quieta cuando pasa y la
          suscripción no genera factura por su cuenta. Lo que sí hace, y hace
          bien, es avisar: `notif-panel` la lee y la saca en la campana y en
          Notificaciones con la antelación que digan las reglas.

          Sin esta línea, la columna se lee como una promesa de domiciliación —
          el usuario cierra el mes esperando facturas que nadie emitió.
        */}
        <div className="cpad" style={{ paddingBottom: 0 }}>
          <p className="muted" style={{ fontSize: 12.5, marginTop: 0, marginBottom: 12, lineHeight: 1.55 }}>
            «Próximo cobro» es un recordatorio: aparece en la campana y en
            Notificaciones cuando se acerca. Kigyo no cobra ni factura solo — cuando
            llegue la fecha, emites la factura desde Facturación y actualizas aquí la
            siguiente.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 160px', minWidth: 130 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Cliente</div>
              <Select
                value={subForm.clientId}
                onChange={(v) => setSubForm((f) => ({ ...f, clientId: v }))}
                options={clientOpts}
              />
            </div>
            <div style={{ flex: '1 1 160px', minWidth: 130 }}>
              <div className="flabel">Plan</div>
              <Select
                value={subForm.planId}
                onChange={(v) => setSubForm((f) => ({ ...f, planId: v }))}
                options={planOpts}
              />
            </div>
            <div style={{ flex: '0 1 140px', minWidth: 110 }}>
              <div className="flabel">Inicio</div>
              <DatePicker
                ariaLabel="Inicio"
                value={subForm.startedOn}
                onChange={(v) => setSubForm((f) => ({ ...f, startedOn: v }))}
              />
            </div>
            <div style={{ flex: '0 1 140px', minWidth: 110 }}>
              <div className="flabel">Próximo cobro</div>
              <DatePicker
                ariaLabel="Próximo cobro"
                value={subForm.nextChargeOn}
                onChange={(v) => setSubForm((f) => ({ ...f, nextChargeOn: v }))}
              />
            </div>
            <div style={{ flex: '0 1 110px', minWidth: 90 }}>
              <div className="flabel">Precio</div>
              <input
                type="number"
                className="field"
                min={0}
                value={subForm.price}
                placeholder="50000"
                onChange={(e) => setSubForm((f) => ({ ...f, price: e.target.value }))}
              />
            </div>
            <div style={{ flex: '1 1 180px', minWidth: 150 }}>
              <div className="flabel">Nota</div>
              <input
                className="field"
                value={subForm.notes}
                maxLength={500}
                placeholder="Ej: precio negociado"
                onChange={(e) => setSubForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <button
              className="btn dark"
              disabled={pending || !subForm.startedOn}
              aria-busy={pending}
              onClick={submitSub}
            >
              <Check size={14} />Crear
            </button>
          </div>
        </div>

        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Cliente</th>
                <th scope="col">Plan</th>
                <th scope="col">Inicio</th>
                <th scope="col">Próximo cobro</th>
                <th scope="col">Estado</th>
                <th scope="col">Precio</th>
                <th scope="col">Nota</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {state.subs.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      Sin suscripciones todavía.
                    </div>
                  </td>
                </tr>
              ) : state.subs.map((s) => {
                const plan = state.plans.find((p) => p.id === s.planId)
                const cents = s.priceCents ?? plan?.priceCents ?? null
                return (
                  <tr key={s.id}>
                    <td>
                      {s.clientName ? (
                        <div className="cename">{s.clientName}</div>
                      ) : (
                        <span className="muted">Sin cliente</span>
                      )}
                    </td>
                    <td className="muted">{s.planName ?? 'Sin plan'}</td>
                    <td className="muted mono" style={{ fontSize: 12 }}>{fmtDate(s.startedOn)}</td>
                    <td className="muted mono" style={{ fontSize: 12 }}>{fmtDate(s.nextChargeOn)}</td>
                    <td><Badge st={cap(s.status)} tone={subTone(s.status)} /></td>
                    <td className="mono">{cents === null ? '—' : pesos(cents)}</td>
                    <td className="muted">{s.notes ?? '—'}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {s.status === 'activa' && (
                        <button
                          className="ibtn"
                          style={{ width: 28, height: 28 }}
                          data-tip="Suspender"
                          disabled={pending}
                          onClick={() => changeStatus(s.id, 'suspendida')}
                          aria-label={`Suspender la suscripción de ${s.clientName ?? 'sin cliente'}`}
                        >
                          <X size={13} />
                        </button>
                      )}
                      {s.status !== 'activa' && (
                        <button
                          className="ibtn"
                          style={{ width: 28, height: 28, color: 'var(--grnd)' }}
                          data-tip="Reactivar"
                          disabled={pending}
                          onClick={() => changeStatus(s.id, 'activa')}
                          aria-label={`Reactivar la suscripción de ${s.clientName ?? 'sin cliente'}`}
                        >
                          <RotateCcw size={13} />
                        </button>
                      )}
                      {s.status !== 'cancelada' && s.status !== 'vencida' && (
                        <button
                          className="ibtn"
                          style={{ width: 28, height: 28, color: 'var(--amb)' }}
                          data-tip="Cancelar"
                          disabled={pending}
                          onClick={() => changeStatus(s.id, 'cancelada')}
                          aria-label={`Cancelar la suscripción de ${s.clientName ?? 'sin cliente'}`}
                        >
                          <XCircle size={13} />
                        </button>
                      )}
                      <button
                        className="ibtn"
                        style={{ width: 28, height: 28, color: 'var(--redd)' }}
                        data-tip="Eliminar"
                        disabled={pending}
                        onClick={() => removeSub(s.id)}
                        aria-label={`Eliminar la suscripción de ${s.clientName ?? 'sin cliente'}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
