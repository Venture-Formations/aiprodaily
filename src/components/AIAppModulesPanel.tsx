'use client'

import { useState, useEffect } from 'react'

interface AIAppModule {
  id: string
  name: string
  display_order: number
  is_active: boolean
  selection_mode: string
  block_order: string[]
  apps_count: number
  max_per_category: number
  affiliate_cooldown_days: number
}

interface AIApplication {
  id: string
  app_name: string
  tagline?: string
  description?: string
  app_url?: string
  logo_url?: string
  category?: string
  is_affiliate: boolean
}

interface AIAppSelection {
  id: string
  ai_app_module_id: string
  app_ids: string[]
  selection_mode?: string
  selected_at?: string
  used_at?: string
  ai_app_module?: AIAppModule
}

interface AIAppModulesPanelProps {
  issueId: string
}

export default function AIAppModulesPanel({ issueId }: AIAppModulesPanelProps) {
  const [loading, setLoading] = useState(true)
  const [selections, setSelections] = useState<AIAppSelection[]>([])
  const [modules, setModules] = useState<AIAppModule[]>([])
  const [apps, setApps] = useState<Record<string, AIApplication>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetchAIAppModules()
  }, [issueId])

  const fetchAIAppModules = async () => {
    try {
      const response = await fetch(`/api/campaigns/${issueId}/ai-app-modules`)
      if (response.ok) {
        const data = await response.json()
        setSelections(data.selections || [])
        setModules(data.modules || [])

        // Build apps map
        const appsMap: Record<string, AIApplication> = {}
        for (const app of data.apps || []) {
          appsMap[app.id] = app
        }
        setApps(appsMap)
      }
    } catch (error) {
      console.error('Failed to fetch AI app modules:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpanded = (moduleId: string) => {
    setExpanded(prev => ({ ...prev, [moduleId]: !prev[moduleId] }))
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4 mt-8">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-20 bg-gray-100 rounded"></div>
        </div>
      </div>
    )
  }

  if (modules.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow mt-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Product Cards</h2>
          <p className="text-sm text-gray-500 mt-1">
            Dynamic product card sections configured in Settings
          </p>
        </div>
        <div className="p-6">
          <p className="text-gray-500 text-sm">
            No product cards modules configured. Create product cards modules in Settings &gt; Sections.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg mt-8">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Product Cards</h2>
        <p className="text-sm text-gray-500 mt-1">
          Dynamic product card sections configured in Settings
        </p>
      </div>

      <div className="divide-y divide-gray-200">
        {modules.map(module => {
          const selection = selections.find(s => s.ai_app_module_id === module.id)
          const appIds = selection?.app_ids || []
          const isExpanded = expanded[module.id]

          return (
            <div key={module.id} className="p-4">
              {/* Module Header */}
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleExpanded(module.id)}
              >
                <div className="flex items-center space-x-3">
                  <span className="font-medium text-gray-900">{module.name}</span>
                  <span className="text-xs text-gray-400">Display Order: {module.display_order}</span>
                  {selection?.selection_mode === 'legacy' ? (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      Legacy
                    </span>
                  ) : (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                      {module.selection_mode}
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  {appIds.length > 0 ? (
                    <span className="text-sm text-green-600">
                      {appIds.length} products selected
                    </span>
                  ) : (
                    <span className="text-sm text-yellow-600">
                      No products selected
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
                  {/* Email-style Preview */}
                  {appIds.length > 0 ? (
                    <div>
                      <div className="mb-2 text-sm text-gray-600">
                        <strong>Preview:</strong>
                      </div>
                      <div className="max-w-3xl mx-auto">
                        <div className="border border-gray-300 rounded-lg bg-white shadow-lg overflow-hidden">
                          {/* Header */}
                          <div className="bg-blue-600 px-4 py-3">
                            <h2 className="text-white text-2xl font-bold m-0">{module.name}</h2>
                          </div>

                          {/* Apps List */}
                          <div className="p-4 divide-y divide-gray-100">
                            {appIds.map((appId, index) => {
                              const app = apps[appId]
                              if (!app) return null

                              // Get emoji based on category
                              const getEmoji = (category?: string) => {
                                const emojiMap: Record<string, string> = {
                                  'Accounting': '📊',
                                  'Tax': '📋',
                                  'Bookkeeping': '📒',
                                  'Audit': '🔍',
                                  'Practice Management': '⚙️',
                                  'Client Communication': '💬',
                                  'Document Management': '📁',
                                  'Financial Analysis': '📈',
                                  'Payroll': '💰',
                                  'Invoicing': '🧾'
                                }
                                return emojiMap[category || ''] || '🤖'
                              }

                              return (
                                <div key={appId} className="py-3 first:pt-0 last:pb-0">
                                  <p className="text-base leading-relaxed m-0">
                                    <span className="font-bold">{index + 1}.</span>{' '}
                                    {getEmoji(app.category)}{' '}
                                    {app.app_url ? (
                                      <a
                                        href={app.app_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-red-600 hover:text-red-700 underline font-bold"
                                      >
                                        {app.app_name}
                                      </a>
                                    ) : (
                                      <span className="font-bold text-gray-900">{app.app_name}</span>
                                    )}{' '}
                                    <span className="text-gray-700">
                                      {app.description || app.tagline || ''}
                                    </span>
                                    {app.is_affiliate && (
                                      <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                                        Affiliate
                                      </span>
                                    )}
                                  </p>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      No products have been selected for this module yet.
                      <br />
                      Products will be auto-selected when the workflow runs.
                    </div>
                  )}

                  {/* Selection Info */}
                  {selection?.selected_at && (
                    <div className="text-xs text-gray-400 text-right">
                      Selected: {new Date(selection.selected_at).toLocaleString()}
                      {selection.used_at && (
                        <span className="ml-2">
                          | Sent: {new Date(selection.used_at).toLocaleString()}
                        </span>
                      )}
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
