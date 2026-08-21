'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  DollarSign, AlertTriangle, Check, Plus, Trash2, Receipt, Wallet, PenLine, FileSpreadsheet,
} from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import DatePicker from '@/components/ui/DatePicker'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import FormDrawer from '@/components/ui/FormDrawer'
import LoadMore from '@/components/ui/LoadMore'
import { useApp } from '@/lib/context/AppContext'
import { useConfirm } from '@/lib/context/ConfirmContext'
import { useExport } from '@/lib/hooks/use-export'
import { INVOICE_STATUSES, PAYMENT_METHODS, netFromGross } from '@/lib/domain'
import { cop } from '@/lib/utils'
import type { FacturacionData, InvoiceRow } from '@/server/queries/facturacion'
import {
  createFactura, deleteFactura, registrarPago, setFacturaStatus, updateFactura,
} from '@/server/mutations/facturacion'
import { fetchMoreFacturas } from '@/server/actions/facturacion'

const DATE = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

function formatDate(iso: string | null): string {
  return iso ? DATE.format(new Date(`${iso}T00:00:00`)) : '—'
}

function toCents(value: string): number {
  const n = Number(value.replace(/[^\d]/g, ''))
  return Number.isFinite(n) ? Math.round(n) * 100 : 0
}

function pesos(cents: number): string {
  return cop(Math.round(cents / 100))
}

function orNull(value: string): string | null {
  return value.trim() === '' ? null : value
}

const TODAY = () => new Date().toISOString().slice(0, 10)

interface DraftItem {
  productId: string
  description: string
  quantity: string
  unitPrice: string
  taxRate: string
}

const EMPTY_ITEM: DraftItem = {
  productId: '', description: '', quantity: '1', unitPrice: '', taxRate: '19',
}

const EMPTY_INVOICE = {
  clientId: '', clientName: '', issuedOn: '', dueOn: '', currency: 'COP', notes: '',
}

const EMPTY_PAYMENT = {
  invoiceId: '', amount: '', method: 'Transferencia', reference: '', paidOn: '',
}

/** Mirrors `totalsOf` on the server, so the drawer previews the real figures. */
function previewTotals(items: DraftItem[]) {
  let subtotal = 0
  let tax = 0
  for (const item of items) {
    const qty = Number(item.quantity) || 0
    const price = toCents(item.unitPrice)
    const rate = Number(item.taxRate) || 0
    const line = Math.round(qty * price)
    subtotal += line
    tax += Math.round((line * rate) / 100)
  }
  return { subtotal, tax, total: subtotal + tax }
}

