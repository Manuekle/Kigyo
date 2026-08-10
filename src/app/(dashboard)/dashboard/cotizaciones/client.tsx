'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  Receipt, TrendingUp, Check, Clock, Plus, X, PenLine, Trash2, ChevronRight,
} from '@/lib/icons'
import Stat from '@/components/ui/Stat'
import Badge from '@/components/ui/Badge'
import TabBar from '@/components/ui/TabBar'
import Select from '@/components/ui/Select'
import DatePicker from '@/components/ui/DatePicker'
import FormDrawer from '@/components/ui/FormDrawer'
import { useApp } from '@/lib/context/AppContext'
import { activatable } from '@/lib/a11y'
import { cop } from '@/lib/utils'
import { QUOTE_KINDS, QUOTE_STATUSES, lineTotalCents, pesosToCents } from '@/lib/domain'
import LoadMore from '@/components/ui/LoadMore'
import Drawer from '@/components/ui/Drawer'
import type { CotizacionesData, CotizacionRow, CotizacionItem } from '@/server/queries/cotizaciones'
import { fetchMoreCotizaciones } from '@/server/actions/cotizaciones'
import {
  createCotizacion, deleteCotizacion, setCotizacionStatus, updateCotizacion,
} from '@/server/mutations/cotizaciones'

const DAY = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
const fmt = (iso: string | null) => (iso ? DAY.format(new Date(`${iso}T00:00:00`)) : '—')

type DraftItem = { productId: string | null; description: string; quantity: string; price: string }

const EMPTY_DRAFT: DraftItem = { productId: null, description: '', quantity: '1', price: '' }

const EMPTY_FORM = {
  client: '', contact: '', projectId: '', ownerId: '',
  kind: 'Comercial', probability: '0', expiresOn: '', notes: '',
  items: [{ ...EMPTY_DRAFT }] as DraftItem[],
}

type FormState = typeof EMPTY_FORM

function toForm(q: CotizacionRow): FormState {
  return {
    client: q.client,
    contact: q.contact,
    projectId: q.projectId ?? '',
    ownerId: q.ownerId ?? '',
    kind: q.kind,
    probability: String(q.probability),
    expiresOn: q.expiresOn ?? '',
    notes: q.notes,
    items: q.items.length > 0
      ? q.items.map((i) => ({
        productId: i.productId,
        description: i.description,
        quantity: String(i.quantity),
        price: String(i.unitPriceCents / 100),
      }))
      : [{ ...EMPTY_DRAFT }],
  }
}

const lineTotal = (i: DraftItem) =>
  lineTotalCents(Number(i.quantity) || 0, pesosToCents(i.price))

