'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * The "done" mark: fades in while rotating upright, bobs into place, and draws
 * its own stroke. Replaces the static check icon on the screens that report a
 * finished action — account created, password reset, code sent.
 *
 * `stroke-dasharray` ships as a placeholder in the stylesheet; it has to be the
 * real path length or the stroke either pre-reveals or overdraws. It is
 * measured here, and only then is `data-state="in"` set, so the draw always
 * starts from a fully hidden stroke.
 */
export default function SuccessCheck({ size = 34 }: { size?: number }) {
  const pathRef = useRef<SVGPathElement>(null)
  const [len, setLen] = useState<number | null>(null)

  useEffect(() => {
    const path = pathRef.current
    if (!path) return
    setLen(Math.ceil(path.getTotalLength()) + 1)
  }, [])

  return (
    <span className="t-success-check" data-state={len === null ? 'out' : 'in'} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path
          ref={pathRef}
          d="M4 12.5 L9.5 18 L20 6.5"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={len === null ? undefined : { strokeDasharray: len, strokeDashoffset: len }}
        />
      </svg>
    </span>
  )
}
