'use client'

import { useMemo, useState, useTransition } from 'react'
import { Truck, Check, Clock, Package, Plus, Trash2, ChevronRight } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Stat from '@/components/ui/Stat'
import FormDrawer from '@/components/ui/FormDrawer'
import { useApp } from '@/lib/context/AppContext'
import { cop } from '@/lib/utils'
import type { StatusTone } from '@/lib/types'
import type { PedidosData, SalesOrderRow, OrderStatus } from '@/server/queries/pedidos'
import { createOrderFromQuote, deletePedido, updateOrderStatus } from '@/server/mutations/pedidos'

const STATUS_TONE: Record<OrderStatus, StatusTone> = {
  'Borrador': 'neu',
  'Confirmado': 'blu',
  'En preparación': 'amb',
  'Despachado': 'vio',
  'Entregado': 'grn',
  'Cancelado': 'red',
}

/** El ciclo natural: Borrador → Confirmado → En preparación → Despachado → Entregado. */
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  'Borrador': 'Confirmado',
  'Confirmado': 'En preparación',
  'En preparación': 'Despachado',
  'Despachado': 'Entregado',
}

function pesos(cents: number): string {
  return cop(Math.round(cents / 100))
}

export default function PedidosPage({ data }: { data: PedidosData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [pedidos, setPedidos] = useState<SalesOrderRow[]>(data.pedidos)
  const [quotes, setQuotes] = useState(data.quotes)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [quoteId, setQuoteId] = useState('')
  const [form, setForm] = useState({
    issuedOn: '', dueOn: '', paymentTerms: '', shippingAddress: '', notes: '',
  })

  const stats = useMemo(() => {
    const vivos = pedidos.filter((p) => p.status !== 'Cancelado')
    return {
      activos: vivos.length,
      enCurso: vivos.filter((p) => ['Confirmado', 'En preparación', 'Despachado'].includes(p.status)).length,
      entregados: vivos.filter((p) => p.status === 'Entregado').length,
      total: vivos.reduce((s, p) => s + p.totalCents, 0),
    }
  }, [pedidos])

  function apply(next: PedidosData) {
    setPedidos(next.pedidos)
    setQuotes(next.quotes)
  }

  function openCreate() {
    setQuoteId(quotes[0]?.id ?? '')
    setForm({ issuedOn: '', dueOn: '', paymentTerms: '', shippingAddress: '', notes: '' })
    setDrawerOpen(true)
  }

  function submit() {
    if (!quoteId) { addToast('Elige una cotización aceptada.', 'err'); return }
    startTransition(async () => {
      const result = await createOrderFromQuote(quoteId, {
        issuedOn: form.issuedOn || undefined,
        dueOn: form.dueOn || null,
        paymentTerms: form.paymentTerms,
        shippingAddress: form.shippingAddress,
        notes: form.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setDrawerOpen(false)
      addToast('Pedido creado desde la cotización', 'ok')
    })
  }

  function advance(p: SalesOrderRow) {
    const next = NEXT_STATUS[p.status]
    if (!next) return
    startTransition(async () => {
      const result = await updateOrderStatus(p.id, next)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast(`Pedido ${p.code ?? ''} → ${next}`, 'ok')
    })
  }

  function cancel(p: SalesOrderRow) {
    if (!window.confirm(`¿Cancelar el pedido ${p.code ?? ''}?`)) return
    startTransition(async () => {
      const result = await updateOrderStatus(p.id, 'Cancelado')
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Pedido cancelado', 'ok')
    })
  }

  function remove(p: SalesOrderRow) {
    if (!window.confirm(`¿Eliminar el pedido ${p.code ?? ''}?`)) return
    startTransition(async () => {
      const result = await deletePedido(p.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Pedido eliminado', 'ok')
    })
  }

  return (
    <>
      <div className="dash-head">
        <div>
          <h1 className="dash-hello">Pedidos</h1>
          <p className="dash-sub">
            Acuerdos comerciales de tus clientes: del sí a la entrega, sin duplicar líneas.
          </p>
        </div>
        {data.canWrite && (
          <button className="btn pri" onClick={openCreate} disabled={pending || quotes.length === 0}>
            <Plus size={15} />Desde cotización
          </button>
        )}
        {data.canWrite && quotes.length === 0 && (
          <p className="dash-sub">No hay cotizaciones aceptadas sin pedido todavía.</p>
        )}
      </div>

      <div className="gkpi">
        <Stat
          label="Pedidos activos"
          value={String(stats.activos)}
          sub="sin cancelar"
          tone="blu"
          icon={<Truck size={16} />}
        />
        <Stat
          label="En curso"
          value={String(stats.enCurso)}
          sub="confirmado a despacho"
          tone="amb"
          icon={<Clock size={16} />}
        />
        <Stat
          label="Entregados"
          value={String(stats.entregados)}
          sub="cerrados con éxito"
          tone="grn"
          icon={<Package size={16} />}
        />
        <Stat
          label="Valor activo"
          value={pesos(stats.total)}
          sub="pedidos sin cancelar"
          tone="vio"
          icon={<Check size={16} />}
        />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        {pedidos.length === 0 ? (
          <div className="dempty" style={{ padding: '40px 0', textAlign: 'center' }}>
            Todavía no hay pedidos. {data.canWrite && quotes.length > 0 && 'Convierte una cotización aceptada para empezar.'}
          </div>
        ) : (
          <div className="tblwrap">
            <table className="tbl">
              <tbody>
                {pedidos.map((p) => (
                  <tr className="trow" key={p.id}>
                    <td>
                      <div className="cename">{p.code || '—'}</div>
                      <div className="ceid">{p.clientName || 'Sin cliente'}</div>
                    </td>
                    <td>
                      <div className="cename">{p.issuedOn}</div>
                      <div className="ceid">emitido</div>
                    </td>
                    <td>
                      <Badge st={p.status} tone={STATUS_TONE[p.status]} />
                      {p.items.length > 0 && (
                        <div className="ceid" style={{ marginTop: 4 }}>
                          {p.items.length} línea{p.items.length === 1 ? '' : 's'}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="cename">{pesos(p.totalCents)}</div>
                      <div className="ceid">{p.dueOn ? `vence ${p.dueOn}` : 'sin vencimiento'}</div>
                    </td>
                    {data.canWrite && (
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {NEXT_STATUS[p.status] && (
                          <button className="btn sm" onClick={() => advance(p)} disabled={pending}>
                            Avanzar<ChevronRight size={13} />
                          </button>
                        )}
                        {p.status !== 'Cancelado' && (
                          <button className="iconbtn" onClick={() => cancel(p)} title="Cancelar pedido" disabled={pending}>
                            <Trash2 size={15} />
                          </button>
                        )}
                        {p.status === 'Cancelado' && (
                          <button className="iconbtn" onClick={() => remove(p)} title="Eliminar" disabled={pending}>
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Pedido desde cotización"
        footer={
          <>
            <button className="btn" onClick={() => setDrawerOpen(false)} disabled={pending}>Cancelar</button>
            <button className="btn dark" onClick={submit} disabled={pending || !quoteId}>
              <Check size={15} />Crear pedido
            </button>
          </>
        }
      >
        <div className="fgrid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="flabel" style={{ gridColumn: '1 / -1' }}>
            Cotización aceptada
            <select className="finput" value={quoteId} onChange={(e) => setQuoteId(e.target.value)}>
              {quotes.length === 0 && <option value="">Sin cotizaciones disponibles</option>}
              {quotes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.code || 'Cotización'} · {q.client} · {pesos(q.totalCents)}
                </option>
              ))}
            </select>
          </label>
          <label className="flabel">
            Fecha del pedido
            <input className="finput" type="date" value={form.issuedOn} onChange={(e) => setForm({ ...form, issuedOn: e.target.value })} />
          </label>
          <label className="flabel">
            Vencimiento
            <input className="finput" type="date" value={form.dueOn} onChange={(e) => setForm({ ...form, dueOn: e.target.value })} />
          </label>
          <label className="flabel" style={{ gridColumn: '1 / -1' }}>
            Condiciones de pago
            <input className="finput" value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} placeholder="Contado, 30 días…" />
          </label>
          <label className="flabel" style={{ gridColumn: '1 / -1' }}>
            Dirección de entrega
            <input className="finput" value={form.shippingAddress} onChange={(e) => setForm({ ...form, shippingAddress: e.target.value })} placeholder="Dónde se entrega" />
          </label>
          <label className="flabel" style={{ gridColumn: '1 / -1' }}>
            Notas
            <textarea className="finput" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Instrucciones de despacho…" />
          </label>
        </div>
      </FormDrawer>
    </>
  )
}