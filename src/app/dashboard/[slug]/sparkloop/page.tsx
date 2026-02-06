'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import { RefreshCw, Ban, CheckCircle, TrendingUp, Calendar, DollarSign, Clock, Users } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface Recommendation {
  id: string
  ref_code: string
  publication_name: string
  publication_logo: string | null
  description: string | null
  type: 'free' | 'paid'
  status: 'active' | 'paused'
  cpa: number | null
  sparkloop_rcr: number | null
  max_payout: number | null
  screening_period: number | null
  excluded: boolean
  excluded_reason: string | null
  impressions: number
  submissions: number
  confirms: number
  rejections: number
  our_cr: number | null
  our_rcr: number | null
  sparkloop_confirmed: number
  sparkloop_pending: number
  sparkloop_earnings: number
  last_synced_at: string | null
  calculated_score: number
  effective_cr: number
  effective_rcr: number
  cr_source: string
  rcr_source: string
}

interface Counts {
  total: number
  active: number
  excluded: number
  paused: number
  archived: number
}

interface DailyStats {
  date: string
  pending: number
  confirmed: number
  projectedEarnings: number
}

interface TopEarner {
  name: string
  logo: string | null
  referrals: number
  earnings: number
}

interface ChartStats {
  summary: {
    totalPending: number
    totalConfirmed: number
    totalEarnings: number
    projectedFromPending: number
    avgCPA: number
  }
  dailyStats: DailyStats[]
  topEarners: TopEarner[]
  dateRange: {
    from: string
    to: string
  }
}

