'use client'

import { useMemo, useState, useTransition } from 'react'
import { FileCheck2, Check, Truck, X, Calendar, FileSpreadsheet } from '@/lib/icons'
import Stat from '@/components/ui/Stat'
import Badge from '@/components/ui/Badge'
import TabBar from '@/components/ui/TabBar'
import { useApp } from '@/lib/context/AppContext'
import { activatable } from '@/lib/a11y'
import { cop } from '@/lib/utils'
import { useExport } from '@/lib/hooks/use-export'
import { PURCHASE_ORDER_STATUSES } from '@/lib/domain'
import LoadMore from '@/components/ui/LoadMore'
import type { ComprasData, OrdenRow } from '@/server/queries/compras'
import { fetchMoreOrdenes } from '@/server/actions/compras'
import { setOrdenStatus } from '@/server/mutations/compras'

const DAY = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
const fmt = (iso: string | null) => (iso ? DAY.format(new Date(`${iso}T00:00:00`)) : '—')

const STATUS_TABS = ['Todos', ...PURCHASE_ORDER_STATUSES]

/** The one forward move available from each state. */
const NEXT: Record<string, { status: string; label: string } | null> = {
  Pendiente: { status: 'Aprobada', label: 'Aprobar' },
  Aprobada: { status: 'Recibida', label: 'Marcar recibida' },
  Recibida: null,
  Cancelada: null,
}

const STATUS_TONE: Record<string, 'grn' | 'amb' | 'blu' | 'neu'> = {
  Aprobada: 'grn', Pendiente: 'amb', Recibida: 'blu', Cancelada: 'neu',
}

