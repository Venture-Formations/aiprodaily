'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { Poll, PollResponse } from '@/types/database'

interface PollWithAnalytics extends Poll {
  analytics?: {
    total_responses: number
    unique_respondents: number
    option_counts: Record<string, number>
  }
}

export default function PollsPage() {
  const [polls, setPolls] = useState<PollWithAnalytics[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPoll, setSelectedPoll] = useState<PollWithAnalytics | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formQuestion, setFormQuestion] = useState('')
  const [formOptions, setFormOptions] = useState<string[]>(['', '', ''])

  useEffect(() => {
    fetchPolls()
  }, [])

  const fetchPolls = async () => {
    try {
      const response = await fetch('/api/polls')
      const data = await response.json()

      // Fetch analytics for each poll
      const pollsWithAnalytics = await Promise.all(
        (data.polls || []).map(async (poll: Poll) => {
          try {
            const analyticsResponse = await fetch(`/api/polls/${poll.id}/responses`)
            const analyticsData = await analyticsResponse.json()
            return { ...poll, analytics: analyticsData.analytics }
          } catch (error) {
            console.error(`Error fetching analytics for poll ${poll.id}:`, error)
            return poll
          }
        })
      )

      setPolls(pollsWithAnalytics)
    } catch (error) {
      console.error('Error fetching polls:', error)
      alert('Failed to load polls')
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePoll = async () => {
    try {
      const response = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle,
          question: formQuestion,
          options: formOptions.filter(opt => opt.trim() !== ''),
          is_active: false
        })
      })

      if (!response.ok) throw new Error('Failed to create poll')

      alert('Poll created successfully!')
      setShowCreateForm(false)
      resetForm()
      fetchPolls()
    } catch (error) {
      console.error('Error creating poll:', error)
      alert('Failed to create poll')
    }
  }

  const handleUpdatePoll = async () => {
    if (!selectedPoll) return

    try {
      const response = await fetch(`/api/polls/${selectedPoll.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle,
          question: formQuestion,
          options: formOptions.filter(opt => opt.trim() !== '')
        })
      })

      if (!response.ok) throw new Error('Failed to update poll')

      alert('Poll updated successfully!')
      setShowEditForm(false)
      setSelectedPoll(null)
      resetForm()
      fetchPolls()
    } catch (error) {
      console.error('Error updating poll:', error)
      alert('Failed to update poll')
    }
  }

  const handleDeletePoll = async (pollId: string) => {
    if (!confirm('Are you sure you want to delete this poll? All responses will be lost.')) {
      return
    }

    try {
      const response = await fetch(`/api/polls/${pollId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('Failed to delete poll')

      alert('Poll deleted successfully!')
      fetchPolls()
    } catch (error) {
      console.error('Error deleting poll:', error)
      alert('Failed to delete poll')
    }
  }

  const handleToggleActive = async (poll: Poll) => {
    try {
      const response = await fetch(`/api/polls/${poll.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_active: !poll.is_active
        })
      })

      if (!response.ok) throw new Error('Failed to update poll status')

      fetchPolls()
    } catch (error) {
      console.error('Error toggling poll status:', error)
      alert('Failed to update poll status')
    }
  }

  const resetForm = () => {
    setFormTitle('')
    setFormQuestion('')
    setFormOptions(['', '', ''])
  }

  const openEditForm = (poll: PollWithAnalytics) => {
    setSelectedPoll(poll)
    setFormTitle(poll.title)
    setFormQuestion(poll.question)
    setFormOptions([...poll.options])
    setShowEditForm(true)
  }

  const addOption = () => {
    setFormOptions([...formOptions, ''])
  }

  const removeOption = (index: number) => {
    if (formOptions.length <= 2) {
      alert('A poll must have at least 2 options')
      return
    }
    setFormOptions(formOptions.filter((_, i) => i !== index))
  }

  const updateOption = (index: number, value: string) => {
    const newOptions = [...formOptions]
    newOptions[index] = value
    setFormOptions(newOptions)
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="flex justify-between items-center mb-6">
          <div>
            <nav className="flex" aria-label="Breadcrumb">
              <ol className="flex items-center space-x-2">
                <li>
                  <Link href="/dashboard/databases" className="text-gray-500 hover:text-gray-700">
                    Databases
                  </Link>
                </li>
                <li>
                  <span className="text-gray-500">/</span>
                </li>
                <li>
                  <span className="text-gray-900 font-medium">Polls</span>
                </li>
              </ol>
            </nav>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">
              Poll Management
            </h1>
            <p className="text-gray-600">
              {polls.length} total polls • {polls.filter(p => p.is_active).length} active
            </p>
          </div>
          <button
            onClick={() => {
              resetForm()
              setShowCreateForm(true)
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Create New Poll
          </button>
        </div>

      {/* Create/Edit Form Modal */}
      {(showCreateForm || showEditForm) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              {showCreateForm ? 'Create New Poll' : 'Edit Poll'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="e.g., Help Us Improve"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Question</label>
                <input
                  type="text"
                  value={formQuestion}
                  onChange={(e) => setFormQuestion(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                  placeholder="e.g., How satisfied are you with the St. Cloud Scoop newsletter?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Options</label>
                {formOptions.map((option, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      className="flex-1 border rounded px-3 py-2"
                      placeholder={`Option ${index + 1}`}
                    />
                    {formOptions.length > 2 && (
                      <button
                        onClick={() => removeOption(index)}
                        className="bg-red-500 text-white px-3 py-2 rounded hover:bg-red-600"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={addOption}
                  className="bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300 text-sm"
                >
                  + Add Option
                </button>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={showCreateForm ? handleCreatePoll : handleUpdatePoll}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                {showCreateForm ? 'Create Poll' : 'Update Poll'}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false)
                  setShowEditForm(false)
                  setSelectedPoll(null)
                  resetForm()
                }}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Polls List */}
      <div className="space-y-4">
        {polls.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            No polls created yet. Create your first poll to get started.
          </div>
        ) : (
          polls.map(poll => (
            <div
              key={poll.id}
              className={`border rounded-lg p-4 ${
                poll.is_active ? 'border-green-500 bg-green-50' : 'border-gray-300'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-semibold">{poll.title}</h3>
                    {poll.is_active && (
                      <span className="bg-green-600 text-white text-xs px-2 py-1 rounded">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 mt-1">{poll.question}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleActive(poll)}
                    className={`px-3 py-1 rounded text-sm ${
                      poll.is_active
                        ? 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {poll.is_active ? 'Deactivate' : 'Set Active'}
                  </button>
                  <button
                    onClick={() => openEditForm(poll)}
                    className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeletePoll(poll.id)}
                    className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <h4 className="font-medium text-sm mb-2">Options:</h4>
                <div className="grid grid-cols-2 gap-2">
                  {poll.options.map((option, index) => (
                    <div key={index} className="flex items-center justify-between bg-white px-3 py-2 rounded border">
                      <span>{option}</span>
                      {poll.analytics && (
                        <span className="text-sm text-gray-600">
                          {poll.analytics.option_counts[option] || 0} votes
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {poll.analytics && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="font-medium text-sm mb-2">Analytics:</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white px-3 py-2 rounded border">
                      <div className="text-2xl font-bold">{poll.analytics.total_responses}</div>
                      <div className="text-xs text-gray-600">Total Responses</div>
                    </div>
                    <div className="bg-white px-3 py-2 rounded border">
                      <div className="text-2xl font-bold">{poll.analytics.unique_respondents}</div>
                      <div className="text-xs text-gray-600">Unique Respondents</div>
                    </div>
                    <div className="bg-white px-3 py-2 rounded border">
                      <div className="text-2xl font-bold">
                        {poll.analytics.total_responses > 0
                          ? ((poll.analytics.unique_respondents / poll.analytics.total_responses) * 100).toFixed(1)
                          : 0}%
                      </div>
                      <div className="text-xs text-gray-600">Response Rate</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-2 text-xs text-gray-500">
                Created: {new Date(poll.created_at).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
      </div>
    </Layout>
  )
}
