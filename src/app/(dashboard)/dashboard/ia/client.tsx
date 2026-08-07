'use client'

import { useEffect, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import {
  ArrowUp,
  PenLine,
  Package,
  ShieldAlert,
  Ticket,
  Square,
  RotateCcw,
  FileText,
} from '@/lib/icons'
import { useApp } from '@/lib/context/AppContext'
import MetaBalls from '@/components/ui/MetaBalls'
import type { ChatMetadata, Citation, KigyoUIMessage } from '@/lib/ai/types'

/**
 * Assistant chat.
 *
 * Replaces a `setTimeout` plus a keyword-matching `if` chain with a real
 * streamed answer from /api/ai/chat, grounded on the Foundry IQ knowledge base
 * and on live Supabase queries. Citations arrive as message metadata.
 */

const SUGGESTIONS = [
  { icon: <PenLine size={15} />, label: 'Firmas pendientes', tone: 'blu',
    prompt: '¿Qué firmas están pendientes y cuáles ya vencieron?' },
  { icon: <Package size={15} />, label: 'Estado del inventario', tone: 'grn',
    prompt: '¿Cómo está el inventario de activos? ¿Qué hay sin asignar?' },
  { icon: <ShieldAlert size={15} />, label: 'Riesgos este mes', tone: 'red',
    prompt: '¿Qué riesgos de severidad alta siguen abiertos?' },
  { icon: <Ticket size={15} />, label: 'Tickets abiertos', tone: 'amb',
    prompt: 'Resume los tickets abiertos por área y prioridad.' },
] as const

function messageText(message: KigyoUIMessage): string {
  return (message.parts ?? [])
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('')
}

/** Names of the tools the model invoked, for the "consultando…" indicator. */
function activeToolLabels(message: KigyoUIMessage): string[] {
  const labels: Record<string, string> = {
    firmasPendientes: 'firmas',
    ticketsAbiertos: 'tickets',
    estadoInventario: 'inventario',
    riesgosAbiertos: 'riesgos',
    cumplimientoDocumental: 'documentos',
    resumenEquipo: 'equipo',
  }

  return [
    ...new Set(
      (message.parts ?? [])
        .filter((part) => part.type.startsWith('tool-'))
        .map((part) => labels[part.type.slice('tool-'.length)])
        .filter((label): label is string => Boolean(label)),
    ),
  ]
}

function Sources({ citations }: { citations: Citation[] }) {
  const [open, setOpen] = useState(false)
  if (citations.length === 0) return null

  return (
    <div className="ia-sources">
      <button
        type="button"
        className="ia-sources-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <FileText size={13} aria-hidden="true" />
        {citations.length} {citations.length === 1 ? 'fuente' : 'fuentes'}
      </button>

      {open && (
        <ul className="ia-sources-list">
          {citations.map((citation) => (
            <li key={citation.id}>
              {citation.url ? (
                <a href={citation.url} target="_blank" rel="noopener noreferrer">
                  {citation.title}
                </a>
              ) : (
                <span>{citation.title}</span>
              )}
              {citation.snippet && <p>{citation.snippet}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function IAPage() {
  const { addToast } = useApp()
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const { messages, sendMessage, status, stop, error, regenerate, clearError } =
    useChat<KigyoUIMessage>({
      transport: new DefaultChatTransport({
        api: '/api/ai/chat',
        // The server creates the conversation on the first turn and returns
        // its id as message metadata. Reading it back off the transcript at
        // send time keeps follow-ups in the same thread without a ref that
        // could go stale against the messages it is supposed to describe.
        prepareSendMessagesRequest: ({ messages: outgoing }) => ({
          body: {
            messages: outgoing,
            conversationId:
              outgoing
                .map((message) => (message.metadata as ChatMetadata | undefined)?.conversationId)
                .find((id): id is string => Boolean(id)) ?? null,
          },
        }),
      }),
      onError(streamError) {
        addToast(streamError.message || 'El asistente falló al responder', 'err')
      },
    })

  const busy = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, status])

  // Neutralize the dashboard .content padding/scroll so the composer stays
  // pinned to the bottom and doesn't ride up when messages are sent.
  useEffect(() => {
    const el = document.querySelector('.content')
    el?.classList.add('content-chat')
    return () => el?.classList.remove('content-chat')
  }, [])

  function autoResize() {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`
  }

  function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || busy) return
    clearError()
    void sendMessage({ text: content })
    setInput('')
    if (taRef.current) taRef.current.style.height = 'auto'
  }

  const empty = messages.length === 0

  return (
    <div className="ia-page">
      <div className="ia-msgs">
        <div className="ia-inner">
          {empty && !busy ? (
            <div className="ia-welcome">
              <div className="w-[200px] h-[200px] mb-6" aria-hidden="true">
                <MetaBalls
                  color="#ffffff"
                  cursorBallColor="#ffffff"
                  cursorBallSize={2}
                  ballCount={15}
                  animationSize={30}
                  enableMouseInteraction
                  enableTransparency
                  hoverSmoothness={0.05}
                  clumpFactor={1}
                  speed={0.3}
                />
              </div>
              <h1 className="ia-title">¿En qué puedo ayudarte?</h1>
              <p className="ia-sub">
                Consulta firmas, inventario, riesgos, tickets y cumplimiento en lenguaje natural.
              </p>
              <div className="ia-chips">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion.label}
                    type="button"
                    className={`ia-chip ${suggestion.tone}`}
                    onClick={() => send(suggestion.prompt)}
                  >
                    {suggestion.icon}
                    <span>{suggestion.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Streamed answers are announced politely so a screen-reader
                  user hears the reply without it interrupting their typing. */}
              <div aria-live="polite" aria-atomic="false">
                {messages.map((message) => {
                  const metadata = message.metadata as ChatMetadata | undefined
                  const text = messageText(message)
                  const tools = activeToolLabels(message)

                  return (
                    <div
                      className={`ia-row ${message.role === 'user' ? 'me' : 'ai'}`}
                      key={message.id}
                    >
                      <div className="ia-bub">
                        {message.role === 'assistant' && tools.length > 0 && !text && (
                          <span className="t-shimmer" data-text={`Consultando ${tools.join(', ')}…`}>
                            Consultando {tools.join(', ')}…
                          </span>
                        )}
                        {text}
                        {message.role === 'assistant' && metadata?.partialRetrieval && (
                          <p className="ia-warn">
                            Una fuente de conocimiento no respondió; el contexto puede estar
                            incompleto.
                          </p>
                        )}
                        {message.role === 'assistant' && metadata?.citations && (
                          <Sources citations={metadata.citations} />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {status === 'submitted' && (
                <div className="ia-row ai">
                  <div className="ia-bub">
                    <span className="t-shimmer" data-text="Analizando datos">Analizando datos</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="ia-row ai">
                  <div className="ia-bub ia-bub-error" role="alert">
                    <span>{error.message || 'El asistente falló al responder.'}</span>
                    <button type="button" className="btn ghost" onClick={() => regenerate()}>
                      <RotateCcw size={14} aria-hidden="true" />
                      Reintentar
                    </button>
                  </div>
                </div>
              )}

              <div ref={endRef} style={{ height: 4 }} />
            </>
          )}
        </div>
      </div>

      <div className="ia-composer">
        <div className="ia-box">
          <label className="sr-only" htmlFor="ia-input">Mensaje para el asistente</label>
          <textarea
            id="ia-input"
            ref={taRef}
            rows={1}
            className="ia-text"
            placeholder="Escribe un mensaje…"
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              autoResize()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
          />
          {busy ? (
            <button type="button" className="ia-go" onClick={() => stop()} aria-label="Detener respuesta">
              <Square size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="ia-go"
              disabled={!input.trim()}
              onClick={() => send()}
              aria-label="Enviar mensaje"
            >
              <ArrowUp size={18} />
            </button>
          )}
        </div>
        <p className="ia-hint">
          El asistente puede cometer errores. Verifica la información importante.
        </p>
      </div>
    </div>
  )
}
