import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { pageRange, rosterFor, totalOf, type Page, type RosterEntry } from './shared'

/**
 * The document repository, read through RLS.
 *
 * The screen used to hold eight documents in `useState` and simulate uploads:
 * "Subir" picked a filename at random from a three-item list, ran three
 * `setTimeout`s to animate a progress bar, and appended a row. No file was
 * ever transferred. Each row also carried an `ai` verdict — "Sin riesgos",
 * "Cláusula a revisar" — typed into the fixture.
 *
 * `documents` has `storage_path`, `mime_type` and `size_bytes` pointing into
 * the private `documents` bucket, and `ai_verdict` / `ai_checked_at` for a
 * review that actually ran.
 */

export interface CarpetaRow {
  id: string
  key: string
  name: string
  position: number
  count: number
}

export interface DocumentoRow {
  id: string
  code: string | null
  folderId: string | null
  name: string
  kind: string
  department: string
  ownerId: string | null
  ownerName: string | null
  /** Quién transfirió el archivo, que no siempre es el responsable. */
  uploadedBy: string | null
  uploaderName: string | null
  /** «Privada» solo la ve su dueño y con quien la comparta. */
  visibility: 'Privada' | 'Pública'
  status: string
  tags: string[]
  storagePath: string | null
  mimeType: string | null
  sizeBytes: number | null
  /** Outcome of the last AI review; null when it has never been reviewed. */
  aiStatus: 'Correcto' | 'Revisar' | 'Incompleto' | null
  aiVerdict: string | null
  aiCheckedAt: string | null
  expiresOn: string | null
  createdAt: string
}

export interface DocumentosData {
  carpetas: CarpetaRow[]
  documentos: DocumentoRow[]
  /** Documents in the organization, of which `documentos` is the first page. */
  documentosTotal: number
  roster: RosterEntry[]
  canWrite: boolean
  /** Bucket the browser uploads into before the row is created. */
  bucket: 'documents'
  orgId: string
}

interface DocumentRecord {
  id: string
  code: string | null
  folder_id: string | null
  name: string
  kind: string
  department: string
  owner_id: string | null
  status: string
  tags: string[]
  storage_path: string | null
  mime_type: string | null
  size_bytes: number | null
  ai_status: 'Correcto' | 'Revisar' | 'Incompleto' | null
  ai_verdict: string | null
  ai_checked_at: string | null
  expires_on: string | null
  created_at: string
  uploaded_by: string | null
  visibility: 'Privada' | 'Pública'
  employees: { full_name: string } | null
  profiles: { full_name: string; email: string } | null
}

// `profiles` entra por su clave foránea explícita: la tabla llega dos veces
// —el responsable vía `employees`, quien subió vía `profiles`— y sin nombrar
// la relación PostgREST no sabe cuál de las dos se pide.
const DOCUMENT_COLUMNS = `id, code, folder_id, name, kind, department, owner_id, status, tags,
   storage_path, mime_type, size_bytes, ai_status, ai_verdict, ai_checked_at,
   expires_on, created_at, uploaded_by, visibility, employees ( full_name ),
   profiles!documents_uploaded_by_fkey ( full_name, email )`

function toDocumento(row: DocumentRecord): DocumentoRow {
  return {
    id: row.id,
    code: row.code,
    folderId: row.folder_id,
    name: row.name,
    kind: row.kind,
    department: row.department,
    ownerId: row.owner_id,
    ownerName: row.employees?.full_name ?? null,
    uploadedBy: row.uploaded_by,
    // El correo cubre a quien todavía no tiene el nombre puesto en su perfil.
    uploaderName: row.profiles?.full_name?.trim() || row.profiles?.email || null,
    visibility: row.visibility,
    status: row.status,
    tags: row.tags ?? [],
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
    aiStatus: row.ai_status,
    aiVerdict: row.ai_verdict,
    aiCheckedAt: row.ai_checked_at,
    expiresOn: row.expires_on,
    createdAt: row.created_at,
  }
}

/** One page of documents, newest first. */
export async function getDocumentosPage(offset = 0): Promise<Page<DocumentoRow>> {
  const member = await requirePermission('documentos:read')
  const supabase = await createClient()
  const [from, to] = pageRange(offset)

  const { data, error, count } = await supabase
    .from('documents')
    .select(DOCUMENT_COLUMNS, { count: 'exact' })
    .eq('org_id', member.orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('[documentos] getDocumentosPage', error)
    return { rows: [], total: 0 }
  }

  return {
    rows: (data as unknown as DocumentRecord[]).map(toDocumento),
    total: totalOf(count, data.length, from),
  }
}

export async function getDocumentos(): Promise<DocumentosData> {
  const member = await requirePermission('documentos:read')
  const supabase = await createClient()

  const [foldersResult, docsResult, roster] = await Promise.all([
    // The per-folder count is an aggregate over the whole table, not a tally
    // of the documents on screen: a folder holding 900 contracts says 900 even
    // when the first page has reached forty of them.
    supabase
      .from('document_folders')
      .select('id, key, name, position, documents ( count )')
      .eq('org_id', member.orgId)
      .is('documents.deleted_at', null)
      .order('position', { ascending: true }),
    supabase
      .from('documents')
      .select(DOCUMENT_COLUMNS, { count: 'exact' })
      .eq('org_id', member.orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(...pageRange(0)),
    rosterFor(supabase, member),
  ])

  if (docsResult.error) {
    console.error('[documentos] getDocumentos', docsResult.error)
    return {
      carpetas: [], documentos: [], documentosTotal: 0, roster: [], canWrite: false,
      bucket: 'documents', orgId: member.orgId,
    }
  }

  const documentos = (docsResult.data as unknown as DocumentRecord[]).map(toDocumento)

  return {
    carpetas: ((foldersResult.data ?? []) as Array<{
      id: string; key: string; name: string; position: number
      documents: Array<{ count: number }> | null
    }>).map((f) => ({
      id: f.id,
      key: f.key,
      name: f.name,
      position: f.position,
      // PostgREST returns an aggregate embed as a one-element array.
      count: f.documents?.[0]?.count ?? 0,
    })),
    documentos,
    documentosTotal: totalOf(docsResult.count, documentos.length),
    roster,
    canWrite: can(member.permissions, 'documentos:write'),
    bucket: 'documents',
    orgId: member.orgId,
  }
}
