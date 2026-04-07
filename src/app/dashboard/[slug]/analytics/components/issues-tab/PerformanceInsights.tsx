'use client'

import type { Averages } from './types'

interface PerformanceInsightsProps {
  averages: Averages
}

export function PerformanceInsights({ averages }: PerformanceInsightsProps) {
  return (
    <div className="mt-8 bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Insights</h3>
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
              <span className={`font-medium ${averages.avgOpenRate > 55 ? 'text-green-600' : 'text-red-600'}`}>
                {averages.avgOpenRate.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Your average click rate:</span>
              <span className={`font-medium ${averages.avgClickRate > 8 ? 'text-green-600' : 'text-red-600'}`}>
                {averages.avgClickRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
        <div>
          <h4 className="font-medium text-gray-900 mb-2">Recommendations</h4>
          <div className="space-y-2 text-sm text-gray-600">
            {averages.avgOpenRate < 20 && <div>- Consider testing different subject line styles</div>}
            {averages.avgClickRate < 2 && <div>- Try including more compelling calls-to-action</div>}
            {averages.avgBounceRate > 5 && <div>- Review and clean your subscriber list</div>}
            {averages.avgOpenRate > 25 && <div>- Great open rates! Your subject lines are working well</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
