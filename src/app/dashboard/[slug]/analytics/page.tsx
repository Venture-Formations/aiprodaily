'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import type { EmailMetrics, NewsletterCampaign } from '@/types/database'

interface CampaignWithMetrics extends NewsletterCampaign {
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
  topUrls: { url: string; section: string; clicks: number }[]
  clicksByCampaign: { [key: string]: number }
  recentClicks: any[]
  dateRange: { start: string; end: string }
}

export default function AnalyticsPage() {
  const [campaigns, setCampaigns] = useState<CampaignWithMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTimeframe, setSelectedTimeframe] = useState('30')
  const [feedbackAnalytics, setFeedbackAnalytics] = useState<FeedbackAnalytics | null>(null)
  const [feedbackLoading, setFeedbackLoading] = useState(true)
  const [linkClickAnalytics, setLinkClickAnalytics] = useState<LinkClickAnalytics | null>(null)
  const [linkClickLoading, setLinkClickLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
    fetchFeedbackAnalytics()
    fetchLinkClickAnalytics()
  }, [selectedTimeframe])

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`/api/campaigns?limit=50&status=sent`)
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data')
      }
      const data = await response.json()
      setCampaigns(data.campaigns)
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
      const response = await fetch(`/api/link-tracking/analytics?days=${selectedTimeframe}`)
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

  const refreshMetrics = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/analytics/${campaignId}`, {
        method: 'POST'
      })
      if (response.ok) {
        fetchAnalytics() // Refresh the data
      }
    } catch (error) {
      console.error('Failed to refresh metrics:', error)
    }
  }

  const calculateAverages = () => {
    const campaignsWithMetrics = campaigns.filter(c => c.email_metrics)
    if (campaignsWithMetrics.length === 0) return null

    const totals = campaignsWithMetrics.reduce((acc, campaign) => {
      const metrics = campaign.email_metrics!
      return {
        sent: acc.sent + metrics.sent_count,
        delivered: acc.delivered + metrics.delivered_count,
        opened: acc.opened + metrics.opened_count,
        clicked: acc.clicked + metrics.clicked_count,
        bounced: acc.bounced + metrics.bounced_count,
        unsubscribed: acc.unsubscribed + metrics.unsubscribed_count,
      }
    }, { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 })

    return {
      avgOpenRate: totals.delivered > 0 ? (totals.opened / totals.delivered) * 100 : 0,
      avgClickRate: totals.delivered > 0 ? (totals.clicked / totals.delivered) * 100 : 0,
      avgBounceRate: totals.sent > 0 ? (totals.bounced / totals.sent) * 100 : 0,
      avgUnsubscribeRate: totals.delivered > 0 ? (totals.unsubscribed / totals.delivered) * 100 : 0,
      totalSent: totals.sent,
      totalDelivered: totals.delivered,
      totalOpened: totals.opened,
      totalClicked: totals.clicked,
      campaignCount: campaignsWithMetrics.length
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  const formatPercentage = (value: number | null | undefined) => {
    if (value == null) return 'N/A'
    return `${(value * 100).toFixed(1)}%`
  }

  const averages = calculateAverages()

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Newsletter Analytics
            </h1>
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
                    {averages.campaignCount} campaigns
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

            {/* Campaign Performance Table */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">
                  Campaign Performance
                </h2>
                <p className="text-sm text-gray-600">
                  Detailed metrics for each sent newsletter
                </p>
              </div>

              {campaigns.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No sent campaigns found
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
                      {campaigns.map((campaign) => (
                        <tr key={campaign.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {formatDate(campaign.date)}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                            {campaign.subject_line || (
                              <span className="italic text-gray-400">No subject</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {campaign.email_metrics?.sent_count?.toLocaleString() || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`font-medium ${
                              (campaign.email_metrics?.open_rate || 0) > 0.25 ? 'text-green-600' :
                              (campaign.email_metrics?.open_rate || 0) > 0.15 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {formatPercentage(campaign.email_metrics?.open_rate)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`font-medium ${
                              (campaign.email_metrics?.click_rate || 0) > 0.05 ? 'text-green-600' :
                              (campaign.email_metrics?.click_rate || 0) > 0.02 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {formatPercentage(campaign.email_metrics?.click_rate)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => refreshMetrics(campaign.id)}
                              className="text-brand-primary hover:text-blue-700 mr-3"
                            >
                              Refresh
                            </button>
                            <a
                              href={`/dashboard/campaigns/${campaign.id}`}
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
                    <div className="text-sm text-gray-600">MailerLite Sync Rate</div>
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
                                {formatDate(response.campaign_date)}
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
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Clicks</th>
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
                                {urlData.clicks}
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
                        <span className="font-medium">21.3%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Newsletter industry avg click rate:</span>
                        <span className="font-medium">2.6%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Your average open rate:</span>
                        <span className={`font-medium ${
                          averages.avgOpenRate > 21.3 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {averages.avgOpenRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Your average click rate:</span>
                        <span className={`font-medium ${
                          averages.avgClickRate > 2.6 ? 'text-green-600' : 'text-red-600'
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
    </Layout>
  )
}