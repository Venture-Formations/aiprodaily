'use client'

import { ImageAnalysisResult } from '@/types/database'
import type { SourceFields } from './types'

interface AnalysisPanelProps {
  analysisResult: ImageAnalysisResult
  sourceFields: SourceFields
  setSourceFields: {
    setSourceUrl: (v: string) => void
    setSource: (v: string) => void
    setLicense: (v: string) => void
    setCredit: (v: string) => void
  }
  loadingStockPhoto: boolean
  onStockPhotoLookup: () => void
}

export function AnalysisPanel({
  analysisResult,
  sourceFields,
  setSourceFields,
  loadingStockPhoto,
  onStockPhotoLookup,
}: AnalysisPanelProps) {
  const { sourceUrl, source, license, credit } = sourceFields
  const { setSourceUrl, setSource, setLicense, setCredit } = setSourceFields

  return (
    <div className="mb-3 p-3 bg-gray-50 rounded">
      <div className="flex justify-between items-center mb-2">
        <button
          onClick={onStockPhotoLookup}
          disabled={loadingStockPhoto}
          className="bg-purple-600 text-white px-3 py-1 rounded text-xs hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Find original stock photo source"
        >
          {loadingStockPhoto ? (
            <span className="flex items-center gap-1">
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Looking up...
            </span>
          ) : (
            'Stock Photo'
          )}
        </button>
      </div>
      <div className="space-y-2 text-xs">
        {analysisResult.faces_count > 0 && (
          <div>
            <span className="font-medium text-gray-700">Faces:</span>
            <span className="text-gray-600 ml-1">{analysisResult.faces_count} detected</span>
          </div>
        )}

        {analysisResult.age_groups && analysisResult.age_groups.length > 0 && (
          <div>
            <span className="font-medium text-gray-700">Age Groups:</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {analysisResult.age_groups.map((ageGroup, idx) => (
                <span
                  key={idx}
                  className={`px-2 py-1 rounded text-xs ${
                    ageGroup.age_group === 'preschool' ? 'bg-pink-100 text-pink-800' :
                    ageGroup.age_group === 'elementary' ? 'bg-green-100 text-green-800' :
                    ageGroup.age_group === 'high_school' ? 'bg-blue-100 text-blue-800' :
                    ageGroup.age_group === 'adult' ? 'bg-indigo-100 text-indigo-800' :
                    ageGroup.age_group === 'older_adult' ? 'bg-gray-100 text-gray-800' :
                    'bg-gray-100 text-gray-800'
                  }`}
                  title={`${Math.round(ageGroup.conf * 100)}% confidence`}
                >
                  {ageGroup.count} {ageGroup.age_group}
                </span>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block font-medium text-gray-700 mb-1">Source URL:</label>
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            placeholder="Enter source URL"
            className="w-full px-2 py-1 border border-gray-300 rounded"
          />
        </div>

        <div>
          <label className="block font-medium text-gray-700 mb-1">Source:</label>
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Enter source name (e.g., Shutterstock, Getty Images)"
            className="w-full px-2 py-1 border border-gray-300 rounded"
          />
        </div>

        <div>
          <label className="block font-medium text-gray-700 mb-1">License:</label>
          <input
            type="text"
            value={license}
            onChange={(e) => setLicense(e.target.value)}
            placeholder="e.g., Creative Commons, Public Domain"
            className="w-full px-2 py-1 border border-gray-300 rounded"
          />
        </div>

        <div>
          <label className="block font-medium text-gray-700 mb-1">Credit:</label>
          <input
            type="text"
            value={credit}
            onChange={(e) => setCredit(e.target.value)}
            placeholder="e.g., Photographer name or organization"
            className="w-full px-2 py-1 border border-gray-300 rounded"
          />
        </div>
      </div>
    </div>
  )
}
