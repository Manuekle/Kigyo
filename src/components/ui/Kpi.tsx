import type { ReactNode } from 'react'
import { TrendingUp } from '@/lib/icons'

interface KpiProps {
  label: string
  value: string | number
  sub?: string
  delta?: string
  dir?: 'up' | 'dn'
  iconBg?: string
  glowColor?: string
  icon: ReactNode
  className?: string
}

export default function Kpi({ label, value, sub, delta, dir = 'up', iconBg = 'var(--red)', glowColor, icon, className = '' }: KpiProps) {
  return (
    <div className={`card kpi ${className}`}>
      <div className="kglow" style={{ background: glowColor ?? iconBg }} />
      <div className="klab">
        <span className="kico" style={{ background: iconBg }}>{icon}</span>
        {label}
      </div>
      <div className="kval">{value}</div>
      <div className="kfoot">
        {delta && (
          <span className={`delta ${dir}`}>
            <TrendingUp size={10} />
            {delta}
          </span>
        )}
        {sub && <span className="kvs">{sub}</span>}
      </div>
    </div>
  )
}
