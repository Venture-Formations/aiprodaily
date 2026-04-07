'use client'

import type { Averages } from './types'

interface SummaryStatsProps {
  averages: Averages
}

export function SummaryStats({ averages }: SummaryStatsProps) {
  return (
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
          {averages.totalClicked.toLocaleString()} unique clickers
        </div>
        <div className="text-xs mt-1">
          {averages.usingOwnClickData ? (
            <span className="text-blue-600">Using filtered data</span>
          ) : (
            <span className="text-gray-400">Using MailerLite data</span>
          )}
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
  )
}
