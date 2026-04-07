'use client'

import type { TestResult } from '../types'

interface TestHistoryProps {
  testHistory: TestResult[]
  onSelectResult: (result: TestResult) => void
}

export default function TestHistory({ testHistory, onSelectResult }: TestHistoryProps) {
  if (testHistory.length === 0) return null

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        Test History ({testHistory.length})
      </h3>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {testHistory.map((result, index) => (
          <div
            key={index}
            className="p-3 bg-gray-50 rounded border border-gray-200 cursor-pointer hover:bg-gray-100 hover:shadow-sm transition-all"
            onClick={() => onSelectResult(result)}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-900">
                {result.provider === 'openai' ? '\uD83D\uDFE6' : '\uD83D\uDFEA'} {result.model}
              </span>
              <span className="text-xs text-gray-500">
                {result.timestamp.toLocaleTimeString()}
              </span>
            </div>
            <p className="text-xs text-gray-600 truncate">
              {typeof result.response === 'string'
                ? result.response.substring(0, 100)
                : (result.response?.raw
                  ? result.response.raw.substring(0, 100)
                  : JSON.stringify(result.response).substring(0, 100))}...
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
