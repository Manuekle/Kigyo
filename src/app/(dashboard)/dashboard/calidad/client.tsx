'use client'

import { useState, useTransition } from 'react'
import { Activity, Check, Plus, RotateCcw, ShieldAlert, Trash2 } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import DatePicker from '@/components/ui/DatePicker'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import { useApp } from '@/lib/context/AppContext'
import type { StatusTone } from '@/lib/types'
import type { CalidadData } from '@/server/queries/calidad'
import {
  addCheck,
  addNonconformity,
  deleteCheck,
  deleteNonconformity,
  setNonconformityStatus,
} from '@/server/mutations/calidad'

// La fecha llega como 'YYYY-MM-DD' (columna date). Se formatea en UTC para que
// la zona local no desplace el día un día atrás.
const DATE_FMT = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const fmtDate = (d: string) => DATE_FMT.format(new Date(`${d}T00:00:00Z`))

const RESULT_TONE: Record<string, StatusTone> = {
  aprobado: 'grn',
  rechazado: 'red',
  condicional: 'neu',
}
const resultTone = (r: string): StatusTone => RESULT_TONE[r] ?? 'neu'

const SEVERITY_TONE: Record<string, StatusTone> = {
  baja: 'grn',
  media: 'amb',
  alta: 'red',
}
const severityTone = (s: string): StatusTone => SEVERITY_TONE[s] ?? 'neu'

const STATUS_TONE: Record<string, StatusTone> = {
  abierta: 'red',
  en_proceso: 'amb',
  cerrada: 'grn',
}
const statusTone = (s: string): StatusTone => STATUS_TONE[s] ?? 'neu'
const statusLabel = (s: string) => s.replace('_', ' ')

type CheckForm = {
  productId: string
  batch: string
  checkedOn: string
  result: 'aprobado' | 'rechazado' | 'condicional'
  notes: string
}
type NcForm = {
  productId: string
  batch: string
  description: string
  severity: 'baja' | 'media' | 'alta'
  openedOn: string
}

const EMPTY_CHECK: CheckForm = { productId: '', batch: '', checkedOn: '', result: 'aprobado', notes: '' }
const EMPTY_NC: NcForm = { productId: '', batch: '', description: '', severity: 'media', openedOn: '' }

