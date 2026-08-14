'use client'

import { useMemo, useRef, useState, useTransition, useEffect } from 'react'
import { Trash2, Plus, Check, X, Eraser, AlertCircle, FileSpreadsheet } from '@/lib/icons'
import { useApp } from '@/lib/context/AppContext'
import { useExport } from '@/lib/hooks/use-export'
import Select from '@/components/ui/Select'
import DatePicker from '@/components/ui/DatePicker'
import { SIGNATURE_KINDS } from '@/lib/domain'
import LoadMore from '@/components/ui/LoadMore'
import type { FirmasData, FirmaRow } from '@/server/queries/firmas'
import { cancelFirma, requestFirma, signFirma } from '@/server/mutations/firmas'
import { fetchMoreFirmas } from '@/server/actions/firmas'

const DAY = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
const fmt = (iso: string) => DAY.format(new Date(`${iso}T00:00:00`))

const tone = (st: string): string =>
  ({ Firmado: 'grn', Pendiente: 'amb', Vencido: 'red', Cancelado: 'neu' }[st] || 'neu')

const Badge = ({ st }: { st: string }) => (
  <span className={`badge b-${tone(st)}`}><span className="bd" />{st}</span>
)

/* ------------------------------------------------------------------ */
/*  Signature pad — the consent gesture, drawn at the moment of signing */
/* ------------------------------------------------------------------ */
function SignPad({ onInk }: { onInk: (hasInk: boolean) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const drawing = useRef(false)
  const [hasInk, setHasInk] = useState(false)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    const w = c.clientWidth, h = c.clientHeight
    c.width = w * dpr; c.height = h * dpr
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h)
    ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1f2937'
    ctxRef.current = ctx
  }, [])

  const pos = (e: React.MouseEvent | React.TouchEvent) => {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    const native = (e as React.TouchEvent).nativeEvent ?? e
    const p = 'touches' in native ? native.touches[0] : (native as MouseEvent)
    return { x: p.clientX - r.left, y: p.clientY - r.top }
  }
  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); drawing.current = true
    const { x, y } = pos(e); ctxRef.current!.beginPath(); ctxRef.current!.moveTo(x, y)
  }
  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return
    e.preventDefault()
    const { x, y } = pos(e); ctxRef.current!.lineTo(x, y); ctxRef.current!.stroke()
    if (!hasInk) { setHasInk(true); onInk(true) }
  }
  const end = () => { drawing.current = false }
  const clear = () => {
    const c = canvasRef.current!
    ctxRef.current!.clearRect(0, 0, c.width, c.height)
    setHasInk(false); onInk(false)
  }

  return (
    <>
      <div className="sigarea">
        <canvas ref={canvasRef} style={{ background: '#fff', borderRadius: 'var(--r-sm)' }}
          onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
          onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
        {!hasInk && <div className="sighint">Dibuja tu firma aquí</div>}
      </div>
      <div className="sigbar"><button onClick={clear}><Eraser size={14} />Limpiar</button></div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function FirmasPage({ data }: { data: FirmasData }) {
  const { runExport, exporting } = useExport()
  const { addToast } = useApp()
  const [pending, startTransition] = useTransition()

  const [state, setState] = useState<FirmasData>(data)
  const [signing, setSigning] = useState<FirmaRow | null>(null)
  const [form, setForm] = useState({ title: '', kind: 'Contrato', signerId: '', signerEmail: '', dueOn: '' })

  const [loadingMore, startLoadingMore] = useTransition()
  const [loadMoreError, setLoadMoreError] = useState('')

  const { firmas, roster } = state

  function loadMore() {
    setLoadMoreError('')
    startLoadingMore(async () => {
      const result = await fetchMoreFirmas(firmas.length)
      if (!result.ok) {
        setLoadMoreError(result.error)
        return
      }
      setState((prev) => {
        const seen = new Set(prev.firmas.map((f) => f.id))
        return {
          ...prev,
          firmas: [...prev.firmas, ...result.data.rows.filter((f) => !seen.has(f.id))],
          firmasTotal: result.data.total,
        }
      })
    })
  }

  const counts = useMemo(() => ({
    pendientes: firmas.filter((f) => f.status === 'Pendiente').length,
    firmados: firmas.filter((f) => f.status === 'Firmado').length,
  }), [firmas])

  const exportRows = () => {
    void runExport(
      firmas.map((f) => ({
        Nombre: f.title,
        Firmante: f.signerName ?? f.signerEmail ?? '',
        Estado: f.status,
        Fecha: f.requestedOn,
      })),
      'firmas-kigyo',
      'firmas',
    )
  }

  function submitRequest() {
    if (!form.title.trim()) { addToast('Indica el nombre del documento', 'err'); return }
    startTransition(async () => {
      const result = await requestFirma({
        title: form.title.trim(),
        kind: form.kind as (typeof SIGNATURE_KINDS)[number],
        signerId: form.signerId || null,
        signerEmail: form.signerEmail.trim() || null,
        dueOn: form.dueOn || null,
      })
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      setForm({ title: '', kind: 'Contrato', signerId: '', signerEmail: '', dueOn: '' })
      addToast('Firma solicitada', 'ok')
    })
  }

  function cancel(f: FirmaRow) {
    if (!window.confirm(`¿Cancelar la solicitud "${f.title}"? Queda registrada como cancelada.`)) return
    startTransition(async () => {
      const result = await cancelFirma(f.id)
      if (!result.ok) { addToast(result.error, 'err'); return }
      setState(result.data)
      addToast('Solicitud cancelada', 'info')
    })
  }

  return (
    <div className="g2">
      <div className="card rise d1">
        <div className="chead">
          <div className="ctitle">Documentos para firma</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span className="kvs">{counts.pendientes} pendientes · {counts.firmados} firmados</span>
            <button disabled={exporting} aria-busy={exporting} className="btn" onClick={exportRows}><FileSpreadsheet size={15} />Exportar</button>
          </div>
        </div>
        <div className="tblwrap">
          <table className="tbl">
            <thead><tr><th scope="col">Documento</th><th scope="col">Firmante</th><th scope="col">Tipo</th><th scope="col">Solicitado</th><th scope="col">Estado</th><th scope="col"></th></tr></thead>
            <tbody>
              {firmas.length === 0 ? (
                <tr><td colSpan={6}><div className="dempty" style={{ padding: '22px 0', textAlign: 'center' }}>
                  Todavía no hay solicitudes de firma.
                </div></td></tr>
              ) : firmas.map((f) => (
                <tr className="trow" key={f.id}>
                  <td>
                    <div className="cename">{f.title}</div>
                    <div className="ceid mono">{f.code ?? '—'}</div>
                  </td>
                  <td className="muted">{f.signerName ?? f.signerEmail ?? '—'}</td>
                  <td className="muted">{f.kind}</td>
                  <td className="muted mono" style={{ fontSize: 12 }}>
                    {fmt(f.requestedOn)}
                    {/* Days overdue derived from `due_on`, not typed in beside
                        the date where it could never change. */}
                    {f.daysOverdue !== null && f.daysOverdue > 0 && (
                      <div style={{ color: 'var(--redd)', fontSize: 11 }}>{f.daysOverdue}d vencido</div>
                    )}
                  </td>
                  <td><Badge st={f.status} /></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      {/* Only the addressee sees "Firmar" — the server refuses
                          anyone else, so offering it would be a dead button. */}
                      {f.status === 'Pendiente' && f.signerId === state.meEmployeeId && state.meEmployeeId && (
                        <button className="btn dark" style={{ fontSize: 11, height: 28 }} onClick={() => setSigning(f)}>
                          <Check size={12} />Firmar
                        </button>
                      )}
                      {state.canWrite && f.status !== 'Firmado' && f.status !== 'Cancelado' && (
                        <button className="ibtn" style={{ width: 28, height: 28 }} data-tip="Cancelar" disabled={pending} onClick={() => cancel(f)} aria-label={`Cancelar ${f.title}`}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <LoadMore
          loaded={firmas.length}
          total={state.firmasTotal}
          loading={loadingMore}
          error={loadMoreError}
          onLoadMore={loadMore}
          noun="solicitudes"
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {state.canWrite && (
          <div className="card cpad rise d2">
            <div className="ctitle" style={{ marginBottom: 14 }}>Solicitar firma</div>
            <div className="flabel" style={{ marginTop: 0 }}>Nombre del documento</div>
            <input className="field" placeholder="Ej. Contrato laboral" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            <div className="flabel">Tipo de documento</div>
            <Select options={[...SIGNATURE_KINDS]} value={form.kind} onChange={(v) => setForm((f) => ({ ...f, kind: v }))} />
            {roster.length > 0 && (
              <>
                <div className="flabel">Firmante del equipo</div>
                <Select
                  value={form.signerId}
                  onChange={(v) => setForm((f) => ({ ...f, signerId: v }))}
                  placeholder="Elegir persona"
                  options={[
                    { value: '', label: 'Nadie del equipo' },
                    ...roster.map((r) => ({ value: r.employeeId, label: r.fullName })),
                  ]}
                />
              </>
            )}
            <div className="flabel">…o correo de un firmante externo</div>
            <input className="field" type="email" placeholder="firmante@empresa.co" value={form.signerEmail} onChange={(e) => setForm((f) => ({ ...f, signerEmail: e.target.value }))} />
            <div className="flabel">Fecha límite</div>
            <DatePicker ariaLabel="Fecha límite" value={form.dueOn} onChange={(v) => setForm((f) => ({ ...f, dueOn: v }))} />
            {/*
              The drag-and-drop file box that used to sit here accepted nothing:
              there was no upload handler and no storage path on the request.
              Attaching a file belongs with Documentos, which owns the bucket.
            */}
            <button className="btn dark" style={{ width: '100%', marginTop: 14 }} onClick={submitRequest} disabled={pending} aria-busy={pending}>
              <Plus size={15} />{pending ? 'Solicitando…' : 'Solicitar firma'}
            </button>
          </div>
        )}

        <div className="card cpad rise d3">
          <div className="ctitle" style={{ marginBottom: 8 }}>Cómo funciona la firma</div>
          {/*
            "Tu firma · Camila Restrepo · Líder de RRHH · Verificada" used to be
            here, over a canvas kept in `useState`. The name was hardcoded, and
            the stroke was never stored anywhere — so "Verificada" described
            nothing. What the system actually records is the act and its
            instant: `status` and `signed_at` on the request.
          */}
          <p className="psub" style={{ lineHeight: 1.55 }}>
            Al firmar dibujas tu firma y aceptas los términos. Kigyo registra quién firmó
            —{' '}<b>{state.meName}</b>, {state.meRole} — y el momento exacto en que lo hizo.
            El trazo no se almacena: el registro legal es la aceptación y su fecha.
          </p>
          {!state.meEmployeeId && (
            <p className="psub" style={{ marginTop: 10 }}>
              Tu cuenta no está vinculada a una persona del directorio, así que todavía no
              puedes firmar. Pide a administración que te agregue a Empleados.
            </p>
          )}
        </div>
      </div>

      {signing && (
        <ConfirmSignModal
          key={signing.id}
          doc={signing}
          busy={pending}
          onClose={() => setSigning(null)}
          onConfirm={() =>
            startTransition(async () => {
              const result = await signFirma(signing.id)
              if (!result.ok) { addToast(result.error, 'err'); return }
              setState(result.data)
              setSigning(null)
              addToast(`"${signing.title}" firmado`, 'ok')
            })
          }
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Confirm + sign                                                     */
/* ------------------------------------------------------------------ */
function ConfirmSignModal({ doc, busy, onClose, onConfirm }: {
  doc: FirmaRow
  busy: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const [agree, setAgree] = useState(false)
  const [agreeInit, setAgreeInit] = useState(false)
  const [hasInk, setHasInk] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const confirm = () => {
    if (!hasInk) { setErr('Dibuja tu firma antes de continuar.'); return }
    if (!agree) { setErr('Confirma que aceptas los términos antes de firmar.'); return }
    onConfirm()
  }

  return (
    <div className="mwrap" onClick={onClose}>
      <div className="modal" style={{ width: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="mhead">
          <div className="mtitle">Firmar documento</div>
          <button className="ibtn" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="mbody">
          <div className="elrow">
            <div><div className="eltxt">Documento</div><div className="elsub">{doc.title}</div></div>
            <div><div className="eltxt">Código</div><div className="elsub mono">{doc.code ?? '—'}</div></div>
          </div>
          <div className="elrow">
            <div><div className="eltxt">Tipo</div><div className="elsub">{doc.kind}</div></div>
            <div><div className="eltxt">Solicitado</div><div className="elsub">{fmt(doc.requestedOn)}</div></div>
          </div>

          <div className="dsect">Tu firma</div>
          <SignPad onInk={(v) => { setHasInk(v); setErr(null) }} />

          <div className={`agree ${err && !agree ? 'bad' : ''}`} style={{ marginTop: 12 }}>
            <button
              type="button"
              role="switch"
              aria-checked={agree}
              className={`t-toggle${agreeInit ? ' is-init' : ''}`}
              data-on={agree ? 'true' : 'false'}
              onClick={() => { setAgree((v) => !v); setAgreeInit(true); setErr(null) }}
              onMouseDown={(e) => e.preventDefault()}
              aria-label="Aceptar términos"
            >
              <span className="t-toggle-thumb" aria-hidden="true" />
            </button>
            <div className="agreetxt">
              Confirmo que he leído y acepto todos los términos contractuales. Esta aceptación
              queda registrada con mi nombre y la fecha y hora exactas.
            </div>
          </div>
          {err && <div className="errline"><AlertCircle size={14} />{err}</div>}
        </div>
        <div className="mfoot"><span /><div style={{ display: 'flex', gap: 9 }}>
          <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className="btn dark" onClick={confirm} disabled={busy} aria-busy={busy}>
            {busy ? 'Firmando…' : 'Aceptar y firmar'}
          </button>
        </div></div>
      </div>
    </div>
  )
}
