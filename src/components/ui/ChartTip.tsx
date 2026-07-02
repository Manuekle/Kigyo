interface ChartTipProps {
  active?: boolean
  payload?: { color: string; name: string; value: number }[]
  label?: string
  valueFormatter?: (value: number) => string
  labelFormatter?: (label: string) => string
}

export default function ChartTip({ active, payload, label, valueFormatter, labelFormatter }: ChartTipProps) {
  if (!active || !payload?.length) return null
  const fmt = valueFormatter ?? ((v: number) => v.toLocaleString('es-CO'))
  return (
    <div className="tip">
      <div className="tm">{labelFormatter ? labelFormatter(String(label)) : label}</div>
      {payload.map((p) => (
        <div key={p.name} className="tr">
          <span style={{ width: 8, height: 8, borderRadius: 3, background: p.color, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{p.name}</span>
          <b>{fmt(p.value)}</b>
        </div>
      ))}
    </div>
  )
}