export default function CotizacionesPage({ data }: { data: CotizacionesData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState<CotizacionesData>(data)
  const [filter, setFilter] = useState('Todas')
  const [selected, setSelected] = useState<CotizacionRow | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<CotizacionRow | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const { cotizaciones } = state

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreCotizaciones(cotizaciones.length)
      if (!result.ok) {
        setLoadMoreError(result.error)
        return
      }
      setState((prev) => {
        const seen = new Set(prev.cotizaciones.map((q) => q.id))
        return {
          ...prev,
          cotizaciones: [
            ...prev.cotizaciones,
            ...result.data.rows.filter((q) => !seen.has(q.id)),
          ],
          cotizacionesTotal: result.data.total,
        }
      })
    })
  }

  const stats = useMemo(() => {
    const open = cotizaciones.filter((q) => q.status === 'Borrador' || q.status === 'Enviada')
    return {
      total: state.cotizacionesTotal,
      open: open.length,
      won: cotizaciones.filter((q) => q.status === 'Aceptada').length,
      // Weighted pipeline: value × probability, which is what the number is
      // for. The fixture summed raw totals and called it a forecast.
      pipeline: open.reduce((s, q) => s + Math.round(q.totalCents * (q.probability / 100)), 0),
    }
  }, [cotizaciones, state.cotizacionesTotal])

  const filtered = filter === 'Todas' ? cotizaciones : cotizaciones.filter((q) => q.status === filter)

  function apply(next: CotizacionesData, message: string) {
    setState(next)
    addToast(message, 'ok')
  }

  function openEditor(q: CotizacionRow | null) {
    setEditing(q)
    setForm(q ? toForm(q) : EMPTY_FORM)
    setEditorOpen(true)
  }

  function submit() {
    if (!form.client.trim()) { addToast('El cliente es obligatorio', 'err'); return }

    const items = form.items
      .filter((i) => i.description.trim() && Number(i.quantity) > 0)
      .map((i) => ({
        productId: i.productId,
        description: i.description.trim(),
        quantity: Number(i.quantity),
        unitPriceCents: pesosToCents(i.price),
      }))

    startTransition(async () => {
      const payload = {
        client: form.client.trim(),
        contact: form.contact.trim(),
        projectId: form.projectId || null,
        ownerId: form.ownerId || null,
        kind: form.kind as (typeof QUOTE_KINDS)[number],
        probability: Math.min(100, Math.max(0, Number(form.probability) || 0)),
        expiresOn: form.expiresOn || null,
        notes: form.notes.trim(),
        items,
      }
      const result = editing
        ? await updateCotizacion({ ...payload, id: editing.id })
        : await createCotizacion(payload)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setEditorOpen(false)
      setEditing(null)
      setSelected(null)
      apply(result.data, editing ? 'Cotización actualizada' : 'Cotización creada')
    })
  }

  function changeStatus(q: CotizacionRow, status: string) {
    startTransition(async () => {
      const result = await setCotizacionStatus({ id: q.id, status: status as 'Enviada' })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setSelected(null)
      apply(result.data, `Cotización ${status.toLowerCase()}`)
    })
  }

  function remove(q: CotizacionRow) {
    if (!window.confirm(`¿Eliminar la cotización de "${q.client}"?`)) return
    startTransition(async () => {
      const result = await deleteCotizacion(q.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setSelected(null)
      apply(result.data, 'Cotización eliminada')
    })
  }

  /** Picking a catalogue product fills the line from the catalogue price. */
  function pickProduct(index: number, productId: string) {
    const product = state.productos.find((p) => p.id === productId)
    setForm((f) => ({
      ...f,
      items: f.items.map((item, i) => i === index
        ? product
          ? { productId: product.id, description: `${product.sku} · ${product.name}`, quantity: item.quantity, price: String(product.priceCents / 100) }
          : { ...item, productId: null }
        : item),
    }))
  }

  const draftTotal = form.items.reduce((s, i) => s + lineTotal(i), 0)

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat icon={<Receipt size={16} />} tone="blu" label="Cotizaciones" value={stats.total} /></div>
        <div className="rise d2"><Stat icon={<Clock size={16} />} tone="amb" label="Abiertas" value={stats.open} sub="borrador o enviadas" /></div>
        <div className="rise d3"><Stat icon={<Check size={16} />} tone="grn" label="Aceptadas" value={stats.won} /></div>
        <div className="rise d4"><Stat icon={<TrendingUp size={16} />} tone="vio" label="Pipeline ponderado" value={cop(stats.pipeline / 100)} sub="valor × probabilidad" /></div>
      </div>

      <div className="card rise d2">
        <div className="chead" style={{ flexWrap: 'wrap', gap: 10 }}>
          <TabBar
            value={filter}
            onChange={setFilter}
            items={['Todas', ...QUOTE_STATUSES].map((s) => ({
              key: s,
              label: s === 'Todas' ? `Todas · ${cotizaciones.length}` : `${s} · ${cotizaciones.filter((q) => q.status === s).length}`,
            }))}
          />
          {state.canWrite && (
            <button className="btn pri" onClick={() => openEditor(null)}><Plus size={15} />Nueva cotización</button>
          )}
        </div>
        <div className="tblwrap">
          <table className="tbl">
            <thead><tr><th scope="col">Cliente</th><th scope="col">Proyecto</th><th scope="col">Líneas</th><th scope="col">Total</th><th scope="col">Prob.</th><th scope="col">Estado</th><th scope="col"></th></tr></thead>
            <tbody>
              {cotizaciones.length === 0 ? (
                <tr><td colSpan={7}><div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                  {state.canWrite ? 'Todavía no hay cotizaciones. Crea la primera.' : 'Todavía no hay cotizaciones.'}
                </div></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7}><div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>No hay cotizaciones en este estado.</div></td></tr>
              ) : filtered.map((q) => (
                <tr className="trow" key={q.id} style={{ cursor: 'pointer' }} {...activatable(() => setSelected(q), `Abrir la cotización de ${q.client}`)}>
                  <td>
                    <div className="cename">{q.client}</div>
                    <div className="ceid mono">{q.code ?? '—'} · {fmt(q.issuedOn)}</div>
                  </td>
                  <td className="muted">{q.projectLabel ?? '—'}</td>
                  <td className="muted">{q.items.length}</td>
                  {/* Derived from the lines. The fixture stored a total that
                      nothing recomputed when a price moved. */}
                  <td className="cename">{cop(q.totalCents / 100)}</td>
                  <td className="muted">{q.probability}%</td>
                  <td><Badge st={q.status} /></td>
                  <td style={{ textAlign: 'right' }}><ChevronRight size={16} color="var(--ink3)" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <LoadMore
          loaded={cotizaciones.length}
          total={state.cotizacionesTotal}
          loading={loadingMore}
          error={loadMoreError}
          onLoadMore={loadMore}
          noun="cotizaciones"
        />
      </div>

      <Drawer value={selected} onClose={() => setSelected(null)}>
        {(row) => (
          <>
            <div className="dhead tkhead">
              <div className="dmark" style={{ background: 'linear-gradient(145deg,#3ed694,#1f9d63)', boxShadow: '0 8px 18px -8px #1f9d6399' }}>
                <Receipt size={19} color="#fff" />
              </div>
              <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
                <div className="dh-t">{row.client}</div>
                <div className="dh-s mono">{row.code ?? '—'}</div>
              </div>
              <button className="ibtn" onClick={() => setSelected(null)} style={{ position: 'relative', zIndex: 1 }} aria-label="Cerrar"><X size={18} /></button>
            </div>
            <div className="dbody">
              {state.canWrite ? (
                <Select value={row.status} onChange={(v) => changeStatus(row, v)} options={[...QUOTE_STATUSES]} />
              ) : (
                <Badge st={row.status} filled />
              )}

              <div className="dsect">Datos</div>
              <div className="elrow"><div className="eltxt">Contacto</div><div className="elsub">{row.contact || '—'}</div></div>
              <div className="elrow"><div className="eltxt">Proyecto</div><div className="elsub">{row.projectLabel ?? '—'}</div></div>
              <div className="elrow"><div className="eltxt">Responsable</div><div className="elsub">{row.ownerName ?? '—'}</div></div>
              <div className="elrow"><div className="eltxt">Tipo</div><div className="elsub">{row.kind}</div></div>
              <div className="elrow"><div className="eltxt">Vence</div><div className="elsub">{fmt(row.expiresOn)}</div></div>

              <div className="dsect">Líneas</div>
              {row.items.length === 0 ? (
                <div className="dempty" style={{ padding: '12px 0' }}>Esta cotización no tiene líneas.</div>
              ) : row.items.map((item: CotizacionItem) => (
                <div className="elrow" key={item.id}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="eltxt" style={{ fontSize: 13 }}>{item.description}</div>
                    <div className="elsub">{item.quantity} × {cop(item.unitPriceCents / 100)}</div>
                  </div>
                  <div className="eltxt">{cop(Math.round(item.quantity * item.unitPriceCents) / 100)}</div>
                </div>
              ))}
              <div className="elrow" style={{ borderTop: '1px solid var(--line2)', paddingTop: 10, marginTop: 8 }}>
                <div className="eltxt">Total</div>
                <div className="eltxt" style={{ fontSize: 16 }}>{cop(row.totalCents / 100)}</div>
              </div>

              {row.notes && (
                <>
                  <div className="dsect">Notas</div>
                  <p style={{ fontSize: 13, color: 'var(--ink2)', margin: 0, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{row.notes}</p>
                </>
              )}
            </div>
            {state.canWrite && (
              <div className="dacts">
                <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => openEditor(row)}>
                  <PenLine size={15} />Editar
                </button>
                <button className="ibtn" style={{ color: 'var(--redd)' }} disabled={pending} onClick={() => remove(row)} aria-label="Eliminar cotización">
                  <Trash2 size={17} />
                </button>
              </div>
            )}
          </>
        )}
      </Drawer>

      {/* Same reasoning as the requisición editor: this form carries a
          line-item repeater and cannot live in a 90vh centred box. */}
      <FormDrawer
        wide
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? 'Editar cotización' : 'Nueva cotización'}
        footer={
          <>
            <span />
            <div style={{ display: 'flex', gap: 9 }}>
              <button className="btn" onClick={() => setEditorOpen(false)} disabled={pending}>Cancelar</button>
              <button className="btn dark" onClick={submit} disabled={pending} aria-busy={pending}>
                <Check size={14} />{pending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </>
        }
      >
              <div className="fg2">
                <div>
                  <div className="flabel" style={{ marginTop: 0 }}>Cliente</div>
                  <input className="field" value={form.client} onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))} placeholder="Ej. Energía Limpia SA" />
                </div>
                <div>
                  <div className="flabel" style={{ marginTop: 0 }}>Contacto</div>
                  <input className="field" value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} />
                </div>
              </div>
              <div className="fg2">
                <div>
                  <div className="flabel">Tipo</div>
                  <Select value={form.kind} onChange={(v) => setForm((f) => ({ ...f, kind: v }))} options={[...QUOTE_KINDS]} />
                </div>
                <div>
                  <div className="flabel">Probabilidad (%)</div>
                  <input className="field" type="number" min={0} max={100} value={form.probability} onChange={(e) => setForm((f) => ({ ...f, probability: e.target.value }))} />
                </div>
              </div>
              {state.proyectos.length > 0 && (
                <>
                  <div className="flabel">Proyecto</div>
                  <Select
                    value={form.projectId}
                    onChange={(v) => setForm((f) => ({ ...f, projectId: v }))}
                    placeholder="Sin proyecto"
                    options={[
                      { value: '', label: 'Sin proyecto' },
                      ...state.proyectos.map((p) => ({ value: p.id, label: [p.code, p.name].filter(Boolean).join(' · ') })),
                    ]}
                  />
                </>
              )}
              {state.roster.length > 0 && (
                <>
                  <div className="flabel">Responsable</div>
                  <Select
                    value={form.ownerId}
                    onChange={(v) => setForm((f) => ({ ...f, ownerId: v }))}
                    placeholder="Sin responsable"
                    options={[
                      { value: '', label: 'Sin responsable' },
                      ...state.roster.map((r) => ({ value: r.employeeId, label: r.fullName })),
                    ]}
                  />
                </>
              )}
              <div className="flabel">Vence</div>
              <DatePicker ariaLabel="Vence" value={form.expiresOn} onChange={(v) => setForm((f) => ({ ...f, expiresOn: v }))} />

              <div className="dsect">Líneas</div>
              {form.items.map((item, index) => (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--line2)' }}>
                  {state.productos.length > 0 && (
                    <Select
                      value={item.productId ?? ''}
                      onChange={(v) => pickProduct(index, v)}
                      placeholder="Línea libre"
                      options={[
                        { value: '', label: 'Línea libre' },
                        ...state.productos.map((p) => ({ value: p.id, label: `${p.sku} · ${p.name}` })),
                      ]}
                    />
                  )}
                  <input
                    className="field"
                    placeholder="Descripción"
                    value={item.description}
                    onChange={(e) => setForm((f) => ({
                      ...f,
                      items: f.items.map((it, i) => (i === index ? { ...it, description: e.target.value } : it)),
                    }))}
                  />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      className="field" type="number" min={0} step="0.01" style={{ width: 90 }}
                      value={item.quantity}
                      aria-label="Cantidad"
                      onChange={(e) => setForm((f) => ({
                        ...f,
                        items: f.items.map((it, i) => (i === index ? { ...it, quantity: e.target.value } : it)),
                      }))}
                    />
                    <input
                      className="field" type="number" min={0} style={{ flex: 1 }}
                      value={item.price}
                      placeholder="Precio unitario"
                      aria-label="Precio unitario"
                      onChange={(e) => setForm((f) => ({
                        ...f,
                        items: f.items.map((it, i) => (i === index ? { ...it, price: e.target.value } : it)),
                      }))}
                    />
                    <span className="eltxt" style={{ minWidth: 90, textAlign: 'right' }}>{cop(lineTotal(item) / 100)}</span>
                    <button
                      className="ibtn" style={{ width: 28, height: 28 }}
                      onClick={() => setForm((f) => ({
                        ...f,
                        items: f.items.length > 1 ? f.items.filter((_, i) => i !== index) : f.items,
                      }))}
                      aria-label="Quitar línea"
                    ><X size={13} /></button>
                  </div>
                </div>
              ))}
              <button className="btn ghost" onClick={() => setForm((f) => ({ ...f, items: [...f.items, { ...EMPTY_DRAFT }] }))}>
                <Plus size={14} />Añadir línea
              </button>

              <div className="elrow" style={{ marginTop: 12 }}>
                <div className="eltxt">Total</div>
                <div className="eltxt" style={{ fontSize: 16 }}>{cop(draftTotal / 100)}</div>
              </div>

              <div className="flabel">Notas</div>
              <textarea className="field" rows={2} style={{ resize: 'none' }} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
      </FormDrawer>
    </>
  )
}
