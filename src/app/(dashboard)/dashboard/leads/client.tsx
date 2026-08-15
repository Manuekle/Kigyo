'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  Target, Plus, Trash2, PenLine, Check, UserPlus,
} from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import FormDrawer from '@/components/ui/FormDrawer'
import LoadMore from '@/components/ui/LoadMore'
import { useApp } from '@/lib/context/AppContext'
import {
  ACTIVITY_KINDS, LEAD_SOURCES, LEAD_STAGES,
} from '@/lib/leads'
import type { LeadRow, LeadsData } from '@/server/queries/leads'
import {
  addLeadActivity, convertLead, createLead, deleteLead, updateLead,
} from '@/server/mutations/leads'
import { fetchMoreLeads } from '@/server/actions/leads'

const STAGE_TONE: Record<string, 'blu' | 'amb' | 'vio' | 'red' | 'grn'> = {
  Nuevo: 'blu', Contactado: 'amb', Calificado: 'vio', Perdido: 'red', Convertido: 'grn',
}

const DATETIME = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
})

function formatWhen(iso: string): string {
  return DATETIME.format(new Date(iso))
}

type FormState = {
  name: string
  companyName: string
  email: string
  phone: string
  source: string
  stage: string
  ownerId: string
  lostReason: string
  notes: string
}

const EMPTY_FORM: FormState = {
  name: '', companyName: '', email: '', phone: '', source: 'Otro',
  stage: 'Nuevo', ownerId: '', lostReason: '', notes: '',
}

function toForm(lead: LeadRow): FormState {
  return {
    name: lead.name,
    companyName: lead.companyName,
    email: lead.email,
    phone: lead.phone,
    source: lead.source,
    stage: lead.stage,
    ownerId: lead.ownerId ?? '',
    lostReason: lead.lostReason,
    notes: lead.notes,
  }
}

