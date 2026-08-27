'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  UserCheck, Check, Plus, Trash2, DollarSign, Users,
  PenLine, FileSpreadsheet, AlertTriangle,
} from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import DatePicker from '@/components/ui/DatePicker'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import TabBar from '@/components/ui/TabBar'
import FormDrawer from '@/components/ui/FormDrawer'
import { useApp } from '@/lib/context/AppContext'
import { useExport } from '@/lib/hooks/use-export'
// `CLASS_BOOKING_STATUSES` y `actualizarReserva` existen en el servidor y
// todavía no tienen control aquí: marcar asistencia necesita la lista de
// reservas por clase, y `getSocios` hoy solo devuelve los conteos. Es el
// siguiente paso de este módulo, no un olvido.
import {
  CHECKIN_METHODS, CLASS_STATUSES, MEMBER_STATUSES, PLAN_BILLINGS,
} from '@/lib/domain'
import { cop } from '@/lib/utils'
import type { ClaseRow, PlanRow, SocioRow, SociosData } from '@/server/queries/socios'
import {
  actualizarMembresia, createClase, createPlan, createSocio, deleteClase, deletePlan,
  deleteSocio, registrarEntrada, reservarClase, updateClase, updatePlan, updateSocio,
  venderMembresia,
} from '@/server/mutations/socios'

const DATE = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
const DATETIME = new Intl.DateTimeFormat('es-CO', {
  day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
})

function formatDate(iso: string | null): string {
  return iso ? DATE.format(new Date(`${iso}T00:00:00`)) : '—'
}

function formatWhen(iso: string): string {
  return DATETIME.format(new Date(iso))
}

function toCents(value: string): number {
  const n = Number(value.replace(/[^\d]/g, ''))
  return Number.isFinite(n) ? Math.round(n) * 100 : 0
}

function pesos(cents: number): string {
  return cop(Math.round(cents / 100))
}

const TODAY = () => new Date().toISOString().slice(0, 10)

/**
 * Cómo se lee el estado de una membresía en una fila.
 *
 * El número de días es el dato; esto es la frase. Se separa del cálculo (que
 * vive en `daysUntil`, en el servidor) porque la pantalla lo dice en tres
 * lugares y una tercera redacción distinta del mismo hecho es como se llega a
 * que la lista diga «vence hoy» y el detalle «vencida».
 */
function membershipLabel(socio: SocioRow): { text: string; tone: 'grn' | 'amb' | 'red' | 'neu' } {
  if (socio.daysLeft === null) return { text: 'Sin membresía', tone: 'neu' }
  if (socio.daysLeft < 0) return { text: `Venció hace ${Math.abs(socio.daysLeft)} d`, tone: 'red' }
  if (socio.daysLeft === 0) return { text: 'Vence hoy', tone: 'amb' }
  if (socio.daysLeft <= 7) return { text: `Vence en ${socio.daysLeft} d`, tone: 'amb' }
  return { text: `Al día · ${socio.daysLeft} d`, tone: 'grn' }
}

const EMPTY_SOCIO = {
  fullName: '', documentId: '', email: '', phone: '', birthDate: '',
  status: 'Activo', notes: '',
}
const EMPTY_PLAN = {
  name: '', description: '', price: '', billing: 'Mensual',
  credits: '', durationDays: '30', active: true,
}
const EMPTY_CLASE = {
  name: '', instructorId: '', startsAt: '', durationMin: '60',
  capacity: '20', room: '', status: 'Programada', notes: '',
}

