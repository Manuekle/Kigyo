'use client'

import { useState, useTransition } from 'react'
import { Handshake, Plus, Trash2 } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import { useApp } from '@/lib/context/AppContext'
import { cop } from '@/lib/utils'
import type { StatusTone } from '@/lib/types'
import type { DonantesData } from '@/server/queries/donantes'
import {
  addDonation,
  addDonor,
  deleteDonation,
  deleteDonor,
  setDonorStatus,
} from '@/server/mutations/donantes'

const DAY = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
const fmtDate = (iso: string | null) => (iso ? DAY.format(new Date(`${iso}T00:00:00`)) : '—')
const todayIso = () => new Date().toISOString().slice(0, 10)

const DONOR_TONE: Record<string, StatusTone> = {
  activo: 'grn',
  inactivo: 'neu',
}
const donorTone = (st: string): StatusTone => DONOR_TONE[st] ?? 'neu'

const KIND_TONE: Record<string, StatusTone> = {
  persona: 'blu',
  empresa: 'vio',
  monetaria: 'grn',
  especie: 'blu',
  tiempo: 'amb',
}
const kindTone = (k: string): StatusTone => KIND_TONE[k] ?? 'neu'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function pesos(cents: number): string {
  return cop(Math.round(cents / 100))
}

const EMPTY_DONOR = { name: '', email: '', phone: '', kind: 'persona', notes: '' }
const EMPTY_DONATION = {
  donorId: '', kind: 'monetaria', amount: '', description: '',
  donatedOn: todayIso(), campaign: '', notes: '',
}

