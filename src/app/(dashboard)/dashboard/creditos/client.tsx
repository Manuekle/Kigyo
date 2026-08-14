'use client'

import { useMemo, useState, useTransition } from 'react'
import { AlertTriangle, Check, Plus, Trash2 } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import { useApp } from '@/lib/context/AppContext'
import { cop } from '@/lib/utils'
import type { StatusTone } from '@/lib/types'
import type { CreditosData } from '@/server/queries/creditos'
import { addLoan, deleteLoan, payInstallment } from '@/server/mutations/creditos'

const DAY = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtDate = (iso: string | null) => (iso ? DAY.format(new Date(`${iso}T00:00:00`)) : '—')
const todayIso = () => new Date().toISOString().slice(0, 10)

const LOAN_TONE: Record<string, StatusTone> = {
  activo: 'grn',
  pagado: 'blu',
  castigado: 'red',
}
const loanTone = (st: string): StatusTone => LOAN_TONE[st] ?? 'neu'

const INSTALLMENT_TONE: Record<string, StatusTone> = {
  pendiente: 'amb',
  pagada: 'grn',
}
const installmentTone = (st: string): StatusTone => INSTALLMENT_TONE[st] ?? 'neu'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function pesos(cents: number): string {
  return cop(Math.round(cents / 100))
}

const EMPTY_LOAN = {
  clientId: '', amount: '', rate: '0', term: '', startDate: todayIso(), notes: '',
}

