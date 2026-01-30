'use client'

import { useEffect, useState } from 'react'
import type { EmailMetrics, Newsletterissue } from '@/types/database'

interface IssueWithMetrics extends Newsletterissue {
  email_metrics?: EmailMetrics
}

interface FeedbackAnalytics {
  totalResponses: number
  successfulSyncs: number
  syncSuccessRate: number
  sectionCounts: { [key: string]: number }
  dailyResponses: { [key: string]: number }
  recentResponses: any[]
  dateRange: { start: string; end: string }
}

interface LinkClickAnalytics {
  totalClicks: number
  uniqueUsers: number
  clicksBySection: { [key: string]: number }
  uniqueUsersBySection: { [key: string]: number }
  dailyClicks: { [key: string]: number }
  topUrls: { url: string; section: string; clicks: number; unique_users: number }[]
  clicksByissue: { [key: string]: number }
  recentClicks: any[]
  dateRange: { start: string; end: string }
}

interface Props {
  slug: string
  excludeIps?: boolean
}

export default function IssuesAnalyticsTab({ slug, excludeIps = true }: Props) {
  const [issues, setIssues] = useState<IssueWithMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTimeframe, setSelectedTimeframe] = useState('7')
  const [feedbackAnalytics, setFeedbackAnalytics] = useState<FeedbackAnalytics | null>(null)
  const [feedbackLoading, setFeedbackLoading] = useState(true)
  const [linkClickAnalytics, setLinkClickAnalytics] = useState<LinkClickAnalytics | null>(null)
  const [linkClickLoading, setLinkClickLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
    fetchFeedbackAnalytics()
    fetchLinkClickAnalytics()
  }, [selectedTimeframe, slug, excludeIps])

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(
        `/api/campaigns?limit=50&status=sent&newsletter_slug=${slug}&days=${selectedTimeframe}`
      )
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data')
      }
      const data = await response.json()
      setIssues(data.issues)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const fetchFeedbackAnalytics = async () => {
    try {
      setFeedbackLoading(true)
      const response = await fetch(`/api/feedback/analytics?days=${selectedTimeframe}`)
      if (response.ok) {
        const data = await response.json()
        setFeedbackAnalytics(data.analytics)
      }
    } catch (error) {
      console.error('Failed to fetch feedback analytics:', error)
    } finally {
      setFeedbackLoading(false)
    }
  }

  const fetchLinkClickAnalytics = async () => {
    try {
      setLinkClickLoading(true)
      const response = await fetch(`/api/link-tracking/analytics?days=${selectedTimeframe}&exclude_ips=${excludeIps}`)
      if (response.ok) {
        const data = await response.json()
        setLinkClickAnalytics(data.analytics)
      }
    } catch (error) {
      console.error('Failed to fetch link click analytics:', error)
    } finally {
      setLinkClickLoading(false)
    }
  }

  const refreshMetrics = async (issueId: string) => {
    try {
      const response = await fetch(`/api/analytics/${issueId}`, {
        method: 'POST'
      })
      const data = await response.json()

      if (response.ok) {
        if (data.metrics?.skipped) {
          alert(`Skipped: ${data.metrics.reason || 'No metrics available yet'}`)
        } else {
          alert('Metrics refreshed successfully!')
          fetchAnalytics() // Refresh the data
        }
      } else {
        alert(`Failed to refresh: ${data.message || data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to refresh metrics:', error)
      alert('Failed to refresh metrics. Check console for details.')
    }
  }

  const calculateAverages = () => {
    const issuesWithMetrics = issues.filter(c => c.email_metrics)
    if (issuesWithMetrics.length === 0) return null

    const totals = issuesWithMetrics.reduce((acc, issue) => {
      const metrics = issue.email_metrics!
      return {
        sent: acc.sent + (metrics.sent_count || 0),
        delivered: acc.delivered + (metrics.delivered_count || 0),
        opened: acc.opened + (metrics.opened_count || 0),
        clicked: acc.clicked + (metrics.clicked_count || 0),
        bounced: acc.bounced + (metrics.bounced_count || 0),
        unsubscribed: acc.unsubscribed + (metrics.unsubscribed_count || 0),
      }
    }, { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 })

    // Use sent_count as denominator when delivered_count is 0 or not available
    const denominator = totals.delivered > 0 ? totals.delivered : totals.sent

    return {
      avgOpenRate: denominator > 0 ? (totals.opened / denominator) * 100 : 0,
      avgClickRate: denominator > 0 ? (totals.clicked / denominator) * 100 : 0,
      avgBounceRate: totals.sent > 0 ? (totals.bounced / totals.sent) * 100 : 0,
      avgUnsubscribeRate: denominator > 0 ? (totals.unsubscribed / denominator) * 100 : 0,
      totalSent: totals.sent,
      totalDelivered: totals.delivered,
      totalOpened: totals.opened,
      totalClicked: totals.clicked,
      issueCount: issuesWithMetrics.length
    }
  }

  const formatDate = (dateString: string) => {
    // Parse date string directly to avoid timezone conversion issues
    // dateString is in YYYY-MM-DD format (local date, no time)
    const [year, month, day] = dateString.split('T')[0].split('-')
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  const formatPercentage = (value: number | null | undefined) => {
    if (value == null) return 'N/A'
    return `${(value * 100).toFixed(1)}%`
  }

  const averages = calculateAverages()

  const downloadCSV = () => {
    if (issues.length === 0) return

    // CSV headers
    const headers = [
      'Date',
      'Subject Line',
      'Sent',
      'Delivered',
      'Opens',
      'Open Rate',
      'Clicks',
      'Click Rate',
      'Bounces',
      'Bounce Rate',
      'Unsubscribes'
    ]

    // CSV rows
    const rows = issues.map(issue => {
      const metrics = issue.email_metrics
      const sent = metrics?.sent_count || 0
      const delivered = metrics?.delivered_count || 0
      const opened = metrics?.opened_count || 0
      const clicked = metrics?.clicked_count || 0
      const bounced = metrics?.bounced_count || 0
      const unsubscribed = metrics?.unsubscribed_count || 0

      // Calculate rates
      const denominator = delivered > 0 ? delivered : sent
      const openRate = denominator > 0 ? ((opened / denominator) * 100).toFixed(2) : '0.00'
      const clickRate = denominator > 0 ? ((clicked / denominator) * 100).toFixed(2) : '0.00'
      const bounceRate = sent > 0 ? ((bounced / sent) * 100).toFixed(2) : '0.00'

      return [
        issue.date.split('T')[0],
        `"${(issue.subject_line || '').replace(/"/g, '""')}"`, // Escape quotes in subject line
        sent,
        delivered,
        opened,
        `${openRate}%`,
        clicked,
        `${clickRate}%`,
        bounced,
        `${bounceRate}%`,
        unsubscribed
      ]
    })

    // Build CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `issue-performance-${slug}-${selectedTimeframe}days.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div>
      {/* Timeframe Selector */}
      <div className="mb-6 flex justify-end">
        <select
          value={selectedTimeframe}
          onChange={(e) => setSelectedTimeframe(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last year</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <div className="text-red-600 mb-4">Error: {error}</div>
          <button
            onClick={fetchAnalytics}
            className="text-brand-primary hover:text-blue-700"
          >
            Try Again
          </button>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          {averages && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-2xl font-bold text-green-600 mb-1">
                  {averages.avgOpenRate.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">Average Open Rate</div>
                <div className="text-xs text-gray-500 mt-1">
                  {averages.totalOpened.toLocaleString()} total opens
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  {averages.avgClickRate.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">Average Click Rate</div>
                <div className="text-xs text-gray-500 mt-1">
                  {averages.totalClicked.toLocaleString()} total clicks
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-2xl font-bold text-gray-600 mb-1">
                  {averages.totalSent.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Total Sent</div>
                <div className="text-xs text-gray-500 mt-1">
                  {averages.issueCount} issues
                </div>
              </div>
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="text-2xl font-bold text-yellow-600 mb-1">
                  {averages.avgBounceRate.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">Average Bounce Rate</div>
                <div className="text-xs text-gray-500 mt-1">
                  {averages.totalDelivered.toLocaleString()} delivered
                </div>
              </div>
            </div>
          )}

          {/* Issue Performance Table */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-start">
              <div>
                <h2 className="text-lg font-medium text-gray-900">
                  Issue Performance
                </h2>
                <p className="text-sm text-gray-600">
                  Detailed metrics for each sent newsletter
                </p>
              </div>
              {issues.length > 0 && (
                <button
                  onClick={downloadCSV}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary"
                >
                  <svg className="h-4 w-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export CSV
                </button>
              )}
            </div>

            {issues.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No sent issues found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Subject Line
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sent
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Open Rate
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Click Rate
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {issues.map((issue) => (
                      <tr key={issue.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatDate(issue.date)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                          {issue.subject_line || (
                            <span className="italic text-gray-400">No subject</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {issue.email_metrics?.sent_count?.toLocaleString() || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className={`font-medium ${
                            (issue.email_metrics?.open_rate || 0) > 0.25 ? 'text-green-600' :
                            (issue.email_metrics?.open_rate || 0) > 0.15 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {formatPercentage(issue.email_metrics?.open_rate)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className={`font-medium ${
                            (issue.email_metrics?.click_rate || 0) > 0.05 ? 'text-green-600' :
                            (issue.email_metrics?.click_rate || 0) > 0.02 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {formatPercentage(issue.email_metrics?.click_rate)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => refreshMetrics(issue.id)}
                            className="text-brand-primary hover:text-blue-700 mr-3"
                          >
                            Refresh
                          </button>
                          <a
                            href={`/dashboard/${slug}/issues/${issue.id}`}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            View
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Feedback Analytics */}
          {feedbackLoading ? (
            <div className="mt-8 bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Section Feedback Analytics
              </h3>
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
              </div>
            </div>
          ) : feedbackAnalytics && feedbackAnalytics.totalResponses > 0 ? (
            <div className="mt-8 bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Section Feedback Analytics
              </h3>

              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600 mb-1">
                    {feedbackAnalytics.totalResponses}
                  </div>
                  <div className="text-sm text-gray-600">Total Responses</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 mb-1">
                    {feedbackAnalytics.syncSuccessRate.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600">Email Provider Sync Rate</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600 mb-1">
                    {Object.entries(feedbackAnalytics.sectionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600">Most Popular Section</div>
                </div>
              </div>

              {/* Section Popularity */}
              <div className="mb-6">
                <h4 className="font-medium text-gray-900 mb-3">Section Popularity</h4>
                <div className="space-y-2">
                  {Object.entries(feedbackAnalytics.sectionCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([section, count]) => {
                      const percentage = (count / feedbackAnalytics.totalResponses) * 100
                      return (
                        <div key={section}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-gray-700">{section}</span>
                            <span className="text-gray-600">{count} ({percentage.toFixed(1)}%)</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-brand-primary rounded-full h-2"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>

              {/* Recent Responses */}
              {feedbackAnalytics.recentResponses.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Recent Responses</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Section</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Synced</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {feedbackAnalytics.recentResponses.map((response, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {formatDate(response.issue_date)}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {response.section_choice}
                            </td>
                            <td className="px-4 py-2 text-sm">
                              {response.mailerlite_updated ? (
                                <span className="text-green-600">✓</span>
                              ) : (
                                <span className="text-red-600">✗</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Link Click Analytics */}
          {linkClickLoading ? (
            <div className="mt-8 bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Link Click Analytics
              </h3>
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
              </div>
            </div>
          ) : linkClickAnalytics && linkClickAnalytics.totalClicks > 0 ? (
            <div className="mt-8 bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Link Click Analytics
              </h3>

              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-600 mb-1">
                    {linkClickAnalytics.totalClicks.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">Total Clicks</div>
                </div>
                <div className="bg-teal-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-teal-600 mb-1">
                    {linkClickAnalytics.uniqueUsers.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600">Unique Clickers</div>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600 mb-1">
                    {Object.entries(linkClickAnalytics.clicksBySection).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
                  </div>
                  <div className="text-sm text-gray-600">Most Clicked Section</div>
                </div>
              </div>

              {/* Section Click Breakdown */}
              <div className="mb-6">
                <h4 className="font-medium text-gray-900 mb-3">Clicks by Section</h4>
                <div className="space-y-2">
                  {Object.entries(linkClickAnalytics.clicksBySection)
                    .sort((a, b) => b[1] - a[1])
                    .map(([section, count]) => {
                      const percentage = (count / linkClickAnalytics.totalClicks) * 100
                      const uniqueUsers = linkClickAnalytics.uniqueUsersBySection[section] || 0
                      return (
                        <div key={section}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-gray-700">{section}</span>
                            <span className="text-gray-600">
                              {count} clicks ({uniqueUsers} unique) - {percentage.toFixed(1)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-indigo-600 rounded-full h-2"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>

              {/* Top URLs */}
              {linkClickAnalytics.topUrls.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium text-gray-900 mb-3">Top 10 Clicked Links</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">URL</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Section</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Unique Clickers</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {linkClickAnalytics.topUrls.map((urlData, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 text-sm text-gray-900 max-w-xs truncate">
                              <a
                                href={urlData.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 underline"
                              >
                                {urlData.url}
                              </a>
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {urlData.section}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-900">
                              {urlData.unique_users}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Performance Insights */}
          {averages && (
            <div className="mt-8 bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Performance Insights
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Benchmarks</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Newsletter industry avg open rate:</span>
                      <span className="font-medium">55%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Newsletter industry avg click rate:</span>
                      <span className="font-medium">8%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Your average open rate:</span>
                      <span className={`font-medium ${
                        averages.avgOpenRate > 55 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {averages.avgOpenRate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Your average click rate:</span>
                      <span className={`font-medium ${
                        averages.avgClickRate > 8 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {averages.avgClickRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Recommendations</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    {averages.avgOpenRate < 20 && (
                      <div>• Consider testing different subject line styles</div>
                    )}
                    {averages.avgClickRate < 2 && (
                      <div>• Try including more compelling calls-to-action</div>
                    )}
                    {averages.avgBounceRate > 5 && (
                      <div>• Review and clean your subscriber list</div>
                    )}
                    {averages.avgOpenRate > 25 && (
                      <div>• Great open rates! Your subject lines are working well</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
