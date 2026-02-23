'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function AIPromptsSettings() {
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
  const [rssPosts, setRssPosts] = useState<any[]>([])
  const [selectedRssPost, setSelectedRssPost] = useState<string>('')
  const [loadingRssPosts, setLoadingRssPosts] = useState(false)
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

  // Get newsletter slug from pathname
  const pathname = usePathname()
  const newsletterSlug = pathname ? pathname.match(/^\/dashboard\/([^\/]+)/)?.[1] : null

  useEffect(() => {
    loadPrompts()
    loadCriteria()
    loadRssPosts()
    loadPrimaryRssPosts()
    loadSecondaryRssPosts()
  }, [])

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

  const loadRssPosts = async () => {
    setLoadingRssPosts(true)
    try {
      const response = await fetch('/api/rss-posts/recent?limit=50')
      if (response.ok) {
        const data = await response.json()
        setRssPosts(data.posts || [])
        // Select first post by default if available
        if (data.posts && data.posts.length > 0) {
          setSelectedRssPost(data.posts[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to load RSS posts:', error)
    } finally {
      setLoadingRssPosts(false)
    }
  }

  const loadPrimaryRssPosts = async () => {
    setLoadingPrimaryRssPosts(true)
    try {
      const response = await fetch('/api/rss-posts/recent?limit=50&section=primary')
      if (response.ok) {
        const data = await response.json()
        setPrimaryRssPosts(data.posts || [])
        // Select first post by default if available
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
        // Select first post by default if available
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

  // Helper function to detect AI provider from prompt value (auto-detect from model name)
  const detectProviderFromPrompt = (value: any): 'openai' | 'claude' => {
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value
      const model = (parsed?.model || '').toLowerCase()
      if (model.includes('claude') || model.includes('sonnet') || model.includes('opus') || model.includes('haiku')) {
        return 'claude'
      }
    } catch (e) {
      // Not valid JSON, default to openai
    }
    return 'openai'
  }

  // Helper function to format JSON with actual newlines
  const formatJSON = (value: any, prettyPrint: boolean): string => {
    // If value is a string, try to parse it as JSON first
    if (typeof value === 'string') {
      try {
        // Try to parse as JSON
        const parsed = JSON.parse(value)
        // If successful, format the parsed object
        const jsonStr = prettyPrint ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed)
        if (prettyPrint) {
          return jsonStr.replace(/\\n/g, '\n')
        }
        return jsonStr
      } catch (e) {
        // Not valid JSON, treat as plain string
        if (prettyPrint) {
          return value.replace(/\\n/g, '\n')
        }
        return value
      }
    }

    // Handle object values (already parsed JSON)
    if (typeof value === 'object' && value !== null) {
      const jsonStr = prettyPrint ? JSON.stringify(value, null, 2) : JSON.stringify(value)
      if (prettyPrint) {
        return jsonStr.replace(/\\n/g, '\n')
      }
      return jsonStr
    }

    return String(value)
  }

  const handleEdit = (prompt: any) => {
    let valueStr: string
    if (typeof prompt.value === 'object') {
      valueStr = JSON.stringify(prompt.value, null, 2)
    } else if (typeof prompt.value === 'string') {
      // Try to parse as JSON to pretty-print it
      try {
        const parsed = JSON.parse(prompt.value)
        valueStr = JSON.stringify(parsed, null, 2)
      } catch (e) {
        // Not JSON, use as-is
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
        body: JSON.stringify({
          key: editingPrompt.key,
          value: editingPrompt.value
        })
      })

      if (response.ok) {
        setMessage('Prompt saved successfully!')
        setEditingPrompt(null)
        await loadPrompts()
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to save prompt')
      }
    } catch (error) {
      setMessage('Error: Failed to save prompt')
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setSaving(null)
    }
  }

  const handleReset = async (key: string) => {
    if (!confirm('Are you sure you want to reset this prompt to its default value? This cannot be undone.')) {
      return
    }

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
        const message = data.used_custom_default
          ? 'Prompt reset to your custom default!'
          : 'Prompt reset to original code default!'
        setMessage(message)
        await loadPrompts()
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to reset prompt')
      }
    } catch (error) {
      setMessage('Error: Failed to reset prompt')
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setSaving(null)
    }
  }

  const handleSaveAsDefault = async (key: string) => {
    if (!confirm('Are you sure you want to save the current prompt as your custom default?\n\nThis will replace any previous custom default. When you click "Reset to Default", it will restore to this version instead of the original code default.')) {
      return
    }

    if (!confirm('Double confirmation: Save current prompt as default? This action will be permanent.')) {
      return
    }

    setSaving(key)
    setMessage('')

    try {
      const response = await fetch('/api/settings/ai-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, action: 'save_as_default' })
      })

      if (response.ok) {
        setMessage('\u2713 Current prompt saved as your custom default!')
        await loadPrompts()
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to save as default')
      }
    } catch (error) {
      setMessage('Error: Failed to save as default')
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setSaving(null)
    }
  }

  const handleTestPrompt = async (key: string) => {
    // Get the prompt's expected outputs
    const prompt = prompts.find(p => p.key === key)
    const expectedOutputs = prompt?.expected_outputs || null

    // Map prompt keys to their test endpoint type parameter
    const promptTypeMap: Record<string, string> = {
      'ai_prompt_content_evaluator': 'contentEvaluator',
      'ai_prompt_newsletter_writer': 'newsletterWriter',
      'ai_prompt_subject_line': 'subjectLineGenerator',
      'ai_prompt_event_summary': 'eventSummarizer',
      'ai_prompt_road_work': 'roadWorkGenerator',
      'ai_prompt_image_analyzer': 'imageAnalyzer',
      'ai_prompt_primary_article_title': 'primaryArticleTitle',
      'ai_prompt_primary_article_body': 'primaryArticleBody',
      'ai_prompt_secondary_article_title': 'secondaryArticleTitle',
      'ai_prompt_secondary_article_body': 'secondaryArticleBody',
      'ai_prompt_fact_checker': 'factChecker',
      'ai_prompt_welcome_section': 'welcomeSection',
      'ai_prompt_topic_deduper': 'topicDeduper'
    }

    let testType = promptTypeMap[key]

    // Handle criteria prompts (ai_prompt_criteria_1, ai_prompt_criteria_2, etc.)
    if (!testType && (key.startsWith('ai_prompt_criteria_') || key.startsWith('ai_prompt_secondary_criteria_'))) {
      testType = 'contentEvaluator'
    }

    if (!testType) {
      alert('Test not available for this prompt type')
      return
    }

    // Determine which RSS post to use based on prompt type
    let rssPostId = selectedPrimaryRssPost // Default to primary for general prompts

    if (key.startsWith('ai_prompt_secondary_')) {
      // Use secondary RSS post for secondary prompts and secondary criteria
      rssPostId = selectedSecondaryRssPost
    }
    // Primary, criteria, subject line, newsletter writer, content evaluator, etc. all use primary RSS post

    // Open modal and fetch results
    setTestModalOpen(true)
    setTestLoading(true)
    setTestError(null)
    setTestResults(null)

    try {
      let testUrl = `/api/debug/test-ai-prompts?type=${testType}&promptKey=${key}`
      if (rssPostId) {
        testUrl += `&rssPostId=${rssPostId}`
      }
      if (newsletterSlug) {
        testUrl += `&publicationId=${newsletterSlug}`
      }

      // If currently editing this prompt, use the current content from the text box
      if (editingPrompt?.key === key && editingPrompt?.value) {
        testUrl += `&promptContent=${encodeURIComponent(editingPrompt.value)}`
        // Auto-detect provider from the model in the prompt JSON
        const detectedProvider = detectProviderFromPrompt(editingPrompt.value)
        testUrl += `&provider=${detectedProvider}`
      }

      const response = await fetch(testUrl)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Test failed')
      }

      // Parse response against expected outputs
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

  // Helper function to parse AI response against expected outputs
  const parseResponseOutputs = (results: any, expectedOutputs: any): any => {
    const parsed: any = {}

    for (const [fieldName, fieldType] of Object.entries(expectedOutputs)) {
      try {
        // Get the response (could be in various formats)
        let responseText = ''
        if (results && typeof results === 'object') {
          const firstResult = Object.values(results)[0] as any
          if (firstResult?.response) {
            // Check if response has a 'raw' property (common for OpenAI responses)
            if (typeof firstResult.response === 'object' && firstResult.response.raw) {
              responseText = firstResult.response.raw
            } else if (typeof firstResult.response === 'string') {
              responseText = firstResult.response
            } else {
              responseText = JSON.stringify(firstResult.response)
            }
          }
        }

        // Try JSON parsing first
        try {
          const jsonResponse = JSON.parse(responseText)
          if (fieldName in jsonResponse) {
            parsed[fieldName] = { value: jsonResponse[fieldName], error: false }
            continue
          }
        } catch (e) {
          // Not JSON, continue to regex parsing
        }

        // Fallback to regex parsing
        const patterns = [
          new RegExp(`"${fieldName}"\\s*:\\s*([^,}]+)`, 'i'),
          new RegExp(`${fieldName}\\s*:\\s*(.+?)(?:\\n|$)`, 'i'),
          new RegExp(`${fieldName}\\s*=\\s*(.+?)(?:\\n|$)`, 'i')
        ]

        let found = false
        for (const pattern of patterns) {
          const match = responseText.match(pattern)
          if (match && match[1]) {
            parsed[fieldName] = { value: match[1].trim().replace(/^["']|["']$/g, ''), error: false }
            found = true
            break
          }
        }

        if (!found) {
          parsed[fieldName] = { value: null, error: true }
        }
      } catch (e) {
        parsed[fieldName] = { value: null, error: true }
      }
    }

    return parsed
  }

  const handleWeightEdit = (prompt: any) => {
    setEditingWeight({ key: prompt.key, value: prompt.weight || '1.0' })
  }

  const handleWeightCancel = () => {
    setEditingWeight(null)
  }

  const handleWeightSave = async (key: string) => {
    if (!editingWeight || editingWeight.key !== key || !newsletterSlug) return

    // Match both primary and secondary criteria and extract type
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
        setMessage('Weight updated successfully!')
        setEditingWeight(null)
        await loadPrompts()
        await loadCriteria()
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to update weight')
      }
    } catch (error) {
      setMessage('Error: Failed to update weight')
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setSaving(null)
    }
  }

  // Primary criteria name handlers
  const handlePrimaryNameEdit = (criteriaNumber: number, currentName: string) => {
    setEditingPrimaryName({ number: criteriaNumber, value: currentName })
  }

  const handlePrimaryNameCancel = () => {
    setEditingPrimaryName(null)
  }

  const handlePrimaryNameSave = async (criteriaNumber: number) => {
    if (!editingPrimaryName || editingPrimaryName.number !== criteriaNumber || !newsletterSlug) return

    setSaving(`criteria_${criteriaNumber}_name`)
    setMessage('')

    try {
      const response = await fetch('/api/settings/criteria', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_name',
          criteriaNumber,
          name: editingPrimaryName.value,
          isSecondary: false,
          newsletterSlug
        })
      })

      if (response.ok) {
        setMessage('Criteria name updated successfully!')
        setEditingPrimaryName(null)
        await loadCriteria()
        await loadPrompts()
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to update name')
      }
    } catch (error) {
      setMessage('Error: Failed to update criteria name')
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setSaving(null)
    }
  }

  // Secondary criteria name handlers
  const handleSecondaryNameEdit = (criteriaNumber: number, currentName: string) => {
    setEditingSecondaryName({ number: criteriaNumber, value: currentName })
  }

  const handleSecondaryNameCancel = () => {
    setEditingSecondaryName(null)
  }

  const handleSecondaryNameSave = async (criteriaNumber: number) => {
    if (!editingSecondaryName || editingSecondaryName.number !== criteriaNumber || !newsletterSlug) return

    setSaving(`criteria_${criteriaNumber}_name`)
    setMessage('')

    try {
      const response = await fetch('/api/settings/criteria', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_name',
          criteriaNumber,
          name: editingSecondaryName.value,
          isSecondary: true,
          newsletterSlug
        })
      })

      if (response.ok) {
        setMessage('Criteria name updated successfully!')
        setEditingSecondaryName(null)
        await loadCriteria()
        await loadPrompts()
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to update name')
      }
    } catch (error) {
      setMessage('Error: Failed to update criteria name')
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setSaving(null)
    }
  }

  const handleAddPrimaryCriteria = async () => {
    if (!newsletterSlug) return

    if (primaryEnabledCount >= 5) {
      setMessage('Maximum of 5 primary criteria reached')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setSaving('add_primary_criteria')
    setMessage('')

    try {
      const response = await fetch('/api/settings/criteria', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_enabled_count',
          enabledCount: primaryEnabledCount + 1,
          isSecondary: false,
          newsletterSlug
        })
      })

      if (response.ok) {
        setMessage(`Enabled ${primaryEnabledCount + 1} primary criteria`)
        await loadCriteria()
        await loadPrompts()
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to add primary criteria')
      }
    } catch (error) {
      setMessage('Error: Failed to add primary criteria')
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setSaving(null)
    }
  }

  const handleRemovePrimaryCriteria = async () => {
    if (!newsletterSlug) return

    if (primaryEnabledCount <= 1) {
      setMessage('At least 1 primary criteria must remain enabled')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    if (!confirm(`Remove primary criteria ${primaryEnabledCount}? This will disable it from scoring.`)) {
      return
    }

    setSaving('remove_primary_criteria')
    setMessage('')

    try {
      const response = await fetch('/api/settings/criteria', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_enabled_count',
          enabledCount: primaryEnabledCount - 1,
          isSecondary: false,
          newsletterSlug
        })
      })

      if (response.ok) {
        setMessage(`Reduced to ${primaryEnabledCount - 1} primary criteria`)
        await loadCriteria()
        await loadPrompts()
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to remove primary criteria')
      }
    } catch (error) {
      setMessage('Error: Failed to remove primary criteria')
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setSaving(null)
    }
  }

  const handleAddSecondaryCriteria = async () => {
    if (!newsletterSlug) return

    if (secondaryEnabledCount >= 5) {
      setMessage('Maximum of 5 secondary criteria reached')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    setSaving('add_secondary_criteria')
    setMessage('')

    try {
      const response = await fetch('/api/settings/criteria', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_enabled_count',
          enabledCount: secondaryEnabledCount + 1,
          isSecondary: true,
          newsletterSlug
        })
      })

      if (response.ok) {
        setMessage(`Enabled ${secondaryEnabledCount + 1} secondary criteria`)
        await loadCriteria()
        await loadPrompts()
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to add secondary criteria')
      }
    } catch (error) {
      setMessage('Error: Failed to add secondary criteria')
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setSaving(null)
    }
  }

  const handleRemoveSecondaryCriteria = async () => {
    if (!newsletterSlug) return

    if (secondaryEnabledCount <= 1) {
      setMessage('At least 1 secondary criteria must remain enabled')
      setTimeout(() => setMessage(''), 3000)
      return
    }

    if (!confirm(`Remove secondary criteria ${secondaryEnabledCount}? This will disable it from scoring.`)) {
      return
    }

    setSaving('remove_secondary_criteria')
    setMessage('')

    try {
      const response = await fetch('/api/settings/criteria', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_enabled_count',
          enabledCount: secondaryEnabledCount - 1,
          isSecondary: true,
          newsletterSlug
        })
      })

      if (response.ok) {
        setMessage(`Reduced to ${secondaryEnabledCount - 1} secondary criteria`)
        await loadCriteria()
        await loadPrompts()
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to remove secondary criteria')
      }
    } catch (error) {
      setMessage('Error: Failed to remove secondary criteria')
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    )
  }

  // Filter criteria prompts from other prompts
  const criteriaPrompts = prompts.filter(p => p.key.startsWith('ai_prompt_criteria_') && !p.key.startsWith('ai_prompt_secondary_'))
  const secondaryCriteriaPrompts = prompts.filter(p => p.key.startsWith('ai_prompt_secondary_criteria_'))

  // Filter primary article title/body prompts
  const primaryTitlePrompt = prompts.find(p => p.key === 'ai_prompt_primary_article_title')
  const primaryBodyPrompt = prompts.find(p => p.key === 'ai_prompt_primary_article_body')

  // Filter secondary article title/body prompts
  const secondaryTitlePrompt = prompts.find(p => p.key === 'ai_prompt_secondary_article_title')
  const secondaryBodyPrompt = prompts.find(p => p.key === 'ai_prompt_secondary_article_body')

  const otherPrompts = prompts.filter(p =>
    !p.key.startsWith('ai_prompt_criteria_') &&
    !p.key.startsWith('ai_prompt_secondary_criteria_') &&
    !p.key.startsWith('ai_prompt_secondary_') &&
    p.key !== 'ai_prompt_primary_article_title' &&
    p.key !== 'ai_prompt_primary_article_body' &&
    p.key !== 'ai_prompt_article_writer' && // Deprecated: replaced by title/body prompts
    p.key !== 'ai_prompt_content_evaluator' // Deprecated: replaced by criteria-based scoring
  )
  const secondaryOtherPrompts = prompts.filter(p =>
    p.key.startsWith('ai_prompt_secondary_') &&
    !p.key.startsWith('ai_prompt_secondary_criteria_') &&
    p.key !== 'ai_prompt_secondary_article_title' &&
    p.key !== 'ai_prompt_secondary_article_body' &&
    p.key !== 'ai_prompt_secondary_article_writer' && // Deprecated: replaced by title/body prompts
    p.key !== 'ai_prompt_secondary_content_evaluator' // Deprecated: replaced by criteria-based scoring
  )

  type PromptType = typeof prompts[0]
  const otherGrouped = otherPrompts.reduce((acc, prompt) => {
    if (!acc[prompt.category]) {
      acc[prompt.category] = []
    }
    acc[prompt.category].push(prompt)
    return acc
  }, {} as Record<string, PromptType[]>)

  // Helper function to render a single prompt card
  const renderPromptCard = (prompt: any) => {
    const isExpanded = expandedPrompt === prompt.key
    const isEditing = editingPrompt?.key === prompt.key
    const isSaving = saving === prompt.key

    return (
      <div key={prompt.key} className="p-6">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-base font-medium text-gray-900">{prompt.name}</h4>
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                detectProviderFromPrompt(isEditing ? editingPrompt?.value : prompt.value) === 'claude'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {detectProviderFromPrompt(isEditing ? editingPrompt?.value : prompt.value) === 'claude' ? 'Claude' : 'OpenAI'}
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1">{prompt.description}</p>
          </div>
          <button
            onClick={() => setExpandedPrompt(isExpanded ? null : prompt.key)}
            className="ml-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            {isExpanded ? 'Collapse' : 'View/Edit'}
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
                  : typeof prompt.value === 'object'
                    ? JSON.stringify(prompt.value).length
                    : prompt.value.length} characters
              </span>
            </div>
            {isEditing ? (
              <>
                <textarea
                  value={editingPrompt?.value || ''}
                  onChange={(e) => editingPrompt && setEditingPrompt({ ...editingPrompt, value: e.target.value })}
                  rows={15}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-2 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                  <span className="font-medium">Expected Response:</span>{' '}
                  <code className="bg-amber-100 px-1 rounded">
                    {prompt.key.includes('_title')
                      ? 'Plain text OR { "headline": "<text>" }'
                      : '{ "content": "<text>", "word_count": <integer> }'}
                  </code>
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <button
                    onClick={() => handleTestPrompt(prompt.key)}
                    className="px-4 py-2 text-sm font-medium text-purple-700 bg-white border border-purple-300 rounded-md hover:bg-purple-50"
                  >
                    Test Prompt
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
                      onClick={() => handleSave(prompt.key)}
                      disabled={isSaving}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="mb-2 flex items-center">
                  <label className="flex items-center text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prettyPrint}
                      onChange={(e) => setPrettyPrint(e.target.checked)}
                      className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    Pretty-print
                  </label>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4 font-mono text-xs whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                  {formatJSON(prompt.value, prettyPrint)}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => handleReset(prompt.key)}
                      disabled={saving === prompt.key}
                      className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                    >
                      {saving === prompt.key ? 'Resetting...' : 'Reset to Default'}
                    </button>
                    <button
                      onClick={() => handleSaveAsDefault(prompt.key)}
                      disabled={saving === prompt.key}
                      className="px-4 py-2 text-sm font-medium text-green-700 bg-white border border-green-300 rounded-md hover:bg-green-50 disabled:opacity-50"
                    >
                      {saving === prompt.key ? 'Saving...' : 'Save as Default'}
                    </button>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => handleEdit(prompt)}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">AI Prompts</h2>
        <p className="text-sm text-gray-600">
          Customize the AI prompts used throughout the newsletter system. Changes take effect immediately.
          Use <code className="bg-gray-100 px-1 rounded text-xs">{'{{}}'}</code> placeholders for dynamic content.
        </p>

        {message && (
          <div className={`mt-4 p-3 rounded ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {message}
          </div>
        )}
      </div>

      {/* Primary Evaluation Criteria Section */}
      <div className="bg-white shadow rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Primary Article Prompts</h3>
              <p className="text-sm text-gray-600 mt-1">
                Configure evaluation criteria and content generation for primary (top) articles. Includes Article Title and Article Body prompts. {primaryEnabledCount} of 5 criteria enabled.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleAddPrimaryCriteria}
                disabled={primaryEnabledCount >= 5 || saving === 'add_primary_criteria'}
                className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving === 'add_primary_criteria' ? 'Adding...' : 'Add Criteria'}
              </button>
              <button
                onClick={handleRemovePrimaryCriteria}
                disabled={primaryEnabledCount <= 1 || saving === 'remove_primary_criteria'}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving === 'remove_primary_criteria' ? 'Removing...' : 'Remove Criteria'}
              </button>
            </div>
          </div>
          {/* RSS Post Selector for Testing */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              RSS Post for Testing Primary Prompts
            </label>
            <select
              value={selectedPrimaryRssPost}
              onChange={(e) => setSelectedPrimaryRssPost(e.target.value)}
              disabled={loadingPrimaryRssPosts}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              {loadingPrimaryRssPosts ? (
                <option>Loading posts...</option>
              ) : primaryRssPosts.length === 0 ? (
                <option>No primary RSS posts available</option>
              ) : (
                primaryRssPosts.map((post) => (
                  <option key={post.id} value={post.id}>
                    {post.title} {post.rss_feed?.name ? `(${post.rss_feed.name})` : ''} - {new Date(post.processed_at).toLocaleDateString()}
                  </option>
                ))
              )}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Only showing posts from feeds assigned to Primary section
            </p>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {primaryCriteria.filter(c => c.enabled).map((criterion) => {
            const promptKey = `ai_prompt_criteria_${criterion.number}`
            const prompt = criteriaPrompts.find(p => p.key === promptKey)
            const isExpanded = expandedPrompt === promptKey
            const isEditing = editingPrompt?.key === promptKey
            const isSaving = saving === promptKey
            const isEditingWeight = editingWeight?.key === promptKey
            const isEditingCriteriaName = editingPrimaryName?.number === criterion.number

            return (
              <div key={criterion.number} className="p-6">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    {/* Criteria Name */}
                    <div className="flex items-center space-x-2 mb-2">
                      <label className="text-xs font-medium text-gray-500 uppercase">Criteria Name:</label>
                      {isEditingCriteriaName ? (
                        <>
                          <input
                            type="text"
                            value={editingPrimaryName?.value || ''}
                            onChange={(e) => setEditingPrimaryName({ number: criterion.number, value: e.target.value })}
                            className="px-2 py-1 border border-gray-300 rounded text-sm flex-1 max-w-xs"
                            placeholder="Enter criteria name"
                          />
                          <button
                            onClick={() => handlePrimaryNameSave(criterion.number)}
                            disabled={saving === `criteria_${criterion.number}_name`}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {saving === `criteria_${criterion.number}_name` ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={handlePrimaryNameCancel}
                            disabled={saving === `criteria_${criterion.number}_name`}
                            className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <h4 className="text-base font-medium text-gray-900">{criterion.name}</h4>
                          {!isEditing && prompt && (
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                              detectProviderFromPrompt(prompt.value) === 'claude'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {detectProviderFromPrompt(prompt.value) === 'claude' ? 'Claude' : 'OpenAI'}
                            </span>
                          )}
                          <button
                            onClick={() => handlePrimaryNameEdit(criterion.number, criterion.name)}
                            className="text-xs text-blue-600 hover:text-blue-800"
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
                            onChange={(e) => setEditingWeight({ key: promptKey, value: e.target.value })}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <button
                            onClick={() => handleWeightSave(promptKey)}
                            disabled={isSaving}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {isSaving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={handleWeightCancel}
                            disabled={isSaving}
                            className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-semibold text-brand-primary">{criterion.weight}</span>
                          <button
                            onClick={() => handleWeightEdit({ key: promptKey, weight: criterion.weight.toString() })}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Edit
                          </button>
                          <span className="text-xs text-gray-500">
                            (Max final score contribution: {(criterion.weight * 10).toFixed(1)} points)
                          </span>
                        </>
                      )}
                    </div>

                    {prompt && (
                      <p className="text-sm text-gray-600 mt-2">{prompt.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setExpandedPrompt(isExpanded ? null : promptKey)}
                    className="ml-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    {isExpanded ? 'Collapse' : 'View/Edit Prompt'}
                  </button>
                </div>

                {isExpanded && prompt && (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700">
                        Prompt Content
                      </label>
                      <span className="text-xs text-gray-500">
                        {isEditing
                          ? editingPrompt?.value.length || 0
                          : typeof prompt.value === 'object'
                            ? JSON.stringify(prompt.value).length
                            : prompt.value.length} characters
                      </span>
                    </div>
                    {isEditing ? (
                      <>
                        <textarea
                          value={editingPrompt?.value || ''}
                          onChange={(e) => editingPrompt && setEditingPrompt({ ...editingPrompt, value: e.target.value })}
                          rows={15}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="mt-2 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                          <span className="font-medium">Expected Response:</span>{' '}
                          <code className="bg-amber-100 px-1 rounded">{'{ "score": <0-10>, "reason": "<explanation>" }'}</code>
                        </p>
                        <div className="mt-3 flex items-center justify-between">
                          <button
                            onClick={() => handleTestPrompt(promptKey)}
                            className="px-4 py-2 text-sm font-medium text-purple-700 bg-white border border-purple-300 rounded-md hover:bg-purple-50"
                          >
                            Test Prompt
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
                              onClick={() => handleSave(promptKey)}
                              disabled={isSaving}
                              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                            >
                              {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mb-2 flex items-center">
                          <label className="flex items-center text-sm text-gray-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={prettyPrint}
                              onChange={(e) => setPrettyPrint(e.target.checked)}
                              className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            Pretty-print
                          </label>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-md p-4 font-mono text-xs whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                          {formatJSON(prompt.value, prettyPrint)}
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => handleReset(promptKey)}
                              disabled={saving === promptKey}
                              className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                            >
                              {saving === promptKey ? 'Resetting...' : 'Reset to Default'}
                            </button>
                            <button
                              onClick={() => handleSaveAsDefault(promptKey)}
                              disabled={saving === promptKey}
                              className="px-4 py-2 text-sm font-medium text-green-700 bg-white border border-green-300 rounded-md hover:bg-green-50 disabled:opacity-50"
                            >
                              {saving === promptKey ? 'Saving...' : 'Save as Default'}
                            </button>
                          </div>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => handleEdit(prompt)}
                              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
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

          {/* Primary Article Title Prompt */}
          {primaryTitlePrompt && renderPromptCard(primaryTitlePrompt)}

          {/* Primary Article Body Prompt */}
          {primaryBodyPrompt && renderPromptCard(primaryBodyPrompt)}
        </div>
      </div>

      {/* Secondary Article Prompts Section */}
      <div className="bg-white shadow rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">Secondary Article Prompts</h3>
              <p className="text-sm text-gray-600 mt-1">
                Configure evaluation criteria and content generation for secondary (bottom) articles. Includes Article Title and Article Body prompts. {secondaryEnabledCount} of 5 criteria enabled.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleAddSecondaryCriteria}
                disabled={secondaryEnabledCount >= 5 || saving === 'add_secondary_criteria'}
                className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving === 'add_secondary_criteria' ? 'Adding...' : 'Add Criteria'}
              </button>
              <button
                onClick={handleRemoveSecondaryCriteria}
                disabled={secondaryEnabledCount <= 1 || saving === 'remove_secondary_criteria'}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving === 'remove_secondary_criteria' ? 'Removing...' : 'Remove Criteria'}
              </button>
            </div>
          </div>
          {/* RSS Post Selector for Testing */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              RSS Post for Testing Secondary Prompts
            </label>
            <select
              value={selectedSecondaryRssPost}
              onChange={(e) => setSelectedSecondaryRssPost(e.target.value)}
              disabled={loadingSecondaryRssPosts}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              {loadingSecondaryRssPosts ? (
                <option>Loading posts...</option>
              ) : secondaryRssPosts.length === 0 ? (
                <option>No secondary RSS posts available</option>
              ) : (
                secondaryRssPosts.map((post) => (
                  <option key={post.id} value={post.id}>
                    {post.title} {post.rss_feed?.name ? `(${post.rss_feed.name})` : ''} - {new Date(post.processed_at).toLocaleDateString()}
                  </option>
                ))
              )}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Only showing posts from feeds assigned to Secondary section
            </p>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {secondaryCriteria.filter(c => c.enabled).map((criterion) => {
            const promptKey = `ai_prompt_secondary_criteria_${criterion.number}`
            const prompt = secondaryCriteriaPrompts.find(p => p.key === promptKey)
            const isExpanded = expandedPrompt === promptKey
            const isEditing = editingPrompt?.key === promptKey
            const isSaving = saving === promptKey
            const isEditingWeight = editingWeight?.key === promptKey
            const isEditingCriteriaName = editingSecondaryName?.number === criterion.number

            if (!prompt) return null

            return (
              <div key={criterion.number} className="p-6">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    {/* Criteria Name */}
                    <div className="flex items-center space-x-2 mb-2">
                      <label className="text-xs font-medium text-gray-500 uppercase">Criteria Name:</label>
                      {isEditingCriteriaName ? (
                        <>
                          <input
                            type="text"
                            value={editingSecondaryName?.value || ''}
                            onChange={(e) => setEditingSecondaryName({ number: criterion.number, value: e.target.value })}
                            className="px-2 py-1 border border-gray-300 rounded text-sm flex-1 max-w-xs"
                            placeholder="Enter criteria name"
                          />
                          <button
                            onClick={() => handleSecondaryNameSave(criterion.number)}
                            disabled={saving === `criteria_${criterion.number}_name`}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {saving === `criteria_${criterion.number}_name` ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={handleSecondaryNameCancel}
                            disabled={saving === `criteria_${criterion.number}_name`}
                            className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <h4 className="text-base font-medium text-gray-900">{criterion.secondaryName}</h4>
                          {!isEditing && prompt && (
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                              detectProviderFromPrompt(prompt.value) === 'claude'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {detectProviderFromPrompt(prompt.value) === 'claude' ? 'Claude' : 'OpenAI'}
                            </span>
                          )}
                          <button
                            onClick={() => handleSecondaryNameEdit(criterion.number, criterion.secondaryName)}
                            className="text-xs text-blue-600 hover:text-blue-800"
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
                            onChange={(e) => setEditingWeight({ key: promptKey, value: e.target.value })}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                          <button
                            onClick={() => handleWeightSave(promptKey)}
                            disabled={isSaving}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            {isSaving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={handleWeightCancel}
                            disabled={isSaving}
                            className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-semibold text-brand-primary">{criterion.secondaryWeight || 1.0}</span>
                          <button
                            onClick={() => handleWeightEdit({ key: promptKey, weight: (criterion.secondaryWeight || 1.0).toString() })}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Edit
                          </button>
                          <span className="text-xs text-gray-500">
                            (Max final score contribution: {((criterion.secondaryWeight || 1.0) * 10).toFixed(1)} points)
                          </span>
                        </>
                      )}
                    </div>

                    {prompt && (
                      <p className="text-sm text-gray-600 mt-2">{prompt.description}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setExpandedPrompt(isExpanded ? null : promptKey)}
                    className="ml-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    {isExpanded ? 'Collapse' : 'View/Edit Prompt'}
                  </button>
                </div>

                {isExpanded && prompt && (
                  <div className="mt-4">
                    <div className="mb-2 flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700">
                        Prompt Content
                      </label>
                      <span className="text-xs text-gray-500">
                        {isEditing
                          ? editingPrompt?.value.length || 0
                          : typeof prompt.value === 'object'
                            ? JSON.stringify(prompt.value).length
                            : prompt.value.length} characters
                      </span>
                    </div>
                    {isEditing ? (
                      <>
                        <textarea
                          value={editingPrompt?.value || ''}
                          onChange={(e) => editingPrompt && setEditingPrompt({ ...editingPrompt, value: e.target.value })}
                          rows={15}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="mt-2 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                          <span className="font-medium">Expected Response:</span>{' '}
                          <code className="bg-amber-100 px-1 rounded">{'{ "score": <0-10>, "reason": "<explanation>" }'}</code>
                        </p>
                        <div className="mt-3 flex items-center justify-between">
                          <button
                            onClick={() => handleTestPrompt(promptKey)}
                            className="px-4 py-2 text-sm font-medium text-purple-700 bg-white border border-purple-300 rounded-md hover:bg-purple-50"
                          >
                            Test Prompt
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
                              onClick={() => handleSave(promptKey)}
                              disabled={isSaving}
                              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                            >
                              {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mb-2 flex items-center">
                          <label className="flex items-center text-sm text-gray-600 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={prettyPrint}
                              onChange={(e) => setPrettyPrint(e.target.checked)}
                              className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            Pretty-print
                          </label>
                        </div>
                        <div className="bg-gray-50 border border-gray-200 rounded-md p-4 font-mono text-xs whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                          {formatJSON(prompt.value, prettyPrint)}
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => handleReset(promptKey)}
                              disabled={saving === promptKey}
                              className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                            >
                              {saving === promptKey ? 'Resetting...' : 'Reset to Default'}
                            </button>
                            <button
                              onClick={() => handleSaveAsDefault(promptKey)}
                              disabled={saving === promptKey}
                              className="px-4 py-2 text-sm font-medium text-green-700 bg-white border border-green-300 rounded-md hover:bg-green-50 disabled:opacity-50"
                            >
                              {saving === promptKey ? 'Saving...' : 'Save as Default'}
                            </button>
                          </div>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => handleEdit(prompt)}
                              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
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

          {/* Secondary Article Title Prompt */}
          {secondaryTitlePrompt && renderPromptCard(secondaryTitlePrompt)}

          {/* Secondary Article Body Prompt */}
          {secondaryBodyPrompt && renderPromptCard(secondaryBodyPrompt)}
        </div>
      </div>

      {/* Secondary Other Prompts - Only show if there are prompts besides title/body */}
      {secondaryOtherPrompts.length > 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Other Secondary Prompts</h3>
            <p className="text-sm text-gray-600 mt-1">
              Additional AI prompts for secondary article processing (content evaluator, etc.)
            </p>
          </div>
          <div className="divide-y divide-gray-200">
            {secondaryOtherPrompts.map((prompt) => {
              const isExpanded = expandedPrompt === prompt.key
              const isEditing = editingPrompt?.key === prompt.key
              const isSaving = saving === prompt.key

              return (
                <div key={prompt.key} className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="text-base font-medium text-gray-900">{prompt.name}</h4>
                      <p className="text-sm text-gray-600 mt-1">{prompt.description}</p>
                    </div>
                    <button
                      onClick={() => setExpandedPrompt(isExpanded ? null : prompt.key)}
                      className="ml-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      {isExpanded ? 'Collapse' : 'View/Edit'}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-4">
                      {isEditing ? (
                        <>
                          <textarea
                            value={editingPrompt?.value || ''}
                            onChange={(e) => editingPrompt && setEditingPrompt({ ...editingPrompt, value: e.target.value })}
                            rows={20}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-xs"
                            disabled={isSaving}
                          />
                          <div className="mt-3 flex justify-end space-x-3">
                            <button
                              onClick={handleCancel}
                              disabled={isSaving}
                              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSave(prompt.key)}
                              disabled={isSaving}
                              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                            >
                              {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="mb-2 flex items-center">
                            <label className="flex items-center text-sm text-gray-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={prettyPrint}
                                onChange={(e) => setPrettyPrint(e.target.checked)}
                                className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              Pretty-print
                            </label>
                          </div>
                          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 font-mono text-xs whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                            {formatJSON(prompt.value, prettyPrint)}
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <button
                                onClick={() => handleReset(prompt.key)}
                                disabled={saving === prompt.key}
                                className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                              >
                                {saving === prompt.key ? 'Resetting...' : 'Reset to Default'}
                              </button>
                              <button
                                onClick={() => handleSaveAsDefault(prompt.key)}
                                disabled={saving === prompt.key}
                                className="px-4 py-2 text-sm font-medium text-green-700 bg-white border border-green-300 rounded-md hover:bg-green-50 disabled:opacity-50"
                              >
                                {saving === prompt.key ? 'Saving...' : 'Save as Default'}
                              </button>
                            </div>
                            <div className="flex items-center space-x-3">
                              <button
                                onClick={() => handleTestPrompt(prompt.key)}
                                className="px-4 py-2 text-sm font-medium text-purple-700 bg-white border border-purple-300 rounded-md hover:bg-purple-50"
                              >
                                Test Prompt
                              </button>
                              <button
                                onClick={() => handleEdit(prompt)}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
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
      )}

      {/* Other Prompts by Category */}
      {Object.entries(otherGrouped).map(([category, categoryPrompts]) => (
        <div key={category} className="bg-white shadow rounded-lg">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">{category}</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {(categoryPrompts as PromptType[]).map((prompt) => {
              const isExpanded = expandedPrompt === prompt.key
              const isEditing = editingPrompt?.key === prompt.key
              const isSaving = saving === prompt.key

              return (
                <div key={prompt.key} className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-medium text-gray-900">{prompt.name}</h4>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          detectProviderFromPrompt(isEditing ? editingPrompt?.value : prompt.value) === 'claude'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {detectProviderFromPrompt(isEditing ? editingPrompt?.value : prompt.value) === 'claude' ? 'Claude' : 'OpenAI'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{prompt.description}</p>
                    </div>
                    <button
                      onClick={() => setExpandedPrompt(isExpanded ? null : prompt.key)}
                      className="ml-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      {isExpanded ? 'Collapse' : 'View/Edit'}
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
                            : typeof prompt.value === 'object'
                              ? JSON.stringify(prompt.value).length
                              : prompt.value.length} characters
                        </span>
                      </div>
                      {isEditing ? (
                        <>
                          <textarea
                            value={editingPrompt?.value || ''}
                            onChange={(e) => editingPrompt && setEditingPrompt({ ...editingPrompt, value: e.target.value })}
                            rows={15}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="mt-3 flex items-center justify-between">
                            <button
                              onClick={() => handleTestPrompt(prompt.key)}
                              className="px-4 py-2 text-sm font-medium text-purple-700 bg-white border border-purple-300 rounded-md hover:bg-purple-50"
                            >
                              Test Prompt
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
                                onClick={() => handleSave(prompt.key)}
                                disabled={isSaving}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                              >
                                {isSaving ? 'Saving...' : 'Save Changes'}
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="mb-2 flex items-center">
                            <label className="flex items-center text-sm text-gray-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={prettyPrint}
                                onChange={(e) => setPrettyPrint(e.target.checked)}
                                className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              Pretty-print
                            </label>
                          </div>
                          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 font-mono text-xs whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                            {formatJSON(prompt.value, prettyPrint)}
                          </div>
                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <button
                                onClick={() => handleReset(prompt.key)}
                                disabled={saving === prompt.key}
                                className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                              >
                                {saving === prompt.key ? 'Resetting...' : 'Reset to Default'}
                              </button>
                              <button
                                onClick={() => handleSaveAsDefault(prompt.key)}
                                disabled={saving === prompt.key}
                                className="px-4 py-2 text-sm font-medium text-green-700 bg-white border border-green-300 rounded-md hover:bg-green-50 disabled:opacity-50"
                              >
                                {saving === prompt.key ? 'Saving...' : 'Save as Default'}
                              </button>
                            </div>
                            <div className="flex items-center space-x-3">
                              <button
                                onClick={() => handleEdit(prompt)}
                                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
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
      ))}

      {/* Help Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h4 className="font-medium text-blue-900 mb-3">Prompt Placeholders</h4>
        <div className="text-sm text-blue-800 space-y-2">
          <p><code className="bg-blue-100 px-2 py-0.5 rounded">{'{'}title{'}'}</code> - Article/event title</p>
          <p><code className="bg-blue-100 px-2 py-0.5 rounded">{'{'}description{'}'}</code> - Article/event description</p>
          <p><code className="bg-blue-100 px-2 py-0.5 rounded">{'{'}content{'}'}</code> - Full article content</p>
          <p><code className="bg-blue-100 px-2 py-0.5 rounded">{'{'}date{'}'}</code> - Issue date</p>
          <p><code className="bg-blue-100 px-2 py-0.5 rounded">{'{'}headline{'}'}</code> - Newsletter article headline</p>
          <p className="mt-3 text-xs text-blue-700">
            ⚠️ <strong>Important:</strong> Changes take effect immediately. Test prompts carefully before saving.
          </p>
        </div>
      </div>

      {/* Testing Playground Button */}
      {newsletterSlug && (
        <div className="flex justify-center">
          <Link
            href={`https://www.aiprodaily.com/dashboard/${newsletterSlug}/settings/AIPromptTesting`}
            className="px-6 py-3 text-base font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors duration-200 shadow-md hover:shadow-lg"
          >
            Testing Playground
          </Link>
        </div>
      )}

      {/* Test Modal */}
      {testModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Prompt Test Results</h3>
              <button
                onClick={() => setTestModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {testLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
                  <span className="ml-4 text-gray-600">Testing prompt...</span>
                </div>
              ) : testError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
                  <strong>Error:</strong> {testError}
                </div>
              ) : testResults ? (
                <div className="space-y-6">
                  {/* RSS Post Info */}
                  {testResults.rss_post_used && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-medium text-blue-900 mb-2">Test Data:</h4>
                      <p className="text-sm text-blue-800">
                        <strong>Post:</strong> {testResults.rss_post_used.title}
                      </p>
                      {testResults.rss_post_used.source_url && (
                        <p className="text-sm text-blue-800 mt-1">
                          <strong>Source:</strong>{' '}
                          <a href={testResults.rss_post_used.source_url} target="_blank" rel="noopener noreferrer" className="underline">
                            {testResults.rss_post_used.source_url}
                          </a>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Parsed Expected Outputs */}
                  {testResults.parsedOutputs && Object.keys(testResults.parsedOutputs).length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-medium text-green-900 mb-3">Expected Outputs:</h4>
                      <div className="space-y-2">
                        {Object.entries(testResults.parsedOutputs).map(([fieldName, fieldData]: [string, any]) => (
                          <div key={fieldName} className="bg-white border border-gray-200 rounded p-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-700 mb-1">{fieldName}:</p>
                                {fieldData.error ? (
                                  <p className="text-sm font-bold text-red-600">ERROR</p>
                                ) : (
                                  <p className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                                    {typeof fieldData.value === 'object'
                                      ? JSON.stringify(fieldData.value, null, 2)
                                      : fieldData.value}
                                  </p>
                                )}
                              </div>
                              <span className={`ml-3 px-2 py-1 text-xs font-medium rounded ${
                                fieldData.error
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {fieldData.error ? 'Failed' : 'Parsed'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Test Results */}
                  {Object.entries(testResults.results || {}).map(([key, result]: [string, any]) => (
                    <div key={key} className="bg-white border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-3 capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </h4>

                      {result.success ? (
                        <div className="space-y-3">
                          <div>
                            <h5 className="text-sm font-semibold text-gray-700 mb-2">Parsed Content:</h5>
                            {typeof result.response === 'string' ? (
                              <div className="bg-gray-50 rounded p-4 whitespace-pre-wrap font-mono text-sm">
                                {result.response}
                              </div>
                            ) : result.response?.raw ? (
                              <div className="bg-gray-50 rounded p-4 whitespace-pre-wrap font-mono text-sm">
                                {result.response.raw}
                              </div>
                            ) : (
                              <div className="bg-gray-50 rounded p-4">
                                <pre className="whitespace-pre-wrap text-sm">
                                  {JSON.stringify(result.response, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>

                          {result.fullResponse && (
                            <details className="border border-gray-300 rounded-lg">
                              <summary className="cursor-pointer px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-t-lg font-medium text-sm text-gray-700">
                                Full API Response (Click to expand)
                              </summary>
                              <div className="bg-white p-4 rounded-b-lg">
                                <pre className="whitespace-pre-wrap text-xs overflow-x-auto">
                                  {JSON.stringify(result.fullResponse, null, 2)}
                                </pre>
                              </div>
                            </details>
                          )}

                          {result.character_count && (
                            <p className="text-sm text-gray-600">
                              Character count: {result.character_count}
                            </p>
                          )}
                          {result.prompt_length && (
                            <p className="text-sm text-gray-600">
                              Prompt length: {result.prompt_length} characters
                            </p>
                          )}
                          {result.test_posts_count && (
                            <p className="text-sm font-medium text-blue-600">
                              Test articles: {result.test_posts_count} articles analyzed
                            </p>
                          )}
                          {result.expected_duplicates && (
                            <p className="text-sm text-gray-600 mt-2">
                              <strong>Expected duplicates:</strong> {result.expected_duplicates}
                            </p>
                          )}
                          {result.test_articles_count && (
                            <p className="text-sm font-medium text-blue-600">
                              Test articles: {result.test_articles_count} articles analyzed
                            </p>
                          )}
                          {result.prompt_source && (
                            <p className="text-sm text-gray-500">
                              Prompt source: {result.prompt_source}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">
                          <strong>Error:</strong> {result.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setTestModalOpen(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
