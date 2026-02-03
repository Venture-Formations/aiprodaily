'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import Link from 'next/link'
import { ArrowLeft, Eye, MousePointer, ExternalLink, TrendingUp, Folder } from 'lucide-react'

interface ToolAnalytics {
  totalClicks: number
  clicksByType: {
    category_click: number
    tool_view: number
    external_link: number
  }
  topCategories: Array<{ slug: string; name: string; clicks: number }>
  topToolsByViews: Array<{ id: string; name: string; views: number; external_clicks: number }>
  topToolsByClicks: Array<{ id: string; name: string; views: number; external_clicks: number }>
  dailyClicks: { [date: string]: number }
  clicksByReferrerType: { [type: string]: number }
  dateRange: { start: string; end: string }
}

export default function ToolsAnalyticsPage() {
  const [analytics, setAnalytics] = useState<ToolAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(30)

  useEffect(() => {
    fetchAnalytics()
  }, [days])

  async function fetchAnalytics() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/tools/analytics?days=${days}`)
      const data = await res.json()
      if (data.success) {
        setAnalytics(data.analytics)
      } else {
        setError(data.error || 'Failed to fetch analytics')
      }
    } catch (err) {
      setError('Failed to fetch analytics')
      console.error('Analytics fetch error:', err)
    }
    setLoading(false)
  }

  // Format number with commas
  const formatNumber = (num: number) => num.toLocaleString()

  // Calculate conversion rate
  const getConversionRate = () => {
    if (!analytics) return '0%'
    const views = analytics.clicksByType.tool_view || 0
    const clicks = analytics.clicksByType.external_link || 0
    if (views === 0) return '0%'
    return ((clicks / views) * 100).toFixed(1) + '%'
  }

  // Get sorted daily data for chart
  const getDailyData = () => {
    if (!analytics?.dailyClicks) return []
    return Object.entries(analytics.dailyClicks)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, clicks]) => ({ date, clicks }))
  }

  // Get max clicks for chart scaling
  const getMaxClicks = () => {
    const dailyData = getDailyData()
    if (dailyData.length === 0) return 1
    return Math.max(...dailyData.map(d => d.clicks), 1)
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="../tools-admin"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Tools Admin
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tools Directory Analytics</h1>
              <p className="text-gray-600 mt-1">Track clicks, views, and engagement</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Time range:</label>
              <select
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={7}>Last 7 days</option>
                <option value={30}>Last 30 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-500">Loading analytics...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12 bg-red-50 rounded-lg">
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchAnalytics}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        ) : analytics ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Clicks</p>
                    <p className="text-2xl font-bold text-gray-900">{formatNumber(analytics.totalClicks)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Eye className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Tool Views</p>
                    <p className="text-2xl font-bold text-gray-900">{formatNumber(analytics.clicksByType.tool_view)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <ExternalLink className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Website Clicks</p>
                    <p className="text-2xl font-bold text-gray-900">{formatNumber(analytics.clicksByType.external_link)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <MousePointer className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Conversion Rate</p>
                    <p className="text-2xl font-bold text-gray-900">{getConversionRate()}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Click Type Breakdown */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Click Type Breakdown</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Folder className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(analytics.clicksByType.category_click)}</p>
                  <p className="text-sm text-gray-500">Category Clicks</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Eye className="w-6 h-6 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(analytics.clicksByType.tool_view)}</p>
                  <p className="text-sm text-gray-500">Tool Views</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <ExternalLink className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(analytics.clicksByType.external_link)}</p>
                  <p className="text-sm text-gray-500">External Clicks</p>
                </div>
              </div>
            </div>

            {/* Daily Chart */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Clicks</h3>
              <div className="h-48 flex items-end gap-1">
                {getDailyData().map(({ date, clicks }) => (
                  <div
                    key={date}
                    className="flex-1 bg-blue-500 rounded-t hover:bg-blue-600 transition-colors relative group"
                    style={{ height: `${(clicks / getMaxClicks()) * 100}%`, minHeight: clicks > 0 ? '4px' : '0' }}
                  >
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                      {date}: {clicks} clicks
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                {analytics.dateRange.start} to {analytics.dateRange.end}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Tools by Views */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Tools by Views</h3>
                {analytics.topToolsByViews.length > 0 ? (
                  <div className="space-y-3">
                    {analytics.topToolsByViews.map((tool, index) => (
                      <div key={tool.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-400 w-6">{index + 1}.</span>
                          <Link
                            href={`/tools/${tool.id}`}
                            target="_blank"
                            className="text-sm font-medium text-gray-900 hover:text-blue-600"
                          >
                            {tool.name}
                          </Link>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-gray-600">{formatNumber(tool.views)} views</span>
                          <span className="text-gray-400">|</span>
                          <span className="text-purple-600">{formatNumber(tool.external_clicks)} clicks</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No data yet</p>
                )}
              </div>

              {/* Top Tools by External Clicks */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Tools by Website Clicks</h3>
                {analytics.topToolsByClicks.length > 0 ? (
                  <div className="space-y-3">
                    {analytics.topToolsByClicks.map((tool, index) => (
                      <div key={tool.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-400 w-6">{index + 1}.</span>
                          <Link
                            href={`/tools/${tool.id}`}
                            target="_blank"
                            className="text-sm font-medium text-gray-900 hover:text-blue-600"
                          >
                            {tool.name}
                          </Link>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-purple-600 font-medium">{formatNumber(tool.external_clicks)} clicks</span>
                          <span className="text-gray-400">|</span>
                          <span className="text-gray-600">{formatNumber(tool.views)} views</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No data yet</p>
                )}
              </div>

              {/* Top Categories */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Categories</h3>
                {analytics.topCategories.length > 0 ? (
                  <div className="space-y-3">
                    {analytics.topCategories.map((category, index) => (
                      <div key={category.slug} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-400 w-6">{index + 1}.</span>
                          <Link
                            href={`/tools/category/${category.slug}`}
                            target="_blank"
                            className="text-sm font-medium text-gray-900 hover:text-blue-600"
                          >
                            {category.name}
                          </Link>
                        </div>
                        <span className="text-sm text-gray-600">{formatNumber(category.clicks)} clicks</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No data yet</p>
                )}
              </div>

              {/* Traffic Sources */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Traffic Sources</h3>
                {Object.keys(analytics.clicksByReferrerType).length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(analytics.clicksByReferrerType)
                      .sort((a, b) => b[1] - a[1])
                      .map(([referrer, clicks]) => (
                        <div key={referrer} className="flex items-center justify-between">
                          <span className="text-sm text-gray-900 capitalize">
                            {referrer.replace(/_/g, ' ')}
                          </span>
                          <span className="text-sm text-gray-600">{formatNumber(clicks)} clicks</span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No data yet</p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </Layout>
  )
}
