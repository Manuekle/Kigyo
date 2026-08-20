'use client'

import { useId } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@/lib/icons'
import { useFocusTrap } from '@/lib/hooks/use-focus-trap'
import { PANEL_CLOSE_MS, useExitTransition } from '@/lib/hooks/use-exit-transition'

interface FormDrawerProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  /** 620px instead of 480px — for forms with a line-item repeater. */
  wide?: boolean
}

/**
 * Side sheet for a long form.
 *
 * `Modal` is the right shape for a short, focused decision — four fields, or a
 * confirm. It is the wrong shape for the editors that grew a supplier, a
 * category, an urgency, a project, an owner and then a repeating list of line
 * items: a centred 440px box capped at 90vh turns those into a small scrolling
 * window floating over a blurred page, with the primary action pushed out of
 * sight below the fold and no stable reference to the page behind it.
 *
 * A sheet is full-height by construction, so the same form gets roughly twice
 * the vertical run before anything scrolls, and its header and footer stay
 * pinned while the body moves.
 *
 * Kept separate from `Drawer`, which is a read-only detail panel driven by a
 * record rather than a boolean and takes its body as a render prop.
 */
export default function FormDrawer({
  open, onClose, title, children, footer, wide,
}: FormDrawerProps) {
  const { render, shown } = useExitTransition(open, PANEL_CLOSE_MS)
  const titleId = useId()

  // Same trap the modal uses: without it Tab walks out of the sheet into the
  // page behind, which is still fully laid out beside it.
  const trapRef = useFocusTrap<HTMLDivElement>(open, { onEscape: onClose })

  if (!render || typeof document === 'undefined') return null

  return createPortal(
    <div ref={trapRef}>
      <div className="ovl" data-open={shown} onClick={onClose} />
      {/* `inert` while closing: the sheet is still painted for its exit, and
          its controls must not be tabbable or clickable during it. */}
      <aside
        className={`drawer fdrawer${wide ? ' fdrawerw' : ''}`}
        data-open={shown}
        inert={!open}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="fdhead">
          <span className="mtitle" id={titleId}>{title}</span>
          <button type="button" className="ibtn" aria-label="Cerrar" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="fdbody">{children}</div>
        {footer && <div className="fdfoot">{footer}</div>}
      </aside>
    </div>,
    document.body,
  )
}
