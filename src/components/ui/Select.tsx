'use client'

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from '@/lib/icons'
import { DROPDOWN_CLOSE_MS, dropdownClass, useExitTransition } from '@/lib/hooks/use-exit-transition'

type Opt = string | { value: string; label: string }

interface SelectProps {
  value: string
  onChange: (v: string) => void
  options: Opt[]
  placeholder?: string
  className?: string
  style?: React.CSSProperties
}

const norm = (o: Opt) => (typeof o === 'string' ? { value: o, label: o } : o)

export default function Select({ value, onChange, options, placeholder = 'Seleccionar…', className = '', style }: SelectProps) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const ref = useRef<HTMLButtonElement>(null)
  const menu = useExitTransition(open, DROPDOWN_CLOSE_MS)
  const opts = options.map(norm)
  const selected = opts.find((o) => o.value === value)

  // Portals need `document`, which does not exist during SSR. useSyncExternalStore
  // answers "am I on the client?" without an effect, so there is no extra render
  // pass on mount — and the server snapshot keeps hydration consistent.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  const place = () => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    // open upward if not enough room below
    const below = window.innerHeight - r.bottom
    const estH = Math.min(opts.length * 40 + 12, 264)
    const top = below < estH + 12 && r.top > estH ? r.top - estH - 6 : r.bottom + 6
    setPos({ top, left: r.left, width: r.width })
  }

  useLayoutEffect(() => {
    if (open) place()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); ref.current?.focus() }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, opts.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
      else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
      else if (e.key === 'End') { e.preventDefault(); setActive(opts.length - 1) }
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        const o = opts[active]
        if (o) { onChange(o.value); setOpen(false); ref.current?.focus() }
      }
    }
    // reposition on scroll/resize so the menu tracks its trigger (never auto-dismiss)
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active])

  return (
    <div className={`nselect ${className}`} style={style}>
      <button
        type="button"
        ref={ref}
        className={`nselect-trigger${open ? ' open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => {
          if (!v) setActive(Math.max(0, opts.findIndex((o) => o.value === value)))
          return !v
        })}
      >
        <span className={selected ? '' : 'ph'}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={16} />
      </button>
      {menu.render && mounted && pos && createPortal(
        <>
          <div className="nselect-catch" onClick={() => setOpen(false)} />
          <div
            className={`nselect-menu ${dropdownClass(menu.shown, menu.closing)}`}
            role="listbox"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            {opts.map((o, i) => (
              <button
                type="button"
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                className={`nselect-item${o.value === value ? ' sel' : ''}${i === active ? ' active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => { onChange(o.value); setOpen(false) }}
              >
                <span>{o.label}</span>
                {o.value === value && <Check size={15} className="tick" />}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </div>
  )
}
