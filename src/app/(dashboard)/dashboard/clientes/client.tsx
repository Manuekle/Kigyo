'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  Building2, UserPlus, Check, Plus, Trash2, MessageSquare, Star, Clock,
} from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import TabBar from '@/components/ui/TabBar'
import Toggle from '@/components/ui/Toggle'
import FormDrawer from '@/components/ui/FormDrawer'
import LoadMore from '@/components/ui/LoadMore'
import { useApp } from '@/lib/context/AppContext'
import { CLIENT_KINDS, CLIENT_STATUSES, INTERACTION_KINDS } from '@/lib/domain'
import { cop } from '@/lib/utils'
import type { ClientRow, ClientesData } from '@/server/queries/clientes'
import {
  addContacto, createCliente, deleteCliente, deleteContacto,
  logInteraccion, setClienteStatus,
} from '@/server/mutations/clientes'
import { fetchMoreClientes } from '@/server/actions/clientes'

const DATE = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

function formatDate(iso: string | null): string {
  return iso ? DATE.format(new Date(iso)) : '—'
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

const EMPTY_CLIENT = {
  name: '', legalName: '', taxId: '', kind: 'Empresa', industry: '', email: '',
  phone: '', address: '', city: '', ownerId: '', creditLimit: '', paymentTermsDays: '0', notes: '',
}
const EMPTY_CONTACT = {
  clientId: '', fullName: '', position: '', email: '', phone: '', isPrimary: false,
}
const EMPTY_INTERACTION = {
  clientId: '', kind: 'Nota', subject: '', detail: '', employeeId: '', followUpOn: '',
}

/**
 * Days since the last recorded contact.
 *
 * Null when there has never been one — which the table shows as "sin contacto"
 * rather than as an enormous number, because "we have never spoken to them" and
 * "we spoke to them 900 days ago" call for different actions.
 */
function daysSince(iso: string | null): number | null {
  if (!iso) return null
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

export default function ClientesPage({ data }: { data: ClientesData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [clientes, setClientes] = useState<ClientRow[]>(data.clientes)
  const [total, setTotal] = useState(data.clientesTotal)
  const [contactos, setContactos] = useState(data.contactos)
  const [interacciones, setInteracciones] = useState(data.interacciones)
  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const [tab, setTab] = useState('clientes')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [clientOpen, setClientOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [interactionOpen, setInteractionOpen] = useState(false)
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT)
  const [contactForm, setContactForm] = useState(EMPTY_CONTACT)
  const [interactionForm, setInteractionForm] = useState(EMPTY_INTERACTION)

  function apply(next: ClientesData) {
    setClientes(next.clientes)
    setTotal(next.clientesTotal)
    setContactos(next.contactos)
    setInteracciones(next.interacciones)
  }

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreClientes(clientes.length)
      if (!result.ok) { setLoadMoreError(result.error); return }
      setClientes((prev) => {
        const seen = new Set(prev.map((r) => r.id))
        return [...prev, ...result.data.rows.filter((r) => !seen.has(r.id))]
      })
      setTotal(result.data.total)
    })
  }

  const ownerName = useMemo(() => {
    const byId = new Map(data.roster.map((r) => [r.employeeId, r.fullName]))
    return (id: string | null) => (id ? byId.get(id) ?? '—' : 'Sin responsable')
  }, [data.roster])

  const stats = useMemo(() => ({
    active: clientes.filter((c) => c.status === 'Activo').length,
    prospects: clientes.filter((c) => c.status === 'Prospecto').length,
    // Active accounts nobody has touched in two months. This is the list a
    // commercial lead is meant to work from.
    stale: clientes.filter((c) => {
      if (c.status !== 'Activo') return false
      const days = daysSince(c.lastInteractionAt)
      return days === null || days > 60
    }).length,
    credit: clientes.reduce((s, c) => s + c.creditLimitCents, 0),
  }), [clientes])

  const visible = clientes.filter((c) => statusFilter === 'Todos' || c.status === statusFilter)
  const clientOptions = clientes.map((c) => ({ value: c.id, label: c.name }))

  function changeStatus(c: ClientRow, status: string) {
    startTransition(async () => {
      const result = await setClienteStatus({ id: c.id, status: status as never })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast(`${c.name}: ${status.toLowerCase()}`, 'ok')
    })
  }

  function remove(c: ClientRow) {
    if (!window.confirm(`¿Eliminar ${c.name}? Se eliminan también sus contactos e interacciones.`)) return
    startTransition(async () => {
      const result = await deleteCliente(c.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Cliente eliminado', 'ok')
    })
  }

  function dropContact(id: string, name: string) {
    if (!window.confirm(`¿Eliminar a ${name}?`)) return
    startTransition(async () => {
      const result = await deleteContacto(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Contacto eliminado', 'ok')
    })
  }

  function submitClient() {
    startTransition(async () => {
      const result = await createCliente({
        name: clientForm.name,
        legalName: clientForm.legalName,
        taxId: clientForm.taxId,
        kind: clientForm.kind as never,
        industry: clientForm.industry,
        email: clientForm.email || null,
        phone: clientForm.phone,
        address: clientForm.address,
        city: clientForm.city,
        ownerId: clientForm.ownerId || null,
        creditLimitCents: toCents(clientForm.creditLimit),
        paymentTermsDays: clientForm.paymentTermsDays || 0,
        notes: clientForm.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setClientForm(EMPTY_CLIENT)
      setClientOpen(false)
      addToast('Cliente creado', 'ok')
    })
  }

  function submitContact() {
    startTransition(async () => {
      const result = await addContacto({
        clientId: contactForm.clientId,
        fullName: contactForm.fullName,
        position: contactForm.position,
        email: contactForm.email || null,
        phone: contactForm.phone,
        isPrimary: contactForm.isPrimary,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setContactForm(EMPTY_CONTACT)
      setContactOpen(false)
      addToast('Contacto agregado', 'ok')
    })
  }

  function submitInteraction() {
    startTransition(async () => {
      const result = await logInteraccion({
        clientId: interactionForm.clientId,
        kind: interactionForm.kind as never,
        subject: interactionForm.subject,
        detail: interactionForm.detail,
        employeeId: interactionForm.employeeId || null,
        followUpOn: orNull(interactionForm.followUpOn),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setInteractionForm(EMPTY_INTERACTION)
      setInteractionOpen(false)
      addToast('Interacción registrada', 'ok')
    })
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat icon={<Building2 size={16} />} tone="blu" label="Clientes activos"
            value={stats.active} sub={`de ${clientes.length} cuentas`} />
        </div>
        <div className="rise d2">
          <Stat icon={<Star size={16} />} tone="amb" label="Prospectos" value={stats.prospects} />
        </div>
        <div className="rise d3">
          <Stat icon={<Clock size={16} />} tone="red" label="Sin contacto reciente"
            value={stats.stale} sub="activos, más de 60 días" />
        </div>
        <div className="rise d4">
          <Stat icon={<Check size={16} />} tone="grn" label="Cupo de crédito"
            value={pesos(stats.credit)} sub="suma de todas las cuentas" />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <TabBar
            items={[
              { key: 'clientes', label: 'Cuentas' },
              { key: 'interacciones', label: 'Interacciones' },
            ]}
            value={tab}
            onChange={setTab}
          />
          {data.canWrite && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" disabled={pending || clientes.length === 0}
                onClick={() => {
                  setInteractionForm({ ...EMPTY_INTERACTION, clientId: clientes[0]?.id ?? '' })
                  setInteractionOpen(true)
                }}>
                <MessageSquare size={15} />Interacción
              </button>
              <button className="btn" disabled={pending || clientes.length === 0}
                onClick={() => {
                  setContactForm({ ...EMPTY_CONTACT, clientId: clientes[0]?.id ?? '' })
                  setContactOpen(true)
                }}>
                <UserPlus size={15} />Contacto
              </button>
              <button className="btn dark" disabled={pending} onClick={() => setClientOpen(true)}>
                <Plus size={15} />Cliente
              </button>
            </div>
          )}
        </div>

        {tab === 'clientes' && (
          <>
            <div className="cpad" style={{ paddingBottom: 0 }}>
              <div style={{ maxWidth: 220 }}>
                <Select value={statusFilter} onChange={setStatusFilter}
                  options={['Todos', ...CLIENT_STATUSES]} />
              </div>
            </div>

            <div className="tblwrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Cliente</th>
                    <th scope="col">Responsable</th>
                    <th scope="col">Contactos</th>
                    <th scope="col">Último contacto</th>
                    <th scope="col">Crédito</th>
                    <th scope="col">Estado</th>
                    {data.canWrite && <th scope="col" aria-label="Acciones" />}
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <tr>
                      <td colSpan={data.canWrite ? 7 : 6}>
                        <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                          {clientes.length === 0
                            ? 'Todavía no hay clientes registrados.'
                            : 'No hay clientes con ese estado.'}
                        </div>
                      </td>
                    </tr>
                  ) : visible.map((c) => {
                    const days = daysSince(c.lastInteractionAt)
                    const rows = contactos.filter((k) => k.clientId === c.id)
                    return [
                      <tr key={c.id} className="trow"
                        onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                        <td>
                          <div className="cename">{c.name}</div>
                          <div className="elsub mono">
                            {c.code}{c.taxId && ` · ${c.taxId}`}{c.city && ` · ${c.city}`}
                          </div>
                        </td>
                        <td>{ownerName(c.ownerId)}</td>
                        <td>{c.contacts}</td>
                        <td>
                          {days === null
                            ? <span style={{ color: 'var(--red)' }}>Sin contacto</span>
                            : days === 0 ? 'Hoy' : `Hace ${days} días`}
                        </td>
                        <td>
                          {c.creditLimitCents > 0 ? pesos(c.creditLimitCents) : '—'}
                          {c.paymentTermsDays > 0 && (
                            <div className="elsub">{c.paymentTermsDays} días</div>
                          )}
                        </td>
                        <td>
                          <Badge st={c.status}
                            tone={c.status === 'Activo' ? 'grn'
                              : c.status === 'Prospecto' ? 'amb'
                              : c.status === 'Perdido' ? 'red' : 'neu'} />
                        </td>
                        {data.canWrite && (
                          <td onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <Select
                                value={c.status}
                                onChange={(next) => { if (next !== c.status) changeStatus(c, next) }}
                                options={[...CLIENT_STATUSES]}
                              />
                              <button className="ibtn" aria-label={`Eliminar ${c.name}`}
                                disabled={pending} onClick={() => remove(c)}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>,
                      expanded === c.id ? (
                        <tr key={`${c.id}-contacts`}>
                          <td colSpan={data.canWrite ? 7 : 6} style={{ background: 'var(--bg2)' }}>
                            {rows.length === 0 ? (
                              <div className="dempty" style={{ padding: '12px 0' }}>
                                Esta cuenta no tiene contactos registrados.
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
                                {rows.map((k) => (
                                  <div className="elrow" key={k.id}>
                                    <div className="eltxt">
                                      <div className="cename">
                                        {k.fullName}
                                        {k.isPrimary && <Badge st="Principal" tone="blu" className="badge-inline" />}
                                      </div>
                                      <div className="elsub">
                                        {[k.position, k.email, k.phone].filter(Boolean).join(' · ') || '—'}
                                      </div>
                                    </div>
                                    {data.canWrite && (
                                      <button className="ibtn" aria-label={`Eliminar a ${k.fullName}`}
                                        disabled={pending} onClick={() => dropContact(k.id, k.fullName)}>
                                        <Trash2 size={14} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ) : null,
                    ]
                  })}
                </tbody>
              </table>
            </div>

            <LoadMore
              loaded={clientes.length}
              total={total}
              loading={loadingMore}
              error={loadMoreError}
              onLoadMore={loadMore}
              noun="clientes"
            />
          </>
        )}

        {tab === 'interacciones' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Cliente</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Asunto</th>
                  <th scope="col">Quién</th>
                  <th scope="col">Cuándo</th>
                  <th scope="col">Seguimiento</th>
                </tr>
              </thead>
              <tbody>
                {interacciones.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        No hay interacciones registradas.
                      </div>
                    </td>
                  </tr>
                ) : interacciones.map((i) => (
                  <tr key={i.id}>
                    <td><div className="cename">{i.clientName}</div></td>
                    <td>{i.kind}</td>
                    <td>
                      {i.subject || '—'}
                      {i.detail && <div className="elsub">{i.detail}</div>}
                    </td>
                    <td>{ownerName(i.employeeId)}</td>
                    <td>{formatDate(i.happenedAt)}</td>
                    <td>{i.followUpOn ? formatDate(`${i.followUpOn}T00:00:00`) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FormDrawer
        open={clientOpen}
        onClose={() => setClientOpen(false)}
        title="Nuevo cliente"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitClient}>
            <Check size={15} />Crear cliente
          </button>
        }
      >
        <label className="flabel" htmlFor="cl-name">Nombre comercial</label>
        <input id="cl-name" className="field" value={clientForm.name}
          onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="cl-legal">Razón social</label>
            <input id="cl-legal" className="field" value={clientForm.legalName}
              onChange={(e) => setClientForm({ ...clientForm, legalName: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="cl-tax">NIT / documento</label>
            <input id="cl-tax" className="field" value={clientForm.taxId}
              onChange={(e) => setClientForm({ ...clientForm, taxId: e.target.value })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <div className="flabel">Tipo</div>
            <Select value={clientForm.kind}
              onChange={(v) => setClientForm({ ...clientForm, kind: v })}
              options={[...CLIENT_KINDS]} />
          </div>
          <div>
            <label className="flabel" htmlFor="cl-ind">Sector</label>
            <input id="cl-ind" className="field" value={clientForm.industry}
              onChange={(e) => setClientForm({ ...clientForm, industry: e.target.value })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="cl-mail">Correo</label>
            <input id="cl-mail" className="field" type="email" value={clientForm.email}
              onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="cl-phone">Teléfono</label>
            <input id="cl-phone" className="field" value={clientForm.phone}
              onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="cl-addr">Dirección</label>
            <input id="cl-addr" className="field" value={clientForm.address}
              onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="cl-city">Ciudad</label>
            <input id="cl-city" className="field" value={clientForm.city}
              onChange={(e) => setClientForm({ ...clientForm, city: e.target.value })} />
          </div>
        </div>

        <div className="flabel">Responsable comercial</div>
        <Select value={clientForm.ownerId}
          onChange={(v) => setClientForm({ ...clientForm, ownerId: v })}
          placeholder="Sin responsable"
          options={data.roster.map((r) => ({ value: r.employeeId, label: r.fullName }))} />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="cl-credit">Cupo de crédito (COP)</label>
            <input id="cl-credit" className="field" inputMode="numeric" value={clientForm.creditLimit}
              onChange={(e) => setClientForm({ ...clientForm, creditLimit: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="cl-terms">Plazo de pago (días)</label>
            <input id="cl-terms" className="field" type="number" min={0} max={365}
              value={clientForm.paymentTermsDays}
              onChange={(e) => setClientForm({ ...clientForm, paymentTermsDays: e.target.value })} />
          </div>
        </div>

        <label className="flabel" htmlFor="cl-notes">Notas</label>
        <textarea id="cl-notes" className="field" rows={3} value={clientForm.notes}
          onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        title="Nuevo contacto"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitContact}>
            <Check size={15} />Agregar contacto
          </button>
        }
      >
        <div className="flabel">Cliente</div>
        <Select value={contactForm.clientId}
          onChange={(v) => setContactForm({ ...contactForm, clientId: v })}
          placeholder="Elige el cliente" options={clientOptions} />

        <label className="flabel" htmlFor="ct-name">Nombre</label>
        <input id="ct-name" className="field" value={contactForm.fullName}
          onChange={(e) => setContactForm({ ...contactForm, fullName: e.target.value })} />

        <label className="flabel" htmlFor="ct-pos">Cargo</label>
        <input id="ct-pos" className="field" value={contactForm.position}
          onChange={(e) => setContactForm({ ...contactForm, position: e.target.value })} />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="ct-mail">Correo</label>
            <input id="ct-mail" className="field" type="email" value={contactForm.email}
              onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="ct-phone">Teléfono</label>
            <input id="ct-phone" className="field" value={contactForm.phone}
              onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} />
          </div>
        </div>

        <div className="acc" style={{ marginTop: 14 }}>
          <div style={{ flex: 1 }}>
            <div className="act">Contacto principal</div>
            <div className="acs">Reemplaza al que esté marcado hoy: solo puede haber uno.</div>
          </div>
          <Toggle
            on={contactForm.isPrimary}
            ariaLabel="Contacto principal"
            onChange={(next) => setContactForm({ ...contactForm, isPrimary: next })}
          />
        </div>
      </FormDrawer>

      <FormDrawer
        open={interactionOpen}
        onClose={() => setInteractionOpen(false)}
        title="Registrar interacción"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitInteraction}>
            <Check size={15} />Registrar
          </button>
        }
      >
        <div className="flabel">Cliente</div>
        <Select value={interactionForm.clientId}
          onChange={(v) => setInteractionForm({ ...interactionForm, clientId: v })}
          placeholder="Elige el cliente" options={clientOptions} />

        <div className="flabel">Tipo</div>
        <Select value={interactionForm.kind}
          onChange={(v) => setInteractionForm({ ...interactionForm, kind: v })}
          options={[...INTERACTION_KINDS]} />

        <label className="flabel" htmlFor="in-subj">Asunto</label>
        <input id="in-subj" className="field" value={interactionForm.subject}
          onChange={(e) => setInteractionForm({ ...interactionForm, subject: e.target.value })}
          placeholder="Seguimiento a la propuesta" />

        <div className="flabel">Quién</div>
        <Select value={interactionForm.employeeId}
          onChange={(v) => setInteractionForm({ ...interactionForm, employeeId: v })}
          placeholder="Sin asignar"
          options={data.roster.map((r) => ({ value: r.employeeId, label: r.fullName }))} />

        <label className="flabel" htmlFor="in-follow">Volver a contactar el</label>
        <input id="in-follow" className="field" type="date" value={interactionForm.followUpOn}
          onChange={(e) => setInteractionForm({ ...interactionForm, followUpOn: e.target.value })} />

        <label className="flabel" htmlFor="in-detail">Detalle</label>
        <textarea id="in-detail" className="field" rows={4} value={interactionForm.detail}
          onChange={(e) => setInteractionForm({ ...interactionForm, detail: e.target.value })} />
      </FormDrawer>
    </>
  )
}
