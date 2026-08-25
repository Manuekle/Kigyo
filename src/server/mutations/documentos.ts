'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { DOCUMENT_KINDS, DOCUMENT_STATUSES, DOCUMENT_VISIBILITIES } from '@/lib/domain'
import { readRagText } from '@/lib/ai/rag'
import { belongsToOrg } from '@/server/queries/shared'
import { getDocumentos, type DocumentosData } from '@/server/queries/documentos'

export type DocumentoResult<T> = { ok: true; data: T } | { ok: false; error: string }

function fail(message: string): { ok: false; error: string } {
  return { ok: false, error: message }
}

const createSchema = z.object({
  name: z.string().trim().min(2, 'El nombre del documento es obligatorio.').max(200),
  kind: z.enum(DOCUMENT_KINDS).default('Otro'),
  folderId: z.uuid().nullable().default(null),
  department: z.string().trim().max(120).default(''),
  ownerId: z.uuid().nullable().default(null),
  tags: z.array(z.string().trim().max(40)).max(12).default([]),
  expiresOn: z.string().date().nullable().default(null),
  /**
   * Object key inside the private `documents` bucket, written by the browser
   * before this runs. Validated below rather than trusted: the key decides
   * which organization's folder the row points at.
   */
  storagePath: z.string().trim().max(400).nullable().default(null),
  mimeType: z.string().trim().max(160).nullable().default(null),
  sizeBytes: z.number().int().min(0).nullable().default(null),
  /**
   * Privada por defecto, igual que la columna. Quien sube decide después si
   * el archivo es de la empresa; nada se comparte por no haberlo pensado.
   */
  visibility: z.enum(DOCUMENT_VISIBILITIES).default('Privada'),
})

/**
 * The bucket's policies pin the first path segment to an organization the
 * caller belongs to, so an upload cannot land in someone else's folder. This
 * re-checks it on the row: a key from a *different* organization the caller
 * also belongs to would pass the storage policy but attach the wrong file to
 * this organization's document.
 */
function keyBelongsToOrg(storagePath: string | null, orgId: string): boolean {
  if (!storagePath) return true
  return storagePath.startsWith(`${orgId}/`)
}

export async function createDocumento(
  input: z.input<typeof createSchema>,
): Promise<DocumentoResult<DocumentosData>> {
  try {
    const member = await requirePermission('documentos:write')
    const parsed = createSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    if (!keyBelongsToOrg(parsed.data.storagePath, member.orgId)) {
      return fail('El archivo no pertenece a tu organización.')
    }

    const supabase = await createClient()
    if (!(await belongsToOrg(supabase, 'employees', parsed.data.ownerId, member.orgId))) {
      return fail('Esa persona no está en el equipo de tu organización.')
    }

    const { error } = await supabase.from('documents').insert({
      org_id: member.orgId,
      name: parsed.data.name,
      kind: parsed.data.kind,
      folder_id: parsed.data.folderId,
      department: parsed.data.department,
      owner_id: parsed.data.ownerId,
      status: 'Vigente',
      tags: parsed.data.tags,
      storage_path: parsed.data.storagePath,
      mime_type: parsed.data.mimeType,
      size_bytes: parsed.data.sizeBytes,
      expires_on: parsed.data.expiresOn,
      visibility: parsed.data.visibility,
      // `uploaded_by` lo pone la base de datos con `auth.uid()`: es un hecho
      // sobre la sesión, no un dato que el cliente pueda enviar.
    })

    if (error) {
      console.error('[documentos] createDocumento', error)
      return fail('No se pudo registrar el documento.')
    }

    revalidatePath('/dashboard/documentos')
    return { ok: true, data: await getDocumentos() }
  } catch {
    return fail('No tienes permiso para gestionar documentos.')
  }
}

const updateSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2).max(200).optional(),
  kind: z.enum(DOCUMENT_KINDS).optional(),
  folderId: z.uuid().nullable().optional(),
  status: z.enum(DOCUMENT_STATUSES).optional(),
  tags: z.array(z.string().trim().max(40)).max(12).optional(),
  expiresOn: z.string().date().nullable().optional(),
  visibility: z.enum(DOCUMENT_VISIBILITIES).optional(),
})

export async function updateDocumento(
  input: z.input<typeof updateSchema>,
): Promise<DocumentoResult<DocumentosData>> {
  try {
    const member = await requirePermission('documentos:write')
    const parsed = updateSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const patch: {
      name?: string
      kind?: (typeof DOCUMENT_KINDS)[number]
      folder_id?: string | null
      status?: (typeof DOCUMENT_STATUSES)[number]
      tags?: string[]
      expires_on?: string | null
      visibility?: (typeof DOCUMENT_VISIBILITIES)[number]
      uploaded_by?: string
    } = {}
    if (parsed.data.name !== undefined) patch.name = parsed.data.name
    if (parsed.data.kind !== undefined) patch.kind = parsed.data.kind
    if (parsed.data.folderId !== undefined) patch.folder_id = parsed.data.folderId
    if (parsed.data.status !== undefined) patch.status = parsed.data.status
    if (parsed.data.tags !== undefined) patch.tags = parsed.data.tags
    if (parsed.data.expiresOn !== undefined) patch.expires_on = parsed.data.expiresOn
    // Cambiar la visibilidad es un UPDATE como cualquier otro, y la política
    // RESTRICTIVE de la tabla ya decide quién puede tocar esta fila: si el
    // documento no es tuyo, el UPDATE no encuentra nada que actualizar.
    if (parsed.data.visibility !== undefined) patch.visibility = parsed.data.visibility

    if (Object.keys(patch).length === 0) {
      return { ok: true, data: await getDocumentos() }
    }

    const supabase = await createClient()

    // Un documento anterior a la privacidad puede no tener `uploaded_by`.
    // Marcarlo privado sin más lo dejaría sin nadie que lo vea, incluida la
    // persona que acaba de marcarlo, así que quien lo hace lo adopta. Solo
    // cuando el campo está vacío: no reescribe un hecho, rellena un hueco.
    if (patch.visibility === 'Privada') {
      const { data: current } = await supabase
        .from('documents')
        .select('uploaded_by')
        .eq('id', parsed.data.id)
        .maybeSingle()
      if (current && current.uploaded_by === null) {
        Object.assign(patch, { uploaded_by: member.userId })
      }
    }

    const { error } = await supabase
      .from('documents')
      .update(patch)
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[documentos] updateDocumento', error)
      return fail('No se pudo actualizar el documento.')
    }

    // A name change alters the indexed snapshot (`metadata.title`), so mark
    // chunks stale until the next index run (plan 7.6). Status/folder/expiry
    // do not touch the indexed content and must not invalidate it.
    if (parsed.data.name !== undefined) {
      await supabase
        .from('document_chunks')
        .update({ status: 'stale' })
        .eq('document_id', parsed.data.id)
        .eq('org_id', member.orgId)
        .neq('status', 'stale')
    }

    revalidatePath('/dashboard/documentos')
    return { ok: true, data: await getDocumentos() }
  } catch {
    return fail('No tienes permiso para gestionar documentos.')
  }
}

/**
 * Soft delete.
 *
 * The stored object is left in place: `signature_requests.document_id` points
 * here, and a signed contract whose file has been erased is not a record of
 * anything. Purging objects is a retention job, not a click.
 */
export async function deleteDocumento(id: string): Promise<DocumentoResult<DocumentosData>> {
  try {
    const member = await requirePermission('documentos:write')
    if (!z.uuid().safeParse(id).success) return fail('Documento desconocido.')

    const supabase = await createClient()
    const { error } = await supabase
      .from('documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[documentos] deleteDocumento', error)
      return fail('No se pudo eliminar el documento.')
    }

    revalidatePath('/dashboard/documentos')
    return { ok: true, data: await getDocumentos() }
  } catch {
    return fail('No tienes permiso para gestionar documentos.')
  }
}

