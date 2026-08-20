'use client'

import { useState, useTransition } from 'react'
import { Check, Clock, Trash2 } from '@/lib/icons'
import Avatar from '@/components/ui/Avatar'
import DatePicker from '@/components/ui/DatePicker'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import { useApp } from '@/lib/context/AppContext'
import { cop } from '@/lib/utils'
import type { TiemposData } from '@/server/queries/tiempos'
import { addTimeEntry, deleteTimeEntry } from '@/server/mutations/tiempos'

const DAY = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtDate = (iso: string) => DAY.format(new Date(`${iso}T00:00:00`))
const todayIso = () => new Date().toISOString().slice(0, 10)

/** «2h 30m» — o «45m» cuando no llega a la hora. */
function fmtMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** «X horas Y minutos en total», con los plurales que tocan. */
function totalLabel(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} ${m === 1 ? 'minuto' : 'minutos'} en total`
  const hs = `${h} ${h === 1 ? 'hora' : 'horas'}`
  return m === 0 ? `${hs} en total` : `${hs} y ${m} ${m === 1 ? 'minuto' : 'minutos'} en total`
}

const EMPTY_FORM = {
  employeeId: '',
  projectId: '',
  workDate: todayIso(),
  minutes: '60',
  rate: '',
  notes: '',
}

export default function TiemposPage({ data }: { data: TiemposData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState(data)
  const [form, setForm] = useState(EMPTY_FORM)

  const employeeOpts = state.employees.map((e) => ({ value: e.employeeId, label: e.fullName }))
  const projectOpts = state.projects.map((p) => ({
    value: p.id,
    label: p.code ? `${p.code} · ${p.name}` : p.name,
  }))

  function submit() {
    startTransition(async () => {
      const result = await addTimeEntry({
        employeeId: form.employeeId || null,
        projectId: form.projectId || null,
        workDate: form.workDate,
        minutes: Number(form.minutes),
        rateCents: form.rate.trim() ? Math.round(Number(form.rate) * 100) : null,
        notes: form.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Horas registradas', 'ok')
      // Persona y proyecto se quedan: quien anota suele hacer varias filas
      // seguidas de lo mismo. Fecha, minutos, tarifa y nota vuelven a cero.
      setForm((f) => ({ ...f, workDate: todayIso(), minutes: '60', rate: '', notes: '' }))
    })
  }

  function remove(id: string) {
    if (!window.confirm('¿Eliminar esta entrada?')) return
    startTransition(async () => {
      const result = await deleteTimeEntry(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Entrada eliminada', 'ok')
    })
  }

  return (
    <>
      <div className="g2" style={{ marginBottom: 16 }}>
        <div className="card cpad rise d1">
          <div className="ctitle" style={{ marginBottom: 12 }}>Registrar horas</div>

          <div className="flabel" style={{ marginTop: 0 }}>Empleado</div>
          <Select
            value={form.employeeId}
            onChange={(v) => setForm((f) => ({ ...f, employeeId: v }))}
            placeholder="Sin empleado"
            options={employeeOpts}
          />

          <div className="flabel">Proyecto</div>
          <Select
            value={form.projectId}
            onChange={(v) => setForm((f) => ({ ...f, projectId: v }))}
            placeholder="Sin proyecto"
            options={projectOpts}
          />

          <div className="fg2">
            <div>
              <div className="flabel">Fecha</div>
              <DatePicker
                ariaLabel="Fecha"
                value={form.workDate}
                onChange={(v) => setForm((f) => ({ ...f, workDate: v }))}
              />
            </div>
            <div>
              <div className="flabel">Minutos</div>
              <input
                type="number"
                className="field"
                min={1}
                max={1440}
                value={form.minutes}
                onChange={(e) => setForm((f) => ({ ...f, minutes: e.target.value }))}
              />
            </div>
          </div>

          <div className="flabel">Tarifa</div>
          <input
            className="field"
            inputMode="numeric"
            value={form.rate}
            placeholder="50000"
            onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
          />
          <p className="psub" style={{ fontSize: 12.5 }}>
            En pesos, opcional — lo que se cobrará por una hora de este trabajo.
          </p>

          <div className="flabel">Nota</div>
          <input
            className="field"
            value={form.notes}
            maxLength={1000}
            placeholder="Ej: Montaje de estantería"
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button
              className="btn dark"
              disabled={pending || !form.workDate || !form.minutes}
              aria-busy={pending}
              onClick={submit}
            >
              <Check size={15} />{pending ? 'Registrando…' : 'Registrar'}
            </button>
          </div>
        </div>

        <div className="rise d2">
          <Stat
            icon={<Clock size={16} />}
            tone="blu"
            label="Tiempo en total"
            value={fmtMinutes(state.totalMinutes)}
            sub={totalLabel(state.totalMinutes)}
          />
        </div>
      </div>

      <div className="card rise d3">
        <div className="chead">
          <div className="ctitle">Horas registradas</div>
        </div>
        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Empleado</th>
                <th scope="col">Proyecto</th>
                <th scope="col">Fecha</th>
                <th scope="col">Tiempo</th>
                <th scope="col">Tarifa</th>
                <th scope="col">Nota</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {state.entries.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      Todavía no hay horas registradas.
                    </div>
                  </td>
                </tr>
              ) : state.entries.map((e) => (
                <tr key={e.id}>
                  <td>
                    {e.employeeName ? (
                      <div className="cemp">
                        <Avatar name={e.employeeName} size={26} />
                        <div className="cename">{e.employeeName}</div>
                      </div>
                    ) : (
                      <span className="muted">Sin empleado</span>
                    )}
                  </td>
                  <td className="muted">{e.projectName ?? 'Sin proyecto'}</td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{fmtDate(e.workDate)}</td>
                  <td className="mono">{fmtMinutes(e.minutes)}</td>
                  <td>{e.rateCents === null ? '—' : cop(Math.round(e.rateCents / 100))}</td>
                  <td className="muted">{e.notes ?? '—'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      className="ibtn"
                      style={{ width: 28, height: 28, color: 'var(--redd)' }}
                      data-tip="Eliminar"
                      disabled={pending}
                      onClick={() => remove(e.id)}
                      aria-label="Eliminar esta entrada"
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
