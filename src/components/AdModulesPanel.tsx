'use client'

import { useState, useEffect } from 'react'

interface AdModulesPanelProps {
  issueId: string
}

interface AdModule {
  id: string
  name: string
  display_order: number
  block_order: string[]
  selection_mode: string
  is_active: boolean
}

interface ModuleAd {
  id: string
  title: string
  body?: string
  image_url?: string
  button_text?: string
  button_url?: string
  times_used?: number
  display_order?: number
  advertiser?: {
    id: string
    company_name: string
    logo_url?: string
  }
}

interface AdSelection {
  id: string
  selection_mode: string
  selected_at?: string
  used_at?: string
  ad_module?: AdModule
  advertisement?: ModuleAd  // Changed from selected_ad to match unified schema
}

// Process ad body to make last sentence a link (matches email format)
function processAdBody(body: string, buttonUrl?: string): string {
  if (!buttonUrl || !body) return body

  const plainText = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  const sentenceEndPattern = /[.!?](?=\s+[A-Z]|$)/g
  const matches = Array.from(plainText.matchAll(sentenceEndPattern))

  if (matches.length > 0) {
    const lastMatch = matches[matches.length - 1] as RegExpMatchArray
    const lastPeriodIndex = lastMatch.index!

    let startIndex = 0
    if (matches.length > 1) {
      const secondLastMatch = matches[matches.length - 2] as RegExpMatchArray
      startIndex = secondLastMatch.index! + 1
    }

    const lastSentence = plainText.substring(startIndex, lastPeriodIndex + 1).trim()
    const beforeLastSentence = plainText.substring(0, startIndex).trim()

    const linkedLastSentence = `<a href="${buttonUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline;">${lastSentence}</a>`

    return beforeLastSentence
      ? `<p>${beforeLastSentence}</p><p>${linkedLastSentence}</p>`
      : `<p>${linkedLastSentence}</p>`
  }

  return `<p><a href="${buttonUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline;">${plainText}</a></p>`
}

