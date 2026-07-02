import { CheckCircle, XCircle, Clock, AlertTriangle } from '@/lib/icons'
import type { ReactNode } from 'react'

type StatusType = 'ok' | 'err' | 'pending' | 'warn'

const ICONS: Record<StatusType, ReactNode> = {
  ok: <CheckCircle size={24} />,
  err: <XCircle size={24} />,
  pending: <Clock size={24} />,
  warn: <AlertTriangle size={24} />,
}

interface StatusCardProps {
  type: StatusType
  title: string
  sub?: string
  actions?: ReactNode
}

export default function StatusCard({ type, title, sub, actions }: StatusCardProps) {
  return (
    <div className={`statuscard ${type}`}>
      <div className="scico">{ICONS[type]}</div>
      <div className="sctitle">{title}</div>
      {sub && <p className="scsub">{sub}</p>}
      {actions && <div className="scacts">{actions}</div>}
    </div>
  )
}
