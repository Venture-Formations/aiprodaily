'use client'

import { useState, useEffect } from 'react'
import type { PromptModule, PromptIdea, IssuePromptModule, PromptSelectionMode } from '@/types/database'

interface PromptModulesPanelProps {
  issueId: string
}

interface PromptSelection {
  id: string
  prompt_module_id: string
  prompt_id: string | null
  selection_mode?: PromptSelectionMode
  selected_at?: string
  used_at?: string
  prompt_module?: PromptModule
  prompt?: PromptIdea
}

interface PublicationStyles {
  primaryColor: string
  tertiaryColor: string
  headingFont: string
  bodyFont: string
}

const SELECTION_MODE_LABELS: Record<PromptSelectionMode, string> = {
  sequential: 'Sequential',
  random: 'Random',
  priority: 'Priority',
  manual: 'Manual'
}

export default function PromptModulesPanel({ issueId }: PromptModulesPanelProps) {
  const [loading, setLoading] = useState(true)
  const [selections, setSelections] = useState<PromptSelection[]>([])
  const [modules, setModules] = useState<PromptModule[]>([])
  const [availablePrompts, setAvailablePrompts] = useState<PromptIdea[]>([])
  const [styles, setStyles] = useState<PublicationStyles>({
    primaryColor: '#667eea',
    tertiaryColor: '#ffffff',
    headingFont: 'Georgia, serif',
    bodyFont: 'Arial, sans-serif'
  })
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    fetchPromptModules()
  }, [issueId])

  const fetchPromptModules = async () => {
    try {
      const response = await fetch(`/api/campaigns/${issueId}/prompt-modules`)
      if (response.ok) {
        const data = await response.json()
        setSelections(data.selections || [])
        setModules(data.modules || [])
        setAvailablePrompts(data.availablePrompts || [])
        if (data.styles) {
          setStyles(data.styles)
        }
      }
    } catch (error) {
      console.error('Failed to fetch prompt modules:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectPrompt = async (moduleId: string, promptId: string | null) => {
    setSaving(moduleId)
    try {
      const response = await fetch(`/api/campaigns/${issueId}/prompt-modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, promptId })
      })

      if (response.ok) {
        await fetchPromptModules() // Refresh data
      } else {
        const error = await response.json()
        alert(`Failed to select prompt: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to select prompt:', error)
      alert('Failed to select prompt')
    } finally {
      setSaving(null)
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
          <h2 className="text-lg font-medium text-gray-900">Prompt Sections</h2>
          <p className="text-sm text-gray-500 mt-1">
            Dynamic prompt sections configured in Settings
          </p>
        </div>
        <div className="p-6">
          <p className="text-gray-500 text-sm">
            No prompt modules configured. Create prompt modules in Settings &gt; Sections.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg mt-8">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Prompt Sections</h2>
        <p className="text-sm text-gray-500 mt-1">
          Dynamic prompt sections configured in Settings
        </p>
      </div>

      <div className="divide-y divide-gray-200">
        {modules.map(module => {
          const selection = selections.find(s => s.prompt_module_id === module.id)
          const selectedPrompt = selection?.prompt
          const isExpanded = expanded[module.id]
          const isSaving = saving === module.id
          const selectionMode = module.selection_mode || 'random'

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
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                    {SELECTION_MODE_LABELS[selectionMode]}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  {selectedPrompt ? (
                    <span className="text-sm text-green-600">
                      {selectedPrompt.title}
                    </span>
                  ) : (
                    <span className="text-sm text-yellow-600">
                      No prompt selected
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
                  {/* Prompt Selection Dropdown */}
                  <div className="bg-yellow-50 p-3 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {selectionMode === 'manual'
                        ? 'Select Prompt for this Section'
                        : 'Override Auto-Selected Prompt (optional)'}
                    </label>
                    <div className="flex items-center space-x-3">
                      <select
                        value={selection?.prompt_id || ''}
                        onChange={(e) => {
                          handleSelectPrompt(module.id, e.target.value || null)
                        }}
                        disabled={isSaving}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- No Prompt --</option>
                        {availablePrompts.map(prompt => (
                          <option key={prompt.id} value={prompt.id}>
                            {prompt.title}
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
                    {selectionMode !== 'manual' && (
                      <p className="text-xs text-gray-500 mt-2">
                        This module uses {SELECTION_MODE_LABELS[selectionMode].toLowerCase()} selection.
                        You can manually override the auto-selected prompt here.
                      </p>
                    )}
                  </div>

                  {/* Current Selection Preview - Terminal Styling */}
                  {selectedPrompt && (
                    <div>
                      <div className="mb-2 text-sm text-gray-600">
                        <strong>Preview:</strong>
                      </div>
                      <div
                        className="rounded-lg shadow-lg overflow-hidden mx-auto"
                        style={{
                          border: '1px solid #ddd',
                          backgroundColor: '#fff',
                          fontFamily: styles.bodyFont,
                          maxWidth: '650px'
                        }}
                      >
                        {/* Header */}
                        <div className="bg-blue-600 px-4 py-3">
                          <h2 className="text-white text-2xl font-bold m-0">
                            {module.name}
                          </h2>
                        </div>

                        {/* Content */}
                        <div className="p-2">
                          {/* Render blocks in configured order */}
                          {(module.block_order || ['title', 'body']).map((blockType: string) => {
                            if (blockType === 'title' && selectedPrompt.title) {
                              return (
                                <div
                                  key="title"
                                  className="text-center font-bold text-xl py-2 px-2"
                                >
                                  {selectedPrompt.title}
                                </div>
                              )
                            }
                            if (blockType === 'body' && selectedPrompt.prompt_text) {
                              return (
                                <div key="body" className="flex justify-center px-2 pb-2">
                                  <div
                                    className="w-full max-w-[550px] p-4 rounded-md"
                                    style={{
                                      backgroundColor: '#000000',
                                      color: '#FFFFFF',
                                      fontFamily: 'Courier New, Courier, monospace',
                                      fontSize: '14px',
                                      lineHeight: '22px',
                                      border: '2px solid #333',
                                      whiteSpace: 'pre-wrap'
                                    }}
                                  >
                                    {selectedPrompt.prompt_text}
                                  </div>
                                </div>
                              )
                            }
                            return null
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* No prompt message */}
                  {!selectedPrompt && (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      No prompt selected for this section.
                      {selectionMode !== 'manual' && (
                        <> The workflow will auto-select a prompt when the issue is processed.</>
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
