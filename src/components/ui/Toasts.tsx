'use client'

import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, XCircle, Info, AlertTriangle, X } from '@/lib/icons'
import { useApp } from '@/lib/context/AppContext'
import type { Toast } from '@/lib/types'

const ICONS = {
  ok: <CheckCircle size={13} />,
  err: <XCircle size={13} />,
  info: <Info size={13} />,
  warn: <AlertTriangle size={13} />,
}

const VISIBLE_MS = 4000
const EXIT_MS = 220 // matches .toast.out (toastout .22s)

function ToastItem({ t, onRemove }: { t: Toast; onRemove: (id: number) => void }) {
  const [out, setOut] = useState(false)

  // Add .out to play the exit transition, then unmount once it finishes.
  const dismiss = useCallback(() => {
    setOut(true)
    setTimeout(() => onRemove(t.id), EXIT_MS)
  }, [t.id, onRemove])

  useEffect(() => {
    const timer = setTimeout(dismiss, VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [dismiss])

  return (
    <div
      className={`toast${out ? ' out' : ''}`}
      // Errors interrupt; everything else waits for a pause in speech.
      role={t.type === 'err' ? 'alert' : 'status'}
    >
      <span className={`tci ${t.type}`} aria-hidden="true">{ICONS[t.type]}</span>
      <span className="tmsg">{t.msg}</span>
      {t.action && (
        <button className="tact" onClick={() => { t.onAction?.(); dismiss() }}>
          {t.action}
        </button>
      )}
      <button aria-label="Cerrar notificación" onClick={dismiss} style={{ marginLeft: 4, color: 'var(--ink3)' }}>
        <X size={13} aria-hidden="true" />
      </button>
    </div>
  )
}

export default function Toasts() {
  const { toasts, removeToast } = useApp()

  /**
   * The live region is always mounted, even with nothing in it.
   *
   * A region inserted at the same moment as its first message is frequently
   * missed by screen readers: they only announce changes *inside* a region
   * they were already observing. Unmounting on empty — which this component
   * used to do — reintroduces that bug on every toast.
   */
  return (
    <div className="toasts" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} onRemove={removeToast} />
      ))}
    </div>
  )
}
