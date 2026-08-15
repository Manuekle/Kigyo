'use client'

import { useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PORTAL_ERRORS, type PortalTicket, type PortalComment } from './messages'

const TONE: Record<string, string> = {
  Abierto: 'b-amb',
  'En proceso': 'b-blu',
  Resuelto: 'b-grn',
  Cerrado: 'b-neu',
}

export default function PortalClient({
  token,
  initial,
}: {
  token: string
  initial: PortalTicket[]
}) {
  const supabase = createClient()
  const [pending, startTransition] = useTransition()

  const [tickets, setTickets] = useState<PortalTicket[]>(initial)
  const [activeCode, setActiveCode] = useState<string | null>(null)
  const [comments, setComments] = useState<PortalComment[] | null>(null)
  const [error, setError] = useState('')

  const [openForm, setOpenForm] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [reply, setReply] = useState('')

  function fail(err: { code?: string; message?: string } | null) {
    setError(err?.code ? (PORTAL_ERRORS[err.code] ?? err.message ?? 'Algo falló.') : 'Algo falló.')
  }

  function refresh() {
    startTransition(async () => {
      const { data, error } = await supabase.rpc('portal_tickets', { p_token: token })
      if (error) { fail(error); return }
      setTickets(data as unknown as PortalTicket[])
    })
  }

  function openTicket(code: string) {
    setActiveCode(code)
    setError('')
    setReply('')
    startTransition(async () => {
      const { data, error } = await supabase.rpc('portal_ticket_comments', { p_token: token, p_code: code })
      if (error) { fail(error); setComments(null); return }
      setComments(data as unknown as PortalComment[])
    })
  }

  function submitOpen() {
    if (!subject.trim() || !body.trim()) { setError('Cuéntanos el asunto y el detalle.'); return }
    startTransition(async () => {
      const { data, error } = await supabase.rpc('portal_open_ticket', {
        p_token: token, p_subject: subject.trim(), p_body: body.trim(),
      })
      if (error) { fail(error); return }
      setSubject(''); setBody(''); setOpenForm(false); setError('')
      const code = data as unknown as string
      setActiveCode(code)
      refresh()
    })
  }

  function submitReply() {
    if (!activeCode || !reply.trim()) { setError('Escribe tu respuesta.'); return }
    startTransition(async () => {
      const { error } = await supabase.rpc('portal_reply_ticket', {
        p_token: token, p_code: activeCode, p_body: reply.trim(),
      })
      if (error) { fail(error); return }
      setReply(''); setError('')
      openTicket(activeCode)
    })
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 64px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={{ fontSize: 26, fontWeight: 800 }}>Soporte</h1>
        <span style={{ fontSize: 13, color: 'var(--mut)' }}>Portal del cliente</span>
      </div>
      <p style={{ color: 'var(--mut)', marginBottom: 20 }}>
        Tus tickets y su estado, sin necesidad de cuenta.
      </p>

      {error && (
        <div className="b-amb filled-amb" style={{ padding: '10px 14px', borderRadius: 12, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button className="btn pri" onClick={() => setOpenForm(!openForm)} disabled={pending}>
          {openForm ? 'Cerrar' : 'Abrir ticket'}
        </button>
        <button className="btn" onClick={refresh} disabled={pending}>Actualizar</button>
      </div>

      {openForm && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div className="flabel">Asunto</div>
          <input
            className="finput" value={subject} maxLength={200}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="En qué te ayudamos"
            style={{ marginBottom: 12 }}
          />
          <div className="flabel">Detalle</div>
          <textarea
            className="finput" rows={4} value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Cuéntanos el caso con el mayor detalle posible"
            style={{ marginBottom: 12 }}
          />
          <button className="btn dark" onClick={submitOpen} disabled={pending}>
            Enviar ticket
          </button>
        </div>
      )}

      {tickets.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--mut)' }}>
          No tienes tickets todavía. Abre el primero y te responderemos.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tickets.map((t) => (
            <div key={t.code} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--mut)' }}>{t.code}</span>
                <span className={TONE[t.status] ?? 'b-neu'} style={{ fontSize: 12, padding: '2px 10px', borderRadius: 999 }}>{t.status}</span>
                <span style={{ fontSize: 12, color: 'var(--mut)', marginLeft: 'auto' }}>{t.created_at?.slice(0, 10)}</span>
              </div>
              <div style={{ fontWeight: 700 }}>{t.subject}</div>
              <p style={{ fontSize: 14, color: 'var(--mut)', margin: '6px 0 10px' }}>{t.body}</p>

              <button className="btn sm" onClick={() => openTicket(t.code)} disabled={pending}>
                {activeCode === t.code ? 'Cerrar detalle' : 'Ver conversación'}
              </button>

              {activeCode === t.code && (
                <div style={{ marginTop: 14 }}>
                  {comments === null ? (
                    <p style={{ fontSize: 13, color: 'var(--mut)' }}>Cargando…</p>
                  ) : comments.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--mut)' }}>Sin mensajes todavía.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                      {comments.map((c, i) => (
                        <div key={i} style={{ background: 'var(--bg2)', borderRadius: 10, padding: '10px 12px' }}>
                          <div style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--mut)', marginBottom: 4 }}>
                            <strong style={{ color: 'var(--ink)' }}>{c.author}</strong>
                            <span>{c.created_at?.slice(0, 16).replace('T', ' ')}</span>
                          </div>
                          <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{c.body}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {t.status !== 'Cerrado' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <textarea
                        className="finput" rows={2} value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder="Escribe tu respuesta…"
                      />
                      <button className="btn dark" onClick={submitReply} disabled={pending}>
                        Enviar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  )
}