'use client'

import { useState, useTransition } from 'react'
import { Contracts, Plus, Trash2, X } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import DatePicker from '@/components/ui/DatePicker'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import Toggle from '@/components/ui/Toggle'
import { useApp } from '@/lib/context/AppContext'
import { useConfirm } from '@/lib/context/ConfirmContext'
import { cop } from '@/lib/utils'
import type { StatusTone } from '@/lib/types'
import type { ContratacionData } from '@/server/queries/contratacion'
import {
  addOferente,
  addPliego,
  addProceso,
  deleteOferente,
  deletePliego,
  deleteProceso,
  setOferenteEstado,
  setProcesoEstado,
} from '@/server/mutations/contratacion'

const DATE_FMT = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const fmtDate = (d: string) => DATE_FMT.format(new Date(`${d}T00:00:00Z`))

const PROCESO_TONE: Record<string, StatusTone> = {
  borrador: 'amb',
  publicado: 'blu',
  en_evaluacion: 'amb',
  adjudicado: 'grn',
  cancelado: 'neu',
}
const PROCESO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  publicado: 'Publicado',
  en_evaluacion: 'En evaluación',
  adjudicado: 'Adjudicado',
  cancelado: 'Cancelado',
}
const PROCESO_NEXT: Record<string, string | null> = {
  borrador: 'publicado',
  publicado: 'en_evaluacion',
  en_evaluacion: 'adjudicado',
  adjudicado: null,
  cancelado: null,
}
const PROCESO_NEXT_LABEL: Record<string, string> = {
  borrador: 'Publicar',
  publicado: 'Evaluar',
  en_evaluacion: 'Adjudicar',
}

const MODALIDAD_LABEL: Record<string, string> = {
  licitacion: 'Licitación',
  seleccion_abreviada: 'Selección abreviada',
  minima_cuantia: 'Mínima cuantía',
  contratacion_directa: 'Contratación directa',
}

const OFERENTE_TONE: Record<string, StatusTone> = {
  invitado: 'neu',
  presentado: 'blu',
  habilitado: 'amb',
  adjudicado: 'grn',
  rechazado: 'red',
}
const OFERENTE_LABEL: Record<string, string> = {
  invitado: 'Invitado',
  presentado: 'Presentado',
  habilitado: 'Habilitado',
  adjudicado: 'Adjudicado',
  rechazado: 'Rechazado',
}
const OFERENTE_NEXT: Record<string, string | null> = {
  invitado: 'presentado',
  presentado: 'habilitado',
  habilitado: 'adjudicado',
  adjudicado: null,
  rechazado: null,
}
const OFERENTE_NEXT_LABEL: Record<string, string> = {
  invitado: 'Presentó',
  presentado: 'Habilitar',
  habilitado: 'Adjudicar',
}

type ProcForm = {
  numero: string; objeto: string
  modalidad: 'licitacion' | 'seleccion_abreviada' | 'minima_cuantia' | 'contratacion_directa'
  valor: string; cierreOn: string
}
type PliegoForm = { procesoId: string; name: string; description: string; obligatorio: boolean }
type OferForm = { procesoId: string; name: string; contacto: string; valor: string }

const EMPTY_PROC: ProcForm = { numero: '', objeto: '', modalidad: 'licitacion', valor: '', cierreOn: '' }
const EMPTY_PLIEGO: PliegoForm = { procesoId: '', name: '', description: '', obligatorio: true }
const EMPTY_OFER: OferForm = { procesoId: '', name: '', contacto: '', valor: '' }

