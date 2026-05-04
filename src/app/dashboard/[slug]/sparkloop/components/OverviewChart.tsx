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
  LabelList,
} from 'recharts'

interface DailyStats {
  date: string
  pending: number
  confirmed: number
  rejected: number
  projectedEarnings: number
  confirmedEarnings: number
  newPending: number | null
}

function formatDollars(value: number) {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatNumber(value: number) {
  return value.toLocaleString('en-US')
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const dataRow = payload[0]?.payload
    const pending = dataRow?.pending || 0
    const confirmed = dataRow?.confirmed || 0
    const rejected = dataRow?.rejected || 0
    const projectedEarnings = dataRow?.projectedEarnings || 0
    const confirmedEarnings = dataRow?.confirmedEarnings || 0
    const newPending = dataRow?.newPending
    return (
      <div className="bg-gray-900 text-white p-3 rounded-lg shadow-lg text-sm">
        <div className="font-medium mb-1">{label}</div>
        {pending > 0 && (
          <>
            <div className="text-purple-300">Pending Referrals: {formatNumber(pending)}</div>
            <div className="text-purple-300">Projected Earnings: {formatDollars(projectedEarnings)}</div>
          </>
        )}
        {confirmed > 0 && (
          <>
            <div className="text-gray-300">Confirmed Referrals: {formatNumber(confirmed)}</div>
            <div className="text-gray-300">Confirmed Earnings: {formatDollars(confirmedEarnings)}</div>
          </>
        )}
        {rejected > 0 && (
          <div className="text-gray-500">Rejected Referrals: {formatNumber(rejected)}</div>
        )}
        {newPending !== null && newPending !== undefined && newPending > 0 && (
          <div className="text-amber-300">
            New Pending (SL): {formatNumber(newPending)}
          </div>
        )}
        {(projectedEarnings > 0 || confirmedEarnings > 0) && (
          <div className="text-green-300 mt-1 pt-1 border-t border-gray-700">
            Total: {formatDollars(projectedEarnings + confirmedEarnings)}
          </div>
        )}
      </div>
    )
  }
  return null
}

interface Props {
  dailyStats: DailyStats[]
}

export default function OverviewChart({ dailyStats }: Props) {
  const chartData = dailyStats.map((d) => ({
    ...d,
    earningsLabel:
      d.projectedEarnings + d.confirmedEarnings > 0
        ? `$${(d.projectedEarnings + d.confirmedEarnings).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
        : '',
    newPendingDisplay: d.newPending !== null && d.newPending > 0 ? d.newPending : 0,
    newPendingLabel:
      d.newPending !== null && d.newPending > 0 ? d.newPending.toLocaleString('en-US') : '',
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickFormatter={(value) => {
            const [, m, d] = value.split('-')
            return `${parseInt(m)}/${parseInt(d)}`
          }}
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Bar dataKey="pending" name="Pending" stackId="a" fill="#c4b5fd" />
        <Bar dataKey="confirmed" name="Confirmed" stackId="a" fill="#9ca3af" />
        <Bar dataKey="rejected" name="Rejected" stackId="a" fill="#4b5563" radius={[2, 2, 0, 0]}>
          <LabelList dataKey="earningsLabel" position="top" style={{ fontSize: 10, fill: '#7c3aed' }} />
        </Bar>
        <Bar dataKey="newPendingDisplay" name="New Pending (SL)" fill="#f59e0b" radius={[2, 2, 0, 0]}>
          <LabelList dataKey="newPendingLabel" position="top" style={{ fontSize: 9, fill: '#d97706' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
