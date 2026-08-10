'use client'

import { useCallback, useEffect, useState } from 'react'
import { XCircle, Info, AlertTriangle, X } from '@/lib/icons'
import SuccessCheck from '@/components/ui/SuccessCheck'
import { useApp } from '@/lib/context/AppContext'
import { useSound } from '@/lib/context/SoundContext'
import type { Toast } from '@/lib/types'
import type { SoundName } from 'cuelume'

const ICONS = {
  // The success toast draws its check on arrival — the one toast that reports
  // something finished, rather than something happening.
  ok: <SuccessCheck size={14} />,
  err: <XCircle size={13} />,
  info: <Info size={13} />,
  warn: <AlertTriangle size={13} />,
}

/** One cue per toast type — a toast arriving is not a DOM event `bind()` sees. */
const CUES: Record<Toast['type'], SoundName> = {
  ok: 'success',
  err: 'error',
  info: 'droplet',
  warn: 'tick',
}

const VISIBLE_MS = 4000
const EXIT_MS = 220 // matches --toast-out-dur

function ToastItem({ t, onRemove }: { t: Toast; onRemove: (id: number) => void }) {
  const [out, setOut] = useState(false)
  const { cue } = useSound()

  // Add .out to play the exit transition, then unmount once it finishes.
  const dismiss = useCallback(() => {
    setOut(true)
    setTimeout(() => onRemove(t.id), EXIT_MS)
  }, [t.id, onRemove])

  useEffect(() => {
    const timer = setTimeout(dismiss, VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [dismiss])

  // Fires once per toast, on mount. A no-op while sound is off.
  useEffect(() => {
    cue(CUES[t.type])
  }, [cue, t.type])

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
