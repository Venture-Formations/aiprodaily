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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Modal states
  const [editingCriterion, setEditingCriterion] = useState<ArticleModuleCriteria | null>(null)
  const [editingPrompt, setEditingPrompt] = useState<ArticleModulePrompt | null>(null)
  const [localAiImagePrompt, setLocalAiImagePrompt] = useState(aiImagePrompt || '')

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
  }, [fetchData, initialCriteria.length, initialPrompts.length])

  // Calculate total weight
  const activeCriteria = criteria.filter(c => c.is_active)
  const totalWeight = activeCriteria.reduce((sum, c) => sum + (c.weight || 0), 0)
  const weightsValid = Math.abs(totalWeight - 1.0) < 0.01

  const handleAddCriterion = async () => {
    if (criteria.length >= 5) return

    setSaving(true)
    try {
      const res = await fetch(`/api/article-modules/${moduleId}/criteria`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Criterion ${criteria.length + 1}`,
          weight: 0.2,
          is_active: true
        })
      })
      if (!res.ok) throw new Error('Failed to add criterion')
      await fetchData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteCriterion = async (criterionId: string) => {
    if (criteria.length <= 1) return

    setSaving(true)
    try {
      const res = await fetch(`/api/article-modules/${moduleId}/criteria?criteria_id=${criterionId}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Failed to delete criterion')
      await fetchData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveCriterion = async (criterion: ArticleModuleCriteria) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/article-modules/${moduleId}/criteria`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          criteria_id: criterion.id,
          name: criterion.name,
          weight: criterion.weight,
          ai_prompt: criterion.ai_prompt,
          is_active: criterion.is_active
        })
      })
      if (!res.ok) throw new Error('Failed to update criterion')
      await fetchData()
      setEditingCriterion(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSavePrompt = async (prompt: ArticleModulePrompt) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/article-modules/${moduleId}/prompts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt_id: prompt.id,
          ai_prompt: prompt.ai_prompt,
          ai_model: prompt.ai_model,
          ai_provider: prompt.ai_provider
        })
      })
      if (!res.ok) throw new Error('Failed to update prompt')
      await fetchData()
      setEditingPrompt(null)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAiImagePromptSave = async () => {
    await onAiImagePromptChange(localAiImagePrompt || null)
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

      {/* Scoring Criteria */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-700">Scoring Criteria</h4>
          {criteria.length < 5 && (
            <button
              onClick={handleAddCriterion}
              disabled={saving}
              className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Criterion
            </button>
          )}
        </div>

        {/* Weight validation warning */}
        {!weightsValid && activeCriteria.length > 0 && (
          <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
            Weights must sum to 100%. Current sum: {(totalWeight * 100).toFixed(0)}%
          </div>
        )}

        <div className="border rounded-lg divide-y">
          {criteria.map((criterion, index) => (
            <div key={criterion.id} className="p-3 flex items-center gap-3">
              <span className="text-xs text-gray-400 w-4">{index + 1}</span>
              <div className="flex-1">
                <p className={`text-sm font-medium ${criterion.is_active ? 'text-gray-900' : 'text-gray-400'}`}>
                  {criterion.name}
                </p>
                <p className="text-xs text-gray-500">
                  Weight: {((criterion.weight || 0) * 100).toFixed(0)}%
                </p>
              </div>
              <button
                onClick={() => setEditingCriterion(criterion)}
                className="px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 rounded"
              >
                Edit
              </button>
              {criteria.length > 1 && (
                <button
                  onClick={() => handleDeleteCriterion(criterion.id)}
                  disabled={saving}
                  className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded disabled:opacity-50"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Article Prompts */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700">Article Prompts</h4>

        <div className="space-y-2">
          {/* Title Prompt */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">Article Title Prompt</p>
              <p className="text-xs text-gray-500">
                {titlePrompt ? `Model: ${titlePrompt.ai_model}` : 'Not configured'}
              </p>
            </div>
            <button
              onClick={() => titlePrompt && setEditingPrompt(titlePrompt)}
              disabled={!titlePrompt}
              className="px-3 py-1 text-xs text-emerald-600 hover:bg-emerald-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {titlePrompt ? 'Edit' : 'N/A'}
            </button>
          </div>

          {/* Body Prompt */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">Article Body Prompt</p>
              <p className="text-xs text-gray-500">
                {bodyPrompt ? `Model: ${bodyPrompt.ai_model}` : 'Not configured'}
              </p>
            </div>
            <button
              onClick={() => bodyPrompt && setEditingPrompt(bodyPrompt)}
              disabled={!bodyPrompt}
              className="px-3 py-1 text-xs text-emerald-600 hover:bg-emerald-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bodyPrompt ? 'Edit' : 'N/A'}
            </button>
          </div>
        </div>
      </div>

      {/* AI Image Prompt */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700">AI Image Generation</h4>
        <div className="space-y-2">
          <textarea
            value={localAiImagePrompt}
            onChange={(e) => setLocalAiImagePrompt(e.target.value)}
            onBlur={handleAiImagePromptSave}
            placeholder="Enter AI image generation prompt... (optional)"
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
          />
          <p className="text-xs text-gray-500">
            If provided, AI will generate images for articles in this section
          </p>
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

      {/* Criterion Edit Modal */}
      {editingCriterion && (
        <CriterionEditModal
          criterion={editingCriterion}
          onSave={handleSaveCriterion}
          onClose={() => setEditingCriterion(null)}
          saving={saving}
        />
      )}

      {/* Prompt Edit Modal */}
      {editingPrompt && (
        <PromptEditModal
          prompt={editingPrompt}
          onSave={handleSavePrompt}
          onClose={() => setEditingPrompt(null)}
          saving={saving}
        />
      )}
    </div>
  )
}

// Criterion Edit Modal Component
function CriterionEditModal({
  criterion,
  onSave,
  onClose,
  saving
}: {
  criterion: ArticleModuleCriteria
  onSave: (criterion: ArticleModuleCriteria) => Promise<void>
  onClose: () => void
  saving: boolean
}) {
  const [localCriterion, setLocalCriterion] = useState(criterion)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Edit Criterion</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={localCriterion.name}
              onChange={(e) => setLocalCriterion(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Weight ({((localCriterion.weight || 0) * 100).toFixed(0)}%)
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={(localCriterion.weight || 0) * 100}
              onChange={(e) => setLocalCriterion(prev => ({ ...prev, weight: parseInt(e.target.value) / 100 }))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">AI Prompt (optional)</label>
            <textarea
              value={localCriterion.ai_prompt || ''}
              onChange={(e) => setLocalCriterion(prev => ({ ...prev, ai_prompt: e.target.value || null }))}
              rows={4}
              placeholder="Custom prompt for scoring this criterion..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="criterion-active"
              checked={localCriterion.is_active}
              onChange={(e) => setLocalCriterion(prev => ({ ...prev, is_active: e.target.checked }))}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="criterion-active" className="text-sm text-gray-700">Active</label>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(localCriterion)}
            disabled={saving}
            className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Prompt Edit Modal Component
function PromptEditModal({
  prompt,
  onSave,
  onClose,
  saving
}: {
  prompt: ArticleModulePrompt
  onSave: (prompt: ArticleModulePrompt) => Promise<void>
  onClose: () => void
  saving: boolean
}) {
  const [localPrompt, setLocalPrompt] = useState(prompt)
  const promptTypeLabels: Record<string, string> = {
    article_title: 'Article Title Prompt',
    article_body: 'Article Body Prompt'
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">
            {promptTypeLabels[prompt.prompt_type] || prompt.prompt_type}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">AI Provider</label>
              <select
                value={localPrompt.ai_provider || 'openai'}
                onChange={(e) => setLocalPrompt(prev => ({ ...prev, ai_provider: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <input
                type="text"
                value={localPrompt.ai_model || ''}
                onChange={(e) => setLocalPrompt(prev => ({ ...prev, ai_model: e.target.value }))}
                placeholder="gpt-4o"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Prompt (JSON)</label>
            <textarea
              value={localPrompt.ai_prompt || ''}
              onChange={(e) => setLocalPrompt(prev => ({ ...prev, ai_prompt: e.target.value }))}
              rows={15}
              className="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              JSON format with messages array. Use placeholders: {'{{title}}'}, {'{{description}}'}, {'{{content}}'}, {'{{headline}}'}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t">
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
  )
}
