'use client'

import { useState, useEffect } from 'react'
import type { PollModule, Poll, IssuePollModule } from '@/types/database'

interface PollModulesPanelProps {
  issueId: string
}

interface PollSelection {
  id: string
  poll_module_id: string
  poll_id: string | null
  selected_at?: string
  used_at?: string
  poll_module?: PollModule
  poll?: Poll
}

interface PublicationStyles {
  primaryColor: string
  tertiaryColor: string
  bodyFont: string
}

export default function PollModulesPanel({ issueId }: PollModulesPanelProps) {
  const [loading, setLoading] = useState(true)
  const [selections, setSelections] = useState<PollSelection[]>([])
  const [modules, setModules] = useState<PollModule[]>([])
  const [availablePolls, setAvailablePolls] = useState<Poll[]>([])
  const [styles, setStyles] = useState<PublicationStyles>({
    primaryColor: '#667eea',
    tertiaryColor: '#ffffff',
    bodyFont: 'Arial, sans-serif'
  })
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    fetchPollModules()
  }, [issueId])

  const fetchPollModules = async () => {
    try {
      const response = await fetch(`/api/campaigns/${issueId}/poll-modules`)
      if (response.ok) {
        const data = await response.json()
        setSelections(data.selections || [])
        setModules(data.modules || [])
        setAvailablePolls(data.availablePolls || [])
        if (data.styles) {
          setStyles(data.styles)
        }
      }
    } catch (error) {
      console.error('Failed to fetch poll modules:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectPoll = async (moduleId: string, pollId: string | null) => {
    setSaving(moduleId)
    try {
      const response = await fetch(`/api/campaigns/${issueId}/poll-modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, pollId })
      })

      if (response.ok) {
        await fetchPollModules() // Refresh data
      } else {
        const error = await response.json()
        alert(`Failed to select poll: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to select poll:', error)
      alert('Failed to select poll')
    } finally {
      setSaving(null)
    }
  }

  const toggleExpanded = (moduleId: string) => {
    setExpanded(prev => ({ ...prev, [moduleId]: !prev[moduleId] }))
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-20 bg-gray-100 rounded"></div>
        </div>
      </div>
    )
  }

  if (modules.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Poll Modules</h3>
        <p className="text-gray-500 text-sm">
          No poll modules configured. Create poll modules in Settings &gt; Sections.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg mt-8">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Poll Sections</h2>
        <p className="text-sm text-gray-500 mt-1">
          Dynamic poll sections configured in Settings
        </p>
      </div>

      <div className="divide-y divide-gray-200">
        {modules.map(module => {
          const selection = selections.find(s => s.poll_module_id === module.id)
          const selectedPoll = selection?.poll
          const isExpanded = expanded[module.id]
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
                  <span className="text-xs text-gray-400">Display Order: {module.display_order}</span>
                </div>
                <div className="flex items-center space-x-3">
                  {selectedPoll ? (
                    <span className="text-sm text-green-600">
                      {selectedPoll.title}
                    </span>
                  ) : (
                    <span className="text-sm text-yellow-600">
                      No poll selected
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
                  {/* Poll Selection Dropdown */}
                  <div className="bg-yellow-50 p-3 rounded-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Poll for this Section
                    </label>
                    <div className="flex items-center space-x-3">
                      <select
                        value={selection?.poll_id || ''}
                        onChange={(e) => {
                          handleSelectPoll(module.id, e.target.value || null)
                        }}
                        disabled={isSaving}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- No Poll --</option>
                        {availablePolls.map(poll => (
                          <option key={poll.id} value={poll.id}>
                            {poll.title} - {poll.question?.substring(0, 50)}...
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

                  {/* Current Selection Preview - Matches Email Design */}
                  {selectedPoll && (
                    <div>
                      <div className="mb-2 text-sm text-gray-600">
                        <strong>Preview:</strong>
                      </div>
                      <div
                        className="rounded-lg shadow-lg overflow-hidden mx-auto"
                        style={{
                          backgroundColor: styles.primaryColor,
                          border: `2px solid ${styles.primaryColor}`,
                          fontFamily: styles.bodyFont,
                          maxWidth: '650px'
                        }}
                      >
                        <div className="p-4 text-center text-white">
                          {/* Render blocks in configured order */}
                          {(module.block_order || ['title', 'question', 'image', 'options']).map((blockType: string) => {
                            if (blockType === 'title' && selectedPoll.title) {
                              return (
                                <p key="title" className="font-bold text-xl mb-1.5">
                                  {selectedPoll.title}
                                </p>
                              )
                            }
                            if (blockType === 'question' && selectedPoll.question) {
                              return (
                                <p key="question" className="text-base mb-3.5">
                                  {selectedPoll.question}
                                </p>
                              )
                            }
                            if (blockType === 'image' && selectedPoll.image_url) {
                              return (
                                <img
                                  key="image"
                                  src={selectedPoll.image_url}
                                  alt={selectedPoll.title || 'Poll image'}
                                  className="max-w-full h-auto rounded-lg mb-3.5 mx-auto"
                                />
                              )
                            }
                            if (blockType === 'options' && selectedPoll.options?.length > 0) {
                              return (
                                <div key="options" className="max-w-[350px] mx-auto space-y-2">
                                  {selectedPoll.options.map((option, idx) => (
                                    <div
                                      key={idx}
                                      className="block font-bold text-base py-3 px-4 rounded-lg text-center"
                                      style={{
                                        backgroundColor: styles.tertiaryColor,
                                        color: styles.primaryColor
                                      }}
                                    >
                                      {option}
                                    </div>
                                  ))}
                                </div>
                              )
                            }
                            return null
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* No poll message */}
                  {!selectedPoll && (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      No poll selected for this section.
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