export default function SociosPage({ data }: { data: SociosData }) {
  const { runExport, exporting } = useExport()
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState(data)
  const [tab, setTab] = useState('socios')
  const [statusFilter, setStatusFilter] = useState('Todos')

  const [socioOpen, setSocioOpen] = useState(false)
  const [socioForm, setSocioForm] = useState(EMPTY_SOCIO)
  const [editingSocio, setEditingSocio] = useState<string | null>(null)

  const [planOpen, setPlanOpen] = useState(false)
  const [planForm, setPlanForm] = useState(EMPTY_PLAN)
  const [editingPlan, setEditingPlan] = useState<string | null>(null)

  const [claseOpen, setClaseOpen] = useState(false)
  const [claseForm, setClaseForm] = useState(EMPTY_CLASE)
  const [editingClase, setEditingClase] = useState<string | null>(null)

  const [ventaOpen, setVentaOpen] = useState(false)
  const [ventaForm, setVentaForm] = useState({ memberId: '', planId: '', startsOn: '', paid: false })

  const [entradaOpen, setEntradaOpen] = useState(false)
  const [entradaForm, setEntradaForm] = useState({ memberId: '', classId: '', method: 'Manual' })

  const [reservaOpen, setReservaOpen] = useState(false)
  const [reservaForm, setReservaForm] = useState({ classId: '', memberId: '' })

  /**
   * Una sola forma de correr una escritura.
   *
   * Todas devuelven la pantalla entera —- ver `refreshed` en las mutaciones—,
   * así que el manejo es idéntico: reemplazar el estado o mostrar el motivo.
   * Escrito una vez para que ninguna de las once olvide el `addToast` del
   * fallo, que es el que convierte «no pasó nada» en una explicación.
   */
  function run(
    action: () => Promise<{ ok: true; data: SociosData } | { ok: false; error: string }>,
    okMessage: string,
    after?: () => void,
  ) {
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        addToast(result.error, 'err')
        return
      }
      setState(result.data)
      addToast(okMessage, 'ok')
      after?.()
    })
  }

  const socios = useMemo(
    () => (statusFilter === 'Todos'
      ? state.socios
      : state.socios.filter((s) => s.status === statusFilter)),
    [state.socios, statusFilter],
  )

  const activePlans = state.planes.filter((p) => p.active)
  const upcomingClasses = state.clases.filter((c) => c.status !== 'Cancelada')

  function exportRows() {
    if (tab === 'planes') {
      void runExport(state.planes.map((p) => ({
        Plan: p.name, Cobro: p.billing, Precio: pesos(p.priceCents),
        Créditos: p.credits ?? '', Días: p.durationDays,
        Activo: p.active ? 'Sí' : 'No', Vigentes: p.activeCount,
      })), 'planes', 'socios')
      return
    }
    if (tab === 'clases') {
      void runExport(state.clases.map((c) => ({
        Clase: c.name, Profesor: c.instructorName ?? '—', Inicio: formatWhen(c.startsAt),
        Minutos: c.durationMin, Cupo: c.capacity, Reservados: c.booked,
        'En espera': c.waiting, Asistieron: c.attended, Estado: c.status,
      })), 'clases', 'socios')
      return
    }
    void runExport(state.socios.map((s) => ({
      Código: s.code ?? '', Socio: s.fullName, Documento: s.documentId,
      Teléfono: s.phone, Correo: s.email ?? '', Estado: s.status,
      Plan: s.planName ?? '', Vence: s.endsOn ?? '',
      Pagado: s.paid ? 'Sí' : 'No', Desde: s.joinedOn,
    })), 'socios', 'socios')
  }

  function submitSocio() {
    const payload = {
      fullName: socioForm.fullName,
      documentId: socioForm.documentId,
      email: socioForm.email || null,
      phone: socioForm.phone,
      birthDate: socioForm.birthDate || null,
      status: socioForm.status as (typeof MEMBER_STATUSES)[number],
      notes: socioForm.notes,
    }
    run(
      () => (editingSocio
        ? updateSocio({ ...payload, id: editingSocio })
        : createSocio(payload)),
      editingSocio ? 'Socio actualizado' : 'Socio creado',
      () => { setSocioOpen(false); setSocioForm(EMPTY_SOCIO); setEditingSocio(null) },
    )
  }

  function submitPlan() {
    const payload = {
      name: planForm.name,
      description: planForm.description,
      priceCents: toCents(planForm.price),
      billing: planForm.billing as (typeof PLAN_BILLINGS)[number],
      credits: planForm.credits ? Number(planForm.credits) : null,
      durationDays: Number(planForm.durationDays) || 30,
      active: planForm.active,
    }
    run(
      () => (editingPlan ? updatePlan({ ...payload, id: editingPlan }) : createPlan(payload)),
      editingPlan ? 'Plan actualizado' : 'Plan creado',
      () => { setPlanOpen(false); setPlanForm(EMPTY_PLAN); setEditingPlan(null) },
    )
  }

  function submitClase() {
    const payload = {
      name: claseForm.name,
      instructorId: claseForm.instructorId || null,
      startsAt: claseForm.startsAt ? new Date(claseForm.startsAt).toISOString() : '',
      durationMin: Number(claseForm.durationMin) || 60,
      capacity: Number(claseForm.capacity) || 20,
      room: claseForm.room,
      status: claseForm.status as (typeof CLASS_STATUSES)[number],
      notes: claseForm.notes,
    }
    run(
      () => (editingClase ? updateClase({ ...payload, id: editingClase }) : createClase(payload)),
      editingClase ? 'Clase actualizada' : 'Clase creada',
      () => { setClaseOpen(false); setClaseForm(EMPTY_CLASE); setEditingClase(null) },
    )
  }

  function editSocio(s: SocioRow) {
    setSocioForm({
      fullName: s.fullName, documentId: s.documentId, email: s.email ?? '',
      phone: s.phone, birthDate: '', status: s.status, notes: s.notes,
    })
    setEditingSocio(s.id)
    setSocioOpen(true)
  }

  function editPlan(p: PlanRow) {
    setPlanForm({
      name: p.name, description: p.description, price: String(Math.round(p.priceCents / 100)),
      billing: p.billing, credits: p.credits === null ? '' : String(p.credits),
      durationDays: String(p.durationDays), active: p.active,
    })
    setEditingPlan(p.id)
    setPlanOpen(true)
  }

  function editClase(c: ClaseRow) {
    setClaseForm({
      name: c.name, instructorId: c.instructorId ?? '',
      startsAt: c.startsAt.slice(0, 16), durationMin: String(c.durationMin),
      capacity: String(c.capacity), room: c.room, status: c.status, notes: c.notes,
    })
    setEditingClase(c.id)
    setClaseOpen(true)
  }

  const socioOptions = state.socios.map((s) => ({
    value: s.id,
    label: `${s.fullName}${s.code ? ` · ${s.code}` : ''}`,
  }))

  return (
    <>
      <div className="g3" style={{ marginBottom: 16 }}>
        <div className="rise d1">
          <Stat icon={<UserCheck size={16} />} tone="blu" label="Socios activos"
            value={state.activos} sub={`${state.socios.length} en total`} />
        </div>
        <div className="rise d2">
          <Stat icon={<Check size={16} />} tone="grn" label="Al día"
            value={state.alDia}
            sub={state.activos > 0
              ? `${Math.round((state.alDia / state.activos) * 100)}% de los activos`
              : 'sin socios activos'} />
        </div>
        <div className="rise d3">
          <Stat icon={<AlertTriangle size={16} />} tone="amb" label="Vencen esta semana"
            value={state.porVencer} sub="membresías por renovar" />
        </div>
        <div className="rise d4">
          <Stat icon={<Users size={16} />} tone="vio" label="Entradas de hoy"
            value={state.entradasHoy} />
        </div>
      </div>

      <div className="card rise d2">
        <div className="chead">
          <TabBar
            items={[
              { key: 'socios', label: 'Socios' },
              { key: 'planes', label: 'Planes' },
              { key: 'clases', label: 'Clases' },
              { key: 'entradas', label: 'Entradas' },
            ]}
            value={tab}
            onChange={setTab}
          />
          {state.canWrite && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button disabled={exporting} aria-busy={exporting} className="btn" onClick={exportRows}>
                <FileSpreadsheet size={15} />Exportar
              </button>
              {tab === 'planes' ? (
                <button className="btn dark" disabled={pending} onClick={() => {
                  setPlanForm(EMPTY_PLAN); setEditingPlan(null); setPlanOpen(true)
                }}>
                  <Plus size={15} />Plan
                </button>
              ) : tab === 'clases' ? (
                <button className="btn dark" disabled={pending} onClick={() => {
                  setClaseForm({ ...EMPTY_CLASE, startsAt: `${TODAY()}T08:00` })
                  setEditingClase(null); setClaseOpen(true)
                }}>
                  <Plus size={15} />Clase
                </button>
              ) : tab === 'entradas' ? (
                <button className="btn dark" disabled={pending || state.socios.length === 0}
                  onClick={() => {
                    setEntradaForm({ memberId: state.socios[0]?.id ?? '', classId: '', method: 'Manual' })
                    setEntradaOpen(true)
                  }}>
                  <Plus size={15} />Entrada
                </button>
              ) : (
                <>
                  <button className="btn" disabled={pending || state.socios.length === 0 || activePlans.length === 0}
                    title={activePlans.length === 0 ? 'Crea un plan primero.' : undefined}
                    onClick={() => {
                      setVentaForm({
                        memberId: state.socios[0]?.id ?? '',
                        planId: activePlans[0]?.id ?? '',
                        startsOn: TODAY(),
                        paid: false,
                      })
                      setVentaOpen(true)
                    }}>
                    <DollarSign size={15} />Vender membresía
                  </button>
                  <button className="btn dark" disabled={pending} onClick={() => {
                    setSocioForm(EMPTY_SOCIO); setEditingSocio(null); setSocioOpen(true)
                  }}>
                    <Plus size={15} />Socio
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* ─── Socios ─────────────────────────────────────────────────── */}
        {tab === 'socios' && (
          <>
            <div className="cpad" style={{ paddingBottom: 0 }}>
              <div style={{ maxWidth: 220 }}>
                <Select value={statusFilter} onChange={setStatusFilter}
                  options={['Todos', ...MEMBER_STATUSES]} />
              </div>
            </div>

            <div className="tblwrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th scope="col">Socio</th>
                    <th scope="col">Contacto</th>
                    <th scope="col">Membresía</th>
                    <th scope="col">Vence</th>
                    <th scope="col">Pago</th>
                    <th scope="col">Estado</th>
                    {state.canWrite && <th scope="col" aria-label="Acciones" />}
                  </tr>
                </thead>
                <tbody>
                  {socios.length === 0 ? (
                    <tr>
                      <td colSpan={state.canWrite ? 7 : 6}>
                        <div className="dempty dempty-block">
                          {state.socios.length === 0
                            ? 'Todavía no hay socios. Crea el primero para empezar a vender membresías.'
                            : 'No hay socios con ese estado.'}
                        </div>
                      </td>
                    </tr>
                  ) : socios.map((s) => {
                    const membership = membershipLabel(s)
                    return (
                      <tr key={s.id}>
                        <td>
                          <div className="cename">{s.fullName}</div>
                          <div className="elsub mono">{s.code ?? '—'}</div>
                        </td>
                        <td>
                          <div>{s.phone || '—'}</div>
                          <div className="elsub">{s.email ?? s.documentId ?? '—'}</div>
                        </td>
                        <td>
                          <div>{s.planName ?? '—'}</div>
                          {s.creditsLeft !== null && (
                            <div className="elsub">{s.creditsLeft} entradas restantes</div>
                          )}
                        </td>
                        <td>
                          <Badge st={membership.text} tone={membership.tone} />
                          <div className="elsub">{formatDate(s.endsOn)}</div>
                        </td>
                        <td>
                          {/* Accionable, no decorativo. Cobrar en efectivo en
                              la recepción es el caso normal en este sector, y
                              una insignia que solo informa obliga a abrir otra
                              pantalla para hacer lo único que se quiere hacer
                              al mirarla. */}
                          {s.planName === null || s.subscriptionId === null ? (
                            '—'
                          ) : s.paid ? (
                            <Badge st="Pagada" tone="grn" />
                          ) : state.canWrite ? (
                            <button
                              className="btn"
                              style={{ padding: '4px 10px', fontSize: 12 }}
                              disabled={pending}
                              onClick={() => run(
                                () => actualizarMembresia({
                                  id: s.subscriptionId as string,
                                  status: 'Vigente',
                                  paid: true,
                                }),
                                `Pago de ${s.fullName} registrado`,
                              )}
                            >
                              Marcar pagada
                            </button>
                          ) : (
                            <Badge st="Pendiente" tone="amb" />
                          )}
                        </td>
                        <td><Badge st={s.status} /></td>
                        {state.canWrite && (
                          <td>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button className="ibtn" aria-label={`Registrar entrada de ${s.fullName}`}
                                disabled={pending}
                                onClick={() => run(
                                  () => registrarEntrada({ memberId: s.id, classId: null, method: 'Manual' }),
                                  'Entrada registrada',
                                )}>
                                <UserCheck size={15} />
                              </button>
                              <button className="ibtn" aria-label={`Editar ${s.fullName}`}
                                disabled={pending} onClick={() => editSocio(s)}>
                                <PenLine size={15} />
                              </button>
                              <button className="ibtn" aria-label={`Eliminar ${s.fullName}`}
                                disabled={pending}
                                onClick={() => run(() => deleteSocio(s.id), 'Socio eliminado')}>
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ─── Planes ─────────────────────────────────────────────────── */}
        {tab === 'planes' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Plan</th>
                  <th scope="col">Cobro</th>
                  <th scope="col">Precio</th>
                  <th scope="col">Vigencia</th>
                  <th scope="col">Vigentes</th>
                  <th scope="col">Estado</th>
                  {state.canWrite && <th scope="col" aria-label="Acciones" />}
                </tr>
              </thead>
              <tbody>
                {state.planes.length === 0 ? (
                  <tr>
                    <td colSpan={state.canWrite ? 7 : 6}>
                      <div className="dempty dempty-block">
                        Todavía no hay planes. Un plan es lo que el centro vende: una mensualidad,
                        un bono de clases o una sesión suelta.
                      </div>
                    </td>
                  </tr>
                ) : state.planes.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="cename">{p.name}</div>
                      <div className="elsub">{p.description || '—'}</div>
                    </td>
                    <td>
                      <Badge st={p.billing} tone="neu" />
                      {p.credits !== null && (
                        <div className="elsub">{p.credits} entradas</div>
                      )}
                    </td>
                    <td>{pesos(p.priceCents)}</td>
                    <td>{p.durationDays} días</td>
                    <td>{p.activeCount}</td>
                    <td><Badge st={p.active ? 'Activo' : 'Inactivo'} tone={p.active ? 'grn' : 'neu'} /></td>
                    {state.canWrite && (
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="ibtn" aria-label={`Editar ${p.name}`}
                            disabled={pending} onClick={() => editPlan(p)}>
                            <PenLine size={15} />
                          </button>
                          <button className="ibtn" aria-label={`Eliminar ${p.name}`}
                            disabled={pending}
                            onClick={() => run(() => deletePlan(p.id), 'Plan eliminado')}>
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
        )}

        {/* ─── Clases ─────────────────────────────────────────────────── */}
        {tab === 'clases' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Clase</th>
                  <th scope="col">Cuándo</th>
                  <th scope="col">Profesor</th>
                  <th scope="col">Cupo</th>
                  <th scope="col">Asistencia</th>
                  <th scope="col">Estado</th>
                  {state.canWrite && <th scope="col" aria-label="Acciones" />}
                </tr>
              </thead>
              <tbody>
                {state.clases.length === 0 ? (
                  <tr>
                    <td colSpan={state.canWrite ? 7 : 6}>
                      <div className="dempty dempty-block">
                        Todavía no hay clases programadas.
                      </div>
                    </td>
                  </tr>
                ) : state.clases.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="cename">{c.name}</div>
                      <div className="elsub">{c.room || 'Sin salón'}</div>
                    </td>
                    <td>
                      {formatWhen(c.startsAt)}
                      <div className="elsub">{c.durationMin} min</div>
                    </td>
                    <td>{c.instructorName ?? '—'}</td>
                    <td>
                      {c.booked} / {c.capacity}
                      {c.waiting > 0 && <div className="elsub">{c.waiting} en espera</div>}
                    </td>
                    <td>
                      {/* Reservaron contra vinieron. La diferencia es la razón
                          por la que las dos tablas están separadas. */}
                      {c.attended} de {c.booked}
                    </td>
                    <td><Badge st={c.status} /></td>
                    {state.canWrite && (
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <button className="ibtn" aria-label={`Reservar cupo en ${c.name}`}
                            disabled={pending || state.socios.length === 0}
                            onClick={() => {
                              setReservaForm({ classId: c.id, memberId: state.socios[0]?.id ?? '' })
                              setReservaOpen(true)
                            }}>
                            <Plus size={15} />
                          </button>
                          <button className="ibtn" aria-label={`Editar ${c.name}`}
                            disabled={pending} onClick={() => editClase(c)}>
                            <PenLine size={15} />
                          </button>
                          <button className="ibtn" aria-label={`Eliminar ${c.name}`}
                            disabled={pending}
                            onClick={() => run(() => deleteClase(c.id), 'Clase eliminada')}>
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
        )}

        {/* ─── Entradas ───────────────────────────────────────────────── */}
        {tab === 'entradas' && (
          <div className="tblwrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th scope="col">Socio</th>
                  <th scope="col">Cuándo</th>
                  <th scope="col">Clase</th>
                  <th scope="col">Registro</th>
                </tr>
              </thead>
              <tbody>
                {state.checkins.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="dempty dempty-block">
                        Todavía no hay entradas registradas.
                      </div>
                    </td>
                  </tr>
                ) : state.checkins.map((c) => (
                  <tr key={c.id}>
                    <td className="cename">{c.memberName}</td>
                    <td>{formatWhen(c.enteredAt)}</td>
                    <td>{c.className ?? 'Sala'}</td>
                    <td><Badge st={c.method} tone="neu" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Formularios ──────────────────────────────────────────────── */}

      <FormDrawer
        open={socioOpen}
        onClose={() => { setSocioOpen(false); setEditingSocio(null) }}
        title={editingSocio ? 'Editar socio' : 'Nuevo socio'}
        footer={
          <button className="btn dark" disabled={pending || !socioForm.fullName.trim()}
            onClick={submitSocio}>
            <Check size={15} />{editingSocio ? 'Guardar' : 'Crear socio'}
          </button>
        }
      >
        <label className="flabel" htmlFor="so-name">Nombre completo</label>
        <input id="so-name" className="field" value={socioForm.fullName} maxLength={160}
          onChange={(e) => setSocioForm({ ...socioForm, fullName: e.target.value })} />

        <label className="flabel" htmlFor="so-doc">Documento</label>
        <input id="so-doc" className="field" value={socioForm.documentId} maxLength={40}
          onChange={(e) => setSocioForm({ ...socioForm, documentId: e.target.value })} />

        <label className="flabel" htmlFor="so-phone">Teléfono</label>
        <input id="so-phone" className="field" value={socioForm.phone} maxLength={40}
          onChange={(e) => setSocioForm({ ...socioForm, phone: e.target.value })} />

        <label className="flabel" htmlFor="so-email">Correo</label>
        <input id="so-email" className="field" type="email" value={socioForm.email} maxLength={160}
          placeholder="Opcional"
          onChange={(e) => setSocioForm({ ...socioForm, email: e.target.value })} />

        <div className="flabel">Fecha de nacimiento</div>
        <DatePicker ariaLabel="Fecha de nacimiento" value={socioForm.birthDate}
          onChange={(v) => setSocioForm({ ...socioForm, birthDate: v })} />

        <label className="flabel" htmlFor="so-status">Estado</label>
        <Select
          id="so-status" value={socioForm.status}
          onChange={(v) => setSocioForm({ ...socioForm, status: v })}
          options={[...MEMBER_STATUSES]} />

        <label className="flabel" htmlFor="so-notes">Notas</label>
        <textarea id="so-notes" className="field" rows={3} value={socioForm.notes} maxLength={1000}
          onChange={(e) => setSocioForm({ ...socioForm, notes: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={planOpen}
        onClose={() => { setPlanOpen(false); setEditingPlan(null) }}
        title={editingPlan ? 'Editar plan' : 'Nuevo plan'}
        footer={
          <button className="btn dark" disabled={pending || !planForm.name.trim()}
            onClick={submitPlan}>
            <Check size={15} />{editingPlan ? 'Guardar' : 'Crear plan'}
          </button>
        }
      >
        <label className="flabel" htmlFor="pl-name">Nombre</label>
        <input id="pl-name" className="field" value={planForm.name} maxLength={120}
          placeholder="Mensualidad ilimitada"
          onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} />

        <label className="flabel" htmlFor="pl-billing">Cobro</label>
        <Select
          id="pl-billing" value={planForm.billing}
          onChange={(v) => setPlanForm({ ...planForm, billing: v })}
          options={[...PLAN_BILLINGS]} />

        <label className="flabel" htmlFor="pl-price">Precio</label>
        <input id="pl-price" className="field" inputMode="numeric" value={planForm.price}
          placeholder="120000"
          onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })} />

        {/* Solo para bonos: en una mensualidad el número no significa nada y el
            servidor lo descarta al guardar. Ocultarlo evita ofrecer un campo
            cuya respuesta se va a tirar. */}
        {planForm.billing === 'Bono' && (
          <>
            <label className="flabel" htmlFor="pl-credits">Entradas incluidas</label>
            <input id="pl-credits" className="field" inputMode="numeric" value={planForm.credits}
              placeholder="10"
              onChange={(e) => setPlanForm({ ...planForm, credits: e.target.value })} />
          </>
        )}

        <label className="flabel" htmlFor="pl-days">Vigencia en días</label>
        <input id="pl-days" className="field" inputMode="numeric" value={planForm.durationDays}
          onChange={(e) => setPlanForm({ ...planForm, durationDays: e.target.value })} />

        <label className="flabel" htmlFor="pl-desc">Descripción</label>
        <textarea id="pl-desc" className="field" rows={2} value={planForm.description} maxLength={500}
          onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={claseOpen}
        onClose={() => { setClaseOpen(false); setEditingClase(null) }}
        title={editingClase ? 'Editar clase' : 'Nueva clase'}
        footer={
          <button className="btn dark" disabled={pending || !claseForm.name.trim() || !claseForm.startsAt}
            onClick={submitClase}>
            <Check size={15} />{editingClase ? 'Guardar' : 'Crear clase'}
          </button>
        }
      >
        <label className="flabel" htmlFor="cl-name">Nombre</label>
        <input id="cl-name" className="field" value={claseForm.name} maxLength={120}
          placeholder="Spinning 6:00"
          onChange={(e) => setClaseForm({ ...claseForm, name: e.target.value })} />

        <div className="flabel">Fecha y hora</div>
        <DatePicker withTime ariaLabel="Fecha y hora" value={claseForm.startsAt}
          onChange={(v) => setClaseForm({ ...claseForm, startsAt: v })} />

        <label className="flabel" htmlFor="cl-instructor">Profesor</label>
        <Select
          id="cl-instructor" value={claseForm.instructorId}
          onChange={(v) => setClaseForm({ ...claseForm, instructorId: v })}
          options={[
            { value: '', label: 'Sin asignar' },
            ...state.roster.map((r) => ({ value: r.employeeId, label: r.fullName })),
          ]} />

        <label className="flabel" htmlFor="cl-duration">Duración en minutos</label>
        <input id="cl-duration" className="field" inputMode="numeric" value={claseForm.durationMin}
          onChange={(e) => setClaseForm({ ...claseForm, durationMin: e.target.value })} />

        <label className="flabel" htmlFor="cl-capacity">Cupo</label>
        <input id="cl-capacity" className="field" inputMode="numeric" value={claseForm.capacity}
          onChange={(e) => setClaseForm({ ...claseForm, capacity: e.target.value })} />

        <label className="flabel" htmlFor="cl-room">Salón</label>
        <input id="cl-room" className="field" value={claseForm.room} maxLength={80}
          onChange={(e) => setClaseForm({ ...claseForm, room: e.target.value })} />

        <label className="flabel" htmlFor="cl-status">Estado</label>
        <Select
          id="cl-status" value={claseForm.status}
          onChange={(v) => setClaseForm({ ...claseForm, status: v })}
          options={[...CLASS_STATUSES]} />
      </FormDrawer>

      <FormDrawer
        open={ventaOpen}
        onClose={() => setVentaOpen(false)}
        title="Vender membresía"
        footer={
          <button className="btn dark" disabled={pending || !ventaForm.memberId || !ventaForm.planId}
            onClick={() => run(
              () => venderMembresia(ventaForm),
              'Membresía registrada',
              () => setVentaOpen(false),
            )}>
            <Check size={15} />Registrar
          </button>
        }
      >
        <label className="flabel" htmlFor="ve-member">Socio</label>
        <Select
          id="ve-member" value={ventaForm.memberId}
          onChange={(v) => setVentaForm({ ...ventaForm, memberId: v })}
          options={socioOptions} />

        <label className="flabel" htmlFor="ve-plan">Plan</label>
        <Select
          id="ve-plan" value={ventaForm.planId}
          onChange={(v) => setVentaForm({ ...ventaForm, planId: v })}
          options={activePlans.map((p) => ({
            value: p.id,
            label: `${p.name} · ${pesos(p.priceCents)} · ${p.durationDays} d`,
          }))} />

        <div className="flabel">Inicio</div>
        <DatePicker ariaLabel="Inicio" value={ventaForm.startsOn}
          onChange={(v) => setVentaForm({ ...ventaForm, startsOn: v })} />

        {/* El precio y la fecha de vencimiento no se piden: los calcula el
            servidor desde el plan. Ver `venderMembresia`. */}
        <p className="psub" style={{ fontSize: 12.5 }}>
          El precio y el vencimiento salen del plan y quedan copiados en la membresía,
          así que subir el precio del plan mañana no cambia lo que este socio pagó hoy.
        </p>

        <label className="flabel" htmlFor="ve-paid">Pago</label>
        <Select
          id="ve-paid" value={ventaForm.paid ? 'si' : 'no'}
          onChange={(v) => setVentaForm({ ...ventaForm, paid: v === 'si' })}
          options={[
            { value: 'no', label: 'Pendiente' },
            { value: 'si', label: 'Pagada' },
          ]} />
      </FormDrawer>

      <FormDrawer
        open={entradaOpen}
        onClose={() => setEntradaOpen(false)}
        title="Registrar entrada"
        footer={
          <button className="btn dark" disabled={pending || !entradaForm.memberId}
            onClick={() => run(
              () => registrarEntrada({
                memberId: entradaForm.memberId,
                classId: entradaForm.classId || null,
                method: entradaForm.method as (typeof CHECKIN_METHODS)[number],
              }),
              'Entrada registrada',
              () => setEntradaOpen(false),
            )}>
            <Check size={15} />Registrar
          </button>
        }
      >
        <label className="flabel" htmlFor="en-member">Socio</label>
        <Select
          id="en-member" value={entradaForm.memberId}
          onChange={(v) => setEntradaForm({ ...entradaForm, memberId: v })}
          options={socioOptions} />

        <label className="flabel" htmlFor="en-class">Clase</label>
        <Select
          id="en-class" value={entradaForm.classId}
          onChange={(v) => setEntradaForm({ ...entradaForm, classId: v })}
          options={[
            { value: '', label: 'Sala — sin clase' },
            ...upcomingClasses.map((c) => ({
              value: c.id,
              label: `${c.name} · ${formatWhen(c.startsAt)}`,
            })),
          ]} />

        <label className="flabel" htmlFor="en-method">Cómo se registró</label>
        <Select
          id="en-method" value={entradaForm.method}
          onChange={(v) => setEntradaForm({ ...entradaForm, method: v })}
          options={[...CHECKIN_METHODS]} />

        <p className="psub" style={{ fontSize: 12.5 }}>
          La entrada se registra aunque la membresía esté vencida: quién entra lo decide
          el centro en la puerta, no el software. Si el plan es un bono, se descuenta una
          entrada.
        </p>
      </FormDrawer>

      <FormDrawer
        open={reservaOpen}
        onClose={() => setReservaOpen(false)}
        title="Reservar cupo"
        footer={
          <button className="btn dark" disabled={pending || !reservaForm.memberId || !reservaForm.classId}
            onClick={() => run(
              () => reservarClase(reservaForm),
              'Cupo reservado',
              () => setReservaOpen(false),
            )}>
            <Check size={15} />Reservar
          </button>
        }
      >
        <label className="flabel" htmlFor="re-member">Socio</label>
        <Select
          id="re-member" value={reservaForm.memberId}
          onChange={(v) => setReservaForm({ ...reservaForm, memberId: v })}
          options={socioOptions} />

        <p className="psub" style={{ fontSize: 12.5 }}>
          Si la clase ya llenó su cupo, la reserva entra en lista de espera.
        </p>
      </FormDrawer>
    </>
  )
}
