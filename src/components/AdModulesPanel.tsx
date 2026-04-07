'use client'

import { useAdModulesPanel } from './useAdModulesPanel'

interface AdModulesPanelProps {
  issueId: string
}

export default function AdModulesPanel({ issueId }: AdModulesPanelProps) {
  const {
    loading, modules, moduleAds, expanded, saving,
    handleSelectAd, toggleExpanded, getSelectionForModule,
  } = useAdModulesPanel(issueId)

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6 mt-8">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  if (modules.length === 0) return null

  return (
    <div className="bg-white shadow rounded-lg mt-8">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Ad Sections</h2>
        <p className="text-sm text-gray-500 mt-1">Dynamic ad sections configured in Settings</p>
      </div>

      <div className="divide-y divide-gray-200">
        {modules.map(module => {
          const selection = getSelectionForModule(module.id)
          const selectedAd = selection?.advertisement
          const availableAds = moduleAds[module.id] || []
          const isExpanded = expanded[module.id]
          const isManualMode = module.selection_mode === 'manual'
          const isSaving = saving === module.id

          return (
            <div key={module.id} className="p-4">
              {/* Module Header */}
              <div className="flex items-center justify-between cursor-pointer" onClick={() => toggleExpanded(module.id)}>
                <div className="flex items-center space-x-3">
                  <span className="font-medium text-gray-900">{module.name}</span>
                  <span className="text-xs text-gray-400">Display Order: {module.display_order}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    module.selection_mode === 'manual' ? 'bg-yellow-100 text-yellow-800'
                    : module.selection_mode === 'sequential' ? 'bg-blue-100 text-blue-800'
                    : module.selection_mode === 'random' ? 'bg-purple-100 text-purple-800'
                    : 'bg-green-100 text-green-800'
                  }`}>{module.selection_mode}</span>
                </div>
                <div className="flex items-center space-x-3">
                  {selectedAd ? (
                    <span className="text-sm text-green-600">{selectedAd.title}</span>
                  ) : isManualMode ? (
                    <span className="text-sm text-yellow-600">Needs selection</span>
                  ) : (
                    <span className="text-sm text-gray-500">No ad available</span>
                  )}
                  <svg className={`w-5 h-5 text-gray-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="mt-4 space-y-4">
                  {isManualMode && availableAds.length > 0 && (
                    <div className="bg-yellow-50 p-3 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select Ad for this Section</label>
                      <div className="flex items-center space-x-3">
                        <select value={selectedAd?.id || ''} onChange={(e) => handleSelectAd(module.id, e.target.value)} disabled={isSaving} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                          <option value="">-- Select an ad --</option>
                          {availableAds.map(ad => (
                            <option key={ad.id} value={ad.id}>{ad.title} {ad.advertiser ? `(${ad.advertiser.company_name})` : ''}</option>
                          ))}
                        </select>
                        {isSaving && (
                          <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedAd && (
                    <div>
                      <div className="mb-4 text-sm text-gray-600 flex justify-between items-center">
                        <div><strong>Selected Ad:</strong> {selectedAd.title}</div>
                        <div className="text-xs text-gray-400">
                          Times used: {selectedAd.times_used || 0}
                          {selectedAd.advertiser && ` | ${selectedAd.advertiser.company_name}`}
                        </div>
                      </div>
                      <div className="max-w-3xl mx-auto">
                        <div className="border border-gray-300 rounded-lg bg-white shadow-lg overflow-hidden">
                          <div className="bg-blue-600 px-4 py-3">
                            <h2 className="text-white text-2xl font-bold m-0">{module.name}</h2>
                          </div>
                          {(module.block_order || ['title', 'image', 'body', 'button']).map((blockType, idx) => {
                            switch (blockType) {
                              case 'title':
                                return selectedAd.title ? (<div key={idx} className="px-4 pt-4 pb-2"><h3 className="text-xl font-bold text-left m-0">{selectedAd.title}</h3></div>) : null
                              case 'image':
                                return selectedAd.image_url ? (
                                  <div key={idx} className="px-4 text-center">
                                    {selectedAd.button_url ? (
                                      <a href={selectedAd.button_url} target="_blank" rel="noopener noreferrer"><img src={selectedAd.image_url} alt={selectedAd.title} className="inline-block max-w-full max-h-[500px] rounded cursor-pointer" /></a>
                                    ) : (
                                      <img src={selectedAd.image_url} alt={selectedAd.title} className="inline-block max-w-full max-h-[500px] rounded" />
                                    )}
                                  </div>
                                ) : null
                              case 'body':
                                return selectedAd.body ? (<div key={idx} className="px-4 pb-4 pt-2 text-base leading-relaxed [&_a]:underline [&_a]:font-bold [&_b]:font-bold [&_strong]:font-bold" dangerouslySetInnerHTML={{ __html: selectedAd.body }} />) : null
                              case 'cta':
                                return selectedAd.cta_text && selectedAd.button_url ? (<div key={idx} className="px-4 pb-4"><a href={selectedAd.button_url} target="_blank" rel="noopener noreferrer" className="text-black underline font-bold">{selectedAd.cta_text}</a></div>) : null
                              case 'button':
                                return selectedAd.button_url ? (<div key={idx} className="px-4 pb-4 text-center"><a href={selectedAd.button_url} target="_blank" rel="noopener noreferrer" className="inline-block px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors">{selectedAd.button_text || 'Learn More'}</a></div>) : null
                              default: return null
                            }
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {!selectedAd && !isManualMode && (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      No eligible ads available for this section.<br />Check advertiser cooldowns and ad date ranges.
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
