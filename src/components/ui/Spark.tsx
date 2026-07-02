'use client'

import { LineChart, Line, ResponsiveContainer } from 'recharts'

interface SparkProps {
  data: number[]
  color?: string
  height?: number
}

export default function Spark({ data, color = 'var(--red)', height = 38 }: SparkProps) {
  const series = data.map((v, i) => ({ i, v }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={series}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
