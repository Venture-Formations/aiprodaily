'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { PromptIdea } from '@/types/database'

export default function PromptIdeasManagementPage() {
  const params = useParams()
  const slug = params.slug as string

  const [prompts, setPrompts] = useState<PromptIdea[]>([])
  const [newsletter, setNewsletter] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingPrompt, setEditingPrompt] = useState<PromptIdea | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    prompt_text: '',
    category: '',
    use_case: '',
    suggested_model: '',
    difficulty_level: 'beginner',
    estimated_time: '',
    is_featured: false
  })

  useEffect(() => {
    loadData()
  }, [slug])

  async function loadData() {
    try {
      // Load newsletter
      const nlRes = await fetch(`/api/newsletters/by-subdomain?subdomain=${slug}`)
      const nlData = await nlRes.json()
      if (nlData.success) {
        setNewsletter(nlData.newsletter)

        // Load prompts
        const promptsRes = await fetch(`/api/prompt-ideas?newsletter_id=${nlData.newsletter.id}`)
        const promptsData = await promptsRes.json()
        setPrompts(promptsData.prompts || [])
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!newsletter) return

    try {
      const url = editingPrompt ? `/api/prompt-ideas/${editingPrompt.id}` : '/api/prompt-ideas'
      const method = editingPrompt ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          newsletter_id: newsletter.id
        })
      })

      const data = await response.json()

      if (data.success || data.prompt) {
        alert(editingPrompt ? 'Prompt updated!' : 'Prompt created!')
        setShowCreateForm(false)
        setEditingPrompt(null)
        resetForm()
        loadData()
      } else {
        alert('Error: ' + (data.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error saving prompt:', error)
      alert('Failed to save prompt')
    }
  }

  async function handleDelete(promptId: string) {
    if (!confirm('Are you sure you want to delete this prompt idea?')) return

    try {
      const response = await fetch(`/api/prompt-ideas/${promptId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        alert('Prompt deleted!')
        loadData()
      } else {
        alert('Error: ' + data.error)
      }
    } catch (error) {
      console.error('Error deleting prompt:', error)
      alert('Failed to delete prompt')
    }
  }

  function startEdit(prompt: PromptIdea) {
    setEditingPrompt(prompt)
    setFormData({
      title: prompt.title,
      prompt_text: prompt.prompt_text,
      category: prompt.category || '',
      use_case: prompt.use_case || '',
      suggested_model: prompt.suggested_model || '',
      difficulty_level: prompt.difficulty_level || 'beginner',
      estimated_time: prompt.estimated_time || '',
      is_featured: prompt.is_featured
    })
    setShowCreateForm(true)
  }

  function resetForm() {
    setFormData({
      title: '',
      prompt_text: '',
      category: '',
      use_case: '',
      suggested_model: '',
      difficulty_level: 'beginner',
      estimated_time: '',
      is_featured: false
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading prompt ideas...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Prompt Ideas</h1>
          <p className="text-gray-600 mt-1">
            {newsletter?.name} - Manage AI prompt templates featured in newsletters
          </p>
        </div>

        {/* Actions */}
        <div className="mb-6">
          <button
            onClick={() => {
              setShowCreateForm(!showCreateForm)
              setEditingPrompt(null)
              resetForm()
            }}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            {showCreateForm ? 'Cancel' : '+ Add New Prompt'}
          </button>
        </div>

        {/* Create/Edit Form */}
        {showCreateForm && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-200">
            <h2 className="text-xl font-semibold mb-4">
              {editingPrompt ? 'Edit Prompt Idea' : 'Create New Prompt Idea'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="e.g., Tax Calculation Reminder"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prompt Text *
                  </label>
                  <textarea
                    required
                    rows={6}
                    value={formData.prompt_text}
                    onChange={(e) => setFormData({ ...formData, prompt_text: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 font-mono text-sm"
                    placeholder="Write your prompt template here..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="e.g., Tax, Analysis, Documentation"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Use Case
                  </label>
                  <input
                    type="text"
                    value={formData.use_case}
                    onChange={(e) => setFormData({ ...formData, use_case: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="e.g., Client Communication, Report Generation"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Suggested Model
                  </label>
                  <input
                    type="text"
                    value={formData.suggested_model}
                    onChange={(e) => setFormData({ ...formData, suggested_model: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="e.g., GPT-4, Claude 3.5 Sonnet"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Difficulty Level
                  </label>
                  <select
                    value={formData.difficulty_level}
                    onChange={(e) => setFormData({ ...formData, difficulty_level: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Time
                  </label>
                  <input
                    type="text"
                    value={formData.estimated_time}
                    onChange={(e) => setFormData({ ...formData, estimated_time: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="e.g., 5-10 minutes"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.is_featured}
                      onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">Featured Prompt</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingPrompt ? 'Update Prompt' : 'Create Prompt'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false)
                    setEditingPrompt(null)
                    resetForm()
                  }}
                  className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Prompts List */}
        <div className="space-y-4">
          {prompts.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-8 text-center border border-gray-200">
              <p className="text-gray-500">No prompt ideas yet. Create your first one!</p>
            </div>
          ) : (
            prompts.map((prompt) => (
              <div key={prompt.id} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900">{prompt.title}</h3>
                      {prompt.is_featured && (
                        <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                          Featured
                        </span>
                      )}
                      {prompt.category && (
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                          {prompt.category}
                        </span>
                      )}
                      {prompt.difficulty_level && (
                        <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                          {prompt.difficulty_level}
                        </span>
                      )}
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 mb-3 border border-gray-200">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                        {prompt.prompt_text}
                      </pre>
                    </div>

                    {(prompt.use_case || prompt.suggested_model || prompt.estimated_time) && (
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                        {prompt.use_case && (
                          <div>
                            <span className="font-medium">Use Case:</span> {prompt.use_case}
                          </div>
                        )}
                        {prompt.suggested_model && (
                          <div>
                            <span className="font-medium">Model:</span> {prompt.suggested_model}
                          </div>
                        )}
                        {prompt.estimated_time && (
                          <div>
                            <span className="font-medium">Time:</span> {prompt.estimated_time}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="text-xs text-gray-500">
                      Times used: {prompt.times_used} | Last used:{' '}
                      {prompt.last_used_date || 'Never'}
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => startEdit(prompt)}
                      className="bg-blue-50 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(prompt.id)}
                      className="bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
