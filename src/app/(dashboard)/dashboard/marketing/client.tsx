'use client'

import { Fragment, useState, useTransition } from 'react'
import { Plus, Send, Star, Trash2, UserCheck, XCircle, FileText, Filter } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import { useApp } from '@/lib/context/AppContext'
import type { StatusTone } from '@/lib/types'
import type { MarketingData, CampaignChannel, TemplateRow } from '@/server/queries/marketing'
import {
  addCampaign, addPoints, cancelCampaign, deleteCampaign, deletePoints,
  generateRecipients, markSent, addTemplate, deleteTemplate,
} from '@/server/mutations/marketing'

const DAY = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' })
const fmtDate = (iso: string | null) => (iso ? DAY.format(new Date(iso)) : '—')

const CHANNEL_LABELS: Record<CampaignChannel, string> = {
  whatsapp: 'WhatsApp',
  email: 'Correo',
  sms: 'SMS',
  otro: 'Otro',
}

const CAMPAIGN_TONE: Record<string, StatusTone> = {
  borrador: 'neu',
  programada: 'blu',
  enviada: 'grn',
  cancelada: 'red',
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const EMPTY_CAMPAIGN = { name: '', channel: 'whatsapp' as CampaignChannel, message: '' }
const EMPTY_POINTS = { clientId: '', points: '', reason: '' }
const EMPTY_TEMPLATE: { name: string; channel: CampaignChannel; message: string } = {
  name: '', channel: 'whatsapp', message: '',
}
const EMPTY_FILTERS = { status: '', kind: '', city: '', hasEmail: false }

const STATUS_OPTS = [
  { value: '', label: 'Todos' },
  { value: 'Prospecto', label: 'Prospecto' },
  { value: 'Activo', label: 'Activo' },
  { value: 'Inactivo', label: 'Inactivo' },
  { value: 'Perdido', label: 'Perdido' },
]
const KIND_OPTS = [
  { value: '', label: 'Todos' },
  { value: 'Empresa', label: 'Empresa' },
  { value: 'Persona natural', label: 'Persona natural' },
  { value: 'Entidad pública', label: 'Entidad pública' },
  { value: 'Otro', label: 'Otro' },
]

export default function MarketingPage({ data }: { data: MarketingData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState(data)
  const [campaignForm, setCampaignForm] = useState(EMPTY_CAMPAIGN)
  const [pointsForm, setPointsForm] = useState(EMPTY_POINTS)
  const [templateForm, setTemplateForm] = useState(EMPTY_TEMPLATE)
  const [genOpen, setGenOpen] = useState<string | null>(null)
  const [genFilters, setGenFilters] = useState(EMPTY_FILTERS)

  const clientOpts = state.clients.map((c) => ({ value: c.id, label: c.name }))

  function submitCampaign() {
    startTransition(async () => {
      const result = await addCampaign(campaignForm)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      setCampaignForm(EMPTY_CAMPAIGN)
      addToast('Campaña creada', 'ok')
    })
  }

  function applyTemplate(t: TemplateRow) {
    setCampaignForm({ name: t.name + ' (copia)', channel: t.channel, message: t.message })
    addToast('Plantilla aplicada al formulario', 'ok')
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function generate(campaignId: string) {
    const filters: Record<string, unknown> = {}
    if (genFilters.status) filters.status = genFilters.status
    if (genFilters.kind) filters.kind = genFilters.kind
    if (genFilters.city.trim()) filters.city = genFilters.city.trim()
    if (genFilters.hasEmail) filters.hasEmail = true

    startTransition(async () => {
      const result = await generateRecipients({ campaignId, filters })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      setGenOpen(null)
      setGenFilters(EMPTY_FILTERS)
      addToast('Lista de destinatarios lista', 'ok')
    })
  }

  function sent(id: string) {
    startTransition(async () => {
      const result = await markSent(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Campaña marcada como enviada', 'ok')
    })
  }

  function cancel(id: string) {
    startTransition(async () => {
      const result = await cancelCampaign(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Campaña cancelada', 'ok')
    })
  }

  function removeCampaign(id: string) {
    if (!window.confirm('¿Eliminar esta campaña y su lista de destinatarios?')) return
    startTransition(async () => {
      const result = await deleteCampaign(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Campaña eliminada', 'ok')
    })
  }

  function submitPoints() {
    startTransition(async () => {
      const result = await addPoints({
        clientId: pointsForm.clientId,
        points: Number(pointsForm.points),
        reason: pointsForm.reason,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      setPointsForm(EMPTY_POINTS)
      addToast('Movimiento registrado', 'ok')
    })
  }

  function removePoints(id: string) {
    if (!window.confirm('¿Eliminar este movimiento de puntos?')) return
    startTransition(async () => {
      const result = await deletePoints(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Movimiento eliminado', 'ok')
    })
  }

  function submitTemplate() {
    startTransition(async () => {
      const result = await addTemplate(templateForm)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      setTemplateForm(EMPTY_TEMPLATE)
      addToast('Plantilla guardada', 'ok')
    })
  }

  function removeTemplate(id: string) {
    if (!window.confirm('¿Eliminar esta plantilla?')) return
    startTransition(async () => {
      const result = await deleteTemplate(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Plantilla eliminada', 'ok')
    })
  }

  return (
    <>
      <div className="g3 g3--few" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat
            icon={<Send size={16} />}
            label="Campañas activas"
            value={state.activasCount}
            sub={`En preparación · ${state.campaigns.filter((c) => c.status === 'enviada').length} enviadas`}
          />
        </div>
        <div className="rise d2">
          <Stat
            icon={<Star size={16} />}
            tone="grn"
            label="Clientes con puntos"
            value={state.balances.length}
            sub="Con saldo · el saldo es la suma del libro"
          />
        </div>
      </div>

      <div className="card rise d3">
        <div className="chead">
          <div className="ctitle">Nueva campaña</div>
          <div className="csub">
            Compón el mensaje; la lista de destinatarios sale del directorio de clientes y el
            envío real llega con Integraciones.
          </div>
        </div>

        <div className="cpad" style={{ paddingBottom: 0 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 200px', minWidth: 150 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Nombre</div>
              <input
                className="field"
                value={campaignForm.name}
                maxLength={120}
                placeholder="Ej: Promoción de mitad de año"
                onChange={(e) => setCampaignForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div style={{ flex: '0 1 140px', minWidth: 110 }}>
              <div className="flabel">Canal</div>
              <Select
                value={campaignForm.channel}
                onChange={(v) => setCampaignForm((f) => ({ ...f, channel: v as CampaignChannel }))}
                options={(Object.keys(CHANNEL_LABELS) as CampaignChannel[]).map((c) => ({
                  value: c,
                  label: CHANNEL_LABELS[c],
                }))}
              />
            </div>
            <div style={{ flex: '1 1 260px', minWidth: 200 }}>
              <div className="flabel">Mensaje</div>
              <input
                className="field"
                value={campaignForm.message}
                maxLength={1000}
                placeholder="Texto de la campaña"
                onChange={(e) => setCampaignForm((f) => ({ ...f, message: e.target.value }))}
              />
            </div>
            <button
              className="btn dark"
              disabled={pending || campaignForm.name.trim().length < 2}
              aria-busy={pending}
              onClick={submitCampaign}
            >
              <Plus size={14} />Crear campaña
            </button>
          </div>
        </div>
      </div>

      <div className="card rise d4" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Campañas</div>
        </div>

        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Canal</th>
                <th scope="col">Mensaje</th>
                <th scope="col">Destinatarios</th>
                <th scope="col">Enviadas</th>
                <th scope="col">Estado</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {state.campaigns.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      Sin campañas.
                    </div>
                  </td>
                </tr>
              ) : state.campaigns.map((c) => (
                <Fragment key={c.id}>
                  <tr>
                    <td>
                      <div className="cename">{c.name}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{fmtDate(c.createdAt)}</div>
                    </td>
                    <td>{CHANNEL_LABELS[c.channel]}</td>
                    <td className="muted" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.message || '—'}
                    </td>
                    <td className="mono">{c.audienceCount}</td>
                    <td className="mono">{c.sentCount}</td>
                    <td><Badge st={cap(c.status)} tone={CAMPAIGN_TONE[c.status]} /></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {c.status === 'borrador' && (
                        <>
                          <button
                            className="ibtn"
                            style={{ width: 28, height: 28 }}
                            data-tip={genOpen === c.id ? 'Cerrar filtros' : 'Armar lista con filtros'}
                            disabled={pending}
                            onClick={() => setGenOpen((cur) => (cur === c.id ? null : c.id))}
                            aria-label={`Armar la lista de ${c.name}`}
                            aria-expanded={genOpen === c.id}
                          >
                            <Filter size={13} />
                          </button>
                          <button
                            className="ibtn"
                            style={{ width: 28, height: 28, color: 'var(--grnd)' }}
                            data-tip="Marcar enviada"
                            disabled={pending || c.audienceCount === 0}
                            onClick={() => sent(c.id)}
                            aria-label={`Marcar ${c.name} como enviada`}
                          >
                            <Send size={13} />
                          </button>
                        </>
                      )}
                      {(c.status === 'borrador' || c.status === 'programada') && (
                        <button
                          className="ibtn"
                          style={{ width: 28, height: 28, color: 'var(--ambd)' }}
                          data-tip="Cancelar"
                          disabled={pending}
                          onClick={() => cancel(c.id)}
                          aria-label={`Cancelar ${c.name}`}
                        >
                          <XCircle size={13} />
                        </button>
                      )}
                      <button
                        className="ibtn"
                        style={{ width: 28, height: 28, color: 'var(--redd)' }}
                        data-tip="Eliminar"
                        disabled={pending}
                        onClick={() => removeCampaign(c.id)}
                        aria-label={`Eliminar ${c.name}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                  {c.status === 'borrador' && genOpen === c.id && (
                    <tr key={`${c.id}-gen`}>
                      <td colSpan={7} style={{ background: 'var(--bf-2, var(--bg))', paddingTop: 12 }}>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                          <div style={{ flex: '1 1 160px', minWidth: 130 }}>
                            <div className="flabel" style={{ marginTop: 0 }}>Estado cliente</div>
                            <Select
                              value={genFilters.status}
                              onChange={(v) => setGenFilters((f) => ({ ...f, status: v }))}
                              options={STATUS_OPTS}
                            />
                          </div>
                          <div style={{ flex: '1 1 170px', minWidth: 140 }}>
                            <div className="flabel">Tipo</div>
                            <Select
                              value={genFilters.kind}
                              onChange={(v) => setGenFilters((f) => ({ ...f, kind: v }))}
                              options={KIND_OPTS}
                            />
                          </div>
                          <div style={{ flex: '1 1 160px', minWidth: 130 }}>
                            <div className="flabel">Ciudad</div>
                            <input
                              className="field"
                              value={genFilters.city}
                              placeholder="Bogotá…"
                              onChange={(e) => setGenFilters((f) => ({ ...f, city: e.target.value }))}
                            />
                          </div>
                          <div style={{ flex: '0 1 auto', minWidth: 130, alignSelf: 'center', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="checkbox"
                              id="gen-has-email"
                              checked={genFilters.hasEmail}
                              onChange={(e) => setGenFilters((f) => ({ ...f, hasEmail: e.target.checked }))}
                            />
                            <label htmlFor="gen-has-email" className="muted" style={{ fontSize: 13 }}>
                              Solo con correo
                            </label>
                          </div>
                          <button
                            className="btn dark"
                            disabled={pending}
                            aria-busy={pending}
                            onClick={() => generate(c.id)}
                          >
                            <UserCheck size={14} />Armar lista
                          </button>
                        </div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                          Sin filtros = todos los clientes con teléfono. Los filtros recortan el
                          directorio antes de armar la lista.
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card rise d5" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Plantillas</div>
          <div className="csub">
            El molde reutilizable de una campaña. Aplica una plantilla para rellenar el
            formulario de arriba y edita luego lo que haga falta.
          </div>
        </div>

        <div className="cpad" style={{ paddingBottom: 0 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 200px', minWidth: 150 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Nombre</div>
              <input
                className="field"
                value={templateForm.name}
                maxLength={120}
                placeholder="Ej: Bienvenida nuevo cliente"
                onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div style={{ flex: '0 1 140px', minWidth: 110 }}>
              <div className="flabel">Canal</div>
              <Select
                value={templateForm.channel}
                onChange={(v) => setTemplateForm((f) => ({ ...f, channel: v as CampaignChannel }))}
                options={(Object.keys(CHANNEL_LABELS) as CampaignChannel[]).map((c) => ({
                  value: c,
                  label: CHANNEL_LABELS[c],
                }))}
              />
            </div>
            <div style={{ flex: '1 1 320px', minWidth: 220 }}>
              <div className="flabel">Mensaje</div>
              <input
                className="field"
                value={templateForm.message}
                maxLength={1000}
                placeholder="Texto de la plantilla"
                onChange={(e) => setTemplateForm((f) => ({ ...f, message: e.target.value }))}
              />
            </div>
            <button
              className="btn dark"
              disabled={pending || templateForm.name.trim().length < 2}
              aria-busy={pending}
              onClick={submitTemplate}
            >
              <Plus size={14} />Guardar plantilla
            </button>
          </div>
        </div>

        <div className="tblwrap" style={{ marginTop: 12 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Canal</th>
                <th scope="col">Mensaje</th>
                <th scope="col">Creada</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {state.templates.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      Sin plantillas.
                    </div>
                  </td>
                </tr>
              ) : state.templates.map((t) => (
                <tr key={t.id}>
                  <td>
                    <div className="cename">
                      <FileText size={12} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                      {t.name}
                    </div>
                  </td>
                  <td>{CHANNEL_LABELS[t.channel]}</td>
                  <td className="muted" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.message || '—'}
                  </td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{fmtDate(t.createdAt)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      className="ibtn"
                      style={{ width: 28, height: 28 }}
                      data-tip="Aplicar al formulario de campaña"
                      disabled={pending}
                      onClick={() => applyTemplate(t)}
                      aria-label={`Aplicar la plantilla ${t.name}`}
                    >
                      <Plus size={13} />
                    </button>
                    <button
                      className="ibtn"
                      style={{ width: 28, height: 28, color: 'var(--redd)' }}
                      data-tip="Eliminar plantilla"
                      disabled={pending}
                      onClick={() => removeTemplate(t.id)}
                      aria-label={`Eliminar la plantilla ${t.name}`}
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

      <div className="card rise d6" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Fidelización</div>
          <div className="csub">
            Puntos positivos por compra, negativos por redención. Cada movimiento pide un motivo.
          </div>
        </div>

        <div className="cpad" style={{ paddingBottom: 0 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 220px', minWidth: 170 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Cliente</div>
              <Select
                value={pointsForm.clientId}
                onChange={(v) => setPointsForm((f) => ({ ...f, clientId: v }))}
                options={[{ value: '', label: 'Elige…' }, ...clientOpts]}
              />
            </div>
            <div style={{ flex: '0 1 110px', minWidth: 90 }}>
              <div className="flabel">Puntos</div>
              <input
                type="number"
                className="field"
                value={pointsForm.points}
                placeholder="+100 o -50"
                onChange={(e) => setPointsForm((f) => ({ ...f, points: e.target.value }))}
              />
            </div>
            <div style={{ flex: '1 1 240px', minWidth: 180 }}>
              <div className="flabel">Motivo</div>
              <input
                className="field"
                value={pointsForm.reason}
                maxLength={200}
                placeholder="Ej: compra del 12 de agosto"
                onChange={(e) => setPointsForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>
            <button
              className="btn dark"
              disabled={pending || !pointsForm.clientId || !pointsForm.points || pointsForm.reason.trim().length < 2}
              aria-busy={pending}
              onClick={submitPoints}
            >
              <Plus size={14} />Registrar
            </button>
          </div>
        </div>

        {state.balances.length > 0 && (
          <div className="cpad" style={{ paddingTop: 10, paddingBottom: 0 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {state.balances.slice(0, 12).map((b) => (
                <div
                  key={b.clientId}
                  className="chip"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <Star size={12} color="var(--ambd)" />
                  {b.clientName}
                  <b className="mono">{b.balance > 0 ? '+' : ''}{b.balance}</b>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="tblwrap" style={{ marginTop: 12 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Cliente</th>
                <th scope="col">Puntos</th>
                <th scope="col">Motivo</th>
                <th scope="col">Fecha</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {state.points.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      Sin movimientos de puntos.
                    </div>
                  </td>
                </tr>
              ) : state.points.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="cename">{p.clientName}</div>
                  </td>
                  <td className={`mono ${p.points > 0 ? '' : ''}`} style={{ color: p.points > 0 ? 'var(--grnd)' : 'var(--redd)' }}>
                    {p.points > 0 ? '+' : ''}{p.points}
                  </td>
                  <td className="muted">{p.reason}</td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{fmtDate(p.createdAt)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      className="ibtn"
                      style={{ width: 28, height: 28, color: 'var(--redd)' }}
                      data-tip="Eliminar movimiento"
                      disabled={pending}
                      onClick={() => removePoints(p.id)}
                      aria-label={`Eliminar el movimiento de ${p.clientName}`}
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