import type { Priority } from '@/lib/types'
import { prioTone } from '@/lib/utils'

interface PrioProps {
  p: Priority
}

export default function Prio({ p }: PrioProps) {
  const t = prioTone(p)
  return <span className={`badge b-${t}`}><span className="bd" />{p}</span>
}
