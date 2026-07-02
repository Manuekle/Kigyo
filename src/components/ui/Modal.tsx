'use client'

import { useEffect, useState } from 'react'
import { X } from '@/lib/icons'

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

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!render) return null

  const closing = render && !open
  const state = shown ? ' is-open' : closing ? ' is-closing' : ''

  return (
    <div
      className={`mwrap${closing ? ' is-closing' : ''}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={`modal t-modal${wide ? ' modalw' : ''}${state}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mhead">
          <span className="mtitle">{title}</span>
          <button className="ibtn" aria-label="Cerrar" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="mbody">{children}</div>
        {footer && <div className="mfoot">{footer}</div>}
      </div>
    </div>
  )
}