export default function ContratacionPage({ data }: { data: ContratacionData }) {
  const { addToast } = useApp()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState(data)
  const [procForm, setProcForm] = useState(EMPTY_PROC)
  const [pliegoForm, setPliegoForm] = useState(EMPTY_PLIEGO)
  const [oferForm, setOferForm] = useState(EMPTY_OFER)

  const modalidadOpts = [
    { value: 'licitacion', label: 'Licitación' },
    { value: 'seleccion_abreviada', label: 'Selección abreviada' },
    { value: 'minima_cuantia', label: 'Mínima cuantía' },
    { value: 'contratacion_directa', label: 'Contratación directa' },
  ]
  const procesoOpts = [
    { value: '', label: 'Elige el proceso' },
    ...state.procesos.map((p) => ({ value: p.id, label: `${p.numero} — ${p.objeto.slice(0, 40)}` })),
  ]

  function submitProc() {
    startTransition(async () => {
      const result = await addProceso({
        numero: procForm.numero,
        objeto: procForm.objeto,
        modalidad: procForm.modalidad,
        valor: procForm.valor,
        ...(procForm.cierreOn ? { cierreOn: procForm.cierreOn } : {}),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Proceso creado', 'ok')
      setProcForm(EMPTY_PROC)
    })
  }

  function submitPliego() {
    startTransition(async () => {
      const result = await addPliego({
        procesoId: pliegoForm.procesoId,
        name: pliegoForm.name,
        description: pliegoForm.description,
        obligatorio: pliegoForm.obligatorio,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Requisito registrado', 'ok')
      setPliegoForm(EMPTY_PLIEGO)
    })
  }

  function submitOfer() {
    startTransition(async () => {
      const result = await addOferente({
        procesoId: oferForm.procesoId,
        name: oferForm.name,
        contacto: oferForm.contacto,
        valorOferta: oferForm.valor,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Oferente registrado', 'ok')
      setOferForm(EMPTY_OFER)
    })
  }

  function changeProcEstado(id: string, estado: string) {
    startTransition(async () => {
      const result = await setProcesoEstado(id, estado)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Estado actualizado', 'ok')
    })
  }

  function changeOferEstado(id: string, estado: string) {
    startTransition(async () => {
      const result = await setOferenteEstado(id, estado)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Estado actualizado', 'ok')
    })
  }

  async function removeProc(id: string) {
    if (!(await confirm({ title: '¿Eliminar este proceso con sus pliegos y oferentes?', tone: 'danger' }))) return
    startTransition(async () => {
      const result = await deleteProceso(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Proceso eliminado', 'ok')
    })
  }

  async function removePliego(id: string) {
    if (!(await confirm({ title: '¿Eliminar este requisito?', tone: 'danger' }))) return
    startTransition(async () => {
      const result = await deletePliego(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Requisito eliminado', 'ok')
    })
  }

  async function removeOfer(id: string) {
    if (!(await confirm({ title: '¿Eliminar este oferente?', tone: 'danger' }))) return
    startTransition(async () => {
      const result = await deleteOferente(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Oferente eliminado', 'ok')
    })
  }

  return (
    <>
      <div className="g3 g3--few" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat
            icon={<Contracts size={16} />}
            tone={state.activosCount > 0 ? 'blu' : 'neu'}
            label="Procesos activos"
            value={state.activosCount}
            sub="Publicados y en evaluación"
          />
        </div>
        <div className="rise d2">
          <Stat
            icon={<Contracts size={16} />}
            tone="grn"
            label="Valor adjudicado"
            value={cop(state.valorAdjudicado)}
            sub="Suma de lo ganado"
          />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <div className="ctitle">Nuevo proceso</div>
        </div>

        <div className="cpad" style={{ paddingBottom: 0 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '0 1 150px', minWidth: 120 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Número</div>
              <input
                className="field"
                value={procForm.numero}
                maxLength={40}
                placeholder="Ej: LP-001-2026"
                onChange={(e) => setProcForm((f) => ({ ...f, numero: e.target.value }))}
              />
            </div>
            <div style={{ flex: '1 1 220px', minWidth: 180 }}>
              <div className="flabel">Objeto</div>
              <input
                className="field"
                value={procForm.objeto}
                maxLength={300}
                placeholder="Ej: Suministro de dotación para 12 sedes"
                onChange={(e) => setProcForm((f) => ({ ...f, objeto: e.target.value }))}
              />
            </div>
            <div style={{ flex: '0 1 170px', minWidth: 140 }}>
              <div className="flabel">Modalidad</div>
              <Select
                value={procForm.modalidad}
                onChange={(v) => setProcForm((f) => ({ ...f, modalidad: v as ProcForm['modalidad'] }))}
                options={modalidadOpts}
              />
            </div>
            <div style={{ flex: '0 1 150px', minWidth: 120 }}>
              <div className="flabel">Valor</div>
              <input
                type="number"
                min={0}
                step="0.01"
                className="field"
                value={procForm.valor}
                placeholder="0"
                onChange={(e) => setProcForm((f) => ({ ...f, valor: e.target.value }))}
              />
            </div>
            <div style={{ flex: '0 1 150px', minWidth: 130 }}>
              <div className="flabel">Cierre</div>
              <DatePicker
                ariaLabel="Cierre"
                value={procForm.cierreOn}
                onChange={(v) => setProcForm((f) => ({ ...f, cierreOn: v }))}
              />
            </div>
            <button
              className="btn dark"
              disabled={pending || procForm.numero.trim().length < 2 || procForm.objeto.trim().length < 2}
              aria-busy={pending}
              onClick={submitProc}
            >
              <Plus size={14} />Crear proceso
            </button>
          </div>
        </div>

        <div className="tblwrap" style={{ marginTop: 12 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Número</th>
                <th scope="col">Objeto</th>
                <th scope="col">Modalidad</th>
                <th scope="col">Estado</th>
                <th scope="col">Valor</th>
                <th scope="col">Cierre</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {state.procesos.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="dempty" style={{ padding: '18px 0', textAlign: 'center' }}>
                      Sin procesos.
                    </div>
                  </td>
                </tr>
              ) : state.procesos.map((p) => (
                <tr key={p.id}>
                  <td className="mono" style={{ fontSize: 12 }}>{p.numero}</td>
                  <td><div className="cename">{p.objeto}</div></td>
                  <td className="muted">{MODALIDAD_LABEL[p.modalidad] ?? p.modalidad}</td>
                  <td><Badge st={PROCESO_LABEL[p.estado]} tone={PROCESO_TONE[p.estado]} /></td>
                  <td className="mono" style={{ fontSize: 12 }}>{cop(p.valor)}</td>
                  <td className="muted mono" style={{ fontSize: 12 }}>
                    {p.cierreOn ? fmtDate(p.cierreOn) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {PROCESO_NEXT[p.estado] && (
                      <button
                        className="btn ghost"
                        disabled={pending}
                        onClick={() => changeProcEstado(p.id, PROCESO_NEXT[p.estado] as string)}
                      >
                        {PROCESO_NEXT_LABEL[p.estado]}
                      </button>
                    )}
                    {p.estado !== 'cancelado' && p.estado !== 'adjudicado' && (
                      <button
                        className="ibtn"
                        style={{ width: 28, height: 28, color: 'var(--redd)' }}
                        data-tip="Cancelar"
                        disabled={pending}
                        onClick={() => changeProcEstado(p.id, 'cancelado')}
                        aria-label={`Cancelar proceso ${p.numero}`}
                      >
                        <X size={13} />
                      </button>
                    )}
                    <button
                      className="ibtn"
                      style={{ width: 28, height: 28, color: 'var(--redd)' }}
                      data-tip="Eliminar"
                      disabled={pending}
                      onClick={() => removeProc(p.id)}
                      aria-label={`Eliminar proceso ${p.numero}`}
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
          <div className="ctitle">Nuevo requisito del pliego</div>
        </div>

        <div className="cpad" style={{ paddingBottom: 0 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '0 1 220px', minWidth: 180 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Proceso</div>
              <Select
                value={pliegoForm.procesoId}
                onChange={(v) => setPliegoForm((f) => ({ ...f, procesoId: v }))}
                options={procesoOpts}
              />
            </div>
            <div style={{ flex: '1 1 180px', minWidth: 150 }}>
              <div className="flabel">Requisito</div>
              <input
                className="field"
                value={pliegoForm.name}
                maxLength={160}
                placeholder="Ej: Certificado de cámara de comercio"
                onChange={(e) => setPliegoForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div style={{ flex: '1 1 200px', minWidth: 170 }}>
              <div className="flabel">Descripción</div>
              <input
                className="field"
                value={pliegoForm.description}
                maxLength={500}
                placeholder="Ej: vigencia menor a 30 días"
                onChange={(e) => setPliegoForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div style={{ alignSelf: 'flex-end', marginBottom: 10 }}>
              <Toggle
                on={pliegoForm.obligatorio}
                onChange={(v) => setPliegoForm((f) => ({ ...f, obligatorio: v }))}
                label="Obligatorio"
              />
            </div>
            <button
              className="btn dark"
              disabled={pending || !pliegoForm.procesoId || pliegoForm.name.trim().length < 2}
              aria-busy={pending}
              onClick={submitPliego}
            >
              <Plus size={14} />Registrar requisito
            </button>
          </div>
        </div>

        <div className="tblwrap" style={{ marginTop: 12 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Proceso</th>
                <th scope="col">Requisito</th>
                <th scope="col">Descripción</th>
                <th scope="col">Obligatorio</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {state.pliegos.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="dempty" style={{ padding: '18px 0', textAlign: 'center' }}>
                      Sin requisitos de pliego.
                    </div>
                  </td>
                </tr>
              ) : state.pliegos.map((r) => (
                <tr key={r.id}>
                  <td className="muted mono" style={{ fontSize: 12 }}>{r.procesoNumero}</td>
                  <td><div className="cename">{r.name}</div></td>
                  <td className="muted">{r.description}</td>
                  <td>
                    <Badge st={r.obligatorio ? 'Sí' : 'No'} tone={r.obligatorio ? 'red' : 'neu'} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="ibtn"
                      style={{ width: 28, height: 28, color: 'var(--redd)' }}
                      data-tip="Eliminar"
                      disabled={pending}
                      onClick={() => removePliego(r.id)}
                      aria-label={`Eliminar requisito ${r.name}`}
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
          <div className="ctitle">Nuevo oferente</div>
        </div>

        <div className="cpad" style={{ paddingBottom: 0 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '0 1 220px', minWidth: 180 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Proceso</div>
              <Select
                value={oferForm.procesoId}
                onChange={(v) => setOferForm((f) => ({ ...f, procesoId: v }))}
                options={procesoOpts}
              />
            </div>
            <div style={{ flex: '1 1 180px', minWidth: 150 }}>
              <div className="flabel">Oferente</div>
              <input
                className="field"
                value={oferForm.name}
                maxLength={160}
                placeholder="Ej: Unión Temporal Solar Andino"
                onChange={(e) => setOferForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div style={{ flex: '1 1 160px', minWidth: 130 }}>
              <div className="flabel">Contacto</div>
              <input
                className="field"
                value={oferForm.contacto}
                maxLength={160}
                placeholder="Ej: María Pérez"
                onChange={(e) => setOferForm((f) => ({ ...f, contacto: e.target.value }))}
              />
            </div>
            <div style={{ flex: '0 1 150px', minWidth: 120 }}>
              <div className="flabel">Valor oferta</div>
              <input
                type="number"
                min={0}
                step="0.01"
                className="field"
                value={oferForm.valor}
                placeholder="0"
                onChange={(e) => setOferForm((f) => ({ ...f, valor: e.target.value }))}
              />
            </div>
            <button
              className="btn dark"
              disabled={pending || !oferForm.procesoId || oferForm.name.trim().length < 2}
              aria-busy={pending}
              onClick={submitOfer}
            >
              <Plus size={14} />Registrar oferente
            </button>
          </div>
        </div>

        <div className="tblwrap" style={{ marginTop: 12 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Proceso</th>
                <th scope="col">Oferente</th>
                <th scope="col">Contacto</th>
                <th scope="col">Estado</th>
                <th scope="col">Valor oferta</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {state.oferentes.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="dempty" style={{ padding: '18px 0', textAlign: 'center' }}>
                      Sin oferentes.
                    </div>
                  </td>
                </tr>
              ) : state.oferentes.map((o) => (
                <tr key={o.id}>
                  <td className="muted mono" style={{ fontSize: 12 }}>{o.procesoNumero}</td>
                  <td><div className="cename">{o.name}</div></td>
                  <td className="muted">{o.contacto ?? '—'}</td>
                  <td><Badge st={OFERENTE_LABEL[o.estado]} tone={OFERENTE_TONE[o.estado]} /></td>
                  <td className="mono" style={{ fontSize: 12 }}>{cop(o.valorOferta)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {OFERENTE_NEXT[o.estado] && (
                      <button
                        className="btn ghost"
                        disabled={pending}
                        onClick={() => changeOferEstado(o.id, OFERENTE_NEXT[o.estado] as string)}
                      >
                        {OFERENTE_NEXT_LABEL[o.estado]}
                      </button>
                    )}
                    {o.estado !== 'rechazado' && o.estado !== 'adjudicado' && (
                      <button
                        className="ibtn"
                        style={{ width: 28, height: 28, color: 'var(--redd)' }}
                        data-tip="Rechazar"
                        disabled={pending}
                        onClick={() => changeOferEstado(o.id, 'rechazado')}
                        aria-label={`Rechazar oferente ${o.name}`}
                      >
                        <X size={13} />
                      </button>
                    )}
                    <button
                      className="ibtn"
                      style={{ width: 28, height: 28, color: 'var(--redd)' }}
                      data-tip="Eliminar"
                      disabled={pending}
                      onClick={() => removeOfer(o.id)}
                      aria-label={`Eliminar oferente ${o.name}`}
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