export default function AdModulesPanel({ issueId }: AdModulesPanelProps) {
  const [loading, setLoading] = useState(true)
  const [selections, setSelections] = useState<AdSelection[]>([])
  const [modules, setModules] = useState<AdModule[]>([])
  const [moduleAds, setModuleAds] = useState<Record<string, ModuleAd[]>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    fetchAdModules()
  }, [issueId])

  const fetchAdModules = async () => {
    try {
      const response = await fetch(`/api/campaigns/${issueId}/ad-modules`)
      if (response.ok) {
        const data = await response.json()
        setSelections(data.selections || [])
        setModules(data.modules || [])
        setModuleAds(data.moduleAds || {})
      }
    } catch (error) {
      console.error('Failed to fetch ad modules:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAd = async (moduleId: string, adId: string) => {
    setSaving(moduleId)
    try {
      const response = await fetch(`/api/campaigns/${issueId}/ad-modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, adId })
      })

      if (response.ok) {
        await fetchAdModules() // Refresh data
      } else {
        const error = await response.json()
        alert(`Failed to select ad: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to select ad:', error)
      alert('Failed to select ad')
    } finally {
      setSaving(null)
    }
  }

  const toggleExpanded = (moduleId: string) => {
    setExpanded(prev => ({ ...prev, [moduleId]: !prev[moduleId] }))
  }

  // Get selection for a module
  const getSelectionForModule = (moduleId: string) => {
    return selections.find(s => s.ad_module?.id === moduleId)
  }

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6 mt-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  if (modules.length === 0) {
    return null // No ad modules configured
  }

  return (
    <div className="bg-white shadow rounded-lg mt-6">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Ad Sections</h2>
        <p className="text-sm text-gray-500 mt-1">
          Dynamic ad sections configured in Settings
        </p>
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
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleExpanded(module.id)}
              >
                <div className="flex items-center space-x-3">
                  <span className="font-medium text-gray-900">{module.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    module.selection_mode === 'manual'
                      ? 'bg-yellow-100 text-yellow-800'
                      : module.selection_mode === 'sequential'
                      ? 'bg-blue-100 text-blue-800'
                      : module.selection_mode === 'random'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {module.selection_mode}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  {selectedAd ? (
                    <span className="text-sm text-green-600">
                      {selectedAd.title}
                    </span>
                  ) : isManualMode ? (
                    <span className="text-sm text-yellow-600">
                      Needs selection
                    </span>
                  ) : (
                    <span className="text-sm text-gray-500">
                      No ad available
                    </span>
                  )}
                  <svg
                    className={`w-5 h-5 text-gray-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="mt-4 space-y-4">
                  {/* Manual Selection Dropdown */}
                  {isManualMode && availableAds.length > 0 && (
                    <div className="bg-yellow-50 p-3 rounded-lg">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Ad for this Section
                      </label>
                      <div className="flex items-center space-x-3">
                        <select
                          value={selectedAd?.id || ''}
                          onChange={(e) => handleSelectAd(module.id, e.target.value)}
                          disabled={isSaving}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">-- Select an ad --</option>
                          {availableAds.map(ad => (
                            <option key={ad.id} value={ad.id}>
                              {ad.title} {ad.advertiser ? `(${ad.advertiser.company_name})` : ''}
                            </option>
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

                  {/* Selected Ad Preview - Styled to match email appearance */}
                  {selectedAd && (
                    <div>
                      {/* Meta info bar */}
                      <div className="mb-4 text-sm text-gray-600 flex justify-between items-center">
                        <div>
                          <strong>Selected Ad:</strong> {selectedAd.title}
                        </div>
                        <div className="text-xs text-gray-400">
                          Times used: {selectedAd.times_used || 0}
                          {selectedAd.advertiser && ` | ${selectedAd.advertiser.company_name}`}
                        </div>
                      </div>

                      {/* Email-style card */}
                      <div className="max-w-3xl mx-auto">
                        <div className="border border-gray-300 rounded-lg bg-white shadow-lg overflow-hidden">
                          {/* Header - part of the card with no gap */}
                          <div className="bg-blue-600 px-4 py-3">
                            <h2 className="text-white text-2xl font-bold m-0">{module.name}</h2>
                          </div>

                          {/* Title - inside card, left-justified */}
                          <div className="px-4 pt-4 pb-2">
                            <h3 className="text-xl font-bold text-left m-0">{selectedAd.title}</h3>
                          </div>

                          {/* Image - clickable */}
                          {selectedAd.image_url && (
                            <div className="px-4 text-center">
                              {selectedAd.button_url ? (
                                <a href={selectedAd.button_url} target="_blank" rel="noopener noreferrer">
                                  <img
                                    src={selectedAd.image_url}
                                    alt={selectedAd.title}
                                    className="inline-block max-w-full max-h-[500px] rounded cursor-pointer"
                                  />
                                </a>
                              ) : (
                                <img
                                  src={selectedAd.image_url}
                                  alt={selectedAd.title}
                                  className="inline-block max-w-full max-h-[500px] rounded"
                                />
                              )}
                            </div>
                          )}

                          {/* Body - with last line as link */}
                          {selectedAd.body && (
                            <div
                              className="px-4 pb-4 text-base leading-relaxed [&_a]:text-blue-600 [&_a]:underline [&_b]:font-bold [&_strong]:font-bold"
                              dangerouslySetInnerHTML={{ __html: processAdBody(selectedAd.body, selectedAd.button_url) }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* No ad message */}
                  {!selectedAd && !isManualMode && (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      No eligible ads available for this section.
                      <br />
                      Check advertiser cooldowns and ad date ranges.
                    </div>
                  )}

                  {/* Module info */}
                  <div className="text-xs text-gray-400 flex items-center justify-between">
                    <span>Display order: {module.display_order}</span>
                    <span>Blocks: {(module.block_order || []).join(', ')}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
