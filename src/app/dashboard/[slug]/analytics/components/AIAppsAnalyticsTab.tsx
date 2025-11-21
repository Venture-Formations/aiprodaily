'use client'

import { useEffect, useState } from 'react'

interface Props {
  slug: string
}

export default function AIAppsAnalyticsTab({ slug }: Props) {
  const [loading, setLoading] = useState(true)
  const [apps, setApps] = useState<any[]>([])
  const [affiliateFilter, setAffiliateFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [toolTypeFilter, setToolTypeFilter] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [days, setDays] = useState('7')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  useEffect(() => {
    fetchAIAppAnalytics()
  }, [slug, affiliateFilter, categoryFilter, toolTypeFilter, days, startDate, endDate])

  const fetchAIAppAnalytics = async () => {
    try {
      setLoading(true)
      let url = `/api/ai-apps/analytics?newsletter_slug=${slug}`

      if (affiliateFilter !== 'all') {
        url += `&affiliate=${affiliateFilter}`
      }
      if (categoryFilter !== 'all') {
        url += `&category=${encodeURIComponent(categoryFilter)}`
      }
      if (toolTypeFilter !== 'all') {
        url += `&tool_type=${encodeURIComponent(toolTypeFilter)}`
      }

      if (startDate && endDate) {
        url += `&start_date=${startDate}&end_date=${endDate}`
      } else {
        url += `&days=${days}`
      }

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setApps(data.apps || [])
        setDateRange(data.date_range || { start: '', end: '' })
      }
    } catch (error) {
      console.error('Failed to fetch AI app analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const clearFilters = () => {
    setAffiliateFilter('all')
    setCategoryFilter('all')
    setToolTypeFilter('all')
  }

  const categories = [
    'Payroll', 'HR', 'Accounting System', 'Finance',
    'Productivity', 'Client Management', 'Banking'
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    )
  }

  return (
    <div>
      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Affiliate Status
            </label>
            <select
              value={affiliateFilter}
              onChange={(e) => setAffiliateFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Apps</option>
              <option value="true">Affiliates Only</option>
              <option value="false">Non-Affiliates</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tool Type
            </label>
            <select
              value={toolTypeFilter}
              onChange={(e) => setToolTypeFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Types</option>
              <option value="Client">Client</option>
              <option value="Firm">Firm</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Timeframe
            </label>
            <select
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Showing {apps.length} apps ({dateRange.start} to {dateRange.end})
          </div>
          <button
            onClick={clearFilters}
            className="text-sm text-brand-primary hover:text-blue-700"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      {apps.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {apps.reduce((sum, app) => sum + app.metrics.unique_clickers, 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Unique Clickers</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-2xl font-bold text-green-600 mb-1">
              {apps.reduce((sum, app) => sum + app.metrics.total_clicks, 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Clicks</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-2xl font-bold text-purple-600 mb-1">
              {apps.reduce((sum, app) => sum + app.metrics.issues_used, 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Issue Appearances</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-2xl font-bold text-orange-600 mb-1">
              {apps.filter(app => app.is_affiliate).length}
            </div>
            <div className="text-sm text-gray-600">Affiliate Apps</div>
          </div>
        </div>
      )}

      {/* Apps Table */}
      {apps.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center text-gray-500">
          No AI apps found for the selected filters
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    App Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unique Clickers
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Clicks
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Issues Used
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CTR
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {apps.map((app) => (
                  <tr key={app.app_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <div className="flex items-center">
                        {app.app_name}
                        {app.is_affiliate && (
                          <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            Affiliate
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {app.category || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {app.tool_type || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="font-semibold text-brand-primary">
                        {app.metrics.unique_clickers.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {app.metrics.total_clicks.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {app.metrics.issues_used}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {app.metrics.click_through_rate !== null
                        ? `${app.metrics.click_through_rate}%`
                        : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer Stats */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <span className="font-medium">Average CTR:</span>
                  <span className="ml-2">
                    {apps.length > 0
                      ? (apps.reduce((sum, app) => sum + (app.metrics.click_through_rate || 0), 0) / apps.length).toFixed(2) + '%'
                      : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Avg Unique Clickers:</span>
                  <span className="ml-2">
                    {apps.length > 0
                      ? Math.round(apps.reduce((sum, app) => sum + app.metrics.unique_clickers, 0) / apps.length)
                      : 0}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Most Used:</span>
                  <span className="ml-2">
                    {apps.length > 0
                      ? apps.reduce((max, app) => app.metrics.issues_used > max.metrics.issues_used ? app : max, apps[0]).app_name
                      : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Top Performer:</span>
                  <span className="ml-2">
                    {apps.length > 0
                      ? apps.reduce((max, app) => app.metrics.unique_clickers > max.metrics.unique_clickers ? app : max, apps[0]).app_name
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
