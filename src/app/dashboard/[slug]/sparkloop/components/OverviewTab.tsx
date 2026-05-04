'use client'

import dynamic from 'next/dynamic'
import { CheckCircle, TrendingUp, DollarSign, Clock, Users } from 'lucide-react'
import type { Recommendation } from '../types'
import type { ChartStats, EstimatedValue } from './useSparkLoopData'

const OverviewChart = dynamic(() => import('./OverviewChart'), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      aria-busy="true"
      className="h-[300px] flex items-center justify-center text-gray-400 text-sm"
    >
      Loading chart...
    </div>
  ),
})

// --- Formatters ---

export function formatDollars(value: number) {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatNumber(value: number) {
  return value.toLocaleString('en-US')
}

export function formatCurrency(cents: number | null) {
  if (cents === null) return '-'
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function getSourceColor(source: string) {
  if (source === 'override') return 'text-orange-600'
  if (source === 'ours') return 'text-blue-600'
  return 'text-gray-500'
}

export function getSourceLabel(source: string) {
  if (source === 'override') return 'override'
  if (source === 'ours') return 'ours'
  if (source === 'sparkloop') return 'SL'
  return 'default'
}

// --- Recommendation Row ---

interface RecRowProps {
  rec: Recommendation
  index: number
  startIndex: number
}

function RecRow({ rec, index, startIndex }: RecRowProps) {
  return (
    <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
      <span className="text-lg font-bold text-gray-400 w-6 text-center">
        {index + startIndex}
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
  )
}

// --- Main Overview Tab ---

interface OverviewTabProps {
  chartStats: ChartStats | null
  chartLoading: boolean
  timeframe: '7' | '30' | '90'
  setTimeframe: (t: '7' | '30' | '90') => void
  loading: boolean
  counts: { total: number; active: number; excluded: number; paused: number; archived: number }
  popupPreview: Recommendation[]
  recsPagePreview: Recommendation[]
  estimatedValue: EstimatedValue
}

export default function OverviewTab({
  chartStats,
  chartLoading,
  timeframe,
  setTimeframe,
  loading,
  counts,
  popupPreview,
  recsPagePreview,
  estimatedValue,
}: OverviewTabProps) {
  return (
    <>
      {/* Summary Stats */}
      <div className={`grid grid-cols-4 gap-4 mb-6 transition-opacity ${chartLoading ? 'opacity-40' : ''}`}>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Clock className="w-4 h-4" />
            Pending Referrals
          </div>
          <div className="text-2xl font-bold text-yellow-600">
            {formatNumber(chartStats?.summary.totalPending || 0)}
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <CheckCircle className="w-4 h-4" />
            Confirmed Referrals
          </div>
          <div className="text-2xl font-bold text-green-600">
            {formatNumber(chartStats?.summary.totalConfirmed || 0)}
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

      {/* Estimated Value Per Subscriber */}
      {loading ? (
        <div className="bg-white rounded-lg border p-4 mb-6 h-16 animate-pulse bg-gray-50" />
      ) : (
        <div className="bg-white rounded-lg border p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <div className="text-xs text-gray-500 mb-0.5">Est. Value / Subscriber</div>
                <div className="text-xl font-bold text-green-600">{formatDollars(estimatedValue.total)}</div>
              </div>
              <div className="h-8 w-px bg-gray-200" />
              <div>
                <div className="text-xs text-gray-400">Popup ({popupPreview.length})</div>
                <div className="text-sm font-semibold text-gray-700">{formatDollars(estimatedValue.popup)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Page ({recsPagePreview.length})</div>
                <div className="text-sm font-semibold text-gray-700">{formatDollars(estimatedValue.page)}</div>
              </div>
            </div>
            <div className="text-[11px] text-gray-500 max-w-[200px] text-right">
              Based on current offerings: CR x CPA x RCR x (1 - Slip)
            </div>
          </div>
        </div>
      )}

      {/* Chart Section */}
      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Referral Activity</h2>
          <div className="flex items-center gap-3">
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
        </div>

        {chartLoading ? (
          <div className="h-64 flex items-center justify-center text-gray-500">
            Loading chart...
          </div>
        ) : chartStats?.dailyStats && chartStats.dailyStats.length > 0 ? (
          <OverviewChart dailyStats={chartStats.dailyStats} />
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
                    <span className="text-purple-600">{formatNumber(earner.referrals)} referrals</span>
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
          <div className="text-2xl font-bold">{formatNumber(counts.total)}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Active</div>
          <div className="text-2xl font-bold text-green-600">{formatNumber(counts.active)}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Excluded</div>
          <div className="text-2xl font-bold text-red-600">{formatNumber(counts.excluded)}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Paused</div>
          <div className="text-2xl font-bold text-yellow-600">{formatNumber(counts.paused)}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Archived</div>
          <div className="text-2xl font-bold text-gray-400">{formatNumber(counts.archived)}</div>
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
              <RecRow key={rec.id} rec={rec} index={index} startIndex={1} />
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
              <RecRow key={rec.id} rec={rec} index={index} startIndex={6} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