export default function DonantesPage({ data }: { data: DonantesData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState(data)
  const [donorForm, setDonorForm] = useState(EMPTY_DONOR)
  const [donationForm, setDonationForm] = useState(EMPTY_DONATION)

  const donorOpts = [
    { value: '', label: 'Sin donante' },
    ...state.donors.map((d) => ({ value: d.id, label: d.name })),
  ]

  function submitDonor() {
    startTransition(async () => {
      const result = await addDonor({
        name: donorForm.name,
        email: donorForm.email,
        phone: donorForm.phone,
        kind: donorForm.kind as 'persona' | 'empresa',
        notes: donorForm.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Donante añadido', 'ok')
      setDonorForm(EMPTY_DONOR)
    })
  }

  function toggleStatus(id: string, current: string) {
    startTransition(async () => {
      const result = await setDonorStatus(id, current === 'activo' ? 'inactivo' : 'activo')
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Estado actualizado', 'ok')
    })
  }

  function removeDonor(id: string, name: string) {
    if (!window.confirm(`¿Eliminar a ${name}? Sus donaciones se conservan.`)) return
    startTransition(async () => {
      const result = await deleteDonor(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Donante eliminado', 'ok')
    })
  }

  function submitDonation() {
    startTransition(async () => {
      const result = await addDonation({
        donorId: donationForm.donorId || null,
        kind: donationForm.kind as 'monetaria' | 'especie' | 'tiempo',
        amountCents:
          donationForm.kind === 'monetaria' ? Math.round(Number(donationForm.amount) * 100) : null,
        description: donationForm.description,
        donatedOn: donationForm.donatedOn,
        campaign: donationForm.campaign,
        notes: donationForm.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Donación registrada', 'ok')
      setDonationForm({ ...EMPTY_DONATION, donatedOn: todayIso() })
    })
  }

  function removeDonation(id: string) {
    if (!window.confirm('¿Eliminar esta donación?')) return
    startTransition(async () => {
      const result = await deleteDonation(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Donación eliminada', 'ok')
    })
  }

  return (
    <>
      <div className="g3 g3--few" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat
            icon={<Handshake size={16} />}
            tone="grn"
            label="Recaudado"
            value={pesos(state.totalCents)}
            sub={`${pesos(state.thisYearCents)} este año`}
          />
        </div>
      </div>

      <div className="card rise d1">
        <div className="chead">
          <div className="ctitle">Nuevo donante</div>
        </div>

        <div className="cpad" style={{ paddingBottom: 0 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 180px', minWidth: 150 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Nombre</div>
              <input
                className="field"
                value={donorForm.name}
                maxLength={120}
                placeholder="Fundación Esperanza"
                onChange={(e) => setDonorForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div style={{ flex: '1 1 180px', minWidth: 150 }}>
              <div className="flabel">Email</div>
              <input
                type="email"
                className="field"
                value={donorForm.email}
                maxLength={254}
                placeholder="contacto@ejemplo.org"
                onChange={(e) => setDonorForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div style={{ flex: '1 1 150px', minWidth: 130 }}>
              <div className="flabel">Teléfono</div>
              <input
                className="field"
                value={donorForm.phone}
                maxLength={30}
                placeholder="300 123 4567"
                onChange={(e) => setDonorForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div style={{ flex: '0 1 140px', minWidth: 110 }}>
              <div className="flabel">Tipo</div>
              <Select
                value={donorForm.kind}
                onChange={(v) => setDonorForm((f) => ({ ...f, kind: v }))}
                options={[
                  { value: 'persona', label: 'Persona' },
                  { value: 'empresa', label: 'Empresa' },
                ]}
              />
            </div>
            <div style={{ flex: '1 1 200px', minWidth: 160 }}>
              <div className="flabel">Nota</div>
              <input
                className="field"
                value={donorForm.notes}
                maxLength={500}
                placeholder="Ej: apoya la causa desde 2023"
                onChange={(e) => setDonorForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <button
              className="btn dark"
              disabled={pending || donorForm.name.trim().length < 2}
              aria-busy={pending}
              onClick={submitDonor}
            >
              <Plus size={14} />Añadir donante
            </button>
          </div>
        </div>
      </div>

      <div className="card rise d2" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Donantes</div>
        </div>

        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Nombre</th>
                <th scope="col">Contacto</th>
                <th scope="col">Tipo</th>
                <th scope="col">Estado</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {state.donors.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      Sin donantes.
                    </div>
                  </td>
                </tr>
              ) : state.donors.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div className="cename">{d.name}</div>
                    {d.notes && (
                      <div className="muted" style={{ fontSize: 12 }}>{d.notes}</div>
                    )}
                  </td>
                  <td>
                    {d.email || d.phone ? (
                      <>
                        {d.email && <div className="muted mono" style={{ fontSize: 12 }}>{d.email}</div>}
                        {d.phone && <div className="muted mono" style={{ fontSize: 12 }}>{d.phone}</div>}
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td><Badge st={cap(d.kind)} tone={kindTone(d.kind)} /></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Badge st={cap(d.status)} tone={donorTone(d.status)} />
                      <button
                        className="btn ghost"
                        style={{ padding: '2px 8px', fontSize: 12 }}
                        disabled={pending}
                        onClick={() => toggleStatus(d.id, d.status)}
                        aria-label={`${d.status === 'activo' ? 'Desactivar' : 'Activar'} a ${d.name}`}
                      >
                        {d.status === 'activo' ? 'Inactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      className="ibtn"
                      style={{ width: 28, height: 28, color: 'var(--redd)' }}
                      data-tip="Eliminar"
                      disabled={pending}
                      onClick={() => removeDonor(d.id, d.name)}
                      aria-label={`Eliminar a ${d.name}`}
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

      <div className="card rise d3" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Registrar donación</div>
        </div>

        <div className="cpad" style={{ paddingBottom: 0 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 180px', minWidth: 150 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Donante</div>
              <Select
                value={donationForm.donorId}
                onChange={(v) => setDonationForm((f) => ({ ...f, donorId: v }))}
                options={donorOpts}
              />
            </div>
            <div style={{ flex: '0 1 140px', minWidth: 110 }}>
              <div className="flabel">Tipo</div>
              <Select
                value={donationForm.kind}
                onChange={(v) => setDonationForm((f) => ({ ...f, kind: v }))}
                options={[
                  { value: 'monetaria', label: 'Monetaria' },
                  { value: 'especie', label: 'Especie' },
                  { value: 'tiempo', label: 'Tiempo' },
                ]}
              />
            </div>
            {donationForm.kind === 'monetaria' && (
              <div style={{ flex: '0 1 130px', minWidth: 100 }}>
                <div className="flabel">Monto</div>
                <input
                  type="number"
                  className="field"
                  min={0}
                  value={donationForm.amount}
                  placeholder="500000"
                  onChange={(e) => setDonationForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
            )}
            <div style={{ flex: '1 1 180px', minWidth: 150 }}>
              <div className="flabel">Descripción</div>
              <input
                className="field"
                value={donationForm.description}
                maxLength={300}
                placeholder="Ej: mercado para 20 familias"
                onChange={(e) => setDonationForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div style={{ flex: '0 1 140px', minWidth: 110 }}>
              <div className="flabel">Fecha</div>
              <input
                type="date"
                className="field"
                value={donationForm.donatedOn}
                onChange={(e) => setDonationForm((f) => ({ ...f, donatedOn: e.target.value }))}
              />
            </div>
            <div style={{ flex: '1 1 160px', minWidth: 130 }}>
              <div className="flabel">Campaña</div>
              <input
                className="field"
                value={donationForm.campaign}
                maxLength={120}
                placeholder="Ej: colecta de fin de año"
                onChange={(e) => setDonationForm((f) => ({ ...f, campaign: e.target.value }))}
              />
            </div>
            <div style={{ flex: '1 1 180px', minWidth: 150 }}>
              <div className="flabel">Nota</div>
              <input
                className="field"
                value={donationForm.notes}
                maxLength={500}
                placeholder="Ej: entrega en la sede"
                onChange={(e) => setDonationForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <button
              className="btn dark"
              disabled={
                pending || !donationForm.donatedOn
                || (donationForm.kind === 'monetaria' && (
                  donationForm.amount === '' || Number(donationForm.amount) < 0
                ))
              }
              aria-busy={pending}
              onClick={submitDonation}
            >
              <Plus size={14} />Registrar
            </button>
          </div>
        </div>
      </div>

      <div className="card rise d4" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Donaciones</div>
        </div>

        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Donante</th>
                <th scope="col">Tipo</th>
                <th scope="col">Monto</th>
                <th scope="col">Descripción</th>
                <th scope="col">Fecha</th>
                <th scope="col">Campaña</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {state.donations.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      Sin donaciones registradas.
                    </div>
                  </td>
                </tr>
              ) : state.donations.map((n) => (
                <tr key={n.id}>
                  <td>
                    {n.donorName ? (
                      <div className="cename">{n.donorName}</div>
                    ) : (
                      <span className="muted">Sin donante</span>
                    )}
                  </td>
                  <td><Badge st={cap(n.kind)} tone={kindTone(n.kind)} /></td>
                  <td className="mono">
                    {n.kind === 'monetaria' ? pesos(n.amountCents ?? 0) : '—'}
                  </td>
                  <td className="muted">
                    {n.description ?? '—'}
                  </td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{fmtDate(n.donatedOn)}</td>
                  <td className="muted">{n.campaign || '—'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      className="ibtn"
                      style={{ width: 28, height: 28, color: 'var(--redd)' }}
                      data-tip="Eliminar"
                      disabled={pending}
                      onClick={() => removeDonation(n.id)}
                      aria-label={`Eliminar la donación de ${n.donorName ?? 'sin donante'}`}
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
