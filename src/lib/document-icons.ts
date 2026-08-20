/**
 * SVG file-type badges (`public/icons/file-types/`) for the handful of
 * formats common enough to earn their own — Word, CSV, PowerPoint, PDF —
 * instead of the same generic file glyph for everything.
 *
 * Matched by MIME type first, since that is what the browser sets reliably
 * at upload time (see `uploadAttachment` in documentos/client.tsx). The extension
 * is the fallback for the cases a browser leaves the MIME blank, not the
 * primary signal — a renamed file's extension can lie, its MIME cannot.
 */

const MIME_TO_ICON: Record<string, string> = {
  'image/avif': 'img',
  'image/bmp': 'img',
  'image/gif': 'img',
  'image/heic': 'img',
  'image/heif': 'img',
  'image/jpeg': 'img',
  'image/png': 'img',
  'image/svg+xml': 'img',
  'image/tiff': 'img',
  'image/webp': 'img',
  'audio/mpeg': 'generic',
  'audio/ogg': 'generic',
  'audio/wav': 'generic',
  'audio/x-wav': 'generic',
  'application/pdf': 'pdf',
  'application/msword': 'img',
  'application/rtf': 'doc',
  'application/vnd.ms-excel': 'csv',
  'application/vnd.ms-powerpoint': 'pptx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'csv',
  'text/csv': 'csv',
  'text/tab-separated-values': 'csv',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
}

const EXT_TO_ICON: Record<string, string> = {
  pdf: 'pdf',
  doc: 'img',
  docx: 'docx',
  csv: 'csv',
  xls: 'csv',
  xlsx: 'csv',
  ods: 'csv',
  rtf: 'doc',
  ppt: 'pptx',
  pptx: 'pptx',
  odp: 'pptx',
  odt: 'docx',
  avif: 'img',
  bmp: 'img',
  gif: 'img',
  heic: 'img',
  heif: 'img',
  jpeg: 'img',
  jpg: 'img',
  png: 'img',
  svg: 'img',
  tif: 'img',
  tiff: 'img',
  webp: 'img',
  mp3: 'generic',
  ogg: 'generic',
  wav: 'generic',
}

/**
 * The badge's public path for a document, including generic unknown formats.
 *
 * `fileName` only needs to carry the extension; the stored `documents.name`
 * has it stripped, so pass `storagePath` (or the original upload name) here.
 */
export function documentIconSrc(mimeType: string | null, fileName?: string | null): string | null {
  const mime = mimeType?.split(';', 1)[0].trim().toLowerCase()
  if (mime && MIME_TO_ICON[mime]) {
    return `/icons/file-types/${MIME_TO_ICON[mime]}.svg`
  }
  const ext = fileName?.split('.').pop()?.toLowerCase()
  if (ext && EXT_TO_ICON[ext]) {
    return `/icons/file-types/${EXT_TO_ICON[ext]}.svg`
  }
  return '/icons/file-types/generic.svg'
}