export default function FacturacionPage({ data }: { data: FacturacionData }) {
  const { runExport, exporting } = useExport()
  const { addToast } = useApp()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()

  const [facturas, setFacturas] = useState<InvoiceRow[]>(data.facturas)
  const [total, setTotal] = useState(data.facturasTotal)
  const [items, setItems] = useState(data.items)
  const [pagos, setPagos] = useState(data.pagos)
  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const [statusFilter, setStatusFilter] = useState('Todas')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [invoiceForm, setInvoiceForm] = useState(EMPTY_INVOICE)
  const [draftItems, setDraftItems] = useState<DraftItem[]>([{ ...EMPTY_ITEM }])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT)

  function apply(next: FacturacionData) {
    setFacturas(next.facturas)
    setTotal(next.facturasTotal)
    setItems(next.items)
    setPagos(next.pagos)
  }

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreFacturas(facturas.length)
      if (!result.ok) { setLoadMoreError(result.error); return }
      setFacturas((prev) => {
        const seen = new Set(prev.map((r) => r.id))
        return [...prev, ...result.data.rows.filter((r) => !seen.has(r.id))]
      })
      setTotal(result.data.total)
    })
  }

  const stats = useMemo(() => {
    const collectable = facturas.filter((f) => f.status === 'Emitida' || f.status === 'Vencida')
    return {
      issued: collectable.length,
      receivable: collectable.reduce((s, f) => s + f.balanceCents, 0),
      overdue: facturas.filter((f) => f.overdue).reduce((s, f) => s + f.balanceCents, 0),
      collected: facturas.reduce((s, f) => s + f.paidCents, 0),
    }
  }, [facturas])

  const visible = facturas.filter((f) => {
    if (statusFilter === 'Todas') return true
    if (statusFilter === 'Vencidas') return f.overdue
    return f.status === statusFilter
  })

  const agingTotals = useMemo(() => {
    const zero = { current: 0, d1to30: 0, d31to60: 0, d61to90: 0, over90: 0, total: 0 }
    for (const row of data.aging) {
      zero.current += row.current
      zero.d1to30 += row.d1to30
      zero.d31to60 += row.d31to60
      zero.d61to90 += row.d61to90
      zero.over90 += row.over90
      zero.total += row.total
    }
    return zero
  }, [data.aging])

  const exportAging = () => {
    void runExport(
      data.aging.map((r) => ({
        Cliente: r.clientName,
        Facturas: r.invoices,
        Corriente: pesos(r.current),
        '1-30 días': pesos(r.d1to30),
        '31-60 días': pesos(r.d31to60),
        '61-90 días': pesos(r.d61to90),
        '+90 días': pesos(r.over90),
        Total: pesos(r.total),
      })),
      'cartera-antiguedad',
      'facturacion',
    )
  }

  const preview = previewTotals(draftItems)

  const exportRows = () => {
    void runExport(
      visible.map((f) => ({
        Número: f.code ?? '',
        Cliente: f.clientName,
        Valor: pesos(f.totalCents),
        Estado: f.status,
        Fecha: f.issuedOn,
      })),
      'facturas-kigyo',
      'facturacion',
    )
  }

  function changeStatus(f: InvoiceRow, status: string) {
    startTransition(async () => {
      const result = await setFacturaStatus({ id: f.id, status: status as never })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast(`Factura ${status.toLowerCase()}`, 'ok')
    })
  }

  async function remove(f: InvoiceRow) {
    if (!(await confirm({ title: `¿Eliminar ${f.code ??'esta factura'}? Se eliminan también sus líneas.`, tone: 'danger' }))) return
    startTransition(async () => {
      const result = await deleteFactura(f.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Factura eliminada', 'ok')
    })
  }

  function editInvoice(f: InvoiceRow) {
    const invoiceItems = items
      .filter((i) => i.invoiceId === f.id)
      .sort((a, b) => a.position - b.position)
    setInvoiceForm({
      clientId: f.clientId ?? '',
      clientName: f.clientName,
      issuedOn: f.issuedOn,
      dueOn: f.dueOn ?? '',
      currency: f.currency,
      notes: f.notes,
    })
    setDraftItems(invoiceItems.length > 0
      ? invoiceItems.map((i) => ({
          productId: i.productId ?? '',
          description: i.description,
          quantity: String(i.quantity),
          unitPrice: String(Math.round(i.unitPriceCents / 100)),
          taxRate: String(i.taxRate),
        }))
      : [{ ...EMPTY_ITEM }])
    setEditingId(f.id)
    setInvoiceOpen(true)
  }

  function submitInvoice() {
    startTransition(async () => {
      const payload = {
        clientId: invoiceForm.clientId || null,
        clientName: invoiceForm.clientName,
        issuedOn: invoiceForm.issuedOn || TODAY(),
        dueOn: orNull(invoiceForm.dueOn),
        currency: invoiceForm.currency,
        notes: invoiceForm.notes,
        items: draftItems.map((item) => ({
          productId: item.productId || null,
          description: item.description,
          quantity: item.quantity,
          unitPriceCents: toCents(item.unitPrice),
          taxRate: item.taxRate,
        })),
      }
      const result = editingId
        ? await updateFactura({ ...payload, id: editingId })
        : await createFactura(payload)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setEditingId(null)
      setInvoiceForm(EMPTY_INVOICE)
      setDraftItems([{ ...EMPTY_ITEM }])
      setInvoiceOpen(false)
      addToast(editingId ? 'Factura actualizada' : 'Factura creada', 'ok')
    })
  }

  function submitPayment() {
    startTransition(async () => {
      const result = await registrarPago({
        invoiceId: paymentForm.invoiceId,
        amountCents: toCents(paymentForm.amount),
        method: paymentForm.method as never,
        reference: paymentForm.reference,
        paidOn: paymentForm.paidOn || TODAY(),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setPaymentForm(EMPTY_PAYMENT)
      setPaymentOpen(false)
      addToast('Pago registrado', 'ok')
    })
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat icon={<Receipt size={16} />} tone="blu" label="Facturas por cobrar"
            value={stats.issued} sub={`de ${facturas.length} emitidas`} />
        </div>
        <div className="rise d2">
          <Stat icon={<DollarSign size={16} />} tone="amb" label="Cartera"
            value={pesos(stats.receivable)} />
        </div>
        <div className="rise d3">
          <Stat icon={<AlertTriangle size={16} />} tone="red" label="Cartera vencida"
            value={pesos(stats.overdue)} />
        </div>
        <div className="rise d4">
          <Stat icon={<Wallet size={16} />} tone="grn" label="Recaudado"
            value={pesos(stats.collected)} />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <div>
            <div className="ctitle">Facturas</div>
            <div className="elsub" style={{ marginTop: 2 }}>
              Toca una fila para ver sus líneas y pagos.
            </div>
          </div>
          {data.canWrite && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={exporting} aria-busy={exporting} className="btn" onClick={exportRows}><FileSpreadsheet size={15} />Exportar</button>
              <button className="btn" disabled={pending || facturas.length === 0}
                onClick={() => {
                  const target = facturas.find((f) => f.balanceCents > 0) ?? facturas[0]
                  setPaymentForm({ ...EMPTY_PAYMENT, invoiceId: target?.id ?? '', paidOn: TODAY() })
                  setPaymentOpen(true)
                }}>
                <Wallet size={15} />Pago
              </button>
              <button className="btn dark" disabled={pending}
                onClick={() => {
                  setEditingId(null)
                  setInvoiceForm({ ...EMPTY_INVOICE, issuedOn: TODAY() })
                  setDraftItems([{ ...EMPTY_ITEM }])
                  setInvoiceOpen(true)
                }}>
                <Plus size={15} />Factura
              </button>
            </div>
          )}
        </div>

        <div className="cpad" style={{ paddingBottom: 0 }}>
          <div style={{ maxWidth: 220 }}>
            <Select value={statusFilter} onChange={setStatusFilter}
              options={['Todas', 'Vencidas', ...INVOICE_STATUSES]} />
          </div>
        </div>

        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Factura</th>
                <th scope="col">Cliente</th>
                <th scope="col">Emitida</th>
                <th scope="col">Vence</th>
                <th scope="col">Total</th>
                <th scope="col">Saldo</th>
                <th scope="col">Estado</th>
                {data.canWrite && <th scope="col" aria-label="Acciones" />}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={data.canWrite ? 8 : 7}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      {facturas.length === 0
                        ? 'Todavía no hay facturas emitidas.'
                        : 'No hay facturas con ese filtro.'}
                    </div>
                  </td>
                </tr>
              ) : visible.map((f) => {
                const lines = items.filter((i) => i.invoiceId === f.id)
                const payments = pagos.filter((p) => p.invoiceId === f.id)
                return [
                  <tr key={f.id} className="trow"
                    onClick={() => setExpanded(expanded === f.id ? null : f.id)}>
                    <td>
                      <div className="cename mono">{f.code}</div>
                      <div className="elsub">{f.items} {f.items === 1 ? 'línea' : 'líneas'}</div>
                    </td>
                    <td>{f.clientName || '—'}</td>
                    <td>{formatDate(f.issuedOn)}</td>
                    <td>
                      {formatDate(f.dueOn)}
                      {f.daysOverdue !== null && (
                        <div className="elsub" style={{ color: 'var(--red)' }}>
                          {f.daysOverdue} días de mora
                        </div>
                      )}
                    </td>
                    <td>{pesos(f.totalCents)}</td>
                    <td>{f.balanceCents > 0 ? pesos(f.balanceCents) : '—'}</td>
                    <td>
                      <Badge st={f.overdue ? 'Vencida' : f.status}
                        tone={f.status === 'Pagada' ? 'grn'
                          : f.overdue || f.status === 'Vencida' ? 'red'
                          : f.status === 'Emitida' ? 'blu' : 'neu'} />
                    </td>
                    {data.canWrite && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <Select
                            value={f.status}
                            onChange={(next) => { if (next !== f.status) changeStatus(f, next) }}
                            options={[...INVOICE_STATUSES]}
                          />
                          <button className="ibtn" aria-label={`Editar ${f.code}`}
                            disabled={pending} onClick={() => editInvoice(f)}>
                            <PenLine size={14} />
                          </button>
                          <button className="ibtn" aria-label={`Eliminar ${f.code}`}
                            disabled={pending} onClick={() => remove(f)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>,
                  expanded === f.id ? (
                    <tr key={`${f.id}-detail`}>
                      <td colSpan={data.canWrite ? 8 : 7} style={{ background: 'var(--bg2)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
                          {lines.map((i) => (
                            <div className="elrow" key={i.id}>
                              <div className="eltxt">
                                <div className="cename">{i.description}</div>
                                <div className="elsub">
                                  {i.quantity} × {pesos(i.unitPriceCents)}
                                  {i.taxRate > 0 && ` · IVA ${i.taxRate}%`}
                                </div>
                              </div>
                              <div className="mono">
                                {pesos(Math.round(i.quantity * i.unitPriceCents))}
                              </div>
                            </div>
                          ))}

                          <div className="elrow">
                            <div className="eltxt elsub">
                              Subtotal {pesos(f.subtotalCents)} · IVA {pesos(f.taxCents)}
                            </div>
                            <div className="cename mono">{pesos(f.totalCents)}</div>
                          </div>

                          {payments.length > 0 && payments.map((p) => (
                            <div className="elrow" key={p.id}>
                              <div className="eltxt">
                                <div className="cename">Pago · {p.method}</div>
                                <div className="elsub">
                                  {formatDate(p.paidOn)}{p.reference && ` · ${p.reference}`}
                                </div>
                              </div>
                              <div className="mono">{pesos(p.amountCents)}</div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ) : null,
                ]
              })}
            </tbody>
          </table>
        </div>

        <LoadMore
          loaded={facturas.length}
          total={total}
          loading={loadingMore}
          error={loadMoreError}
          onLoadMore={loadMore}
          noun="facturas"
        />
      </div>

      {data.aging.length > 0 && (
        <div className="card rise d3">
          <div className="chead">
            <div>
              <div className="ctitle">Antigüedad de cartera</div>
              <div className="elsub" style={{ marginTop: 2 }}>
                Saldos por cobrar según días vencidos.
              </div>
            </div>
            <button className="btn" disabled={exporting} aria-busy={exporting} onClick={exportAging}>
              <FileSpreadsheet size={15} />Exportar
            </button>
          </div>

          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Cliente</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Corriente</th>
                  <th scope="col" style={{ textAlign: 'right' }}>1-30</th>
                  <th scope="col" style={{ textAlign: 'right' }}>31-60</th>
                  <th scope="col" style={{ textAlign: 'right' }}>61-90</th>
                  <th scope="col" style={{ textAlign: 'right' }}>+90</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {data.aging.map((r) => (
                  <tr key={r.clientId ?? r.clientName}>
                    <td>
                      <div className="cename">{r.clientName || '—'}</div>
                      <div className="elsub">{r.invoices} {r.invoices === 1 ? 'factura' : 'facturas'}</div>
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono">{r.current > 0 ? pesos(r.current) : '—'}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{r.d1to30 > 0 ? pesos(r.d1to30) : '—'}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{r.d31to60 > 0 ? pesos(r.d31to60) : '—'}</td>
                    <td style={{ textAlign: 'right' }} className="mono">{r.d61to90 > 0 ? pesos(r.d61to90) : '—'}</td>
                    <td className="mono" style={r.over90 > 0
                      ? { textAlign: 'right', color: 'var(--red)' }
                      : { textAlign: 'right' }}>
                      {r.over90 > 0 ? pesos(r.over90) : '—'}
                    </td>
                    <td style={{ textAlign: 'right' }} className="mono cename">{pesos(r.total)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="cename">Total</td>
                  <td style={{ textAlign: 'right' }} className="mono">{pesos(agingTotals.current)}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{pesos(agingTotals.d1to30)}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{pesos(agingTotals.d31to60)}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{pesos(agingTotals.d61to90)}</td>
                  <td style={{ textAlign: 'right' }} className="mono">{pesos(agingTotals.over90)}</td>
                  <td style={{ textAlign: 'right' }} className="mono cename">{pesos(agingTotals.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <FormDrawer
        open={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        title={editingId ? 'Editar factura' : 'Nueva factura'}
        wide
        footer={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
            <div className="elsub" style={{ flex: 1 }}>
              Subtotal {pesos(preview.subtotal)} · IVA {pesos(preview.tax)} ·{' '}
              <b>{pesos(preview.total)}</b>
            </div>
            <button className="btn dark" disabled={pending} onClick={submitInvoice}>
              <Check size={15} />{editingId ? 'Guardar cambios' : 'Crear factura'}
            </button>
          </div>
        }
      >
        {data.clientes.length > 0 && (
          <>
            <div className="flabel">Cliente</div>
            <Select
              value={invoiceForm.clientId}
              onChange={(v) => {
                const client = data.clientes.find((c) => c.id === v)
                setInvoiceForm({
                  ...invoiceForm,
                  clientId: v,
                  clientName: client ? client.name : invoiceForm.clientName,
                })
              }}
              placeholder="Sin cliente registrado"
              options={data.clientes.map((c) => ({ value: c.id, label: c.name }))}
            />
          </>
        )}

        <label className="flabel" htmlFor="inv-client">Nombre a facturar</label>
        <input id="inv-client" className="field" value={invoiceForm.clientName}
          onChange={(e) => setInvoiceForm({ ...invoiceForm, clientName: e.target.value })} />

        <div className="fg2">
          <div>
            <div className="flabel">Emitida</div>
            <DatePicker ariaLabel="Emitida" value={invoiceForm.issuedOn}
              onChange={(v) => setInvoiceForm({ ...invoiceForm, issuedOn: v })} />
          </div>
          <div>
            <div className="flabel">Vence</div>
            <DatePicker ariaLabel="Vence" value={invoiceForm.dueOn}
              onChange={(v) => setInvoiceForm({ ...invoiceForm, dueOn: v })} />
          </div>
        </div>

        <div className="flabel" style={{ marginTop: 18 }}>Líneas</div>
        {draftItems.map((item, index) => (
          <div key={index} className="card" style={{ padding: 12, marginBottom: 10 }}>
            {data.productos.length > 0 && (
              <Select
                value={item.productId}
                onChange={(v) => {
                  const product = data.productos.find((p) => p.id === v)
                  /*
                   * El precio del catálogo viene CON IVA (migración 104) y esta
                   * línea lo lleva SIN él, porque `totalsOf()` suma el impuesto
                   * encima. Copiarlo tal cual —que es lo que se hacía— facturaba
                   * el precio de góndola más un 19%: al cliente se le cobraba de
                   * más y nadie en el código lo desmentía.
                   *
                   * Se convierte al pasarlo: neto = bruto ÷ (1 + tasa/100), y la
                   * tasa del producto viaja con él, así que el total de la
                   * factura vuelve exactamente al precio de góndola.
                   *
                   * Sigue siendo un punto de partida y no un candado: ambos
                   * campos quedan editables, porque una línea negociada es
                   * normal en una factura y no lo es en el mostrador.
                   */
                  const rate = product ? product.taxRate : 0
                  const netPrice = product
                    ? netFromGross(product.priceCents, rate) / 100
                    : null
                  setDraftItems((prev) => prev.map((row, i) => i === index ? {
                    ...row,
                    productId: v,
                    description: product ? product.name : row.description,
                    unitPrice: netPrice !== null ? String(Math.round(netPrice)) : row.unitPrice,
                    taxRate: product ? String(rate) : row.taxRate,
                  } : row))
                }}
                placeholder="Producto del catálogo (opcional)"
                options={data.productos.map((p) => ({ value: p.id, label: `${p.sku} · ${p.name}` }))}
              />
            )}

            <label className="flabel" htmlFor={`item-desc-${index}`}>Descripción</label>
            <input id={`item-desc-${index}`} className="field" value={item.description}
              onChange={(e) => setDraftItems((prev) =>
                prev.map((row, i) => i === index ? { ...row, description: e.target.value } : row))} />

            <div className="fg2">
              <div>
                <label className="flabel" htmlFor={`item-qty-${index}`}>Cantidad</label>
                <input id={`item-qty-${index}`} className="field" type="number" min={0} step="0.01"
                  value={item.quantity}
                  onChange={(e) => setDraftItems((prev) =>
                    prev.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row))} />
              </div>
              <div>
                <label className="flabel" htmlFor={`item-price-${index}`}>Precio unitario</label>
                <input id={`item-price-${index}`} className="field" inputMode="numeric"
                  value={item.unitPrice}
                  onChange={(e) => setDraftItems((prev) =>
                    prev.map((row, i) => i === index ? { ...row, unitPrice: e.target.value } : row))} />
              </div>
            </div>

            <div className="fg2">
              <div>
                <label className="flabel" htmlFor={`item-tax-${index}`}>IVA (%)</label>
                <input id={`item-tax-${index}`} className="field" type="number" min={0} max={100}
                  value={item.taxRate}
                  onChange={(e) => setDraftItems((prev) =>
                    prev.map((row, i) => i === index ? { ...row, taxRate: e.target.value } : row))} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                {draftItems.length > 1 && (
                  <button className="btn" type="button"
                    onClick={() => setDraftItems((prev) => prev.filter((_, i) => i !== index))}>
                    <Trash2 size={14} />Quitar línea
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        <button className="btn" type="button"
          onClick={() => setDraftItems((prev) => [...prev, { ...EMPTY_ITEM }])}>
          <Plus size={15} />Agregar línea
        </button>

        <label className="flabel" htmlFor="inv-notes">Notas</label>
        <textarea id="inv-notes" className="field" rows={3} value={invoiceForm.notes}
          onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        title="Registrar pago"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitPayment}>
            <Check size={15} />Registrar pago
          </button>
        }
      >
        <div className="flabel">Factura</div>
        <Select value={paymentForm.invoiceId}
          onChange={(v) => setPaymentForm({ ...paymentForm, invoiceId: v })}
          placeholder="Elige la factura"
          options={facturas.map((f) => ({
            value: f.id,
            label: `${f.code ?? ''} · ${f.clientName} · saldo ${pesos(f.balanceCents)}`.trim(),
          }))} />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="pay-amount">Monto (COP)</label>
            <input id="pay-amount" className="field" inputMode="numeric" value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
          </div>
          <div>
            <div className="flabel">Fecha</div>
            <DatePicker ariaLabel="Fecha" value={paymentForm.paidOn}
              onChange={(v) => setPaymentForm({ ...paymentForm, paidOn: v })} />
          </div>
        </div>

        <div className="flabel">Medio de pago</div>
        <Select value={paymentForm.method}
          onChange={(v) => setPaymentForm({ ...paymentForm, method: v })}
          options={[...PAYMENT_METHODS]} />

        <label className="flabel" htmlFor="pay-ref">Referencia</label>
        <input id="pay-ref" className="field" value={paymentForm.reference}
          onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
          placeholder="Número de transferencia o comprobante" />
      </FormDrawer>
    </>
  )
}
