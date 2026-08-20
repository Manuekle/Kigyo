'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { MorphingModal } from '@/components/ai/MorphingModal'

export interface ConfirmRequest {
  /** La pregunta, en una línea. */
  title: string
  /** Qué pasa si se confirma; lo que el `confirm` nativo no podía decir. */
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** `danger` para lo que destruye o no se puede deshacer. */
  tone?: 'danger' | 'default'
}

type ConfirmFn = (request: ConfirmRequest) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

interface Pending extends ConfirmRequest {
  id: string
  resolve: (value: boolean) => void
}

/**
 * Confirmaciones de la aplicación, en un diálogo propio.
 *
 * Sustituye a `window.confirm`, que traía tres problemas y no uno: el navegador
 * lo pinta con su propio tipo de letra y sus propios botones, congela el hilo
 * mientras está abierto, y solo admite una línea de texto — así que la
 * consecuencia («el archivo se conserva pero deja de aparecer») acababa metida
 * dentro de la misma frase que la pregunta.
 *
 * La promesa es lo que mantiene la migración barata: quien llamaba
 * `if (!window.confirm(x)) return` ahora llama `if (!(await confirm({...})))
 * return` y no cambia nada más.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const counter = useRef(0)
  const titleId = useId()

  const confirm = useCallback<ConfirmFn>((request) => {
    return new Promise<boolean>((resolve) => {
      counter.current += 1
      setPending({ ...request, id: `confirm-${counter.current}`, resolve })
    })
  }, [])

  // El foco entra en el botón de confirmar, que es donde estaba en el diálogo
  // nativo; sin esto el tabulador seguiría en la página de debajo.
  useEffect(() => {
    if (!pending) return
    const frame = requestAnimationFrame(() => confirmRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [pending])

  const settle = useCallback((value: boolean) => {
    setPending((current) => {
      current?.resolve(value)
      return null
    })
  }, [])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <MorphingModal
        viewId={pending?.id ?? null}
        onClose={() => settle(false)}
        labelledBy={titleId}
        className="mm-confirm"
      >
        {pending ? (
          <>
            <h2 id={titleId} className="mm-title">{pending.title}</h2>
            {pending.description ? <p className="mm-desc">{pending.description}</p> : null}
            <div className="mm-actions">
              <button type="button" className="btn ghost" onClick={() => settle(false)}>
                {pending.cancelLabel ?? 'Cancelar'}
              </button>
              <button
                ref={confirmRef}
                type="button"
                className={pending.tone === 'danger' ? 'btn danger' : 'btn dark'}
                onClick={() => settle(true)}
                data-cuelume-press="press"
              >
                {pending.confirmLabel ?? 'Confirmar'}
              </button>
            </div>
          </>
        ) : null}
      </MorphingModal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider')
  return ctx
}
