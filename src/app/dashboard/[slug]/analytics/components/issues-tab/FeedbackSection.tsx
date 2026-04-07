'use client'

import type { FeedbackAnalytics } from './types'
import { formatDate } from './utils'

interface FeedbackSectionProps {
  feedbackLoading: boolean
  feedbackAnalytics: FeedbackAnalytics | null
}

export function FeedbackSection({ feedbackLoading, feedbackAnalytics }: FeedbackSectionProps) {
  if (feedbackLoading) {
    return (
      <div className="mt-8 bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Section Feedback Analytics</h3>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
        </div>
      </div>
    )
  }

  if (!feedbackAnalytics || feedbackAnalytics.totalResponses <= 0) {
    return null
  }

  return (
    <div className="mt-8 bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Section Feedback Analytics</h3>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-600 mb-1">{feedbackAnalytics.totalResponses}</div>
          <div className="text-sm text-gray-600">Total Responses</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-600 mb-1">{feedbackAnalytics.syncSuccessRate.toFixed(1)}%</div>
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
                    <td className="px-4 py-2 text-sm text-gray-900">{formatDate(response.issue_date)}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{response.section_choice}</td>
                    <td className="px-4 py-2 text-sm">
                      {response.mailerlite_updated ? (
                        <span className="text-green-600">&#10003;</span>
                      ) : (
                        <span className="text-red-600">&#10007;</span>
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
  )
}
