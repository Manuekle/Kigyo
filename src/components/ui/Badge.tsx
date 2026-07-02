import type { StatusTone } from '@/lib/types'
import { tone as toTone } from '@/lib/utils'

interface BadgeProps {
  st: string
  tone?: StatusTone
  filled?: boolean
  className?: string
}

export default function Badge({ st, tone, filled = false, className = '' }: BadgeProps) {
  const t = tone ?? toTone(st)
  const colorClass = `b-${t}`
  const filledClass = filled ? ` filled-${t}` : ''
  return (
    <span className={`badge ${colorClass}${filledClass} ${className}`}>
      <span className="bd" />
      {st}
    </span>
  )
}
