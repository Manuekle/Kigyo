'use client'

import { useEffect, useState } from 'react'
import { Download, FileText, X } from '@/lib/icons'
import { documentoPreview, type DocumentoPreview } from '@/server/mutations/documentos'
import { documentIconSrc } from '@/lib/document-icons'

function humanSize(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** Lo que se enseña como encabezado del formato: `application/pdf` → PDF. */
function formatLabel(mimeType: string | null): string {
  if (!mimeType) return 'Archivo'
  const subtype = mimeType.split('/')[1] ?? mimeType
  const short = subtype.split('.').pop() ?? subtype
  return short.replace(/^x-/, '').replace(/sheet|document/i, (m) =>
    m.toLowerCase() === 'sheet' ? 'xlsx' : 'docx',
  ).toUpperCase()
}

/** Las primeras filas de un CSV, como tabla en vez de como una línea larga. */
function CsvTable({ text }: { text: string }) {
  const rows = text.split('\n').slice(0, 200).map((line) => line.split(','))
  const [head, ...body] = rows
  if (!head) return null

  return (
    <div className="tblwrap">
      <table className="tbl">
        <thead>
          <tr>{head.map((cell, i) => <th key={i} scope="col">{cell}</th>)}</tr>
        </thead>
        <tbody>
          {body.map((row, i) => (
            <tr key={i}>{row.map((cell, j) => <td key={j} className="muted">{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Vista previa de un archivo, sea del formato que sea.
 *
 * El servidor decide cómo se puede enseñar cada cosa (`documentoPreview`) y
 * aquí solo se pinta esa decisión. Lo que no admite vista previa —un .zip, un
 * plano, un binario— muestra su ficha y el botón de descargar: cerrar con
 * "no se puede" es más útil que un marco en blanco que parece roto.
 */
export default function DocumentPreview({
  documentId,
  onClose,
  onDownload,
}: {
  documentId: string
  onClose: () => void
  onDownload: () => void
}) {
  /**
   * Las tres piezas viajan juntas y etiquetadas con el documento del que
   * hablan. Antes eran tres `useState` que el efecto resetaba a mano al
   * cambiar de archivo, y ese reset síncrono dentro del efecto es un render en
   * cascada: se pintaba un fotograma con la vista previa del documento
   * anterior antes de limpiarla. Con el id dentro del estado, «esto todavía no
   * es de este documento» se deriva en el render y no hace falta resetear.
   */
  type PreviewState = {
    id: string
    preview: DocumentoPreview | null
    error: string
    assetLoading: boolean
  }
  const EMPTY: PreviewState = { id: documentId, preview: null, error: '', assetLoading: false }
  const [state, setState] = useState<PreviewState>(EMPTY)
  const { preview, error, assetLoading } = state.id === documentId ? state : EMPTY

  useEffect(() => {
    let live = true
    documentoPreview(documentId).then((result) => {
      if (!live) return
      if (!result.ok) {
        setState({ id: documentId, preview: null, error: result.error, assetLoading: false })
        return
      }
      setState({
        id: documentId,
        preview: result.data,
        error: '',
        assetLoading: Boolean(result.data.url),
      })
    }).catch(() => {
      if (!live) return
      setState({
        id: documentId,
        preview: null,
        error: 'No se pudo cargar la vista previa.',
        assetLoading: false,
      })
    })
    return () => { live = false }
  }, [documentId])

  const assetReady = () => setState((s) => (s.assetLoading ? { ...s, assetLoading: false } : s))

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const mime = preview?.mimeType?.split(';', 1)[0].trim().toLowerCase() ?? ''
  const fallbackIcon = preview ? documentIconSrc(preview.mimeType) : null

  return (
    <div className="mwrap" onClick={onClose}>
      <div className="modal dpv" style={{ width: 'min(920px, 100%)' }} onClick={(e) => e.stopPropagation()}>
        <div className="mhead">
          <div className="mtitle">{preview?.name ?? 'Vista previa'}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="ibtn" onClick={onDownload} aria-label="Descargar">
              <Download size={17} />
            </button>
            <button className="ibtn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
          </div>
        </div>

        <div className="mbody dpv-body">
          {error ? (
            <p className="dempty">{error}</p>
          ) : !preview ? (
            <div className="dpv-stage dpv-loading" aria-busy="true">
              <div className="dpv-skeleton" aria-label="Cargando vista previa" />
            </div>
          ) : preview.mode === 'url' && preview.url ? (
            <div className="dpv-stage">
              {assetLoading && <div className="dpv-skeleton" aria-label="Cargando archivo" />}
              {mime.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL firmada y efímera de Storage; el optimizador de Next no puede tomarla.
                <img src={preview.url} alt={preview.name} className="dpv-image" onLoad={assetReady} />
              ) : mime.startsWith('video/') ? (
                <video src={preview.url} controls className="dpv-media" onLoadedData={assetReady} />
              ) : mime.startsWith('audio/') ? (
                <audio src={preview.url} controls className="dpv-audio" onCanPlay={assetReady} />
              ) : (
                // `sandbox` sin `allow-scripts`: un HTML subido por alguien de
                // la empresa se enseña, no se ejecuta.
                <iframe
                  src={preview.url}
                  title={preview.name}
                  className="dpv-frame"
                  onLoad={assetReady}
                  sandbox={mime === 'application/pdf' ? undefined : ''}
                />
              )}
            </div>
          ) : preview.mode === 'text' && preview.text ? (
            <>
              {mime === 'text/csv' ? (
                <CsvTable text={preview.text} />
              ) : (
                <pre className="dpv-text">{preview.text}</pre>
              )}
              {preview.truncated && (
                <p className="dpv-note">
                  Vista previa recortada. Descarga el archivo para leerlo completo.
                </p>
              )}
            </>
          ) : (
            <div className="dpv-none">
              {fallbackIcon ? (
                // eslint-disable-next-line @next/next/no-img-element -- SVG local de tamaño fijo: next/image no optimiza SVG y exigiría `dangerouslyAllowSVG`.
                <img src={fallbackIcon} alt="" width={40} height={40} />
              ) : <FileText size={28} />}
              <p className="dpv-none-title">{formatLabel(preview.mimeType)}</p>
              <p className="dpv-note">
                Este formato no se puede previsualizar en el navegador.
                {preview.sizeBytes !== null && ` Pesa ${humanSize(preview.sizeBytes)}.`}
              </p>
              <button className="btn dark" onClick={onDownload}>
                <Download size={15} />Descargar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
