'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { detectProviderFromPrompt, parseResponseOutputs, PROMPT_TYPE_MAP } from './utils'

export function useAIPrompts() {
  const [prompts, setPrompts] = useState<any[]>([])
  const [grouped, setGrouped] = useState<Record<string, any[]>>({})
  const [primaryCriteria, setPrimaryCriteria] = useState<any[]>([])
  const [secondaryCriteria, setSecondaryCriteria] = useState<any[]>([])
  const [primaryEnabledCount, setPrimaryEnabledCount] = useState(3)
  const [secondaryEnabledCount, setSecondaryEnabledCount] = useState(3)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [expandedPrompt, setExpandedPrompt] = useState<string | null>(null)
  const [editingPrompt, setEditingPrompt] = useState<{key: string, value: string} | null>(null)
  const [editingWeight, setEditingWeight] = useState<{key: string, value: string} | null>(null)
  const [editingPrimaryName, setEditingPrimaryName] = useState<{number: number, value: string} | null>(null)
  const [editingSecondaryName, setEditingSecondaryName] = useState<{number: number, value: string} | null>(null)
  const [primaryRssPosts, setPrimaryRssPosts] = useState<any[]>([])
  const [selectedPrimaryRssPost, setSelectedPrimaryRssPost] = useState<string>('')
  const [loadingPrimaryRssPosts, setLoadingPrimaryRssPosts] = useState(false)
  const [secondaryRssPosts, setSecondaryRssPosts] = useState<any[]>([])
  const [selectedSecondaryRssPost, setSelectedSecondaryRssPost] = useState<string>('')
  const [loadingSecondaryRssPosts, setLoadingSecondaryRssPosts] = useState(false)
  const [testModalOpen, setTestModalOpen] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [testResults, setTestResults] = useState<any>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [prettyPrint, setPrettyPrint] = useState(true)

  const pathname = usePathname()
  const newsletterSlug = pathname ? pathname.match(/^\/dashboard\/([^\/]+)/)?.[1] : null

  // --- Data loading ---

  const loadPrompts = async () => {
    try {
      const response = await fetch('/api/settings/ai-prompts')
      if (response.ok) {
        const data = await response.json()
        setPrompts(data.prompts || [])
        setGrouped(data.grouped || {})
      }
    } catch (error) {
      console.error('Failed to load AI prompts:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCriteria = async () => {
    if (!newsletterSlug) return
    try {
      const response = await fetch(`/api/settings/criteria?publication_id=${newsletterSlug}`)
      if (response.ok) {
        const data = await response.json()
        setPrimaryCriteria(data.primaryCriteria || [])
        setSecondaryCriteria(data.secondaryCriteria || [])
        setPrimaryEnabledCount(data.primaryEnabledCount || 3)
        setSecondaryEnabledCount(data.secondaryEnabledCount || 3)
      }
    } catch (error) {
      console.error('Failed to load criteria:', error)
    }
  }

  const loadPrimaryRssPosts = async () => {
    setLoadingPrimaryRssPosts(true)
    try {
      const response = await fetch('/api/rss-posts/recent?limit=50&section=primary')
      if (response.ok) {
        const data = await response.json()
        setPrimaryRssPosts(data.posts || [])
        if (data.posts && data.posts.length > 0) {
          setSelectedPrimaryRssPost(data.posts[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to load primary RSS posts:', error)
    } finally {
      setLoadingPrimaryRssPosts(false)
    }
  }

  const loadSecondaryRssPosts = async () => {
    setLoadingSecondaryRssPosts(true)
    try {
      const response = await fetch('/api/rss-posts/recent?limit=50&section=secondary')
      if (response.ok) {
        const data = await response.json()
        setSecondaryRssPosts(data.posts || [])
        if (data.posts && data.posts.length > 0) {
          setSelectedSecondaryRssPost(data.posts[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to load secondary RSS posts:', error)
    } finally {
      setLoadingSecondaryRssPosts(false)
    }
  }

  useEffect(() => {
    loadPrompts()
    loadCriteria()
    loadPrimaryRssPosts()
    loadSecondaryRssPosts()
  }, [])

  // --- Prompt CRUD handlers ---

  const showMessage = (msg: string, duration = 3000) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), duration)
  }

  const handleEdit = (prompt: any) => {
    let valueStr: string
    if (typeof prompt.value === 'object') {
      valueStr = JSON.stringify(prompt.value, null, 2)
    } else if (typeof prompt.value === 'string') {
      try {
        const parsed = JSON.parse(prompt.value)
        valueStr = JSON.stringify(parsed, null, 2)
      } catch (e) {
        valueStr = prompt.value
      }
    } else {
      valueStr = String(prompt.value)
    }
    setEditingPrompt({ key: prompt.key, value: valueStr })
    setExpandedPrompt(prompt.key)
  }

  const handleCancel = () => {
    setEditingPrompt(null)
  }

  const handleSave = async (key: string) => {
    if (!editingPrompt || editingPrompt.key !== key) return
    setSaving(key)
    setMessage('')
    try {
      const response = await fetch('/api/settings/ai-prompts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: editingPrompt.key, value: editingPrompt.value })
      })
      if (response.ok) {
        showMessage('Prompt saved successfully!')
        setEditingPrompt(null)
        await loadPrompts()
      } else {
        throw new Error('Failed to save prompt')
      }
    } catch (error) {
      showMessage('Error: Failed to save prompt', 5000)
    } finally {
      setSaving(null)
    }
  }

  const handleReset = async (key: string) => {
    if (!confirm('Are you sure you want to reset this prompt to its default value? This cannot be undone.')) return
    setSaving(key)
    setMessage('')
    try {
      const response = await fetch('/api/settings/ai-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      })
      if (response.ok) {
        const data = await response.json()
        showMessage(data.used_custom_default
          ? 'Prompt reset to your custom default!'
          : 'Prompt reset to original code default!')
        await loadPrompts()
      } else {
        throw new Error('Failed to reset prompt')
      }
    } catch (error) {
      showMessage('Error: Failed to reset prompt', 5000)
    } finally {
      setSaving(null)
    }
  }

  const handleSaveAsDefault = async (key: string) => {
    if (!confirm('Are you sure you want to save the current prompt as your custom default?\n\nThis will replace any previous custom default. When you click "Reset to Default", it will restore to this version instead of the original code default.')) return
    if (!confirm('Double confirmation: Save current prompt as default? This action will be permanent.')) return
    setSaving(key)
    setMessage('')
    try {
      const response = await fetch('/api/settings/ai-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, action: 'save_as_default' })
      })
      if (response.ok) {
        showMessage('\u2713 Current prompt saved as your custom default!')
        await loadPrompts()
      } else {
        throw new Error('Failed to save as default')
      }
    } catch (error) {
      showMessage('Error: Failed to save as default', 5000)
    } finally {
      setSaving(null)
    }
  }

  const handleTestPrompt = async (key: string) => {
    const prompt = prompts.find(p => p.key === key)
    const expectedOutputs = prompt?.expected_outputs || null

    let testType = PROMPT_TYPE_MAP[key]
    if (!testType && (key.startsWith('ai_prompt_criteria_') || key.startsWith('ai_prompt_secondary_criteria_'))) {
      testType = 'contentEvaluator'
    }
    if (!testType) {
      alert('Test not available for this prompt type')
      return
    }

    let rssPostId = selectedPrimaryRssPost
    if (key.startsWith('ai_prompt_secondary_')) {
      rssPostId = selectedSecondaryRssPost
    }

    setTestModalOpen(true)
    setTestLoading(true)
    setTestError(null)
    setTestResults(null)

    try {
      let testUrl = `/api/debug/test-ai-prompts?type=${testType}&promptKey=${key}`
      if (rssPostId) testUrl += `&rssPostId=${rssPostId}`
      if (newsletterSlug) testUrl += `&publicationId=${newsletterSlug}`

      if (editingPrompt?.key === key && editingPrompt?.value) {
        testUrl += `&promptContent=${encodeURIComponent(editingPrompt.value)}`
        const detectedProvider = detectProviderFromPrompt(editingPrompt.value)
        testUrl += `&provider=${detectedProvider}`
      }

      const response = await fetch(testUrl)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Test failed')

      if (expectedOutputs && data.results) {
        data.parsedOutputs = parseResponseOutputs(data.results, expectedOutputs)
      }
      setTestResults(data)
    } catch (error: any) {
      setTestError(error.message || 'Failed to run test')
    } finally {
      setTestLoading(false)
    }
  }

  // --- Weight handlers ---

  const handleWeightEdit = (prompt: any) => {
    setEditingWeight({ key: prompt.key, value: prompt.weight || '1.0' })
  }

  const handleWeightCancel = () => {
    setEditingWeight(null)
  }

  const handleWeightSave = async (key: string) => {
    if (!editingWeight || editingWeight.key !== key || !newsletterSlug) return

    const secondaryMatch = key.match(/ai_prompt_secondary_criteria_(\d+)/)
    const primaryMatch = key.match(/ai_prompt_criteria_(\d+)/)
    const isSecondary = !!secondaryMatch
    const criteriaNumber = isSecondary ? secondaryMatch[1] : primaryMatch?.[1]
    if (!criteriaNumber) return

    setSaving(key)
    setMessage('')
    try {
      const response = await fetch('/api/settings/criteria-weights', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          criteriaNumber,
          weight: parseFloat(editingWeight.value),
          type: isSecondary ? 'secondary' : 'primary',
          newsletterSlug
        })
      })
      if (response.ok) {
        showMessage('Weight updated successfully!')
        setEditingWeight(null)
        await loadPrompts()
        await loadCriteria()
      } else {
        throw new Error('Failed to update weight')
      }
    } catch (error) {
      showMessage('Error: Failed to update weight', 5000)
    } finally {
      setSaving(null)
    }
  }

  // --- Criteria name handlers ---

  const handleCriteriaNameSave = async (criteriaNumber: number, isSecondary: boolean) => {
    const editingName = isSecondary ? editingSecondaryName : editingPrimaryName
    if (!editingName || editingName.number !== criteriaNumber || !newsletterSlug) return

    setSaving(`criteria_${criteriaNumber}_name`)
    setMessage('')
    try {
      const response = await fetch('/api/settings/criteria', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_name',
          criteriaNumber,
          name: editingName.value,
          isSecondary,
          newsletterSlug
        })
      })
      if (response.ok) {
        showMessage('Criteria name updated successfully!')
        if (isSecondary) setEditingSecondaryName(null)
        else setEditingPrimaryName(null)
        await loadCriteria()
        await loadPrompts()
      } else {
        throw new Error('Failed to update name')
      }
    } catch (error) {
      showMessage('Error: Failed to update criteria name', 5000)
    } finally {
      setSaving(null)
    }
  }

  // --- Criteria count handlers ---

  const handleChangeCriteriaCount = async (isSecondary: boolean, delta: number) => {
    if (!newsletterSlug) return
    const currentCount = isSecondary ? secondaryEnabledCount : primaryEnabledCount
    const newCount = currentCount + delta
    const type = isSecondary ? 'secondary' : 'primary'

    if (newCount > 5) {
      showMessage(`Maximum of 5 ${type} criteria reached`)
      return
    }
    if (newCount < 1) {
      showMessage(`At least 1 ${type} criteria must remain enabled`)
      return
    }
    if (delta < 0 && !confirm(`Remove ${type} criteria ${currentCount}? This will disable it from scoring.`)) return

    const savingKey = delta > 0 ? `add_${type}_criteria` : `remove_${type}_criteria`
    setSaving(savingKey)
    setMessage('')
    try {
      const response = await fetch('/api/settings/criteria', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_enabled_count',
          enabledCount: newCount,
          isSecondary,
          newsletterSlug
        })
      })
      if (response.ok) {
        showMessage(delta > 0 ? `Enabled ${newCount} ${type} criteria` : `Reduced to ${newCount} ${type} criteria`)
        await loadCriteria()
        await loadPrompts()
      } else {
        throw new Error(`Failed to ${delta > 0 ? 'add' : 'remove'} ${type} criteria`)
      }
    } catch (error) {
      showMessage(`Error: Failed to ${delta > 0 ? 'add' : 'remove'} ${type} criteria`, 5000)
    } finally {
      setSaving(null)
    }
  }

  // --- Derived state ---

  const criteriaPrompts = prompts.filter(p => p.key.startsWith('ai_prompt_criteria_') && !p.key.startsWith('ai_prompt_secondary_'))
  const secondaryCriteriaPrompts = prompts.filter(p => p.key.startsWith('ai_prompt_secondary_criteria_'))

  const primaryTitlePrompt = prompts.find(p => p.key === 'ai_prompt_primary_article_title')
  const primaryBodyPrompt = prompts.find(p => p.key === 'ai_prompt_primary_article_body')
  const secondaryTitlePrompt = prompts.find(p => p.key === 'ai_prompt_secondary_article_title')
  const secondaryBodyPrompt = prompts.find(p => p.key === 'ai_prompt_secondary_article_body')

  const otherPrompts = prompts.filter(p =>
    !p.key.startsWith('ai_prompt_criteria_') &&
    !p.key.startsWith('ai_prompt_secondary_criteria_') &&
    !p.key.startsWith('ai_prompt_secondary_') &&
    p.key !== 'ai_prompt_primary_article_title' &&
    p.key !== 'ai_prompt_primary_article_body' &&
    p.key !== 'ai_prompt_article_writer' &&
    p.key !== 'ai_prompt_content_evaluator'
  )

  const secondaryOtherPrompts = prompts.filter(p =>
    p.key.startsWith('ai_prompt_secondary_') &&
    !p.key.startsWith('ai_prompt_secondary_criteria_') &&
    p.key !== 'ai_prompt_secondary_article_title' &&
    p.key !== 'ai_prompt_secondary_article_body' &&
    p.key !== 'ai_prompt_secondary_article_writer' &&
    p.key !== 'ai_prompt_secondary_content_evaluator'
  )

  type PromptType = typeof prompts[0]
  const otherGrouped = otherPrompts.reduce((acc, prompt) => {
    if (!acc[prompt.category]) acc[prompt.category] = []
    acc[prompt.category].push(prompt)
    return acc
  }, {} as Record<string, PromptType[]>)

  return {
    // State
    loading,
    saving,
    message,
    prettyPrint,
    setPrettyPrint,
    expandedPrompt,
    setExpandedPrompt,
    editingPrompt,
    setEditingPrompt,
    editingWeight,
    setEditingWeight,
    editingPrimaryName,
    setEditingPrimaryName,
    editingSecondaryName,
    setEditingSecondaryName,
    newsletterSlug,

    // Criteria
    primaryCriteria,
    secondaryCriteria,
    primaryEnabledCount,
    secondaryEnabledCount,
    criteriaPrompts,
    secondaryCriteriaPrompts,

    // Prompts
    primaryTitlePrompt,
    primaryBodyPrompt,
    secondaryTitlePrompt,
    secondaryBodyPrompt,
    secondaryOtherPrompts,
    otherGrouped,

    // RSS posts for testing
    primaryRssPosts,
    selectedPrimaryRssPost,
    setSelectedPrimaryRssPost,
    loadingPrimaryRssPosts,
    secondaryRssPosts,
    selectedSecondaryRssPost,
    setSelectedSecondaryRssPost,
    loadingSecondaryRssPosts,

    // Test modal
    testModalOpen,
    setTestModalOpen,
    testLoading,
    testResults,
    testError,

    // Handlers
    handleEdit,
    handleCancel,
    handleSave,
    handleReset,
    handleSaveAsDefault,
    handleTestPrompt,
    handleWeightEdit,
    handleWeightCancel,
    handleWeightSave,
    handleCriteriaNameSave,
    handleChangeCriteriaCount,
  }
}