export default function LeadsPage({ data }: { data: LeadsData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState<LeadsData>(data)
  const [stageFilter, setStageFilter] = useState('Todas')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [activityForm, setActivityForm] = useState({ leadId: '', kind: 'Nota', note: '' })

  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const visible = state.leads.filter((l) => stageFilter === 'Todas' || l.stage === stageFilter)

  const stats = useMemo(() => ({
    total: state.leadsTotal,
    activos: state.leads.filter((l) => l.stage !== 'Perdido' && l.stage !== 'Convertido').length,
    convertidos: state.leads.filter((l) => l.stage === 'Convertido').length,
    perdidos: state.leads.filter((l) => l.stage === 'Perdido').length,
  }), [state.leads, state.leadsTotal])

  function apply(next: LeadsData) {
    setState(next)
  }

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreLeads(state.leads.length)
      if (!result.ok) { setLoadMoreError(result.error); return }
      setState((prev) => {
        const seen = new Set(prev.leads.map((l) => l.id))
        return { ...prev, leads: [...prev.leads, ...result.data.rows.filter((r) => !seen.has(r.id))], leadsTotal: result.data.total }
      })
    })
  }

  function payload() {
    return {
      name: form.name.trim(),
      companyName: form.companyName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      source: form.source as (typeof LEAD_SOURCES)[number],
      stage: form.stage as (typeof LEAD_STAGES)[number],
      ownerId: form.ownerId || null,
      lostReason: form.lostReason.trim(),
      notes: form.notes.trim(),
    }
  }

  function submit() {
    if (!form.name.trim()) { addToast('El nombre es obligatorio', 'err'); return }
    startTransition(async () => {
      const result = editingId
        ? await updateLead({ id: editingId, ...payload() })
        : await createLead(payload())
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setFormOpen(false)
      setEditingId(null)
      setForm(EMPTY_FORM)
      addToast(editingId ? 'Lead actualizado' : 'Lead registrado', 'ok')
    })
  }

  function convert(lead: LeadRow) {
    if (!window.confirm(`¿Convertir «${lead.name}» en cliente? Se creará en el directorio de Clientes.`)) return
    startTransition(async () => {
      const result = await convertLead(lead.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast(`«${lead.name}» ahora es cliente`, 'ok')
    })
  }

  function remove(lead: LeadRow) {
    if (!window.confirm(`¿Eliminar el lead «${lead.name}»? Su historial se pierde.`)) return
    startTransition(async () => {
      const result = await deleteLead(lead.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Lead eliminado', 'info')
    })
  }

  function submitActivity() {
    if (!activityForm.note.trim()) { addToast('Escribe qué pasó', 'err'); return }
    startTransition(async () => {
      const result = await addLeadActivity({
        leadId: activityForm.leadId,
        kind: activityForm.kind as (typeof ACTIVITY_KINDS)[number],
        note: activityForm.note.trim(),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setActivityForm({ leadId: '', kind: 'Nota', note: '' })
      addToast('Actividad registrada', 'ok')
    })
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat icon={<Target size={16} />} tone="blu" label="Leads"
            value={stats.total} sub={`${stats.activos} en el embudo`} />
        </div>
        <div className="rise d2">
          <Stat icon={<UserPlus size={16} />} tone="grn" label="Convertidos"
            value={stats.convertidos} />
        </div>
        <div className="rise d3">
          <Stat icon={<Target size={16} />} tone="red" label="Perdidos"
            value={stats.perdidos} />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <div>
            <div className="ctitle">Leads</div>
            <div className="elsub" style={{ marginTop: 2 }}>
              Toca una fila para ver su historial y registrar actividad.
            </div>
          </div>
          {data.canWrite && (
            <button className="btn dark" disabled={pending}
              onClick={() => {
                setEditingId(null)
                setForm(EMPTY_FORM)
                setFormOpen(true)
              }}>
              <Plus size={15} />Lead
            </button>
          )}
        </div>

        <div className="cpad" style={{ paddingBottom: 0 }}>
          <div style={{ maxWidth: 220 }}>
            <Select value={stageFilter} onChange={setStageFilter}
              options={['Todas', ...LEAD_STAGES]} />
          </div>
        </div>

        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Lead</th>
                <th scope="col">Origen</th>
                <th scope="col">Dueño</th>
                <th scope="col">Etapa</th>
                {data.canWrite && <th scope="col" aria-label="Acciones" />}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={data.canWrite ? 5 : 4}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      {state.leads.length === 0
                        ? 'Todavía no hay leads. Registra el primero que te contacte.'
                        : 'No hay leads con esa etapa.'}
                    </div>
                  </td>
                </tr>
              ) : visible.map((lead) => [
                <tr key={lead.id} className="trow"
                  onClick={() => setExpanded(expanded === lead.id ? null : lead.id)}>
                  <td>
                    <div className="cename">{lead.name}</div>
                    <div className="elsub">
                      {[lead.companyName, lead.phone && `Tel ${lead.phone}`, lead.email && `Correo ${lead.email}`]
                        .filter(Boolean).join(' · ') || 'sin datos de contacto'}
                    </div>
                  </td>
                  <td><Badge st={lead.source} tone="neu" /></td>
                  <td>{lead.ownerName ?? '—'}</td>
                  <td>
                    <Badge st={lead.stage} tone={STAGE_TONE[lead.stage] ?? 'neu'} />
                    {lead.stage === 'Perdido' && lead.lostReason && (
                      <div className="elsub">{lead.lostReason}</div>
                    )}
                  </td>
                  {data.canWrite && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <Select
                          value={lead.stage}
                          onChange={(next) => {
                            if (next === lead.stage) return
                            startTransition(async () => {
                              const result = await updateLead({
                                ...toForm(lead),
                                id: lead.id,
                                source: lead.source as (typeof LEAD_SOURCES)[number],
                                stage: next as (typeof LEAD_STAGES)[number],
                              })
                              if (!result.ok) { addToast(result.error, 'err'); return }
                              apply(result.data)
                            })
                          }}
                          options={[...LEAD_STAGES]}
                        />
                        {lead.stage !== 'Convertido' && (
                          <button className="ibtn" aria-label={`Convertir ${lead.name}`}
                            title="Convertir en cliente" disabled={pending}
                            onClick={() => convert(lead)}>
                            <UserPlus size={14} />
                          </button>
                        )}
                        <button className="ibtn" aria-label={`Editar ${lead.name}`}
                          disabled={pending}
                          onClick={() => {
                            setEditingId(lead.id)
                            setForm(toForm(lead))
                            setFormOpen(true)
                          }}>
                          <PenLine size={14} />
                        </button>
                        <button className="ibtn" aria-label={`Eliminar ${lead.name}`}
                          disabled={pending} onClick={() => remove(lead)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>,
                expanded === lead.id ? (
                  <tr key={`${lead.id}-detail`}>
                    <td colSpan={data.canWrite ? 5 : 4} style={{ background: 'var(--bg2)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
                        {lead.notes && (
                          <div className="elsub">Notas: {lead.notes}</div>
                        )}

                        {lead.activities.length > 0 && lead.activities.map((a) => (
                          <div className="elrow" key={a.id}>
                            <div className="eltxt">
                              <div className="cename">{a.note}</div>
                              <div className="elsub">{a.kind} · {formatWhen(a.occurredAt)}</div>
                            </div>
                          </div>
                        ))}

                        {data.canWrite && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                            <div style={{ width: 150 }}>
                              <Select
                                value={activityForm.kind}
                                onChange={(v) => setActivityForm((p) => ({ ...p, kind: v }))}
                                options={[...ACTIVITY_KINDS]}
                              />
                            </div>
                            <input
                              className="field" style={{ flex: 1 }}
                              placeholder="¿Qué pasó con este lead?"
                              value={activityForm.note}
                              onChange={(e) => setActivityForm((p) => ({ ...p, note: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && activityForm.note.trim()) {
                                  submitActivity()
                                }
                              }}
                              onFocus={() => setActivityForm((p) => ({ ...p, leadId: lead.id }))}
                            />
                            <button className="btn" disabled={pending || !activityForm.note.trim()}
                              onClick={submitActivity}>
                              <Check size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : null,
              ])}
            </tbody>
          </table>
        </div>

        <LoadMore
          loaded={state.leads.length}
          total={state.leadsTotal}
          loading={loadingMore}
          error={loadMoreError}
          onLoadMore={loadMore}
          noun="leads"
        />
      </div>

      <FormDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Editar lead' : 'Nuevo lead'}
        footer={
          <button className="btn dark" disabled={pending} onClick={submit}>
            <Check size={15} />{editingId ? 'Guardar cambios' : 'Registrar lead'}
          </button>
        }
      >
        <div className="flabel" style={{ marginTop: 0 }}>Nombre</div>
        <input className="field" placeholder="Quién es la persona" value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />

        <label className="flabel" htmlFor="lead-company">Empresa</label>
        <input id="lead-company" className="field" placeholder="Opcional" value={form.companyName}
          onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))} />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="lead-email">Correo</label>
            <input id="lead-email" className="field" type="email" value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          </div>
          <div>
            <label className="flabel" htmlFor="lead-phone">Teléfono</label>
            <input id="lead-phone" className="field" inputMode="tel" value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <div className="flabel">Origen</div>
            <Select value={form.source}
              onChange={(v) => setForm((p) => ({ ...p, source: v }))}
              options={[...LEAD_SOURCES]} />
          </div>
          <div>
            <div className="flabel">Etapa</div>
            <Select value={form.stage}
              onChange={(v) => setForm((p) => ({ ...p, stage: v }))}
              options={[...LEAD_STAGES]} />
          </div>
        </div>

        {state.roster.length > 0 && (
          <>
            <div className="flabel">Dueño comercial</div>
            <Select value={form.ownerId}
              onChange={(v) => setForm((p) => ({ ...p, ownerId: v }))}
              placeholder="Sin asignar"
              options={state.roster.map((r) => ({ value: r.employeeId, label: r.fullName }))} />
          </>
        )}

        {form.stage === 'Perdido' && (
          <>
            <label className="flabel" htmlFor="lead-lost">Razón de la pérdida</label>
            <input id="lead-lost" className="field" placeholder="Se fue con la competencia…" value={form.lostReason}
              onChange={(e) => setForm((p) => ({ ...p, lostReason: e.target.value }))} />
          </>
        )}

        <label className="flabel" htmlFor="lead-notes">Notas</label>
        <textarea id="lead-notes" className="field" rows={3} value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
      </FormDrawer>
    </>
  )
}
