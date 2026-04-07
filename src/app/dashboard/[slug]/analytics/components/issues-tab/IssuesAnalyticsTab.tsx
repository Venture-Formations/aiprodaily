'use client'

import type { Props } from './types'
import { useIssuesAnalytics } from './useIssuesAnalytics'
import { SummaryStats } from './SummaryStats'
import { IssuePerformanceTable } from './IssuePerformanceTable'
import { FeedbackSection } from './FeedbackSection'
import { LinkClicksSection } from './LinkClicksSection'
import { PerformanceInsights } from './PerformanceInsights'

export default function IssuesAnalyticsTab({ slug, excludeIps = true }: Props) {
  const {
    issues,
    loading,
    error,
    selectedTimeframe,
    setSelectedTimeframe,
    feedbackAnalytics,
    feedbackLoading,
    linkClickAnalytics,
    linkClickLoading,
    fetchAnalytics,
    refreshMetrics,
    calculateAverages,
    getIssueClickRate,
    downloadCSV,
  } = useIssuesAnalytics(slug, excludeIps)

  const averages = calculateAverages()

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
          <button onClick={fetchAnalytics} className="text-brand-primary hover:text-blue-700">
            Try Again
          </button>
        </div>
      ) : (
        <>
          {averages && <SummaryStats averages={averages} />}

          <IssuePerformanceTable
            issues={issues}
            slug={slug}
            excludeIps={excludeIps}
            linkClickAnalytics={linkClickAnalytics}
            getIssueClickRate={getIssueClickRate}
            refreshMetrics={refreshMetrics}
            downloadCSV={downloadCSV}
          />

          <FeedbackSection
            feedbackLoading={feedbackLoading}
            feedbackAnalytics={feedbackAnalytics}
          />

          <LinkClicksSection
            linkClickLoading={linkClickLoading}
            linkClickAnalytics={linkClickAnalytics}
          />

          {averages && <PerformanceInsights averages={averages} />}
        </>
      )}
    </div>
  )
}
