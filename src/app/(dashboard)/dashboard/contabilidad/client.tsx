'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  BookOpen, Plus, Trash2, Check, TrendingUp, Building2, Layers,
} from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import DatePicker from '@/components/ui/DatePicker'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import TabBar from '@/components/ui/TabBar'
import FormDrawer from '@/components/ui/FormDrawer'
import LoadMore from '@/components/ui/LoadMore'
import { useApp } from '@/lib/context/AppContext'
import { cop } from '@/lib/utils'
import type { ContabilidadData } from '@/server/queries/contabilidad'
import {
  createEntry, deleteEntry, publishEntry, setAccountMapping,
} from '@/server/mutations/contabilidad'
import { fetchMoreAsientos } from '@/server/actions/contabilidad'

const DATE = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
const fmt = (iso: string | null) => (iso ? DATE.format(new Date(`${iso}T00:00:00`)) : '—')

const MONTH = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' })
const fmtMonth = (iso: string) => MONTH.format(new Date(`${iso}-01T00:00:00`))

const pesos = (cents: number) => cop(Math.round(cents / 100))

const CONCEPTOS = [
  { value: 'venta_credito', label: 'Venta a crédito' },
  { value: 'cobro', label: 'Cobro de factura' },
  { value: 'compra', label: 'Compra de inventario' },
  { value: 'pago_proveedor', label: 'Pago a proveedor' },
  { value: 'caja_diferencia', label: 'Diferencia de caja' },
]

const DEFAULT_ACCOUNTS: Record<string, string> = {
  venta_credito: '1305',
  cobro: '1105',
  compra: '1435',
  pago_proveedor: '2205',
  caja_diferencia: '5195',
}

type LineDraft = { accountId: string; description: string; debit: string; credit: string }

const EMPTY_LINE: LineDraft = { accountId: '', description: '', debit: '', credit: '' }

const EMPTY_ENTRY = { entryDate: '', memo: '', lines: [{ ...EMPTY_LINE }, { ...EMPTY_LINE }] }

const toCents = (v: string) => Math.round((Number(v.replace(/[^\d]/g, '')) || 0) * 100)