/**
 * Short-lived signed URL for a download.
 *
 * The bucket is private, so this is the only way to read an object — and it is
 * minted *after* `documentos:read` has been checked and after the row has been
 * confirmed to belong to the caller's organization. Handing out the object key
 * alone would be useless; handing out a public URL would be the leak the
 * private bucket exists to prevent.
 */
export async function documentoDownloadUrl(
  id: string,
): Promise<{ ok: true; url: string; name: string } | { ok: false; error: string }> {
  try {
    const member = await requirePermission('documentos:read')
    if (!z.uuid().safeParse(id).success) return fail('Documento desconocido.')

    const supabase = await createClient()
    const { data: doc } = await supabase
      .from('documents')
      .select('name, storage_path')
      .eq('id', id)
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!doc) return fail('Documento desconocido.')
    if (!doc.storage_path) return fail('Este registro no tiene un archivo adjunto.')

    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.storage_path, 60)

    if (error || !data) {
      console.error('[documentos] documentoDownloadUrl', error)
      return fail('No se pudo generar el enlace de descarga.')
    }

    return { ok: true, url: data.signedUrl, name: doc.name }
  } catch {
    return fail('No tienes permiso para ver este documento.')
  }
}

/**
 * Todo lo que hace falta para enseñar un archivo, sea del formato que sea.
 *
 * El repositorio acepta cualquier cosa, así que la vista previa tiene que
 * responder algo para cualquier cosa. Hay tres respuestas posibles y esta
 * función decide cuál:
 *
 *   · `url`  — el navegador ya sabe pintarlo: imagen, PDF, audio, vídeo,
 *              texto plano. Se manda la URL firmada y se muestra tal cual.
 *   · `text` — el navegador no, pero el servidor sí sabe leerlo: Word, Excel.
 *              Se extrae aquí con el mismo código que alimenta a la IA, en vez
 *              de mandar un megabyte de librería al navegador para repetirlo.
 *   · `none` — un .zip, un plano, un binario sin extractor. Se dice que no hay
 *              vista previa y se ofrece la descarga; inventar una previsualización
 *              vacía sería peor que admitirlo.
 *
 * El texto extraído se recorta: la vista previa es para reconocer el archivo,
 * no para leerlo entero, y ese trabajo ya lo hace el visor de cada quien.
 */
const PREVIEW_TEXT_LIMIT = 20_000
/** Extraer texto de un archivo enorme por una previsualización no compensa. */
const PREVIEW_EXTRACT_MAX_BYTES = 8 * 1024 * 1024

export interface DocumentoPreview {
  mode: 'url' | 'text' | 'none'
  name: string
  mimeType: string | null
  sizeBytes: number | null
  url?: string
  text?: string
  /** True cuando el texto se cortó en `PREVIEW_TEXT_LIMIT`. */
  truncated?: boolean
}

/** MIME/ext que el cliente pinta con Extend o media nativa vía URL firmada. */
function clientViewerUrl(mimeType: string | null, storagePath: string): boolean {
  const mime = mimeType?.split(';', 1)[0].trim().toLowerCase() ?? ''
  const ext = storagePath.split('.').pop()?.toLowerCase() ?? ''
  if (
    mime.startsWith('image/') ||
    mime.startsWith('video/') ||
    mime.startsWith('audio/') ||
    mime === 'application/pdf' ||
    mime === 'application/msword' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mime === 'application/vnd.ms-excel' ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.ms-powerpoint' ||
    mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    mime === 'text/csv' ||
    mime === 'text/tab-separated-values' ||
    mime === 'application/csv'
  ) {
    return true
  }
  return ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'tsv', 'odt', 'ods', 'odp'].includes(ext)
}

