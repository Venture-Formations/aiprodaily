'use client'

import type { IssueWithMetrics, LinkClickAnalytics } from './types'
import { formatDate, formatPercentage } from './utils'

interface IssuePerformanceTableProps {
  issues: IssueWithMetrics[]
  slug: string
  excludeIps: boolean
  linkClickAnalytics: LinkClickAnalytics | null
  getIssueClickRate: (issue: IssueWithMetrics) => number | null
  refreshMetrics: (issueId: string) => void
  downloadCSV: () => void
}

export function IssuePerformanceTable({
  issues,
  slug,
  excludeIps,
  linkClickAnalytics,
  getIssueClickRate,
  refreshMetrics,
  downloadCSV,
}: IssuePerformanceTableProps) {
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-start">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Issue Performance</h2>
          <p className="text-sm text-gray-600">Detailed metrics for each sent newsletter</p>
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
        <div className="p-8 text-center text-gray-500">No sent issues found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject Line</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Open Rate</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Click Rate
                  {excludeIps && linkClickAnalytics && (
                    <span className="ml-1 text-blue-500 normal-case" title="Using internal tracking data with IP exclusions applied">*</span>
                  )}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {issues.map((issue) => (
                <tr key={issue.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatDate(issue.date)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {issue.subject_line || <span className="italic text-gray-400">No subject</span>}
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
                      (getIssueClickRate(issue) || 0) > 0.05 ? 'text-green-600' :
                      (getIssueClickRate(issue) || 0) > 0.02 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {formatPercentage(getIssueClickRate(issue))}
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

      {/* Updated at info */}
      {issues.length > 0 && (
        <div className="px-6 py-3 border-t border-gray-200 text-xs text-gray-500 flex justify-between items-center">
          <div>
            {excludeIps && linkClickAnalytics && (
              <span>* Click rates use internal tracking data with IP exclusions applied</span>
            )}
          </div>
          <div>
            {(() => {
              const latestImport = issues
                .filter(c => c.email_metrics?.imported_at)
                .map(c => new Date(c.email_metrics!.imported_at))
                .sort((a, b) => b.getTime() - a.getTime())[0]

              if (!latestImport) return 'Metrics not yet imported'

              return `MailerLite metrics updated ${latestImport.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
              })}`
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
