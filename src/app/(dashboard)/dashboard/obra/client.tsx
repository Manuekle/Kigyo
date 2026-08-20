'use client'

import { useState, useTransition } from 'react'
import { ChevronDown, ChevronUp, Construction, Plus, Trash2 } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import DatePicker from '@/components/ui/DatePicker'
import Stat from '@/components/ui/Stat'
import { useApp } from '@/lib/context/AppContext'
import { useConfirm } from '@/lib/context/ConfirmContext'
import { cop } from '@/lib/utils'
import type { StatusTone } from '@/lib/types'
import type { ObraData } from '@/server/queries/obra'
import {
  addApu,
  addAvance,
  addCapitulo,
  addPresupuesto,
  deleteApu,
  deleteAvance,
  deleteCapitulo,
  deletePresupuesto,
  setPresupuestoEstado,
} from '@/server/mutations/obra'

// La fecha llega como 'YYYY-MM-DD' (columna date). Se formatea en UTC para que
// la zona local no desplace el día un día atrás.
const DATE_FMT = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const fmtDate = (d: string) => DATE_FMT.format(new Date(`${d}T00:00:00Z`))

const ESTADO_TONE: Record<string, StatusTone> = {
  borrador: 'amb',
  aprobado: 'grn',
  en_ejecucion: 'blu',
  cerrado: 'neu',
}
const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  aprobado: 'Aprobado',
  en_ejecucion: 'En ejecución',
  cerrado: 'Cerrado',
}
// El siguiente paso del ciclo de vida; `cerrado` no tiene.
const NEXT: Record<string, string | null> = {
  borrador: 'aprobado',
  aprobado: 'en_ejecucion',
  en_ejecucion: 'cerrado',
  cerrado: null,
}
const NEXT_LABEL: Record<string, string> = {
  borrador: 'Aprobar',
  aprobado: 'Iniciar',
  en_ejecucion: 'Cerrar',
}

type PresForm = { name: string; client: string; valor: string; fechaInicio: string; fechaFin: string }
type CapForm = { name: string; valor: string }
type ApuForm = {
  name: string; unidad: string; cantidad: string
  materiales: string; manoObra: string; equipo: string; transporte: string
}
type AvForm = { fecha: string; avance: string; valor: string; notas: string }

const EMPTY_PRES: PresForm = { name: '', client: '', valor: '', fechaInicio: '', fechaFin: '' }
const EMPTY_CAP: CapForm = { name: '', valor: '' }
const EMPTY_APU: ApuForm = {
  name: '', unidad: 'und', cantidad: '1',
  materiales: '', manoObra: '', equipo: '', transporte: '',
}
const EMPTY_AV: AvForm = { fecha: '', avance: '', valor: '', notas: '' }

