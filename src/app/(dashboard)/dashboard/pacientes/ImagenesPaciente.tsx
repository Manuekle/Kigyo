'use client'

import { useRef, useState, useTransition } from 'react'
import { Trash2, Upload, X } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import DatePicker from '@/components/ui/DatePicker'
import Select from '@/components/ui/Select'
import { useApp } from '@/lib/context/AppContext'
import { createClient } from '@/lib/supabase/client'
import type { RadiografiasData } from '@/server/queries/radiografias'
import { addImagen, deleteImagen } from '@/server/mutations/radiografias'

/**
 * La galería de imágenes diagnósticas de la historia clínica.
 *
 * El navegador sube directo al bucket privado — la política de storage es la
 * que autoriza — y solo después se crea el registro; una transferencia
 * fallida no deja una fila apuntando a la nada. Las URL firmadas duran 60
 * segundos: si la pestaña se abrió hace rato, el modal pide recargar.
 */

const KIND_TONE: Record<string, string> = {
  Radiografía: 'blu',
  Ultrasonido: 'vio',
  Tomografía: 'amb',
  Fotografía: 'grn',
  Otro: 'neu',
}

/** Refleja `allowed_mime_types` del bucket radiographs. */
const ACCEPT = ['image/png', 'image/jpeg', 'image/webp', 'application/dicom', 'image/dicom-rle'].join(',')

const MAX_BYTES = 20 * 1024 * 1024

const DATE = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function objectKey(orgId: string, fileName: string): string {
  const safe = fileName.replace(/[^\w.\-]+/g, '_').slice(-80)
  return `${orgId}/${crypto.randomUUID()}-${safe}`
}

const EMPTY_FORM = {
  patientId: '', kind: 'Radiografía', study: '', takenOn: '',
  notes: '',
}

interface Props {
  data: RadiografiasData
  onData: (next: RadiografiasData) => void
  /** El directorio de pacientes, para el selector. */
  pacientes: Array<{ id: string; fullName: string }>
}

