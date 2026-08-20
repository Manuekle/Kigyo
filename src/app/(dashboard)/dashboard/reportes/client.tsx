'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2 } from '@/lib/icons'
import Select from '@/components/ui/Select'
import { useApp } from '@/lib/context/AppContext'
import { MODULE_LABELS } from '@/lib/auth/permissions'
import { moduleDef } from '@/lib/modules'
import type { ReportesData } from '@/server/queries/reportes'
import { deleteReport, saveReport } from '@/server/mutations/reportes'

const DAY = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtDate = (iso: string) => DAY.format(new Date(iso))

const PERIOD_LABEL: Record<string, string> = {
  hoy: 'Hoy',
  semana: 'Semana',
  mes: 'Mes',
  trimestre: 'Trimestre',
  todo: 'Todo',
}
const PERIOD_OPTS = [
  { value: 'hoy', label: 'Hoy' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mes' },
  { value: 'trimestre', label: 'Trimestre' },
  { value: 'todo', label: 'Todo' },
]

/** Etiqueta del módulo: el nombre de permiso, el catálogo, o la clave. */
function moduleLabel(key: string): string {
  return MODULE_LABELS[key] ?? moduleDef(key)?.label ?? key
}

const EMPTY_FORM = { name: '', moduleKey: '', period: 'mes', notes: '' }

export default function ReportesPage({ data }: { data: ReportesData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState(data)
  const [form, setForm] = useState(EMPTY_FORM)

  const moduleOpts = state.moduleOptions.map((key) => ({ value: key, label: moduleLabel(key) }))

  function submitReport() {
    startTransition(async () => {
      const result = await saveReport({
        name: form.name,
        moduleKey: form.moduleKey,
        period: form.period as 'hoy' | 'semana' | 'mes' | 'trimestre' | 'todo',
        notes: form.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Reporte guardado', 'ok')
      setForm({ ...EMPTY_FORM, period: 'mes' })
    })
  }

  function removeReport(id: string, name: string) {
    if (!window.confirm(`¿Eliminar el reporte "${name}"?`)) return
    startTransition(async () => {
      const result = await deleteReport(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Reporte eliminado', 'ok')
    })
  }

  return (
    <>
      <div className="card rise d1">
        <div className="chead">
          <div className="ctitle">Guardar reporte</div>
        </div>

        <div className="cpad">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 200px', minWidth: 160 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Nombre</div>
              <input
                className="field"
                value={form.name}
                maxLength={80}
                placeholder="Ej: ventas de la semana"
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div style={{ flex: '0 1 180px', minWidth: 140 }}>
              <div className="flabel">Módulo</div>
              <Select
                value={form.moduleKey}
                onChange={(v) => setForm((f) => ({ ...f, moduleKey: v }))}
                options={moduleOpts}
              />
            </div>
            <div style={{ flex: '0 1 150px', minWidth: 120 }}>
              <div className="flabel">Periodo</div>
              <Select
                value={form.period}
                onChange={(v) => setForm((f) => ({ ...f, period: v }))}
                options={PERIOD_OPTS}
              />
            </div>
            <div style={{ flex: '1 1 200px', minWidth: 160 }}>
              <div className="flabel">Nota</div>
              <input
                className="field"
                value={form.notes}
                maxLength={500}
                placeholder="Ej: para el cierre semanal"
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <button
              className="btn dark"
              disabled={pending || form.name.trim().length < 2 || !form.moduleKey}
              aria-busy={pending}
              onClick={submitReport}
            >
              <Plus size={14} />Guardar
            </button>
          </div>
        </div>
      </div>

      <div className="card rise d2" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Reportes guardados</div>
        </div>

        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Módulo</th>
                <th scope="col">Periodo</th>
                <th scope="col">Nota</th>
                <th scope="col">Fecha</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {state.reports.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      Sin reportes guardados.
                    </div>
                  </td>
                </tr>
              ) : state.reports.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="cename">{r.name}</div>
                  </td>
                  <td className="muted">{moduleLabel(r.moduleKey)}</td>
                  <td className="muted">{PERIOD_LABEL[r.period] ?? r.period}</td>
                  <td className="muted">{r.notes || '—'}</td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{fmtDate(r.createdAt)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      className="ibtn"
                      style={{ width: 28, height: 28, color: 'var(--redd)' }}
                      data-tip="Eliminar"
                      disabled={pending}
                      onClick={() => removeReport(r.id, r.name)}
                      aria-label={`Eliminar el reporte ${r.name}`}
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
