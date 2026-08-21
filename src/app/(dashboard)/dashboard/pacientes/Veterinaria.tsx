'use client'

import { forwardRef, useImperativeHandle, useState, useTransition } from 'react'
import { Check, Heart, Plus, Trash2 } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import DatePicker from '@/components/ui/DatePicker'
import Select from '@/components/ui/Select'
import FormDrawer from '@/components/ui/FormDrawer'
import { useApp } from '@/lib/context/AppContext'
import { useConfirm } from '@/lib/context/ConfirmContext'
import type { StatusTone } from '@/lib/types'
import type { VeterinariaData } from '@/server/queries/veterinaria'
import {
  addHospitalization, addHospNote, addPet, addVaccine, deletePet,
  deleteVaccine, dischargeHospitalization, setPetStatus,
} from '@/server/mutations/veterinaria'

/**
 * Las tres pantallas que una veterinaria necesita y una clínica general no.
 *
 * Viven dentro de `pacientes` — misma ruta, mismo permiso, mismo módulo — y
 * se muestran solo cuando el subsector es `salud-veterinaria`. Es
 * presentación, no acceso. Separado en su propio archivo porque el cliente de
 * pacientes ya pasa de las mil líneas.
 */

const DATE = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

function formatDate(iso: string | null): string {
  return iso ? DATE.format(new Date(`${iso}T00:00:00`)) : '—'
}

const TODAY = () => new Date().toISOString().slice(0, 10)

const PET_TONE: Record<string, StatusTone> = {
  Activo: 'grn',
  Fallecido: 'neu',
  Adoptado: 'blu',
  Perdido: 'red',
}

const SPECIES = ['Perro', 'Gato', 'Ave', 'Equino', 'Bovino', 'Exótico', 'Otro'] as const

const EMPTY_PET: {
  ownerId: string
  name: string
  species: (typeof SPECIES)[number]
  breed: string
  sex: 'Macho' | 'Hembra' | 'Desconocido'
  birthDate: string
  weightKg: string
  microchip: string
  notes: string
} = {
  ownerId: '', name: '', species: 'Perro', breed: '', sex: 'Desconocido',
  birthDate: '', weightKg: '', microchip: '', notes: '',
}

const EMPTY_VACCINE = {
  petId: '', vaccine: '', administeredOn: TODAY(), nextDueOn: '', batch: '', notes: '',
}

const EMPTY_HOSP = { petId: '', reason: '', kennel: '', notes: '' }

export type VeterinariaSection = 'mascotas' | 'vacunas' | 'hospitalizacion'

interface Props {
  section: VeterinariaSection
  data: VeterinariaData
  onData: (next: VeterinariaData) => void
  /** El directorio de pacientes (propietarios) de la pantalla padre. */
  pacientes: Array<{ id: string; fullName: string }>
}

export interface VeterinariaHandle {
  open: (section: VeterinariaSection) => void
}

