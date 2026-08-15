'use client'

import { useMemo, useState, useTransition } from 'react'
import { Sprout, Check, Plus, Trash2, PenLine, Package, DollarSign, MapPin, Wrench, FileSpreadsheet } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import TabBar from '@/components/ui/TabBar'
import FormDrawer from '@/components/ui/FormDrawer'
import LoadMore from '@/components/ui/LoadMore'
import { useApp } from '@/lib/context/AppContext'
import { CROP_CYCLE_STATUSES, LOT_STATUSES } from '@/lib/domain'
import { cop } from '@/lib/utils'
import { useExport } from '@/lib/hooks/use-export'
import type { AgroData, InsumoRow, LotRow, MaquinaRow } from '@/server/queries/agro'
import {
  addIrrigation, addTreatment, createCiclo, createInsumo, createLote, createMaquina,
  deleteInsumo, deleteIrrigation, deleteLote, deleteMaquina, deleteTreatment,
  registrarCosecha, setCicloStatus, setInsumoStock, setLoteStatus,
  setMaquinaStatus, updateLote,
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

type LotFormState = typeof EMPTY_LOT

function toLotForm(l: LotRow): LotFormState {
  return {
    name: l.name,
    farm: l.farm,
    hectares: String(l.hectares),
    soilType: l.soilType,
    location: l.location,
    notes: l.notes,
  }
}
const EMPTY_CYCLE = {
  lotId: '', crop: '', variety: '', hectares: '', sownOn: '', expectedHarvestOn: '',
  expectedYieldKg: '', inputCost: '', responsibleId: '', notes: '',
}
const EMPTY_HARVEST = {
  cycleId: '', quantityKg: '', quality: '', pricePerKg: '', buyer: '', harvestedOn: '', notes: '',
}

const INSUMO_KINDS = ['Semilla', 'Fertilizante', 'Agroquímico', 'Biocontrol', 'Otro'] as const
const MAQUINA_KINDS = ['Tractor', 'Implemento', 'Cosechadora', 'Riego', 'Otro'] as const
const MAQUINA_STATUSES = ['Operativa', 'En mantenimiento', 'Fuera de servicio'] as const

const EMPTY_INSUMO = { name: '', kind: 'Semilla', stockQty: '', unit: 'kg', supplier: '', unitCost: '' }
const EMPTY_MAQUINA = { name: '', kind: 'Tractor', serialNo: '', hoursUsed: '', notes: '' }
const EMPTY_TREATMENT = {
  cycleId: '', kind: 'Fertilización', product: '', activeIngredient: '', dose: '',
  appliedOn: '', withholdingDays: '', notes: '',
}
const EMPTY_IRRIGATION = {
  lotId: '', method: 'Goteo', durationMin: '', waterM3: '', startedOn: '', notes: '',
}

export default function AgroPage({ data }: { data: AgroData }) {
  const { addToast } = useApp()
  const { runExport, exporting } = useExport()
  const [pending, startTransition] = useTransition()

  const [lotes, setLotes] = useState<LotRow[]>(data.lotes)
  const [total, setTotal] = useState(data.lotesTotal)
  const [ciclos, setCiclos] = useState(data.ciclos)
  const [cosechas, setCosechas] = useState(data.cosechas)
  const [sanidad, setSanidad] = useState(data.sanidad ?? [])
  const [riegos, setRiegos] = useState(data.riegos ?? [])
  const [insumos, setInsumos] = useState(data.insumos)
  const [maquinaria, setMaquinaria] = useState(data.maquinaria)
  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const [tab, setTab] = useState('ciclos')
  const [lotOpen, setLotOpen] = useState(false)
  const [editingLot, setEditingLot] = useState<LotRow | null>(null)
  const [cycleOpen, setCycleOpen] = useState(false)
  const [harvestOpen, setHarvestOpen] = useState(false)
  const [insumoOpen, setInsumoOpen] = useState(false)
  const [maquinaOpen, setMaquinaOpen] = useState(false)
  const [treatmentOpen, setTreatmentOpen] = useState(false)
  const [irrigationOpen, setIrrigationOpen] = useState(false)
  const [lotForm, setLotForm] = useState(EMPTY_LOT)
  const [cycleForm, setCycleForm] = useState(EMPTY_CYCLE)
  const [harvestForm, setHarvestForm] = useState(EMPTY_HARVEST)
  const [treatmentForm, setTreatmentForm] = useState(EMPTY_TREATMENT)
  const [irrigationForm, setIrrigationForm] = useState(EMPTY_IRRIGATION)
  const [insumoForm, setInsumoForm] = useState(EMPTY_INSUMO)
  const [maquinaForm, setMaquinaForm] = useState(EMPTY_MAQUINA)

  function apply(next: AgroData) {
    setLotes(next.lotes)
    setTotal(next.lotesTotal)
    setCiclos(next.ciclos)
    setCosechas(next.cosechas)
    setInsumos(next.insumos)
    setMaquinaria(next.maquinaria)
    setSanidad(next.sanidad)
    setRiegos(next.riegos)
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

  const exportRows = () => {
    void runExport(
      lotes.map((l) => ({
        Código: l.code ?? '',
        Lote: l.name,
        Finca: l.farm,
        Hectáreas: l.hectares,
        'Tipo de suelo': l.soilType,
        Ubicación: l.location,
        'Ciclos activos': l.activeCycles,
        Estado: l.status,
        Notas: l.notes,
      })),
      'lotes-kigyo',
      'agro',
    )
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

  function startEdit(l: LotRow) {
    setLotForm(toLotForm(l))
    setEditingLot(l)
    setLotOpen(true)
  }

  function submitLot() {
    const editing = editingLot
    const payload = {
      name: lotForm.name,
      farm: lotForm.farm,
      hectares: lotForm.hectares || 0,
      soilType: lotForm.soilType,
      location: lotForm.location,
      notes: lotForm.notes,
    }
    startTransition(async () => {
      const result = editing
        ? await updateLote({ id: editing.id, ...payload })
        : await createLote(payload)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setLotForm(EMPTY_LOT)
      setEditingLot(null)
      setLotOpen(false)
      addToast(editing ? 'Lote actualizado' : 'Lote creado', 'ok')
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

  function submitInsumo() {
    startTransition(async () => {
      const result = await createInsumo({
        name: insumoForm.name,
        kind: insumoForm.kind as never,
        stockQty: insumoForm.stockQty || 0,
        unit: insumoForm.unit,
        supplier: insumoForm.supplier,
        unitCostCents: toCents(insumoForm.unitCost),
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setInsumoForm(EMPTY_INSUMO)
      setInsumoOpen(false)
      addToast('Insumo creado', 'ok')
    })
  }

  function adjustStock(i: InsumoRow, delta: number) {
    startTransition(async () => {
      const result = await setInsumoStock({ id: i.id, stockQty: Math.max(0, i.stockQty + delta) })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Stock actualizado', 'ok')
    })
  }

  function removeInsumo(i: InsumoRow) {
    if (!window.confirm(`¿Eliminar ${i.name}?`)) return
    startTransition(async () => {
      const result = await deleteInsumo(i.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Insumo eliminado', 'ok')
    })
  }

  function submitMaquina() {
    startTransition(async () => {
      const result = await createMaquina({
        name: maquinaForm.name,
        kind: maquinaForm.kind as never,
        serialNo: maquinaForm.serialNo,
        hoursUsed: maquinaForm.hoursUsed || 0,
        notes: maquinaForm.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setMaquinaForm(EMPTY_MAQUINA)
      setMaquinaOpen(false)
      addToast('Máquina registrada', 'ok')
    })
  }

  function submitTreatment() {
    startTransition(async () => {
      const result = await addTreatment({
        cycleId: treatmentForm.cycleId,
        kind: treatmentForm.kind as never,
        product: treatmentForm.product,
        activeIngredient: treatmentForm.activeIngredient,
        dose: treatmentForm.dose,
        appliedOn: treatmentForm.appliedOn || TODAY(),
        withholdingDays: treatmentForm.withholdingDays,
        notes: treatmentForm.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setTreatmentForm(EMPTY_TREATMENT)
      setTreatmentOpen(false)
      addToast('Aplicación registrada', 'ok')
    })
  }

  function removeTreatment(id: string) {
    startTransition(async () => {
      const result = await deleteTreatment(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Aplicación eliminada', 'ok')
    })
  }

  function submitIrrigation() {
    startTransition(async () => {
      const result = await addIrrigation({
        lotId: irrigationForm.lotId,
        method: irrigationForm.method as never,
        durationMin: Number(irrigationForm.durationMin) || 0,
        waterM3: Number(irrigationForm.waterM3) || 0,
        startedOn: irrigationForm.startedOn || TODAY(),
        notes: irrigationForm.notes,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      setIrrigationForm(EMPTY_IRRIGATION)
      setIrrigationOpen(false)
      addToast('Riego registrado', 'ok')
    })
  }

  function removeIrrigation(id: string) {
    startTransition(async () => {
      const result = await deleteIrrigation(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Riego eliminado', 'ok')
    })
  }

  function changeMaquinaStatus(m: MaquinaRow, status: string) {
    startTransition(async () => {
      const result = await setMaquinaStatus({ id: m.id, status: status as never })
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Estado actualizado', 'ok')
    })
  }

  function removeMaquina(m: MaquinaRow) {
    if (!window.confirm(`¿Eliminar ${m.name}?`)) return
    startTransition(async () => {
      const result = await deleteMaquina(m.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      apply(result.data)
      addToast('Máquina eliminada', 'ok')
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
              { key: 'insumos', label: 'Insumos' },
              { key: 'maquinaria', label: 'Maquinaria' },
              { key: 'sanidad', label: 'Sanidad' },
              { key: 'riego', label: 'Riego' },
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === 'lotes' && (
            <button disabled={exporting} aria-busy={exporting} className="btn" onClick={exportRows}><FileSpreadsheet size={15} />Exportar</button>
          )}
          {data.canWrite && (
            <div style={{ display: 'flex', gap: 8 }}>
              {tab === 'lotes' ? (
                <button className="btn dark" disabled={pending}
                  onClick={() => { setLotForm(EMPTY_LOT); setEditingLot(null); setLotOpen(true) }}>
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
              ) : tab === 'insumos' ? (
                <button className="btn dark" disabled={pending}
                  onClick={() => { setInsumoForm(EMPTY_INSUMO); setInsumoOpen(true) }}>
                  <Plus size={15} />Insumo
                </button>
              ) : tab === 'maquinaria' ? (
                <button className="btn dark" disabled={pending}
                  onClick={() => { setMaquinaForm(EMPTY_MAQUINA); setMaquinaOpen(true) }}>
                  <Plus size={15} />Máquina
                </button>
              ) : tab === 'sanidad' ? (
                <button className="btn dark" disabled={pending || ciclos.length === 0}
                  onClick={() => {
                    setTreatmentForm({ ...EMPTY_TREATMENT, cycleId: ciclos[0]?.id ?? '', appliedOn: TODAY() })
                    setTreatmentOpen(true)
                  }}>
                  <Plus size={15} />Aplicación
                </button>
              ) : tab === 'riego' ? (
                <button className="btn dark" disabled={pending || lotes.length === 0}
                  onClick={() => {
                    setIrrigationForm({ ...EMPTY_IRRIGATION, lotId: lotes[0]?.id ?? '', startedOn: TODAY() })
                    setIrrigationOpen(true)
                  }}>
                  <Plus size={15} />Riego
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
                            <button className="ibtn" aria-label={`Editar ${l.name}`}
                              disabled={pending} onClick={() => startEdit(l)}>
                              <PenLine size={14} />
                            </button>
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

        {tab === 'insumos' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Insumo</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Stock</th>
                  <th scope="col">Unidad</th>
                  <th scope="col">Proveedor</th>
                  <th scope="col">Costo unit.</th>
                  {data.canWrite && <th scope="col" aria-label="Acciones" />}
                </tr>
              </thead>
              <tbody>
                {insumos.length === 0 ? (
                  <tr>
                    <td colSpan={data.canWrite ? 7 : 6}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        No hay insumos registrados.
                      </div>
                    </td>
                  </tr>
                ) : insumos.map((i) => (
                  <tr key={i.id}>
                    <td>
                      <div className="cename">{i.name}</div>
                      <div className="elsub">{i.supplier || 'Sin proveedor'}</div>
                    </td>
                    <td>{i.kind}</td>
                    <td className="mono">{i.stockQty}</td>
                    <td>{i.unit}</td>
                    <td>{i.supplier || '—'}</td>
                    <td>{i.unitCostCents > 0 ? pesos(i.unitCostCents) : '—'}</td>
                    {data.canWrite && (
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button className="ibtn" aria-label={`Restar 1 a ${i.name}`}
                            disabled={pending || i.stockQty <= 0} onClick={() => adjustStock(i, -1)}>
                            −
                          </button>
                          <button className="ibtn" aria-label={`Sumar 1 a ${i.name}`}
                            disabled={pending} onClick={() => adjustStock(i, 1)}>
                            <Plus size={14} />
                          </button>
                          <button className="ibtn" aria-label={`Eliminar ${i.name}`}
                            disabled={pending} onClick={() => removeInsumo(i)}>
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
        )}

        {tab === 'maquinaria' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Equipo</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Serial</th>
                  <th scope="col">Horas de uso</th>
                  <th scope="col">Estado</th>
                  {data.canWrite && <th scope="col" aria-label="Acciones" />}
                </tr>
              </thead>
              <tbody>
                {maquinaria.length === 0 ? (
                  <tr>
                    <td colSpan={data.canWrite ? 6 : 5}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        No hay maquinaria registrada.
                      </div>
                    </td>
                  </tr>
                ) : maquinaria.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="cename">{m.name}</div>
                      {m.notes && <div className="elsub">{m.notes}</div>}
                    </td>
                    <td>{m.kind}</td>
                    <td className="mono">{m.serialNo || '—'}</td>
                    <td>{m.hoursUsed}</td>
                    <td>
                      {data.canWrite ? (
                        <Select
                          value={m.status}
                          onChange={(next) => { if (next !== m.status) changeMaquinaStatus(m, next) }}
                          options={[...MAQUINA_STATUSES]}
                        />
                      ) : (
                        <Badge st={m.status}
                          tone={m.status === 'Operativa' ? 'grn'
                            : m.status === 'En mantenimiento' ? 'amb' : 'red'} />
                      )}
                    </td>
                    {data.canWrite && (
                      <td>
                        <button className="ibtn" aria-label={`Eliminar ${m.name}`}
                          disabled={pending} onClick={() => removeMaquina(m)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'sanidad' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Cultivo</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Producto</th>
                  <th scope="col">Dosis</th>
                  <th scope="col">Aplicada</th>
                  <th scope="col">Carencia</th>
                  <th scope="col" aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {sanidad.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        Sin aplicaciones registradas.
                      </div>
                    </td>
                  </tr>
                ) : sanidad.map((t) => (
                  <tr key={t.id}>
                    <td><div className="cename">{t.crop}</div></td>
                    <td>{t.kind}</td>
                    <td>
                      {t.product}
                      {t.activeIngredient && (
                        <div className="muted" style={{ fontSize: 12 }}>{t.activeIngredient}</div>
                      )}
                    </td>
                    <td className="mono">{t.dose || '—'}</td>
                    <td className="muted mono" style={{ fontSize: 12 }}>{formatDate(t.appliedOn)}</td>
                    <td className="mono">
                      {t.withholdingDays !== null ? `${t.withholdingDays} d` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="ibtn" style={{ width: 28, height: 28, color: 'var(--redd)' }}
                        data-tip="Eliminar" disabled={pending}
                        onClick={() => removeTreatment(t.id)}
                        aria-label={`Eliminar aplicación de ${t.product}`}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'riego' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Lote</th>
                  <th scope="col">Método</th>
                  <th scope="col">Duración</th>
                  <th scope="col">Agua</th>
                  <th scope="col">Fecha</th>
                  <th scope="col" aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {riegos.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                        Sin riegos registrados.
                      </div>
                    </td>
                  </tr>
                ) : riegos.map((r) => (
                  <tr key={r.id}>
                    <td><div className="cename">{r.lotName}</div></td>
                    <td>{r.method}</td>
                    <td className="mono">{r.durationMin} min</td>
                    <td className="mono">{r.waterM3.toLocaleString('es-CO')} m³</td>
                    <td className="muted mono" style={{ fontSize: 12 }}>{formatDate(r.startedOn)}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="ibtn" style={{ width: 28, height: 28, color: 'var(--redd)' }}
                        data-tip="Eliminar" disabled={pending}
                        onClick={() => removeIrrigation(r.id)}
                        aria-label={`Eliminar riego de ${r.lotName}`}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FormDrawer
        open={lotOpen}
        onClose={() => { setEditingLot(null); setLotOpen(false) }}
        title={editingLot ? 'Editar lote' : 'Nuevo lote'}
        footer={
          <button className="btn dark" disabled={pending} onClick={submitLot}>
            <Check size={15} />{editingLot ? 'Guardar cambios' : 'Crear lote'}
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

      <FormDrawer
        open={insumoOpen}
        onClose={() => setInsumoOpen(false)}
        title="Nuevo insumo"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitInsumo}>
            <Check size={15} />Crear insumo
          </button>
        }
      >
        <label className="flabel" htmlFor="ins-name">Nombre</label>
        <input id="ins-name" className="field" value={insumoForm.name}
          onChange={(e) => setInsumoForm({ ...insumoForm, name: e.target.value })}
          placeholder="Fertilizante 15-15-15" />

        <div className="fg2">
          <div>
            <div className="flabel">Tipo</div>
            <Select value={insumoForm.kind}
              onChange={(v) => setInsumoForm({ ...insumoForm, kind: v })}
              options={[...INSUMO_KINDS]} />
          </div>
          <div>
            <label className="flabel" htmlFor="ins-unit">Unidad</label>
            <input id="ins-unit" className="field" value={insumoForm.unit}
              onChange={(e) => setInsumoForm({ ...insumoForm, unit: e.target.value })}
              placeholder="kg" />
          </div>
        </div>

        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="ins-stock">Stock inicial</label>
            <input id="ins-stock" className="field" type="number" min={0}
              value={insumoForm.stockQty}
              onChange={(e) => setInsumoForm({ ...insumoForm, stockQty: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="ins-cost">Costo unitario (COP)</label>
            <input id="ins-cost" className="field" inputMode="numeric" value={insumoForm.unitCost}
              onChange={(e) => setInsumoForm({ ...insumoForm, unitCost: e.target.value })} />
          </div>
        </div>

        <label className="flabel" htmlFor="ins-supplier">Proveedor</label>
        <input id="ins-supplier" className="field" value={insumoForm.supplier}
          onChange={(e) => setInsumoForm({ ...insumoForm, supplier: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={maquinaOpen}
        onClose={() => setMaquinaOpen(false)}
        title="Nueva máquina"
        footer={
          <button className="btn dark" disabled={pending} onClick={submitMaquina}>
            <Check size={15} />Registrar máquina
          </button>
        }
      >
        <label className="flabel" htmlFor="maq-name">Nombre</label>
        <input id="maq-name" className="field" value={maquinaForm.name}
          onChange={(e) => setMaquinaForm({ ...maquinaForm, name: e.target.value })}
          placeholder="Tractor John Deere 5075E" />

        <div className="fg2">
          <div>
            <div className="flabel">Tipo</div>
            <Select value={maquinaForm.kind}
              onChange={(v) => setMaquinaForm({ ...maquinaForm, kind: v })}
              options={[...MAQUINA_KINDS]} />
          </div>
          <div>
            <label className="flabel" htmlFor="maq-hours">Horas de uso</label>
            <input id="maq-hours" className="field" type="number" min={0}
              value={maquinaForm.hoursUsed}
              onChange={(e) => setMaquinaForm({ ...maquinaForm, hoursUsed: e.target.value })} />
          </div>
        </div>

        <label className="flabel" htmlFor="maq-serial">N.º de serie</label>
        <input id="maq-serial" className="field" value={maquinaForm.serialNo}
          onChange={(e) => setMaquinaForm({ ...maquinaForm, serialNo: e.target.value })} />

        <label className="flabel" htmlFor="maq-notes">Notas</label>
        <textarea id="maq-notes" className="field" rows={3} value={maquinaForm.notes}
          onChange={(e) => setMaquinaForm({ ...maquinaForm, notes: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={treatmentOpen}
        onClose={() => setTreatmentOpen(false)}
        title="Registrar aplicación"
        footer={
          <button className="btn dark" disabled={pending || !treatmentForm.cycleId || !treatmentForm.product.trim()} onClick={submitTreatment}>
            <Check size={15} />Registrar
          </button>
        }
      >
        <label className="flabel">Ciclo</label>
        <Select value={treatmentForm.cycleId}
          onChange={(v) => setTreatmentForm({ ...treatmentForm, cycleId: v })}
          options={cycleOptions} />
        <div className="fg2">
          <div>
            <label className="flabel">Tipo</label>
            <Select value={treatmentForm.kind}
              onChange={(v) => setTreatmentForm({ ...treatmentForm, kind: v })}
              options={['Fertilización', 'Herbicida', 'Fungicida', 'Insecticida', 'Foliar', 'Otro']} />
          </div>
          <div>
            <label className="flabel" htmlFor="trt-on">Aplicada</label>
            <input id="trt-on" className="field" type="date" value={treatmentForm.appliedOn}
              onChange={(e) => setTreatmentForm({ ...treatmentForm, appliedOn: e.target.value })} />
          </div>
        </div>
        <label className="flabel" htmlFor="trt-product">Producto</label>
        <input id="trt-product" className="field" value={treatmentForm.product}
          placeholder="Nombre comercial"
          onChange={(e) => setTreatmentForm({ ...treatmentForm, product: e.target.value })} />
        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="trt-active">Ingrediente activo</label>
            <input id="trt-active" className="field" value={treatmentForm.activeIngredient}
              onChange={(e) => setTreatmentForm({ ...treatmentForm, activeIngredient: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="trt-dose">Dosis</label>
            <input id="trt-dose" className="field" value={treatmentForm.dose}
              placeholder="Ej: 2 L/ha"
              onChange={(e) => setTreatmentForm({ ...treatmentForm, dose: e.target.value })} />
          </div>
        </div>
        <label className="flabel" htmlFor="trt-withholding">Periodo de carencia (días)</label>
        <input id="trt-withholding" className="field" type="number" min={0} value={treatmentForm.withholdingDays}
          placeholder="Sin restricción"
          onChange={(e) => setTreatmentForm({ ...treatmentForm, withholdingDays: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={irrigationOpen}
        onClose={() => setIrrigationOpen(false)}
        title="Registrar riego"
        footer={
          <button className="btn dark" disabled={pending || !irrigationForm.lotId} onClick={submitIrrigation}>
            <Check size={15} />Registrar
          </button>
        }
      >
        <label className="flabel">Lote</label>
        <Select value={irrigationForm.lotId}
          onChange={(v) => setIrrigationForm({ ...irrigationForm, lotId: v })}
          options={lotes.map((l) => ({ value: l.id, label: l.name }))} />
        <div className="fg2">
          <div>
            <label className="flabel">Método</label>
            <Select value={irrigationForm.method}
              onChange={(v) => setIrrigationForm({ ...irrigationForm, method: v })}
              options={['Goteo', 'Aspersión', 'Gravedad', 'Pivote', 'Manual', 'Otro']} />
          </div>
          <div>
            <label className="flabel" htmlFor="irr-on">Fecha</label>
            <input id="irr-on" className="field" type="date" value={irrigationForm.startedOn}
              onChange={(e) => setIrrigationForm({ ...irrigationForm, startedOn: e.target.value })} />
          </div>
        </div>
        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="irr-dur">Duración (min)</label>
            <input id="irr-dur" className="field" type="number" min={0} value={irrigationForm.durationMin}
              onChange={(e) => setIrrigationForm({ ...irrigationForm, durationMin: e.target.value })} />
          </div>
          <div>
            <label className="flabel" htmlFor="irr-water">Agua (m³)</label>
            <input id="irr-water" className="field" type="number" min={0} step="0.1" value={irrigationForm.waterM3}
              onChange={(e) => setIrrigationForm({ ...irrigationForm, waterM3: e.target.value })} />
          </div>
        </div>
      </FormDrawer>
    </>
  )
}
