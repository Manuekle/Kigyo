'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Cashier, Check, Plus, Trash2, DollarSign, TrendingUp, TrendingDown,
  Lock, FileSpreadsheet, AlertTriangle,
} from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import TabBar from '@/components/ui/TabBar'
import FormDrawer from '@/components/ui/FormDrawer'
import { useApp } from '@/lib/context/AppContext'
import { useExport } from '@/lib/hooks/use-export'
import { CASH_MOVEMENT_KINDS, PAYMENT_METHODS } from '@/lib/domain'
import { cop } from '@/lib/utils'
import type { CajaData } from '@/server/queries/caja'
import {
  abrirCaja, cerrarCaja, eliminarMovimiento, registrarMovimiento,
} from '@/server/mutations/caja'

const DATETIME = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
})

function formatWhen(iso: string | null): string {
  return iso ? DATETIME.format(new Date(iso)) : '—'
}

function toCents(value: string): number {
  const n = Number(value.replace(/[^\d]/g, ''))
  return Number.isFinite(n) ? Math.round(n) * 100 : 0
}

function pesos(cents: number): string {
  return cop(Math.round(cents / 100))
}

/**
 * Cómo se lee una diferencia de arqueo.
 *
 * Cero es lo normal y merece decirse con esa palabra: «Cuadró». Un sobrante y
 * un faltante son ambos anomalías, pero un faltante es el que alguien tiene que
 * explicar, así que van con tonos distintos — pintarlos iguales es como el
 * software deja de ayudar a mirar.
 */
function differenceLabel(cents: number): { text: string; tone: 'grn' | 'amb' | 'red' } {
  if (cents === 0) return { text: 'Cuadró', tone: 'grn' }
  if (cents > 0) return { text: `Sobra ${pesos(cents)}`, tone: 'amb' }
  return { text: `Falta ${pesos(Math.abs(cents))}`, tone: 'red' }
}

const EMPTY_MOVEMENT = {
  kind: 'Egreso', amount: '', concept: '', method: 'Efectivo',
}

