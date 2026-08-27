'use client'

import { useState, useTransition } from 'react'
import { Check, Plus, Trash2, PenLine } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import DatePicker from '@/components/ui/DatePicker'
import Select from '@/components/ui/Select'
import FormDrawer from '@/components/ui/FormDrawer'
import Odontograma from '@/components/ui/Odontograma'
import { useApp } from '@/lib/context/AppContext'
import {
  DENTAL_CHART_KINDS, DENTAL_LAB_STATUSES, DENTAL_LAB_WORK_TYPES,
  TOOTH_CONDITIONS, TOOTH_SURFACES, TREATMENT_ITEM_STATUSES, TREATMENT_PLAN_STATUSES,
  toothLabel,
} from '@/lib/domain'
import { cop } from '@/lib/utils'
import type { OdontologiaData, PlanRow } from '@/server/queries/odontologia'
import {
  agregarProcedimiento, anotarPieza, borrarHallazgo, borrarProcedimiento,
  cambiarEstadoLaboratorio, cambiarEstadoPlan, cambiarEstadoProcedimiento,
  crearOdontograma, crearPlan, enviarALaboratorio,
} from '@/server/mutations/odontologia'

/**
 * Las tres pantallas que un odontólogo necesita y una clínica general no.
 *
 * Viven dentro de `pacientes` —- misma ruta, mismo permiso, mismo módulo—- y se
 * muestran solo cuando el subsector es `salud-odontologia`. Es una decisión de
 * presentación: quien tiene `pacientes:read` puede llegar aquí igual si la
 * clínica cambia de idea sobre lo que es.
 *
 * Separado en su propio archivo porque el cliente de pacientes ya pasa de las
 * mil líneas y esto no lo mira nadie salvo una de las seis ramas de salud.
 */

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

/** Cuánto falta para que vuelva el trabajo del laboratorio, en una frase. */
function labLabel(daysLeft: number | null): { text: string; tone: 'grn' | 'amb' | 'red' | 'neu' } {
  if (daysLeft === null) return { text: 'Sin fecha', tone: 'neu' }
  if (daysLeft < 0) return { text: `Atrasado ${Math.abs(daysLeft)} d`, tone: 'red' }
  if (daysLeft <= 2) return { text: `Llega en ${daysLeft} d`, tone: 'amb' }
  return { text: `Llega en ${daysLeft} d`, tone: 'grn' }
}

const EMPTY_CHART = { patientId: '', kind: 'Inicial', chartedOn: '', professionalId: '', notes: '' }
const EMPTY_FINDING = { tooth: 0, surface: '', condition: 'Caries', notes: '' }
const EMPTY_PLAN = { patientId: '', professionalId: '', proposedOn: '', notes: '' }
const EMPTY_ITEM = { tooth: '', surface: '', procedure: '', productId: '', price: '' }
const EMPTY_LAB = {
  patientId: '', labName: '', workType: 'Corona', tooth: '',
  sentOn: '', dueOn: '', cost: '', notes: '',
}

const TODAY = () => new Date().toISOString().slice(0, 10)

interface Props {
  section: 'odontograma' | 'tratamientos' | 'labdental'
  data: OdontologiaData
  onData: (next: OdontologiaData) => void
  /** El directorio de pacientes de la pantalla padre, para los selectores. */
  pacientes: Array<{ id: string; fullName: string }>
  roster: Array<{ employeeId: string; fullName: string }>
  /** Procedimientos del catálogo, cuando la clínica lo usa. */
  catalogo: Array<{ id: string; name: string; priceCents: number }>
}

