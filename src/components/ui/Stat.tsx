import type { ReactNode } from 'react'

interface StatProps {
  label: string
  value: string | number
  sub?: string
  tone?: string
  icon: ReactNode
  className?: string
}

export default function Stat({ label, value, sub, tone = 'ink', icon, className = '' }: StatProps) {
  return (
    <div className={`card kpi ${className}`}>
      <div className={`kglow ${tone}`} />
      <div className="klab">
        <span className={`kico-soft ${tone}`}>{icon}</span>
        {label}
      </div>
      <div className="kval">{value}</div>
      {sub && <div className="kvs" style={{ marginTop: 3 }}>{sub}</div>}
    </div>
  )
}
