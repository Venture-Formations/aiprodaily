'use client'

import { useState, useEffect, useMemo } from 'react'
import Layout from '@/components/Layout'
import { RefreshCw, CheckCircle, TrendingUp, DollarSign, Clock, Users } from 'lucide-react'
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
import DetailedTab from './components/DetailedTab'
import OffersTab from './components/OffersTab'

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
  paused_reason: string | null
  impressions: number
  submissions: number
  confirms: number
  rejections: number
  our_cr: number | null
  our_rcr: number | null
  sparkloop_confirmed: number
  sparkloop_pending: number
  sparkloop_rejected: number
  sparkloop_earnings: number
  sparkloop_net_earnings: number
  our_total_subscribes: number
  our_confirms: number
  our_rejections: number
  our_pending: number
  remaining_budget_dollars: number | null
  last_synced_at: string | null
  calculated_score: number
  effective_cr: number
  effective_rcr: number
  cr_source: string
  rcr_source: string
  unique_ips: number
  override_cr: number | null
  override_rcr: number | null
  submission_capped?: boolean
  page_impressions: number
  page_submissions: number
  page_cr: number | null
  rcr_14d: number | null
  rcr_30d: number | null
  slippage_14d: number | null
  slippage_30d: number | null
  sends_14d: number
  sends_30d: number
  confirms_gained_14d: number
  confirms_gained_30d: number
}

interface Counts {
  total: number
  active: number
  excluded: number
  paused: number
  archived: number
}

interface GlobalStats {
  uniqueIps: number
  avgOffersSelected: number
}

interface Defaults {
  cr: number
  rcr: number
}

