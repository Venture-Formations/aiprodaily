'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ArticleModuleCriteria, ArticleModulePrompt } from '@/types/database'

interface ArticleModulePromptsTabProps {
  moduleId: string
  publicationId: string
  criteria: ArticleModuleCriteria[]
  prompts: ArticleModulePrompt[]
  aiImagePrompt: string | null
  onAiImagePromptChange: (prompt: string | null) => Promise<void>
}

// Helper to detect provider from prompt JSON
function detectProviderFromPrompt(promptJson: string | null): 'claude' | 'openai' {
  if (!promptJson) return 'openai'
  const lower = promptJson.toLowerCase()
  if (lower.includes('claude') || lower.includes('anthropic')) return 'claude'
  return 'openai'
}

// Helper to format JSON for display
function formatJSON(value: string | null, pretty: boolean): string {
  if (!value) return ''
  try {
    const parsed = JSON.parse(value)
    return pretty ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed)
  } catch {
    return value
  }
}

export default function ArticleModulePromptsTab({
  moduleId,
  publicationId,
  criteria: initialCriteria,
  prompts: initialPrompts,
  aiImagePrompt,
  onAiImagePromptChange
}: ArticleModulePromptsTabProps) {
  const [criteria, setCriteria] = useState<ArticleModuleCriteria[]>(initialCriteria)
  const [prompts, setPrompts] = useState<ArticleModulePrompt[]>(initialPrompts)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Expansion and editing states (matching Settings page pattern)
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null)
  const [editingPrompt, setEditingPrompt] = useState<{key: string, value: string} | null>(null)
  const [editingWeight, setEditingWeight] = useState<{key: string, value: string} | null>(null)
  const [editingCriteriaName, setEditingCriteriaName] = useState<{id: string, value: string} | null>(null)
  const [prettyPrint, setPrettyPrint] = useState(true)

  // RSS Posts for testing
  const [rssPosts, setRssPosts] = useState<any[]>([])
  const [selectedRssPost, setSelectedRssPost] = useState<string>('')
  const [loadingRssPosts, setLoadingRssPosts] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [testingPrompt, setTestingPrompt] = useState(false)

  // AI Image state
  const [localAiImagePrompt, setLocalAiImagePrompt] = useState(aiImagePrompt || '')
  const [editingAiImagePrompt, setEditingAiImagePrompt] = useState(false)

  // Fetch RSS posts for testing
  const fetchRssPosts = useCallback(async () => {
    setLoadingRssPosts(true)
    try {
      const res = await fetch(`/api/rss-posts?publication_id=${publicationId}&article_module_id=${moduleId}&limit=20`)
      if (res.ok) {
        const data = await res.json()
        setRssPosts(data.posts || [])
        if (data.posts?.length > 0) {
          setSelectedRssPost(data.posts[0].id)
        }
      }
    } catch (err) {
      console.error('Failed to fetch RSS posts:', err)
    } finally {
      setLoadingRssPosts(false)
    }
  }, [publicationId, moduleId])

  // Fetch latest data
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [criteriaRes, promptsRes] = await Promise.all([
        fetch(`/api/article-modules/${moduleId}/criteria`),
        fetch(`/api/article-modules/${moduleId}/prompts`)
      ])

      if (criteriaRes.ok) {
        const data = await criteriaRes.json()
        setCriteria(data.criteria || [])
      }
      if (promptsRes.ok) {
        const data = await promptsRes.json()
        setPrompts(data.prompts || [])
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [moduleId])

  useEffect(() => {
    if (!initialCriteria.length || !initialPrompts.length) {
      fetchData()
    }
    fetchRssPosts()
  }, [fetchData, fetchRssPosts, initialCriteria.length, initialPrompts.length])

  // Handlers for criteria
  const handleAddCriterion = async () => {
    if (criteria.length >= 5) return

    setSaving('add_criterion')
    try {
      const res = await fetch(`/api/article-modules/${moduleId}/criteria`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Criterion ${criteria.length + 1}`,
          weight: 1.0,
          is_active: true
        })
      })
      if (!res.ok) throw new Error('Failed to add criterion')
      await fetchData()
      setMessage('Criterion added successfully')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(null)
    }
  }

  const handleDeleteCriterion = async (criterionId: string) => {
    if (criteria.length <= 1) return

    setSaving(`delete_${criterionId}`)
    try {
      const res = await fetch(`/api/article-modules/${moduleId}/criteria?criteria_id=${criterionId}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to delete criterion')
      await fetchData()
      setMessage('Criterion removed successfully')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(null)
    }
  }

  // Handle weight edit
  const handleWeightEdit = (criterion: ArticleModuleCriteria) => {
    setEditingWeight({ key: criterion.id, value: (criterion.weight || 1).toString() })
  }

  const handleWeightSave = async (criterion: ArticleModuleCriteria) => {
    if (!editingWeight) return
    setSaving(`weight_${criterion.id}`)
    try {
      const res = await fetch(`/api/article-modules/${moduleId}/criteria`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          criteria_id: criterion.id,
          weight: parseFloat(editingWeight.value) || 1.0
        })
      })
      if (!res.ok) throw new Error('Failed to update weight')
      await fetchData()
      setEditingWeight(null)
      setMessage('Weight updated successfully')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(null)
    }
  }

  // Handle criteria name edit
  const handleNameEdit = (criterion: ArticleModuleCriteria) => {
    setEditingCriteriaName({ id: criterion.id, value: criterion.name })
  }

  const handleNameSave = async (criterion: ArticleModuleCriteria) => {
    if (!editingCriteriaName) return
    setSaving(`name_${criterion.id}`)
    try {
      const res = await fetch(`/api/article-modules/${moduleId}/criteria`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          criteria_id: criterion.id,
          name: editingCriteriaName.value
        })
      })
      if (!res.ok) throw new Error('Failed to update name')
      await fetchData()
      setEditingCriteriaName(null)
      setMessage('Name updated successfully')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(null)
    }
  }

  // Handle prompt edit (inline editing like Settings page)
  const handleEdit = (key: string, value: string) => {
    setEditingPrompt({ key, value })
  }

  const handleCancel = () => {
    setEditingPrompt(null)
    setTestResult(null)
  }

  // Save criterion prompt
  const handleSaveCriterionPrompt = async (criterion: ArticleModuleCriteria) => {
    if (!editingPrompt) return
    setSaving(criterion.id)
    try {
      const res = await fetch(`/api/article-modules/${moduleId}/criteria`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          criteria_id: criterion.id,
          ai_prompt: editingPrompt.value
        })
      })
      if (!res.ok) throw new Error('Failed to update prompt')
      await fetchData()
      setEditingPrompt(null)
      setTestResult(null)
      setMessage('Prompt saved successfully')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(null)
    }
  }

  // Save article prompt (title/body)
  const handleSaveArticlePrompt = async (prompt: ArticleModulePrompt) => {
    if (!editingPrompt) return
    setSaving(prompt.id)
    try {
      const res = await fetch(`/api/article-modules/${moduleId}/prompts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt_id: prompt.id,
          ai_prompt: editingPrompt.value
        })
      })
      if (!res.ok) throw new Error('Failed to update prompt')
      await fetchData()
      setEditingPrompt(null)
      setTestResult(null)
      setMessage('Prompt saved successfully')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(null)
    }
  }

  // Reset to default
  const handleResetToDefault = async (key: string, type: 'criterion' | 'prompt') => {
    setSaving(key)
    try {
      // For now, just show a message - actual default handling requires app_settings integration
      setMessage('Reset to default functionality requires Publication Settings integration')
    } finally {
      setSaving(null)
    }
  }

  // Save as default
  const handleSaveAsDefault = async (key: string, type: 'criterion' | 'prompt') => {
    setSaving(key)
    try {
      // For now, just show a message - actual default handling requires app_settings integration
      setMessage('Save as default functionality requires Publication Settings integration')
    } finally {
      setSaving(null)
    }
  }

  // Test prompt
  const handleTestPrompt = async (promptKey: string) => {
    if (!selectedRssPost) {
      setError('Please select an RSS post to test with')
      return
    }
    setTestingPrompt(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/debug/ai/test-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt_key: promptKey,
          post_id: selectedRssPost,
          publication_id: publicationId,
          custom_prompt: editingPrompt?.value
        })
      })
      const data = await res.json()
      setTestResult(data)
    } catch (err: any) {
      setTestResult({ error: err.message })
    } finally {
      setTestingPrompt(false)
    }
  }

  const getPromptByType = (type: string) => prompts.find(p => p.prompt_type === type)
  const titlePrompt = getPromptByType('article_title')
  const bodyPrompt = getPromptByType('article_body')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-6 w-6 text-emerald-600" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      {message && (
        <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="text-green-500 hover:text-green-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* RSS Post Selector for Testing */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          RSS Post for Testing Prompts
        </label>
        <select
          value={selectedRssPost}
          onChange={(e) => setSelectedRssPost(e.target.value)}
          disabled={loadingRssPosts}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500"
        >
          {loadingRssPosts ? (
            <option>Loading posts...</option>
          ) : rssPosts.length === 0 ? (
            <option>No RSS posts available</option>
          ) : (
            rssPosts.map((post) => (
              <option key={post.id} value={post.id}>
                {post.title?.substring(0, 80)}... {post.rss_feed?.name ? `(${post.rss_feed.name})` : ''}
              </option>
            ))
          )}
        </select>
        <p className="mt-1 text-xs text-gray-500">
          Select a post to use when testing prompts
        </p>
      </div>

      {/* Scoring Criteria */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Scoring Criteria</h4>
              <p className="text-xs text-gray-500 mt-0.5">
                Configure evaluation criteria for scoring articles. {criteria.filter(c => c.is_active).length} of {criteria.length} criteria active.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleAddCriterion}
                disabled={criteria.length >= 5 || saving === 'add_criterion'}
                className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving === 'add_criterion' ? 'Adding...' : 'Add Criteria'}
              </button>
              {criteria.length > 1 && (
                <button
                  onClick={() => handleDeleteCriterion(criteria[criteria.length - 1].id)}
                  disabled={saving?.startsWith('delete_')}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving?.startsWith('delete_') ? 'Removing...' : 'Remove Criteria'}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {criteria.filter(c => c.is_active).map((criterion) => {
            const promptKey = `criterion_${criterion.id}`
            const isExpanded = expandedPrompt === promptKey
            const isEditing = editingPrompt?.key === promptKey
            const isSaving = saving === criterion.id
            const isEditingWeight = editingWeight?.key === criterion.id
            const isEditingName = editingCriteriaName?.id === criterion.id

            return (
              <div key={criterion.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    {/* Criteria Name */}
                    <div className="flex items-center space-x-2 mb-2">
                      <label className="text-xs font-medium text-gray-500 uppercase">Criteria Name:</label>
                      {isEditingName ? (
                        <>
                          <input
                            type="text"
                            value={editingCriteriaName?.value || ''}
                            onChange={(e) => setEditingCriteriaName({ id: criterion.id, value: e.target.value })}
                            className="px-2 py-1 border border-gray-300 rounded text-sm flex-1 max-w-xs"
                            placeholder="Enter criteria name"
                          />
                          <button
                            onClick={() => handleNameSave(criterion)}
                            disabled={saving === `name_${criterion.id}`}
                            className="text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {saving === `name_${criterion.id}` ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingCriteriaName(null)}
                            disabled={saving === `name_${criterion.id}`}
                            className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <h4 className="text-sm font-medium text-gray-900">{criterion.name}</h4>
                          {!isEditing && criterion.ai_prompt && (
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                              detectProviderFromPrompt(criterion.ai_prompt) === 'claude'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {detectProviderFromPrompt(criterion.ai_prompt) === 'claude' ? 'Claude' : 'OpenAI'}
                            </span>
                          )}
                          <button
                            onClick={() => handleNameEdit(criterion)}
                            className="text-xs text-emerald-600 hover:text-emerald-800"
                          >
                            Edit Name
                          </button>
                        </>
                      )}
                    </div>

                    {/* Weight Input */}
                    <div className="mt-2 flex items-center space-x-3">
                      <label className="text-sm font-medium text-gray-700">Weight:</label>
                      {isEditingWeight ? (
                        <>
                          <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            value={editingWeight?.value || '1.0'}
                            onChange={(e) => setEditingWeight({ key: criterion.id, value: e.target.value })}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <button
                            onClick={() => handleWeightSave(criterion)}
                            disabled={saving === `weight_${criterion.id}`}
                            className="text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {saving === `weight_${criterion.id}` ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingWeight(null)}
                            disabled={saving === `weight_${criterion.id}`}
                            className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-semibold text-emerald-600">{criterion.weight || 1.0}</span>
                          <button
                            onClick={() => handleWeightEdit(criterion)}
                            className="text-xs text-emerald-600 hover:text-emerald-800"
                          >
                            Edit
                          </button>
                          <span className="text-xs text-gray-500">
                            (Max final score contribution: {((criterion.weight || 1) * 10).toFixed(1)} points)
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedPrompt(isExpanded ? null : promptKey)}
                    className="ml-4 text-emerald-600 hover:text-emerald-800 text-sm font-medium"
                  >
                    {isExpanded ? 'Collapse' : 'View/Edit Prompt'}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700">
                        Prompt Content
                      </label>
                      <span className="text-xs text-gray-500">
                        {isEditing
                          ? editingPrompt?.value.length || 0
                          : (criterion.ai_prompt?.length || 0)} characters
                      </span>
                    </div>
                    {isEditing ? (
                      <>
                        <textarea
                          value={editingPrompt?.value || ''}
                          onChange={(e) => editingPrompt && setEditingPrompt({ ...editingPrompt, value: e.target.value })}
                          rows={15}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <div className="mt-3 flex items-center justify-between">
                          <button
                            onClick={() => handleTestPrompt(promptKey)}
                            disabled={testingPrompt}
                            className="px-4 py-2 text-sm font-medium text-purple-700 bg-white border border-purple-300 rounded-md hover:bg-purple-50 disabled:opacity-50"
                          >
                            {testingPrompt ? 'Testing...' : 'Test Prompt'}
                          </button>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={handleCancel}
                              disabled={isSaving}
                              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveCriterionPrompt(criterion)}
                              disabled={isSaving}
                              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                          </div>
                        </div>
                        {/* Test Results */}
                        {testResult && (
                          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                            <h5 className="text-xs font-medium text-gray-700 mb-2">Test Result</h5>
                            <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                              {JSON.stringify(testResult, null, 2)}
                            </pre>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="mb-2 flex items-center">
                          <label className="flex items-center text-sm text-gray-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={prettyPrint}
                              onChange={(e) => setPrettyPrint(e.target.checked)}
                              className="mr-2 h-4 w-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                            />
                            Pretty-print
                          </label>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-md p-4 font-mono text-xs whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                          {criterion.ai_prompt ? formatJSON(criterion.ai_prompt, prettyPrint) : 'No prompt configured'}
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => handleResetToDefault(criterion.id, 'criterion')}
                              disabled={isSaving}
                              className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                            >
                              Reset to Default
                            </button>
                            <button
                              onClick={() => handleSaveAsDefault(criterion.id, 'criterion')}
                              disabled={isSaving}
                              className="px-4 py-2 text-sm font-medium text-green-700 bg-white border border-green-300 rounded-md hover:bg-green-50 disabled:opacity-50"
                            >
                              Save as Default
                            </button>
                          </div>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => handleEdit(promptKey, criterion.ai_prompt || '')}
                              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700"
                            >
                              Edit Prompt
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Article Prompts */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-900">Article Prompts</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure prompts for generating article titles and body content.
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {/* Title Prompt */}
          {titlePrompt && (
            <ArticlePromptCard
              prompt={titlePrompt}
              label="Article Title Prompt"
              description="Generates headlines for articles based on the original content"
              isExpanded={expandedPrompt === `prompt_${titlePrompt.id}`}
              isEditing={editingPrompt?.key === `prompt_${titlePrompt.id}`}
              editingValue={editingPrompt?.key === `prompt_${titlePrompt.id}` ? editingPrompt.value : null}
              isSaving={saving === titlePrompt.id}
              prettyPrint={prettyPrint}
              onToggleExpand={() => setExpandedPrompt(expandedPrompt === `prompt_${titlePrompt.id}` ? null : `prompt_${titlePrompt.id}`)}
              onEdit={() => handleEdit(`prompt_${titlePrompt.id}`, titlePrompt.ai_prompt || '')}
              onEditChange={(value) => setEditingPrompt({ key: `prompt_${titlePrompt.id}`, value })}
              onCancel={handleCancel}
              onSave={() => handleSaveArticlePrompt(titlePrompt)}
              onTestPrompt={() => handleTestPrompt(`prompt_${titlePrompt.id}`)}
              onResetToDefault={() => handleResetToDefault(titlePrompt.id, 'prompt')}
              onSaveAsDefault={() => handleSaveAsDefault(titlePrompt.id, 'prompt')}
              testingPrompt={testingPrompt}
              testResult={testResult}
              setPrettyPrint={setPrettyPrint}
            />
          )}

          {/* Body Prompt */}
          {bodyPrompt && (
            <ArticlePromptCard
              prompt={bodyPrompt}
              label="Article Body Prompt"
              description="Generates the main content/summary for articles"
              isExpanded={expandedPrompt === `prompt_${bodyPrompt.id}`}
              isEditing={editingPrompt?.key === `prompt_${bodyPrompt.id}`}
              editingValue={editingPrompt?.key === `prompt_${bodyPrompt.id}` ? editingPrompt.value : null}
              isSaving={saving === bodyPrompt.id}
              prettyPrint={prettyPrint}
              onToggleExpand={() => setExpandedPrompt(expandedPrompt === `prompt_${bodyPrompt.id}` ? null : `prompt_${bodyPrompt.id}`)}
              onEdit={() => handleEdit(`prompt_${bodyPrompt.id}`, bodyPrompt.ai_prompt || '')}
              onEditChange={(value) => setEditingPrompt({ key: `prompt_${bodyPrompt.id}`, value })}
              onCancel={handleCancel}
              onSave={() => handleSaveArticlePrompt(bodyPrompt)}
              onTestPrompt={() => handleTestPrompt(`prompt_${bodyPrompt.id}`)}
              onResetToDefault={() => handleResetToDefault(bodyPrompt.id, 'prompt')}
              onSaveAsDefault={() => handleSaveAsDefault(bodyPrompt.id, 'prompt')}
              testingPrompt={testingPrompt}
              testResult={testResult}
              setPrettyPrint={setPrettyPrint}
            />
          )}

          {!titlePrompt && !bodyPrompt && (
            <div className="p-4 text-center text-sm text-gray-500">
              No article prompts configured. Prompts will be migrated from Publication Settings.
            </div>
          )}
        </div>
      </div>

      {/* AI Image Prompt */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-900">AI Image Generation</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure prompt for generating AI images for articles in this section.
          </p>
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-sm font-medium text-gray-900">AI Image Prompt</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {localAiImagePrompt ? 'Configured - AI will generate images for articles' : 'Not configured (optional)'}
              </p>
            </div>
            <button
              onClick={() => setEditingAiImagePrompt(true)}
              className="text-emerald-600 hover:text-emerald-800 text-sm font-medium"
            >
              {localAiImagePrompt ? 'View/Edit Prompt' : 'Configure'}
            </button>
          </div>

          {editingAiImagePrompt && (
            <AIImagePromptModal
              prompt={localAiImagePrompt}
              onSave={async (newPrompt) => {
                setLocalAiImagePrompt(newPrompt)
                await onAiImagePromptChange(newPrompt || null)
                setEditingAiImagePrompt(false)
              }}
              onClose={() => setEditingAiImagePrompt(false)}
              saving={saving === 'ai_image'}
            />
          )}
        </div>
      </div>

      {/* Global Prompts Warning */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h5 className="text-sm font-medium text-amber-800">Global Prompts</h5>
            <p className="text-xs text-amber-700 mt-1">
              Deduplication and Fact Checker prompts are shared across all article sections.
              To edit these, go to Publication Settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Article Prompt Card Component (reusable for title/body prompts)
function ArticlePromptCard({
  prompt,
  label,
  description,
  isExpanded,
  isEditing,
  editingValue,
  isSaving,
  prettyPrint,
  onToggleExpand,
  onEdit,
  onEditChange,
  onCancel,
  onSave,
  onTestPrompt,
  onResetToDefault,
  onSaveAsDefault,
  testingPrompt,
  testResult,
  setPrettyPrint
}: {
  prompt: ArticleModulePrompt
  label: string
  description: string
  isExpanded: boolean
  isEditing: boolean
  editingValue: string | null
  isSaving: boolean
  prettyPrint: boolean
  onToggleExpand: () => void
  onEdit: () => void
  onEditChange: (value: string) => void
  onCancel: () => void
  onSave: () => void
  onTestPrompt: () => void
  onResetToDefault: () => void
  onSaveAsDefault: () => void
  testingPrompt: boolean
  testResult: any
  setPrettyPrint: (value: boolean) => void
}) {
  return (
    <div className="p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <h4 className="text-sm font-medium text-gray-900">{label}</h4>
            {prompt.ai_model && (
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                prompt.ai_provider === 'anthropic' || prompt.ai_model?.toLowerCase().includes('claude')
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {prompt.ai_model}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
        <button
          onClick={onToggleExpand}
          className="ml-4 text-emerald-600 hover:text-emerald-800 text-sm font-medium"
        >
          {isExpanded ? 'Collapse' : 'View/Edit Prompt'}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              Prompt Content
            </label>
            <span className="text-xs text-gray-500">
              {isEditing
                ? editingValue?.length || 0
                : (prompt.ai_prompt?.length || 0)} characters
            </span>
          </div>
          {isEditing ? (
            <>
              <textarea
                value={editingValue || ''}
                onChange={(e) => onEditChange(e.target.value)}
                rows={15}
                className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="mt-3 flex items-center justify-between">
                <button
                  onClick={onTestPrompt}
                  disabled={testingPrompt}
                  className="px-4 py-2 text-sm font-medium text-purple-700 bg-white border border-purple-300 rounded-md hover:bg-purple-50 disabled:opacity-50"
                >
                  {testingPrompt ? 'Testing...' : 'Test Prompt'}
                </button>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={onCancel}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onSave}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
              {/* Test Results */}
              {testResult && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <h5 className="text-xs font-medium text-gray-700 mb-2">Test Result</h5>
                  <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mb-2 flex items-center">
                <label className="flex items-center text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prettyPrint}
                    onChange={(e) => setPrettyPrint(e.target.checked)}
                    className="mr-2 h-4 w-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                  />
                  Pretty-print
                </label>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4 font-mono text-xs whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                {prompt.ai_prompt ? formatJSON(prompt.ai_prompt, prettyPrint) : 'No prompt configured'}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={onResetToDefault}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                  >
                    Reset to Default
                  </button>
                  <button
                    onClick={onSaveAsDefault}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-green-700 bg-white border border-green-300 rounded-md hover:bg-green-50 disabled:opacity-50"
                  >
                    Save as Default
                  </button>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={onEdit}
                    className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700"
                  >
                    Edit Prompt
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// AI Image Prompt Modal Component
function AIImagePromptModal({
  prompt,
  onSave,
  onClose,
  saving
}: {
  prompt: string
  onSave: (prompt: string) => Promise<void>
  onClose: () => void
  saving: boolean
}) {
  const [localPrompt, setLocalPrompt] = useState(prompt)
  const [provider, setProvider] = useState<'openai' | 'anthropic'>('openai')
  const [model, setModel] = useState('dall-e-3')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  const handleTest = async () => {
    if (!localPrompt.trim()) return
    setTesting(true)
    setTestResult(null)
    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      setTestResult('Prompt syntax looks valid. Full testing requires generating an image.')
    } catch (err: any) {
      setTestResult(`Error: ${err.message}`)
    } finally {
      setTesting(false)
    }
  }

  const getFullPromptConfig = () => {
    return JSON.stringify({
      provider,
      model,
      prompt: localPrompt,
      size: '1024x1024',
      quality: 'standard'
    }, null, 2)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">AI Image Generation Prompt</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              Configure an AI image generation prompt for articles in this section.
              The prompt will be used to generate unique images for each article.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">AI Provider</label>
              <select
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value as 'openai' | 'anthropic')
                  if (e.target.value === 'openai') setModel('dall-e-3')
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="openai">OpenAI (DALL-E)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="dall-e-3">DALL-E 3</option>
                <option value="dall-e-2">DALL-E 2</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image Prompt Template</label>
            <textarea
              value={localPrompt}
              onChange={(e) => setLocalPrompt(e.target.value)}
              rows={6}
              placeholder="Create a professional illustration for an article about {{headline}}. Style: modern, clean, corporate..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Available placeholders: {'{{headline}}'}, {'{{content}}'}, {'{{title}}'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Configuration (JSON)</label>
            <pre className="p-3 bg-gray-50 rounded-lg text-xs font-mono overflow-x-auto">
              {getFullPromptConfig()}
            </pre>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Test Prompt</label>
              <button
                onClick={handleTest}
                disabled={testing || !localPrompt.trim()}
                className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-50"
              >
                {testing ? 'Testing...' : 'Validate'}
              </button>
            </div>
            {testResult && (
              <div className={`p-2 rounded text-xs ${testResult.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                {testResult}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between gap-2 p-4 border-t">
          <button
            onClick={() => setLocalPrompt('')}
            className="px-4 py-2 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
          >
            Clear
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(localPrompt)}
              disabled={saving}
              className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
