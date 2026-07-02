'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, ArrowUp, PenLine, Package, ShieldAlert, Ticket } from '@/lib/icons'
import { useApp } from '@/lib/context/AppContext'
import MetaBalls from '@/components/ui/MetaBalls'
import TypingAnimation from '@/components/ui/TypingAnimation'

interface Msg {
  role: 'user' | 'bot'
  content: string
}

/* Simulated responses keyed to the Whitebox system data. */
function simulatedReply(text: string): string {
  const q = text.toLowerCase()
  if (q.includes('firma') || q.includes('pendiente')) {
    return 'Hay 3 firmas pendientes:\n• Contrato laboral de Sebastián Cano (2 días)\n• Política de seguridad de Juan Pérez (8 días)\n• Anexo de teletrabajo de María González (VENCIDO, 18 días).'
  }
  if (q.includes('ticket')) {
    return 'Tickets de soporte: 12 en total (4 abiertos, 3 en proceso, 5 resueltos). Abiertos destacados: TK-1287 "Certificado laboral" (Personas), TK-1284 "Ajuste de liquidación de nómina" (Nómina, prioridad alta) y TK-1281 "Revisión de contrato de proveedor" (Legal). Tiempo medio de primera respuesta: 5.2 h.'
  }
  if (q.includes('inventario')) {
    return 'Inventario: 234 activos (188 asignados, 34 disponibles, 12 en mantenimiento). 2 equipos sin asignar: iPhone 15 y Dell Latitude. Pedidos de compra: 2 solicitados, 1 aprobado, 1 ya facturado.'
  }
  if (q.includes('riesgo') || q.includes('cumplimiento')) {
    return 'Cumplimiento documental: 94%. 3 contratos vencen este mes (antes del 30 jun 2026). Revisa los anexos vencidos y renueva los contratos a término fijo.'
  }
  if (q.includes('recordatorio')) {
    return 'Hola, te recordamos firmar tus documentos pendientes en Whitebox:\n• Contrato laboral (Sebastián Cano)\n• Política de seguridad (Juan Pérez)\n• Anexo de teletrabajo (María González — vencido).\nPor favor complétalas hoy. ¡Gracias!'
  }
  return 'Estoy analizando los datos de Whitebox para darte una respuesta precisa. ¿Puedes darme más detalles sobre lo que necesitas saber?'
}

export default function IAPage() {
  const { addToast } = useApp()
  const LOADING_PHRASES = [
    'Escribiendo', 'Investigando', 'Buscando en proyectos',
    'Analizando datos', 'Consultando registros', 'Procesando solicitud',
    'Revisando documentos', 'Calculando',
  ]

  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, loading])

  // Neutralize the dashboard .content padding/scroll so the composer stays
  // pinned to the bottom and doesn't ride up when messages are sent.
  useEffect(() => {
    const el = document.querySelector('.content')
    el?.classList.add('content-chat')
    return () => el?.classList.remove('content-chat')
  }, [])

  const autoResize = () => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'
  }

  function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return
    const next: Msg[] = [...msgs, { role: 'user', content }]
    setMsgs(next); setInput('')
    if (taRef.current) taRef.current.style.height = 'auto'
    setLoadingMsg(LOADING_PHRASES[Math.floor(Math.random() * LOADING_PHRASES.length)])
    setLoading(true)
    setTimeout(() => {
      setMsgs((m) => [...m, { role: 'bot', content: simulatedReply(content) }])
      setLoading(false)
    }, 1100)
  }

  const SUGGESTIONS = [
    { icon: <PenLine size={15} />, label: 'Firmas pendientes', tone: 'blu' },
    { icon: <Package size={15} />, label: 'Estado del inventario', tone: 'grn' },
    { icon: <ShieldAlert size={15} />, label: 'Riesgos este mes', tone: 'red' },
    { icon: <Ticket size={15} />, label: 'Tickets abiertos', tone: 'amb' },
  ]

  return (
    <div className="ia-page">
      <div className="ia-msgs">
        <div className="ia-inner">
          {msgs.length === 0 && !loading ? (
            <div className="ia-welcome">
              <div className="w-[200px] h-[200px] mb-6">
                <MetaBalls
                  color="#ffffff"
                  cursorBallColor="#ffffff"
                  cursorBallSize={2}
                  ballCount={15}
                  animationSize={30}
                  enableMouseInteraction={true}
                  enableTransparency={true}
                  hoverSmoothness={0.05}
                  clumpFactor={1}
                  speed={0.3}
                />
              </div>
              <h1 className="ia-title">¿En qué puedo ayudarte?</h1>
              <p className="ia-sub">Consulta firmas, inventario, riesgos, tickets y cumplimiento en lenguaje natural.</p>
              <div className="ia-chips">
                {SUGGESTIONS.map((s) => (
                  <button key={s.label} className={`ia-chip ${s.tone}`} onClick={() => send(s.label)}>
                    {s.icon}
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {msgs.map((m, i) => (
                <div className={`ia-row ${m.role === 'user' ? 'me' : 'ai'}`} key={i}>
                  {m.role === 'bot' ? (
                    <TypingAnimation className="ia-bub" startOnView={false} duration={15}>
                      {m.content}
                    </TypingAnimation>
                  ) : (
                    <div className="ia-bub">{m.content}</div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="ia-row ai">
                  <div className="ia-bub">
                    <span className="t-shimmer" data-text={loadingMsg}>{loadingMsg}</span>
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
          <button className="ia-attach" data-tip="Adjuntar" onClick={() => addToast('Adjuntar próximamente', 'info')}>
            <Plus size={18} />
          </button>
          <textarea ref={taRef} rows={1} className="ia-text"
            placeholder="Escribe un mensaje…" value={input}
            onChange={(e) => { setInput(e.target.value); autoResize() }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
          <button className="ia-go" disabled={!input.trim() || loading} onClick={() => send()}>
            <ArrowUp size={18} />
          </button>
        </div>
        <p className="ia-hint">El asistente puede cometer errores. Verifica la información importante.</p>
      </div>
    </div>
  )
}
