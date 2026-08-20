'use client'

import { useState, useTransition } from 'react'
import { Copy, Link2, Plus, ShieldCheck, Trash2, XCircle } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import { useApp } from '@/lib/context/AppContext'
import type { StatusTone } from '@/lib/types'
import type { PortalData, PortalKind } from '@/server/queries/portal'
import { createLink, deleteLink, revokeLink } from '@/server/mutations/portal'

const DAY = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short' })
const fmtDate = (iso: string | null) => (iso ? DAY.format(new Date(iso)) : '—')

const KIND_LABELS: Record<PortalKind, string> = {
  factura: 'Factura',
  cita: 'Cita',
  avance: 'Avance de obra',
}

const LINK_TONE: Record<string, StatusTone> = {
  Activo: 'grn',
  Vencido: 'amb',
  Revocado: 'red',
  Agotado: 'neu',
}

const EMPTY_FORM = { kind: 'factura' as PortalKind, targetId: '', label: '', days: '7', maxViews: '' }

export default function PortalPage({ data }: { data: PortalData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState(data)
  const [form, setForm] = useState(EMPTY_FORM)
  const [created, setCreated] = useState<{ url: string; label: string } | null>(null)

  const targetOpts = (kind: PortalKind) => {
    if (kind === 'factura') {
      return state.facturas.map((f) => ({
        value: f.id,
        label: `${f.code ?? '—'} · ${f.client || 'Sin cliente'}`,
      }))
    }
    if (kind === 'cita') {
      return state.citas.map((c) => ({
        value: c.id,
        label: `${fmtDate(c.scheduledFor)} · ${c.patient}`,
      }))
    }
    return state.avances.map((a) => ({ value: a.id, label: a.name }))
  }

  async function copyUrl(url: string, message: string) {
    try {
      await navigator.clipboard.writeText(url)
      addToast(message, 'ok')
    } catch {
      addToast('No se pudo copiar. Copia la URL a mano.', 'err')
    }
  }

  function submit() {
    startTransition(async () => {
      const result = await createLink({
        kind: form.kind,
        targetId: form.targetId,
        label: form.label,
        days: Number(form.days),
        maxViews: form.maxViews === '' ? null : Number(form.maxViews),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      setCreated({ url: result.url, label: form.label })
      setForm(EMPTY_FORM)
      addToast('Enlace creado', 'ok')
    })
  }

  function revoke(id: string) {
    startTransition(async () => {
      const result = await revokeLink(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Enlace revocado', 'ok')
    })
  }

  function remove(id: string) {
    if (!window.confirm('¿Eliminar este enlace? Nadie podrá volver a abrirlo.')) return
    startTransition(async () => {
      const result = await deleteLink(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Enlace eliminado', 'ok')
    })
  }

  return (
    <>
      <div className="g3 g3--few" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat
            icon={<Link2 size={16} />}
            label="Activos"
            value={state.links.filter((l) => l.status === 'Activo').length}
            sub={`${state.links.length} creados`}
          />
        </div>
        <div className="rise d2">
          <Stat
            icon={<ShieldCheck size={16} />}
            tone="grn"
            label="Vistas"
            value={state.vistasCount}
            sub="Cada apertura queda registrada"
          />
        </div>
      </div>

      <div className="card rise d3">
        <div className="chead">
          <div className="ctitle">Nuevo enlace</div>
          <div className="csub">
            Cualquiera con la URL puede verlo, sin cuenta. Vence solo, o lo revocas tú.
          </div>
        </div>

        <div className="cpad">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '0 1 150px', minWidth: 120 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Qué compartes</div>
              <Select
                value={form.kind}
                onChange={(v) => setForm((f) => ({ ...f, kind: v as PortalKind, targetId: '' }))}
                options={(Object.keys(KIND_LABELS) as PortalKind[]).map((k) => ({
                  value: k,
                  label: KIND_LABELS[k],
                }))}
              />
            </div>
            <div style={{ flex: '1 1 260px', minWidth: 200 }}>
              <div className="flabel">Elemento</div>
              <Select
                value={form.targetId}
                onChange={(v) => setForm((f) => ({ ...f, targetId: v }))}
                options={[
                  { value: '', label: 'Elige…' },
                  ...targetOpts(form.kind),
                ]}
              />
            </div>
            <div style={{ flex: '1 1 200px', minWidth: 150 }}>
              <div className="flabel">Etiqueta</div>
              <input
                className="field"
                value={form.label}
                maxLength={120}
                placeholder="Ej: Factura de marzo para María"
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>
            <div style={{ flex: '0 1 110px', minWidth: 90 }}>
              <div className="flabel">Vigencia</div>
              <Select
                value={form.days}
                onChange={(v) => setForm((f) => ({ ...f, days: v }))}
                options={[
                  { value: '1', label: '1 día' },
                  { value: '7', label: '7 días' },
                  { value: '14', label: '14 días' },
                  { value: '30', label: '30 días' },
                ]}
              />
            </div>
            <div style={{ flex: '0 1 130px', minWidth: 100 }}>
              <div className="flabel">Máx. vistas</div>
              <input
                type="number"
                className="field"
                min={1}
                max={1000}
                value={form.maxViews}
                placeholder="Sin límite"
                onChange={(e) => setForm((f) => ({ ...f, maxViews: e.target.value }))}
              />
            </div>
            <button
              className="btn dark"
              disabled={pending || !form.targetId || form.label.trim().length < 2}
              aria-busy={pending}
              onClick={submit}
            >
              <Plus size={14} />Crear enlace
            </button>
          </div>
        </div>
      </div>

      {created && (
        <div className="card rise d4" style={{ marginTop: 16, borderColor: 'var(--grnd)' }}>
          <div className="cpad" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <ShieldCheck size={18} color="var(--grnd)" />
            <div style={{ flex: '1 1 300px', minWidth: 240 }}>
              <div className="cename">«{created.label}» — enlace listo</div>
              <div className="mono muted" style={{ fontSize: 12, wordBreak: 'break-all', marginTop: 2 }}>
                {created.url}
              </div>
            </div>
            <button
              className="btn ghost"
              onClick={() => copyUrl(created.url, 'Enlace copiado')}
            >
              <Copy size={14} />Copiar enlace
            </button>
          </div>
        </div>
      )}

      <div className="card rise d5" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Enlaces</div>
        </div>

        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Etiqueta</th>
                <th scope="col">Qué comparte</th>
                <th scope="col">Vence</th>
                <th scope="col">Vistas</th>
                <th scope="col">Estado</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {state.links.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      Sin enlaces. Crea el primero y compártelo por WhatsApp, correo o SMS.
                    </div>
                  </td>
                </tr>
              ) : state.links.map((l) => (
                <tr key={l.id}>
                  <td>
                    <div className="cename">{l.label}</div>
                    <div className="muted mono" style={{ fontSize: 12 }}>{fmtDate(l.createdAt)}</div>
                  </td>
                  <td>{KIND_LABELS[l.kind]}</td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{fmtDate(l.expiresAt)}</td>
                  <td className="mono">
                    {l.viewCount}{l.maxViews !== null ? ` / ${l.maxViews}` : ''}
                  </td>
                  <td><Badge st={l.status} tone={LINK_TONE[l.status]} /></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {l.status === 'Activo' && (
                      <>
                        <button
                          className="ibtn"
                          style={{ width: 28, height: 28 }}
                          data-tip="Copiar enlace"
                          disabled={pending}
                          onClick={() => copyUrl(`${state.baseUrl}/portal/${l.token}`, 'Enlace copiado')}
                          aria-label={`Copiar el enlace de ${l.label}`}
                        >
                          <Copy size={13} />
                        </button>
                        <button
                          className="ibtn"
                          style={{ width: 28, height: 28, color: 'var(--ambd)' }}
                          data-tip="Revocar"
                          disabled={pending}
                          onClick={() => revoke(l.id)}
                          aria-label={`Revocar el enlace de ${l.label}`}
                        >
                          <XCircle size={13} />
                        </button>
                      </>
                    )}
                    <button
                      className="ibtn"
                      style={{ width: 28, height: 28, color: 'var(--redd)' }}
                      data-tip="Eliminar"
                      disabled={pending}
                      onClick={() => remove(l.id)}
                      aria-label={`Eliminar el enlace de ${l.label}`}
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
