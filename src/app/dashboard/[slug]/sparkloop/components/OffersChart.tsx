'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  ComposedChart,
} from 'recharts'

interface DailyStats {
  date: string
  impressions: number
  claims: number
  claimRate: number
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const impressions = payload.find((p: any) => p.dataKey === 'impressions')?.value || 0
    const claims = payload.find((p: any) => p.dataKey === 'claims')?.value || 0
    const rate = impressions > 0 ? ((claims / impressions) * 100).toFixed(1) : '0.0'
    return (
      <div className="bg-gray-900 text-white p-3 rounded-lg shadow-lg text-sm">
        <div className="font-medium mb-1">{label}</div>
        <div className="text-blue-300">Impressions: {impressions}</div>
        <div className="text-green-300">Claims: {claims}</div>
        <div className="text-yellow-300">Claim Rate: {rate}%</div>
      </div>
    )
  }
  return null
}

interface Props {
  dailyStats: DailyStats[]
}

export default function OffersChart({ dailyStats }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={dailyStats}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickFormatter={(value) => {
            const date = new Date(value)
            return `${date.getMonth() + 1}/${date.getDate()}`
          }}
        />
        <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Bar yAxisId="left" dataKey="impressions" name="Impressions" fill="#93c5fd" radius={[2, 2, 0, 0]} />
        <Bar yAxisId="left" dataKey="claims" name="Claims" fill="#86efac" radius={[2, 2, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="claimRate" name="Claim Rate %" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