export default function OrdenesCompraPage({ data }: { data: ComprasData }) {
  const { runExport, exporting } = useExport()
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState<ComprasData>(data)
  const [filter, setFilter] = useState('Todos')
  const [selId, setSelId] = useState<string | null>(data.ordenes[0]?.id ?? null)

  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const { ordenes } = state

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreOrdenes(ordenes.length)
      if (!result.ok) {
        setLoadMoreError(result.error)
        return
      }
      setState((prev) => {
        const seen = new Set(prev.ordenes.map((o) => o.id))
        return {
          ...prev,
          ordenes: [...prev.ordenes, ...result.data.rows.filter((o) => !seen.has(o.id))],
          ordenesTotal: result.data.total,
        }
      })
    })
  }
  const selected = ordenes.find((o) => o.id === selId) ?? null
  const filtered = filter === 'Todos' ? ordenes : ordenes.filter((o) => o.status === filter)

  const stats = useMemo(() => ({
    total: state.ordenesTotal,
    pending: ordenes.filter((o) => o.status === 'Pendiente').length,
    approved: ordenes.filter((o) => o.status === 'Aprobada').length,
    // Cancelled orders commit nothing; the old total counted them.
    committed: ordenes
      .filter((o) => o.status !== 'Cancelada')
      .reduce((s, o) => s + o.totalCents, 0),
  }), [ordenes, state.ordenesTotal])

  function move(o: OrdenRow, status: string) {
    startTransition(async () => {
      const result = await setOrdenStatus({ id: o.id, status: status as 'Aprobada' })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast(`Orden ${status.toLowerCase()}`, status === 'Cancelada' ? 'info' : 'ok')
    })
  }

  const exportRows = () => {
    void runExport(
      ordenes.map((o) => ({
        Código: o.code ?? '',
        Proveedor: o.supplier,
        Emitida: fmt(o.issuedOn),
        Estado: o.status,
        Total: cop(o.totalCents / 100),
      })),
      'ordenes-compra-kigyo',
      'ordenes-compra',
    )
  }

  return (
    <div>
      <div className="g3" style={{ marginBottom: 16 }}>
        <Stat icon={<FileCheck2 size={16} />} tone="blu" label="Órdenes" value={stats.total} />
        <Stat icon={<Calendar size={16} />} tone="amb" label="Pendientes" value={stats.pending} />
        <Stat icon={<Check size={16} />} tone="grn" label="Aprobadas" value={stats.approved} />
        <Stat icon={<Truck size={16} />} tone="vio" label="Comprometido" value={cop(stats.committed / 100)} sub="sin canceladas" />
      </div>

      <div className="card rise d1" style={{ marginBottom: 18 }}>
        <div className="chead">
          <TabBar value={filter} onChange={setFilter} items={STATUS_TABS.map((s) => ({ key: s, label: s }))} />
          {/*
            "Generar OC" used to live here as three text boxes — proveedor,
            proyecto, total — that invented an order out of nothing. An order
            is what an approved requisition becomes; it is created from
            Compras, which is where the lines and the supplier already are.
          */}
          <span className="kvs">Las órdenes se generan desde una requisición aprobada, en Compras.</span>
          <button disabled={exporting} aria-busy={exporting} className="btn" onClick={exportRows}><FileSpreadsheet size={15} />Exportar</button>
        </div>
        <div style={{ maxHeight: 280, overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Orden</th>
                  <th scope="col">Proveedor</th>
                  <th scope="col">Proyecto</th>
                  <th scope="col">Total</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Vence</th>
                </tr>
              </thead>
              <tbody>
                {ordenes.length === 0 ? (
                  <tr><td colSpan={6}><div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                    Todavía no hay órdenes de compra. Aprueba una requisición en Compras y genérala desde allí.
                  </div></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6}><div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>No hay órdenes en este estado.</div></td></tr>
                ) : filtered.map((o) => (
                  <tr
                    key={o.id}
                    className="trow"
                    {...activatable(() => setSelId(o.id), `Abrir la orden ${o.code ?? ''}`)}
                    style={o.id === selected?.id ? { background: 'var(--blus)' } : undefined}
                  >
                    <td>
                      <div className="cename">{o.code ?? '—'}</div>
                      {/* The requisition it came from, kept through
                          `purchase_request_id`. The old page had no such link. */}
                      <div className="elsub">{fmt(o.issuedOn)}{o.requestCode ? ` · desde ${o.requestCode}` : ''}</div>
                    </td>
                    <td>{o.supplier}</td>
                    <td className="muted">{o.projectLabel ?? '—'}</td>
                    <td className="cename">{cop(o.totalCents / 100)}</td>
                    <td><Badge st={o.status} tone={STATUS_TONE[o.status] ?? 'neu'} filled /></td>
                    <td className="muted">{fmt(o.dueOn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <LoadMore
            loaded={ordenes.length}
            total={state.ordenesTotal}
            loading={loadingMore}
            error={loadMoreError}
            onLoadMore={loadMore}
            noun="órdenes"
          />
        </div>
      </div>

      <div className="card rise d1">
        <div className="chead">
          <div className="ctitle">{selected?.code ?? 'Detalle'}</div>
          {selected && state.canWrite && (
            <div style={{ display: 'flex', gap: 6 }}>
              {NEXT[selected.status] && (
                <button className="btn pri" disabled={pending} onClick={() => move(selected, NEXT[selected.status]!.status)}>
                  {NEXT[selected.status]!.label}
                </button>
              )}
              {selected.status !== 'Cancelada' && selected.status !== 'Recibida' && (
                <button className="btn ghost" disabled={pending} onClick={() => move(selected, 'Cancelada')}>
                  <X size={13} />Cancelar
                </button>
              )}
            </div>
          )}
        </div>
        <div className="cpad">
          {selected ? (
            <>
              <div className="elrow">
                <div><div className="eltxt">Proveedor</div><div className="elsub">{selected.supplier}</div></div>
                <div><div className="eltxt">Proyecto</div><div className="elsub">{selected.projectLabel ?? '—'}</div></div>
                <div><div className="eltxt">Total</div><div className="cename">{cop(selected.totalCents / 100)}</div></div>
              </div>
              <div className="elrow">
                <div><div className="eltxt">Estado</div><div className="elsub">{selected.status}</div></div>
                <div><div className="eltxt">Emitida</div><div className="elsub">{fmt(selected.issuedOn)}</div></div>
                <div><div className="eltxt">Vence</div><div className="elsub">{fmt(selected.dueOn)}</div></div>
              </div>

              <div style={{ marginTop: 12 }}>
                <div className="elsub" style={{ marginBottom: 6 }}>Líneas</div>
                {selected.items.length === 0 ? (
                  <div className="dempty" style={{ padding: '12px 0' }}>Esta orden no tiene líneas.</div>
                ) : selected.items.map((i) => (
                  <div key={i.id} className="elrow" style={{ padding: '6px 0' }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="eltxt">{i.description}</div>
                      <div className="elsub">{i.quantity} × {cop(i.unitPriceCents / 100)}</div>
                    </div>
                    <div style={{ fontWeight: 400 }}>{cop(Math.round(i.quantity * i.unitPriceCents) / 100)}</div>
                  </div>
                ))}
              </div>

              {selected.notes && (
                <div style={{ marginTop: 12 }}>
                  <div className="elsub" style={{ marginBottom: 4 }}>Notas</div>
                  <p style={{ fontSize: 13, color: 'var(--ink2)', margin: 0, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{selected.notes}</p>
                </div>
              )}
            </>
          ) : (
            <div className="dempty">Selecciona una orden de la tabla.</div>
          )}
        </div>
      </div>
    </div>
  )
}
