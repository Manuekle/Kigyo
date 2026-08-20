'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  ShoppingCart, Clock, Check, FileCheck2, Plus, X, PenLine, Trash2, ChevronRight, FileSpreadsheet,
  Wallet, Calendar,
} from '@/lib/icons'
import Stat from '@/components/ui/Stat'
import Badge from '@/components/ui/Badge'
import TabBar from '@/components/ui/TabBar'
import Select from '@/components/ui/Select'
import DatePicker from '@/components/ui/DatePicker'
import FormDrawer from '@/components/ui/FormDrawer'
import { useApp } from '@/lib/context/AppContext'
import { useExport } from '@/lib/hooks/use-export'
import { activatable } from '@/lib/a11y'
import { cop } from '@/lib/utils'
import {
  PURCHASE_CATEGORIES, PURCHASE_REQUEST_STATUSES, PURCHASE_URGENCIES,
  lineTotalCents, pesosToCents,
} from '@/lib/domain'
import LoadMore from '@/components/ui/LoadMore'
import Drawer from '@/components/ui/Drawer'
import type { ComprasData, CompraRow } from '@/server/queries/compras'
import { fetchMoreCompras } from '@/server/actions/compras'
import type { PurchaseRequestEvent, SupplierInvoiceRow } from '@/server/mutations/compras'
import {
  cancelSupplierPayment, createCompra, createSupplierInvoice, deleteCompra,
  deleteSupplierInvoice, fetchRequestEvents, fetchSupplierInvoices, generateOrder,
  registerSupplierPayment, setCompraStatus, setSupplierInvoiceStatus, updateCompra,
} from '@/server/mutations/compras'

const DAY = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
const fmt = (iso: string | null) => (iso ? DAY.format(new Date(`${iso}T00:00:00`)) : '—')
const fmtDTI = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
})
const fmtDT = (iso: string) => fmtDTI.format(new Date(iso))

type DraftItem = { productId: string | null; description: string; quantity: string; unit: string; cost: string }

const EMPTY_ITEM: DraftItem = { productId: null, description: '', quantity: '1', unit: 'UN', cost: '' }
const EMPTY_FORM = {
  supplier: '', projectId: '', ownerId: '', category: 'Materiales',
  urgency: 'Normal', neededOn: '', notes: '', items: [{ ...EMPTY_ITEM }] as DraftItem[],
}
type FormState = typeof EMPTY_FORM

const SUPPLIER_INVOICE_STATUSES = ['Pendiente', 'En revisión', 'Pagada', 'Anulada'] as const
type SupplierInvoiceStatus = (typeof SUPPLIER_INVOICE_STATUSES)[number]

type InvoiceDraftItem = { description: string; quantity: string; unitPriceCents: string }

const EMPTY_INVOICE_ITEM: InvoiceDraftItem = { description: '', quantity: '1', unitPriceCents: '' }
const EMPTY_INVOICE_FORM = {
  supplier: '', issuedOn: '', items: [{ ...EMPTY_INVOICE_ITEM }] as InvoiceDraftItem[],
}
type InvoiceFormState = typeof EMPTY_INVOICE_FORM

const EMPTY_PAYMENT_FORM = {
  invoiceId: '', mode: 'paid' as 'paid' | 'scheduled', amount: '', method: 'Transferencia',
  reference: '', paidOn: '', scheduledOn: '',
}
type PaymentFormState = typeof EMPTY_PAYMENT_FORM

const invoiceLineTotalCents = (i: InvoiceDraftItem) =>
  Number(i.quantity) * (Number(i.unitPriceCents) || 0)

const lineTotal = (i: DraftItem) =>
  lineTotalCents(Number(i.quantity) || 0, pesosToCents(i.cost))

