'use client'

import { useState, useEffect } from 'react'

interface SLRecModule {
  id: string
  name: string
  display_order: number
  is_active: boolean
  selection_mode: string
  block_order: string[]
  recs_count: number
}

interface EligibleRec {
  id: string
  ref_code: string
  publication_name: string
  publication_logo: string | null
  description: string | null
  cpa: number | null
  calculated_score: number
}

interface SLRecSelection {
  id: string
  sparkloop_rec_module_id: string
  ref_codes: string[]
  selection_mode?: string
  selected_at?: string
  used_at?: string
  sparkloop_rec_module?: SLRecModule | null
  recommendations: EligibleRec[]
}

interface SparkLoopRecsModulesPanelProps {
  issueId: string
}

export default function SparkLoopRecsModulesPanel({ issueId }: SparkLoopRecsModulesPanelProps) {
  const [loading, setLoading] = useState(true)
  const [selections, setSelections] = useState<SLRecSelection[]>([])
  const [modules, setModules] = useState<SLRecModule[]>([])
  const [eligibleRecs, setEligibleRecs] = useState<EligibleRec[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [editingModule, setEditingModule] = useState<string | null>(null)
  const [selectedRefCodes, setSelectedRefCodes] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchData()
  }, [issueId])

  const fetchData = async () => {
    try {
      const response = await fetch(`/api/campaigns/${issueId}/sparkloop-rec-modules`)
      if (response.ok) {
        const data = await response.json()
        setSelections(data.selections || [])
        setModules(data.modules || [])
        setEligibleRecs(data.eligibleRecs || [])
      }
    } catch (error) {
      console.error('Failed to fetch sparkloop rec modules:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpanded = (moduleId: string) => {
    setExpanded(prev => ({ ...prev, [moduleId]: !prev[moduleId] }))
  }

  const startEditing = (moduleId: string, currentRefCodes: string[]) => {
    setEditingModule(moduleId)
    setSelectedRefCodes([...currentRefCodes])
  }

  const toggleRefCode = (refCode: string) => {
    setSelectedRefCodes(prev =>
      prev.includes(refCode)
        ? prev.filter(rc => rc !== refCode)
        : [...prev, refCode]
    )
  }

  const saveManualSelection = async (moduleId: string) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/campaigns/${issueId}/sparkloop-rec-modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, refCodes: selectedRefCodes }),
      })
      if (response.ok) {
        setEditingModule(null)
        await fetchData()
      }
    } catch (error) {
      console.error('Failed to save selections:', error)
    } finally {
      setSaving(false)
    }
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
    return null
  }

  return (
    <div className="bg-white shadow rounded-lg mt-8">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">SparkLoop Recommendations</h2>
        <p className="text-sm text-gray-500 mt-1">
          Newsletter recommendations shown in the email body
        </p>
      </div>

      <div className="divide-y divide-gray-200">
        {modules.map(module => {
          const selection = selections.find(s => s.sparkloop_rec_module_id === module.id)
          const recs = selection?.recommendations || []
          const isExpanded = expanded[module.id]
          const isEditing = editingModule === module.id

          return (
            <div key={module.id} className="p-4">
              {/* Module Header */}
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleExpanded(module.id)}
              >
                <div className="flex items-center space-x-3">
                  <span className="font-medium text-gray-900">{module.name}</span>
                  <span className="text-xs text-gray-400">Order: {module.display_order}</span>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                    {module.selection_mode}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  {recs.length > 0 ? (
                    <span className="text-sm text-green-600">
                      {recs.length} recs selected
                    </span>
                  ) : (
                    <span className="text-sm text-yellow-600">
                      No recs selected
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
                  {/* Selected Recs Preview */}
                  {recs.length > 0 && !isEditing ? (
                    <div className="space-y-2">
                      {recs.map(rec => (
                        <div key={rec.ref_code} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                          {rec.publication_logo ? (
                            <img src={rec.publication_logo} alt="" className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-lg">
                              {rec.publication_name.charAt(0)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-sm truncate">{rec.publication_name}</p>
                            <p className="text-xs text-gray-500 truncate">{rec.description || 'No description'}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-gray-400">CPA: ${((rec.cpa || 0) / 100).toFixed(2)}</span>
                            {rec.calculated_score > 0 && (
                              <p className="text-xs text-green-600">Score: {rec.calculated_score.toFixed(4)}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : !isEditing ? (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      No recommendations selected yet.
                      <br />
                      Recommendations will be auto-selected when the workflow runs.
                    </div>
                  ) : null}

                  {/* Manual Override Editor */}
                  {isEditing && (
                    <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                      <p className="text-sm font-medium text-blue-800 mb-3">
                        Select recommendations ({selectedRefCodes.length} selected):
                      </p>
                      <div className="max-h-60 overflow-y-auto space-y-1">
                        {eligibleRecs.map(rec => (
                          <label
                            key={rec.ref_code}
                            className="flex items-center space-x-2 p-2 hover:bg-blue-100 rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={selectedRefCodes.includes(rec.ref_code)}
                              onChange={() => toggleRefCode(rec.ref_code)}
                              className="rounded text-blue-600"
                            />
                            <span className="text-sm text-gray-900">{rec.publication_name}</span>
                            <span className="text-xs text-gray-400 ml-auto">
                              ${((rec.cpa || 0) / 100).toFixed(2)}
                            </span>
                          </label>
                        ))}
                      </div>
                      <div className="flex justify-end space-x-2 mt-3">
                        <button
                          onClick={() => setEditingModule(null)}
                          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveManualSelection(module.id)}
                          disabled={saving}
                          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  {!isEditing && (
                    <div className="flex justify-between items-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          startEditing(module.id, selection?.ref_codes || [])
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Manual Override
                      </button>
                      {selection?.selected_at && (
                        <span className="text-xs text-gray-400">
                          Selected: {new Date(selection.selected_at).toLocaleString()}
                          {selection.used_at && (
                            <span className="ml-2">
                              | Sent: {new Date(selection.used_at).toLocaleString()}
                            </span>
                          )}
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
