'use client'

import { useState, useTransition } from 'react'
import {
  Activity,
  Check,
  Plus,
  RotateCcw,
  ShieldAlert,
  Trash2,
  XCircle,
} from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import DatePicker from '@/components/ui/DatePicker'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import { useApp } from '@/lib/context/AppContext'
import { useConfirm } from '@/lib/context/ConfirmContext'
import type { StatusTone } from '@/lib/types'
import type { PuestosData } from '@/server/queries/puestos'
import {
  addPost,
  addShift,
  deletePost,
  deleteShift,
  setPostActive,
  setShiftStatus,
} from '@/server/mutations/puestos'

const SHIFT_FMT = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})
const fmtShift = (iso: string) => SHIFT_FMT.format(new Date(iso))

const SHIFT_TONE: Record<string, StatusTone> = {
  programado: 'blu',
  en_curso: 'amb',
  completado: 'grn',
  cancelado: 'red',
}
const shiftTone = (st: string): StatusTone => SHIFT_TONE[st] ?? 'neu'
const shiftLabel = (st: string) => st.replace('_', ' ')

const EMPTY_POST = { name: '', clientId: '', address: '', notes: '' }
const EMPTY_SHIFT = { postId: '', employeeId: '', startsAt: '', endsAt: '', notes: '' }

