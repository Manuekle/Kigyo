'use client'

import { useMemo, useState, useTransition } from 'react'
import { ShieldAlert, Clock, Info, Check, AlertCircle, Plus, Trash2, X, Zap, PenLine } from '@/lib/icons'
import type { IconProps } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Stat from '@/components/ui/Stat'
import Select from '@/components/ui/Select'
import TabBar from '@/components/ui/TabBar'
import { useApp } from '@/lib/context/AppContext'
import { useConfirm } from '@/lib/context/ConfirmContext'
import { RISK_CATEGORIES, RISK_SEVERITIES } from '@/lib/domain'
import LoadMore from '@/components/ui/LoadMore'
import type { RiesgosData, RiesgoRow } from '@/server/queries/riesgos'
import { createRiesgo, deleteRiesgo, setRiesgoStatus, updateRiesgo } from '@/server/mutations/riesgos'
import { fetchMoreRiesgos } from '@/server/actions/riesgos'

const SEV_ICO: Record<string, (p: IconProps) => React.ReactElement> = {
  Alta: AlertCircle, Media: Clock, Baja: Info,
}

const EMPTY = { category: 'Otro', severity: 'Media', area: '', detail: '', action: '', employeeId: '' }

export default function RiesgosPage({ data }: { data: RiesgosData }) {
  const { addToast } = useApp()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()

  const [riesgos, setRiesgos] = useState<RiesgoRow[]>(data.riesgos)
  const [total, setTotal] = useState(data.riesgosTotal)
  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  /** A mutation returns the fresh first page, and the total that matches it. */
  function applyRiesgos(next: RiesgosData) {
    setRiesgos(next.riesgos)
    setTotal(next.riesgosTotal)
  }

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreRiesgos(riesgos.length)
      if (!result.ok) {
        setLoadMoreError(result.error)
        return
      }
      setRiesgos((prev) => {
        const seen = new Set(prev.map((r) => r.id))
        return [...prev, ...result.data.rows.filter((r) => !seen.has(r.id))]
      })
      setTotal(result.data.total)
    })
  }
  const [sevFilter, setSevFilter] = useState('Todos')
  const [catFilter, setCatFilter] = useState('Todos')
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<RiesgoRow | null>(null)
  const [form, setForm] = useState(EMPTY)

  function closeModal() {
    setAddOpen(false)
    setEditing(null)
  }

  function openNew() {
    setEditing(null)
    setForm(EMPTY)
    setAddOpen(true)
  }

  function edit(r: RiesgoRow) {
    setEditing(r)
    setForm({
      category: r.category,
      severity: r.severity,
      area: r.area,
      detail: r.detail,
      action: r.action,
      employeeId: r.employeeId ?? '',
    })
    setAddOpen(true)
  }

  // Open risks are the register; closed ones are the record of what was done.
  // The old page conflated them by deleting from an array, so "Gestionados"
  // was `seed.length - current.length` and reset to zero on every reload.
  const open = useMemo(() => riesgos.filter((r) => r.status === 'Abierto'), [riesgos])
  const managed = riesgos.length - open.length

  const counts = useMemo(() => ({
    alta: open.filter((r) => r.severity === 'Alta').length,
    media: open.filter((r) => r.severity === 'Media').length,
    baja: open.filter((r) => r.severity === 'Baja').length,
  }), [open])

  const categories = useMemo(
    () => ['Todos', ...new Set(open.map((r) => r.category))],
    [open],
  )

  const filtered = open.filter((r) =>
    (sevFilter === 'Todos' || r.severity === sevFilter) &&
    (catFilter === 'Todos' || r.category === catFilter),
  )

  function manage(r: RiesgoRow) {
    startTransition(async () => {
      const result = await setRiesgoStatus({ id: r.id, status: 'Mitigado' })
      if (!result.ok) { addToast(result.error, 'err'); return }
      applyRiesgos(result.data)
      // Undo restores the row rather than re-inserting a copy of it, which is
      // what a delete-based "Deshacer" was doing before.
      addToast('Riesgo marcado como mitigado', 'ok', 'Deshacer', () => {
        startTransition(async () => {
          const undo = await setRiesgoStatus({ id: r.id, status: 'Abierto' })
          if (undo.ok) applyRiesgos(undo.data)
        })
      })
    })
  }

  async function remove(r: RiesgoRow) {
    if (!(await confirm({ title: '¿Eliminar este riesgo?', description: 'Úsalo solo si se registró por error; para cerrarlo, usa Gestionar.', tone: 'danger' }))) return
    startTransition(async () => {
      const result = await deleteRiesgo(r.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      applyRiesgos(result.data)
      addToast('Riesgo eliminado', 'info')
    })
  }

  function submit() {
    if (!form.detail.trim()) { addToast('Describe el riesgo identificado', 'err'); return }
    startTransition(async () => {
      const payload = {
        category: form.category as (typeof RISK_CATEGORIES)[number],
        severity: form.severity as (typeof RISK_SEVERITIES)[number],
        area: form.area.trim(),
        detail: form.detail.trim(),
        action: form.action.trim(),
        employeeId: form.employeeId || null,
        title: '',
        dueOn: null,
      }
      if (editing) {
        const result = await updateRiesgo({ id: editing.id, ...payload })
        if (!result.ok) { addToast(result.error, 'err'); return }
        applyRiesgos(result.data)
        setAddOpen(false)
        setEditing(null)
        setForm(EMPTY)
        addToast('Riesgo actualizado', 'ok')
        return
      }
      const result = await createRiesgo(payload)
      if (!result.ok) { addToast(result.error, 'err'); return }
      applyRiesgos(result.data)
      setAddOpen(false)
      setForm(EMPTY)
      addToast('Riesgo registrado', 'ok')
    })
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1"><Stat icon={<ShieldAlert size={16} />} tone="red" label="Riesgos críticos" value={counts.alta} sub="Alta prioridad" /></div>
        <div className="rise d2"><Stat icon={<Clock size={16} />} tone="amb" label="Riesgos medios" value={counts.media} sub="Atención pronto" /></div>
        <div className="rise d3"><Stat icon={<Info size={16} />} tone="neu" label="Riesgos bajos" value={counts.baja} sub="Monitorear" /></div>
        <div className="rise d4"><Stat icon={<Check size={16} />} tone="grn" label="Gestionados" value={managed} sub="mitigados o cerrados" /></div>
      </div>

      <div className="card rise d2">
        <div className="chead" style={{ flexWrap: 'wrap', gap: 10 }}>
          <TabBar
            value={sevFilter}
            onChange={setSevFilter}
            items={['Todos', ...RISK_SEVERITIES].map((s) => ({
              key: s,
              label: s === 'Todos'
                ? `Todos · ${open.length}`
                : `${s} · ${open.filter((r) => r.severity === s).length}`,
            }))}
          />
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <Select value={catFilter} onChange={setCatFilter} options={categories} style={{ width: 190 }} />
            {data.canWrite && (
              <button className="btn pri" onClick={openNew}><Plus size={14} />Nuevo riesgo</button>
            )}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="dempty" style={{ padding: '48px 0', textAlign: 'center' }}>
            <Check size={22} style={{ color: 'var(--grn)', margin: '0 auto 8px', display: 'block' }} />
            {riesgos.length === 0
              ? 'Todavía no hay riesgos registrados.'
              : open.length === 0
                ? 'No hay riesgos abiertos. Todo lo registrado está gestionado.'
                : 'No hay riesgos en esta categoría.'}
          </div>
        ) : (
          <div className="riskgrid">
            {filtered.map((r) => {
              const SevIco = SEV_ICO[r.severity] ?? Info
              return (
                <div className={`riskcard sev-${r.severity.toLowerCase()}`} key={r.id}>
                  <div className="riskhead">
                    <Badge st={r.severity} />
                    <span className="tag">{r.category}</span>
                    {data.canWrite && (
                      <>
                        <button
                          className="ibtn"
                          style={{ width: 26, height: 26, marginLeft: 'auto' }}
                          data-tip="Editar"
                          disabled={pending}
                          onClick={() => edit(r)}
                          aria-label="Editar riesgo"
                        ><PenLine size={13} /></button>
                        <button
                          className="ibtn"
                          style={{ width: 26, height: 26 }}
                          data-tip="Eliminar"
                          disabled={pending}
                          onClick={() => remove(r)}
                          aria-label="Eliminar riesgo"
                        ><Trash2 size={13} /></button>
                      </>
                    )}
                  </div>
                  {r.employeeName && <div className="riskname">{r.employeeName}</div>}
                  <div className="riskarea"><SevIco size={13} />{r.area || r.category}</div>
                  <div className="riskdetail">{r.detail}</div>
                  <div className="riskfooter">
                    <div className="riskaction">
                      <Zap size={13} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.action || 'Sin acción definida'}
                      </span>
                    </div>
                    {data.canWrite && (
                      <button
                        className="btn ghost"
                        style={{ fontSize: 11, height: 28, padding: '0 10px', flexShrink: 0 }}
                        disabled={pending}
                        onClick={() => manage(r)}
                      >
                        Gestionar
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <LoadMore
          loaded={riesgos.length}
          total={total}
          loading={loadingMore}
          error={loadMoreError}
          onLoadMore={loadMore}
          noun="riesgos"
        />
      </div>

      {addOpen && (
        <div className="mwrap" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="mhead"><div className="mtitle">{editing ? 'Editar riesgo' : 'Nuevo riesgo'}</div><button className="ibtn" onClick={closeModal} aria-label="Cerrar"><X size={18} /></button></div>
            <div className="mbody">
              <div className="fg2">
                <div>
                  <div className="flabel" style={{ marginTop: 0 }}>Categoría</div>
                  <Select value={form.category} onChange={(v) => setForm((f) => ({ ...f, category: v }))} options={[...RISK_CATEGORIES]} />
                </div>
                <div>
                  <div className="flabel" style={{ marginTop: 0 }}>Severidad</div>
                  <Select value={form.severity} onChange={(v) => setForm((f) => ({ ...f, severity: v }))} options={[...RISK_SEVERITIES]} />
                </div>
              </div>
              <div className="flabel">Área afectada</div>
              <input className="field" value={form.area} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))} placeholder="Ej. Interventoría, Energía, Obras" />
              {/* Only offered when the caller can read the directory. */}
              {data.roster.length > 0 && (
                <>
                  <div className="flabel">Persona relacionada</div>
                  <Select
                    value={form.employeeId}
                    onChange={(v) => setForm((f) => ({ ...f, employeeId: v }))}
                    placeholder="Ninguna"
                    options={[
                      { value: '', label: 'Ninguna' },
                      ...data.roster.map((r) => ({ value: r.employeeId, label: r.fullName })),
                    ]}
                  />
                </>
              )}
              <div className="flabel">Descripción del riesgo</div>
              <textarea className="field" rows={3} style={{ resize: 'none' }} value={form.detail} onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))} placeholder="Describe el riesgo identificado…" />
              <div className="flabel">Acción recomendada</div>
              <input className="field" value={form.action} onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))} placeholder="Ej. Revisar contrato con asesor legal" />
            </div>
            <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
              <button className="btn" onClick={closeModal} disabled={pending}>Cancelar</button>
              <button className="btn dark" onClick={submit} disabled={pending} aria-busy={pending}>
                {pending ? (editing ? 'Guardando…' : 'Registrando…') : (editing ? 'Guardar cambios' : 'Registrar riesgo')}
              </button>
            </div></div>
          </div>
        </div>
      )}
    </>
  )
}
