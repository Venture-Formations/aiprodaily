'use client'

import { useEffect, useState } from 'react'

interface Props {
  slug: string
  excludeIps?: boolean
}

export default function AdsAnalyticsTab({ slug, excludeIps = true }: Props) {
  const [loading, setLoading] = useState(true)
  const [ads, setAds] = useState<any[]>([])
  const [adModules, setAdModules] = useState<string[]>([])
  const [selectedAdId, setSelectedAdId] = useState<string>('all')
  const [selectedAdModule, setSelectedAdModule] = useState<string>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [days, setDays] = useState('30')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  useEffect(() => {
    fetchAdAnalytics()
  }, [slug, selectedAdId, selectedAdModule, days, startDate, endDate, excludeIps])

  const fetchAdAnalytics = async () => {
    try {
      setLoading(true)
      let url = `/api/ads/analytics?newsletter_slug=${slug}`

      if (selectedAdId !== 'all') {
        url += `&ad_id=${selectedAdId}`
      }

      if (selectedAdModule !== 'all') {
        url += `&ad_module=${encodeURIComponent(selectedAdModule)}`
      }

      if (startDate && endDate) {
        url += `&start_date=${startDate}&end_date=${endDate}`
      } else {
        url += `&days=${days}`
      }

      url += `&exclude_ips=${excludeIps}`

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setAds(data.ads || [])
        setAdModules(data.ad_modules || [])
        setDateRange(data.date_range || { start: '', end: '' })
      }
    } catch (error) {
      console.error('Failed to fetch ad analytics:', error)
    } finally {
      setLoading(false)
    }
  }

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
              Advertisement
            </label>
            <select
              value={selectedAdId}
              onChange={(e) => setSelectedAdId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Ads</option>
              {ads.map(ad => (
                <option key={ad.ad_id} value={ad.ad_id}>
                  {ad.ad_title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ad Section
            </label>
            <select
              value={selectedAdModule}
              onChange={(e) => setSelectedAdModule(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Sections</option>
              {adModules.map(module => (
                <option key={module} value={module}>
                  {module}
                </option>
              ))}
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

          <div className="flex items-end">
            <div className="text-sm text-gray-600">
              Date range: {dateRange.start} to {dateRange.end}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      {ads.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-2xl font-bold text-blue-600 mb-1">
              {ads.reduce((sum, ad) => sum + ad.metrics.unique_clickers, 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Unique Clickers</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-2xl font-bold text-green-600 mb-1">
              {ads.reduce((sum, ad) => sum + ad.metrics.total_clicks, 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Clicks</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-2xl font-bold text-purple-600 mb-1">
              {ads.reduce((sum, ad) => sum + ad.metrics.times_used_in_range, 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Times Used</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-2xl font-bold text-orange-600 mb-1">
              {ads.length > 0
                ? (ads.reduce((sum, ad) => sum + (ad.metrics.click_through_rate || 0), 0) / ads.length).toFixed(2) + '%'
                : '0%'}
            </div>
            <div className="text-sm text-gray-600">Average CTR</div>
          </div>
        </div>
      )}

      {/* Ads Table */}
      {ads.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center text-gray-500">
          No advertisement data found for the selected filters
        </div>
      ) : (
        <div className="space-y-6">
          {ads.map((ad) => (
            <div key={ad.ad_id} className="bg-white shadow rounded-lg overflow-hidden">
              {/* Ad Header */}
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">{ad.ad_title}</h3>
                    <div className="mt-1 flex items-center gap-3 text-sm text-gray-600">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        ad.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {ad.status}
                      </span>
                      <span>Frequency: {ad.frequency}</span>
                      <span>Lifetime uses: {ad.lifetime_times_used}</span>
                      {ad.metrics.ad_sections && ad.metrics.ad_sections.length > 0 && (
                        <span className="flex items-center gap-1">
                          Sections:
                          {ad.metrics.ad_sections.map((section: string) => (
                            <span
                              key={section}
                              className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {section}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                  </div>
                  {ad.button_url && (
                    <a
                      href={ad.button_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-brand-primary hover:text-blue-700"
                    >
                      View URL →
                    </a>
                  )}
                </div>
              </div>

              {/* Ad Metrics */}
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {ad.metrics.unique_clickers}
                    </div>
                    <div className="text-sm text-gray-600">Unique Clickers</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {ad.metrics.total_clicks}
                    </div>
                    <div className="text-sm text-gray-600">Total Clicks</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {ad.metrics.times_used_in_range}
                    </div>
                    <div className="text-sm text-gray-600">Times Used (Period)</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {ad.metrics.click_through_rate !== null
                        ? `${ad.metrics.click_through_rate}%`
                        : 'N/A'}
                    </div>
                    <div className="text-sm text-gray-600">Click-Through Rate</div>
                  </div>
                  <div className="bg-teal-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-teal-600">
                      {ad.metrics.total_recipients !== null
                        ? ad.metrics.total_recipients.toLocaleString()
                        : 'N/A'}
                    </div>
                    <div className="text-sm text-gray-600">Total Recipients</div>
                  </div>
                </div>

                {/* Issue Dates */}
                {ad.metrics.issue_dates && ad.metrics.issue_dates.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-medium text-gray-900 mb-2">Issues Used In:</h4>
                    <div className="flex flex-wrap gap-2">
                      {ad.metrics.issue_dates.map((date: string) => (
                        <span
                          key={date}
                          className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                        >
                          {date}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Per-Issue Breakdown */}
                {ad.metrics.by_issue && ad.metrics.by_issue.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Performance by Issue:</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Issue Date
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Ad Section
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Total Clicks
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              Unique Clickers
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {ad.metrics.by_issue.map((issue: any) => (
                            <tr key={issue.issue_id}>
                              <td className="px-4 py-2 text-sm text-gray-900">{issue.issue_date}</td>
                              <td className="px-4 py-2 text-sm">
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {issue.ad_section || 'Unknown'}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-900">{issue.total_clicks}</td>
                              <td className="px-4 py-2 text-sm text-gray-900 font-semibold">
                                {issue.unique_clickers}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
