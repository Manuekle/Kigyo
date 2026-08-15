import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { scoped } from './shared'

/**
 * Imágenes diagnósticas por paciente.
 *
 * Profundidad de `pacientes` (patrón 45/65/66): permisos
 * `pacientes:read` / `pacientes:write`, sin módulo nuevo. El objeto vive en
 * el bucket privado `radiographs`; aquí se devuelve el registro y una URL
 * firmada de 60 segundos por imagen, emitida en el servidor tras el permiso.
 */

export interface ImageRow {
  id: string
  patientId: string
  patientName: string
  kind: string
  study: string
  takenOn: string
  mimeType: string | null
  sizeBytes: number
  notes: string
  url: string | null
}

export interface RadiografiasData {
  images: ImageRow[]
  canWrite: boolean
  bucket: string
  orgId: string
}

const SIGNED_TTL = 60 // segundos; al caducar, la pestaña se recarga

export async function getRadiografias(): Promise<RadiografiasData> {
  const member = await requirePermission('pacientes:read')
  const supabase = await createClient()

  const [imagesResult, patientsResult] = await Promise.all([
    scoped(supabase, member, 'patient_images')
      .select('id, patient_id, kind, study, taken_on, storage_path, mime_type, size_bytes, notes')
      .order('taken_on', { ascending: false })
      .limit(200),
    scoped(supabase, member, 'patients')
      .select('id, full_name')
      .is('deleted_at', null)
      .limit(2000),
  ])

  const patientName = new Map(
    ((patientsResult.data ?? []) as unknown as Array<{ id: string; full_name: string }>)
      .map((p) => [p.id, p.full_name]),
  )

  const rows = (imagesResult.data ?? []) as unknown as Array<{
    id: string; patient_id: string; kind: string; study: string; taken_on: string
    storage_path: string; mime_type: string | null; size_bytes: number; notes: string
  }>

  // URL firmada por fila. Si una falla, la imagen se muestra sin vista previa
  // en vez de tumbar la pestaña entera.
  const signed = await Promise.all(
    rows.map(async (row) => {
      const { data } = await supabase.storage
        .from('radiographs')
        .createSignedUrl(row.storage_path, SIGNED_TTL)
      return data?.signedUrl ?? null
    }),
  )

  return {
    images: rows.map((row, i) => ({
      id: row.id,
      patientId: row.patient_id,
      patientName: patientName.get(row.patient_id) ?? '—',
      kind: row.kind,
      study: row.study,
      takenOn: row.taken_on,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      notes: row.notes,
      url: signed[i],
    })),
    canWrite: can(member.permissions, 'pacientes:write'),
    bucket: 'radiographs',
    orgId: member.orgId,
  }
}