export default function CreditosPage({ data }: { data: CreditosData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState(data)
  const [loanForm, setLoanForm] = useState(EMPTY_LOAN)

  const clientOpts = [
    { value: '', label: 'Sin cliente' },
    ...state.clients.map((c) => ({ value: c.id, label: c.name })),
  ]

  const loansById = useMemo(
    () => new Map(state.loans.map((l) => [l.id, l])),
    [state.loans],
  )

  function submitLoan() {
    startTransition(async () => {
      const result = await addLoan({
        clientId: loanForm.clientId || null,
        amountCents: Math.round(Number(loanForm.amount) * 100),
        interestRateBps: Number(loanForm.rate) || 0,
        termMonths: Number(loanForm.term),
        startDate: loanForm.startDate,
        notes: loanForm.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Préstamo creado', 'ok')
      setLoanForm({ ...EMPTY_LOAN, startDate: todayIso() })
    })
  }

  function removeLoan(id: string) {
    if (!window.confirm('¿Eliminar este préstamo y sus cuotas?')) return
    startTransition(async () => {
      const result = await deleteLoan(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Préstamo eliminado', 'ok')
    })
  }

  function pay(id: string, number: number) {
    if (!window.confirm(`¿Marcar la cuota #${number} como pagada?`)) return
    startTransition(async () => {
      const result = await payInstallment(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Cuota pagada', 'ok')
    })
  }

  return (
    <>
      <div className="g2" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat
            icon={<AlertTriangle size={16} />}
            tone="red"
            label="Mora"
            value={`${state.enMoraCount} en mora`}
            sub={`${pesos(state.moraCents)} vencido`}
          />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <div className="ctitle">Nuevo préstamo</div>
        </div>

        <div className="cpad" style={{ paddingBottom: 0 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 160px', minWidth: 130 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Cliente</div>
              <Select
                value={loanForm.clientId}
                onChange={(v) => setLoanForm((f) => ({ ...f, clientId: v }))}
                options={clientOpts}
              />
            </div>
            <div style={{ flex: '0 1 120px', minWidth: 90 }}>
              <div className="flabel">Monto</div>
              <input
                type="number"
                className="field"
                min={1}
                value={loanForm.amount}
                placeholder="500000"
                onChange={(e) => setLoanForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div style={{ flex: '0 1 110px', minWidth: 90 }}>
              <div className="flabel">Tasa</div>
              <input
                type="number"
                className="field"
                min={0}
                max={10000}
                value={loanForm.rate}
                placeholder="250"
                onChange={(e) => setLoanForm((f) => ({ ...f, rate: e.target.value }))}
              />
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                puntos básicos: 250 = 2,5% mensual
              </div>
            </div>
            <div style={{ flex: '0 1 100px', minWidth: 80 }}>
              <div className="flabel">Plazo meses</div>
              <input
                type="number"
                className="field"
                min={1}
                max={120}
                value={loanForm.term}
                placeholder="12"
                onChange={(e) => setLoanForm((f) => ({ ...f, term: e.target.value }))}
              />
            </div>
            <div style={{ flex: '0 1 140px', minWidth: 110 }}>
              <div className="flabel">Fecha inicio</div>
              <input
                type="date"
                className="field"
                value={loanForm.startDate}
                onChange={(e) => setLoanForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div style={{ flex: '1 1 180px', minWidth: 150 }}>
              <div className="flabel">Nota</div>
              <input
                className="field"
                value={loanForm.notes}
                maxLength={500}
                placeholder="Ej: préstamo de temporada"
                onChange={(e) => setLoanForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <button
              className="btn dark"
              disabled={
                pending || !loanForm.amount || Number(loanForm.amount) <= 0
                || !loanForm.term || Number(loanForm.term) <= 0 || !loanForm.startDate
              }
              aria-busy={pending}
              onClick={submitLoan}
            >
              <Plus size={14} />Crear préstamo
            </button>
          </div>
        </div>
      </div>

      <div className="card rise d3" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Préstamos</div>
        </div>

        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Cliente</th>
                <th scope="col">Monto</th>
                <th scope="col">Tasa</th>
                <th scope="col">Plazo</th>
                <th scope="col">Inicio</th>
                <th scope="col">Estado</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {state.loans.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      Sin préstamos.
                    </div>
                  </td>
                </tr>
              ) : state.loans.map((l) => (
                <tr key={l.id}>
                  <td>
                    {l.clientName ? (
                      <div className="cename">{l.clientName}</div>
                    ) : (
                      <span className="muted">Sin cliente</span>
                    )}
                  </td>
                  <td className="mono">{pesos(l.amountCents)}</td>
                  <td className="muted mono">{(l.interestRateBps / 100).toLocaleString('es-CO')}%</td>
                  <td className="muted mono">{l.termMonths} m</td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{fmtDate(l.startDate)}</td>
                  <td><Badge st={cap(l.status)} tone={loanTone(l.status)} /></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      className="ibtn"
                      style={{ width: 28, height: 28, color: 'var(--redd)' }}
                      data-tip="Eliminar"
                      disabled={pending}
                      onClick={() => removeLoan(l.id)}
                      aria-label={`Eliminar el préstamo de ${l.clientName ?? 'sin cliente'}`}
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

      <div className="card rise d4" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Cuotas</div>
        </div>

        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Préstamo</th>
                <th scope="col">#</th>
                <th scope="col">Vence</th>
                <th scope="col">Monto</th>
                <th scope="col">Estado</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {state.installments.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      Sin cuotas.
                    </div>
                  </td>
                </tr>
              ) : state.installments.map((i) => {
                const loan = loansById.get(i.loanId)
                return (
                  <tr key={i.id}>
                    <td>
                      {loan ? (
                        <>
                          <div className="cename">{loan.clientName ?? 'Sin cliente'}</div>
                          <div className="muted" style={{ fontSize: 12 }}>{fmtDate(loan.startDate)}</div>
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="mono">#{i.number}</td>
                    <td className="muted mono" style={{ fontSize: 12 }}>{fmtDate(i.dueDate)}</td>
                    <td className="mono">{pesos(i.amountCents)}</td>
                    <td><Badge st={cap(i.status)} tone={installmentTone(i.status)} /></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {i.status === 'pendiente' && (
                        <button
                          className="ibtn"
                          style={{ width: 28, height: 28, color: 'var(--grnd)' }}
                          data-tip="Pagar"
                          disabled={pending}
                          onClick={() => pay(i.id, i.number)}
                          aria-label={`Pagar la cuota #${i.number}`}
                        >
                          <Check size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
