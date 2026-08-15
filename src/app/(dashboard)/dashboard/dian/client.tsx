'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, Download, FileText, Send } from '@/lib/icons'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import Stat from '@/components/ui/Stat'
import { useApp } from '@/lib/context/AppContext'
import { cop } from '@/lib/utils'
import type { StatusTone } from '@/lib/types'
import type {
  DianPanelData, DianDocumentRow, DianEventRow,
} from '@/server/queries/dian'
import { sendInvoiceToDian } from '@/server/mutations/dian'
import { fetchDianDetalle } from '@/server/actions/dian'

const DAY = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
const TIME = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const fmtDay = (iso: string | null) => (iso ? DAY.format(new Date(iso)) : '—')
const fmtTime = (iso: string | null) => (iso ? TIME.format(new Date(iso)) : '—')

const STATUS_TONE: Record<string, StatusTone> = {
  aceptada: 'grn',
  rechazada: 'red',
  procesando: 'blu',
  pendiente: 'amb',
}

const EVENT_LABEL: Record<string, string> = {
  envio: 'Envío',
  aceptacion: 'Aceptación',
  rechazo: 'Rechazo',
  consulta: 'Consulta',
  error: 'Error',
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function pesos(cents: number): string {
  return cop(Math.round(cents / 100))
}

interface DetalleState {
  documento: DianDocumentRow
  eventos: DianEventRow[]
}

export default function DianPage({ data }: { data: DianPanelData }) {
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()
  const [state, setState] = useState(data)
  const [invoiceSel, setInvoiceSel] = useState('')
  const [detalle, setDetalle] = useState<DetalleState | null>(null)
  const [loadingDetalle, setLoadingDetalle] = useState(false)
  const [showXml, setShowXml] = useState<DetalleState | null>(null)

  const opcionesEnv = state.facturasParaEnviar.map((f) => ({
    value: f.id,
    label: `${f.code ?? 'sin code'} · ${f.clientName} · ${pesos(f.totalCents)} · ${fmtDay(f.issuedOn)}`,
  }))

  function enviar() {
    if (!invoiceSel) {
      addToast('Elige una factura primero', 'err')
      return
    }
    startTransition(async () => {
      const before = state.facturasParaEnviar.find((f) => f.id === invoiceSel)
      const label = before ? `${before.code ?? 'sin code'} · ${before.clientName}` : 'factura'
      const result = await sendInvoiceToDian({ invoiceId: invoiceSel })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      setInvoiceSel('')
      addToast(`Enviada ${label} a DIAN demo`, 'ok')
    })
  }

  async function abrirDetalle(docId: string) {
    setLoadingDetalle(true)
    try {
      const r = await fetchDianDetalle(docId)
      if (!r.ok) { addToast(r.error, 'err'); return }
      setDetalle(r.data)
    } finally {
      setLoadingDetalle(false)
    }
  }

  function descargarXml(doc: DianDocumentRow) {
    if (typeof window === 'undefined') return
    const blob = new Blob([doc.xmlContent], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = window.document.createElement('a')
    a.href = url
    a.download = `dian-${doc.invoiceCode || doc.id.slice(0, 8)}.xml`
    a.click()
    URL.revokeObjectURL(url)
  }

  function descargarCufe(doc: DianDocumentRow) {
    if (typeof window === 'undefined') return
    const blob = new Blob([doc.cufe], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = window.document.createElement('a')
    a.href = url
    a.download = `cufe-${doc.invoiceCode || doc.id.slice(0, 8)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const integracionLista = state.integracion.enabled === true

  return (
    <>
      <div className="card rise d1">
        <div className="chead">
          <div className="ctitle">
            <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6, color: 'var(--ambd)' }} />
            Facturación electrónica DIAN — modo demo
          </div>
          <div className="csub">
            Ambiente DEMO. El CUFE se simula localmente; el XML UBL 2.1 se genera pero no se firma
            digitalmente, no se envía a la DIAN y <b>no es válido ante la DIAN</b>. Para producción
            se requiere proveedor tecnológico homologado, certificado de firma digital y validación
            de revisor fiscal — flujo fuera de este módulo. Activa la integración en{' '}
            <a href="/dashboard/integraciones">Integraciones</a>.
          </div>
        </div>
      </div>

      <div className="g2" style={{ marginTop: 16 }}>
        <div className="rise d1">
          <Stat
            icon={<Send size={16} />}
            label="Enviadas a DIAN"
            value={`${state.documentos.length} documentos`}
            sub={`${state.aceptadas} aceptadas·${state.rechazadas} rechazadas`}
          />
        </div>
        <div className="rise d2">
          <Stat
            icon={<FileText size={16} />}
            tone={integracionLista ? 'grn' : 'neu'}
            label="Integración DIAN"
            value={integracionLista ? 'Demo habilitada' : 'Deshabilitada'}
            sub={integracionLista ? 'Sin validez fiscal' : 'Habilita en Integraciones'}
          />
        </div>
      </div>

      <div className="card rise d3" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Enviar factura a DIAN</div>
          <div className="csub">
            Solo facturas <b>Emitidas</b> sin documento DIAN previo. Si necesitas re-enviar, elimina
            el documento existente (no disponible en demo — es inmutable por diseño).
          </div>
        </div>

        <div className="cpad" style={{ paddingBottom: 0 }}>
          {!integracionLista ? (
            <div className="muted" style={{ padding: '14px 0' }}>
              La integración DIAN no está habilitada. Habilítala en{' '}
              <a href="/dashboard/integraciones">Integraciones → DIAN</a> antes de enviar.
            </div>
          ) : state.facturasParaEnviar.length === 0 ? (
            <div className="muted" style={{ padding: '14px 0' }}>
              No hay facturas Emitidas pendientes. Crea una factura y ponla en Emitida en{' '}
              <a href="/dashboard/facturacion">Facturación</a>.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '1 1 360px', minWidth: 280 }}>
                <div className="flabel" style={{ marginTop: 0 }}>Factura</div>
                <Select
                  value={invoiceSel}
                  onChange={setInvoiceSel}
                  options={[{ value: '', label: 'Elige una factura…' }, ...opcionesEnv]}
                />
              </div>
              <button
                className="btn dark"
                disabled={pending || !invoiceSel}
                aria-busy={pending}
                onClick={enviar}
              >
                <Send size={14} />Enviar a DIAN demo
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="card rise d4" style={{ marginTop: 16 }}>
        <div className="chead">
          <div className="ctitle">Documentos DIAN</div>
          <div className="csub">
            Últimos 50 envíos. La bitácora de eventos (envío, aceptación, rechazo) es inmutable.
          </div>
        </div>

        <div className="tblwrap">
          <table className="tbl">
            <thead>
              <tr>
                <th scope="col">Factura</th>
                <th scope="col">Cliente</th>
                <th scope="col">Total</th>
                <th scope="col">CUFE</th>
                <th scope="col">Estado</th>
                <th scope="col">Enviado</th>
                <th scope="col" aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {state.documentos.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                      Sin documentos DIAN todavía.
                    </div>
                  </td>
                </tr>
              ) : state.documentos.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div className="cename">{d.invoiceCode || 'sin code'}</div>
                    <div className="muted mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>
                      {d.id.slice(0, 8)}…
                    </div>
                  </td>
                  <td>{d.clientName || '—'}</td>
                  <td className="mono">{pesos(d.totalCents)}</td>
                  <td className="muted mono" style={{ fontSize: 11, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.cufe ? d.cufe.slice(0, 16) + '…' : '—'}
                  </td>
                  <td><Badge st={cap(d.status)} tone={STATUS_TONE[d.status]} /></td>
                  <td className="muted mono" style={{ fontSize: 12 }}>{fmtTime(d.sentAt)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      className="ibtn"
                      style={{ width: 28, height: 28 }}
                      data-tip="Ver detalle y eventos"
                      disabled={loadingDetalle}
                      onClick={() => abrirDetalle(d.id)}
                      aria-label={`Ver detalle DIAN de ${d.invoiceCode || d.id.slice(0, 8)}`}
                    >
                      <FileText size={13} />
                    </button>
                    <button
                      className="ibtn"
                      style={{ width: 28, height: 28 }}
                      data-tip="Descargar XML UBL"
                      disabled={!d.xmlContent}
                      onClick={() => descargarXml(d)}
                      aria-label={`Descargar XML de ${d.invoiceCode || d.id.slice(0, 8)}`}
                    >
                      <Download size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={detalle !== null}
        onClose={() => { setDetalle(null); setShowXml(null) }}
        title={`DIAN — ${detalle?.documento.invoiceCode ?? ''}`}
        wide
      >
        {detalle && (
          <div>
            <div className="g2" style={{ marginBottom: 16 }}>
              <div className="rise d1" style={{ background: 'var(--bg2)' }}>
                <div className="flabel" style={{ marginTop: 0 }}>Cliente</div>
                <div>{detalle.documento.clientName || '—'}</div>
              </div>
              <div className="rise d2" style={{ background: 'var(--bg2)' }}>
                <div className="flabel" style={{ marginTop: 0 }}>Total</div>
                <div className="mono">{pesos(detalle.documento.totalCents)}</div>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div className="flabel">CUFE (simulado, no válido ante la DIAN)</div>
              <div className="mono" style={{ fontSize: 11, wordBreak: 'break-all', background: 'var(--bg2)', padding: 8, borderRadius: 8 }}>
                {detalle.documento.cufe || '—'}
              </div>
              <div style={{ marginTop: 6 }}>
                <button className="btn ghost" style={{ marginRight: 8 }} onClick={() => descargarCufe(detalle.documento)}>
                  <Download size={12} />Descargar CUFE
                </button>
                <button className="btn ghost" onClick={() => setShowXml(showXml ? null : detalle)}>
                  <FileText size={12} />{showXml ? 'Ocultar XML UBL' : 'Ver XML UBL'}
                </button>
              </div>
            </div>

            {showXml && (
              <pre
                aria-label="XML UBL 2.1 de la factura"
                style={{
                  background: 'var(--bg2)',
                  padding: 12,
                  borderRadius: 8,
                  fontSize: 11,
                  fontFamily: 'var(--mono, monospace)',
                  maxWidth: '100%',
                  overflow: 'auto',
                  maxHeight: 360,
                }}
              >
                {detalle.documento.xmlContent}
              </pre>
            )}

            <div style={{ marginTop: 16 }}>
              <div className="ctitle">Bitácora de eventos</div>
              <div className="tblwrap" style={{ marginTop: 8 }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th scope="col">Evento</th>
                      <th scope="col">Fecha</th>
                      <th scope="col">Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.eventos.length === 0 ? (
                      <tr>
                        <td colSpan={3}>
                          <div className="dempty" style={{ padding: '16px 0', textAlign: 'center' }}>
                            Sin eventos.
                          </div>
                        </td>
                      </tr>
                    ) : detalle.eventos.map((e) => (
                      <tr key={e.id}>
                        <td><Badge st={cap(EVENT_LABEL[e.kind] ?? e.kind)} tone="neu" /></td>
                        <td className="muted mono" style={{ fontSize: 12 }}>{fmtTime(e.createdAt)}</td>
                        <td className="muted" style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {e.message || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}