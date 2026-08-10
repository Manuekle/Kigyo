'use client'

import { useEffect, useRef, useState } from 'react'

import { cssDurationMs } from '@/lib/motion'

/**
 * Swaps its text in place instead of cutting: the old string exits upward with
 * a blur, the new one enters from below. Used on labels that change under the
 * user — a submit button turning into "Iniciando sesión…", a status line
 * turning into "Guardado".
 *
 * The three phases come from the transitions.dev text-swap recipe: exit, then
 * commit the new text while parked below with no transition, then release. The
 * reflow between the last two is what makes the browser animate the release
 * rather than collapsing both changes into one paint.
 */
export default function TextSwap({ children, className = '' }: { children: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [text, setText] = useState(children)
  const pending = useRef(children)

  useEffect(() => {
    if (children === pending.current) return
    pending.current = children

    const el = ref.current
    if (!el) { setText(children); return }

    const dur = cssDurationMs('--text-swap-dur', 200)

    el.classList.add('is-exit')
    const t = setTimeout(() => {
      setText(children)
      el.classList.remove('is-exit')
      el.classList.add('is-enter-start')
      void el.offsetHeight // force reflow so the release transitions
      el.classList.remove('is-enter-start')
    }, dur)
    return () => clearTimeout(t)
  }, [children])

  return (
    <span ref={ref} className={`t-text-swap${className ? ` ${className}` : ''}`}>
      {text}
    </span>
  )
}
