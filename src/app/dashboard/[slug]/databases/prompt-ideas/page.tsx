'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import type { PromptIdea } from '@/types/database'

export default function PromptIdeasPage() {
  const [prompts, setPrompts] = useState<PromptIdea[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<PromptIdea>>({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState<Partial<PromptIdea>>({
    title: '',
    prompt_text: '',
    category: 'Tax Preparation',
    use_case: '',
    suggested_model: 'ChatGPT',
    difficulty_level: 'Intermediate',
    is_active: true,
    is_featured: false
  })
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all')
  const [expandedPromptId, setExpandedPromptId] = useState<string | null>(null)
  const [uploadingCSV, setUploadingCSV] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')

  useEffect(() => {
    fetchPrompts()
  }, [])

  const fetchPrompts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/prompt-ideas')
      if (response.ok) {
        const data = await response.json()
        setPrompts(data.prompts || [])
      }
    } catch (error) {
      console.error('Failed to fetch prompt ideas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (prompt: PromptIdea) => {
    setEditingId(prompt.id)
    setEditForm({ ...prompt })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const handleSave = async (id: string) => {
    try {
      const response = await fetch(`/api/prompt-ideas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      })

      if (response.ok) {
        await fetchPrompts()
        setEditingId(null)
        setEditForm({})
      }
    } catch (error) {
      console.error('Failed to update prompt:', error)
    }
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return

    try {
      const response = await fetch(`/api/prompt-ideas/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchPrompts()
      }
    } catch (error) {
      console.error('Failed to delete prompt:', error)
    }
  }

  const handleAddPrompt = async () => {
    if (!addForm.title || !addForm.prompt_text) {
      alert('Please fill in required fields: Title and Prompt Text')
      return
    }

    try {
      const response = await fetch('/api/prompt-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm)
      })

      if (response.ok) {
        await fetchPrompts()
        setShowAddForm(false)
        setAddForm({
          title: '',
          prompt_text: '',
          category: 'Tax Preparation',
          use_case: '',
          suggested_model: 'ChatGPT',
          difficulty_level: 'Intermediate',
          is_active: true,
          is_featured: false
        })
      }
    } catch (error) {
      console.error('Failed to add prompt:', error)
    }
  }

  const handleCSVUpload = async (file: File) => {
    setUploadingCSV(true)
    setUploadMessage('')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/prompt-ideas/upload', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (response.ok) {
        setUploadMessage(`✓ Successfully uploaded ${data.imported} prompts`)
        await fetchPrompts()
      } else {
        setUploadMessage(`✗ Error: ${data.error || 'Upload failed'}`)
      }
    } catch (error) {
      setUploadMessage('✗ Error uploading CSV file')
      console.error('Failed to upload CSV:', error)
    } finally {
      setUploadingCSV(false)
      setTimeout(() => setUploadMessage(''), 5000)
    }
  }

  const filteredPrompts = prompts.filter(prompt =>
    (filterCategory === 'all' || prompt.category === filterCategory) &&
    (filterDifficulty === 'all' || prompt.difficulty_level === filterDifficulty)
  )

  const categories = ['Tax Preparation', 'Audit & Compliance', 'Financial Reporting', 'Client Communication', 'Document Analysis', 'Data Entry']
  const difficultyLevels = ['Beginner', 'Intermediate', 'Advanced']
  const models = ['ChatGPT', 'Claude', 'Gemini', 'Any']

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
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Prompt Ideas Database
            </h1>
            <p className="text-gray-600">
              Manage AI prompt templates for accounting tasks
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <label className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium cursor-pointer">
              {uploadingCSV ? 'Uploading...' : '📤 Upload CSV'}
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleCSVUpload(file)
                  e.target.value = ''
                }}
                className="hidden"
                disabled={uploadingCSV}
              />
            </label>
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
            >
              + Add Prompt
            </button>
          </div>
        </div>

        {/* Upload Message */}
        {uploadMessage && (
          <div className={`mb-4 p-3 rounded-lg ${uploadMessage.startsWith('✓') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {uploadMessage}
          </div>
        )}

        {/* Add Form */}
        {showAddForm && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border-2 border-blue-500">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add New Prompt Idea</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={addForm.title || ''}
                  onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="Monthly Reconciliation Assistant"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prompt Text *
                </label>
                <textarea
                  value={addForm.prompt_text || ''}
                  onChange={(e) => setAddForm({ ...addForm, prompt_text: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 font-mono text-sm"
                  rows={6}
                  placeholder="You are an accounting expert. Help me reconcile my bank statements by..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={addForm.category || ''}
                  onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Difficulty Level
                </label>
                <select
                  value={addForm.difficulty_level || ''}
                  onChange={(e) => setAddForm({ ...addForm, difficulty_level: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  {difficultyLevels.map(level => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Use Case (optional)
                </label>
                <input
                  type="text"
                  value={addForm.use_case || ''}
                  onChange={(e) => setAddForm({ ...addForm, use_case: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  placeholder="Monthly close process"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Suggested Model
                </label>
                <select
                  value={addForm.suggested_model || ''}
                  onChange={(e) => setAddForm({ ...addForm, suggested_model: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2"
                >
                  {models.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={addForm.is_active}
                    onChange={(e) => setAddForm({ ...addForm, is_active: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={addForm.is_featured}
                    onChange={(e) => setAddForm({ ...addForm, is_featured: e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Featured</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPrompt}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                Add Prompt
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-4 flex items-center space-x-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mr-2">Category:</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mr-2">Difficulty:</label>
            <select
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value)}
              className="border border-gray-300 rounded px-3 py-1"
            >
              <option value="all">All Levels</option>
              {difficultyLevels.map(level => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </div>
          <span className="text-sm text-gray-600">
            Showing {filteredPrompts.length} of {prompts.length} prompts
          </span>
        </div>

        {/* Prompts Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Difficulty
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Model
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPrompts.map((prompt) => (
                <tr key={prompt.id} className={!prompt.is_active ? 'bg-gray-50' : ''}>
                  {editingId === prompt.id ? (
                    <>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={editForm.title || ''}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                        <textarea
                          value={editForm.prompt_text || ''}
                          onChange={(e) => setEditForm({ ...editForm, prompt_text: e.target.value })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-xs mt-2 font-mono"
                          rows={4}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={editForm.category || ''}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={editForm.difficulty_level || ''}
                          onChange={(e) => setEditForm({ ...editForm, difficulty_level: e.target.value })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          {difficultyLevels.map(level => (
                            <option key={level} value={level}>{level}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={editForm.suggested_model || ''}
                          onChange={(e) => setEditForm({ ...editForm, suggested_model: e.target.value })}
                          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                          {models.map(model => (
                            <option key={model} value={model}>{model}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <label className="flex items-center text-sm">
                          <input
                            type="checkbox"
                            checked={editForm.is_active}
                            onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                            className="mr-1"
                          />
                          Active
                        </label>
                        <label className="flex items-center text-sm mt-1">
                          <input
                            type="checkbox"
                            checked={editForm.is_featured}
                            onChange={(e) => setEditForm({ ...editForm, is_featured: e.target.checked })}
                            className="mr-1"
                          />
                          Featured
                        </label>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleSave(prompt.id)}
                          className="text-green-600 hover:text-green-900 mr-3"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{prompt.title}</div>
                        {prompt.use_case && (
                          <div className="text-xs text-gray-500 italic mt-1">{prompt.use_case}</div>
                        )}
                        <button
                          onClick={() => setExpandedPromptId(expandedPromptId === prompt.id ? null : prompt.id)}
                          className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                        >
                          {expandedPromptId === prompt.id ? '▼ Hide Prompt' : '▶ Show Prompt'}
                        </button>
                        {expandedPromptId === prompt.id && (
                          <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200">
                            <pre className="text-xs font-mono whitespace-pre-wrap text-gray-700">
                              {prompt.prompt_text}
                            </pre>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {prompt.category}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          prompt.difficulty_level === 'Beginner' ? 'bg-green-100 text-green-800' :
                          prompt.difficulty_level === 'Intermediate' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {prompt.difficulty_level}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {prompt.suggested_model}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {prompt.is_active ? (
                          <span className="text-green-600">✓ Active</span>
                        ) : (
                          <span className="text-gray-400">Inactive</span>
                        )}
                        {prompt.is_featured && (
                          <span className="block text-yellow-600 text-xs">★ Featured</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleEdit(prompt)}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(prompt.id, prompt.title)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          {filteredPrompts.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No prompt ideas found. Click "Add Prompt" to get started.
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-blue-600">{prompts.length}</div>
            <div className="text-sm text-gray-600">Total Prompts</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-green-600">
              {prompts.filter(p => p.is_active).length}
            </div>
            <div className="text-sm text-gray-600">Active</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-yellow-600">
              {prompts.filter(p => p.is_featured).length}
            </div>
            <div className="text-sm text-gray-600">Featured</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-purple-600">
              {new Set(prompts.map(p => p.category)).size}
            </div>
            <div className="text-sm text-gray-600">Categories</div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
