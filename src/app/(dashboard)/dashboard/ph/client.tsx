'use client'

import { useState, useTransition } from 'react'
import { Apartment, Check, Plus, RotateCcw, Trash2, Wrench } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import DatePicker from '@/components/ui/DatePicker'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import { useApp } from '@/lib/context/AppContext'
import { cop } from '@/lib/utils'
import type { StatusTone } from '@/lib/types'
import type { PhData } from '@/server/queries/ph'
import {
  addAsamblea,
  addCuota,
  addZona,
  deleteAsamblea,
  deleteCuota,
  deleteZona,
  setAsambleaEstado,
  setCuotaPagada,
  setZonaEstado,
} from '@/server/mutations/ph'

// La fecha llega como 'YYYY-MM-DD' (columna date). Se formatea en UTC para que
// la zona local no desplace el día un día atrás.
const DATE_FMT = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const fmtDate = (d: string) => DATE_FMT.format(new Date(`${d}T00:00:00Z`))

const ASAMBLEA_TONE: Record<string, StatusTone> = {
  convocada: 'amb',
  realizada: 'blu',
  acta_firmada: 'grn',
}
const ASAMBLEA_LABEL: Record<string, string> = {
  convocada: 'Convocada',
  realizada: 'Realizada',
  acta_firmada: 'Acta firmada',
}
const ASAMBLEA_NEXT: Record<string, string | null> = {
  convocada: 'realizada',
  realizada: 'acta_firmada',
  acta_firmada: null,
}
const ASAMBLEA_NEXT_LABEL: Record<string, string> = {
  convocada: 'Realizada',
  realizada: 'Firmar acta',
}

const ZONA_TONE: Record<string, StatusTone> = {
  operativa: 'grn',
  mantenimiento: 'amb',
  cerrada: 'neu',
}
const ZONA_LABEL: Record<string, string> = {
  operativa: 'Operativa',
  mantenimiento: 'Mantenimiento',
  cerrada: 'Cerrada',
}

const TIPO_LABEL: Record<string, string> = {
  salon: 'Salón',
  piscina: 'Piscina',
  gimnasio: 'Gimnasio',
  parqueadero: 'Parqueadero',
  otro: 'Otro',
}

type AsamForm = { fecha: string; tema: string; tipo: 'ordinaria' | 'extraordinaria' }
type CuotaForm = {
  unidad: string; periodo: string; tipo: 'ordinaria' | 'extraordinaria'
  monto: string; vence: string
}
type ZonaForm = {
  name: string
  tipo: 'salon' | 'piscina' | 'gimnasio' | 'parqueadero' | 'otro'
  notas: string
}

const EMPTY_ASAM: AsamForm = { fecha: '', tema: '', tipo: 'ordinaria' }
const EMPTY_CUOTA: CuotaForm = { unidad: '', periodo: '', tipo: 'ordinaria', monto: '', vence: '' }
const EMPTY_ZONA: ZonaForm = { name: '', tipo: 'otro', notas: '' }