const Veterinaria = forwardRef<VeterinariaHandle, Props>(function Veterinaria({ section, data, onData, pacientes }, ref) {
  const { addToast } = useApp()
  const confirm = useConfirm()
  const [pending, startTransition] = useTransition()

  const [petOpen, setPetOpen] = useState(false)
  const [petForm, setPetForm] = useState(EMPTY_PET)
  const [vaccineOpen, setVaccineOpen] = useState(false)
  const [vaccineForm, setVaccineForm] = useState(EMPTY_VACCINE)
  const [hospOpen, setHospOpen] = useState(false)
  const [hospForm, setHospForm] = useState(EMPTY_HOSP)
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')

  useImperativeHandle(ref, () => ({
    open: (next) => {
      if (next === 'mascotas') setPetOpen(true)
      if (next === 'vacunas') setVaccineOpen(true)
      if (next === 'hospitalizacion') setHospOpen(true)
    },
  }), [])

  const ownerOpts = pacientes.map((p) => ({ value: p.id, label: p.fullName }))
  const petOpts = data.pets.map((p) => ({ value: p.id, label: p.name }))

  function submitPet() {
    startTransition(async () => {
      const result = await addPet(petForm)
      if (!result.ok) { addToast(result.error, 'err'); return }
      onData(result.data)
      setPetOpen(false)
      setPetForm(EMPTY_PET)
      addToast('Mascota registrada', 'ok')
    })
  }

  function submitVaccine() {
    startTransition(async () => {
      const result = await addVaccine(vaccineForm)
      if (!result.ok) { addToast(result.error, 'err'); return }
      onData(result.data)
      setVaccineOpen(false)
      setVaccineForm(EMPTY_VACCINE)
      addToast('Vacuna registrada', 'ok')
    })
  }

  function submitHosp() {
    startTransition(async () => {
      const result = await addHospitalization(hospForm)
      if (!result.ok) { addToast(result.error, 'err'); return }
      onData(result.data)
      setHospOpen(false)
      setHospForm(EMPTY_HOSP)
      addToast('Ingreso registrado', 'ok')
    })
  }

  function changePetStatus(id: string, status: string) {
    startTransition(async () => {
      const result = await setPetStatus(id, status)
      if (!result.ok) { addToast(result.error, 'err'); return }
      onData(result.data)
      addToast('Estado actualizado', 'ok')
    })
  }

  async function removePet(id: string) {
    if (!(await confirm({ title: '¿Eliminar esta mascota con sus vacunas e historial de hospitalización?', tone: 'danger' }))) return
    startTransition(async () => {
      const result = await deletePet(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      onData(result.data)
      addToast('Mascota eliminada', 'ok')
    })
  }

  function removeVaccine(id: string) {
    startTransition(async () => {
      const result = await deleteVaccine(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      onData(result.data)
      addToast('Vacuna eliminada', 'ok')
    })
  }

  async function discharge(id: string, status: 'Alta' | 'Fallecido') {
    if (!(await confirm({ title: status === 'Alta' ? '¿Dar de alta a esta mascota?' : '¿Registrar el fallecimiento?', tone: 'danger' }))) return
    startTransition(async () => {
      const result = await dischargeHospitalization(id, status)
      if (!result.ok) { addToast(result.error, 'err'); return }
      onData(result.data)
      addToast(status === 'Alta' ? 'Alta registrada' : 'Fallecimiento registrado', 'ok')
    })
  }

  function submitNote(id: string) {
    startTransition(async () => {
      const result = await addHospNote(id, noteText)
      if (!result.ok) { addToast(result.error, 'err'); return }
      onData(result.data)
      setNoteFor(null)
      setNoteText('')
      addToast('Nota guardada', 'ok')
    })
  }

  return (
    <>
      {section === 'mascotas' && (
        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Mascota</th>
                <th scope="col">Propietario</th>
                <th scope="col">Especie</th>
                <th scope="col">Peso</th>
                <th scope="col">Refuerzos</th>
                <th scope="col">Estado</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {data.pets.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      Sin mascotas. Registra la primera con su propietario.
                    </div>
                  </td>
                </tr>
              ) : data.pets.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="cename">{p.name}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {p.breed || p.species}
                      {p.microchip ? ` · chip ${p.microchip}` : ''}
                    </div>
                  </td>
                  <td>{p.ownerName}</td>
                  <td>{p.species}</td>
                  <td className="mono">{p.weightKg !== null ? `${p.weightKg} kg` : '—'}</td>
                  <td>
                    {p.dueVaccines > 0 ? (
                      <Badge st={`${p.dueVaccines} por vencer`} tone="amb" />
                    ) : (
                      <span className="muted">Al día</span>
                    )}
                  </td>
                  <td><Badge st={p.status} tone={PET_TONE[p.status]} /></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {p.status === 'Activo' && (
                      <>
                        <button
                          className="ibtn"
                          style={{ width: 28, height: 28 }}
                          data-tip="Marcar adoptado"
                          disabled={pending}
                          onClick={() => changePetStatus(p.id, 'Adoptado')}
                          aria-label={`Marcar ${p.name} como adoptado`}
                        >
                          <Check size={13} />
                        </button>
                        <button
                          className="ibtn"
                          style={{ width: 28, height: 28, color: 'var(--redd)' }}
                          data-tip="Marcar perdido"
                          disabled={pending}
                          onClick={() => changePetStatus(p.id, 'Perdido')}
                          aria-label={`Marcar ${p.name} como perdido`}
                        >
                          <Heart size={13} />
                        </button>
                      </>
                    )}
                    <button
                      className="ibtn"
                      style={{ width: 28, height: 28, color: 'var(--redd)' }}
                      data-tip="Eliminar"
                      disabled={pending}
                      onClick={() => removePet(p.id)}
                      aria-label={`Eliminar ${p.name}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {section === 'vacunas' && (
        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Mascota</th>
                <th scope="col">Vacuna</th>
                <th scope="col">Aplicada</th>
                <th scope="col">Próxima</th>
                <th scope="col">Lote</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {data.vaccines.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      Sin vacunas registradas.
                    </div>
                  </td>
                </tr>
              ) : data.vaccines.map((v) => (
                <tr key={v.id}>
                  <td><div className="cename">{v.petName}</div></td>
                  <td>{v.vaccine}</td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{formatDate(v.administeredOn)}</td>
                  <td>
                    {v.nextDueOn ? (
                      <Badge st={v.nextDueOn <= TODAY() ? 'Vencida' : formatDate(v.nextDueOn)} tone={v.nextDueOn <= TODAY() ? 'red' : 'neu'} />
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{v.batch || '—'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      className="ibtn"
                      style={{ width: 28, height: 28, color: 'var(--redd)' }}
                      data-tip="Eliminar"
                      disabled={pending}
                      onClick={() => removeVaccine(v.id)}
                      aria-label={`Eliminar la vacuna de ${v.petName}`}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {section === 'hospitalizacion' && (
        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Mascota</th>
                <th scope="col">Propietario</th>
                <th scope="col">Ingreso</th>
                <th scope="col">Motivo</th>
                <th scope="col">Estado</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {data.hospitalizations.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      Sin hospitalizaciones.
                    </div>
                  </td>
                </tr>
              ) : data.hospitalizations.map((h) => (
                <tr key={h.id}>
                  <td>
                    <div className="cename">{h.petName}</div>
                    {h.kennel && <div className="muted" style={{ fontSize: 12 }}>Jaula {h.kennel}</div>}
                  </td>
                  <td>{h.ownerName}</td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{formatDate(h.admissionOn.slice(0, 10))}</td>
                  <td className="muted" style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.reason}
                  </td>
                  <td><Badge st={h.status} tone={h.status === 'Hospitalizado' ? 'amb' : h.status === 'Alta' ? 'grn' : 'red'} /></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {h.status === 'Hospitalizado' && (
                      <>
                        <button
                          className="ibtn"
                          style={{ width: 28, height: 28 }}
                          data-tip="Nota de evolución"
                          disabled={pending}
                          onClick={() => { setNoteFor(h.id); setNoteText('') }}
                          aria-label={`Anotar evolución de ${h.petName}`}
                        >
                          <Plus size={13} />
                        </button>
                        <button
                          className="ibtn"
                          style={{ width: 28, height: 28, color: 'var(--grnd)' }}
                          data-tip="Dar de alta"
                          disabled={pending}
                          onClick={() => discharge(h.id, 'Alta')}
                          aria-label={`Dar de alta a ${h.petName}`}
                        >
                          <Check size={13} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <FormDrawer
        open={petOpen}
        onClose={() => setPetOpen(false)}
        title="Nueva mascota"
        footer={
          <button className="btn dark" disabled={pending || !petForm.ownerId || !petForm.name.trim()} onClick={submitPet}>
            <Check size={15} />Registrar
          </button>
        }
      >
        <label className="flabel" htmlFor="vet-pet-owner">Propietario</label>
        <Select
          id="vet-pet-owner"
          value={petForm.ownerId}
          onChange={(v) => setPetForm({ ...petForm, ownerId: v })}
          options={[{ value: '', label: 'Elige…' }, ...ownerOpts]}
        />
        <label className="flabel" htmlFor="vet-pet-name">Nombre</label>
        <input id="vet-pet-name" className="field" value={petForm.name}
          onChange={(e) => setPetForm({ ...petForm, name: e.target.value })} />
        <div className="fg2">
          <div>
            <label className="flabel">Especie</label>
            <Select
              value={petForm.species}
              onChange={(v) => setPetForm({ ...petForm, species: v as never })}
              options={SPECIES.map((s) => ({ value: s, label: s }))}
            />
          </div>
          <div>
            <label className="flabel" htmlFor="vet-pet-breed">Raza</label>
            <input id="vet-pet-breed" className="field" value={petForm.breed}
              onChange={(e) => setPetForm({ ...petForm, breed: e.target.value })} />
          </div>
        </div>
        <div className="fg2">
          <div>
            <div className="flabel">Nacimiento</div>
            <DatePicker ariaLabel="Nacimiento" value={petForm.birthDate}
              onChange={(v) => setPetForm({ ...petForm, birthDate: v })} />
          </div>
          <div>
            <label className="flabel" htmlFor="vet-pet-weight">Peso (kg)</label>
            <input id="vet-pet-weight" className="field" type="number" min={0} step="0.01" value={petForm.weightKg}
              onChange={(e) => setPetForm({ ...petForm, weightKg: e.target.value })} />
          </div>
        </div>
        <label className="flabel" htmlFor="vet-pet-chip">Microchip</label>
        <input id="vet-pet-chip" className="field" value={petForm.microchip}
          onChange={(e) => setPetForm({ ...petForm, microchip: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={vaccineOpen}
        onClose={() => setVaccineOpen(false)}
        title="Registrar vacuna"
        footer={
          <button className="btn dark" disabled={pending || !vaccineForm.petId || !vaccineForm.vaccine.trim()} onClick={submitVaccine}>
            <Check size={15} />Registrar
          </button>
        }
      >
        <label className="flabel">Mascota</label>
        <Select
          value={vaccineForm.petId}
          onChange={(v) => setVaccineForm({ ...vaccineForm, petId: v })}
          options={[{ value: '', label: 'Elige…' }, ...petOpts]}
        />
        <label className="flabel" htmlFor="vet-vac-name">Vacuna</label>
        <input id="vet-vac-name" className="field" value={vaccineForm.vaccine}
          placeholder="Ej: Rabia, Polivalente, Moquillo"
          onChange={(e) => setVaccineForm({ ...vaccineForm, vaccine: e.target.value })} />
        <div className="fg2">
          <div>
            <div className="flabel">Aplicada</div>
            <DatePicker ariaLabel="Aplicada" value={vaccineForm.administeredOn}
              onChange={(v) => setVaccineForm({ ...vaccineForm, administeredOn: v })} />
          </div>
          <div>
            <div className="flabel">Próxima dosis</div>
            <DatePicker ariaLabel="Próxima dosis" value={vaccineForm.nextDueOn}
              onChange={(v) => setVaccineForm({ ...vaccineForm, nextDueOn: v })} />
          </div>
        </div>
        <label className="flabel" htmlFor="vet-vac-batch">Lote</label>
        <input id="vet-vac-batch" className="field" value={vaccineForm.batch}
          onChange={(e) => setVaccineForm({ ...vaccineForm, batch: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={hospOpen}
        onClose={() => setHospOpen(false)}
        title="Nuevo ingreso"
        footer={
          <button className="btn dark" disabled={pending || !hospForm.petId || hospForm.reason.trim().length < 2} onClick={submitHosp}>
            <Check size={15} />Ingresar
          </button>
        }
      >
        <label className="flabel">Mascota</label>
        <Select
          value={hospForm.petId}
          onChange={(v) => setHospForm({ ...hospForm, petId: v })}
          options={[{ value: '', label: 'Elige…' }, ...petOpts]}
        />
        <label className="flabel" htmlFor="vet-hosp-reason">Motivo</label>
        <input id="vet-hosp-reason" className="field" value={hospForm.reason}
          placeholder="Ej: postoperatorio de esterilización"
          onChange={(e) => setHospForm({ ...hospForm, reason: e.target.value })} />
        <div className="fg2">
          <div>
            <label className="flabel" htmlFor="vet-hosp-kennel">Jaula</label>
            <input id="vet-hosp-kennel" className="field" value={hospForm.kennel}
              onChange={(e) => setHospForm({ ...hospForm, kennel: e.target.value })} />
          </div>
        </div>
        <label className="flabel" htmlFor="vet-hosp-notes">Nota inicial</label>
        <textarea id="vet-hosp-notes" className="field" rows={3} value={hospForm.notes}
          onChange={(e) => setHospForm({ ...hospForm, notes: e.target.value })} />
      </FormDrawer>

      <FormDrawer
        open={noteFor !== null}
        onClose={() => setNoteFor(null)}
        title="Nota de evolución"
        footer={
          <button className="btn dark" disabled={pending || !noteText.trim()} onClick={() => noteFor && submitNote(noteFor)}>
            <Check size={15} />Guardar
          </button>
        }
      >
        <textarea className="field" rows={4} value={noteText}
          placeholder="Temperatura, alimentación, comportamiento…"
          onChange={(e) => setNoteText(e.target.value)} />
        {noteFor && (
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            {data.hospitalizations.find((h) => h.id === noteFor)?.notes.length ?? 0} notas previas
          </div>
        )}
      </FormDrawer>
    </>
  )
})

export default Veterinaria
