'use client'

import { useState, useTransition } from 'react'
import { CalendarClock, Check, History, Plus, Trash2, Wallet } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import DatePicker from '@/components/ui/DatePicker'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import { useApp } from '@/lib/context/AppContext'
import { useConfirm } from '@/lib/context/ConfirmContext'
import { cop } from '@/lib/utils'
import type { StatusTone } from '@/lib/types'
import type { CarteraData } from '@/server/queries/cartera'
import { addDeuda, deleteDeuda, setDeudaStatus } from '@/server/mutations/cartera'

const DAY = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtDate = (iso: string | null) => (iso ? DAY.format(new Date(`${iso}T00:00:00`)) : '—')
const todayIso = () => new Date().toISOString().slice(0, 10)

const DEUDA_TONE: Record<string, StatusTone> = {
  pagada: 'grn',
  vencida: 'red',
  mora: 'red',
  pendiente: 'neu',
}
const deudaTone = (st: string): StatusTone => DEUDA_TONE[st] ?? 'neu'
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function pesos(cents: number): string {
  return cop(Math.round(cents / 100))
}

const EMPTY_DEUDA = {
  clientId: '', invoiceId: '', amount: '', dueDate: todayIso(), notes: '',
}

export default function CarteraPage({ data }: { data: CarteraData }) {
  const { addToast } = useApp()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState(data)
  const [deudaForm, setDeudaForm] = useState(EMPTY_DEUDA)

  const clientOpts = [
    { value: '', label: 'Sin cliente' },
    ...state.clients.map((c) => ({ value: c.id, label: c.name })),
  ]
  // El saldo va en la etiqueta: elegir «FAC-0007» sin saber cuánto queda
  // debiendo obliga a irse a Facturación y volver, que es exactamente el viaje
  // en el que alguien teclea otra cifra.
  const invoiceOpts = [
    { value: '', label: 'Sin factura' },
    ...state.invoices.map((i) => ({
      value: i.id,
      label: `${i.code} · ${i.clientName} · ${pesos(i.balanceCents)} por cobrar`,
    })),
  ]

  /**
   * Elegir la factura rellena la deuda desde la factura.
   *
   * Cartera y Facturación llevaban dos contabilidades separadas de lo mismo:
   * `receivable_agreements` se escribía a mano y el envejecimiento de cartera de
   * Facturación se derivaba de `invoices`, y nada las ataba. El selector de
   * factura existía y no hacía nada más que guardar el `invoice_id`, así que el
   * monto, el cliente y el vencimiento se volvían a teclear — y bastaba un dedo
   * torcido para que las dos pantallas dijeran cosas distintas del mismo dinero.
   *
   * Solo prellena; nada queda bloqueado. Un acuerdo de pago por una parte de la
   * factura es normal, y el usuario puede bajar el monto o mover la fecha.
   */
  function pickInvoice(invoiceId: string) {
    const invoice = state.invoices.find((i) => i.id === invoiceId)
    setDeudaForm((f) => ({
      ...f,
      invoiceId,
      ...(invoice
        ? {
          clientId: invoice.clientId ?? f.clientId,
          amount: String(invoice.balanceCents / 100),
          dueDate: invoice.dueOn ?? f.dueDate,
        }
        : {}),
    }))
  }

  function submitDeuda() {
    startTransition(async () => {
      const result = await addDeuda({
        clientId: deudaForm.clientId || null,
        invoiceId: deudaForm.invoiceId || null,
        amountCents: Math.round(Number(deudaForm.amount) * 100),
        dueDate: deudaForm.dueDate,
        notes: deudaForm.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Cuenta por cobrar creada', 'ok')
      setDeudaForm({ ...EMPTY_DEUDA, dueDate: todayIso() })
    })
  }

  function changeStatus(id: string, status: string) {
    startTransition(async () => {
      const result = await setDeudaStatus(id, status)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Estado actualizado', 'ok')
    })
  }

  async function removeDeuda(id: string) {
    if (!(await confirm({ title: '¿Eliminar esta cuenta por cobrar?', tone: 'danger' }))) return
    startTransition(async () => {
      const result = await deleteDeuda(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Cuenta por cobrar eliminada', 'ok')
    })
  }

  return (
    <>
      <div className="g3 g3--few" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat
            icon={<Wallet size={16} />}
            tone="amb"
            label="Cuentas por cobrar"
            value={pesos(state.pendienteCents)}
            sub={`${pesos(state.vencidaCents)} vencida`}
          />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <div className="ctitle">Nueva cuenta por cobrar</div>
        </div>

        <div className="cpad">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 160px', minWidth: 130 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Cliente</div>
              <Select
                value={deudaForm.clientId}
                onChange={(v) => setDeudaForm((f) => ({ ...f, clientId: v }))}
                options={clientOpts}
              />
            </div>
            <div style={{ flex: '1 1 160px', minWidth: 130 }}>
              <div className="flabel">Factura</div>
              <Select
                value={deudaForm.invoiceId}
                onChange={pickInvoice}
                options={invoiceOpts}
              />
            </div>
            <div style={{ flex: '0 1 110px', minWidth: 90 }}>
              <div className="flabel">Monto</div>
              <input
                type="number"
                className="field"
                min={1}
                value={deudaForm.amount}
                placeholder="50000"
                onChange={(e) => setDeudaForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div style={{ flex: '0 1 140px', minWidth: 110 }}>
              <div className="flabel">Vencimiento</div>
              <DatePicker
                ariaLabel="Vencimiento"
                value={deudaForm.dueDate}
                onChange={(v) => setDeudaForm((f) => ({ ...f, dueDate: v }))}
              />
            </div>
            <div style={{ flex: '1 1 180px', minWidth: 150 }}>
              <div className="flabel">Nota</div>
              <input
                className="field"
                value={deudaForm.notes}
                maxLength={500}
                placeholder="Ej: acuerdo verbal"
                onChange={(e) => setDeudaForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <button
              className="btn dark"
              disabled={pending || !deudaForm.amount || Number(deudaForm.amount) <= 0 || !deudaForm.dueDate}
              aria-busy={pending}
              onClick={submitDeuda}
            >
              <Plus size={14} />Añadir
            </button>
          </div>
        </div>
      </div>

      <div className="card rise d3" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Cuentas por cobrar</div>
        </div>

        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Cliente</th>
                <th scope="col">Factura</th>
                <th scope="col">Monto</th>
                <th scope="col">Vence</th>
                <th scope="col">Estado</th>
                <th scope="col">Nota</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {state.debts.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      No hay cuentas por cobrar.
                    </div>
                  </td>
                </tr>
              ) : state.debts.map((d) => (
                <tr key={d.id}>
                  <td>
                    {d.clientName ? (
                      <div className="cename">{d.clientName}</div>
                    ) : (
                      <span className="muted">Sin cliente</span>
                    )}
                  </td>
                  <td className="muted">{d.invoiceCode ?? 'Sin factura'}</td>
                  <td className="mono">{pesos(d.amountCents)}</td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{fmtDate(d.dueDate)}</td>
                  <td><Badge st={cap(d.status)} tone={deudaTone(d.status)} /></td>
                  <td className="muted">{d.notes ?? '—'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {d.status !== 'pagada' && (
                      <button
                        className="ibtn"
                        style={{ width: 28, height: 28, color: 'var(--grnd)' }}
                        data-tip="Pagar"
                        disabled={pending}
                        onClick={() => changeStatus(d.id, 'pagada')}
                        aria-label={`Pagar la cuenta de ${d.clientName ?? 'sin cliente'}`}
                      >
                        <Check size={13} />
                      </button>
                    )}
                    {d.status === 'pendiente' && (
                      <button
                        className="ibtn"
                        style={{ width: 28, height: 28, color: 'var(--amb)' }}
                        data-tip="Vencer"
                        disabled={pending}
                        onClick={() => changeStatus(d.id, 'vencida')}
                        aria-label={`Marcar como vencida la cuenta de ${d.clientName ?? 'sin cliente'}`}
                      >
                        <CalendarClock size={13} />
                      </button>
                    )}
                    {d.status === 'vencida' && (
                      <button
                        className="ibtn"
                        style={{ width: 28, height: 28, color: 'var(--redd)' }}
                        data-tip="Mora"
                        disabled={pending}
                        onClick={() => changeStatus(d.id, 'mora')}
                        aria-label={`Pasar a mora la cuenta de ${d.clientName ?? 'sin cliente'}`}
                      >
                        <History size={13} />
                      </button>
                    )}
                    <button
                      className="ibtn"
                      style={{ width: 28, height: 28, color: 'var(--redd)' }}
                      data-tip="Eliminar"
                      disabled={pending}
                      onClick={() => removeDeuda(d.id)}
                      aria-label={`Eliminar la cuenta de ${d.clientName ?? 'sin cliente'}`}
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
