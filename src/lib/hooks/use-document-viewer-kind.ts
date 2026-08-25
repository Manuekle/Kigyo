export type DocumentViewerKind =
  | 'pdf'
  | 'docx'
  | 'xlsx'
  | 'pptx'
  | 'csv'
  | 'image'
  | 'video'
  | 'audio'
  | 'text'
  | 'none'

const MIME_KIND: Record<string, DocumentViewerKind> = {
  'application/pdf': 'pdf',
  'application/msword': 'docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xlsx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'pptx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/csv': 'csv',
  'text/tab-separated-values': 'csv',
  'application/csv': 'csv',
  'text/plain': 'text',
  'text/markdown': 'text',
  'application/json': 'text',
  'application/xml': 'text',
  'text/xml': 'text',
  'text/html': 'text',
}

const EXT_KIND: Record<string, DocumentViewerKind> = {
  pdf: 'pdf',
  doc: 'docx',
  docx: 'docx',
  odt: 'docx',
  xls: 'xlsx',
  xlsx: 'xlsx',
  ods: 'xlsx',
  ppt: 'pptx',
  pptx: 'pptx',
  odp: 'pptx',
  csv: 'csv',
  tsv: 'csv',
  txt: 'text',
  md: 'text',
  json: 'text',
  xml: 'text',
  html: 'text',
  htm: 'text',
}

/**
 * Detecta qué viewer Extend (u nativo) pinta un archivo.
 * MIME primero; extensión fallback si MIME vacío o genérico.
 */
export function detectDocumentViewerKind(
  mimeType?: string | null,
  fileName?: string | null,
): DocumentViewerKind {
  const mime = mimeType?.split(';', 1)[0]?.trim().toLowerCase() ?? ''

  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime && MIME_KIND[mime]) return MIME_KIND[mime]
  if (mime.startsWith('text/')) return 'text'

  const ext = fileName?.split('.').pop()?.toLowerCase()
  if (ext && EXT_KIND[ext]) return EXT_KIND[ext]

  return 'none'
}

/** Hook fino: mismo detector, estable por inputs. */
export function useDocumentViewerKind(
  mimeType?: string | null,
  fileName?: string | null,
): DocumentViewerKind {
  return detectDocumentViewerKind(mimeType, fileName)
}