export default function CalidadPage({ data }: { data: CalidadData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState(data)
  const [checkForm, setCheckForm] = useState(EMPTY_CHECK)
  const [ncForm, setNcForm] = useState(EMPTY_NC)

  const productOpts = [
    { value: '', label: 'Sin producto' },
    ...state.products.map((p) => ({ value: p.id, label: p.name })),
  ]
  const resultOpts = [
    { value: 'aprobado', label: 'Aprobado' },
    { value: 'rechazado', label: 'Rechazado' },
    { value: 'condicional', label: 'Condicional' },
  ]
  const severityOpts = [
    { value: 'baja', label: 'Baja' },
    { value: 'media', label: 'Media' },
    { value: 'alta', label: 'Alta' },
  ]

  function submitCheck() {
    startTransition(async () => {
      const result = await addCheck({
        productId: checkForm.productId || null,
        batch: checkForm.batch,
        checkedOn: checkForm.checkedOn,
        result: checkForm.result,
        notes: checkForm.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Control registrado', 'ok')
      setCheckForm(EMPTY_CHECK)
    })
  }

  function removeCheck(id: string) {
    if (!window.confirm('¿Eliminar este control?')) return
    startTransition(async () => {
      const result = await deleteCheck(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Control eliminado', 'ok')
    })
  }

  function submitNc() {
    startTransition(async () => {
      const result = await addNonconformity({
        productId: ncForm.productId || null,
        batch: ncForm.batch,
        description: ncForm.description,
        severity: ncForm.severity,
        openedOn: ncForm.openedOn,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('No conformidad registrada', 'ok')
      setNcForm(EMPTY_NC)
    })
  }

  function changeNcStatus(id: string, status: string) {
    startTransition(async () => {
      const result = await setNonconformityStatus(id, status)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Estado actualizado', 'ok')
    })
  }

  function removeNc(id: string) {
    if (!window.confirm('¿Eliminar esta no conformidad?')) return
    startTransition(async () => {
      const result = await deleteNonconformity(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('No conformidad eliminada', 'ok')
    })
  }

  return (
    <>
      <div className="g3 g3--few" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat
            icon={<ShieldAlert size={16} />}
            tone={state.abiertasCount > 0 ? 'red' : 'grn'}
            label="No conformidades abiertas"
            value={state.abiertasCount}
            sub="Detectadas y sin resolver"
          />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <div className="ctitle">Nuevo control</div>
        </div>

        <div className="cpad">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 160px', minWidth: 130 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Producto</div>
              <Select
                value={checkForm.productId}
                onChange={(v) => setCheckForm((f) => ({ ...f, productId: v }))}
                options={productOpts}
              />
            </div>
            <div style={{ flex: '1 1 140px', minWidth: 110 }}>
              <div className="flabel">Lote</div>
              <input
                className="field"
                value={checkForm.batch}
                maxLength={80}
                placeholder="Ej: L-2410"
                onChange={(e) => setCheckForm((f) => ({ ...f, batch: e.target.value }))}
              />
            </div>
            <div style={{ flex: '0 1 160px', minWidth: 140 }}>
              <div className="flabel">Fecha</div>
              <DatePicker
                ariaLabel="Fecha"
                value={checkForm.checkedOn}
                onChange={(v) => setCheckForm((f) => ({ ...f, checkedOn: v }))}
              />
            </div>
            <div style={{ flex: '0 1 160px', minWidth: 130 }}>
              <div className="flabel">Resultado</div>
              <Select
                value={checkForm.result}
                onChange={(v) => setCheckForm((f) => ({ ...f, result: v as CheckForm['result'] }))}
                options={resultOpts}
              />
            </div>
            <div style={{ flex: '1 1 180px', minWidth: 150 }}>
              <div className="flabel">Nota</div>
              <input
                className="field"
                value={checkForm.notes}
                maxLength={500}
                placeholder="Ej: humedad fuera de rango"
                onChange={(e) => setCheckForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <button
              className="btn dark"
              disabled={pending || !checkForm.checkedOn}
              aria-busy={pending}
              onClick={submitCheck}
            >
              <Plus size={14} />Registrar control
            </button>
          </div>
        </div>
      </div>

      <div className="card rise d3" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Controles</div>
        </div>

        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Producto</th>
                <th scope="col">Lote</th>
                <th scope="col">Fecha</th>
                <th scope="col">Resultado</th>
                <th scope="col">Nota</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {state.checks.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      Sin controles.
                    </div>
                  </td>
                </tr>
              ) : state.checks.map((c) => (
                <tr key={c.id}>
                  <td>
                    {c.productName ? (
                      c.productName
                    ) : (
                      <span className="muted">Sin producto</span>
                    )}
                  </td>
                  <td className="muted">{c.batch ?? '—'}</td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{fmtDate(c.checkedOn)}</td>
                  <td><Badge st={c.result} tone={resultTone(c.result)} /></td>
                  <td className="muted">{c.notes ?? '—'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      className="ibtn"
                      style={{ width: 28, height: 28, color: 'var(--redd)' }}
                      data-tip="Eliminar"
                      disabled={pending}
                      onClick={() => removeCheck(c.id)}
                      aria-label="Eliminar control"
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
          <div className="ctitle">Nueva no conformidad</div>
        </div>

        <div className="cpad">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 160px', minWidth: 130 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Producto</div>
              <Select
                value={ncForm.productId}
                onChange={(v) => setNcForm((f) => ({ ...f, productId: v }))}
                options={productOpts}
              />
            </div>
            <div style={{ flex: '1 1 140px', minWidth: 110 }}>
              <div className="flabel">Lote</div>
              <input
                className="field"
                value={ncForm.batch}
                maxLength={80}
                placeholder="Ej: L-2410"
                onChange={(e) => setNcForm((f) => ({ ...f, batch: e.target.value }))}
              />
            </div>
            <div style={{ flex: '1 1 220px', minWidth: 180 }}>
              <div className="flabel">Descripción</div>
              <input
                className="field"
                value={ncForm.description}
                maxLength={500}
                placeholder="Ej: empaque roto en 3 unidades"
                onChange={(e) => setNcForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div style={{ flex: '0 1 140px', minWidth: 120 }}>
              <div className="flabel">Severidad</div>
              <Select
                value={ncForm.severity}
                onChange={(v) => setNcForm((f) => ({ ...f, severity: v as NcForm['severity'] }))}
                options={severityOpts}
              />
            </div>
            <div style={{ flex: '0 1 160px', minWidth: 140 }}>
              <div className="flabel">Fecha</div>
              <DatePicker
                ariaLabel="Fecha"
                value={ncForm.openedOn}
                onChange={(v) => setNcForm((f) => ({ ...f, openedOn: v }))}
              />
            </div>
            <button
              className="btn dark"
              disabled={pending || ncForm.description.trim().length < 2 || !ncForm.openedOn}
              aria-busy={pending}
              onClick={submitNc}
            >
              <Plus size={14} />Registrar
            </button>
          </div>
        </div>
      </div>

      <div className="card rise d5" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">No conformidades</div>
        </div>

        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Producto</th>
                <th scope="col">Lote</th>
                <th scope="col">Descripción</th>
                <th scope="col">Severidad</th>
                <th scope="col">Estado</th>
                <th scope="col">Abierta</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {state.nonconformities.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      Sin no conformidades.
                    </div>
                  </td>
                </tr>
              ) : state.nonconformities.map((n) => (
                <tr key={n.id}>
                  <td>
                    {n.productName ? (
                      n.productName
                    ) : (
                      <span className="muted">Sin producto</span>
                    )}
                  </td>
                  <td className="muted">{n.batch ?? '—'}</td>
                  <td>
                    <div className="cename">{n.description}</div>
                    {n.actionTaken && (
                      <div className="muted" style={{ fontSize: 12 }}>Acción: {n.actionTaken}</div>
                    )}
                  </td>
                  <td><Badge st={n.severity} tone={severityTone(n.severity)} /></td>
                  <td><Badge st={statusLabel(n.status)} tone={statusTone(n.status)} /></td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{fmtDate(n.openedOn)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {n.status === 'abierta' && (
                      <button
                        className="ibtn"
                        style={{ width: 28, height: 28 }}
                        data-tip="En proceso"
                        disabled={pending}
                        onClick={() => changeNcStatus(n.id, 'en_proceso')}
                        aria-label="Marcar en proceso"
                      >
                        <Activity size={13} />
                      </button>
                    )}
                    {(n.status === 'abierta' || n.status === 'en_proceso') && (
                      <button
                        className="ibtn"
                        style={{ width: 28, height: 28, color: 'var(--grnd)' }}
                        data-tip="Cerrar"
                        disabled={pending}
                        onClick={() => changeNcStatus(n.id, 'cerrada')}
                        aria-label="Cerrar no conformidad"
                      >
                        <Check size={13} />
                      </button>
                    )}
                    {n.status === 'cerrada' && (
                      <button
                        className="ibtn"
                        style={{ width: 28, height: 28, color: 'var(--amb)' }}
                        data-tip="Reabrir"
                        disabled={pending}
                        onClick={() => changeNcStatus(n.id, 'abierta')}
                        aria-label="Reabrir no conformidad"
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}
                    <button
                      className="ibtn"
                      style={{ width: 28, height: 28, color: 'var(--redd)' }}
                      data-tip="Eliminar"
                      disabled={pending}
                      onClick={() => removeNc(n.id)}
                      aria-label="Eliminar no conformidad"
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