export default function SparkLoopAdminPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [counts, setCounts] = useState<Counts>({ total: 0, active: 0, excluded: 0, paused: 0, archived: 0 })
  const [filter, setFilter] = useState<'all' | 'active' | 'excluded'>('all')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Chart state
  const [chartStats, setChartStats] = useState<ChartStats | null>(null)
  const [chartLoading, setChartLoading] = useState(true)
  const [timeframe, setTimeframe] = useState<'7' | '30' | '90'>('30')

  useEffect(() => {
    fetchRecommendations()
  }, [filter])

  useEffect(() => {
    fetchChartStats()
  }, [timeframe])

  async function fetchRecommendations() {
    setLoading(true)
    try {
      const res = await fetch(`/api/sparkloop/admin?filter=${filter}`)
      const data = await res.json()
      if (data.success) {
        setRecommendations(data.recommendations)
        setCounts(data.counts)
      }
    } catch (error) {
      console.error('Failed to fetch recommendations:', error)
    }
    setLoading(false)
  }

  async function fetchChartStats() {
    setChartLoading(true)
    try {
      const res = await fetch(`/api/sparkloop/stats?days=${timeframe}`)
      const data = await res.json()
      if (data.success) {
        setChartStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch chart stats:', error)
    }
    setChartLoading(false)
  }

  async function syncFromSparkLoop() {
    setSyncing(true)
    try {
      const res = await fetch('/api/sparkloop/sync', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        alert(`Synced ${data.synced} recommendations (${data.created} new, ${data.updated} updated)`)
        fetchRecommendations()
        fetchChartStats()
      } else {
        alert('Sync failed: ' + data.error)
      }
    } catch (error) {
      console.error('Sync failed:', error)
      alert('Sync failed')
    }
    setSyncing(false)
  }

  async function toggleExclusion(rec: Recommendation) {
    setActionLoading(rec.id)
    try {
      const res = await fetch('/api/sparkloop/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rec.id,
          excluded: !rec.excluded,
          excluded_reason: !rec.excluded ? 'budget_used_up' : null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        fetchRecommendations()
      } else {
        alert('Update failed: ' + data.error)
      }
    } catch (error) {
      console.error('Update failed:', error)
      alert('Update failed')
    }
    setActionLoading(null)
  }

  async function bulkAction(action: 'exclude' | 'reactivate') {
    if (selectedIds.size === 0) {
      alert('No recommendations selected')
      return
    }

    const reason = action === 'exclude' ? prompt('Exclusion reason (e.g., budget_used_up):') : null
    if (action === 'exclude' && reason === null) return

    setActionLoading('bulk')
    try {
      const res = await fetch('/api/sparkloop/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ids: Array.from(selectedIds),
          excluded_reason: reason,
        }),
      })
      const data = await res.json()
      if (data.success) {
        alert(`${action === 'exclude' ? 'Excluded' : 'Reactivated'} ${data.updated} recommendations`)
        setSelectedIds(new Set())
        fetchRecommendations()
      } else {
        alert('Bulk update failed: ' + data.error)
      }
    } catch (error) {
      console.error('Bulk update failed:', error)
      alert('Bulk update failed')
    }
    setActionLoading(null)
  }

  function toggleSelect(id: string) {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  function selectAll() {
    if (selectedIds.size === recommendations.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(recommendations.map(r => r.id)))
    }
  }

  const formatCurrency = (cents: number | null) => {
    if (cents === null) return '-'
    return `$${(cents / 100).toFixed(2)}`
  }

  const formatPercent = (value: number | null) => {
    if (value === null) return '-'
    return `${value.toFixed(0)}%`
  }

  const formatDollars = (value: number) => {
    return `$${value.toFixed(2)}`
  }

  // Custom tooltip for chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const pending = payload.find((p: any) => p.dataKey === 'pending')?.value || 0
      const confirmed = payload.find((p: any) => p.dataKey === 'confirmed')?.value || 0
      const earnings = payload.find((p: any) => p.dataKey === 'projectedEarnings')?.value || 0
      return (
        <div className="bg-gray-900 text-white p-3 rounded-lg shadow-lg text-sm">
          <div className="font-medium mb-1">{label}</div>
          <div className="text-yellow-400">Pending Referrals: {pending}</div>
          <div className="text-green-400">Confirmed Referrals: {confirmed}</div>
          <div className="text-purple-400">Projected Earnings: ${earnings.toFixed(2)}</div>
        </div>
      )
    }
    return null
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">SparkLoop Recommendations</h1>
            <p className="text-gray-600 mt-1">
              Manage which newsletters appear in the signup popup
            </p>
          </div>
          <button
            onClick={syncFromSparkLoop}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync from SparkLoop'}
          </button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <Clock className="w-4 h-4" />
              Pending Referrals
            </div>
            <div className="text-2xl font-bold text-yellow-600">
              {chartStats?.summary.totalPending || 0}
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <CheckCircle className="w-4 h-4" />
              Confirmed Referrals
            </div>
            <div className="text-2xl font-bold text-green-600">
              {chartStats?.summary.totalConfirmed || 0}
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <DollarSign className="w-4 h-4" />
              Total Earnings
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {formatDollars(chartStats?.summary.totalEarnings || 0)}
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
              <TrendingUp className="w-4 h-4" />
              Projected (Pending)
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {formatDollars(chartStats?.summary.projectedFromPending || 0)}
            </div>
          </div>
        </div>

        {/* Chart Section */}
        <div className="bg-white rounded-lg border p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Referral Activity</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setTimeframe('7')}
                className={`px-3 py-1.5 text-sm rounded-lg ${
                  timeframe === '7' ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setTimeframe('30')}
                className={`px-3 py-1.5 text-sm rounded-lg ${
                  timeframe === '30' ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                30 Days
              </button>
              <button
                onClick={() => setTimeframe('90')}
                className={`px-3 py-1.5 text-sm rounded-lg ${
                  timeframe === '90' ? 'bg-purple-600 text-white' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                90 Days
              </button>
            </div>
          </div>

          {chartLoading ? (
            <div className="h-64 flex items-center justify-center text-gray-500">
              Loading chart...
            </div>
          ) : chartStats?.dailyStats && chartStats.dailyStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartStats.dailyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    const date = new Date(value)
                    return `${date.getMonth() + 1}/${date.getDate()}`
                  }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="pending" name="Pending" fill="#eab308" radius={[2, 2, 0, 0]} />
                <Bar dataKey="confirmed" name="Confirmed" fill="#22c55e" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              No data available for this timeframe
            </div>
          )}

          {chartStats?.dateRange && (
            <div className="text-xs text-gray-500 mt-2 text-center">
              {chartStats.dateRange.from} to {chartStats.dateRange.to}
            </div>
          )}
        </div>

        {/* Top Earners Section */}
        {chartStats?.topEarners && chartStats.topEarners.length > 0 && (
          <div className="bg-white rounded-lg border p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">
              Top-Earning Recommendations ({chartStats.dateRange.from} - {chartStats.dateRange.to})
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {chartStats.topEarners.map((earner, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  {earner.logo ? (
                    <img src={earner.logo} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <Users className="w-5 h-5 text-purple-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{earner.name}</div>
                    <div className="text-xs text-gray-500">
                      <span className="text-purple-600">{earner.referrals} referrals</span>
                      <span className="mx-1">•</span>
                      <span className="text-green-600">{formatDollars(earner.earnings)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendation Counts */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">Total</div>
            <div className="text-2xl font-bold">{counts.total}</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">Active</div>
            <div className="text-2xl font-bold text-green-600">{counts.active}</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">Excluded</div>
            <div className="text-2xl font-bold text-red-600">{counts.excluded}</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">Paused</div>
            <div className="text-2xl font-bold text-yellow-600">{counts.paused}</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-500">Archived</div>
            <div className="text-2xl font-bold text-gray-400">{counts.archived}</div>
          </div>
        </div>

        {/* Filters and Bulk Actions */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg ${filter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-4 py-2 rounded-lg ${filter === 'active' ? 'bg-green-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              Active
            </button>
            <button
              onClick={() => setFilter('excluded')}
              className={`px-4 py-2 rounded-lg ${filter === 'excluded' ? 'bg-red-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
              Excluded
            </button>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex gap-2">
              <span className="text-sm text-gray-500 self-center">{selectedIds.size} selected</span>
              <button
                onClick={() => bulkAction('exclude')}
                disabled={actionLoading === 'bulk'}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
              >
                <Ban className="w-4 h-4" /> Exclude
              </button>
              <button
                onClick={() => bulkAction('reactivate')}
                disabled={actionLoading === 'bulk'}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm"
              >
                <CheckCircle className="w-4 h-4" /> Reactivate
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === recommendations.length && recommendations.length > 0}
                    onChange={selectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Newsletter</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">CPA</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Screening</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">RCR</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">CR</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                  <div className="flex items-center gap-1">
                    Score <TrendingUp className="w-3 h-3" />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Our Stats</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : recommendations.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                    No recommendations found
                  </td>
                </tr>
              ) : (
                recommendations.map(rec => (
                  <tr
                    key={rec.id}
                    className={`hover:bg-gray-50 ${rec.excluded ? 'bg-red-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(rec.id)}
                        onChange={() => toggleSelect(rec.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {rec.publication_logo && (
                          <img
                            src={rec.publication_logo}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        )}
                        <div>
                          <div className="font-medium">{rec.publication_name}</div>
                          <div className="text-xs text-gray-500">{rec.ref_code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">
                      {formatCurrency(rec.cpa)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {rec.screening_period ? `${rec.screening_period}d` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <span className={rec.rcr_source === 'ours' ? 'text-blue-600 font-medium' : ''}>
                          {formatPercent(rec.effective_rcr)}
                        </span>
                        <div className="text-xs text-gray-400">
                          {rec.rcr_source === 'ours' ? 'ours' : rec.rcr_source === 'sparkloop' ? 'SL' : 'default'}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <span className={rec.cr_source === 'ours' ? 'text-blue-600 font-medium' : ''}>
                          {formatPercent(rec.effective_cr)}
                        </span>
                        <div className="text-xs text-gray-400">
                          {rec.cr_source === 'ours' ? 'ours' : 'default'}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm font-medium">
                      ${rec.calculated_score.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div>Imp: {rec.impressions}</div>
                      <div>Sub: {rec.submissions}</div>
                      <div className="text-green-600">Conf: {rec.sparkloop_confirmed}</div>
                      <div className="text-yellow-600">Pend: {rec.sparkloop_pending}</div>
                    </td>
                    <td className="px-4 py-3">
                      {rec.excluded ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">
                          <Ban className="w-3 h-3" />
                          {rec.excluded_reason || 'excluded'}
                        </span>
                      ) : rec.status === 'paused' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700">
                          Paused
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleExclusion(rec)}
                        disabled={actionLoading === rec.id}
                        className={`px-3 py-1.5 rounded text-sm ${
                          rec.excluded
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        } disabled:opacity-50`}
                      >
                        {actionLoading === rec.id ? '...' : rec.excluded ? 'Reactivate' : 'Exclude'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-4 text-xs text-gray-500">
          <strong>Score</strong> = CR × CPA × RCR (expected revenue per impression) •
          <span className="text-blue-600 ml-2">Blue values</span> = calculated from our data (20+ samples)
        </div>
      </div>
    </Layout>
  )
}