function toForm(c: CompraRow): FormState {
  return {
    supplier: c.supplier,
    projectId: c.projectId ?? '',
    ownerId: c.ownerId ?? '',
    category: c.category,
    urgency: c.urgency,
    neededOn: c.neededOn ?? '',
    notes: c.notes,
    items: c.items.length > 0
      ? c.items.map((i) => ({
        productId: i.productId,
        description: i.description,
        quantity: String(i.quantity),
        unit: i.unit,
        cost: String(i.unitCostCents / 100),
      }))
      : [{ ...EMPTY_ITEM }],
  }
}

export default function ComprasPage({ data }: { data: ComprasData }) {
  const { addToast } = useApp()
  const { runExport, exporting } = useExport()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState<ComprasData>(data)
  const [filter, setFilter] = useState('Todas')
  const [selected, setSelected] = useState<CompraRow | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<CompraRow | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const [invoices, setInvoices] = useState<SupplierInvoiceRow[]>([])
  const [invoiceLoaded, setInvoiceLoaded] = useState(false)
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [invoiceForm, setInvoiceForm] = useState<InvoiceFormState>(EMPTY_INVOICE_FORM)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(EMPTY_PAYMENT_FORM)

  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const [expanded, setExpanded] = useState<string | null>(null)
  const [timeline, setTimeline] = useState<Record<string, PurchaseRequestEvent[]>>({})
  const [timelineLoading, setTimelineLoading] = useState<string | null>(null)

  const { compras } = state

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreCompras(compras.length)
      if (!result.ok) {
        setLoadMoreError(result.error)
        return
      }
      setState((prev) => {
        const seen = new Set(prev.compras.map((c) => c.id))
        return {
          ...prev,
          compras: [...prev.compras, ...result.data.rows.filter((c) => !seen.has(c.id))],
          comprasTotal: result.data.total,
        }
      })
    })
  }

  const stats = useMemo(() => ({
    total: state.comprasTotal,
    pending: compras.filter((c) => c.status === 'Pendiente').length,
    approved: compras.filter((c) => c.status === 'Aprobada').length,
    ordered: compras.filter((c) => c.status === 'OC generada').length,
    // Only what is still open commits money; a rejected requisition does not.
    committed: compras
      .filter((c) => c.status === 'Pendiente' || c.status === 'Aprobada')
      .reduce((s, c) => s + c.totalCents, 0),
  }), [compras, state.comprasTotal])

  const filtered = filter === 'Todas' ? compras : compras.filter((c) => c.status === filter)

  const exportRows = () => {
    void runExport(
      filtered.map((c) => ({
        Código: c.code ?? '',
        Proveedor: c.supplier,
        Proyecto: c.projectLabel ?? '',
        Total: cop(c.totalCents / 100),
        Urgencia: c.urgency,
        Estado: c.status,
      })),
      'requisiciones-kigyo',
      'compras',
    )
  }

  function apply(next: ComprasData, message: string) {
    setState(next)
    addToast(message, 'ok')
  }

  function openEditor(c: CompraRow | null) {
    setEditing(c)
    setForm(c ? toForm(c) : EMPTY_FORM)
    setEditorOpen(true)
  }

  function submit() {
    const items = form.items
      .filter((i) => i.description.trim() && Number(i.quantity) > 0)
      .map((i) => ({
        productId: i.productId,
        description: i.description.trim(),
        quantity: Number(i.quantity),
        unit: i.unit,
        unitCostCents: pesosToCents(i.cost),
      }))

    if (items.length === 0) { addToast('Agrega al menos una línea', 'err'); return }

    startTransition(async () => {
      const payload = {
        supplier: form.supplier.trim(),
        projectId: form.projectId || null,
        ownerId: form.ownerId || null,
        category: form.category as (typeof PURCHASE_CATEGORIES)[number],
        urgency: form.urgency as (typeof PURCHASE_URGENCIES)[number],
        neededOn: form.neededOn || null,
        notes: form.notes.trim(),
        items,
      }
      const result = editing
        ? await updateCompra({ ...payload, id: editing.id })
        : await createCompra(payload)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setEditorOpen(false)
      setEditing(null)
      setSelected(null)
      apply(result.data, editing ? 'Requisición actualizada' : 'Requisición creada')
    })
  }

  function changeStatus(c: CompraRow, status: string) {
    startTransition(async () => {
      const result = await setCompraStatus({ id: c.id, status: status as 'Aprobada' })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setSelected(null)
      apply(result.data, `Requisición ${status.toLowerCase()}`)
    })
  }

  /** The chain the two screens always claimed and never had. */
  function toOrder(c: CompraRow) {
    startTransition(async () => {
      const result = await generateOrder(c.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setSelected(null)
      apply(result.data, 'Orden de compra generada')
    })
  }

  function remove(c: CompraRow) {
    if (!window.confirm(`¿Eliminar la requisición ${c.code ?? ''}?`)) return
    startTransition(async () => {
      const result = await deleteCompra(c.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setSelected(null)
      apply(result.data, 'Requisición eliminada')
    })
  }

  function toggleTimeline(c: CompraRow) {
    const next = expanded === c.id ? null : c.id
    setExpanded(next)
    if (next && !timeline[next]) {
      setTimelineLoading(next)
      startTransition(async () => {
        const events = await fetchRequestEvents(next)
        setTimeline((prev) => ({ ...prev, [next]: events }))
        setTimelineLoading(null)
      })
    }
  }

  function renderTimeline(c: CompraRow) {
    const events = timeline[c.id]
    if (timelineLoading === c.id) {
      return <div className="dempty" style={{ padding: '12px 0' }}>Cargando eventos…</div>
    }
    if (!events || events.length === 0) {
      return <div className="dempty" style={{ padding: '12px 0' }}>Sin eventos por ahora.</div>
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0' }}>
        {events.map((ev) => (
          <div className="elrow" key={ev.id}>
            <div className="eltxt">{ev.note}</div>
            <div className="elsub">
              {ev.actorName ? `${ev.actorName} · ${fmtDT(ev.occurredAt)}` : fmtDT(ev.occurredAt)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  function switchTab(next: string) {
    setFilter(next)
    if (next === 'Facturas proveedor' && !invoiceLoaded && !invoiceLoading) {
      setInvoiceLoading(true)
      fetchSupplierInvoices().then((result) => {
        setInvoiceLoading(false)
        if (!result.ok) { addToast(result.error, 'err'); return }
        setInvoices(result.data)
        setInvoiceLoaded(true)
      })
    }
  }

  function submitInvoice() {
    const items = invoiceForm.items
      .filter((i) => i.description.trim() && Number(i.quantity) > 0)
      .map((i) => ({
        description: i.description.trim(),
        quantity: Number(i.quantity),
        unitPriceCents: Math.round(Number(i.unitPriceCents) || 0),
      }))
    if (items.length === 0) { addToast('Agrega al menos una línea', 'err'); return }

    startTransition(async () => {
      const result = await createSupplierInvoice({
        supplier: invoiceForm.supplier.trim(),
        issuedOn: invoiceForm.issuedOn,
        items,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setInvoices(result.data)
      setInvoiceOpen(false)
      setInvoiceForm(EMPTY_INVOICE_FORM)
      addToast('Factura creada', 'ok')
    })
  }

  function changeInvoiceStatus(inv: SupplierInvoiceRow, status: string) {
    startTransition(async () => {
      const result = await setSupplierInvoiceStatus({
        id: inv.id,
        status: status as SupplierInvoiceStatus,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setInvoices(result.data)
      addToast(`Factura ${status.toLowerCase()}`, 'ok')
    })
  }

  function removeInvoice(inv: SupplierInvoiceRow) {
    if (!window.confirm(`¿Eliminar la factura ${inv.code ?? ''}?`)) return
    startTransition(async () => {
      const result = await deleteSupplierInvoice(inv.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setInvoices(result.data)
      addToast('Factura eliminada', 'ok')
    })
  }

  function openPayment(inv: SupplierInvoiceRow, mode: 'paid' | 'scheduled') {
    setPaymentForm({
      ...EMPTY_PAYMENT_FORM,
      invoiceId: inv.id,
      mode,
      amount: mode === 'paid' ? String(Math.max(inv.remainingCents, 0) / 100) : '',
      paidOn: new Date().toISOString().slice(0, 10),
    })
    setPaymentOpen(true)
  }

  function submitPayment() {
    const amount = Math.round((Number(paymentForm.amount.replace(/[^\d]/g, '')) || 0) * 100)
    if (amount <= 0) { addToast('El monto debe ser mayor que cero', 'err'); return }
    startTransition(async () => {
      const result = await registerSupplierPayment({
        invoiceId: paymentForm.invoiceId,
        amountCents: amount,
        method: paymentForm.method,
        reference: paymentForm.reference.trim(),
        paidOn: paymentForm.mode === 'paid' ? paymentForm.paidOn : null,
        scheduledOn: paymentForm.mode === 'scheduled' ? paymentForm.scheduledOn : null,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setInvoices(result.data)
      setPaymentOpen(false)
      addToast(paymentForm.mode === 'paid' ? 'Pago registrado' : 'Pago programado', 'ok')
    })
  }

  function cancelPayment(inv: SupplierInvoiceRow, paymentId: string) {
    startTransition(async () => {
      const result = await cancelSupplierPayment(paymentId)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setInvoices(result.data)
      addToast(`Pago programado de ${inv.code ?? 'la factura'} cancelado`, 'info')
    })
  }

  function pickProduct(index: number, productId: string) {
    const product = state.productos.find((p) => p.id === productId)
    setForm((f) => ({
      ...f,
      items: f.items.map((item, i) => i === index
        ? product
          ? {
            productId: product.id,
            description: `${product.sku} · ${product.name}`,
            quantity: item.quantity,
            unit: product.unit,
            cost: String(product.costCents / 100),
          }
          : { ...item, productId: null }
        : item),
    }))
  }

  const draftTotal = form.items.reduce((s, i) => s + lineTotal(i), 0)
  const invoiceDraftTotal = invoiceForm.items.reduce((s, i) => s + invoiceLineTotalCents(i), 0)

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat icon={<ShoppingCart size={16} />} tone="blu" label="Requisiciones" value={stats.total} /></div>
        <div className="rise d2"><Stat icon={<Clock size={16} />} tone="amb" label="Pendientes" value={stats.pending} /></div>
        <div className="rise d3"><Stat icon={<Check size={16} />} tone="grn" label="Aprobadas" value={stats.approved} sub={`${stats.ordered} con OC`} /></div>
        <div className="rise d4"><Stat icon={<FileCheck2 size={16} />} tone="vio" label="Comprometido" value={cop(stats.committed / 100)} sub="pendientes y aprobadas" /></div>
      </div>

      <div className="card rise d2">
        <div className="chead" style={{ flexWrap: 'wrap', gap: 10 }}>
          <TabBar
            value={filter}
            onChange={switchTab}
            items={[
              ...['Todas', ...PURCHASE_REQUEST_STATUSES].map((s) => ({
                key: s,
                label: s === 'Todas' ? `Todas · ${state.comprasTotal}` : `${s} · ${compras.filter((c) => c.status === s).length}`,
              })),
              { key: 'Facturas proveedor', label: invoiceLoaded ? `Facturas proveedor · ${invoices.length}` : 'Facturas proveedor' },
            ]}
          />
          {filter !== 'Facturas proveedor' && (
            <button disabled={exporting} aria-busy={exporting} className="btn" onClick={exportRows}><FileSpreadsheet size={15} />Exportar</button>
          )}
          {state.canWrite && (
            filter === 'Facturas proveedor'
              ? (
                <button className="btn pri" onClick={() => setInvoiceOpen(true)}><Plus size={15} />Nueva factura</button>
              )
              : (
                <button className="btn pri" onClick={() => openEditor(null)}><Plus size={15} />Nueva requisición</button>
              )
          )}
        </div>
        {filter === 'Facturas proveedor' ? (
          <div className="tblwrap">
            {invoiceLoading ? (
              <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>Cargando facturas…</div>
            ) : invoices.length === 0 ? (
              <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                {state.canWrite ? 'Todavía no hay facturas de proveedor. Crea la primera.' : 'Todavía no hay facturas de proveedor.'}
              </div>
            ) : (
              <table className="tbl">
                <thead><tr><th scope="col">Código</th><th scope="col">Proveedor</th><th scope="col">Emitida</th><th scope="col">Total</th><th scope="col">Pagado</th><th scope="col">Saldo</th><th scope="col">Estado</th><th scope="col"></th></tr></thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr className="trow" key={inv.id}>
                      <td>
                        <div className="cename">{inv.code ?? '—'}</div>
                        {inv.nextScheduledOn && (
                          <div className="elsub" style={{ color: 'var(--vio)' }}>
                            <Calendar size={11} /> programado {fmt(inv.nextScheduledOn)}
                          </div>
                        )}
                      </td>
                      <td className="muted">{inv.supplier}</td>
                      <td className="muted">{fmt(inv.issuedOn)}</td>
                      <td className="cename">{cop(inv.totalCents / 100)}</td>
                      <td className="muted">{inv.paidCents > 0 ? cop(inv.paidCents / 100) : '—'}</td>
                      <td className="muted">
                        {inv.status === 'Pagada' || inv.status === 'Anulada'
                          ? '—'
                          : <span style={{ color: inv.remainingCents > 0 ? 'var(--ink)' : 'var(--grn)' }}>{cop(inv.remainingCents / 100)}</span>}
                      </td>
                      <td>
                        {state.canWrite ? (
                          <Select
                            value={inv.status}
                            onChange={(v) => changeInvoiceStatus(inv, v)}
                            options={[...SUPPLIER_INVOICE_STATUSES]}
                          />
                        ) : (
                          <Badge st={inv.status} />
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {state.canWrite && (
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', alignItems: 'center' }}>
                            {inv.status !== 'Pagada' && inv.status !== 'Anulada' && (
                              <>
                                <button className="ibtn" title="Registrar pago" aria-label={`Registrar pago de ${inv.code ?? ''}`}
                                  disabled={pending} onClick={() => openPayment(inv, 'paid')}>
                                  <Wallet size={15} />
                                </button>
                                <button className="ibtn" title="Programar pago" aria-label={`Programar pago de ${inv.code ?? ''}`}
                                  disabled={pending} onClick={() => openPayment(inv, 'scheduled')}>
                                  <Calendar size={15} />
                                </button>
                              </>
                            )}
                            {inv.payments.filter((p) => p.scheduledOn !== null).map((p) => (
                              <button key={p.id} className="ibtn" title={`Cancelar pago programado del ${fmt(p.scheduledOn)}`}
                                aria-label={`Cancelar pago programado de ${p.scheduledOn}`}
                                disabled={pending} onClick={() => cancelPayment(inv, p.id)}>
                                <X size={14} />
                              </button>
                            ))}
                            <button className="ibtn" style={{ color: 'var(--redd)' }} disabled={pending} onClick={() => removeInvoice(inv)} aria-label="Eliminar factura">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <>
            <div className="tblwrap">
              <table className="tbl">
            <thead><tr><th scope="col">Requisición</th><th scope="col">Proveedor</th><th scope="col">Proyecto</th><th scope="col">Total</th><th scope="col">Urgencia</th><th scope="col">Estado</th><th scope="col"></th></tr></thead>
            <tbody>
              {compras.length === 0 ? (
                <tr><td colSpan={7}><div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                  {state.canWrite ? 'Todavía no hay requisiciones. Crea la primera.' : 'Todavía no hay requisiciones.'}
                </div></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7}><div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>No hay requisiciones en este estado.</div></td></tr>
              ) : filtered.map((c) => [
                <tr key={c.id} className="trow" style={{ cursor: 'pointer' }} {...activatable(() => setSelected(c), `Abrir la requisición ${c.code ?? ''}`)}>
                  <td>
                    <div className="cename">{c.code ?? '—'}</div>
                    <div className="ceid mono">{c.category} · {c.items.length} líneas</div>
                  </td>
                  <td className="muted">{c.supplier || '—'}</td>
                  <td className="muted">{c.projectLabel ?? '—'}</td>
                  <td className="cename">{cop(c.totalCents / 100)}</td>
                  <td><Badge st={c.urgency} tone={c.urgency === 'Alta' ? 'red' : c.urgency === 'Normal' ? 'amb' : 'neu'} /></td>
                  <td><Badge st={c.status} /></td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="ibtn"
                      aria-label={expanded === c.id ? 'Ocultar actividad' : 'Ver actividad'}
                      aria-expanded={expanded === c.id}
                      onClick={(e) => { e.stopPropagation(); toggleTimeline(c) }}
                      style={{
                        width: 28, height: 28,
                        transform: expanded === c.id ? 'rotate(90deg)' : undefined,
                        transition: 'transform .15s',
                      }}
                    >
                      <ChevronRight size={16} color="var(--ink3)" />
                    </button>
                  </td>
                </tr>,
                expanded === c.id ? (
                  <tr key={`${c.id}-actividad`}>
                    <td colSpan={7} style={{ background: 'var(--bg2)' }}>{renderTimeline(c)}</td>
                  </tr>
                ) : null,
              ])}
            </tbody>
          </table>
        </div>
        <LoadMore
          loaded={compras.length}
          total={state.comprasTotal}
          loading={loadingMore}
          error={loadMoreError}
          onLoadMore={loadMore}
          noun="requisiciones"
        />
          </>
        )}
      </div>

      <Drawer value={selected} onClose={() => setSelected(null)}>
        {(row) => (
          <>
            <div className="dhead tkhead">
              <div className="dmark" style={{ background: 'linear-gradient(145deg,#f0bd5a,#bf8410)', boxShadow: '0 8px 18px -8px #bf841099' }}>
                <ShoppingCart size={19} color="#fff" />
              </div>
              <div style={{ flex: 1, position: 'relative', zIndex: 1 }}>
                <div className="dh-t">{row.code ?? 'Requisición'}</div>
                <div className="dh-s">{row.supplier || 'Proveedor por definir'}</div>
              </div>
              <button className="ibtn" onClick={() => setSelected(null)} style={{ position: 'relative', zIndex: 1 }} aria-label="Cerrar"><X size={18} /></button>
            </div>
            <div className="dbody">
              {state.canWrite && row.status !== 'OC generada' ? (
                <Select
                  value={row.status}
                  onChange={(v) => changeStatus(row, v)}
                  // 'OC generada' is not selectable: it is the result of
                  // generating an order, not a label somebody applies.
                  options={PURCHASE_REQUEST_STATUSES.filter((s) => s !== 'OC generada')}
                />
              ) : (
                <Badge st={row.status} filled />
              )}

              <div className="dsect">Datos</div>
              <div className="elrow"><div className="eltxt">Categoría</div><div className="elsub">{row.category}</div></div>
              <div className="elrow"><div className="eltxt">Proyecto</div><div className="elsub">{row.projectLabel ?? '—'}</div></div>
              <div className="elrow"><div className="eltxt">Solicitante</div><div className="elsub">{row.ownerName ?? '—'}</div></div>
              <div className="elrow"><div className="eltxt">Se necesita</div><div className="elsub">{fmt(row.neededOn)}</div></div>

              <div className="dsect">Líneas</div>
              {row.items.map((item) => (
                <div className="elrow" key={item.id}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="eltxt" style={{ fontSize: 13 }}>{item.description}</div>
                    <div className="elsub">{item.quantity} {item.unit} × {cop(item.unitCostCents / 100)}</div>
                  </div>
                  <div className="eltxt">{cop(Math.round(item.quantity * item.unitCostCents) / 100)}</div>
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
                {row.status === 'Aprobada' && (
                  <button className="btn pri" style={{ flex: 1, justifyContent: 'center' }} disabled={pending} onClick={() => toOrder(row)}>
                    <FileCheck2 size={15} />Generar orden de compra
                  </button>
                )}
                {row.status !== 'OC generada' && (
                  <>
                    <button className="btn" onClick={() => openEditor(row)}><PenLine size={15} /></button>
                    <button className="ibtn" style={{ color: 'var(--redd)' }} disabled={pending} onClick={() => remove(row)} aria-label="Eliminar requisición">
                      <Trash2 size={17} />
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </Drawer>

      {/* A sheet, not a dialog: six fields and a line-item repeater do not fit
          a centred box, and the Guardar button belongs on screen the whole
          time rather than below a scroll. */}
      <FormDrawer
        wide
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? 'Editar requisición' : 'Nueva requisición'}
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
                  <div className="flabel" style={{ marginTop: 0 }}>Proveedor</div>
                  <input className="field" value={form.supplier} onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))} />
                </div>
                <div>
                  <div className="flabel" style={{ marginTop: 0 }}>Categoría</div>
                  <Select value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} options={[...PURCHASE_CATEGORIES]} />
                </div>
              </div>
              <div className="fg2">
                <div>
                  <div className="flabel">Urgencia</div>
                  <Select value={form.urgency} onChange={(v) => setForm((f) => ({ ...f, urgency: v }))} options={[...PURCHASE_URGENCIES]} />
                </div>
                <div>
                  <div className="flabel">Se necesita</div>
                  <DatePicker ariaLabel="Se necesita" value={form.neededOn} onChange={(v) => setForm((f) => ({ ...f, neededOn: v }))} />
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
                  <div className="flabel">Solicitante</div>
                  <Select
                    value={form.ownerId}
                    onChange={(v) => setForm((f) => ({ ...f, ownerId: v }))}
                    placeholder="Sin solicitante"
                    options={[
                      { value: '', label: 'Sin solicitante' },
                      ...state.roster.map((r) => ({ value: r.employeeId, label: r.fullName })),
                    ]}
                  />
                </>
              )}

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
                      className="field" type="number" min={0} step="0.01" style={{ width: 84 }}
                      value={item.quantity} aria-label="Cantidad"
                      onChange={(e) => setForm((f) => ({
                        ...f,
                        items: f.items.map((it, i) => (i === index ? { ...it, quantity: e.target.value } : it)),
                      }))}
                    />
                    <input
                      className="field" type="number" min={0} style={{ flex: 1 }}
                      value={item.cost} placeholder="Costo unitario" aria-label="Costo unitario"
                      onChange={(e) => setForm((f) => ({
                        ...f,
                        items: f.items.map((it, i) => (i === index ? { ...it, cost: e.target.value } : it)),
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
              <button className="btn ghost" onClick={() => setForm((f) => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }))}>
                <Plus size={14} />Añadir línea
              </button>

              <div className="elrow" style={{ marginTop: 12 }}>
                <div className="eltxt">Total</div>
                <div className="eltxt" style={{ fontSize: 16 }}>{cop(draftTotal / 100)}</div>
              </div>

              <div className="flabel">Notas</div>
              <textarea className="field" rows={2} style={{ resize: 'none' }} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
      </FormDrawer>

      <FormDrawer
        wide
        open={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        title="Nueva factura de proveedor"
        footer={
          <>
            <span />
            <div style={{ display: 'flex', gap: 9 }}>
              <button className="btn" onClick={() => setInvoiceOpen(false)} disabled={pending}>Cancelar</button>
              <button className="btn dark" onClick={submitInvoice} disabled={pending} aria-busy={pending}>
                <Check size={14} />{pending ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </>
        }
      >
        <div className="flabel" style={{ marginTop: 0 }}>Proveedor</div>
        <input
          className="field"
          value={invoiceForm.supplier}
          onChange={(e) => setInvoiceForm((f) => ({ ...f, supplier: e.target.value }))}
        />
        <div className="flabel">Emitida</div>
        <DatePicker ariaLabel="Emitida" value={invoiceForm.issuedOn} onChange={(v) => setInvoiceForm((f) => ({ ...f, issuedOn: v }))} />

        <div className="dsect">Líneas</div>
        {invoiceForm.items.map((item, index) => (
          <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--line2)' }}>
            <input
              className="field"
              placeholder="Descripción"
              value={item.description}
              onChange={(e) => setInvoiceForm((f) => ({
                ...f,
                items: f.items.map((it, i) => (i === index ? { ...it, description: e.target.value } : it)),
              }))}
            />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="field" type="number" min={0} style={{ width: 84 }}
                value={item.quantity} aria-label="Cantidad"
                onChange={(e) => setInvoiceForm((f) => ({
                  ...f,
                  items: f.items.map((it, i) => (i === index ? { ...it, quantity: e.target.value } : it)),
                }))}
              />
              <input
                className="field" type="number" min={0} style={{ flex: 1 }}
                value={item.unitPriceCents} placeholder="Precio unitario (pesos)" aria-label="Precio unitario en pesos"
                onChange={(e) => setInvoiceForm((f) => ({
                  ...f,
                  items: f.items.map((it, i) => (i === index ? { ...it, unitPriceCents: e.target.value } : it)),
                }))}
              />
              <span className="eltxt" style={{ minWidth: 90, textAlign: 'right' }}>{cop(invoiceLineTotalCents(item) / 100)}</span>
              <button
                className="ibtn" style={{ width: 28, height: 28 }}
                onClick={() => setInvoiceForm((f) => ({
                  ...f,
                  items: f.items.length > 1 ? f.items.filter((_, i) => i !== index) : f.items,
                }))}
                aria-label="Quitar línea"
              ><X size={13} /></button>
            </div>
          </div>
        ))}
        <button className="btn ghost" onClick={() => setInvoiceForm((f) => ({ ...f, items: [...f.items, { ...EMPTY_INVOICE_ITEM }] }))}>
          <Plus size={14} />Añadir línea
        </button>

        <div className="elrow" style={{ marginTop: 12 }}>
          <div className="eltxt">Total</div>
          <div className="eltxt" style={{ fontSize: 16 }}>{cop(invoiceDraftTotal / 100)}</div>
        </div>
      </FormDrawer>

      <FormDrawer
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        title={paymentForm.mode === 'paid' ? 'Registrar pago a proveedor' : 'Programar pago a proveedor'}
        footer={
          <button className="btn dark" disabled={pending} onClick={submitPayment}>
            <Check size={15} />{paymentForm.mode === 'paid' ? 'Registrar pago' : 'Programar pago'}
          </button>
        }
      >
        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="pay-amount">Monto (COP)</label>
            <input id="pay-amount" className="field" inputMode="numeric" value={paymentForm.amount}
              onChange={(e) => setPaymentForm((p) => ({ ...p, amount: e.target.value }))} />
          </div>
          <div>
            <div className="flabel">
              {paymentForm.mode === 'paid' ? 'Fecha de pago' : 'Fecha programada'}
            </div>
            <DatePicker ariaLabel={paymentForm.mode === 'paid' ? 'Fecha de pago' : 'Fecha programada'}
              value={paymentForm.mode === 'paid' ? paymentForm.paidOn : paymentForm.scheduledOn}
              onChange={(v) => setPaymentForm((p) => paymentForm.mode === 'paid'
                ? { ...p, paidOn: v }
                : { ...p, scheduledOn: v })} />
          </div>
        </div>

        <div className="flabel">Medio de pago</div>
        <Select value={paymentForm.method}
          onChange={(v) => setPaymentForm((p) => ({ ...p, method: v }))}
          options={['Transferencia', 'Efectivo', 'Cheque', 'Tarjeta', 'Otro']} />

        <label className="flabel" htmlFor="pay-ref">Referencia</label>
        <input id="pay-ref" className="field" value={paymentForm.reference}
          onChange={(e) => setPaymentForm((p) => ({ ...p, reference: e.target.value }))}
          placeholder="Número de transferencia o comprobante" />
      </FormDrawer>
    </>
  )
}