export default function PhPage({ data }: { data: PhData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState(data)
  const [asamForm, setAsamForm] = useState(EMPTY_ASAM)
  const [cuotaForm, setCuotaForm] = useState(EMPTY_CUOTA)
  const [zonaForm, setZonaForm] = useState(EMPTY_ZONA)

  const tipoAsamOpts = [
    { value: 'ordinaria', label: 'Ordinaria' },
    { value: 'extraordinaria', label: 'Extraordinaria' },
  ]
  const tipoCuotaOpts = [
    { value: 'ordinaria', label: 'Ordinaria' },
    { value: 'extraordinaria', label: 'Extraordinaria' },
  ]
  const tipoZonaOpts = [
    { value: 'salon', label: 'Salón' },
    { value: 'piscina', label: 'Piscina' },
    { value: 'gimnasio', label: 'Gimnasio' },
    { value: 'parqueadero', label: 'Parqueadero' },
    { value: 'otro', label: 'Otro' },
  ]

  function submitAsam() {
    startTransition(async () => {
      const result = await addAsamblea({
        fecha: asamForm.fecha,
        tema: asamForm.tema,
        tipo: asamForm.tipo,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Asamblea convocada', 'ok')
      setAsamForm(EMPTY_ASAM)
    })
  }

  function submitCuota() {
    startTransition(async () => {
      const result = await addCuota({
        unidad: cuotaForm.unidad,
        periodo: cuotaForm.periodo,
        tipo: cuotaForm.tipo,
        monto: cuotaForm.monto,
        ...(cuotaForm.vence ? { vence: cuotaForm.vence } : {}),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Cuota registrada', 'ok')
      setCuotaForm(EMPTY_CUOTA)
    })
  }

  function submitZona() {
    startTransition(async () => {
      const result = await addZona({
        name: zonaForm.name,
        tipo: zonaForm.tipo,
        notas: zonaForm.notas,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Zona registrada', 'ok')
      setZonaForm(EMPTY_ZONA)
    })
  }

  function changeAsamEstado(id: string, estado: string) {
    startTransition(async () => {
      const result = await setAsambleaEstado(id, estado)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Estado actualizado', 'ok')
    })
  }

  function changeCuotaPagada(id: string, pagada: boolean) {
    startTransition(async () => {
      const result = await setCuotaPagada(id, pagada)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast(pagada ? 'Cuota marcada como pagada' : 'Cuota de vuelta a pendiente', 'ok')
    })
  }

  function changeZonaEstado(id: string, estado: string) {
    startTransition(async () => {
      const result = await setZonaEstado(id, estado)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Estado actualizado', 'ok')
    })
  }

  function removeAsam(id: string) {
    if (!window.confirm('¿Eliminar esta asamblea?')) return
    startTransition(async () => {
      const result = await deleteAsamblea(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Asamblea eliminada', 'ok')
    })
  }

  function removeCuota(id: string) {
    if (!window.confirm('¿Eliminar esta cuota?')) return
    startTransition(async () => {
      const result = await deleteCuota(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Cuota eliminada', 'ok')
    })
  }

  function removeZona(id: string) {
    if (!window.confirm('¿Eliminar esta zona?')) return
    startTransition(async () => {
      const result = await deleteZona(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Zona eliminada', 'ok')
    })
  }

  return (
    <>
      <div className="g3 g3--few" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat
            icon={<Apartment size={16} />}
            tone={state.pendientesCount > 0 ? 'amb' : 'grn'}
            label="Cuotas pendientes"
            value={state.pendientesCount}
            sub="Por cobrar"
          />
        </div>
        <div className="rise d2">
          <Stat
            icon={<Apartment size={16} />}
            tone="neu"
            label="Monto pendiente"
            value={cop(state.montoPendiente)}
            sub="Suma de lo que se debe"
          />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <div className="ctitle">Convocar asamblea</div>
        </div>

        <div className="cpad" style={{ paddingBottom: 0 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 200px', minWidth: 170 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Tema</div>
              <input
                className="field"
                value={asamForm.tema}
                maxLength={160}
                placeholder="Ej: Presupuesto 2027"
                onChange={(e) => setAsamForm((f) => ({ ...f, tema: e.target.value }))}
              />
            </div>
            <div style={{ flex: '0 1 150px', minWidth: 130 }}>
              <div className="flabel">Fecha</div>
              <DatePicker
                ariaLabel="Fecha"
                value={asamForm.fecha}
                onChange={(v) => setAsamForm((f) => ({ ...f, fecha: v }))}
              />
            </div>
            <div style={{ flex: '0 1 160px', minWidth: 130 }}>
              <div className="flabel">Tipo</div>
              <Select
                value={asamForm.tipo}
                onChange={(v) => setAsamForm((f) => ({ ...f, tipo: v as AsamForm['tipo'] }))}
                options={tipoAsamOpts}
              />
            </div>
            <button
              className="btn dark"
              disabled={pending || asamForm.tema.trim().length < 2 || !asamForm.fecha}
              aria-busy={pending}
              onClick={submitAsam}
            >
              <Plus size={14} />Convocar
            </button>
          </div>
        </div>

        <div className="tblwrap" style={{ marginTop: 12 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Tema</th>
                <th scope="col">Fecha</th>
                <th scope="col">Tipo</th>
                <th scope="col">Estado</th>
                <th scope="col">Asistentes</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {state.asambleas.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="dempty" style={{ padding: '18px 0', textAlign: 'center' }}>
                      Sin asambleas.
                    </div>
                  </td>
                </tr>
              ) : state.asambleas.map((a) => (
                <tr key={a.id}>
                  <td><div className="cename">{a.tema}</div></td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{fmtDate(a.fecha)}</td>
                  <td className="muted">{a.tipo === 'ordinaria' ? 'Ordinaria' : 'Extraordinaria'}</td>
                  <td><Badge st={ASAMBLEA_LABEL[a.estado]} tone={ASAMBLEA_TONE[a.estado]} /></td>
                  <td className="muted">{a.asistentes}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {ASAMBLEA_NEXT[a.estado] && (
                      <button
                        className="btn ghost"
                        disabled={pending}
                        onClick={() => changeAsamEstado(a.id, ASAMBLEA_NEXT[a.estado] as string)}
                      >
                        {ASAMBLEA_NEXT_LABEL[a.estado]}
                      </button>
                    )}
                    <button
                      className="ibtn"
                      style={{ width: 28, height: 28, color: 'var(--redd)' }}
                      data-tip="Eliminar"
                      disabled={pending}
                      onClick={() => removeAsam(a.id)}
                      aria-label={`Eliminar asamblea ${a.tema}`}
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
          <div className="ctitle">Registrar cuota</div>
        </div>

        <div className="cpad" style={{ paddingBottom: 0 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 140px', minWidth: 110 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Unidad</div>
              <input
                className="field"
                value={cuotaForm.unidad}
                maxLength={40}
                placeholder="Ej: Apto 301"
                onChange={(e) => setCuotaForm((f) => ({ ...f, unidad: e.target.value }))}
              />
            </div>
            <div style={{ flex: '1 1 140px', minWidth: 110 }}>
              <div className="flabel">Periodo</div>
              <input
                className="field"
                value={cuotaForm.periodo}
                maxLength={20}
                placeholder="Ej: 2026-08"
                onChange={(e) => setCuotaForm((f) => ({ ...f, periodo: e.target.value }))}
              />
            </div>
            <div style={{ flex: '0 1 150px', minWidth: 120 }}>
              <div className="flabel">Tipo</div>
              <Select
                value={cuotaForm.tipo}
                onChange={(v) => setCuotaForm((f) => ({ ...f, tipo: v as CuotaForm['tipo'] }))}
                options={tipoCuotaOpts}
              />
            </div>
            <div style={{ flex: '0 1 150px', minWidth: 120 }}>
              <div className="flabel">Monto</div>
              <input
                type="number"
                min={0}
                step="0.01"
                className="field"
                value={cuotaForm.monto}
                placeholder="0"
                onChange={(e) => setCuotaForm((f) => ({ ...f, monto: e.target.value }))}
              />
            </div>
            <div style={{ flex: '0 1 150px', minWidth: 130 }}>
              <div className="flabel">Vence</div>
              <DatePicker
                ariaLabel="Vence"
                value={cuotaForm.vence}
                onChange={(v) => setCuotaForm((f) => ({ ...f, vence: v }))}
              />
            </div>
            <button
              className="btn dark"
              disabled={pending || cuotaForm.unidad.trim().length < 2 || cuotaForm.periodo.trim().length < 2}
              aria-busy={pending}
              onClick={submitCuota}
            >
              <Plus size={14} />Registrar cuota
            </button>
          </div>
        </div>

        <div className="tblwrap" style={{ marginTop: 12 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Unidad</th>
                <th scope="col">Periodo</th>
                <th scope="col">Tipo</th>
                <th scope="col">Monto</th>
                <th scope="col">Estado</th>
                <th scope="col">Vence</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {state.cuotas.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="dempty" style={{ padding: '18px 0', textAlign: 'center' }}>
                      Sin cuotas.
                    </div>
                  </td>
                </tr>
              ) : state.cuotas.map((c) => (
                <tr key={c.id}>
                  <td><div className="cename">{c.unidad}</div></td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{c.periodo}</td>
                  <td className="muted">{c.tipo === 'ordinaria' ? 'Ordinaria' : 'Extraordinaria'}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{cop(c.monto)}</td>
                  <td>
                    <Badge st={c.estado === 'pagada' ? 'Pagada' : 'Pendiente'} tone={c.estado === 'pagada' ? 'grn' : 'amb'} />
                  </td>
                  <td className="muted mono" style={{ fontSize: 12 }}>
                    {c.vence ? fmtDate(c.vence) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {c.estado === 'pendiente' ? (
                      <button
                        className="ibtn"
                        style={{ width: 28, height: 28, color: 'var(--grnd)' }}
                        data-tip="Marcar pagada"
                        disabled={pending}
                        onClick={() => changeCuotaPagada(c.id, true)}
                        aria-label={`Marcar pagada cuota ${c.unidad} ${c.periodo}`}
                      >
                        <Check size={13} />
                      </button>
                    ) : (
                      <button
                        className="ibtn"
                        style={{ width: 28, height: 28, color: 'var(--amb)' }}
                        data-tip="Volver a pendiente"
                        disabled={pending}
                        onClick={() => changeCuotaPagada(c.id, false)}
                        aria-label={`Volver a pendiente cuota ${c.unidad} ${c.periodo}`}
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}
                    <button
                      className="ibtn"
                      style={{ width: 28, height: 28, color: 'var(--redd)' }}
                      data-tip="Eliminar"
                      disabled={pending}
                      onClick={() => removeCuota(c.id)}
                      aria-label={`Eliminar cuota ${c.unidad} ${c.periodo}`}
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
          <div className="ctitle">Registrar zona común</div>
        </div>

        <div className="cpad" style={{ paddingBottom: 0 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 200px', minWidth: 170 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Nombre</div>
              <input
                className="field"
                value={zonaForm.name}
                maxLength={120}
                placeholder="Ej: Piscina adultos"
                onChange={(e) => setZonaForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div style={{ flex: '0 1 160px', minWidth: 130 }}>
              <div className="flabel">Tipo</div>
              <Select
                value={zonaForm.tipo}
                onChange={(v) => setZonaForm((f) => ({ ...f, tipo: v as ZonaForm['tipo'] }))}
                options={tipoZonaOpts}
              />
            </div>
            <div style={{ flex: '1 1 180px', minWidth: 150 }}>
              <div className="flabel">Nota</div>
              <input
                className="field"
                value={zonaForm.notas}
                maxLength={500}
                placeholder="Ej: reserva con recepción"
                onChange={(e) => setZonaForm((f) => ({ ...f, notas: e.target.value }))}
              />
            </div>
            <button
              className="btn dark"
              disabled={pending || zonaForm.name.trim().length < 2}
              aria-busy={pending}
              onClick={submitZona}
            >
              <Plus size={14} />Registrar zona
            </button>
          </div>
        </div>

        <div className="tblwrap" style={{ marginTop: 12 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Zona</th>
                <th scope="col">Tipo</th>
                <th scope="col">Estado</th>
                <th scope="col">Nota</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {state.zonas.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="dempty" style={{ padding: '18px 0', textAlign: 'center' }}>
                      Sin zonas comunes.
                    </div>
                  </td>
                </tr>
              ) : state.zonas.map((z) => (
                <tr key={z.id}>
                  <td><div className="cename">{z.name}</div></td>
                  <td className="muted">{TIPO_LABEL[z.tipo] ?? z.tipo}</td>
                  <td><Badge st={ZONA_LABEL[z.estado]} tone={ZONA_TONE[z.estado]} /></td>
                  <td className="muted">{z.notas ?? '—'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {z.estado === 'operativa' && (
                      <button
                        className="ibtn"
                        style={{ width: 28, height: 28, color: 'var(--amb)' }}
                        data-tip="A mantenimiento"
                        disabled={pending}
                        onClick={() => changeZonaEstado(z.id, 'mantenimiento')}
                        aria-label={`A mantenimiento ${z.name}`}
                      >
                        <Wrench size={13} />
                      </button>
                    )}
                    {z.estado !== 'operativa' && (
                      <button
                        className="ibtn"
                        style={{ width: 28, height: 28, color: 'var(--grnd)' }}
                        data-tip="Reabrir"
                        disabled={pending}
                        onClick={() => changeZonaEstado(z.id, 'operativa')}
                        aria-label={`Reabrir ${z.name}`}
                      >
                        <Check size={13} />
                      </button>
                    )}
                    <button
                      className="ibtn"
                      style={{ width: 28, height: 28, color: 'var(--redd)' }}
                      data-tip="Eliminar"
                      disabled={pending}
                      onClick={() => removeZona(z.id)}
                      aria-label={`Eliminar zona ${z.name}`}
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
