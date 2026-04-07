'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ArticleModuleCriteria, ArticleModulePrompt } from '@/types/database'

// Re-export from shared utils to avoid duplication
export { detectProviderFromPrompt, formatJSON } from '@/components/settings/ai-prompts/utils'
import { detectProviderFromPrompt } from '@/components/settings/ai-prompts/utils'

export interface UseArticleModulePromptsProps {
  moduleId: string
  publicationId: string
  criteria: ArticleModuleCriteria[]
  prompts: ArticleModulePrompt[]
  aiImagePrompt: string | null
  onAiImagePromptChange: (prompt: string | null) => Promise<void>
}

export function useArticleModulePrompts({
  moduleId,
  publicationId,
  criteria: initialCriteria,
  prompts: initialPrompts,
  aiImagePrompt,
  onAiImagePromptChange
}: UseArticleModulePromptsProps) {
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
  const [editingMinimum, setEditingMinimum] = useState<{id: string, value: string} | null>(null)
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

  // Global prompts state (shared across all article sections)
  const [globalPrompts, setGlobalPrompts] = useState<{
    deduplication: string | null
    factChecker: string | null
  }>({ deduplication: null, factChecker: null })
  const [loadingGlobalPrompts, setLoadingGlobalPrompts] = useState(true)
  const [expandedGlobalPrompt, setExpandedGlobalPrompt] = useState<string | null>(null)
  const [editingGlobalPrompt, setEditingGlobalPrompt] = useState<{key: string, value: string} | null>(null)
  const [savingGlobalPrompt, setSavingGlobalPrompt] = useState<string | null>(null)

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

  // Fetch global prompts from publication_settings via ai-prompts API
  const fetchGlobalPrompts = useCallback(async () => {
    setLoadingGlobalPrompts(true)
    try {
      const res = await fetch('/api/settings/ai-prompts')
      if (res.ok) {
        const data = await res.json()
        const allPrompts = data.prompts || []
        // Find the specific global prompts we need
        const dedupePrompt = allPrompts.find((p: any) => p.key === 'ai_prompt_topic_deduper')
        const factCheckPrompt = allPrompts.find((p: any) => p.key === 'ai_prompt_fact_checker')
        setGlobalPrompts({
          deduplication: dedupePrompt?.value || null,
          factChecker: factCheckPrompt?.value || null
        })
      }
    } catch (err) {
      console.error('Failed to fetch global prompts:', err)
    } finally {
      setLoadingGlobalPrompts(false)
    }
  }, [])

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
    fetchGlobalPrompts()
  }, [fetchData, fetchRssPosts, fetchGlobalPrompts, initialCriteria.length, initialPrompts.length])

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

  // Handle minimum score enforcement toggle
  const handleToggleEnforceMinimum = async (criterion: ArticleModuleCriteria, checked: boolean) => {
    setSaving(`enforce_${criterion.id}`)
    try {
      const res = await fetch(`/api/article-modules/${moduleId}/criteria`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          criteria_id: criterion.id,
          enforce_minimum: checked,
          // Set default minimum_score of 5 when enabling
          minimum_score: checked ? (criterion.minimum_score ?? 5) : criterion.minimum_score
        })
      })
      if (!res.ok) throw new Error('Failed to update enforcement')
      await fetchData()
      setMessage(checked ? 'Minimum score enforcement enabled' : 'Minimum score enforcement disabled')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(null)
    }
  }

  // Handle minimum score edit
  const handleMinimumEdit = (criterion: ArticleModuleCriteria) => {
    setEditingMinimum({ id: criterion.id, value: (criterion.minimum_score ?? 5).toString() })
  }

  const handleMinimumSave = async (criterion: ArticleModuleCriteria) => {
    if (!editingMinimum) return
    const value = parseInt(editingMinimum.value)
    if (isNaN(value) || value < 0 || value > 10) {
      setError('Minimum score must be between 0 and 10')
      return
    }

    setSaving(`minimum_${criterion.id}`)
    try {
      const res = await fetch(`/api/article-modules/${moduleId}/criteria`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          criteria_id: criterion.id,
          minimum_score: value
        })
      })
      if (!res.ok) throw new Error('Failed to update minimum score')
      await fetchData()
      setEditingMinimum(null)
      setMessage('Minimum score updated successfully')
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
  const handleResetToDefault = async (key: string, _type: 'criterion' | 'prompt') => {
    setSaving(key)
    try {
      // For now, just show a message - actual default handling requires app_settings integration
      setMessage('Reset to default functionality requires Publication Settings integration')
    } finally {
      setSaving(null)
    }
  }

  // Save as default
  const handleSaveAsDefault = async (key: string, _type: 'criterion' | 'prompt') => {
    setSaving(key)
    try {
      // For now, just show a message - actual default handling requires app_settings integration
      setMessage('Save as default functionality requires Publication Settings integration')
    } finally {
      setSaving(null)
    }
  }

  // Handle global prompt edit
  const handleEditGlobalPrompt = (key: string, value: string) => {
    setEditingGlobalPrompt({ key, value })
  }

  const handleCancelGlobalPrompt = () => {
    setEditingGlobalPrompt(null)
  }

  // Save global prompt to publication_settings
  const handleSaveGlobalPrompt = async (promptKey: 'ai_prompt_topic_deduper' | 'ai_prompt_fact_checker') => {
    if (!editingGlobalPrompt) return
    setSavingGlobalPrompt(promptKey)
    try {
      const res = await fetch('/api/settings/ai-prompts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: promptKey,
          value: editingGlobalPrompt.value
        })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update global prompt')
      }
      // Update local state
      setGlobalPrompts(prev => ({
        ...prev,
        [promptKey === 'ai_prompt_topic_deduper' ? 'deduplication' : 'factChecker']: editingGlobalPrompt.value
      }))
      setEditingGlobalPrompt(null)
      setMessage('Global prompt saved successfully. Changes apply to all article sections.')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSavingGlobalPrompt(null)
    }
  }

  // Reset global prompt to default
  const handleResetGlobalPromptToDefault = async (promptKey: 'ai_prompt_topic_deduper' | 'ai_prompt_fact_checker') => {
    setSavingGlobalPrompt(promptKey)
    try {
      const res = await fetch('/api/settings/ai-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: promptKey,
          action: 'reset_to_default'
        })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to reset prompt')
      }
      // Refetch global prompts to get updated values
      await fetchGlobalPrompts()
      setMessage('Global prompt reset to default')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSavingGlobalPrompt(null)
    }
  }

  // Save global prompt as default
  const handleSaveGlobalPromptAsDefault = async (promptKey: 'ai_prompt_topic_deduper' | 'ai_prompt_fact_checker') => {
    setSavingGlobalPrompt(promptKey)
    try {
      const res = await fetch('/api/settings/ai-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: promptKey,
          action: 'save_as_default'
        })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save as default')
      }
      setMessage('Global prompt saved as your custom default')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSavingGlobalPrompt(null)
    }
  }

  // Test prompt
  const handleTestPrompt = async (promptKey: string) => {
    if (!selectedRssPost) {
      setError('Please select an RSS post to test with')
      return
    }

    // Get the selected post data
    const post = rssPosts.find(p => p.id === selectedRssPost)
    if (!post) {
      setError('Selected RSS post not found')
      return
    }

    // Determine which prompt to use
    let promptJson: any = null
    let provider: 'openai' | 'claude' = 'openai'

    // Check if this is a criterion prompt
    if (promptKey.startsWith('criterion_')) {
      const criterionId = promptKey.replace('criterion_', '')
      const criterion = criteria.find(c => c.id === criterionId)
      if (!criterion) {
        setError('Criterion not found')
        return
      }
      // Use custom prompt if editing, otherwise use criterion's prompt
      const promptStr = editingPrompt?.key === promptKey ? editingPrompt.value : criterion.ai_prompt
      if (!promptStr) {
        setError('No prompt configured for this criterion')
        return
      }
      try {
        promptJson = JSON.parse(promptStr)
        provider = detectProviderFromPrompt(promptStr)
      } catch {
        setError('Invalid JSON in prompt configuration')
        return
      }
    }
    // Check if this is an article prompt
    else if (promptKey.startsWith('prompt_')) {
      const promptId = promptKey.replace('prompt_', '')
      const prompt = prompts.find(p => p.id === promptId)
      if (!prompt) {
        setError('Prompt not found')
        return
      }
      const promptStr = editingPrompt?.key === promptKey ? editingPrompt.value : prompt.ai_prompt
      if (!promptStr) {
        setError('No prompt configured')
        return
      }
      try {
        promptJson = JSON.parse(promptStr)
        provider = detectProviderFromPrompt(promptStr)
      } catch {
        setError('Invalid JSON in prompt configuration')
        return
      }
    }

    if (!promptJson) {
      setError('Could not determine prompt to test')
      return
    }

    setTestingPrompt(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/ai/test-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          promptJson,
          post: {
            title: post.title,
            description: post.description,
            full_article_text: post.full_article_text,
            source_url: post.source_url
          }
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

  return {
    // Data
    criteria,
    prompts,
    loading,
    saving,
    error,
    message,
    titlePrompt,
    bodyPrompt,

    // Expansion / editing states
    expandedPrompt,
    setExpandedPrompt,
    editingPrompt,
    setEditingPrompt,
    editingWeight,
    setEditingWeight,
    editingCriteriaName,
    setEditingCriteriaName,
    editingMinimum,
    setEditingMinimum,
    prettyPrint,
    setPrettyPrint,

    // RSS test states
    rssPosts,
    selectedRssPost,
    setSelectedRssPost,
    loadingRssPosts,
    testResult,
    testingPrompt,

    // AI Image states
    localAiImagePrompt,
    setLocalAiImagePrompt,
    editingAiImagePrompt,
    setEditingAiImagePrompt,
    onAiImagePromptChange,

    // Global prompt states
    globalPrompts,
    loadingGlobalPrompts,
    expandedGlobalPrompt,
    setExpandedGlobalPrompt,
    editingGlobalPrompt,
    setEditingGlobalPrompt,
    savingGlobalPrompt,

    // Setters for messages
    setError,
    setMessage,

    // Criterion handlers
    handleAddCriterion,
    handleDeleteCriterion,
    handleWeightEdit,
    handleWeightSave,
    handleNameEdit,
    handleNameSave,
    handleToggleEnforceMinimum,
    handleMinimumEdit,
    handleMinimumSave,

    // Prompt handlers
    handleEdit,
    handleCancel,
    handleSaveCriterionPrompt,
    handleSaveArticlePrompt,
    handleResetToDefault,
    handleSaveAsDefault,
    handleTestPrompt,

    // Global prompt handlers
    handleEditGlobalPrompt,
    handleCancelGlobalPrompt,
    handleSaveGlobalPrompt,
    handleResetGlobalPromptToDefault,
    handleSaveGlobalPromptAsDefault,
  }
}