interface DailyStats {
  date: string
  pending: number
  confirmed: number
  rejected: number
  projectedEarnings: number
  confirmedEarnings: number
  newPending: number | null
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
    totalRejected: number
    totalSubscribes: number
    totalEarnings: number
    projectedFromPending: number
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
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null)
  const [defaults, setDefaults] = useState<Defaults>({ cr: 22, rcr: 25 })
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'detailed' | 'offers'>('overview')

  // Chart state
  const [chartStats, setChartStats] = useState<ChartStats | null>(null)
  const [chartLoading, setChartLoading] = useState(true)
  const [timeframe, setTimeframe] = useState<'7' | '30' | '90'>('30')

  useEffect(() => {
    fetchRecommendations()
  }, [])

  useEffect(() => {
    fetchChartStats()
  }, [timeframe])

  async function fetchRecommendations() {
    setLoading(true)
    try {
      const res = await fetch('/api/sparkloop/admin?filter=all')
      const data = await res.json()
      if (data.success) {
        setRecommendations(data.recommendations)
        setCounts(data.counts)
        if (data.globalStats) {
          setGlobalStats(data.globalStats)
        }
        if (data.defaults) {
          setDefaults(data.defaults)
        }
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

  const formatDollars = (value: number) => {
    return `$${value.toFixed(2)}`
  }

  const formatCurrency = (cents: number | null) => {
    if (cents === null) return '-'
    return `$${(cents / 100).toFixed(2)}`
  }

  // Compute popup preview: top 5 recs that would appear in the actual popup
  // Matches /api/sparkloop/recommendations filtering logic
  const popupPreview = useMemo(() => {
    return recommendations
      .filter(rec => {
        if (rec.status !== 'active') return false
        if (rec.excluded) return false
        if (rec.paused_reason === 'manual') return false
        if (!rec.cpa || rec.cpa <= 0) return false
        // Submission capped: no SL RCR + 50+ submissions, unless has override_rcr
        const slRcr = rec.sparkloop_rcr !== null ? Number(rec.sparkloop_rcr) : null
        const hasSLRcr = slRcr !== null && slRcr > 0
        const hasOverrideRcr = rec.override_rcr !== null && rec.override_rcr !== undefined
        if (!hasSLRcr && !hasOverrideRcr && (rec.submissions || 0) >= 50) return false
        return true
      })
      .sort((a, b) => (b.calculated_score || 0) - (a.calculated_score || 0))
      .slice(0, 5)
  }, [recommendations])

  // Compute recs page preview: positions 6-8 (what shows on /subscribe/recommendations)
  const recsPagePreview = useMemo(() => {
    return recommendations
      .filter(rec => {
        if (rec.status !== 'active') return false
        if (rec.excluded) return false
        if (rec.paused_reason === 'manual') return false
        if (!rec.cpa || rec.cpa <= 0) return false
        const slRcr = rec.sparkloop_rcr !== null ? Number(rec.sparkloop_rcr) : null
        const hasSLRcr = slRcr !== null && slRcr > 0
        const hasOverrideRcr = rec.override_rcr !== null && rec.override_rcr !== undefined
        if (!hasSLRcr && !hasOverrideRcr && (rec.submissions || 0) >= 50) return false
        return true
      })
      .sort((a, b) => (b.calculated_score || 0) - (a.calculated_score || 0))
      .slice(5, 8)
  }, [recommendations])

  const getSourceColor = (source: string) => {
    if (source === 'override') return 'text-orange-600'
    if (source === 'ours') return 'text-blue-600'
    return 'text-gray-500'
  }

  const getSourceLabel = (source: string) => {
    if (source === 'override') return 'override'
    if (source === 'ours') return 'ours'
    if (source === 'sparkloop') return 'SL'
    return 'default'
  }

  // Custom tooltip for chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const pending = payload.find((p: any) => p.dataKey === 'pending')?.value || 0
      const confirmed = payload.find((p: any) => p.dataKey === 'confirmed')?.value || 0
      const rejected = payload.find((p: any) => p.dataKey === 'rejected')?.value || 0
      const projectedEarnings = payload.find((p: any) => p.dataKey === 'projectedEarnings')?.value || 0
      const confirmedEarnings = payload.find((p: any) => p.dataKey === 'confirmedEarnings')?.value || 0
      const dataRow = payload[0]?.payload
      const newPending = dataRow?.newPending
      return (
        <div className="bg-gray-900 text-white p-3 rounded-lg shadow-lg text-sm">
          <div className="font-medium mb-1">{label}</div>
          {pending > 0 && (
            <>
              <div className="text-purple-300">Pending Referrals: {pending}</div>
              <div className="text-purple-300">Projected Earnings: ${projectedEarnings.toFixed(2)}</div>
            </>
          )}
          {confirmed > 0 && (
            <>
              <div className="text-gray-300">Confirmed Referrals: {confirmed}</div>
              <div className="text-gray-300">Confirmed Earnings: ${confirmedEarnings.toFixed(2)}</div>
            </>
          )}
          {rejected > 0 && (
            <div className="text-gray-500">Rejected Referrals: {rejected}</div>
          )}
          {newPending !== null && newPending !== undefined && (
            <div className={newPending >= 0 ? 'text-amber-300' : 'text-red-300'}>
              New Pending (SL): {newPending >= 0 ? '+' : ''}{newPending}
            </div>
          )}
          {(projectedEarnings > 0 || confirmedEarnings > 0) && (
            <div className="text-green-300 mt-1 pt-1 border-t border-gray-700">
              Total: ${(projectedEarnings + confirmedEarnings).toFixed(2)}
            </div>
          )}
        </div>
      )
    }
    return null
  }

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-4">
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

        {/* Tab Buttons */}
        <div className="flex gap-1 mb-6 border-b">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === 'overview'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('detailed')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === 'detailed'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Detailed
          </button>
          <button
            onClick={() => setActiveTab('offers')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === 'offers'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Offers
          </button>
        </div>

        {activeTab === 'offers' ? (
          <OffersTab />
        ) : activeTab === 'overview' ? (
          <>
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
                  {(['7', '30', '90'] as const).map(t => (
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

              {chartLoading ? (
                <div className="h-64 flex items-center justify-center text-gray-500">
                  Loading chart...
                </div>
              ) : chartStats?.dailyStats && chartStats.dailyStats.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartStats.dailyStats.map(d => ({
                    ...d,
                    earningsLabel: (d.projectedEarnings + d.confirmedEarnings) > 0
                      ? `$${(d.projectedEarnings + d.confirmedEarnings).toFixed(2)}`
                      : '',
                    // For the new pending bar, show absolute value (null means no data)
                    newPendingDisplay: d.newPending !== null ? Math.abs(d.newPending) : 0,
                    newPendingLabel: d.newPending !== null && d.newPending !== 0
                      ? `${d.newPending >= 0 ? '+' : ''}${d.newPending}`
                      : '',
                    newPendingIsNegative: d.newPending !== null && d.newPending < 0,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value) => {
                        const date = new Date(value)
                        return `${date.getMonth() + 1}/${date.getDate()}`
                      }}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="pending" name="Pending" stackId="a" fill="#c4b5fd" />
                    <Bar dataKey="confirmed" name="Confirmed" stackId="a" fill="#9ca3af" />
                    <Bar dataKey="rejected" name="Rejected" stackId="a" fill="#4b5563" radius={[2, 2, 0, 0]}>
                      <LabelList
                        dataKey="earningsLabel"
                        position="top"
                        style={{ fontSize: 10, fill: '#7c3aed' }}
                      />
                    </Bar>
                    <Bar dataKey="newPendingDisplay" name="New Pending (SL)" fill="#f59e0b" radius={[2, 2, 0, 0]}>
                      <LabelList
                        dataKey="newPendingLabel"
                        position="top"
                        style={{ fontSize: 9, fill: '#d97706' }}
                      />
                    </Bar>
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
                          <span className="mx-1">-</span>
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

            {/* Popup Preview */}
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Popup Preview</h2>
                <span className="text-xs text-gray-500">
                  Top 5 recommendations by score (what subscribers see)
                </span>
              </div>

              {loading ? (
                <div className="py-8 text-center text-gray-500 text-sm">Loading...</div>
              ) : popupPreview.length === 0 ? (
                <div className="py-8 text-center text-gray-500 text-sm">No eligible recommendations for popup</div>
              ) : (
                <div className="space-y-2">
                  {popupPreview.map((rec, index) => (
                    <div
                      key={rec.id}
                      className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                    >
                      <span className="text-lg font-bold text-gray-400 w-6 text-center">
                        {index + 1}
                      </span>
                      {rec.publication_logo ? (
                        <img src={rec.publication_logo} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                          <Users className="w-4 h-4 text-purple-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{rec.publication_name}</div>
                      </div>
                      <div className="flex items-center gap-4 text-xs flex-shrink-0">
                        <div className="text-center">
                          <div className="text-gray-400">CPA</div>
                          <div className="font-mono font-medium">{formatCurrency(rec.cpa)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-400">CR</div>
                          <div className={`font-medium ${getSourceColor(rec.cr_source)}`}>
                            {rec.effective_cr.toFixed(0)}%
                          </div>
                          <div className="text-[10px] text-gray-400">{getSourceLabel(rec.cr_source)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-400">RCR</div>
                          <div className={`font-medium ${getSourceColor(rec.rcr_source)}`}>
                            {rec.effective_rcr.toFixed(0)}%
                          </div>
                          <div className="text-[10px] text-gray-400">{getSourceLabel(rec.rcr_source)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-400">Score</div>
                          <div className="font-mono font-medium">${rec.calculated_score.toFixed(4)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Legend */}
              <div className="mt-3 text-[10px] text-gray-500">
                <strong>Score</strong> = CR x CPA x RCR (expected revenue per impression) |
                <span className="text-blue-600 ml-1">Blue</span> = our data |
                <span className="text-orange-600 ml-1">Orange</span> = manual override |
                Gray = default
              </div>
            </div>

            {/* Recommendation Page Preview */}
            <div className="bg-white rounded-lg border p-6 mt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Recommendation Page Preview</h2>
                <span className="text-xs text-gray-500">
                  Positions 6-8 by score (shown on /subscribe/recommendations)
                </span>
              </div>

              {loading ? (
                <div className="py-8 text-center text-gray-500 text-sm">Loading...</div>
              ) : recsPagePreview.length === 0 ? (
                <div className="py-8 text-center text-gray-500 text-sm">No additional recommendations beyond popup top 5</div>
              ) : (
                <div className="space-y-2">
                  {recsPagePreview.map((rec, index) => (
                    <div
                      key={rec.id}
                      className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
                    >
                      <span className="text-lg font-bold text-gray-400 w-6 text-center">
                        {index + 6}
                      </span>
                      {rec.publication_logo ? (
                        <img src={rec.publication_logo} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                          <Users className="w-4 h-4 text-purple-600" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{rec.publication_name}</div>
                      </div>
                      <div className="flex items-center gap-4 text-xs flex-shrink-0">
                        <div className="text-center">
                          <div className="text-gray-400">CPA</div>
                          <div className="font-mono font-medium">{formatCurrency(rec.cpa)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-400">CR</div>
                          <div className={`font-medium ${getSourceColor(rec.cr_source)}`}>
                            {rec.effective_cr.toFixed(0)}%
                          </div>
                          <div className="text-[10px] text-gray-400">{getSourceLabel(rec.cr_source)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-400">RCR</div>
                          <div className={`font-medium ${getSourceColor(rec.rcr_source)}`}>
                            {rec.effective_rcr.toFixed(0)}%
                          </div>
                          <div className="text-[10px] text-gray-400">{getSourceLabel(rec.rcr_source)}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-gray-400">Score</div>
                          <div className="font-mono font-medium">${rec.calculated_score.toFixed(4)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <DetailedTab
            recommendations={recommendations}
            globalStats={globalStats}
            defaults={defaults}
            loading={loading}
            onRefresh={fetchRecommendations}
          />
        )}
      </div>
    </Layout>
  )
}