export default function CajaPage({ data }: { data: CajaData }) {
  const { runExport, exporting } = useExport()
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState(data)
  const [tab, setTab] = useState('turno')

  const [openOpen, setOpenOpen] = useState(false)
  const [openForm, setOpenForm] = useState({ float: '', notes: '', siteId: '' })

  const [closeOpen, setCloseOpen] = useState(false)
  const [closeForm, setCloseForm] = useState({ counted: '', notes: '' })

  const [movementOpen, setMovementOpen] = useState(false)
  const [movementForm, setMovementForm] = useState(EMPTY_MOVEMENT)

  function run(
    action: () => Promise<{ ok: true; data: CajaData } | { ok: false; error: string }>,
    okMessage: string,
    after?: () => void,
  ) {
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        addToast(result.error, 'err')
        return
      }
      setState(result.data)
      addToast(okMessage, 'ok')
      after?.()
    })
  }

  const abierta = state.abierta
  const resumen = state.resumen

  /**
   * Lo que la pantalla enseña mientras el turno corre.
   *
   * Se muestra el desglose entero y no solo el total, porque la pregunta que
   * alguien trae al abrir esta pantalla nunca es «cuánto debería haber» sino
   * «por qué es ese número». Base, ventas en efectivo, ventas por otros medios,
   * ingresos y egresos: cinco líneas que suman a una.
   */
  function exportRows() {
    if (tab === 'historial') {
      void runExport(state.historial.map((s) => ({
        Turno: s.code ?? '', Abrió: formatWhen(s.openedAt), 'Abrió quién': s.openedByName ?? '',
        Cerró: formatWhen(s.closedAt), 'Cerró quién': s.closedByName ?? '',
        Base: pesos(s.openingFloatCents),
        Esperado: s.expectedCents === null ? '' : pesos(s.expectedCents),
        Contado: s.countedCents === null ? '' : pesos(s.countedCents),
        Diferencia: s.differenceCents === null ? '' : pesos(s.differenceCents),
      })), 'turnos-de-caja', 'caja')
      return
    }
    void runExport(state.movimientos.map((m) => ({
      Tipo: m.kind, Monto: pesos(m.amountCents), Concepto: m.concept,
      Medio: m.method, Quién: m.createdByName ?? '', Cuándo: formatWhen(m.createdAt),
    })), 'movimientos-de-caja', 'caja')
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat icon={<Cashier size={16} />} tone="blu" label="Estado"
            value={abierta ? 'Abierta' : 'Cerrada'}
            sub={abierta ? `desde ${formatWhen(abierta.openedAt)}` : 'sin turno activo'} />
        </div>
        <div className="rise d2">
          <Stat icon={<DollarSign size={16} />} tone="grn" label="Esperado en caja"
            value={abierta ? pesos(resumen.esperadoCents) : '—'}
            sub={abierta ? `base ${pesos(resumen.baseCents)}` : 'abre un turno'} />
        </div>
        <div className="rise d3">
          <Stat icon={<TrendingUp size={16} />} tone="vio" label="Ventas en efectivo"
            value={abierta ? pesos(resumen.ventasEfectivoCents) : '—'}
            sub={abierta && resumen.ventasOtrosCents > 0
              ? `${pesos(resumen.ventasOtrosCents)} por otros medios`
              : 'solo lo que entra al cajón'} />
        </div>
        <div className="rise d4">
          <Stat icon={<TrendingDown size={16} />} tone="amb" label="Egresos"
            value={abierta ? pesos(resumen.egresosCents) : '—'}
            sub={abierta ? `${state.movimientos.length} movimientos` : ''} />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <TabBar
            items={[
              { key: 'turno', label: 'Turno' },
              { key: 'historial', label: 'Historial' },
              ...(state.sites.length > 1 ? [{ key: 'sucursales', label: 'Sucursales' }] : []),
            ]}
            value={tab}
            onChange={setTab}
          />
          {state.canWrite && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button disabled={exporting} aria-busy={exporting} className="btn" onClick={exportRows}>
                <FileSpreadsheet size={15} />Exportar
              </button>
              {abierta ? (
                <>
                  <button className="btn" disabled={pending} onClick={() => {
                    setMovementForm(EMPTY_MOVEMENT); setMovementOpen(true)
                  }}>
                    <Plus size={15} />Movimiento
                  </button>
                  <button className="btn dark" disabled={pending} onClick={() => {
                    // Precargado con lo esperado: en la enorme mayoría de los
                    // cierres el cajón cuadra, y hacer teclear el mismo número
                    // que ya está en pantalla es pedir un error de dedo que
                    // luego parece un faltante.
                    setCloseForm({
                      counted: String(Math.round((abierta.expectedCents ?? 0) / 100)),
                      notes: '',
                    })
                    setCloseOpen(true)
                  }}>
                    <Lock size={15} />Cerrar turno
                  </button>
                </>
              ) : (
                <button className="btn dark" disabled={pending} onClick={() => {
                  setOpenForm({ float: '', notes: '', siteId: '' }); setOpenOpen(true)
                }}>
                  <Plus size={15} />Abrir turno
                </button>
              )}
            </div>
          )}
        </div>

        {/* ─── Turno ──────────────────────────────────────────────────── */}
        {tab === 'turno' && (
          abierta === null ? (
            <div className="cpad">
              <div className="dempty" style={{ padding: '32px 0', textAlign: 'center' }}>
                No hay ningún turno abierto.
                <div style={{ fontSize: 12.5, color: 'var(--ink3)', marginTop: 8, maxWidth: 460, margin: '8px auto 0' }}>
                  Un turno empieza con la base que queda en el cajón y termina contando lo
                  que hay. Entre las dos cosas se registran las ventas y todo lo que entra
                  o sale que no es una venta.
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="cpad" style={{ paddingBottom: 0 }}>
                {/* El desglose, no solo el total: quien abre esta pantalla no
                    pregunta cuánto debería haber, pregunta por qué es ese
                    número. */}
                <div className="caja-breakdown">
                  <div><span>Base inicial</span><b>{pesos(resumen.baseCents)}</b></div>
                  <div><span>+ Ventas en efectivo</span><b>{pesos(resumen.ventasEfectivoCents)}</b></div>
                  <div><span>+ Ingresos</span><b>{pesos(resumen.ingresosCents)}</b></div>
                  <div><span>− Egresos y retiros</span><b>{pesos(resumen.egresosCents)}</b></div>
                  <div className="caja-total"><span>Debería haber</span><b>{pesos(resumen.esperadoCents)}</b></div>
                </div>
                {resumen.ventasOtrosCents > 0 && (
                  <p className="psub" style={{ fontSize: 12.5 }}>
                    {pesos(resumen.ventasOtrosCents)} se cobraron por tarjeta o transferencia y
                    no están en el cajón, así que no cuentan para el arqueo.
                  </p>
                )}
              </div>

              <div className="tblwrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th scope="col">Movimiento</th>
                      <th scope="col">Monto</th>
                      <th scope="col">Medio</th>
                      <th scope="col">Quién</th>
                      <th scope="col">Cuándo</th>
                      {state.canWrite && <th scope="col" aria-label="Acciones" />}
                    </tr>
                  </thead>
                  <tbody>
                    {state.movimientos.length === 0 ? (
                      <tr>
                        <td colSpan={state.canWrite ? 6 : 5}>
                          <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                            Sin movimientos. Las ventas no aparecen aquí — entran solas al
                            arqueo desde el punto de venta.
                          </div>
                        </td>
                      </tr>
                    ) : state.movimientos.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <div className="cename">{m.concept}</div>
                          <div className="elsub">{m.kind}</div>
                        </td>
                        <td>
                          <span style={{ color: m.kind === 'Ingreso' ? 'var(--grnd)' : 'var(--redd)' }}>
                            {m.kind === 'Ingreso' ? '+' : '−'} {pesos(m.amountCents)}
                          </span>
                        </td>
                        <td><Badge st={m.method} tone="neu" /></td>
                        <td>{m.createdByName ?? '—'}</td>
                        <td>{formatWhen(m.createdAt)}</td>
                        {state.canWrite && (
                          <td>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                              <button className="ibtn" aria-label={`Eliminar ${m.concept}`}
                                disabled={pending}
                                onClick={() => run(
                                  () => eliminarMovimiento(m.id), 'Movimiento eliminado',
                                )}>
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {state.hasPos && (
                <div className="cpad" style={{ paddingTop: 0 }}>
                  <p className="psub" style={{ fontSize: 12.5 }}>
                    {state.ventas.length === 0
                      ? 'Todavía no se ha cobrado nada en este turno. '
                      : `${state.ventas.filter((v) => v.status !== 'Anulada').length} ventas cobradas en este turno. `}
                    <Link href="/dashboard/pos">Ir al punto de venta</Link>
                  </p>
                </div>
              )}
            </>
          )
        )}

        {/* ─── Historial ──────────────────────────────────────────────── */}
        {tab === 'historial' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Turno</th>
                  <th scope="col">Abrió</th>
                  <th scope="col">Cerró</th>
                  <th scope="col">Esperado</th>
                  <th scope="col">Contado</th>
                  <th scope="col">Arqueo</th>
                </tr>
              </thead>
              <tbody>
                {state.historial.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        Todavía no hay turnos cerrados.
                      </div>
                    </td>
                  </tr>
                ) : state.historial.map((s) => {
                  const diff = s.differenceCents === null ? null : differenceLabel(s.differenceCents)
                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="cename mono">{s.code ?? '—'}</div>
                        <div className="elsub">
                          base {pesos(s.openingFloatCents)}
                          {s.siteName ? ` · ${s.siteName}` : ''}
                        </div>
                      </td>
                      <td>
                        {formatWhen(s.openedAt)}
                        <div className="elsub">{s.openedByName ?? '—'}</div>
                      </td>
                      <td>
                        {formatWhen(s.closedAt)}
                        <div className="elsub">{s.closedByName ?? '—'}</div>
                      </td>
                      <td>{s.expectedCents === null ? '—' : pesos(s.expectedCents)}</td>
                      <td>{s.countedCents === null ? '—' : pesos(s.countedCents)}</td>
                      <td>{diff ? <Badge st={diff.text} tone={diff.tone} /> : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ─── Sucursales ─────────────────────────────────────────────── */}
        {tab === 'sucursales' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Sucursal</th>
                  <th scope="col">Turnos cerrados</th>
                  <th scope="col">Esperado</th>
                  <th scope="col">Contado</th>
                  <th scope="col">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {state.cierresPorSucursal.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        Sin turnos cerrados todavía en ninguna sucursal.
                      </div>
                    </td>
                  </tr>
                ) : state.cierresPorSucursal.map((r) => {
                  const diff = differenceLabel(r.diferenciaCents)
                  return (
                    <tr key={r.siteId}>
                      <td><div className="cename">{r.siteName}</div></td>
                      <td className="mono">{r.turnos}</td>
                      <td>{pesos(r.esperadoCents)}</td>
                      <td>{pesos(r.contadoCents)}</td>
                      <td><Badge st={diff.text} tone={diff.tone} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="cpad" style={{ paddingTop: 0 }}>
              <p className="psub" style={{ fontSize: 12.5 }}>
                Suma de los últimos {state.historial.length} turnos cerrados, agrupados por
                sucursal. La diferencia es la suma de cada arqueo — un sobrante en un turno
                puede tapar un faltante en otro.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Formularios ──────────────────────────────────────────────── */}

      <FormDrawer
        open={openOpen}
        onClose={() => setOpenOpen(false)}
        title="Abrir turno de caja"
        footer={
          <button className="btn dark" disabled={pending} onClick={() => run(
            () => abrirCaja({
              openingFloatCents: toCents(openForm.float),
              notes: openForm.notes,
              siteId: openForm.siteId || null,
            }),
            'Turno abierto',
            () => setOpenOpen(false),
          )}>
            <Check size={15} />Abrir
          </button>
        }
      >
        {state.sites.length > 1 && (
          <>
            <label className="flabel" htmlFor="ca-site">Sucursal</label>
            <Select
          id="ca-site"
              value={openForm.siteId}
              onChange={(v) => setOpenForm({ ...openForm, siteId: v })}
              options={[
                { value: '', label: 'Sin sucursal' },
                ...state.sites.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
            <p className="psub" style={{ fontSize: 12.5 }}>
              La venta de mostrador toma la sucursal del turno abierto. Si la
              empresa tiene varias, elige la de este cajón.
            </p>
          </>
        )}

        <label className="flabel" htmlFor="ca-float">Base inicial</label>
        <input id="ca-float" className="field" inputMode="numeric" value={openForm.float}
          placeholder="50000"
          onChange={(e) => setOpenForm({ ...openForm, float: e.target.value })} />
        <p className="psub" style={{ fontSize: 12.5 }}>
          Lo que hay en el cajón antes de la primera venta. Cuenta para el arqueo y no es
          parte de lo vendido — confundir las dos cosas es lo que hace que un cierre no
          cuadre nunca.
        </p>

        <label className="flabel" htmlFor="ca-notes">Notas</label>
        <textarea id="ca-notes" className="field" rows={2} value={openForm.notes} maxLength={1000}
          onChange={(e) => setOpenForm({ ...openForm, notes: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        title="Cerrar turno"
        footer={
          <button className="btn dark" disabled={pending || !abierta} onClick={() => abierta && run(
            () => cerrarCaja({
              sessionId: abierta.id,
              countedCents: toCents(closeForm.counted),
              notes: closeForm.notes,
            }),
            'Turno cerrado',
            () => setCloseOpen(false),
          )}>
            <Lock size={15} />Cerrar turno
          </button>
        }
      >
        <div className="caja-breakdown" style={{ marginBottom: 14 }}>
          <div className="caja-total">
            <span>Debería haber</span><b>{pesos(resumen.esperadoCents)}</b>
          </div>
        </div>

        <label className="flabel" htmlFor="ca-counted">Contado en el cajón</label>
        <input id="ca-counted" className="field" inputMode="numeric" value={closeForm.counted}
          onChange={(e) => setCloseForm({ ...closeForm, counted: e.target.value })} />

        {/* La diferencia, antes de firmar y no después. Cerrar y enterarse es
            peor que enterarse y decidir si se recuenta. */}
        {(() => {
          const counted = toCents(closeForm.counted)
          const diff = counted - resumen.esperadoCents
          const label = differenceLabel(diff)
          return (
            <p className="psub" style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 8 }}>
              {diff !== 0 && <AlertTriangle size={14} />}
              <Badge st={label.text} tone={label.tone} />
            </p>
          )
        })()}

        <label className="flabel" htmlFor="ca-close-notes">Notas del cierre</label>
        <textarea id="ca-close-notes" className="field" rows={3} value={closeForm.notes} maxLength={1000}
          placeholder="Si hay diferencia, explica por qué"
          onChange={(e) => setCloseForm({ ...closeForm, notes: e.target.value })} />

        <p className="psub" style={{ fontSize: 12.5 }}>
          Al cerrar, lo esperado queda congelado. Anular una venta vieja después no
          reescribe este arqueo.
        </p>
      </FormDrawer>

      <FormDrawer
        open={movementOpen}
        onClose={() => setMovementOpen(false)}
        title="Movimiento de caja"
        footer={
          <button className="btn dark"
            disabled={pending || !abierta || !movementForm.concept.trim() || !movementForm.amount}
            onClick={() => abierta && run(
              () => registrarMovimiento({
                sessionId: abierta.id,
                kind: movementForm.kind as (typeof CASH_MOVEMENT_KINDS)[number],
                amountCents: toCents(movementForm.amount),
                concept: movementForm.concept,
                method: movementForm.method as (typeof PAYMENT_METHODS)[number],
              }),
              'Movimiento registrado',
              () => setMovementOpen(false),
            )}>
            <Check size={15} />Registrar
          </button>
        }
      >
        <label className="flabel" htmlFor="mo-kind">Tipo</label>
        <Select
          id="mo-kind" value={movementForm.kind}
          onChange={(v) => setMovementForm({ ...movementForm, kind: v })}
          options={[...CASH_MOVEMENT_KINDS]} />

        <label className="flabel" htmlFor="mo-amount">Monto</label>
        <input id="mo-amount" className="field" inputMode="numeric" value={movementForm.amount}
          placeholder="20000"
          onChange={(e) => setMovementForm({ ...movementForm, amount: e.target.value })} />

        <label className="flabel" htmlFor="mo-concept">Concepto</label>
        <input id="mo-concept" className="field" value={movementForm.concept} maxLength={200}
          placeholder="Pago al mensajero"
          onChange={(e) => setMovementForm({ ...movementForm, concept: e.target.value })} />

        <label className="flabel" htmlFor="mo-method">Medio</label>
        <Select
          id="mo-method" value={movementForm.method}
          onChange={(v) => setMovementForm({ ...movementForm, method: v })}
          options={[...PAYMENT_METHODS]} />

        <p className="psub" style={{ fontSize: 12.5 }}>
          Solo lo que no es una venta: propinas pagadas, domicilios, retiros a la caja
          fuerte, caja menor. Las ventas entran solas al arqueo desde el punto de venta —
          anotarlas aquí las contaría dos veces.
        </p>
      </FormDrawer>
    </>
  )
}
