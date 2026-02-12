'use client'

import { useState, useEffect } from 'react'
import { Eye, MousePointerClick, TrendingUp, Calendar } from 'lucide-react'
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

interface Summary {
  totalImpressions: number
  totalClaims: number
  claimRate: number
  todayImpressions: number
  todayClaims: number
}

interface DailyStats {
  date: string
  impressions: number
  claims: number
  claimRate: number
}

interface RecentEvent {
  date: string
  email: string | null
  event_type: string
  ip: string | null
}

export default function OffersTab() {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState<'7' | '30'>('30')

  useEffect(() => {
    fetchStats()
  }, [timeframe])

  async function fetchStats() {
    setLoading(true)
    try {
      const res = await fetch(`/api/sparkloop/offer-stats?days=${timeframe}`)
      const data = await res.json()
      if (data.success) {
        setSummary(data.summary)
        setDailyStats(data.dailyStats)
        setRecentEvents(data.recentEvents)
      }
    } catch (error) {
      console.error('Failed to fetch offer stats:', error)
    }
    setLoading(false)
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

  if (loading) {
    return <div className="py-12 text-center text-gray-500">Loading offer stats...</div>
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Eye className="w-4 h-4" />
            Total Impressions
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {summary?.totalImpressions || 0}
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <MousePointerClick className="w-4 h-4" />
            Total Claims
          </div>
          <div className="text-2xl font-bold text-green-600">
            {summary?.totalClaims || 0}
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <TrendingUp className="w-4 h-4" />
            Claim Rate
          </div>
          <div className="text-2xl font-bold text-purple-600">
            {summary?.claimRate || 0}%
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Calendar className="w-4 h-4" />
            Today
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {summary?.todayImpressions || 0}
            <span className="text-sm font-normal text-gray-400 ml-1">imp</span>
            <span className="text-sm font-normal text-gray-400 mx-1">/</span>
            {summary?.todayClaims || 0}
            <span className="text-sm font-normal text-gray-400 ml-1">claims</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Offer Activity</h2>
          <div className="flex gap-2">
            {(['7', '30'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-3 py-1.5 text-sm rounded-lg ${
                  timeframe === t ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {t} Days
              </button>
            ))}
          </div>
        </div>

        {dailyStats.length > 0 ? (
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
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500">
            No data available for this timeframe
          </div>
        )}
      </div>

      {/* Recent Events Table */}
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Events</h2>
        {recentEvents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Email</th>
                  <th className="pb-2 pr-4">Event</th>
                  <th className="pb-2">IP</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((event, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-4 text-gray-600">
                      {new Date(event.date).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {event.email || '-'}
                    </td>
                    <td className="py-2 pr-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        event.event_type === 'claim'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {event.event_type}
                      </span>
                    </td>
                    <td className="py-2 font-mono text-xs text-gray-500">
                      {event.ip || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-gray-500 text-sm">No events recorded yet</div>
        )}
      </div>
    </div>
  )
}
