'use client'

import { useEffect, useState } from 'react'

interface Props {
  slug: string
}

export default function PollsAnalyticsTab({ slug }: Props) {
  const [loading, setLoading] = useState(true)
  const [polls, setPolls] = useState<any[]>([])
  const [selectedPollId, setSelectedPollId] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'aggregated' | 'per-issue'>('aggregated')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [days, setDays] = useState('30')

  useEffect(() => {
    fetchPollAnalytics()
  }, [slug, selectedPollId, days, startDate, endDate])

  const fetchPollAnalytics = async () => {
    try {
      setLoading(true)
      let url = `/api/polls/analytics?publication_id=${slug}`

      if (selectedPollId !== 'all') {
        url += `&poll_id=${selectedPollId}`
      }

      if (startDate && endDate) {
        url += `&start_date=${startDate}&end_date=${endDate}`
      } else {
        url += `&days=${days}`
      }

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setPolls(data.polls || [])
      }
    } catch (error) {
      console.error('Failed to fetch poll analytics:', error)
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
              Poll
            </label>
            <select
              value={selectedPollId}
              onChange={(e) => setSelectedPollId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Polls</option>
              {polls.map(poll => (
                <option key={poll.poll_id} value={poll.poll_id}>
                  {poll.poll_title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              View Mode
            </label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as any)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="aggregated">Aggregated (All Issues)</option>
              <option value="per-issue">Per Issue</option>
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
      </div>

      {/* Poll Results */}
      {polls.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-12 text-center text-gray-500">
          No poll data found for the selected filters
        </div>
      ) : (
        <div className="space-y-6">
          {polls.map(poll => {
            const data = viewMode === 'aggregated' ? poll.aggregated : poll.by_issue
            const isAggregated = viewMode === 'aggregated'

            return (
              <div key={poll.poll_id} className="bg-white shadow rounded-lg p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-medium text-gray-900">{poll.poll_title}</h3>
                  <p className="text-sm text-gray-600 mt-1">{poll.poll_question}</p>
                </div>

                {isAggregated ? (
                  <>
                    {/* Aggregated Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">
                          {data.total_responses}
                        </div>
                        <div className="text-sm text-gray-600">Total Responses</div>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {data.unique_respondents}
                        </div>
                        <div className="text-sm text-gray-600">Unique Respondents</div>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">
                          {data.response_rate !== null ? `${data.response_rate}%` : 'N/A'}
                        </div>
                        <div className="text-sm text-gray-600">Response Rate</div>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <div className="text-2xl font-bold text-orange-600">
                          {data.issues_included}
                        </div>
                        <div className="text-sm text-gray-600">Issues</div>
                      </div>
                    </div>

                    {/* Bar Chart */}
                    <div className="mt-6">
                      <h4 className="font-medium text-gray-900 mb-3">Response Distribution</h4>
                      <div className="space-y-3">
                        {poll.poll_options.map((option: string) => {
                          const count = data.option_counts[option] || 0
                          const percentage = data.option_percentages[option] || 0
                          return (
                            <div key={option}>
                              <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium text-gray-700">{option}</span>
                                <span className="text-gray-600">
                                  {count} ({percentage}%)
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-3">
                                <div
                                  className="bg-brand-primary rounded-full h-3 transition-all"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Per-Issue Results */}
                    <div className="space-y-6">
                      {poll.by_issue.map((issueData: any) => (
                        <div key={issueData.issue_id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="font-medium text-gray-900">
                              Issue: {issueData.issue_date}
                            </h4>
                            <div className="text-sm text-gray-600">
                              {issueData.total_responses} responses ({issueData.unique_respondents} unique)
                            </div>
                          </div>
                          <div className="space-y-2">
                            {poll.poll_options.map((option: string) => {
                              const count = issueData.option_counts[option] || 0
                              const percentage = issueData.option_percentages[option] || 0
                              return (
                                <div key={option} className="flex items-center">
                                  <div className="w-1/3 text-sm text-gray-700">{option}</div>
                                  <div className="flex-1">
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                      <div
                                        className="bg-brand-primary rounded-full h-2"
                                        style={{ width: `${percentage}%` }}
                                      />
                                    </div>
                                  </div>
                                  <div className="w-20 text-right text-sm text-gray-600">
                                    {count} ({percentage}%)
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
