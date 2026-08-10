'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { DOCUMENT_KINDS, DOCUMENT_STATUSES } from '@/lib/domain'
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
    } = {}
    if (parsed.data.name !== undefined) patch.name = parsed.data.name
    if (parsed.data.kind !== undefined) patch.kind = parsed.data.kind
    if (parsed.data.folderId !== undefined) patch.folder_id = parsed.data.folderId
    if (parsed.data.status !== undefined) patch.status = parsed.data.status
    if (parsed.data.tags !== undefined) patch.tags = parsed.data.tags
    if (parsed.data.expiresOn !== undefined) patch.expires_on = parsed.data.expiresOn

    if (Object.keys(patch).length === 0) {
      return { ok: true, data: await getDocumentos() }
    }

    const supabase = await createClient()
    const { error } = await supabase
      .from('documents')
      .update(patch)
      .eq('id', parsed.data.id)
      .eq('org_id', member.orgId)

    if (error) {
      console.error('[documentos] updateDocumento', error)
      return fail('No se pudo actualizar el documento.')
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