function browserRenders(mimeType: string | null): boolean {
  if (!mimeType) return false
  mimeType = mimeType.split(';', 1)[0].trim().toLowerCase()
  // CSV/office van por URL firmada al viewer Extend, no por iframe genérico.
  if (
    mimeType === 'text/csv' ||
    mimeType === 'text/tab-separated-values' ||
    mimeType.includes('wordprocessingml') ||
    mimeType.includes('spreadsheetml') ||
    mimeType.includes('presentationml') ||
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.ms-powerpoint'
  ) {
    return false
  }
  return (
    mimeType.startsWith('image/') ||
    mimeType.startsWith('video/') ||
    mimeType.startsWith('audio/') ||
    mimeType.startsWith('text/') ||
    mimeType === 'application/pdf' ||
    mimeType === 'application/json' ||
    mimeType === 'application/xml'
  )
}

export async function documentoPreview(
  id: string,
): Promise<{ ok: true; data: DocumentoPreview } | { ok: false; error: string }> {
  try {
    await requirePermission('documentos:read')
    if (!z.uuid().safeParse(id).success) return fail('Documento desconocido.')

    const supabase = await createClient()
    // Sin `org_id` en el filtro a propósito: las políticas de la tabla ya
    // deciden qué filas existen para esta persona, y ahora eso incluye la
    // visibilidad. Repetir el filtro aquí no añadía nada y sugería que la
    // comprobación vivía en el cliente.
    const { data: doc } = await supabase
      .from('documents')
      .select('name, storage_path, mime_type, size_bytes')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle()

    if (!doc) return fail('Documento desconocido.')

    const base = {
      name: doc.name,
      mimeType: doc.mime_type,
      sizeBytes: doc.size_bytes === null ? null : Number(doc.size_bytes),
    }

    if (!doc.storage_path) {
      return { ok: true, data: { ...base, mode: 'none' } }
    }

    if (browserRenders(doc.mime_type) || clientViewerUrl(doc.mime_type, doc.storage_path)) {
      // Cinco minutos: firma corta caduca a mitad de lectura en viewers Extend.
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.storage_path, 300, { download: false })
      if (error || !data) return fail('No se pudo abrir el archivo.')
      return { ok: true, data: { ...base, mode: 'url', url: data.signedUrl } }
    }

    if (base.sizeBytes !== null && base.sizeBytes > PREVIEW_EXTRACT_MAX_BYTES) {
      return { ok: true, data: { ...base, mode: 'none' } }
    }

    const text = await readRagText(supabase, doc.storage_path, doc.mime_type)
    if (!text) return { ok: true, data: { ...base, mode: 'none' } }

    return {
      ok: true,
      data: {
        ...base,
        mode: 'text',
        text: text.slice(0, PREVIEW_TEXT_LIMIT),
        truncated: text.length > PREVIEW_TEXT_LIMIT,
      },
    }
  } catch {
    return fail('No tienes permiso para ver este documento.')
  }
}

const folderSchema = z.object({
  name: z.string().trim().min(2, 'El nombre de la carpeta es obligatorio.').max(80),
})

export async function createCarpeta(
  input: z.input<typeof folderSchema>,
): Promise<DocumentoResult<DocumentosData>> {
  try {
    const member = await requirePermission('documentos:write')
    const parsed = folderSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    // `(org_id, key)` is unique and the key is derived from the name, so two
    // folders called "Actas" and "actas" collide rather than both existing.
    const key = parsed.data.name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)

    if (!key) return fail('Usa al menos una letra o un número en el nombre.')

    const supabase = await createClient()
    const { count } = await supabase
      .from('document_folders')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', member.orgId)

    const { error } = await supabase.from('document_folders').insert({
      org_id: member.orgId,
      key,
      name: parsed.data.name,
      position: count ?? 0,
    })

    if (error) {
      console.error('[documentos] createCarpeta', error)
      if (error.code === '23505') return fail('Ya existe una carpeta con ese nombre.')
      return fail('No se pudo crear la carpeta.')
    }

    revalidatePath('/dashboard/documentos')
    return { ok: true, data: await getDocumentos() }
  } catch {
    return fail('No tienes permiso para gestionar documentos.')
  }
}