export default function Odontologia({
  section, data, onData, pacientes, roster, catalogo,
}: Props) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [chartId, setChartId] = useState<string | null>(data.charts[0]?.id ?? null)
  const [planId, setPlanId] = useState<string | null>(null)
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)

  const [chartOpen, setChartOpen] = useState(false)
  const [chartForm, setChartForm] = useState(EMPTY_CHART)
  const [findingOpen, setFindingOpen] = useState(false)
  const [findingForm, setFindingForm] = useState(EMPTY_FINDING)
  const [planOpen, setPlanOpen] = useState(false)
  const [planForm, setPlanForm] = useState(EMPTY_PLAN)
  const [itemOpen, setItemOpen] = useState(false)
  const [itemForm, setItemForm] = useState(EMPTY_ITEM)
  const [labOpen, setLabOpen] = useState(false)
  const [labForm, setLabForm] = useState(EMPTY_LAB)

  function run(
    action: () => Promise<{ ok: true; data: OdontologiaData } | { ok: false; error: string }>,
    okMessage: string,
    after?: () => void,
  ) {
    startTransition(async () => {
      const result = await action()
      if (!result.ok) { addToast(result.error, 'err'); return }
      onData(result.data)
      addToast(okMessage, 'ok')
      after?.()
    })
  }

  const chart = data.charts.find((c) => c.id === chartId) ?? data.charts[0] ?? null
  const plan: PlanRow | null = data.plans.find((p) => p.id === planId) ?? data.plans[0] ?? null

  const patientOptions = pacientes.map((p) => ({ value: p.id, label: p.fullName }))
  const staffOptions = [
    { value: '', label: 'Sin asignar' },
    ...roster.map((r) => ({ value: r.employeeId, label: r.fullName })),
  ]

  /* ─── Odontograma ────────────────────────────────────────────────── */

  if (section === 'odontograma') {
    return (
      <>
        <div className="cpad" style={{ paddingBottom: 0, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ minWidth: 260, flex: 1, maxWidth: 420 }}>
            <Select
              value={chart?.id ?? ''}
              onChange={(v) => { setChartId(v || null); setSelectedTooth(null) }}
              options={data.charts.length === 0
                ? [{ value: '', label: 'Todavía no hay odontogramas' }]
                : data.charts.map((c) => ({
                    value: c.id,
                    label: `${c.patientName} · ${c.kind} · ${formatDate(c.chartedOn)}`,
                  }))}
            />
          </div>
          {data.canWrite && (
            <button className="btn dark" disabled={pending || pacientes.length === 0}
              onClick={() => {
                setChartForm({ ...EMPTY_CHART, patientId: pacientes[0]?.id ?? '', chartedOn: TODAY() })
                setChartOpen(true)
              }}>
              <Plus size={15} />Odontograma
            </button>
          )}
        </div>

        {chart === null ? (
          <div className="cpad">
            <div className="dempty" style={{ padding: '32px 0', textAlign: 'center' }}>
              Todavía no hay odontogramas.
              <div style={{ fontSize: 12.5, color: 'var(--ink3)', marginTop: 8, maxWidth: 460, margin: '8px auto 0' }}>
                Uno por levantamiento, no uno que se sobrescribe: el de hoy tiene que seguir
                existiendo dentro de dos años, cuando haya que mostrar cómo estaba la boca
                antes de tocarla.
              </div>
            </div>
          </div>
        ) : (
          <>
            <Odontograma
              findings={chart.findings}
              selected={selectedTooth}
              onPick={data.canWrite ? (tooth) => {
                setSelectedTooth(tooth)
                const existing = chart.findings.find((f) => f.tooth === tooth && f.surface === null)
                setFindingForm({
                  tooth,
                  surface: '',
                  condition: existing?.condition ?? 'Caries',
                  notes: existing?.notes ?? '',
                })
                setFindingOpen(true)
              } : undefined}
            />

            {/* Sin leyenda el cuadro no se puede leer, y averiguar el
                significado pasando el cursor por cada pieza es no decirlo. */}
            <div className="odo-legend">
              <span><i className="odo-swatch" style={{ background: '#e5484d' }} />Por tratar</span>
              <span><i className="odo-swatch" style={{ background: '#3b82f6' }} />Tratado</span>
              <span><i className="odo-swatch" style={{ background: '#3ed694' }} />Sano</span>
              <span><i className="odo-swatch" style={{ background: '#f0bd5a' }} />Ortodoncia</span>
              <span><i className="odo-swatch" style={{ background: 'var(--ink3)' }} />Ausente</span>
            </div>

            <div className="tblwrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Pieza</th>
                    <th scope="col">Hallazgo</th>
                    <th scope="col">Nota</th>
                    {data.canWrite && <th scope="col" aria-label="Acciones" />}
                  </tr>
                </thead>
                <tbody>
                  {chart.findings.length === 0 ? (
                    <tr>
                      <td colSpan={data.canWrite ? 4 : 3}>
                        <div className="dempty" style={{ padding: '20px 0', textAlign: 'center' }}>
                          Sin hallazgos. Toca una pieza del cuadro para anotarla.
                        </div>
                      </td>
                    </tr>
                  ) : chart.findings.map((f) => (
                    <tr key={f.id}>
                      <td className="cename mono">{toothLabel(f.tooth, f.surface)}</td>
                      <td><Badge st={f.condition} /></td>
                      <td>{f.notes || '—'}</td>
                      {data.canWrite && (
                        <td>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button className="ibtn" aria-label={`Editar pieza ${f.tooth}`}
                              disabled={pending}
                              onClick={() => {
                                setFindingForm({
                                  tooth: f.tooth,
                                  surface: f.surface ?? '',
                                  condition: f.condition,
                                  notes: f.notes,
                                })
                                setFindingOpen(true)
                              }}>
                              <PenLine size={15} />
                            </button>
                            <button className="ibtn" aria-label={`Borrar hallazgo de la pieza ${f.tooth}`}
                              disabled={pending}
                              onClick={() => run(() => borrarHallazgo(f.id), 'Hallazgo borrado')}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <FormDrawer
          open={chartOpen}
          onClose={() => setChartOpen(false)}
          title="Nuevo odontograma"
          footer={
            <button className="btn dark" disabled={pending || !chartForm.patientId}
              onClick={() => run(
                () => crearOdontograma({
                  patientId: chartForm.patientId,
                  kind: chartForm.kind as (typeof DENTAL_CHART_KINDS)[number],
                  chartedOn: chartForm.chartedOn,
                  professionalId: chartForm.professionalId || null,
                  notes: chartForm.notes,
                }),
                'Odontograma creado',
                () => setChartOpen(false),
              )}>
              <Check size={15} />Crear
            </button>
          }
        >
          <label className="flabel">Paciente</label>
          <Select value={chartForm.patientId}
            onChange={(v) => setChartForm({ ...chartForm, patientId: v })}
            options={patientOptions} />

          <label className="flabel">Tipo</label>
          <Select value={chartForm.kind}
            onChange={(v) => setChartForm({ ...chartForm, kind: v })}
            options={[...DENTAL_CHART_KINDS]} />

          <div className="flabel">Fecha</div>
          <DatePicker ariaLabel="Fecha" value={chartForm.chartedOn}
            onChange={(v) => setChartForm({ ...chartForm, chartedOn: v })} />

          <label className="flabel">Profesional</label>
          <Select value={chartForm.professionalId}
            onChange={(v) => setChartForm({ ...chartForm, professionalId: v })}
            options={staffOptions} />

          <label className="flabel" htmlFor="od-notes">Notas</label>
          <textarea id="od-notes" className="field" rows={3} value={chartForm.notes} maxLength={1000}
            onChange={(e) => setChartForm({ ...chartForm, notes: e.target.value })} />
        </FormDrawer>

        <FormDrawer
          open={findingOpen}
          onClose={() => setFindingOpen(false)}
          title={`Pieza ${findingForm.tooth}`}
          footer={
            <button className="btn dark" disabled={pending || !chart}
              onClick={() => chart && run(
                () => anotarPieza({
                  chartId: chart.id,
                  tooth: findingForm.tooth,
                  surface: (findingForm.surface || null) as (typeof TOOTH_SURFACES)[number] | null,
                  condition: findingForm.condition as (typeof TOOTH_CONDITIONS)[number],
                  notes: findingForm.notes,
                }),
                'Pieza anotada',
                () => setFindingOpen(false),
              )}>
              <Check size={15} />Guardar
            </button>
          }
        >
          <label className="flabel">Cara</label>
          <Select value={findingForm.surface}
            onChange={(v) => setFindingForm({ ...findingForm, surface: v })}
            options={[
              { value: '', label: 'La pieza entera' },
              ...TOOTH_SURFACES.map((s) => ({ value: s, label: s })),
            ]} />
          <p className="psub" style={{ fontSize: 12.5 }}>
            Una caries está en una cara concreta y anotarla en «la pieza entera» pierde el
            dato con el que se planea el tratamiento. «Ausente» o «implante», en cambio, son
            de la pieza.
          </p>

          <label className="flabel">Hallazgo</label>
          <Select value={findingForm.condition}
            onChange={(v) => setFindingForm({ ...findingForm, condition: v })}
            options={[...TOOTH_CONDITIONS]} />

          <label className="flabel" htmlFor="fi-notes">Nota</label>
          <input id="fi-notes" className="field" value={findingForm.notes} maxLength={500}
            onChange={(e) => setFindingForm({ ...findingForm, notes: e.target.value })} />
        </FormDrawer>
      </>
    )
  }

  /* ─── Tratamientos ───────────────────────────────────────────────── */

  if (section === 'tratamientos') {
    return (
      <>
        <div className="cpad" style={{ paddingBottom: 0, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ minWidth: 260, flex: 1, maxWidth: 420 }}>
            <Select
              value={plan?.id ?? ''}
              onChange={(v) => setPlanId(v || null)}
              options={data.plans.length === 0
                ? [{ value: '', label: 'Todavía no hay planes' }]
                : data.plans.map((p) => ({
                    value: p.id,
                    label: `${p.code ?? '—'} · ${p.patientName} · ${p.status}`,
                  }))}
            />
          </div>
          {data.canWrite && (
            <button className="btn dark" disabled={pending || pacientes.length === 0}
              onClick={() => {
                setPlanForm({ ...EMPTY_PLAN, patientId: pacientes[0]?.id ?? '', proposedOn: TODAY() })
                setPlanOpen(true)
              }}>
              <Plus size={15} />Plan
            </button>
          )}
        </div>

        {plan === null ? (
          <div className="cpad">
            <div className="dempty" style={{ padding: '32px 0', textAlign: 'center' }}>
              Todavía no hay planes de tratamiento.
              <div style={{ fontSize: 12.5, color: 'var(--ink3)', marginTop: 8, maxWidth: 460, margin: '8px auto 0' }}>
                El odontograma dice cómo está la boca; el plan dice qué se va a hacer con
                ella, pieza por pieza y con precio.
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="cpad" style={{ paddingBottom: 0 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <Badge st={plan.status} />
                <span className="elsub">
                  {plan.patientName} · propuesto {formatDate(plan.proposedOn)}
                  {plan.acceptedOn ? ` · aceptado ${formatDate(plan.acceptedOn)}` : ''}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 15 }}>{pesos(plan.totalCents)}</span>
              </div>
              <p className="psub" style={{ fontSize: 12.5 }}>
                {plan.liveCount === 0
                  ? 'Sin procedimientos todavía.'
                  : `${plan.doneCount} de ${plan.liveCount} procedimientos hechos.`}
                {' '}El total suma solo lo que no está cancelado.
              </p>

              {data.canWrite && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  <div style={{ minWidth: 200 }}>
                    <Select value={plan.status}
                      onChange={(v) => run(
                        () => cambiarEstadoPlan({
                          id: plan.id,
                          status: v as (typeof TREATMENT_PLAN_STATUSES)[number],
                        }),
                        'Plan actualizado',
                      )}
                      options={[...TREATMENT_PLAN_STATUSES]} />
                  </div>
                  <button className="btn" disabled={pending} onClick={() => {
                    setItemForm(EMPTY_ITEM); setItemOpen(true)
                  }}>
                    <Plus size={15} />Procedimiento
                  </button>
                </div>
              )}
            </div>

            <div className="tblwrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Pieza</th>
                    <th scope="col">Procedimiento</th>
                    <th scope="col">Precio</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Hecho</th>
                    {data.canWrite && <th scope="col" aria-label="Acciones" />}
                  </tr>
                </thead>
                <tbody>
                  {plan.items.length === 0 ? (
                    <tr>
                      <td colSpan={data.canWrite ? 6 : 5}>
                        <div className="dempty" style={{ padding: '20px 0', textAlign: 'center' }}>
                          Sin procedimientos.
                        </div>
                      </td>
                    </tr>
                  ) : plan.items.map((i) => (
                    <tr key={i.id} style={i.status === 'Cancelado' ? { opacity: .5 } : undefined}>
                      <td className="mono">{toothLabel(i.tooth, i.surface)}</td>
                      <td>
                        <div className="cename">{i.procedure}</div>
                        {i.professionalName && <div className="elsub">{i.professionalName}</div>}
                      </td>
                      <td>{pesos(i.priceCents)}</td>
                      <td>
                        {data.canWrite ? (
                          <div style={{ maxWidth: 150 }}>
                            <Select value={i.status}
                              onChange={(v) => run(
                                () => cambiarEstadoProcedimiento({
                                  id: i.id,
                                  status: v as (typeof TREATMENT_ITEM_STATUSES)[number],
                                  professionalId: null,
                                }),
                                'Procedimiento actualizado',
                              )}
                              options={[...TREATMENT_ITEM_STATUSES]} />
                          </div>
                        ) : <Badge st={i.status} />}
                      </td>
                      <td>{formatDate(i.doneOn)}</td>
                      {data.canWrite && (
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="ibtn" aria-label={`Borrar ${i.procedure}`}
                              disabled={pending}
                              onClick={() => run(() => borrarProcedimiento(i.id), 'Procedimiento borrado')}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <FormDrawer
          open={planOpen}
          onClose={() => setPlanOpen(false)}
          title="Nuevo plan de tratamiento"
          footer={
            <button className="btn dark" disabled={pending || !planForm.patientId}
              onClick={() => run(
                () => crearPlan({
                  patientId: planForm.patientId,
                  professionalId: planForm.professionalId || null,
                  proposedOn: planForm.proposedOn,
                  notes: planForm.notes,
                }),
                'Plan creado',
                () => setPlanOpen(false),
              )}>
              <Check size={15} />Crear
            </button>
          }
        >
          <label className="flabel">Paciente</label>
          <Select value={planForm.patientId}
            onChange={(v) => setPlanForm({ ...planForm, patientId: v })}
            options={patientOptions} />

          <div className="flabel">Fecha de propuesta</div>
          <DatePicker ariaLabel="Fecha de propuesta" value={planForm.proposedOn}
            onChange={(v) => setPlanForm({ ...planForm, proposedOn: v })} />

          <label className="flabel">Profesional</label>
          <Select value={planForm.professionalId}
            onChange={(v) => setPlanForm({ ...planForm, professionalId: v })}
            options={staffOptions} />

          <label className="flabel" htmlFor="pl-notes">Notas</label>
          <textarea id="pl-notes" className="field" rows={3} value={planForm.notes} maxLength={1000}
            onChange={(e) => setPlanForm({ ...planForm, notes: e.target.value })} />
        </FormDrawer>

        <FormDrawer
          open={itemOpen}
          onClose={() => setItemOpen(false)}
          title="Agregar procedimiento"
          footer={
            <button className="btn dark"
              disabled={pending || !plan || !itemForm.procedure.trim()}
              onClick={() => plan && run(
                () => agregarProcedimiento({
                  planId: plan.id,
                  tooth: itemForm.tooth ? Number(itemForm.tooth) : null,
                  surface: (itemForm.surface || null) as (typeof TOOTH_SURFACES)[number] | null,
                  procedure: itemForm.procedure,
                  productId: itemForm.productId || null,
                  priceCents: toCents(itemForm.price),
                }),
                'Procedimiento agregado',
                () => setItemOpen(false),
              )}>
              <Check size={15} />Agregar
            </button>
          }
        >
          {catalogo.length > 0 && (
            <>
              <label className="flabel">Del catálogo</label>
              <Select value={itemForm.productId}
                onChange={(v) => {
                  const product = catalogo.find((c) => c.id === v)
                  setItemForm({
                    ...itemForm,
                    productId: v,
                    // Se rellenan, no se fuerzan: los dos siguen editables, y
                    // el servidor vuelve a leer el precio del catálogo cuando
                    // hay producto — ver `agregarProcedimiento`.
                    procedure: product?.name ?? itemForm.procedure,
                    price: product ? String(Math.round(product.priceCents / 100)) : itemForm.price,
                  })
                }}
                options={[
                  { value: '', label: 'Escribir a mano' },
                  ...catalogo.map((c) => ({
                    value: c.id,
                    label: `${c.name} · ${pesos(c.priceCents)}`,
                  })),
                ]} />
            </>
          )}

          <label className="flabel" htmlFor="it-proc">Procedimiento</label>
          <input id="it-proc" className="field" value={itemForm.procedure} maxLength={200}
            placeholder="Resina compuesta"
            onChange={(e) => setItemForm({ ...itemForm, procedure: e.target.value })} />

          <label className="flabel" htmlFor="it-tooth">Pieza (FDI)</label>
          <input id="it-tooth" className="field" inputMode="numeric" value={itemForm.tooth}
            placeholder="Vacío = boca completa"
            onChange={(e) => setItemForm({ ...itemForm, tooth: e.target.value.replace(/\D/g, '') })} />

          <label className="flabel">Cara</label>
          <Select value={itemForm.surface}
            onChange={(v) => setItemForm({ ...itemForm, surface: v })}
            options={[
              { value: '', label: 'Sin especificar' },
              ...TOOTH_SURFACES.map((s) => ({ value: s, label: s })),
            ]} />

          <label className="flabel" htmlFor="it-price">Precio</label>
          <input id="it-price" className="field" inputMode="numeric" value={itemForm.price}
            disabled={itemForm.productId !== ''}
            onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} />
          {itemForm.productId !== '' && (
            <p className="psub" style={{ fontSize: 12.5 }}>
              El precio sale del catálogo y queda copiado en la línea: subir la tarifa el mes
              que viene no cambia lo que se le prometió a este paciente hoy.
            </p>
          )}
        </FormDrawer>
      </>
    )
  }

  /* ─── Laboratorio dental ─────────────────────────────────────────── */

  return (
    <>
      {data.canWrite && (
        <div className="cpad" style={{ paddingBottom: 0 }}>
          <button className="btn dark" disabled={pending || pacientes.length === 0}
            onClick={() => {
              setLabForm({ ...EMPTY_LAB, patientId: pacientes[0]?.id ?? '', sentOn: TODAY() })
              setLabOpen(true)
            }}>
            <Plus size={15} />Enviar al laboratorio
          </button>
        </div>
      )}

      <div className="tblwrap">
        <table className="tbl">
          <thead>
            <tr>
              <th scope="col">Trabajo</th>
              <th scope="col">Paciente</th>
              <th scope="col">Laboratorio</th>
              <th scope="col">Enviado</th>
              <th scope="col">Entrega</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            {data.labOrders.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="dempty dempty-block">
                    Nada en el laboratorio.
                    <div style={{ fontSize: 12.5, color: 'var(--ink3)', marginTop: 8, maxWidth: 460, margin: '8px auto 0' }}>
                      Esto es el laboratorio dental —- una corona que se manda a fabricar y
                      tiene que volver—- y no el laboratorio clínico, que está en su propia
                      pestaña y sí pide resultados.
                    </div>
                  </div>
                </td>
              </tr>
            ) : data.labOrders.map((l) => {
              const label = labLabel(l.daysLeft)
              return (
                <tr key={l.id}>
                  <td>
                    <div className="cename">{l.workType}</div>
                    <div className="elsub mono">
                      {l.code ?? '—'}{l.tooth ? ` · pieza ${l.tooth}` : ''}
                    </div>
                  </td>
                  <td>{l.patientName}</td>
                  <td>{l.labName || '—'}</td>
                  <td>{formatDate(l.sentOn)}</td>
                  <td>
                    {formatDate(l.dueOn)}
                    {l.receivedOn === null
                      ? <div className="elsub"><Badge st={label.text} tone={label.tone} /></div>
                      : <div className="elsub">recibido {formatDate(l.receivedOn)}</div>}
                  </td>
                  <td>
                    {data.canWrite ? (
                      <div style={{ maxWidth: 150 }}>
                        <Select value={l.status}
                          onChange={(v) => run(
                            () => cambiarEstadoLaboratorio({
                              id: l.id,
                              status: v as (typeof DENTAL_LAB_STATUSES)[number],
                            }),
                            'Trabajo actualizado',
                          )}
                          options={[...DENTAL_LAB_STATUSES]} />
                      </div>
                    ) : <Badge st={l.status} />}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <FormDrawer
        open={labOpen}
        onClose={() => setLabOpen(false)}
        title="Enviar al laboratorio"
        footer={
          <button className="btn dark" disabled={pending || !labForm.patientId}
            onClick={() => run(
              () => enviarALaboratorio({
                patientId: labForm.patientId,
                labName: labForm.labName,
                workType: labForm.workType as (typeof DENTAL_LAB_WORK_TYPES)[number],
                tooth: labForm.tooth ? Number(labForm.tooth) : null,
                sentOn: labForm.sentOn,
                dueOn: labForm.dueOn || null,
                costCents: toCents(labForm.cost),
                notes: labForm.notes,
              }),
              'Envío registrado',
              () => setLabOpen(false),
            )}>
            <Check size={15} />Registrar
          </button>
        }
      >
        <label className="flabel">Paciente</label>
        <Select value={labForm.patientId}
          onChange={(v) => setLabForm({ ...labForm, patientId: v })}
          options={patientOptions} />

        <label className="flabel">Tipo de trabajo</label>
        <Select value={labForm.workType}
          onChange={(v) => setLabForm({ ...labForm, workType: v })}
          options={[...DENTAL_LAB_WORK_TYPES]} />

        <label className="flabel" htmlFor="lab-tooth">Pieza (FDI)</label>
        <input id="lab-tooth" className="field" inputMode="numeric" value={labForm.tooth}
          placeholder="Opcional"
          onChange={(e) => setLabForm({ ...labForm, tooth: e.target.value.replace(/\D/g, '') })} />

        <label className="flabel" htmlFor="lab-name">Laboratorio</label>
        <input id="lab-name" className="field" value={labForm.labName} maxLength={160}
          onChange={(e) => setLabForm({ ...labForm, labName: e.target.value })} />

        <div className="flabel">Enviado</div>
        <DatePicker ariaLabel="Enviado" value={labForm.sentOn}
          onChange={(v) => setLabForm({ ...labForm, sentOn: v })} />

        <div className="flabel">Fecha de entrega</div>
        <DatePicker ariaLabel="Fecha de entrega" value={labForm.dueOn}
          onChange={(v) => setLabForm({ ...labForm, dueOn: v })} />
        <p className="psub" style={{ fontSize: 12.5 }}>
          Es la fecha contra la que ya se le dio cita al paciente, así que es la que se
          vigila: un trabajo atrasado aparece marcado hasta que vuelve.
        </p>

        <label className="flabel" htmlFor="lab-cost">Costo</label>
        <input id="lab-cost" className="field" inputMode="numeric" value={labForm.cost}
          onChange={(e) => setLabForm({ ...labForm, cost: e.target.value })} />
      </FormDrawer>
    </>
  )
}