export default function ObraPage({ data }: { data: ObraData }) {
  const { addToast } = useApp()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState(data)
  const [presForm, setPresForm] = useState(EMPTY_PRES)
  const [capForms, setCapForms] = useState<Record<string, CapForm>>({})
  const [apuForms, setApuForms] = useState<Record<string, ApuForm>>({})
  const [avForms, setAvForms] = useState<Record<string, AvForm>>({})
  const [openCap, setOpenCap] = useState<string | null>(null)

  function submitPres() {
    startTransition(async () => {
      const result = await addPresupuesto({
        name: presForm.name,
        client: presForm.client,
        valorPresupuestado: presForm.valor,
        ...(presForm.fechaInicio ? { fechaInicio: presForm.fechaInicio } : {}),
        ...(presForm.fechaFin ? { fechaFin: presForm.fechaFin } : {}),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Presupuesto creado', 'ok')
      setPresForm(EMPTY_PRES)
    })
  }

  function submitCap(presupuestoId: string) {
    const form = capForms[presupuestoId] ?? EMPTY_CAP
    startTransition(async () => {
      const result = await addCapitulo({
        presupuestoId,
        name: form.name,
        valorPresupuestado: form.valor,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Capítulo añadido', 'ok')
      setCapForms((f) => ({ ...f, [presupuestoId]: EMPTY_CAP }))
    })
  }

  function submitApu(capituloId: string) {
    const form = apuForms[capituloId] ?? EMPTY_APU
    startTransition(async () => {
      const result = await addApu({
        capituloId,
        name: form.name,
        unidad: form.unidad,
        cantidad: form.cantidad,
        materiales: form.materiales,
        manoObra: form.manoObra,
        equipo: form.equipo,
        transporte: form.transporte,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Partida registrada', 'ok')
      setApuForms((f) => ({ ...f, [capituloId]: EMPTY_APU }))
    })
  }

  function submitAv(capituloId: string) {
    const form = avForms[capituloId] ?? EMPTY_AV
    startTransition(async () => {
      const result = await addAvance({
        capituloId,
        fecha: form.fecha,
        avance: form.avance,
        valor: form.valor,
        notas: form.notas,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Avance registrado', 'ok')
      setAvForms((f) => ({ ...f, [capituloId]: EMPTY_AV }))
    })
  }

  function changeEstado(id: string, estado: string) {
    startTransition(async () => {
      const result = await setPresupuestoEstado(id, estado)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Estado actualizado', 'ok')
    })
  }

  async function removePres(id: string) {
    if (!(await confirm({ title: '¿Eliminar este presupuesto y todo lo que contiene?', tone: 'danger' }))) return
    startTransition(async () => {
      const result = await deletePresupuesto(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Presupuesto eliminado', 'ok')
    })
  }

  async function removeCap(id: string) {
    if (!(await confirm({ title: '¿Eliminar este capítulo con sus partidas y avances?', tone: 'danger' }))) return
    startTransition(async () => {
      const result = await deleteCapitulo(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      if (openCap === id) setOpenCap(null)
      addToast('Capítulo eliminado', 'ok')
    })
  }

  async function removeApu(id: string) {
    if (!(await confirm({ title: '¿Eliminar esta partida?', tone: 'danger' }))) return
    startTransition(async () => {
      const result = await deleteApu(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Partida eliminada', 'ok')
    })
  }

  async function removeAv(id: string) {
    if (!(await confirm({ title: '¿Eliminar este avance?', description: 'El capítulo vuelve a su corte anterior.', tone: 'danger' }))) return
    startTransition(async () => {
      const result = await deleteAvance(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Avance eliminado', 'ok')
    })
  }

  function openDetail(capituloId: string) {
    if (openCap === capituloId) { setOpenCap(null); return }
    const capitulo = state.presupuestos
      .flatMap((p) => p.capitulos)
      .find((c) => c.id === capituloId)
    setOpenCap(capituloId)
    if (capitulo) {
      setAvForms((f) => ({
        ...f,
        [capituloId]: {
          ...EMPTY_AV,
          avance: String(Math.round(capitulo.avance * 100) / 100),
          valor: String(capitulo.valorEjecutado),
        },
      }))
    }
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat
            icon={<Construction size={16} />}
            tone="blu"
            label="En ejecución"
            value={state.enEjecucionCount}
            sub="Presupuestos activos"
          />
        </div>
        <div className="rise d2">
          <Stat
            icon={<Construction size={16} />}
            tone="neu"
            label="Presupuestado"
            value={cop(state.totalPresupuestado)}
            sub="Todos los presupuestos"
          />
        </div>
        <div className="rise d3">
          <Stat
            icon={<Construction size={16} />}
            tone="grn"
            label="Ejecutado"
            value={cop(state.totalEjecutado)}
            sub="Suma de capítulos"
          />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <div className="ctitle">Nuevo presupuesto</div>
        </div>

        <div className="cpad">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 200px', minWidth: 170 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Nombre</div>
              <input
                className="field"
                value={presForm.name}
                maxLength={120}
                placeholder="Ej: Edificio Torres del Parque"
                onChange={(e) => setPresForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div style={{ flex: '1 1 160px', minWidth: 130 }}>
              <div className="flabel">Cliente</div>
              <input
                className="field"
                value={presForm.client}
                maxLength={120}
                placeholder="Ej: Constructora Andina"
                onChange={(e) => setPresForm((f) => ({ ...f, client: e.target.value }))}
              />
            </div>
            <div style={{ flex: '0 1 160px', minWidth: 130 }}>
              <div className="flabel">Valor presupuestado</div>
              <input
                type="number"
                min={0}
                step="0.01"
                className="field"
                value={presForm.valor}
                placeholder="0"
                onChange={(e) => setPresForm((f) => ({ ...f, valor: e.target.value }))}
              />
            </div>
            <div style={{ flex: '0 1 150px', minWidth: 130 }}>
              <div className="flabel">Inicio</div>
              <DatePicker
                ariaLabel="Inicio"
                value={presForm.fechaInicio}
                onChange={(v) => setPresForm((f) => ({ ...f, fechaInicio: v }))}
              />
            </div>
            <div style={{ flex: '0 1 150px', minWidth: 130 }}>
              <div className="flabel">Fin</div>
              <DatePicker
                ariaLabel="Fin"
                value={presForm.fechaFin}
                onChange={(v) => setPresForm((f) => ({ ...f, fechaFin: v }))}
              />
            </div>
            <button
              className="btn dark"
              disabled={pending || presForm.name.trim().length < 2}
              aria-busy={pending}
              onClick={submitPres}
            >
              <Plus size={14} />Crear presupuesto
            </button>
          </div>
        </div>
      </div>

      {state.presupuestos.length === 0 && (
        <div className="card rise d3" style={{ marginTop: 16 }}>
          <div className="dempty" style={{ padding: '28px 0', textAlign: 'center' }}>
            Sin presupuestos. Crea el primero para empezar a descomponer la obra.
          </div>
        </div>
      )}

      {state.presupuestos.map((p) => (
        <div className="card rise" style={{ marginTop: 16 }} key={p.id}>
          <div className="chead">
            <div className="ctitle">
              {p.name}
              {p.client && <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>{p.client}</span>}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Badge st={ESTADO_LABEL[p.estado]} tone={ESTADO_TONE[p.estado]} />
              {NEXT[p.estado] && (
                <button
                  className="btn ghost"
                  disabled={pending}
                  onClick={() => changeEstado(p.id, NEXT[p.estado] as string)}
                >
                  {NEXT_LABEL[p.estado]}
                </button>
              )}
              <button
                className="ibtn"
                style={{ width: 28, height: 28, color: 'var(--redd)' }}
                data-tip="Eliminar"
                disabled={pending}
                onClick={() => removePres(p.id)}
                aria-label={`Eliminar presupuesto ${p.name}`}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          <div className="cpad" style={{ paddingTop: 0 }}>
            <div className="muted" style={{ fontSize: 13, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span>Presupuestado: <strong>{cop(p.valorPresupuestado)}</strong></span>
              <span>Ejecutado: <strong>{cop(p.valorEjecutado)}</strong></span>
              {p.fechaInicio && <span>Inicio: {fmtDate(p.fechaInicio)}</span>}
              {p.fechaFin && <span>Fin: {fmtDate(p.fechaFin)}</span>}
            </div>
          </div>

          <div className="cpad" style={{ paddingBottom: 0 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 200px', minWidth: 170 }}>
                <div className="flabel" style={{ marginTop: 0 }}>Nuevo capítulo</div>
                <input
                  className="field"
                  value={(capForms[p.id] ?? EMPTY_CAP).name}
                  maxLength={120}
                  placeholder="Ej: Cimentación"
                  onChange={(e) =>
                    setCapForms((f) => ({ ...f, [p.id]: { ...(f[p.id] ?? EMPTY_CAP), name: e.target.value } }))
                  }
                />
              </div>
              <div style={{ flex: '0 1 160px', minWidth: 130 }}>
                <div className="flabel">Valor</div>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="field"
                  value={(capForms[p.id] ?? EMPTY_CAP).valor}
                  placeholder="0"
                  onChange={(e) =>
                    setCapForms((f) => ({ ...f, [p.id]: { ...(f[p.id] ?? EMPTY_CAP), valor: e.target.value } }))
                  }
                />
              </div>
              <button
                className="btn dark"
                disabled={pending || (capForms[p.id]?.name ?? '').trim().length < 2}
                aria-busy={pending}
                onClick={() => submitCap(p.id)}
              >
                <Plus size={14} />Añadir capítulo
              </button>
            </div>
          </div>

          <div className="tblwrap" style={{ marginTop: 12 }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Capítulo</th>
                  <th scope="col">Presupuestado</th>
                  <th scope="col">Ejecutado</th>
                  <th scope="col">Avance</th>
                  <th scope="col">Partidas</th>
                  <th scope="col" aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {p.capitulos.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="dempty" style={{ padding: '18px 0', textAlign: 'center' }}>
                        Sin capítulos. Descompón el presupuesto para medir el avance.
                      </div>
                    </td>
                  </tr>
                ) : p.capitulos.map((c) => (
                  <FragmentCap
                    key={c.id}
                    cap={c}
                    open={openCap === c.id}
                    pending={pending}
                    apuForm={apuForms[c.id] ?? EMPTY_APU}
                    avForm={avForms[c.id] ?? EMPTY_AV}
                    onToggle={() => openDetail(c.id)}
                    onApuChange={(patch) =>
                      setApuForms((f) => ({ ...f, [c.id]: { ...(f[c.id] ?? EMPTY_APU), ...patch } }))
                    }
                    onAvChange={(patch) =>
                      setAvForms((f) => ({ ...f, [c.id]: { ...(f[c.id] ?? EMPTY_AV), ...patch } }))
                    }
                    onApuSubmit={() => submitApu(c.id)}
                    onAvSubmit={() => submitAv(c.id)}
                    onRemoveCap={() => removeCap(c.id)}
                    onRemoveApu={removeApu}
                    onRemoveAv={removeAv}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  )
}

/* ─── Fila de capítulo con detalle desplegable ──────────────────────────── */

interface CapProps {
  cap: ObraData['presupuestos'][number]['capitulos'][number]
  open: boolean
  pending: boolean
  apuForm: ApuForm
  avForm: AvForm
  onToggle: () => void
  onApuChange: (patch: Partial<ApuForm>) => void
  onAvChange: (patch: Partial<AvForm>) => void
  onApuSubmit: () => void
  onAvSubmit: () => void
  onRemoveCap: () => void
  onRemoveApu: (id: string) => void
  onRemoveAv: (id: string) => void
}

function FragmentCap(props: CapProps) {
  const { cap, open, pending, apuForm, avForm } = props

  return (
    <>
      <tr>
        <td>
          <div className="cename">{cap.name}</div>
        </td>
        <td className="mono" style={{ fontSize: 12 }}>{cop(cap.valorPresupuestado)}</td>
        <td className="mono" style={{ fontSize: 12 }}>{cop(cap.valorEjecutado)}</td>
        <td>
          <Badge st={`${Math.round(cap.avance)}%`} tone={cap.avance >= 100 ? 'grn' : cap.avance > 0 ? 'blu' : 'neu'} />
        </td>
        <td className="muted">{cap.apu.length}</td>
        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
          <button
            className="ibtn"
            style={{ width: 28, height: 28 }}
            data-tip={open ? 'Ocultar detalle' : 'Ver detalle'}
            disabled={pending}
            onClick={props.onToggle}
            aria-label={open ? 'Ocultar detalle' : 'Ver detalle del capítulo'}
          >
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <button
            className="ibtn"
            style={{ width: 28, height: 28, color: 'var(--redd)' }}
            data-tip="Eliminar"
            disabled={pending}
            onClick={props.onRemoveCap}
            aria-label={`Eliminar capítulo ${cap.name}`}
          >
            <Trash2 size={13} />
          </button>
        </td>
      </tr>

      {open && (
        <tr>
          <td colSpan={6} style={{ background: 'var(--bg2)', padding: '14px 16px' }}>
            <div className="dsect">Análisis de precios unitarios (APU)</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 8 }}>
              <div style={{ flex: '1 1 180px', minWidth: 150 }}>
                <div className="flabel" style={{ marginTop: 0 }}>Partida</div>
                <input
                  className="field"
                  value={apuForm.name}
                  maxLength={160}
                  placeholder="Ej: Concreto 3000 psi"
                  onChange={(e) => props.onApuChange({ name: e.target.value })}
                />
              </div>
              <div style={{ flex: '0 1 90px', minWidth: 70 }}>
                <div className="flabel">Unidad</div>
                <input
                  className="field"
                  value={apuForm.unidad}
                  maxLength={20}
                  placeholder="und"
                  onChange={(e) => props.onApuChange({ unidad: e.target.value })}
                />
              </div>
              <div style={{ flex: '0 1 100px', minWidth: 80 }}>
                <div className="flabel">Cantidad</div>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="field"
                  value={apuForm.cantidad}
                  onChange={(e) => props.onApuChange({ cantidad: e.target.value })}
                />
              </div>
              <div style={{ flex: '0 1 110px', minWidth: 90 }}>
                <div className="flabel">Materiales</div>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="field"
                  value={apuForm.materiales}
                  placeholder="0"
                  onChange={(e) => props.onApuChange({ materiales: e.target.value })}
                />
              </div>
              <div style={{ flex: '0 1 110px', minWidth: 90 }}>
                <div className="flabel">Mano de obra</div>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="field"
                  value={apuForm.manoObra}
                  placeholder="0"
                  onChange={(e) => props.onApuChange({ manoObra: e.target.value })}
                />
              </div>
              <div style={{ flex: '0 1 100px', minWidth: 80 }}>
                <div className="flabel">Equipo</div>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="field"
                  value={apuForm.equipo}
                  placeholder="0"
                  onChange={(e) => props.onApuChange({ equipo: e.target.value })}
                />
              </div>
              <div style={{ flex: '0 1 100px', minWidth: 80 }}>
                <div className="flabel">Transporte</div>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="field"
                  value={apuForm.transporte}
                  placeholder="0"
                  onChange={(e) => props.onApuChange({ transporte: e.target.value })}
                />
              </div>
              <button
                className="btn dark"
                disabled={pending || apuForm.name.trim().length < 2}
                aria-busy={pending}
                onClick={props.onApuSubmit}
              >
                <Plus size={14} />Registrar partida
              </button>
            </div>

            {cap.apu.length > 0 && (
              <div className="tblwrap" style={{ marginTop: 10 }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th scope="col">Partida</th>
                      <th scope="col">Unidad</th>
                      <th scope="col">Cantidad</th>
                      <th scope="col">Materiales</th>
                      <th scope="col">Mano obra</th>
                      <th scope="col">Equipo</th>
                      <th scope="col">Transporte</th>
                      <th scope="col">Total</th>
                      <th scope="col" aria-label="Acciones" />
                    </tr>
                  </thead>
                  <tbody>
                    {cap.apu.map((a) => (
                      <tr key={a.id}>
                        <td>{a.name}</td>
                        <td className="muted">{a.unidad}</td>
                        <td className="mono" style={{ fontSize: 12 }}>{a.cantidad.toLocaleString('es-CO')}</td>
                        <td className="mono" style={{ fontSize: 12 }}>{cop(a.materiales)}</td>
                        <td className="mono" style={{ fontSize: 12 }}>{cop(a.manoObra)}</td>
                        <td className="mono" style={{ fontSize: 12 }}>{cop(a.equipo)}</td>
                        <td className="mono" style={{ fontSize: 12 }}>{cop(a.transporte)}</td>
                        <td className="mono" style={{ fontSize: 12 }}><strong>{cop(a.total)}</strong></td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="ibtn"
                            style={{ width: 28, height: 28, color: 'var(--redd)' }}
                            data-tip="Eliminar"
                            disabled={pending}
                            onClick={() => props.onRemoveApu(a.id)}
                            aria-label={`Eliminar partida ${a.name}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="dsect">Registrar avance</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 8 }}>
              <div style={{ flex: '0 1 150px', minWidth: 130 }}>
                <div className="flabel" style={{ marginTop: 0 }}>Fecha</div>
                <DatePicker
                  ariaLabel="Fecha"
                  value={avForm.fecha}
                  onChange={(v) => props.onAvChange({ fecha: v })}
                />
              </div>
              <div style={{ flex: '0 1 110px', minWidth: 90 }}>
                <div className="flabel">Avance %</div>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  className="field"
                  value={avForm.avance}
                  onChange={(e) => props.onAvChange({ avance: e.target.value })}
                />
              </div>
              <div style={{ flex: '0 1 160px', minWidth: 130 }}>
                <div className="flabel">Valor ejecutado a la fecha</div>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="field"
                  value={avForm.valor}
                  placeholder="0"
                  onChange={(e) => props.onAvChange({ valor: e.target.value })}
                />
              </div>
              <div style={{ flex: '1 1 180px', minWidth: 150 }}>
                <div className="flabel">Nota</div>
                <input
                  className="field"
                  value={avForm.notas}
                  maxLength={500}
                  placeholder="Ej: fundida de placa nivel 1"
                  onChange={(e) => props.onAvChange({ notas: e.target.value })}
                />
              </div>
              <button
                className="btn dark"
                disabled={pending || !avForm.fecha}
                aria-busy={pending}
                onClick={props.onAvSubmit}
              >
                <Plus size={14} />Registrar avance
              </button>
            </div>

            {cap.avances.length > 0 && (
              <div className="tblwrap" style={{ marginTop: 10 }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col">Avance</th>
                      <th scope="col">Valor</th>
                      <th scope="col">Nota</th>
                      <th scope="col" aria-label="Acciones" />
                    </tr>
                  </thead>
                  <tbody>
                    {cap.avances.map((v) => (
                      <tr key={v.id}>
                        <td className="muted mono" style={{ fontSize: 12 }}>{fmtDate(v.fecha)}</td>
                        <td><Badge st={`${v.avance}%`} tone={v.avance >= 100 ? 'grn' : v.avance > 0 ? 'blu' : 'neu'} /></td>
                        <td className="mono" style={{ fontSize: 12 }}>{cop(v.valor)}</td>
                        <td className="muted">{v.notas ?? '—'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="ibtn"
                            style={{ width: 28, height: 28, color: 'var(--redd)' }}
                            data-tip="Eliminar"
                            disabled={pending}
                            onClick={() => props.onRemoveAv(v.id)}
                            aria-label="Eliminar avance"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
