'use client'

import { useEffect, useState } from 'react'
import { Download, FileText, X } from '@/lib/icons'
import { documentoPreview, type DocumentoPreview } from '@/server/mutations/documentos'
import { documentIconSrc } from '@/lib/document-icons'
import { useDocumentViewerKind, type DocumentViewerKind } from '@/lib/hooks/use-document-viewer-kind'
import { useTheme } from '@/lib/context/ThemeContext'
import { PDFViewer } from '@/components/extend/pdf-viewer'
import { DocxViewerPreview } from '@/components/extend/docx-viewer'
import { XlsxViewerPreview } from '@/components/extend/xlsx-viewer'
import { PptxViewerPreview } from '@/components/extend/pptx-viewer'
import { CsvViewer } from '@/components/extend/csv-viewer'
import { cn } from '@/lib/utils'

function humanSize(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatLabel(mimeType: string | null): string {
  if (!mimeType) return 'Archivo'
  const subtype = mimeType.split('/')[1] ?? mimeType
  const short = subtype.split('.').pop() ?? subtype
  return short
    .replace(/^x-/, '')
    .replace(/sheet|document/i, (m) => (m.toLowerCase() === 'sheet' ? 'xlsx' : 'docx'))
    .toUpperCase()
}

/** Office viewers aún toman URL; PDF usa ArrayBuffer (sin fetch blob: en worker). */
const BLOB_URL_KINDS = new Set<DocumentViewerKind>(['docx', 'xlsx', 'pptx'])

/**
 * EmbedPDF primero; si el motor no pinta en ~8s, iframe nativo del blob
 * (Chrome/Edge/Safari muestran PDF sin PDFium).
 */
function PdfPreviewSurface({
  buffer,
  name,
  className,
}: {
  buffer: ArrayBuffer
  name: string
  className: string
}) {
  const [nativeUrl, setNativeUrl] = useState<string | null>(null)
  const [useNative, setUseNative] = useState(false)
  const [embedReady, setEmbedReady] = useState(false)

  useEffect(() => {
    const blob = new Blob([buffer], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNativeUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [buffer])

  useEffect(() => {
    if (embedReady || useNative) return
    const timer = window.setTimeout(() => setUseNative(true), 8000)
    return () => window.clearTimeout(timer)
  }, [embedReady, useNative])

  const fileName = name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`

  if (useNative && nativeUrl) {
    return (
      <iframe
        src={nativeUrl}
        title={name}
        className={cn(className, 'border-0 bg-background')}
      />
    )
  }

  return (
    <PDFViewer
      buffer={buffer}
      fileName={fileName}
      className={className}
      showUpload={false}
      showDownload={false}
      onDocumentLoadSuccess={() => setEmbedReady(true)}
    />
  )
}

/**
 * Vista previa: hook elige viewer Extend (pdf/docx/xlsx/pptx/csv)
 * o media nativa (image/video/audio/text). Resto → ficha + descargar.
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
  type PreviewState = {
    id: string
    preview: DocumentoPreview | null
    error: string
    assetLoading: boolean
  }
  const EMPTY: PreviewState = { id: documentId, preview: null, error: '', assetLoading: false }
  const [state, setState] = useState<PreviewState>(EMPTY)
  const { preview, error, assetLoading } = state.id === documentId ? state : EMPTY
  const { theme, setPreference } = useTheme()
  const isDark = theme === 'dark'
  const [csvFetched, setCsvFetched] = useState<{ id: string; text: string } | null>(null)
  const [blobSrc, setBlobSrc] = useState<{ id: string; url: string } | null>(null)
  const [pdfBuffer, setPdfBuffer] = useState<{ id: string; buffer: ArrayBuffer } | null>(null)
  const [assetError, setAssetError] = useState('')

  useEffect(() => {
    let live = true
    documentoPreview(documentId)
      .then((result) => {
        if (!live) return
        if (!result.ok) {
          setState({ id: documentId, preview: null, error: result.error, assetLoading: false })
          return
        }
        setState({
          id: documentId,
          preview: result.data,
          error: '',
          assetLoading: Boolean(result.data.url) && result.data.mode === 'url',
        })
      })
      .catch(() => {
        if (!live) return
        setState({
          id: documentId,
          preview: null,
          error: 'No se pudo cargar la vista previa.',
          assetLoading: false,
        })
      })
    return () => {
      live = false
    }
  }, [documentId])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const kind = useDocumentViewerKind(preview?.mimeType, preview?.name)
  const fallbackIcon = preview ? documentIconSrc(preview.mimeType, preview.name) : null
  const assetReady = () => setState((s) => (s.assetLoading ? { ...s, assetLoading: false } : s))
  const viewerShell =
    'h-[min(70vh,720px)] w-full min-h-[320px] overflow-hidden rounded-[var(--r)] bg-background'

  // PDF: ArrayBuffer directo → openDocumentBuffer (worker no hace fetch blob:).
  useEffect(() => {
    if (!preview?.url || kind !== 'pdf') {
      setPdfBuffer(null)
      return
    }
    let live = true
    setPdfBuffer(null)
    setAssetError('')
    fetch(preview.url)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.arrayBuffer()
      })
      .then((buffer) => {
        if (!live) return
        setPdfBuffer({ id: documentId, buffer })
      })
      .catch(() => {
        if (!live) return
        setAssetError('No se pudo descargar el PDF para previsualizarlo.')
      })
    return () => {
      live = false
    }
  }, [preview?.url, kind, documentId])

  // Office: blob URL local (fetch main thread, no worker).
  useEffect(() => {
    if (!preview?.url || !BLOB_URL_KINDS.has(kind)) {
      setBlobSrc(null)
      return
    }
    let live = true
    let objectUrl: string | null = null
    setBlobSrc(null)
    setAssetError('')
    fetch(preview.url)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.blob()
      })
      .then((blob) => {
        if (!live) return
        objectUrl = URL.createObjectURL(blob)
        setBlobSrc({ id: documentId, url: objectUrl })
      })
      .catch(() => {
        if (!live) return
        setAssetError('No se pudo descargar el archivo para previsualizarlo.')
      })
    return () => {
      live = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [preview?.url, kind, documentId])

  useEffect(() => {
    if (!preview || kind !== 'csv' || preview.text || !preview.url) return
    let live = true
    fetch(preview.url)
      .then((r) => r.text())
      .then((text) => {
        if (live) setCsvFetched({ id: documentId, text })
      })
      .catch(() => {
        if (live) setCsvFetched({ id: documentId, text: '' })
      })
    return () => {
      live = false
    }
  }, [preview, kind, documentId])

  const csvText =
    preview && kind === 'csv'
      ? (preview.text ?? (csvFetched?.id === documentId ? csvFetched.text : undefined))
      : undefined

  const localSrc = blobSrc?.id === documentId ? blobSrc.url : null
  const localPdf = pdfBuffer?.id === documentId ? pdfBuffer.buffer : null

  function renderBody() {
    if (error) return <p className="dempty">{error}</p>
    if (!preview) {
      return (
        <div className="dpv-stage dpv-loading" aria-busy="true">
          <div className="dpv-skeleton" aria-label="Cargando vista previa" />
        </div>
      )
    }

    if (kind === 'pdf' && preview.url) {
      if (assetError) return <p className="dempty">{assetError}</p>
      if (!localPdf) {
        return (
          <div className="dpv-stage dpv-loading" aria-busy="true">
            <div className="dpv-skeleton" aria-label="Cargando PDF" />
          </div>
        )
      }
      return (
        <PdfPreviewSurface
          buffer={localPdf}
          name={preview.name}
          className={viewerShell}
        />
      )
    }

    if (BLOB_URL_KINDS.has(kind) && preview.url) {
      if (assetError) return <p className="dempty">{assetError}</p>
      if (!localSrc) {
        return (
          <div className="dpv-stage dpv-loading" aria-busy="true">
            <div className="dpv-skeleton" aria-label="Cargando archivo" />
          </div>
        )
      }

      if (kind === 'docx') {
        return (
          <DocxViewerPreview
            src={localSrc}
            fileName={preview.name}
            className={viewerShell}
            isDark={isDark}
            onIsDarkChange={(next) => setPreference(next ? 'dark' : 'light')}
            showUpload={false}
            showDownload={false}
          />
        )
      }
      if (kind === 'xlsx') {
        return (
          <XlsxViewerPreview
            src={localSrc}
            fileName={preview.name}
            className={viewerShell}
            isDark={isDark}
            onIsDarkChange={(next) => setPreference(next ? 'dark' : 'light')}
            showUpload={false}
            showDownload={false}
          />
        )
      }
      if (kind === 'pptx') {
        return (
          <PptxViewerPreview
            src={localSrc}
            fileName={preview.name}
            className={viewerShell}
            showUpload={false}
            showDownload={false}
          />
        )
      }
    }

    if (kind === 'csv') {
      if (csvText === undefined && preview.url) {
        return (
          <div className="dpv-stage dpv-loading" aria-busy="true">
            <div className="dpv-skeleton" aria-label="Cargando CSV" />
          </div>
        )
      }
      if (csvText) {
        return (
          <div className={cn(viewerShell, 'overflow-auto')}>
            <CsvViewer data={csvText} className="h-full min-h-[320px]" />
          </div>
        )
      }
    }

    if (preview.mode === 'url' && preview.url) {
      if (kind === 'image') {
        return (
          <div className="dpv-stage">
            {assetLoading && <div className="dpv-skeleton" aria-label="Cargando archivo" />}
            {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada efímera Storage */}
            <img src={preview.url} alt={preview.name} className="dpv-image" onLoad={assetReady} />
          </div>
        )
      }
      if (kind === 'video') {
        return (
          <div className="dpv-stage">
            {assetLoading && <div className="dpv-skeleton" aria-label="Cargando archivo" />}
            <video src={preview.url} controls className="dpv-media" onLoadedData={assetReady} />
          </div>
        )
      }
      if (kind === 'audio') {
        return (
          <div className="dpv-stage">
            <audio src={preview.url} controls className="dpv-audio" onCanPlay={assetReady} />
          </div>
        )
      }
    }

    if (preview.mode === 'text' && preview.text) {
      return (
        <>
          <pre className="dpv-text">{preview.text}</pre>
          {preview.truncated && (
            <p className="dpv-note">Vista previa recortada. Descarga el archivo para leerlo completo.</p>
          )}
        </>
      )
    }

    return (
      <div className="dpv-none">
        {fallbackIcon ? (
          // eslint-disable-next-line @next/next/no-img-element -- SVG local fijo
          <img src={fallbackIcon} alt="" width={40} height={40} />
        ) : (
          <FileText size={28} />
        )}
        <p className="dpv-none-title">{formatLabel(preview.mimeType)}</p>
        <p className="dpv-note">
          Este formato no se puede previsualizar en el navegador.
          {preview.sizeBytes !== null && ` Pesa ${humanSize(preview.sizeBytes)}.`}
        </p>
        <button className="btn dark" onClick={onDownload}>
          <Download size={15} />
          Descargar
        </button>
      </div>
    )
  }

  return (
    <div className="mwrap" onClick={onClose}>
      <div
        className="modal dpv"
        style={{ width: 'min(1100px, 100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mhead">
          <div className="mtitle">{preview?.name ?? 'Vista previa'}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="ibtn" onClick={onDownload} aria-label="Descargar">
              <Download size={17} />
            </button>
            <button className="ibtn" onClick={onClose} aria-label="Cerrar">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="mbody dpv-body">{renderBody()}</div>
      </div>
    </div>
  )
}