export default function PuestosPage({ data }: { data: PuestosData }) {
  const { addToast } = useApp()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState(data)
  const [postForm, setPostForm] = useState(EMPTY_POST)
  const [shiftForm, setShiftForm] = useState(EMPTY_SHIFT)

  const clientOpts = [
    { value: '', label: 'Sin cliente' },
    ...state.clients.map((c) => ({ value: c.id, label: c.name })),
  ]
  const postOpts = state.posts.map((p) => ({ value: p.id, label: p.name }))
  const employeeOpts = [
    { value: '', label: 'Sin asignar' },
    ...state.employees.map((e) => ({ value: e.id, label: e.fullName })),
  ]

  function submitPost() {
    startTransition(async () => {
      const result = await addPost({
        name: postForm.name,
        clientId: postForm.clientId || null,
        address: postForm.address,
        notes: postForm.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Puesto añadido', 'ok')
      setPostForm(EMPTY_POST)
    })
  }

  async function removePost(id: string, name: string) {
    if (!(await confirm({ title: `¿Eliminar ${name}?`, description: 'Sus turnos se eliminan también.', tone: 'danger' }))) return
    startTransition(async () => {
      const result = await deletePost(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Puesto eliminado', 'ok')
    })
  }

  function toggleActive(id: string, active: boolean) {
    startTransition(async () => {
      const result = await setPostActive(id, !active)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Estado actualizado', 'ok')
    })
  }

  function submitShift() {
    startTransition(async () => {
      // datetime-local entrega 'YYYY-MM-DDTHH:mm' (hora local, sin zona); el
      // servidor guarda timestamptz, así que se convierte a ISO antes de enviar.
      const startsAt = new Date(shiftForm.startsAt).toISOString()
      const endsAt = new Date(shiftForm.endsAt).toISOString()
      const result = await addShift({
        postId: shiftForm.postId,
        employeeId: shiftForm.employeeId || null,
        startsAt,
        endsAt,
        notes: shiftForm.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Turno añadido', 'ok')
      setShiftForm(EMPTY_SHIFT)
    })
  }

  function changeShiftStatus(id: string, status: string) {
    startTransition(async () => {
      const result = await setShiftStatus(id, status)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Estado actualizado', 'ok')
    })
  }

  async function removeShift(id: string) {
    if (!(await confirm({ title: '¿Eliminar este turno?', tone: 'danger' }))) return
    startTransition(async () => {
      const result = await deleteShift(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Turno eliminado', 'ok')
    })
  }

  return (
    <>
      <div className="g3 g3--few" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat
            icon={<ShieldAlert size={16} />}
            tone={state.vacantesCount > 0 ? 'amb' : 'grn'}
            label="Vacantes por cubrir"
            value={state.vacantesCount}
            sub="Turnos programados sin guarda"
          />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <div className="ctitle">Nuevo puesto</div>
        </div>

        <div className="cpad">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 160px', minWidth: 130 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Nombre</div>
              <input
                className="field"
                value={postForm.name}
                maxLength={120}
                placeholder="Ej: Portería principal"
                onChange={(e) => setPostForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div style={{ flex: '1 1 150px', minWidth: 120 }}>
              <div className="flabel">Cliente</div>
              <Select
                value={postForm.clientId}
                onChange={(v) => setPostForm((f) => ({ ...f, clientId: v }))}
                options={clientOpts}
              />
            </div>
            <div style={{ flex: '1 1 180px', minWidth: 150 }}>
              <div className="flabel">Dirección</div>
              <input
                className="field"
                value={postForm.address}
                maxLength={200}
                placeholder="Ej: Carrera 12 # 34-56"
                onChange={(e) => setPostForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div style={{ flex: '1 1 180px', minWidth: 150 }}>
              <div className="flabel">Nota</div>
              <input
                className="field"
                value={postForm.notes}
                maxLength={500}
                placeholder="Ej: portería peatonal"
                onChange={(e) => setPostForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <button
              className="btn dark"
              disabled={pending || postForm.name.trim().length < 2}
              aria-busy={pending}
              onClick={submitPost}
            >
              <Plus size={14} />Añadir puesto
            </button>
          </div>
        </div>
      </div>

      <div className="card rise d3" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Puestos</div>
        </div>

        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Cliente</th>
                <th scope="col">Dirección</th>
                <th scope="col">Estado</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {state.posts.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="dempty dempty-block">
                      Sin puestos.
                    </div>
                  </td>
                </tr>
              ) : state.posts.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="cename">{p.name}</div>
                    {p.notes && (
                      <div className="muted" style={{ fontSize: 12 }}>{p.notes}</div>
                    )}
                  </td>
                  <td className="muted">{p.clientName ?? 'Sin cliente'}</td>
                  <td className="muted">{p.address ?? '—'}</td>
                  <td>
                    <Badge st={p.isActive ? 'Activo' : 'Inactivo'} tone={p.isActive ? 'grn' : 'neu'} />
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {p.isActive && (
                      <button
                        className="ibtn"
                        style={{ width: 28, height: 28 }}
                        data-tip="Desactivar"
                        disabled={pending}
                        onClick={() => toggleActive(p.id, p.isActive)}
                        aria-label={`Desactivar ${p.name}`}
                      >
                        <XCircle size={13} />
                      </button>
                    )}
                    {!p.isActive && (
                      <button
                        className="ibtn"
                        style={{ width: 28, height: 28, color: 'var(--grnd)' }}
                        data-tip="Reactivar"
                        disabled={pending}
                        onClick={() => toggleActive(p.id, p.isActive)}
                        aria-label={`Reactivar ${p.name}`}
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}
                    <button
                      className="ibtn"
                      style={{ width: 28, height: 28, color: 'var(--redd)' }}
                      data-tip="Eliminar"
                      disabled={pending}
                      onClick={() => removePost(p.id, p.name)}
                      aria-label={`Eliminar ${p.name}`}
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
          <div className="ctitle">Nuevo turno</div>
        </div>

        <div className="cpad">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 160px', minWidth: 130 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Puesto</div>
              <Select
                value={shiftForm.postId}
                onChange={(v) => setShiftForm((f) => ({ ...f, postId: v }))}
                options={postOpts}
              />
            </div>
            <div style={{ flex: '1 1 160px', minWidth: 130 }}>
              <div className="flabel">Guarda</div>
              <Select
                value={shiftForm.employeeId}
                onChange={(v) => setShiftForm((f) => ({ ...f, employeeId: v }))}
                options={employeeOpts}
              />
            </div>
            <div style={{ flex: '0 1 190px', minWidth: 170 }}>
              <div className="flabel">Inicio</div>
              <DatePicker
                withTime
                ariaLabel="Inicio"
                value={shiftForm.startsAt}
                onChange={(v) => setShiftForm((f) => ({ ...f, startsAt: v }))}
              />
            </div>
            <div style={{ flex: '0 1 190px', minWidth: 170 }}>
              <div className="flabel">Fin</div>
              <DatePicker
                withTime
                ariaLabel="Fin"
                value={shiftForm.endsAt}
                onChange={(v) => setShiftForm((f) => ({ ...f, endsAt: v }))}
              />
            </div>
            <div style={{ flex: '1 1 180px', minWidth: 150 }}>
              <div className="flabel">Nota</div>
              <input
                className="field"
                value={shiftForm.notes}
                maxLength={500}
                placeholder="Ej: turno nocturno"
                onChange={(e) => setShiftForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <button
              className="btn dark"
              disabled={pending || !shiftForm.postId || !shiftForm.startsAt || !shiftForm.endsAt}
              aria-busy={pending}
              onClick={submitShift}
            >
              <Plus size={14} />Añadir turno
            </button>
          </div>
        </div>
      </div>

      <div className="card rise d5" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Turnos</div>
        </div>

        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Puesto</th>
                <th scope="col">Guarda</th>
                <th scope="col">Inicio</th>
                <th scope="col">Fin</th>
                <th scope="col">Estado</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {state.shifts.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="dempty dempty-block">
                      Sin turnos.
                    </div>
                  </td>
                </tr>
              ) : state.shifts.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="cename">{s.postName}</div>
                    {s.notes && (
                      <div className="muted" style={{ fontSize: 12 }}>{s.notes}</div>
                    )}
                  </td>
                  <td>
                    {s.employeeName ? (
                      s.employeeName
                    ) : (
                      <span className="muted">Sin asignar</span>
                    )}
                  </td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{fmtShift(s.startsAt)}</td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{fmtShift(s.endsAt)}</td>
                  <td><Badge st={shiftLabel(s.status)} tone={shiftTone(s.status)} /></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {s.status === 'programado' && (
                      <button
                        className="ibtn"
                        style={{ width: 28, height: 28 }}
                        data-tip="Iniciar"
                        disabled={pending}
                        onClick={() => changeShiftStatus(s.id, 'en_curso')}
                        aria-label={`Iniciar turno en ${s.postName}`}
                      >
                        <Activity size={13} />
                      </button>
                    )}
                    {(s.status === 'programado' || s.status === 'en_curso') && (
                      <button
                        className="ibtn"
                        style={{ width: 28, height: 28, color: 'var(--grnd)' }}
                        data-tip="Completar"
                        disabled={pending}
                        onClick={() => changeShiftStatus(s.id, 'completado')}
                        aria-label={`Completar turno en ${s.postName}`}
                      >
                        <Check size={13} />
                      </button>
                    )}
                    {(s.status === 'programado' || s.status === 'en_curso') && (
                      <button
                        className="ibtn"
                        style={{ width: 28, height: 28, color: 'var(--amb)' }}
                        data-tip="Cancelar"
                        disabled={pending}
                        onClick={() => changeShiftStatus(s.id, 'cancelado')}
                        aria-label={`Cancelar turno en ${s.postName}`}
                      >
                        <XCircle size={13} />
                      </button>
                    )}
                    <button
                      className="ibtn"
                      style={{ width: 28, height: 28, color: 'var(--redd)' }}
                      data-tip="Eliminar"
                      disabled={pending}
                      onClick={() => removeShift(s.id)}
                      aria-label={`Eliminar turno en ${s.postName}`}
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
