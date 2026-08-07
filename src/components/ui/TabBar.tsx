'use client'

import { useEffect, useRef, useCallback } from 'react'

export interface TabItem { key: string; label: React.ReactNode }

interface TabBarProps {
  items: TabItem[]
  value: string
  onChange: (key: string) => void
  className?: string
  style?: React.CSSProperties
}

/* Sliding-pill segmented control (transitions.dev tabs sliding, app-styled).
   The pill's transform + width are written inline so the CSS transition
   tweens between the previous and next measured tab positions. */
export default function TabBar({ items, value, onChange, className = '', style }: TabBarProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLSpanElement>(null)
  const mounted = useRef(false)

  const move = useCallback((animate: boolean) => {
    const idx = items.findIndex((i) => i.key === value)
    const root = rootRef.current
    const pill = pillRef.current
    if (!root || !pill || idx < 0) return
    const btn = root.querySelectorAll<HTMLButtonElement>('.tabbar-tab')[idx]
    if (!btn) return
    // `offsetLeft` is measured against `.tabbar` itself, so the pill stays
    // aligned no matter how far the rail is scrolled.
    const apply = () => { pill.style.transform = `translateX(${btn.offsetLeft}px)`; pill.style.width = `${btn.offsetWidth}px` }
    // On a narrow screen the rail scrolls, and the tab just selected can sit
    // outside the visible slice.
    if (animate) {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      btn.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
    }
    if (!animate) {
      const prev = pill.style.transition
      pill.style.transition = 'none'
      apply()
      void pill.offsetWidth
      pill.style.transition = prev
    } else {
      apply()
    }
  }, [items, value])

  // First paint (and every resize) snaps the pill into place with no
  // transition; only a real tab change should animate the slide.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      const id = requestAnimationFrame(() => move(false))
      return () => cancelAnimationFrame(id)
    }
    move(true)
  }, [move])

  useEffect(() => {
    const onResize = () => move(false)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [move])

  return (
    <div ref={rootRef} className={`tabbar ${className}`} role="tablist" style={style}>
      <span ref={pillRef} className="tabbar-pill" aria-hidden="true" />
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          role="tab"
          aria-selected={it.key === value}
          className={`tabbar-tab${it.key === value ? ' on' : ''}`}
          onClick={() => onChange(it.key)}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}
