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

export default function PollModulesPanel({ issueId }: PollModulesPanelProps) {
  const [loading, setLoading] = useState(true)
  const [selections, setSelections] = useState<PollSelection[]>([])
  const [modules, setModules] = useState<PollModule[]>([])
  const [availablePolls, setAvailablePolls] = useState<Poll[]>([])
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
      }
    } catch (error) {
      console.error('Failed to fetch poll modules:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectPoll = async (moduleId: string, pollId: string) => {
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
    <div className="bg-white rounded-lg shadow">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          Poll Modules
        </h3>
      </div>

      <div className="divide-y divide-gray-100">
        {modules.map(module => {
          const selection = selections.find(s => s.poll_module_id === module.id)
          const selectedPoll = selection?.poll
          const isExpanded = expanded[module.id]
          const isSaving = saving === module.id

          return (
            <div key={module.id} className="p-4">
              {/* Module Header */}
              <button
                onClick={() => toggleExpanded(module.id)}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${selectedPoll ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <div>
                    <h4 className="font-medium text-gray-900">{module.name}</h4>
                    <p className="text-sm text-gray-500">
                      {selectedPoll ? selectedPoll.title : 'No poll selected'}
                    </p>
                  </div>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="mt-4 pl-5">
                  {/* Current Selection Preview */}
                  {selectedPoll && (
                    <div className="mb-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="font-medium text-purple-900">{selectedPoll.title}</div>
                      <div className="text-sm text-purple-700 mt-1">{selectedPoll.question}</div>
                      {selectedPoll.image_url && (
                        <img
                          src={selectedPoll.image_url}
                          alt={selectedPoll.title}
                          className="mt-2 max-w-xs rounded"
                        />
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {selectedPoll.options?.map((option, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded"
                          >
                            {option}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Poll Selection */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Select Poll:
                    </label>
                    <select
                      value={selection?.poll_id || ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleSelectPoll(module.id, e.target.value)
                        }
                      }}
                      disabled={isSaving}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50"
                    >
                      <option value="">-- Select a poll --</option>
                      {availablePolls.map(poll => (
                        <option key={poll.id} value={poll.id}>
                          {poll.title} - {poll.question?.substring(0, 50)}...
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Block Order Preview */}
                  <div className="mt-4 text-xs text-gray-500">
                    Block order: {module.block_order?.join(' → ') || 'title → question → image → options'}
                  </div>

                  {isSaving && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-purple-600">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Saving...
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
