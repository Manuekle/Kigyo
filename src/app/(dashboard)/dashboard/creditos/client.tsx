'use client'

import { useMemo, useState, useTransition } from 'react'
import { AlertTriangle, Check, Plus, Trash2 } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import DatePicker from '@/components/ui/DatePicker'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import { useApp } from '@/lib/context/AppContext'
import { useConfirm } from '@/lib/context/ConfirmContext'
import { cop } from '@/lib/utils'
import type { StatusTone } from '@/lib/types'
import type { CreditosData } from '@/server/queries/creditos'
import { addLoan, deleteLoan, payInstallment, setLoanStatus } from '@/server/mutations/creditos'

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

const LOAN_STATUS_OPTS = [
  { value: 'activo', label: 'Activo' },
  { value: 'pagado', label: 'Pagado' },
  { value: 'castigado', label: 'Castigado' },
]

export default function CreditosPage({ data }: { data: CreditosData }) {
  const { addToast } = useApp()
  const confirm = useConfirm()
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

  async function removeLoan(id: string) {
    if (!(await confirm({ title: '¿Eliminar este préstamo y sus cuotas?', tone: 'danger' }))) return
    startTransition(async () => {
      const result = await deleteLoan(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Préstamo eliminado', 'ok')
    })
  }

  async function pay(id: string, number: number) {
    if (!(await confirm({ title: `¿Marcar la cuota #${number} como pagada?` }))) return
    startTransition(async () => {
      const result = await payInstallment(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Cuota pagada', 'ok')
    })
  }

  /**
   * Cierra el préstamo: pagado o castigado.
   *
   * `setLoanStatus` existía desde que existe el módulo y **ninguna pantalla lo
   * llamaba**, así que un préstamo nacía «activo» y se quedaba activo para
   * siempre: la cartera de créditos no se podía cerrar ni dar de baja, y los
   * totales de arriba contaban como vivo todo lo que alguna vez se prestó.
   *
   * Castigar se confirma y pagar no: dar por perdido un préstamo es una
   * decisión contable que alguien firma, marcarlo pagado es registrar algo que
   * ya ocurrió.
   */
  async function changeLoanStatus(id: string, status: 'activo' | 'pagado' | 'castigado', who: string) {
    if (status === 'castigado' && !(await confirm({
      title: `¿Castigar el préstamo de ${who}?`,
      description: 'Queda registrado como pérdida. Puedes devolverlo a activo si te equivocas.',
      tone: 'danger',
    }))) return
    startTransition(async () => {
      const result = await setLoanStatus(id, status)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast(`Préstamo marcado ${status}`, 'ok')
    })
  }

  return (
    <>
      <div className="g3 g3--few" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat
            icon={<AlertTriangle size={16} />}
            tone="red"
            label="Mora"
            value={state.enMoraCount}
            sub={`${pesos(state.moraCents)} vencido`}
          />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <div className="ctitle">Nuevo préstamo</div>
        </div>

        <div className="cpad">
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
              <DatePicker
                ariaLabel="Fecha inicio"
                value={loanForm.startDate}
                onChange={(v) => setLoanForm((f) => ({ ...f, startDate: v }))}
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
                    <div className="dempty dempty-block">
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
                    {/* El selector es lo que convierte el estado en algo que se
                        puede cambiar. Antes era una etiqueta de solo lectura
                        clavada en «activo» de por vida. */}
                    <div style={{ display: 'inline-block', minWidth: 130, verticalAlign: 'middle' }}>
                      <Select
                        value={l.status}
                        ariaLabel={`Estado del préstamo de ${l.clientName ?? 'sin cliente'}`}
                        disabled={pending}
                        onChange={(v) => changeLoanStatus(l.id, v as 'activo' | 'pagado' | 'castigado', l.clientName ?? 'sin cliente')}
                        options={LOAN_STATUS_OPTS}
                      />
                    </div>
                    <button
                      className="ibtn"
                      style={{ width: 28, height: 28, color: 'var(--redd)', marginLeft: 6, verticalAlign: 'middle' }}
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
                    <div className="dempty dempty-block">
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
