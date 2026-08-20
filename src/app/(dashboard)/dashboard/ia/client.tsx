'use client'

import { useEffect, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from 'ai'
import {
  ArrowUp,
  PenLine,
  Package,
  ShieldAlert,
  Ticket,
  Square,
  RotateCcw,
} from '@/lib/icons'
import { BorderBeam } from 'border-beam'
import { ThinkingOrb } from 'thinking-orbs'
import type { OrbState } from 'thinking-orbs'
import { useApp } from '@/lib/context/AppContext'
import { useSound } from '@/lib/context/SoundContext'
import { useTheme } from '@/lib/context/ThemeContext'
import MetaBalls from '@/components/ui/MetaBalls'
import { AgentActivity, type AgentActivityItem } from '@/components/ai/AgentActivity'
import { ApprovalCard, type ApprovalCardStatus } from '@/components/ai/ApprovalCard'
import { citationDomain, type CitationItem } from '@/components/ai/Citations'
import { StreamingResponse } from '@/components/ai/StreamingResponse'
import { ThinkingShimmer } from '@/components/ai/TextShimmer'
import { TodoList, type TodoItem } from '@/components/ai/TodoList'
import type { ChatMetadata, KigyoUIMessage } from '@/lib/ai/types'

/**
 * Assistant chat.
 *
 * The turn is shown in three layers, and each one owns a different question:
 *
 *   - `TodoList` — *what is it going to do*. Only while the turn runs, one
 *     task per tool call, so a question that hits five tables looks like
 *     progress instead of a stall.
 *   - `AgentActivity` — *what did it do*. Takes over once the turn ends,
 *     collapsed to a single line; the retrieved documents and the tables it
 *     read live behind it.
 *   - `StreamingResponse` — the answer, plus what you can do with it.
 *
 * They are never on screen at the same time for the same turn: the plan is
 * live state, the trace is a record, and showing both is the same information
 * twice.
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

/** Qué consulta cada herramienta, en las palabras del producto. */
const TOOL_LABEL: Record<string, string> = {
  firmasPendientes: 'Firmas pendientes',
  ticketsAbiertos: 'Tickets abiertos',
  estadoInventario: 'Estado del inventario',
  riesgosAbiertos: 'Riesgos abiertos',
  cumplimientoDocumental: 'Cumplimiento documental',
  resumenEquipo: 'Resumen del equipo',
  crearTicket: 'Crear ticket',
}

type ToolPart = ReturnType<typeof toolParts>[number]

function messageText(message: KigyoUIMessage): string {
  return (message.parts ?? [])
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('')
}

function toolParts(message: KigyoUIMessage) {
  return (message.parts ?? []).filter(isToolUIPart)
}

function toolLabel(part: ToolPart): string {
  const name = getToolName(part)
  return TOOL_LABEL[name] ?? name
}

/**
 * Cuántas filas devolvió una herramienta.
 *
 * Todas devuelven `total` cuando cuentan algo; las que no (un resumen, un
 * ticket creado) no tienen nada que contar y se quedan sin cifra en vez de
 * inventarse una.
 */
function outputCount(output: unknown): number | undefined {
  if (!output || typeof output !== 'object') return undefined
  const total = (output as { total?: unknown }).total
  return typeof total === 'number' ? total : undefined
}

/** El plan del turno: una tarea por llamada a herramienta. */
function planItems(message: KigyoUIMessage): TodoItem[] {
  return toolParts(message).map((part) => {
    const status: TodoItem['status'] =
      part.state === 'output-available'
        ? 'completed'
        : part.state === 'output-error' || part.state === 'output-denied'
          ? 'cancelled'
          : part.state === 'approval-requested' || part.state === 'approval-responded'
            ? 'pending'
            : 'in-progress'

    const count = part.state === 'output-available' ? outputCount(part.output) : undefined

    return {
      id: part.toolCallId,
      title: toolLabel(part),
      status,
      detail: count === undefined ? undefined : `${count}`,
    }
  })
}

/**
 * La traza del turno: lo que se recuperó y lo que se consultó.
 *
 * La fila de búsqueda se arma con las citas que el servidor adjuntó al
 * mensaje, así que describe la recuperación que de verdad ocurrió y no una
 * llamada que el cliente supone.
 */
function traceItems(
  message: KigyoUIMessage,
  question: string,
  citations: CitationItem[],
): AgentActivityItem[] {
  const items: AgentActivityItem[] = []

  if (citations.length > 0) {
    items.push({
      id: `${message.id}-recuperacion`,
      type: 'search',
      query: question || 'Base de conocimiento',
      results: citations.slice(0, 4).map((citation) => ({
        id: citation.id,
        title: citation.title,
        domain: citation.domain,
        url: citation.url,
      })),
      moreCount: Math.max(0, citations.length - 4),
    })
  }

  for (const part of toolParts(message)) {
    if (part.state === 'approval-requested' || part.state === 'approval-responded') continue

    const count = part.state === 'output-available' ? outputCount(part.output) : undefined
    items.push({
      id: part.toolCallId,
      type: 'tool',
      action: getToolName(part) === 'crearTicket' ? 'edit' : 'read',
      target: toolLabel(part),
      count,
      status: part.state === 'output-available' ? 'complete' : 'active',
    })
  }

  return items
}

/** Los datos que el modelo propone escribir, tal como llegaron. */
function ticketProposal(input: unknown) {
  const value = (input ?? {}) as {
    asunto?: string
    descripcion?: string
    area?: string
    prioridad?: string
  }
  return {
    asunto: value.asunto ?? 'Ticket sin asunto',
    descripcion: value.descripcion ?? '',
    area: value.area ?? 'Otro',
    prioridad: value.prioridad ?? 'Media',
  }
}

function approvalStatus(part: ToolPart): ApprovalCardStatus {
  if (part.state === 'approval-requested') return 'pending'
  if (part.state === 'approval-responded') return 'submitting'
  if (part.state === 'output-denied') return 'rejected'
  if (part.state === 'output-error') return 'failed'
  if (part.state === 'output-available') {
    const output = part.output as { creado?: boolean; error?: string } | undefined
    return output?.creado ? 'approved' : 'failed'
  }
  return 'submitting'
}

function approvalResult(part: ToolPart): string | undefined {
  if (part.state === 'output-denied') return 'No se creó nada.'
  if (part.state === 'output-error') return part.errorText
  if (part.state === 'output-available') {
    const output = part.output as { creado?: boolean; codigo?: string; error?: string } | undefined
    if (output?.creado) return `Ticket ${output.codigo} creado.`
    return output?.error ?? 'No se pudo crear el ticket.'
  }
  return undefined
}

/**
 * En qué anda el asistente, en el vocabulario del orbe.
 *
 * Cada estado corresponde a una fase real del turno, no a un adorno que rota:
 * si el orbe dice `searching` es porque hay una consulta en vuelo, y si dice
 * `shaping` es porque la escritura está esperando una decisión humana.
 */
function orbState({
  busy,
  typing,
  streaming,
  running,
  awaitingApproval,
}: {
  busy: boolean
  typing: boolean
  streaming: boolean
  /** Herramientas con la llamada en vuelo. */
  running: number
  awaitingApproval: boolean
}): OrbState {
  if (awaitingApproval) return 'shaping'
  if (!busy) return typing ? 'listening' : 'breathing'
  if (running > 1) return 'weaving'
  if (running === 1) return 'searching'
  if (streaming) return 'composing'
  return 'connecting'
}

export default function IAPage() {
  const { addToast } = useApp()
  const { cue } = useSound()
  const { theme } = useTheme()
  // MetaBalls paints into a transparent canvas, so it needs the ink
  // colour outright — white blobs on a white page would vanish.
  const orbInk = theme === 'dark' ? '#ffffff' : '#161616'
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const {
    messages,
    sendMessage,
    status,
    stop,
    error,
    regenerate,
    clearError,
    addToolApprovalResponse,
  } = useChat<KigyoUIMessage>({
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
    // Aprobar o descartar reanuda el turno solo: la decisión viaja de vuelta
    // al modelo sin que la persona tenga que escribir «sí» a mano.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onError(streamError) {
      addToast(streamError.message || 'El asistente falló al responder', 'err')
    },
  })

  const busy = status === 'submitted' || status === 'streaming'
  const lastMessage = messages[messages.length - 1]
  const lastIsAssistant = lastMessage?.role === 'assistant'
  const liveTools = lastIsAssistant ? toolParts(lastMessage) : []
  const runningTools = liveTools.filter(
    (part) => part.state === 'input-streaming' || part.state === 'input-available',
  ).length
  const awaitingApproval = liveTools.some((part) => part.state === 'approval-requested')

  const orb = orbState({
    busy,
    typing: input.trim().length > 0,
    streaming: status === 'streaming' && Boolean(lastIsAssistant && messageText(lastMessage)),
    running: runningTools,
    awaitingApproval,
  })

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, status])

  // Chime when an answer lands. Gated on the previous status so it only fires
  // for a turn that actually streamed — not on the 'ready' the hook reports
  // before anything has been sent.
  const prevStatus = useRef(status)
  useEffect(() => {
    if (prevStatus.current === 'streaming' && status === 'ready') cue('ready')
    prevStatus.current = status
  }, [status, cue])

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
                  color={orbInk}
                  cursorBallColor={orbInk}
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
              <h2 className="ia-title">¿En qué puedo ayudarte?</h2>
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
                {messages.map((message, index) => {
                  if (message.role === 'user') {
                    return (
                      <div className="ia-row me" key={message.id}>
                        <div className="ia-bub">{messageText(message)}</div>
                      </div>
                    )
                  }

                  const metadata = message.metadata as ChatMetadata | undefined
                  const text = messageText(message)
                  const tools = toolParts(message)
                  const active = busy && index === messages.length - 1
                  const question = messageText(messages[index - 1] ?? message)

                  const citations: CitationItem[] = (metadata?.citations ?? []).map((citation) => ({
                    id: citation.id,
                    title: citation.title,
                    url: citation.url ?? undefined,
                    domain: citationDomain(citation.url ?? undefined),
                  }))
                  const trace = traceItems(message, question, citations)
                  const plan = planItems(message)
                  const approvals = tools.filter((part) => getToolName(part) === 'crearTicket')

                  return (
                    <div className="ia-row ai" key={message.id}>
                      <div className="ia-bub">
                        {active && plan.length > 0 ? (
                          <TodoList
                            items={plan}
                            title="Plan de la consulta"
                            collapseOnComplete={false}
                            className="mb-3"
                          />
                        ) : null}

                        {(active && plan.length === 0) || (!active && trace.length > 0) ? (
                          <AgentActivity
                            items={trace}
                            status={active ? 'working' : 'complete'}
                            className="mb-2"
                            renderWorkingStatus={({ label }) => (
                              <span className="ia-thinking">
                                <ThinkingOrb
                                  state={orb}
                                  size={20}
                                  theme={theme}
                                  aria-hidden="true"
                                />
                                <ThinkingShimmer>{label}</ThinkingShimmer>
                              </span>
                            )}
                          />
                        ) : null}

                        {approvals.map((part) => {
                          const proposal = ticketProposal(part.input)
                          const cardStatus = approvalStatus(part)
                          const waiting = part.state === 'approval-requested'
                          const approvalId = part.approval?.id

                          return (
                            <ApprovalCard
                              key={part.toolCallId}
                              className="my-3"
                              title="Crear ticket"
                              description={
                                waiting
                                  ? 'El asistente propone abrir este ticket. No se crea hasta que lo apruebes.'
                                  : undefined
                              }
                              status={cardStatus}
                              result={approvalResult(part)}
                              approveLabel="Crear ticket"
                              onApprove={
                                waiting && approvalId
                                  ? () =>
                                      addToolApprovalResponse({ id: approvalId, approved: true })
                                  : undefined
                              }
                              onReject={
                                waiting && approvalId
                                  ? () =>
                                      addToolApprovalResponse({ id: approvalId, approved: false })
                                  : undefined
                              }
                            >
                              <dl className="ia-proposal">
                                <div>
                                  <dt>Asunto</dt>
                                  <dd>{proposal.asunto}</dd>
                                </div>
                                <div>
                                  <dt>Área</dt>
                                  <dd>{proposal.area}</dd>
                                </div>
                                <div>
                                  <dt>Prioridad</dt>
                                  <dd>{proposal.prioridad}</dd>
                                </div>
                                {proposal.descripcion ? (
                                  <div className="ia-proposal-full">
                                    <dt>Descripción</dt>
                                    <dd>{proposal.descripcion}</dd>
                                  </div>
                                ) : null}
                              </dl>
                            </ApprovalCard>
                          )
                        })}

                        {text ? (
                          <StreamingResponse
                            status={active ? 'streaming' : 'complete'}
                            copyText={text}
                            onRetry={index === messages.length - 1 ? () => regenerate() : undefined}
                            sources={citations}
                            // El contenedor de la conversación ya anuncia el
                            // texto; anunciarlo otra vez lo lee dos veces.
                            announce={false}
                          >
                            {text}
                          </StreamingResponse>
                        ) : null}

                        {metadata?.partialRetrieval && (
                          <p className="ia-warn">
                            Una fuente de conocimiento no respondió; el contexto puede estar
                            incompleto.
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {status === 'submitted' && !lastIsAssistant && (
                <div className="ia-row ai">
                  <div className="ia-bub">
                    <span className="ia-thinking">
                      <ThinkingOrb state={orb} size={20} theme={theme} aria-hidden="true" />
                      <ThinkingShimmer>Analizando datos</ThinkingShimmer>
                    </span>
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
        {/* The beam runs only while a turn is in flight, so the composer itself
            carries the "working" state — `active` fades it in and out rather
            than mounting/unmounting, which would pop. `mono` + `staticColors`
            keeps it inside the monochrome palette instead of cycling hues.
            The radius is passed explicitly: auto-detection would read the
            pill's 999px and trace a shape far larger than the box. */}
        <BorderBeam
          active={busy}
          size="md"
          colorVariant="mono"
          theme={theme}
          staticColors
          borderRadius={28}
        >
          <div className="ia-box">
            {/* El orbe es el estado del asistente, no un adorno: respira en
                reposo, escucha mientras se escribe, y durante el turno dice
                si está consultando, redactando o esperando una aprobación. */}
            <span className="ia-orb" aria-hidden="true">
              <ThinkingOrb state={orb} size={20} theme={theme} />
            </span>
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
              <button
                type="button"
                className="ia-go"
                onClick={() => stop()}
                aria-label="Detener respuesta"
                data-cuelume-press="tick"
              >
                <Square size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="ia-go"
                disabled={!input.trim()}
                onClick={() => send()}
                aria-label="Enviar mensaje"
                data-cuelume-press="press"
              >
                <ArrowUp size={18} />
              </button>
            )}
          </div>
        </BorderBeam>
        <p className="ia-hint">
          El asistente puede cometer errores. Verifica la información importante.
        </p>
      </div>
    </div>
  )
}