export default function ImagenesPaciente({ data, onData, pacientes }: Props) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({ ...EMPTY_FORM, takenOn: new Date().toISOString().slice(0, 10) })
  const [filter, setFilter] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  const patientOpts = pacientes.map((p) => ({ value: p.id, label: p.fullName }))
  const visible = data.images.filter((i) => !filter || i.patientId === filter)
  const open = data.images.find((i) => i.id === openId) ?? null

  async function handleFile(file: File) {
    if (file.size > MAX_BYTES) {
      addToast('El estudio supera el límite de 20 MB.', 'err')
      return
    }

    setUploading(true)
    const key = objectKey(data.orgId, file.name)

    const supabase = createClient()
    const { error } = await supabase.storage
      .from(data.bucket)
      .upload(key, file, { contentType: file.type || undefined, upsert: false })

    if (error) {
      setUploading(false)
      console.error('[radiografias] upload', error)
      addToast('No se pudo subir el archivo.', 'err')
      return
    }

    startTransition(async () => {
      const result = await addImagen({
        patientId: form.patientId,
        kind: form.kind as never,
        study: form.study,
        takenOn: form.takenOn,
        storagePath: key,
        mimeType: file.type || null,
        sizeBytes: file.size,
        notes: form.notes,
      })
      setUploading(false)
      if (!result.ok) { addToast(result.error, 'err'); return }
      onData(result.data)
      setForm({ ...EMPTY_FORM, takenOn: new Date().toISOString().slice(0, 10) })
      addToast('Imagen registrada', 'ok')
    })
  }

  function remove(id: string) {
    if (!window.confirm('¿Eliminar este registro? El archivo se conserva en el bucket.')) return
    startTransition(async () => {
      const result = await deleteImagen(id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      onData(result.data)
      setOpenId(null)
      addToast('Imagen eliminada', 'ok')
    })
  }

  return (
    <>
      {data.canWrite && (
        <div className="cpad" style={{ paddingBottom: 0 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 220px', minWidth: 170 }}>
              <div className="flabel" style={{ marginTop: 0 }}>Paciente</div>
              <Select
                value={form.patientId}
                onChange={(v) => setForm((f) => ({ ...f, patientId: v }))}
                options={[{ value: '', label: 'Elige…' }, ...patientOpts]}
              />
            </div>
            <div style={{ flex: '0 1 150px', minWidth: 120 }}>
              <div className="flabel">Tipo</div>
              <Select
                value={form.kind}
                onChange={(v) => setForm((f) => ({ ...f, kind: v }))}
                options={['Radiografía', 'Ultrasonido', 'Tomografía', 'Fotografía', 'Otro'].map((k) => ({
                  value: k,
                  label: k,
                }))}
              />
            </div>
            <div style={{ flex: '1 1 220px', minWidth: 170 }}>
              <div className="flabel">Estudio</div>
              <input
                className="field"
                value={form.study}
                placeholder="Ej: tórax PA, abdomen lateral"
                onChange={(e) => setForm((f) => ({ ...f, study: e.target.value }))}
              />
            </div>
            <div style={{ flex: '0 1 140px', minWidth: 110 }}>
              <div className="flabel">Tomada</div>
              <DatePicker
                ariaLabel="Tomada"
                value={form.takenOn}
                onChange={(v) => setForm((f) => ({ ...f, takenOn: v }))}
              />
            </div>
            <button
              className="btn dark"
              disabled={pending || uploading || !form.patientId || form.study.trim().length < 2}
              aria-busy={pending || uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={14} />{uploading ? 'Subiendo…' : 'Subir imagen'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleFile(file)
                e.target.value = ''
              }}
            />
          </div>
        </div>
      )}

      <div className="cpad" style={{ paddingBottom: 4 }}>
        <Select
          value={filter}
          onChange={setFilter}
          options={[{ value: '', label: 'Todos los pacientes' }, ...patientOpts]}
        />
      </div>

      {visible.length === 0 ? (
        <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
          Sin imágenes. Sube el primer estudio.
        </div>
      ) : (
        <div className="cpad" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
          {visible.map((img) => (
            <button
              key={img.id}
              className="rxthumb"
              onClick={() => setOpenId(img.id)}
              aria-label={`Abrir ${img.study} de ${img.patientName}`}
            >
              {img.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img.url} alt={img.study} loading="lazy" />
              ) : (
                <div className="rxthumb-empty" />
              )}
              <div className="rxthumb-meta">
                <span className="mono">{DATE.format(new Date(`${img.takenOn}T00:00:00`))}</span>
                <span>{img.study}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="rxviewer" role="dialog" aria-modal="true" aria-label={open.study}>
          <div className="rxviewer-scrim" onClick={() => setOpenId(null)} />
          <div className="rxviewer-panel">
            <div className="rxviewer-head">
              <div>
                <div className="cename">{open.study}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {open.patientName} · {DATE.format(new Date(`${open.takenOn}T00:00:00`))} · {humanSize(open.sizeBytes)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Badge st={open.kind} tone={KIND_TONE[open.kind] as never} />
                {data.canWrite && (
                  <button
                    className="ibtn"
                    style={{ width: 28, height: 28, color: 'var(--redd)' }}
                    data-tip="Eliminar registro"
                    disabled={pending}
                    onClick={() => remove(open.id)}
                    aria-label={`Eliminar ${open.study}`}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <button className="ibtn" style={{ width: 28, height: 28 }} onClick={() => setOpenId(null)} aria-label="Cerrar">
                  <X size={14} />
                </button>
              </div>
            </div>
            {open.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="rxviewer-img" src={open.url} alt={open.study} />
            ) : (
              <div className="dempty" style={{ padding: 40, textAlign: 'center' }}>
                La URL firmada caducó. Recarga la página para ver el estudio.
              </div>
            )}
            {open.notes && <div className="muted" style={{ fontSize: 12.5, padding: '10px 16px' }}>{open.notes}</div>}
          </div>
        </div>
      )}
    </>
  )
}
