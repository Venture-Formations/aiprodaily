'use client'

import type { LinkClickAnalytics } from './types'

interface LinkClicksSectionProps {
  linkClickLoading: boolean
  linkClickAnalytics: LinkClickAnalytics | null
}

export function LinkClicksSection({ linkClickLoading, linkClickAnalytics }: LinkClicksSectionProps) {
  if (linkClickLoading) {
    return (
      <div className="mt-8 bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Link Click Analytics</h3>
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
        </div>
      </div>
    )
  }

  if (!linkClickAnalytics || linkClickAnalytics.totalClicks <= 0) {
    return null
  }

  return (
    <div className="mt-8 bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Link Click Analytics</h3>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-indigo-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-indigo-600 mb-1">{linkClickAnalytics.totalClicks.toLocaleString()}</div>
          <div className="text-sm text-gray-600">Total Clicks</div>
        </div>
        <div className="bg-teal-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-teal-600 mb-1">{linkClickAnalytics.uniqueUsers.toLocaleString()}</div>
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
                    <td className="px-4 py-2 text-sm text-gray-900">{urlData.section}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{urlData.unique_users}</td>
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
