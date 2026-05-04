'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

interface ChartData {
  hour: string
  avg: number
  min: number
  max: number
  count: number
}

interface MetricChartConfig {
  label: string
  unit: string
  color: string
  chartType: 'line' | 'bar'
}

interface Props {
  data: ChartData[]
  config: MetricChartConfig
  formatHour: (hour: string) => string
}

export default function MetricChart({ data, config, formatHour }: Props) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      {config.chartType === 'line' ? (
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="hour" tickFormatter={formatHour} tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            labelFormatter={(label: any) => formatHour(String(label))}
            formatter={(value: any) => [`${value}${config.unit}`, config.label]}
          />
          <Line type="monotone" dataKey="avg" stroke={config.color} strokeWidth={2} dot={false} />
        </LineChart>
      ) : (
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="hour" tickFormatter={formatHour} tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} />
          <Tooltip
            labelFormatter={(label: any) => formatHour(String(label))}
            formatter={(value: any) => [`${value}${config.unit}`, config.label]}
          />
          <Bar dataKey="avg" fill={config.color} radius={[2, 2, 0, 0]} />
        </BarChart>
      )}
    </ResponsiveContainer>
  )
}
