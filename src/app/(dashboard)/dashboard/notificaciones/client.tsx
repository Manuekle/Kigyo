'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2 } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Toggle from '@/components/ui/Toggle'
import { useApp } from '@/lib/context/AppContext'
import { useConfirm } from '@/lib/context/ConfirmContext'
import type { StatusTone } from '@/lib/types'
import type { NotifPanelData } from '@/server/queries/notif-panel'
import { addRule, deleteRule, toggleRule } from '@/server/mutations/notif-panel'

const DAY = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
const WHEN = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

/** `due_on`/`next_charge_on` son fechas puras; `scheduled_for` trae hora. */
const fmtWhen = (when: string) => DAY.format(new Date(when.length === 10 ? `${when}T00:00:00` : when))
const fmtSent = (iso: string) => WHEN.format(new Date(iso))

const KIND_LABEL: Record<string, string> = {
  cita: 'Cita',
  vencimiento: 'Vencimiento',
  renovacion: 'Renovación',
}
const KIND_TONE: Record<string, StatusTone> = {
  cita: 'blu',
  vencimiento: 'amb',
  renovacion: 'vio',
}
const kindTone = (k: string): StatusTone => KIND_TONE[k] ?? 'neu'

const STATUS_TONE: Record<string, StatusTone> = { enviado: 'grn', fallido: 'red' }
const statusTone = (s: string): StatusTone => STATUS_TONE[s] ?? 'neu'

const CHANNEL_LABEL: Record<string, string> = { email: 'Email', whatsapp: 'WhatsApp' }
const channelLabel = (c: string) => CHANNEL_LABEL[c] ?? c

const EVENT_OPTS = [
  { value: 'cita', label: 'Cita' },
  { value: 'vencimiento', label: 'Vencimiento' },
  { value: 'renovacion', label: 'Renovación' },
]
const CHANNEL_OPTS = [
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
]

const daysLabel = (n: number) => (n === 0 ? 'hoy' : `en ${n} ${n === 1 ? 'día' : 'días'}`)

const EMPTY_FORM = { name: '', kind: 'cita', days: '1', channel: 'email' }

export default function NotificacionesPage({ data }: { data: NotifPanelData }) {
  const { addToast } = useApp()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState(data)
  const [form, setForm] = useState(EMPTY_FORM)

  function submitRule() {
    startTransition(async () => {
      const result = await addRule({
        name: form.name,
        kind: form.kind as 'cita' | 'vencimiento' | 'renovacion',
        daysBefore: Number(form.days),
        channel: form.channel as 'email' | 'whatsapp',
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Regla creada', 'ok')
      setForm(EMPTY_FORM)
    })
  }

  function flipRule(id: string) {
    startTransition(async () => {
      const result = await toggleRule(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
    })
  }

  async function removeRule(id: string, name: string) {
    if (!(await confirm({ title: `¿Eliminar la regla "${name}"?`, tone: 'danger' }))) return
    startTransition(async () => {
      const result = await deleteRule(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Regla eliminada', 'ok')
    })
  }

  return (
    <>
      <div className="card rise d1">
        <div className="chead">
          <div className="ctitle">Reglas</div>
        </div>

        <div className="cpad" style={{ paddingBottom: 0 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 200px', minWidth: 160 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Nombre</div>
              <input
                className="field"
                value={form.name}
                maxLength={80}
                placeholder="Ej: recordar cita 1 día antes"
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div style={{ flex: '0 1 160px', minWidth: 130 }}>
              <div className="flabel">Evento</div>
              <Select
                value={form.kind}
                onChange={(v) => setForm((f) => ({ ...f, kind: v }))}
                options={EVENT_OPTS}
              />
            </div>
            <div style={{ flex: '0 1 90px', minWidth: 70 }}>
              <div className="flabel">Días antes</div>
              <input
                type="number"
                className="field"
                min={0}
                max={90}
                value={form.days}
                onChange={(e) => setForm((f) => ({ ...f, days: e.target.value }))}
              />
            </div>
            <div style={{ flex: '0 1 150px', minWidth: 120 }}>
              <div className="flabel">Canal</div>
              <Select
                value={form.channel}
                onChange={(v) => setForm((f) => ({ ...f, channel: v }))}
                options={CHANNEL_OPTS}
              />
            </div>
            <button
              className="btn dark"
              disabled={pending || form.name.trim().length < 2}
              aria-busy={pending}
              onClick={submitRule}
            >
              <Plus size={14} />Añadir regla
            </button>
          </div>
        </div>

        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Evento</th>
                <th scope="col">Antelación</th>
                <th scope="col">Canal</th>
                <th scope="col">Activa</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {state.rules.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      Sin reglas todavía.
                    </div>
                  </td>
                </tr>
              ) : state.rules.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="cename">{r.name}</div>
                  </td>
                  <td>{KIND_LABEL[r.kind] ?? r.kind}</td>
                  <td className="muted">{daysLabel(r.daysBefore)}</td>
                  <td className="muted">{channelLabel(r.channel)}</td>
                  <td>
                    <Toggle
                      on={r.enabled}
                      size="sm"
                      disabled={pending}
                      ariaLabel={`${r.enabled ? 'Desactivar' : 'Activar'} la regla ${r.name}`}
                      onChange={() => flipRule(r.id)}
                    />
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      className="ibtn"
                      style={{ width: 28, height: 28, color: 'var(--redd)' }}
                      data-tip="Eliminar"
                      disabled={pending}
                      onClick={() => removeRule(r.id, r.name)}
                      aria-label={`Eliminar la regla ${r.name}`}
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

      <div className="card rise d2" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Próximos</div>
        </div>

        <div className="cpad">
          {state.upcoming.length === 0 ? (
            <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
              Nada próximo.
            </div>
          ) : state.upcoming.map((u, i) => (
            <div className="elrow" key={`${u.kind}-${u.when}-${u.subject}-${i}`}>
              <div className="eltxt">
                <Badge st={KIND_LABEL[u.kind] ?? u.kind} tone={kindTone(u.kind)} />
              </div>
              <div className="elsub">
                {u.subject} · {daysLabel(u.daysLeft)} · {fmtWhen(u.when)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card rise d3" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Bitácora</div>
        </div>

        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Evento</th>
                <th scope="col">Destinatario</th>
                <th scope="col">Canal</th>
                <th scope="col">Estado</th>
                <th scope="col">Error</th>
              </tr>
            </thead>
            <tbody>
              {state.log.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      Sin envíos registrados.
                    </div>
                  </td>
                </tr>
              ) : state.log.map((l) => (
                <tr key={l.id}>
                  <td className="muted mono" style={{ fontSize: 12 }}>{fmtSent(l.sentAt)}</td>
                  <td>
                    <Badge st={KIND_LABEL[l.kind] ?? l.kind} tone={kindTone(l.kind)} />
                  </td>
                  <td>{l.recipient}</td>
                  <td className="muted">{channelLabel(l.channel)}</td>
                  <td><Badge st={l.status === 'enviado' ? 'Enviado' : 'Fallido'} tone={statusTone(l.status)} /></td>
                  <td className="muted">{l.error ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