export default function ContabilidadPage({ data }: { data: ContabilidadData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState<ContabilidadData>(data)
  const [tab, setTab] = useState('Asientos')
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_ENTRY)
  const [mappingOpen, setMappingOpen] = useState(false)
  const [mapping, setMapping] = useState<Record<string, string>>({ ...DEFAULT_ACCOUNTS })

  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const stats = useMemo(() => {
    const posted = state.asientos.filter((a) => a.status === 'Publicado')
    const totalActivo = state.balance.find((b) => b.kind === 'Activo')?.totalCents ?? 0
    const totalPasivo = state.balance.find((b) => b.kind === 'Pasivo + Patrimonio')?.totalCents ?? 0
    const last = state.pnl[state.pnl.length - 1]
    return {
      asientos: state.asientosTotal,
      publicados: posted.length,
      activo: totalActivo,
      pasivo: totalPasivo,
      utilidadMes: last?.utilidad ?? 0,
    }
  }, [state])

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreAsientos(state.asientos.length)
      if (!result.ok) { setLoadMoreError(result.error); return }
      setState((prev) => {
        const seen = new Set(prev.asientos.map((a) => a.id))
        return {
          ...prev,
          asientos: [...prev.asientos, ...result.data.rows.filter((r) => !seen.has(r.id))],
          asientosTotal: result.data.total,
        }
      })
    })
  }

  function draftBalances(): { debits: number; credits: number } {
    return form.lines.reduce(
      (acc, l) => ({ debits: acc.debits + toCents(l.debit), credits: acc.credits + toCents(l.credit) }),
      { debits: 0, credits: 0 },
    )
  }

  function submitEntry() {
    if (!form.memo.trim() || !form.entryDate) { addToast('Falta la descripción o la fecha', 'err'); return }
    const lines = form.lines
      .filter((l) => l.accountId && (toCents(l.debit) > 0 || toCents(l.credit) > 0))
      .map((l) => ({
        accountId: l.accountId,
        description: l.description.trim(),
        debitCents: toCents(l.debit),
        creditCents: toCents(l.credit),
      }))
    startTransition(async () => {
      const result = await createEntry({
        entryDate: form.entryDate,
        memo: form.memo.trim(),
        lines,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      setFormOpen(false)
      setForm({ ...EMPTY_ENTRY, entryDate: new Date().toISOString().slice(0, 10) })
      addToast('Asiento creado en borrador', 'ok')
    })
  }

  function publish(a: ContabilidadData['asientos'][number]) {
    startTransition(async () => {
      const result = await publishEntry({ id: a.id })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Asiento publicado', 'ok')
    })
  }

  function remove(a: ContabilidadData['asientos'][number]) {
    if (!window.confirm(`¿Eliminar el asiento «${a.memo}»? Solo los borradores se pueden eliminar.`)) return
    startTransition(async () => {
      const result = await deleteEntry(a.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Asiento eliminado', 'info')
    })
  }

  function saveMapping() {
    startTransition(async () => {
      let lastError = ''
      for (const [concepto, accountId] of Object.entries(mapping)) {
        if (accountId === DEFAULT_ACCOUNTS[concepto]) continue
        const result = await setAccountMapping({
          concepto: concepto as never,
          accountId,
        })
        if (!result.ok) { lastError = result.error; break }
      }
      if (lastError) { addToast(lastError, 'err'); return }
      setMappingOpen(false)
      addToast('Mapeo de cuentas guardado', 'ok')
    })
  }

  const { debits, credits } = draftBalances()

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat icon={<BookOpen size={16} />} tone="blu" label="Asientos"
            value={stats.asientos} sub={`${stats.publicados} publicados`} />
        </div>
        <div className="rise d2">
          <Stat icon={<Building2 size={16} />} tone="grn" label="Activo"
            value={pesos(stats.activo)} />
        </div>
        <div className="rise d3">
          <Stat icon={<Building2 size={16} />} tone="amb" label="Pasivo + Patrimonio"
            value={pesos(stats.pasivo)} />
        </div>
        <div className="rise d4">
          <Stat icon={<TrendingUp size={16} />} tone="vio" label="Utilidad del mes"
            value={pesos(stats.utilidadMes)} />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead" style={{ flexWrap: 'wrap', gap: 10 }}>
          <TabBar
            value={tab}
            onChange={setTab}
            items={[
              { key: 'Asientos', label: `Asientos · ${state.asientosTotal}` },
              { key: 'Mayor', label: `Mayor · ${state.mayor.length}` },
              { key: 'Reportes', label: 'Reportes' },
            ]}
          />
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            {tab === 'Mayor' && state.canWrite && (
              <button className="btn" disabled={pending} onClick={() => setMappingOpen(true)}>
                <Layers size={15} />Mapeo de cuentas
              </button>
            )}
            {tab === 'Asientos' && state.canWrite && (
              <button className="btn dark" disabled={pending}
                onClick={() => {
                  setForm({ ...EMPTY_ENTRY, entryDate: new Date().toISOString().slice(0, 10) })
                  setFormOpen(true)
                }}>
                <Plus size={15} />Asiento
              </button>
            )}
          </div>
        </div>

        {tab === 'Asientos' && (
          <>
            <div className="tblwrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Fecha</th>
                    <th scope="col">Descripción</th>
                    <th scope="col">Fuente</th>
                    <th scope="col">Líneas</th>
                    <th scope="col">Total</th>
                    <th scope="col">Estado</th>
                    {state.canWrite && <th scope="col" aria-label="Acciones" />}
                  </tr>
                </thead>
                <tbody>
                  {state.asientos.length === 0 ? (
                    <tr>
                      <td colSpan={state.canWrite ? 7 : 6}>
                        <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                          {state.canWrite
                            ? 'Todavía no hay asientos. Los movimientos de facturación, compras y caja llegan solos cuando el módulo está activo.'
                            : 'Todavía no hay asientos.'}
                        </div>
                      </td>
                    </tr>
                  ) : state.asientos.map((a) => (
                    <tr key={a.id}>
                      <td className="muted">{fmt(a.entryDate)}</td>
                      <td>
                        <div className="cename">{a.memo}</div>
                        <div className="elsub">
                          {a.lines.slice(0, 2).map((l) => `${l.accountId} ${l.accountName}`).join(' · ')}
                          {a.lines.length > 2 ? ' · …' : ''}
                        </div>
                      </td>
                      <td><Badge st={a.source} tone="neu" /></td>
                      <td className="muted">{a.lines.length}</td>
                      <td className="cename">{pesos(a.totalCents)}</td>
                      <td>
                        <Badge st={a.status} tone={a.status === 'Publicado' ? 'grn' : 'amb'} />
                      </td>
                      {state.canWrite && (
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            {a.status === 'Borrador' && (
                              <button className="ibtn" title="Publicar" aria-label={`Publicar ${a.memo}`}
                                disabled={pending} onClick={() => publish(a)}>
                                <Check size={15} />
                              </button>
                            )}
                            {a.status === 'Borrador' && (
                              <button className="ibtn" style={{ color: 'var(--redd)' }} title="Eliminar"
                                aria-label={`Eliminar ${a.memo}`} disabled={pending} onClick={() => remove(a)}>
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <LoadMore
              loaded={state.asientos.length}
              total={state.asientosTotal}
              loading={loadingMore}
              error={loadMoreError}
              onLoadMore={loadMore}
              noun="asientos"
            />
          </>
        )}

        {tab === 'Mayor' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Cuenta</th>
                  <th scope="col">Tipo</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {state.mayor.length === 0 ? (
                  <tr>
                    <td colSpan={3}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        El mayor se llena solo cuando hay asientos publicados.
                      </div>
                    </td>
                  </tr>
                ) : state.mayor.map((m) => (
                  <tr key={m.code}>
                    <td>
                      <div className="cename mono">{m.code}</div>
                      <div className="elsub">{m.name}</div>
                    </td>
                    <td><Badge st={m.kind} tone="neu" /></td>
                    <td className="cename" style={{ textAlign: 'right' }}>{pesos(m.balanceCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'Reportes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 16 }}>
            <div>
              <div className="ctitle" style={{ marginBottom: 10 }}>Pérdidas y ganancias</div>
              <div className="tblwrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th scope="col">Mes</th>
                      <th scope="col" style={{ textAlign: 'right' }}>Ingresos</th>
                      <th scope="col" style={{ textAlign: 'right' }}>Costos</th>
                      <th scope="col" style={{ textAlign: 'right' }}>Gastos</th>
                      <th scope="col" style={{ textAlign: 'right' }}>Utilidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.pnl.length === 0 ? (
                      <tr><td colSpan={5}><div className="dempty" style={{ padding: '18px 0', textAlign: 'center' }}>Sin datos publicados todavía.</div></td></tr>
                    ) : state.pnl.map((r) => (
                      <tr key={r.month}>
                        <td className="cename">{fmtMonth(r.month)}</td>
                        <td className="muted" style={{ textAlign: 'right' }}>{pesos(r.ingresos)}</td>
                        <td className="muted" style={{ textAlign: 'right' }}>{pesos(r.costos)}</td>
                        <td className="muted" style={{ textAlign: 'right' }}>{pesos(r.gastos)}</td>
                        <td className="cename" style={{ textAlign: 'right', color: r.utilidad >= 0 ? 'var(--grn)' : 'var(--red)' }}>{pesos(r.utilidad)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="ctitle" style={{ marginBottom: 10 }}>Balance</div>
              <div className="tblwrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th scope="col">Rubro</th>
                      <th scope="col" style={{ textAlign: 'right' }}>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.balance.length === 0 ? (
                      <tr><td colSpan={2}><div className="dempty" style={{ padding: '18px 0', textAlign: 'center' }}>Sin datos publicados todavía.</div></td></tr>
                    ) : state.balance.map((b) => (
                      <tr key={b.kind}>
                        <td className="cename">{b.kind}</td>
                        <td className="cename" style={{ textAlign: 'right' }}>{pesos(b.totalCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="ctitle" style={{ marginBottom: 10 }}>Flujo de caja (1105/1110)</div>
              <div className="tblwrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col">Concepto</th>
                      <th scope="col" style={{ textAlign: 'right' }}>Movimiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.flujo.length === 0 ? (
                      <tr><td colSpan={3}><div className="dempty" style={{ padding: '18px 0', textAlign: 'center' }}>Sin movimientos de caja ni bancos.</div></td></tr>
                    ) : state.flujo.map((f, i) => (
                      <tr key={i}>
                        <td className="muted">{fmt(f.date)}</td>
                        <td>{f.memo}</td>
                        <td className="cename" style={{ textAlign: 'right', color: f.amountCents >= 0 ? 'var(--grn)' : 'var(--red)' }}>{pesos(f.amountCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <FormDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Nuevo asiento"
        wide
        footer={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
            <div className="elsub" style={{ flex: 1 }}>
              Débitos {pesos(debits)} · Créditos {pesos(credits)}
              {debits !== credits && (
                <span style={{ color: 'var(--red)' }}> — no cuadra</span>
              )}
            </div>
            <button className="btn dark" disabled={pending || debits !== credits || debits === 0}
              onClick={submitEntry}>
              <Check size={15} />Guardar borrador
            </button>
          </div>
        }
      >
        <div className="fg2">
          <div>
            <div className="flabel">Fecha</div>
            <DatePicker ariaLabel="Fecha" value={form.entryDate}
              onChange={(v) => setForm((f) => ({ ...f, entryDate: v }))} />
          </div>
          <div>
            <label className="flabel" htmlFor="je-memo">Descripción</label>
            <input id="je-memo" className="field" value={form.memo} placeholder="Qué pasó"
              onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))} />
          </div>
        </div>

        <div className="flabel" style={{ marginTop: 18 }}>Líneas</div>
        {form.lines.map((line, index) => (
          <div key={index} className="card" style={{ padding: 12, marginBottom: 10 }}>
            <Select
              value={line.accountId}
              onChange={(v) => setForm((f) => ({
                ...f,
                lines: f.lines.map((l, i) => i === index ? { ...l, accountId: v } : l),
              }))}
              placeholder="Cuenta"
              options={state.cuentas.map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` }))}
            />
            <div className="fg2" style={{ marginTop: 8 }}>
              <div>
                <label className="flabel" htmlFor={`jl-d-${index}`}>Débito (COP)</label>
                <input id={`jl-d-${index}`} className="field" inputMode="numeric" value={line.debit}
                  onChange={(e) => setForm((f) => ({
                    ...f,
                    lines: f.lines.map((l, i) => i === index ? { ...l, debit: e.target.value, credit: e.target.value ? '' : l.credit } : l),
                  }))} />
              </div>
              <div>
                <label className="flabel" htmlFor={`jl-c-${index}`}>Crédito (COP)</label>
                <input id={`jl-c-${index}`} className="field" inputMode="numeric" value={line.credit}
                  onChange={(e) => setForm((f) => ({
                    ...f,
                    lines: f.lines.map((l, i) => i === index ? { ...l, credit: e.target.value, debit: e.target.value ? '' : l.debit } : l),
                  }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <input className="field" style={{ flex: 1 }} placeholder="Detalle (opcional)"
                value={line.description}
                onChange={(e) => setForm((f) => ({
                  ...f,
                  lines: f.lines.map((l, i) => i === index ? { ...l, description: e.target.value } : l),
                }))} />
              {form.lines.length > 2 && (
                <button className="ibtn" aria-label="Quitar línea"
                  onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== index) }))}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
        <button className="btn" onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, { ...EMPTY_LINE }] }))}>
          <Plus size={15} />Añadir línea
        </button>
      </FormDrawer>

      <FormDrawer
        open={mappingOpen}
        onClose={() => setMappingOpen(false)}
        title="Mapeo de cuentas"
        footer={
          <button className="btn dark" disabled={pending} onClick={saveMapping}>
            <Check size={15} />Guardar
          </button>
        }
      >
        <div className="elsub" style={{ marginBottom: 12 }}>
          Qué cuenta usa cada concepto al generar asientos automáticos.
          Los que no cambies siguen con su cuenta por defecto.
        </div>
        {CONCEPTOS.map((c) => (
          <div key={c.value} style={{ marginBottom: 12 }}>
            <div className="flabel">{c.label}</div>
            <Select
              value={mapping[c.value] ?? DEFAULT_ACCOUNTS[c.value]}
              onChange={(v) => setMapping((m) => ({ ...m, [c.value]: v }))}
              options={state.cuentas.map((a) => ({ value: a.code, label: `${a.code} · ${a.name}` }))}
            />
          </div>
        ))}
      </FormDrawer>
    </>
  )
}
