'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  Handshake, AlertTriangle, Check, Plus, Trash2, DollarSign, Calendar, PenLine, FileSpreadsheet,
} from '@/lib/icons'
import { useExport } from '@/lib/hooks/use-export'
import Badge from '@/components/ui/Badge'
import DatePicker from '@/components/ui/DatePicker'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import Toggle from '@/components/ui/Toggle'
import FormDrawer from '@/components/ui/FormDrawer'
import LoadMore from '@/components/ui/LoadMore'
import { useApp } from '@/lib/context/AppContext'
import { CONTRACT_KINDS, CONTRACT_STATUSES } from '@/lib/domain'
import { cop } from '@/lib/utils'
import type { ContractRow, ContratosData } from '@/server/queries/contratos'
import {
  addHito, createContrato, deleteContrato, renovarContrato,
  setContratoStatus, setHitoDone, updateContrato,
} from '@/server/mutations/contratos'
import { fetchMoreContratos } from '@/server/actions/contratos'

const DATE = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

function formatDate(iso: string | null): string {
  return iso ? DATE.format(new Date(`${iso}T00:00:00`)) : 'Sin vencimiento'
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

const EMPTY_CONTRACT = {
  title: '', kind: 'Cliente', counterparty: '', clientId: '', employeeId: '', ownerId: '',
  value: '', startsOn: '', endsOn: '', noticeDays: '30', autoRenew: false, notes: '',
}

const EMPTY_MILESTONE = { contractId: '', title: '', dueOn: '', amount: '', position: '0' }

export default function ContratosPage({ data }: { data: ContratosData }) {
  const { addToast } = useApp()
  const { runExport, exporting } = useExport()
  const [pending, startTransition] = useTransition()

  const [contratos, setContratos] = useState<ContractRow[]>(data.contratos)
  const [total, setTotal] = useState(data.contratosTotal)
  const [hitos, setHitos] = useState(data.hitos)
  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const [statusFilter, setStatusFilter] = useState('Todos')
  const [kindFilter, setKindFilter] = useState('Todos')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [contractOpen, setContractOpen] = useState(false)
  const [milestoneOpen, setMilestoneOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [contractForm, setContractForm] = useState(EMPTY_CONTRACT)
  const [milestoneForm, setMilestoneForm] = useState(EMPTY_MILESTONE)

  function apply(next: ContratosData) {
    setContratos(next.contratos)
    setTotal(next.contratosTotal)
    setHitos(next.hitos)
  }

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreContratos(contratos.length)
      if (!result.ok) { setLoadMoreError(result.error); return }
      setContratos((prev) => {
        const seen = new Set(prev.map((r) => r.id))
        return [...prev, ...result.data.rows.filter((r) => !seen.has(r.id))]
      })
      setTotal(result.data.total)
    })
  }

  const personName = useMemo(() => {
    const byId = new Map(data.roster.map((r) => [r.employeeId, r.fullName]))
    return (id: string | null) => (id ? byId.get(id) ?? '—' : 'Sin responsable')
  }, [data.roster])

  const stats = useMemo(() => {
    const live = contratos.filter((c) => c.status === 'Vigente' || c.status === 'Por vencer')
    return {
      live: live.length,
      expiring: contratos.filter((c) => c.expiringSoon).length,
      expired: contratos.filter((c) => c.daysLeft !== null && c.daysLeft < 0 && c.status !== 'Terminado').length,
      value: live.reduce((s, c) => s + c.valueCents, 0),
    }
  }, [contratos])

  const visible = contratos.filter((c) =>
    (statusFilter === 'Todos' || c.status === statusFilter) &&
    (kindFilter === 'Todos' || c.kind === kindFilter),
  )

  const exportRows = () => {
    void runExport(
      visible.map((c) => ({
        Contrato: c.title ?? '',
        Contraparte: c.clientName ?? c.counterparty ?? '',
        Valor: c.valueCents > 0 ? pesos(c.valueCents) : '',
        Inicia: c.startsOn ?? '',
        Termina: c.endsOn ?? '',
        Estado: c.status ?? '',
      })),
      'contratos-kigyo',
      'contratos',
    )
  }

  function changeStatus(c: ContractRow, status: string) {
    startTransition(async () => {
      const result = await setContratoStatus({ id: c.id, status: status as never })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast(`Contrato ${status.toLowerCase()}`, 'ok')
    })
  }

  function renew(c: ContractRow) {
    const answer = window.prompt(
      `Nueva fecha de terminación para ${c.title} (AAAA-MM-DD):`,
      c.endsOn ?? '',
    )
    if (!answer) return
    startTransition(async () => {
      const result = await renovarContrato({ id: c.id, endsOn: answer.trim() })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Contrato renovado', 'ok')
    })
  }

  function remove(c: ContractRow) {
    if (!window.confirm(`¿Eliminar ${c.title}? Se eliminan también sus hitos.`)) return
    startTransition(async () => {
      const result = await deleteContrato(c.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Contrato eliminado', 'ok')
    })
  }

  function toggleMilestone(id: string, done: boolean) {
    startTransition(async () => {
      const result = await setHitoDone({ id, done })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
    })
  }

  function editContract(c: ContractRow) {
    setContractForm({
      title: c.title,
      kind: c.kind,
      counterparty: c.counterparty,
      clientId: c.clientId ?? '',
      employeeId: c.employeeId ?? '',
      ownerId: c.ownerId ?? '',
      value: c.valueCents > 0 ? pesos(c.valueCents) : '',
      startsOn: c.startsOn ?? '',
      endsOn: c.endsOn ?? '',
      noticeDays: String(c.noticeDays),
      autoRenew: c.autoRenew,
      notes: c.notes,
    })
    setEditingId(c.id)
    setContractOpen(true)
  }

  function submitContract() {
    startTransition(async () => {
      const base = {
        title: contractForm.title,
        kind: contractForm.kind as never,
        counterparty: contractForm.counterparty,
        clientId: contractForm.clientId || null,
        employeeId: contractForm.employeeId || null,
        ownerId: contractForm.ownerId || null,
        valueCents: toCents(contractForm.value),
        startsOn: orNull(contractForm.startsOn),
        endsOn: orNull(contractForm.endsOn),
        noticeDays: contractForm.noticeDays || 30,
        autoRenew: contractForm.autoRenew,
        notes: contractForm.notes,
      }
      const result = editingId
        ? await updateContrato({ ...base, id: editingId })
        : await createContrato(base)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setContractForm(EMPTY_CONTRACT)
      setEditingId(null)
      setContractOpen(false)
      addToast(editingId ? 'Contrato actualizado' : 'Contrato creado', 'ok')
    })
  }

  function submitMilestone() {
    startTransition(async () => {
      const result = await addHito({
        contractId: milestoneForm.contractId,
        title: milestoneForm.title,
        dueOn: orNull(milestoneForm.dueOn),
        amountCents: toCents(milestoneForm.amount),
        position: milestoneForm.position || 0,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setMilestoneForm(EMPTY_MILESTONE)
      setMilestoneOpen(false)
      addToast('Hito agregado', 'ok')
    })
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat icon={<Handshake size={16} />} tone="blu" label="Contratos vigentes"
            value={stats.live} sub={`de ${contratos.length} registrados`} />
        </div>
        <div className="rise d2">
          <Stat icon={<Calendar size={16} />} tone="amb" label="Por vencer"
            value={stats.expiring} sub="dentro del preaviso" />
        </div>
        <div className="rise d3">
          <Stat icon={<AlertTriangle size={16} />} tone="red" label="Vencidos sin cerrar"
            value={stats.expired} />
        </div>
        <div className="rise d4">
          <Stat icon={<DollarSign size={16} />} tone="grn" label="Valor vigente"
            value={pesos(stats.value)} />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <div>
            <div className="ctitle">Contratos</div>
            <div className="elsub" style={{ marginTop: 2 }}>
              Ordenados por vencimiento. Toca una fila para ver sus hitos.
            </div>
          </div>
          <button disabled={exporting} aria-busy={exporting} className="btn" onClick={exportRows}><FileSpreadsheet size={15} />Exportar</button>
          {data.canWrite && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" disabled={pending || contratos.length === 0}
                onClick={() => {
                  setMilestoneForm({ ...EMPTY_MILESTONE, contractId: contratos[0]?.id ?? '' })
                  setMilestoneOpen(true)
                }}>
                <Plus size={15} />Hito
              </button>
              <button className="btn dark" disabled={pending}
                onClick={() => { setEditingId(null); setContractOpen(true) }}>
                <Plus size={15} />Contrato
              </button>
            </div>
          )}
        </div>

        <div className="cpad" style={{ paddingBottom: 0, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 190 }}>
            <Select value={statusFilter} onChange={setStatusFilter}
              options={['Todos', ...CONTRACT_STATUSES]} />
          </div>
          <div style={{ minWidth: 190 }}>
            <Select value={kindFilter} onChange={setKindFilter}
              options={['Todos', ...CONTRACT_KINDS]} />
          </div>
        </div>

        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Contrato</th>
                <th scope="col">Contraparte</th>
                <th scope="col">Responsable</th>
                <th scope="col">Valor</th>
                <th scope="col">Termina</th>
                <th scope="col">Hitos</th>
                <th scope="col">Estado</th>
                {data.canWrite && <th scope="col" aria-label="Acciones" />}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={data.canWrite ? 8 : 7}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      {contratos.length === 0
                        ? 'Todavía no hay contratos registrados.'
                        : 'No hay contratos con esos filtros.'}
                    </div>
                  </td>
                </tr>
              ) : visible.map((c) => {
                const rows = hitos.filter((h) => h.contractId === c.id)
                return [
                  <tr key={c.id} className="trow"
                    onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                    <td>
                      <div className="cename">{c.title}</div>
                      <div className="elsub mono">
                        {c.code} · {c.kind}{c.autoRenew && ' · renovación automática'}
                      </div>
                    </td>
                    <td>{c.clientName || c.counterparty || '—'}</td>
                    <td>{personName(c.ownerId)}</td>
                    <td>{c.valueCents > 0 ? pesos(c.valueCents) : '—'}</td>
                    <td>
                      {formatDate(c.endsOn)}
                      {c.daysLeft !== null && (
                        <div className="elsub"
                          style={{ color: c.daysLeft < 0 ? 'var(--red)' : c.expiringSoon ? 'var(--amb)' : undefined }}>
                          {c.daysLeft < 0
                            ? `vencido hace ${-c.daysLeft} días`
                            : `en ${c.daysLeft} días`}
                        </div>
                      )}
                    </td>
                    <td>{c.milestones === 0 ? '—' : `${c.milestonesDone} / ${c.milestones}`}</td>
                    <td>
                      <Badge
                        st={c.expiringSoon && c.status === 'Vigente' ? 'Por vencer' : c.status}
                        tone={c.status === 'Vigente' && !c.expiringSoon ? 'grn'
                          : c.expiringSoon || c.status === 'Por vencer' ? 'amb'
                          : c.status === 'Vencido' ? 'red' : 'neu'} />
                    </td>
                    {data.canWrite && (
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button className="btn" style={{ height: 28, padding: '0 10px', fontSize: 12 }}
                            disabled={pending} onClick={() => renew(c)}>
                            Renovar
                          </button>
                          <button className="ibtn" aria-label={`Editar ${c.title}`}
                            disabled={pending} onClick={() => editContract(c)}>
                            <PenLine size={14} />
                          </button>
                          <Select
                            value={c.status}
                            onChange={(next) => { if (next !== c.status) changeStatus(c, next) }}
                            options={[...CONTRACT_STATUSES]}
                          />
                          <button className="ibtn" aria-label={`Eliminar ${c.title}`}
                            disabled={pending} onClick={() => remove(c)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>,
                  expanded === c.id ? (
                    <tr key={`${c.id}-milestones`}>
                      <td colSpan={data.canWrite ? 8 : 7} style={{ background: 'var(--bg2)' }}>
                        {rows.length === 0 ? (
                          <div className="dempty" style={{ padding: '12px 0' }}>
                            Este contrato no tiene hitos.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
                            {rows.map((h) => (
                              <div className="elrow" key={h.id}>
                                <div className="eltxt">
                                  <div className="cename">{h.title}</div>
                                  <div className="elsub">
                                    {h.dueOn ? formatDate(h.dueOn) : 'Sin fecha'}
                                    {h.amountCents > 0 && ` · ${pesos(h.amountCents)}`}
                                  </div>
                                </div>
                                {data.canWrite ? (
                                  <Toggle
                                    on={h.completedAt !== null}
                                    ariaLabel={`Hito ${h.title} cumplido`}
                                    disabled={pending}
                                    onChange={(next) => toggleMilestone(h.id, next)}
                                  />
                                ) : (
                                  <Badge st={h.completedAt ? 'Cumplido' : 'Pendiente'}
                                    tone={h.completedAt ? 'grn' : 'amb'} />
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
          loaded={contratos.length}
          total={total}
          loading={loadingMore}
          error={loadMoreError}
          onLoadMore={loadMore}
          noun="contratos"
        />
      </div>

      <FormDrawer
        open={contractOpen}
        onClose={() => { setEditingId(null); setContractOpen(false) }}
        title={editingId ? 'Editar contrato' : 'Nuevo contrato'}
        footer={
          <button className="btn dark" disabled={pending} onClick={submitContract}>
            <Check size={15} />{editingId ? 'Guardar cambios' : 'Crear contrato'}
          </button>
        }
      >
        <label className="flabel" htmlFor="ctr-title">Nombre del contrato</label>
        <input id="ctr-title" className="field" value={contractForm.title}
          onChange={(e) => setContractForm({ ...contractForm, title: e.target.value })}
          placeholder="Suministro e instalación — Torre Sur" />

        <div className="flabel">Tipo</div>
        <Select value={contractForm.kind}
          onChange={(v) => setContractForm({ ...contractForm, kind: v })}
          options={[...CONTRACT_KINDS]} />

        {data.clientes.length > 0 && (
          <>
            <div className="flabel">Cliente</div>
            <Select value={contractForm.clientId}
              onChange={(v) => setContractForm({ ...contractForm, clientId: v })}
              placeholder="Sin cliente asociado"
              options={data.clientes.map((c) => ({ value: c.id, label: c.name }))} />
          </>
        )}

        <label className="flabel" htmlFor="ctr-party">Contraparte (texto)</label>
        <input id="ctr-party" className="field" value={contractForm.counterparty}
          onChange={(e) => setContractForm({ ...contractForm, counterparty: e.target.value })}
          placeholder="Nombre del proveedor, arrendador o empleado" />

        <div className="flabel">Responsable interno</div>
        <Select value={contractForm.ownerId}
          onChange={(v) => setContractForm({ ...contractForm, ownerId: v })}
          placeholder="Sin responsable"
          options={data.roster.map((r) => ({ value: r.employeeId, label: r.fullName }))} />

        <div className="fg2">
          <div>
            <div className="flabel">Inicia</div>
            <DatePicker ariaLabel="Inicia" value={contractForm.startsOn}
              onChange={(v) => setContractForm({ ...contractForm, startsOn: v })} />
          </div>
          <div>
            <div className="flabel">Termina</div>
            <DatePicker ariaLabel="Termina" value={contractForm.endsOn}
              onChange={(v) => setContractForm({ ...contractForm, endsOn: v })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="ctr-value">Valor (COP)</label>
            <input id="ctr-value" className="field" inputMode="numeric" value={contractForm.value}
              onChange={(e) => setContractForm({ ...contractForm, value: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="ctr-notice">Preaviso (días)</label>
            <input id="ctr-notice" className="field" type="number" min={0} max={365}
              value={contractForm.noticeDays}
              onChange={(e) => setContractForm({ ...contractForm, noticeDays: e.target.value })} />
          </div>
        </div>

        <div className="acc" style={{ marginTop: 14 }}>
          <div style={{ flex: 1 }}>
            <div className="act">Renovación automática</div>
            <div className="acs">Se renueva salvo aviso dentro del preaviso.</div>
          </div>
          <Toggle
            on={contractForm.autoRenew}
            ariaLabel="Renovación automática"
            onChange={(next) => setContractForm({ ...contractForm, autoRenew: next })}
          />
        </div>

        <label className="flabel" htmlFor="ctr-notes">Notas</label>
        <textarea id="ctr-notes" className="field" rows={3} value={contractForm.notes}
          onChange={(e) => setContractForm({ ...contractForm, notes: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={milestoneOpen}
        onClose={() => setMilestoneOpen(false)}
        title="Nuevo hito"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitMilestone}>
            <Check size={15} />Agregar hito
          </button>
        }
      >
        <div className="flabel">Contrato</div>
        <Select value={milestoneForm.contractId}
          onChange={(v) => setMilestoneForm({ ...milestoneForm, contractId: v })}
          placeholder="Elige el contrato"
          options={contratos.map((c) => ({ value: c.id, label: c.title }))} />

        <label className="flabel" htmlFor="ms-title">Hito</label>
        <input id="ms-title" className="field" value={milestoneForm.title}
          onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })}
          placeholder="Entrega de diseño aprobado" />

        <div className="fg2">
          <div>
            <div className="flabel">Vence</div>
            <DatePicker ariaLabel="Vence" value={milestoneForm.dueOn}
              onChange={(v) => setMilestoneForm({ ...milestoneForm, dueOn: v })} />
          </div>
          <div>
            <label className="flabel" htmlFor="ms-amount">Monto (COP)</label>
            <input id="ms-amount" className="field" inputMode="numeric" value={milestoneForm.amount}
              onChange={(e) => setMilestoneForm({ ...milestoneForm, amount: e.target.value })} />
          </div>
        </div>

        <label className="flabel" htmlFor="ms-pos">Orden</label>
        <input id="ms-pos" className="field" type="number" min={0} value={milestoneForm.position}
          onChange={(e) => setMilestoneForm({ ...milestoneForm, position: e.target.value })} />
      </FormDrawer>
    </>
  )
}
