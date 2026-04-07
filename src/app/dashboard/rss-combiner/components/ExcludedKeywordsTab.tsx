'use client'

import type { ExcludedKeyword } from '../types'

interface ExcludedKeywordsTabProps {
  excludedKeywords: ExcludedKeyword[]
  newKeyword: string
  setNewKeyword: (s: string) => void
  handleAddKeyword: () => void
  handleDeleteKeyword: (id: string) => void
}

export function ExcludedKeywordsTab({
  excludedKeywords,
  newKeyword,
  setNewKeyword,
  handleAddKeyword,
  handleDeleteKeyword,
}: ExcludedKeywordsTabProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-medium text-gray-700">Excluded Keywords ({excludedKeywords.length})</h2>
        <p className="text-xs text-gray-500 mt-1">
          Articles with titles containing these keywords will be filtered out (case-insensitive).
        </p>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
            placeholder="Keyword to exclude..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md"
          />
          <button
            onClick={handleAddKeyword}
            disabled={!newKeyword.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            Exclude
          </button>
        </div>
        {excludedKeywords.length === 0 ? (
          <div className="text-sm text-gray-500 py-2">No keywords excluded yet.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {excludedKeywords.map((kw) => (
              <span
                key={kw.id}
                className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-orange-50 text-orange-700 rounded-full border border-orange-200"
              >
                {kw.keyword}
                <button
                  onClick={() => handleDeleteKeyword(kw.id)}
                  className="ml-1 text-orange-400 hover:text-orange-600"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
