'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { cssDurationMs } from '@/lib/motion'

/**
 * Percussive "this is wrong" feedback for a form: the field group shakes once
 * and the message under it fades in, then both revert on their own after the
 * hold. Before this, a failed sign-in only swapped in a line of text below the
 * fold of the user's attention — nothing moved, so nothing said "look here".
 *
 * Two pieces of state rather than one: `message` owns whether the node exists,
 * `isError` owns the visible treatment. Mounting the message one frame before
 * flipping `isError` is what gives the browser a "before" to fade from, and
 * keeping the message mounted through the fade-out is what stops the text from
 * disappearing mid-transition.
 *
 * `is-shaking` stays orthogonal to `is-error` for the same reason the recipe
 * asks for it: the shake must be removable and re-addable (with a reflow
 * between) to replay on a second failed attempt, without flickering the error
 * treatment underneath.
 *
 * The element type is a parameter so the shake target can be the control
 * itself, not only a wrapper: the auth screens shake a whole `<div>` field
 * group because a rejected sign-in cannot say which field was wrong, while a
 * form that validates field by field shakes each `<input>` that came back
 * empty. Defaults to `HTMLDivElement`, so existing call sites are unchanged.
 */
export function useErrorShake<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const frame = useRef(0)

  const cancel = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    if (frame.current) cancelAnimationFrame(frame.current)
    frame.current = 0
  }, [])

  useEffect(() => cancel, [cancel])

  const clearError = useCallback(() => {
    cancel()
    setIsError(false)
    const revert = cssDurationMs('--revert-dur', 240)
    timers.current.push(setTimeout(() => setMessage(''), revert))
  }, [cancel])

  const setError = useCallback((next: string) => {
    cancel()
    if (!next) { clearError(); return }

    setMessage(next)
    // One frame later so the message has a painted "before" to fade from. The
    // timeout is the backstop: rAF is throttled to a standstill in a hidden
    // tab, and an error that never gets `is-error` would sit there invisible.
    frame.current = requestAnimationFrame(() => setIsError(true))
    timers.current.push(setTimeout(() => setIsError(true), 32))

    const el = ref.current
    if (el) {
      el.classList.remove('is-shaking')
      void el.offsetWidth // force reflow so a repeat failure shakes again
      el.classList.add('is-shaking')
      const shakeMs = cssDurationMs('--shake-dur-a', 80) * 2 + cssDurationMs('--shake-dur-b', 60) * 2
      timers.current.push(setTimeout(() => el.classList.remove('is-shaking'), shakeMs + 20))
      timers.current.push(setTimeout(clearError, shakeMs + cssDurationMs('--revert-hold', 2800)))
    }
  }, [cancel, clearError])

  return { ref, message, isError, setError, clearError }
}
