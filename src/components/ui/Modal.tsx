'use client'

import { useEffect, useId, useState } from 'react'
import { X } from '@/lib/icons'
import { useFocusTrap } from '@/lib/hooks/use-focus-trap'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  wide?: boolean
}

const CLOSE_MS = 140 // matches --modal-close-dur

export default function Modal({ open, onClose, title, children, footer, wide }: ModalProps) {
  const [render, setRender] = useState(open)
  const [shown, setShown] = useState(false)
  const [prevOpen, setPrevOpen] = useState(open)
  const titleId = useId()

  // Sync mount/visibility to `open` during render (the store-previous-state
  // pattern): mount immediately when opening, drop .is-open when closing.
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setRender(true)
    else setShown(false)
  }

  // Reveal on the next frame so the enter transition fires; keep the node
  // mounted for --modal-close-dur on close so the exit is visible.
  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => setShown(true))
      return () => cancelAnimationFrame(raf)
    }
    if (render) {
      const t = setTimeout(() => setRender(false), CLOSE_MS)
      return () => clearTimeout(t)
    }
  }, [open, render])

  // Traps focus, marks the rest of the page inert, restores focus on close and
  // handles Escape. Previously only Escape was handled: Tab walked straight
  // out of the dialog into the page behind it, with no way back.
  const trapRef = useFocusTrap<HTMLDivElement>(open, { onEscape: onClose })

  if (!render) return null

  const closing = render && !open
  const state = shown ? ' is-open' : closing ? ' is-closing' : ''

  return (
    <div
      ref={trapRef}
      className={`mwrap${closing ? ' is-closing' : ''}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={`modal t-modal${wide ? ' modalw' : ''}${state}`}
        role="dialog"
        aria-modal="true"
        // Points at the visible heading rather than duplicating it in an
        // aria-label, so the accessible name and the on-screen name match.
        aria-labelledby={titleId}
      >
        <div className="mhead">
          <span className="mtitle" id={titleId}>{title}</span>
          <button className="ibtn" aria-label="Cerrar" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="mbody">{children}</div>
        {footer && <div className="mfoot">{footer}</div>}
      </div>
    </div>
  )
}