const SHARE_ACCESSES = ['Propietario', 'Puede editar', 'Puede ver'] as const

export type DocumentShare = {
  id: string
  employeeId: string | null
  employeeName: string | null
  email: string | null
  access: (typeof SHARE_ACCESSES)[number]
  createdAt: string
}

export async function fetchDocumentShares(
  documentId: string,
): Promise<DocumentoResult<DocumentShare[]>> {
  try {
    await requirePermission('documentos:read')
    if (!z.uuid().safeParse(documentId).success) return fail('Documento desconocido.')

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('document_shares')
      .select('id, employee_id, email, access, created_at, employees ( full_name )')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[documentos] fetchDocumentShares', error)
      return fail('No se pudieron cargar los accesos al documento.')
    }

    return {
      ok: true,
      data: (data ?? []).map((row) => ({
        id: row.id,
        employeeId: row.employee_id,
        employeeName: row.employees?.full_name ?? null,
        email: row.email,
        access: row.access,
        createdAt: row.created_at,
      })),
    }
  } catch {
    return fail('No tienes permiso para ver este documento.')
  }
}

const shareSchema = z
  .object({
    documentId: z.uuid(),
    employeeId: z.uuid().nullable().default(null),
    email: z.email().trim().toLowerCase().nullable().default(null),
    access: z.enum(SHARE_ACCESSES),
  })
  .refine((v) => (v.employeeId === null) !== (v.email === null), {
    message: 'Indica una persona o un correo, no ambos.',
  })

export async function shareDocument(
  input: z.input<typeof shareSchema>,
): Promise<DocumentoResult<DocumentShare[]>> {
  try {
    const member = await requirePermission('documentos:write')
    const parsed = shareSchema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Datos inválidos.')

    const supabase = await createClient()
    if (!(await belongsToOrg(supabase, 'employees', parsed.data.employeeId, member.orgId))) {
      return fail('Esa persona no está en el equipo de tu organización.')
    }

    const { error } = await supabase.from('document_shares').insert({
      document_id: parsed.data.documentId,
      employee_id: parsed.data.employeeId,
      email: parsed.data.email,
      access: parsed.data.access,
    })

    if (error) {
      console.error('[documentos] shareDocument', error)
      if (error.code === '23505') return fail('Ya está compartido con esa persona/correo.')
      return fail('No se pudo compartir el documento.')
    }

    revalidatePath('/dashboard/documentos')
    const fresh = await fetchDocumentShares(parsed.data.documentId)
    if (!fresh.ok) return fresh
    return { ok: true, data: fresh.data }
  } catch {
    return fail('No tienes permiso para gestionar documentos.')
  }
}

export async function revokeShare(id: string): Promise<DocumentoResult<DocumentShare[]>> {
  try {
    await requirePermission('documentos:write')
    if (!z.uuid().safeParse(id).success) return fail('Ese acceso no existe.')

    const supabase = await createClient()
    const { data: share } = await supabase
      .from('document_shares')
      .select('document_id')
      .eq('id', id)
      .maybeSingle()

    if (!share) return fail('Ese acceso no existe.')

    const { error } = await supabase.from('document_shares').delete().eq('id', id)

    if (error) {
      console.error('[documentos] revokeShare', error)
      return fail('No se pudo revocar el acceso.')
    }

    revalidatePath('/dashboard/documentos')
    const fresh = await fetchDocumentShares(share.document_id)
    if (!fresh.ok) return fresh
    return { ok: true, data: fresh.data }
  } catch {
    return fail('No tienes permiso para gestionar documentos.')
  }
}
