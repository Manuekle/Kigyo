'use client'

import { useMemo, useState, useTransition } from 'react'
import { Sprout, Check, Plus, Trash2, Package, DollarSign, MapPin } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import TabBar from '@/components/ui/TabBar'
import FormDrawer from '@/components/ui/FormDrawer'
import LoadMore from '@/components/ui/LoadMore'
import { useApp } from '@/lib/context/AppContext'
import { CROP_CYCLE_STATUSES, LOT_STATUSES } from '@/lib/domain'
import { cop } from '@/lib/utils'
import type { AgroData, LotRow } from '@/server/queries/agro'
import {
  createCiclo, createLote, deleteLote, registrarCosecha,
  setCicloStatus, setLoteStatus,
} from '@/server/mutations/agro'
import { fetchMoreLotes } from '@/server/actions/agro'

const DATE = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

function formatDate(iso: string | null): string {
  return iso ? DATE.format(new Date(`${iso}T00:00:00`)) : '—'
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

const TODAY = () => new Date().toISOString().slice(0, 10)

const EMPTY_LOT = { name: '', farm: '', hectares: '', soilType: '', location: '', notes: '' }
const EMPTY_CYCLE = {
  lotId: '', crop: '', variety: '', hectares: '', sownOn: '', expectedHarvestOn: '',
  expectedYieldKg: '', inputCost: '', responsibleId: '', notes: '',
}
const EMPTY_HARVEST = {
  cycleId: '', quantityKg: '', quality: '', pricePerKg: '', buyer: '', harvestedOn: '', notes: '',
}

export default function AgroPage({ data }: { data: AgroData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [lotes, setLotes] = useState<LotRow[]>(data.lotes)
  const [total, setTotal] = useState(data.lotesTotal)
  const [ciclos, setCiclos] = useState(data.ciclos)
  const [cosechas, setCosechas] = useState(data.cosechas)
  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const [tab, setTab] = useState('ciclos')
  const [lotOpen, setLotOpen] = useState(false)
  const [cycleOpen, setCycleOpen] = useState(false)
  const [harvestOpen, setHarvestOpen] = useState(false)
  const [lotForm, setLotForm] = useState(EMPTY_LOT)
  const [cycleForm, setCycleForm] = useState(EMPTY_CYCLE)
  const [harvestForm, setHarvestForm] = useState(EMPTY_HARVEST)

  function apply(next: AgroData) {
    setLotes(next.lotes)
    setTotal(next.lotesTotal)
    setCiclos(next.ciclos)
    setCosechas(next.cosechas)
  }

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreLotes(lotes.length)
      if (!result.ok) { setLoadMoreError(result.error); return }
      setLotes((prev) => {
        const seen = new Set(prev.map((r) => r.id))
        return [...prev, ...result.data.rows.filter((r) => !seen.has(r.id))]
      })
      setTotal(result.data.total)
    })
  }

  const responsibleName = useMemo(() => {
    const byId = new Map(data.roster.map((r) => [r.employeeId, r.fullName]))
    return (id: string | null) => (id ? byId.get(id) ?? '—' : 'Sin asignar')
  }, [data.roster])

  const stats = useMemo(() => {
    const live = ciclos.filter((c) => c.status !== 'Cosechado' && c.status !== 'Perdido')
    const harvested = ciclos.reduce((s, c) => s + c.harvestedKg, 0)
    const revenue = ciclos.reduce((s, c) => s + c.revenueCents, 0)
    const cost = ciclos.reduce((s, c) => s + c.inputCostCents, 0)
    return {
      hectares: lotes.reduce((s, l) => s + l.hectares, 0),
      cycles: live.length,
      harvested,
      // Revenue minus inputs. Not a full P&L — labour and machinery live in
      // other modules — but it is the number a grower checks first.
      margin: revenue - cost,
    }
  }, [lotes, ciclos])

  const cycleOptions = ciclos
    .filter((c) => c.status !== 'Cosechado' && c.status !== 'Perdido')
    .map((c) => ({ value: c.id, label: `${c.crop} · ${c.lotName}` }))

  function changeLot(l: LotRow, status: string) {
    startTransition(async () => {
      const result = await setLoteStatus({ id: l.id, status: status as never })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
    })
  }

  function changeCycle(id: string, status: string) {
    startTransition(async () => {
      const result = await setCicloStatus({ id, status: status as never })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast(`Ciclo ${status.toLowerCase()}`, 'ok')
    })
  }

  function remove(l: LotRow) {
    if (!window.confirm(`¿Eliminar ${l.name}? Se eliminan también sus ciclos y cosechas.`)) return
    startTransition(async () => {
      const result = await deleteLote(l.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Lote eliminado', 'ok')
    })
  }

  function submitLot() {
    startTransition(async () => {
      const result = await createLote({
        name: lotForm.name,
        farm: lotForm.farm,
        hectares: lotForm.hectares || 0,
        soilType: lotForm.soilType,
        location: lotForm.location,
        notes: lotForm.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setLotForm(EMPTY_LOT)
      setLotOpen(false)
      addToast('Lote creado', 'ok')
    })
  }

  function submitCycle() {
    startTransition(async () => {
      const result = await createCiclo({
        lotId: cycleForm.lotId,
        crop: cycleForm.crop,
        variety: cycleForm.variety,
        hectares: cycleForm.hectares || 0,
        sownOn: orNull(cycleForm.sownOn),
        expectedHarvestOn: orNull(cycleForm.expectedHarvestOn),
        expectedYieldKg: orNull(cycleForm.expectedYieldKg),
        inputCostCents: toCents(cycleForm.inputCost),
        responsibleId: cycleForm.responsibleId || null,
        notes: cycleForm.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setCycleForm(EMPTY_CYCLE)
      setCycleOpen(false)
      addToast('Ciclo creado', 'ok')
    })
  }

  function submitHarvest() {
    startTransition(async () => {
      const result = await registrarCosecha({
        cycleId: harvestForm.cycleId,
        quantityKg: harvestForm.quantityKg || 0,
        quality: harvestForm.quality,
        pricePerKgCents: toCents(harvestForm.pricePerKg),
        buyer: harvestForm.buyer,
        harvestedOn: harvestForm.harvestedOn || TODAY(),
        notes: harvestForm.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setHarvestForm(EMPTY_HARVEST)
      setHarvestOpen(false)
      addToast('Cosecha registrada', 'ok')
    })
  }

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat icon={<MapPin size={16} />} tone="blu" label="Hectáreas"
            value={Math.round(stats.hectares)} sub={`en ${lotes.length} lotes`} />
        </div>
        <div className="rise d2">
          <Stat icon={<Sprout size={16} />} tone="grn" label="Ciclos activos"
            value={stats.cycles} />
        </div>
        <div className="rise d3">
          <Stat icon={<Package size={16} />} tone="amb" label="Kilos cosechados"
            value={Math.round(stats.harvested)} />
        </div>
        <div className="rise d4">
          <Stat icon={<DollarSign size={16} />} tone="vio" label="Margen bruto"
            value={pesos(stats.margin)} sub="ventas menos insumos" />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <TabBar
            items={[
              { key: 'ciclos', label: 'Ciclos' },
              { key: 'lotes', label: 'Lotes' },
              { key: 'cosechas', label: 'Cosechas' },
            ]}
            value={tab}
            onChange={setTab}
          />
          {data.canWrite && (
            <div style={{ display: 'flex', gap: 8 }}>
              {tab === 'lotes' ? (
                <button className="btn dark" disabled={pending} onClick={() => setLotOpen(true)}>
                  <Plus size={15} />Lote
                </button>
              ) : tab === 'cosechas' ? (
                <button className="btn dark" disabled={pending || cycleOptions.length === 0}
                  onClick={() => {
                    setHarvestForm({ ...EMPTY_HARVEST, cycleId: cycleOptions[0]?.value ?? '', harvestedOn: TODAY() })
                    setHarvestOpen(true)
                  }}>
                  <Plus size={15} />Cosecha
                </button>
              ) : (
                <button className="btn dark" disabled={pending || lotes.length === 0}
                  onClick={() => {
                    setCycleForm({ ...EMPTY_CYCLE, lotId: lotes[0]?.id ?? '' })
                    setCycleOpen(true)
                  }}>
                  <Plus size={15} />Ciclo
                </button>
              )}
            </div>
          )}
        </div>

        {tab === 'ciclos' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Cultivo</th>
                  <th scope="col">Lote</th>
                  <th scope="col">Hectáreas</th>
                  <th scope="col">Siembra</th>
                  <th scope="col">Cosechado</th>
                  <th scope="col">Rendimiento</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {ciclos.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        No hay ciclos de cultivo registrados.
                      </div>
                    </td>
                  </tr>
                ) : ciclos.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="cename">{c.crop}</div>
                      <div className="elsub">
                        {c.variety || 'Sin variedad'} · {responsibleName(c.responsibleId)}
                      </div>
                    </td>
                    <td>{c.lotName}</td>
                    <td>{c.hectares} ha</td>
                    <td>
                      {formatDate(c.sownOn)}
                      {c.expectedHarvestOn && (
                        <div className="elsub">cosecha {formatDate(c.expectedHarvestOn)}</div>
                      )}
                    </td>
                    <td>
                      {Math.round(c.harvestedKg)} kg
                      {c.revenueCents > 0 && <div className="elsub">{pesos(c.revenueCents)}</div>}
                    </td>
                    <td>
                      {c.yieldPerHectare === null ? '—' : `${c.yieldPerHectare} kg/ha`}
                      {c.expectedYieldKg !== null && c.hectares > 0 && (
                        <div className="elsub">
                          meta {Math.round(c.expectedYieldKg / c.hectares)} kg/ha
                        </div>
                      )}
                    </td>
                    <td>
                      {data.canWrite ? (
                        <Select
                          value={c.status}
                          onChange={(next) => { if (next !== c.status) changeCycle(c.id, next) }}
                          options={[...CROP_CYCLE_STATUSES]}
                        />
                      ) : (
                        <Badge st={c.status}
                          tone={c.status === 'Cosechado' ? 'grn'
                            : c.status === 'Perdido' ? 'red'
                            : c.status === 'Planificado' ? 'neu' : 'amb'} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'lotes' && (
          <>
            <div className="tblwrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Lote</th>
                    <th scope="col">Finca</th>
                    <th scope="col">Hectáreas</th>
                    <th scope="col">Suelo</th>
                    <th scope="col">Ciclos activos</th>
                    <th scope="col">Estado</th>
                    {data.canWrite && <th scope="col" aria-label="Acciones" />}
                  </tr>
                </thead>
                <tbody>
                  {lotes.length === 0 ? (
                    <tr>
                      <td colSpan={data.canWrite ? 7 : 6}>
                        <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                          Todavía no hay lotes registrados.
                        </div>
                      </td>
                    </tr>
                  ) : lotes.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <div className="cename">{l.name}</div>
                        <div className="elsub mono">{l.code}{l.location && ` · ${l.location}`}</div>
                      </td>
                      <td>{l.farm || '—'}</td>
                      <td>{l.hectares} ha</td>
                      <td>{l.soilType || '—'}</td>
                      <td>{l.activeCycles}</td>
                      <td>
                        <Badge st={l.status}
                          tone={l.status === 'Disponible' ? 'grn'
                            : l.status === 'En cosecha' ? 'amb'
                            : l.status === 'Sembrado' ? 'blu' : 'neu'} />
                      </td>
                      {data.canWrite && (
                        <td>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <Select
                              value={l.status}
                              onChange={(next) => { if (next !== l.status) changeLot(l, next) }}
                              options={[...LOT_STATUSES]}
                            />
                            <button className="ibtn" aria-label={`Eliminar ${l.name}`}
                              disabled={pending} onClick={() => remove(l)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <LoadMore
              loaded={lotes.length}
              total={total}
              loading={loadingMore}
              error={loadMoreError}
              onLoadMore={loadMore}
              noun="lotes"
            />
          </>
        )}

        {tab === 'cosechas' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Ciclo</th>
                  <th scope="col">Cantidad</th>
                  <th scope="col">Calidad</th>
                  <th scope="col">Precio / kg</th>
                  <th scope="col">Comprador</th>
                  <th scope="col">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {cosechas.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        No hay cosechas registradas.
                      </div>
                    </td>
                  </tr>
                ) : cosechas.map((h) => {
                  const cycle = ciclos.find((c) => c.id === h.cycleId)
                  return (
                    <tr key={h.id}>
                      <td>
                        <div className="cename">{cycle?.crop ?? '—'}</div>
                        <div className="elsub">{cycle?.lotName ?? ''}</div>
                      </td>
                      <td>{h.quantityKg} kg</td>
                      <td>{h.quality || '—'}</td>
                      <td>{h.pricePerKgCents > 0 ? pesos(h.pricePerKgCents) : '—'}</td>
                      <td>{h.buyer || '—'}</td>
                      <td>{formatDate(h.harvestedOn)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FormDrawer
        open={lotOpen}
        onClose={() => setLotOpen(false)}
        title="Nuevo lote"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitLot}>
            <Check size={15} />Crear lote
          </button>
        }
      >
        <label className="flabel" htmlFor="lot-name">Nombre</label>
        <input id="lot-name" className="field" value={lotForm.name}
          onChange={(e) => setLotForm({ ...lotForm, name: e.target.value })}
          placeholder="Lote norte" />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="lot-farm">Finca</label>
            <input id="lot-farm" className="field" value={lotForm.farm}
              onChange={(e) => setLotForm({ ...lotForm, farm: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="lot-ha">Hectáreas</label>
            <input id="lot-ha" className="field" type="number" min={0} step="0.01"
              value={lotForm.hectares}
              onChange={(e) => setLotForm({ ...lotForm, hectares: e.target.value })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="lot-soil">Tipo de suelo</label>
            <input id="lot-soil" className="field" value={lotForm.soilType}
              onChange={(e) => setLotForm({ ...lotForm, soilType: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="lot-loc">Ubicación</label>
            <input id="lot-loc" className="field" value={lotForm.location}
              onChange={(e) => setLotForm({ ...lotForm, location: e.target.value })} />
          </div>
        </div>

        <label className="flabel" htmlFor="lot-notes">Notas</label>
        <textarea id="lot-notes" className="field" rows={3} value={lotForm.notes}
          onChange={(e) => setLotForm({ ...lotForm, notes: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={cycleOpen}
        onClose={() => setCycleOpen(false)}
        title="Nuevo ciclo de cultivo"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitCycle}>
            <Check size={15} />Crear ciclo
          </button>
        }
      >
        <div className="flabel">Lote</div>
        <Select value={cycleForm.lotId}
          onChange={(v) => setCycleForm({ ...cycleForm, lotId: v })}
          placeholder="Elige el lote"
          options={lotes.map((l) => ({ value: l.id, label: `${l.name} · ${l.hectares} ha` }))} />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="cyc-crop">Cultivo</label>
            <input id="cyc-crop" className="field" value={cycleForm.crop}
              onChange={(e) => setCycleForm({ ...cycleForm, crop: e.target.value })}
              placeholder="Café" />
          </div>
          <div>
            <label className="flabel" htmlFor="cyc-var">Variedad</label>
            <input id="cyc-var" className="field" value={cycleForm.variety}
              onChange={(e) => setCycleForm({ ...cycleForm, variety: e.target.value })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="cyc-ha">Hectáreas sembradas</label>
            <input id="cyc-ha" className="field" type="number" min={0} step="0.01"
              value={cycleForm.hectares}
              onChange={(e) => setCycleForm({ ...cycleForm, hectares: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="cyc-yield">Rendimiento esperado (kg)</label>
            <input id="cyc-yield" className="field" type="number" min={0}
              value={cycleForm.expectedYieldKg}
              onChange={(e) => setCycleForm({ ...cycleForm, expectedYieldKg: e.target.value })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="cyc-sown">Siembra</label>
            <input id="cyc-sown" className="field" type="date" value={cycleForm.sownOn}
              onChange={(e) => setCycleForm({ ...cycleForm, sownOn: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="cyc-harv">Cosecha esperada</label>
            <input id="cyc-harv" className="field" type="date" value={cycleForm.expectedHarvestOn}
              onChange={(e) => setCycleForm({ ...cycleForm, expectedHarvestOn: e.target.value })} />
          </div>
        </div>

        <label className="flabel" htmlFor="cyc-cost">Costo de insumos (COP)</label>
        <input id="cyc-cost" className="field" inputMode="numeric" value={cycleForm.inputCost}
          onChange={(e) => setCycleForm({ ...cycleForm, inputCost: e.target.value })} />

        <div className="flabel">Responsable</div>
        <Select value={cycleForm.responsibleId}
          onChange={(v) => setCycleForm({ ...cycleForm, responsibleId: v })}
          placeholder="Sin asignar"
          options={data.roster.map((r) => ({ value: r.employeeId, label: r.fullName }))} />

        <label className="flabel" htmlFor="cyc-notes">Notas</label>
        <textarea id="cyc-notes" className="field" rows={3} value={cycleForm.notes}
          onChange={(e) => setCycleForm({ ...cycleForm, notes: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={harvestOpen}
        onClose={() => setHarvestOpen(false)}
        title="Registrar cosecha"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitHarvest}>
            <Check size={15} />Registrar
          </button>
        }
      >
        <div className="flabel">Ciclo</div>
        <Select value={harvestForm.cycleId}
          onChange={(v) => setHarvestForm({ ...harvestForm, cycleId: v })}
          placeholder="Elige el ciclo" options={cycleOptions} />

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="har-kg">Cantidad (kg)</label>
            <input id="har-kg" className="field" type="number" min={0} step="0.01"
              value={harvestForm.quantityKg}
              onChange={(e) => setHarvestForm({ ...harvestForm, quantityKg: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="har-price">Precio por kg (COP)</label>
            <input id="har-price" className="field" inputMode="numeric" value={harvestForm.pricePerKg}
              onChange={(e) => setHarvestForm({ ...harvestForm, pricePerKg: e.target.value })} />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="har-quality">Calidad</label>
            <input id="har-quality" className="field" value={harvestForm.quality}
              onChange={(e) => setHarvestForm({ ...harvestForm, quality: e.target.value })}
              placeholder="Primera, exportación…" />
          </div>
          <div>
            <label className="flabel" htmlFor="har-date">Fecha</label>
            <input id="har-date" className="field" type="date" value={harvestForm.harvestedOn}
              onChange={(e) => setHarvestForm({ ...harvestForm, harvestedOn: e.target.value })} />
          </div>
        </div>

        <label className="flabel" htmlFor="har-buyer">Comprador</label>
        <input id="har-buyer" className="field" value={harvestForm.buyer}
          onChange={(e) => setHarvestForm({ ...harvestForm, buyer: e.target.value })} />

        <label className="flabel" htmlFor="har-notes">Notas</label>
        <textarea id="har-notes" className="field" rows={2} value={harvestForm.notes}
          onChange={(e) => setHarvestForm({ ...harvestForm, notes: e.target.value })} />
      </FormDrawer>
    </>
  )
}
