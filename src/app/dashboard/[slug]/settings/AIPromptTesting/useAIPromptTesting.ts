'use client'

import { useEffect, useState } from 'react'
import type {
  Provider,
  PromptType,
  ArticleModule,
  RSSPost,
  TestResult,
  SavedPrompt,
} from './types'
import { getModuleIdFromPromptType, sanitizeJsonString } from './types'

export function useAIPromptTesting(slug: string, status: string) {
  // Form state
  const [provider, setProvider] = useState<Provider>('openai')
  const [promptType, setPromptType] = useState<PromptType>('')
  const [prompt, setPrompt] = useState('')
  const [selectedPostId, setSelectedPostId] = useState<string>('')

  // Article modules state
  const [articleModules, setArticleModules] = useState<ArticleModule[]>([])
  const [loadingModules, setLoadingModules] = useState(true)

  // Post source toggle
  const [postSource, setPostSource] = useState<'sent' | 'pool'>('sent')

  // Data state
  const [recentPosts, setRecentPosts] = useState<RSSPost[]>([])
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testHistory, setTestHistory] = useState<TestResult[]>([])
  const [currentResponse, setCurrentResponse] = useState<TestResult | null>(null)
  const [savedPromptInfo, setSavedPromptInfo] = useState<SavedPrompt | null>(null)
  const [showModal, setShowModal] = useState(false)

  // Live prompt tracking
  const [livePrompt, setLivePrompt] = useState<string | null>(null)
  const [livePromptProviderMatches, setLivePromptProviderMatches] = useState(false)
  const [isModified, setIsModified] = useState(false)

  // Fetch article modules on mount
  useEffect(() => {
    async function loadArticleModules() {
      try {
        setLoadingModules(true)
        const res = await fetch(`/api/article-modules?publication_id=${slug}`)
        const data = await res.json()
        if (data.success && data.modules) {
          const activeModules = data.modules.filter((m: ArticleModule) => m.is_active)
          setArticleModules(activeModules)
          if (activeModules.length > 0 && !promptType) {
            setPromptType(`module-${activeModules[0].id}-title`)
          }
        }
      } catch (error) {
        console.error('Failed to load article modules:', error)
      } finally {
        setLoadingModules(false)
      }
    }
    if (slug) {
      loadArticleModules()
    }
  }, [slug])

  // Load posts when authenticated, prompt type changes, or post source changes
  useEffect(() => {
    if (status === 'authenticated' && promptType) {
      loadRecentPosts()
    }
  }, [slug, status, promptType, postSource])

  // Load saved prompt or template when provider/promptType changes
  useEffect(() => {
    loadSavedPromptOrTemplate()
  }, [provider, promptType])

  // Track if current prompt has been modified from live prompt
  useEffect(() => {
    if (livePrompt && prompt) {
      setIsModified(prompt !== livePrompt)
    } else {
      setIsModified(false)
    }
  }, [prompt, livePrompt])

  async function loadRecentPosts() {
    setLoadingPosts(true)
    try {
      const moduleId = getModuleIdFromPromptType(promptType)
      console.log(`[Frontend] Fetching posts (source=${postSource}) for newsletter:`, slug, 'module_id:', moduleId)

      let url = `/api/rss/recent-posts?publication_id=${slug}&limit=50&source=${postSource}&days=7`
      if (moduleId) {
        url += `&module_id=${moduleId}`
      }

      const res = await fetch(url)
      const data = await res.json()

      console.log('[Frontend] Response status:', res.status, 'data:', data)

      if (data.success) {
        console.log('[Frontend] Successfully loaded', data.posts.length, 'posts from sent issues')
        setRecentPosts(data.posts)
        if (data.posts.length > 0) {
          setSelectedPostId(data.posts[0].id)
        }
      } else {
        console.error('[Frontend] Failed to load posts:', data.error, data.details || data.message)
        alert(`Failed to load RSS posts: ${data.error}`)
      }
    } catch (error) {
      console.error('[Frontend] Exception loading posts:', error)
      alert('Error loading RSS posts. Check console for details.')
    } finally {
      setLoadingPosts(false)
    }
  }

  async function loadSavedPromptOrTemplate() {
    // STEP 1: Try to load LIVE prompt first (from app_settings)
    try {
      const res = await fetch(
        `/api/ai/load-live-prompt?publication_id=${slug}&provider=${provider}&prompt_type=${promptType}`
      )
      const data = await res.json()

      if (data.success && data.data?.prompt) {
        console.log('[Frontend] Loaded live prompt from app_settings')
        console.log('[Frontend] Provider matches:', data.data.provider_matches)

        const providerMatches = data.data.provider_matches || false
        setLivePromptProviderMatches(providerMatches)

        const promptToSet = data.data.prompt
        setLivePrompt(promptToSet)

        if (providerMatches) {
          setPrompt(promptToSet)
          setSavedPromptInfo(null)
          console.log('[Frontend] Live prompt loaded and set (provider matches)')
          return
        } else {
          console.log('[Frontend] Live prompt loaded but provider does not match - continuing to load saved prompt')
        }
      }
    } catch (error) {
      console.error('[Frontend] Error loading live prompt:', error)
    }

    // STEP 2: Try to load saved prompt from database (ai_prompt_tests table)
    try {
      const res = await fetch(
        `/api/ai/load-prompt?publication_id=${slug}&provider=${provider}&prompt_type=${promptType}`
      )
      const data = await res.json()

      if (data.success && data.data) {
        console.log('[Frontend] Loaded saved prompt from ai_prompt_tests')
        setSavedPromptInfo(data.data)
        setPrompt(data.data.prompt)
        setLivePrompt(null)
        setLivePromptProviderMatches(false)
        return
      }
    } catch (error) {
      console.error('[Frontend] Error loading saved prompt:', error)
    }

    // STEP 3: No saved prompt or live prompt, clear and load template
    setSavedPromptInfo(null)
    setLivePrompt(null)
    setLivePromptProviderMatches(false)
    loadTemplate()
  }

  async function loadTemplate() {
    if (promptType === 'custom') {
      setPrompt('')
      return
    }

    try {
      const res = await fetch('/api/ai/load-prompt-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptType, provider })
      })

      const data = await res.json()

      if (data.success) {
        setPrompt(data.prompt)
        console.log('[Frontend] Loaded template for:', promptType)
      } else {
        setPrompt('Error loading prompt template: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to load prompt template:', error)
      setPrompt('Error loading prompt template')
    }
  }

  function resetToLivePrompt() {
    if (livePrompt) {
      setPrompt(livePrompt)
      console.log('[Frontend] Reset to live prompt')
    }
  }

  async function savePrompt(promptText: string) {
    try {
      let model = 'unknown'
      try {
        const promptJson = JSON.parse(promptText)
        model = promptJson.model || 'unknown'
      } catch {
        model = 'unknown'
      }

      const res = await fetch('/api/ai/save-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publication_id: slug,
          provider,
          model,
          prompt_type: promptType,
          prompt: promptText
        })
      })

      const data = await res.json()

      if (data.success) {
        console.log('[Frontend] Prompt saved to database')
        setSavedPromptInfo(data.data)
      } else {
        console.error('[Frontend] Failed to save prompt:', data.error)
      }
    } catch (error) {
      console.error('[Frontend] Error saving prompt:', error)
    }
  }

  async function handleTest() {
    if (!prompt.trim()) {
      alert('Please enter a prompt')
      return
    }

    const sanitizedPrompt = sanitizeJsonString(prompt)
    let promptJson
    try {
      promptJson = JSON.parse(sanitizedPrompt)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      alert(`Invalid JSON format: ${errorMsg}\n\nCommon issues:\n- Curly quotes (\u201C \u201D) instead of straight quotes (" ")\n- Missing commas between properties\n- Trailing commas after last property`)
      return
    }

    const selectedPost = recentPosts.find(p => p.id === selectedPostId)
    if (!selectedPost && promptType !== 'custom') {
      alert('Please select a post to test with')
      return
    }

    savePrompt(prompt)

    setTesting(true)
    setCurrentResponse(null)

    try {
      const res = await fetch('/api/ai/test-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          promptJson,
          post: selectedPost,
          publication_id: slug,
          isCustomFreeform: promptType === 'custom'
        })
      })

      const data = await res.json()

      if (data.success) {
        const result: TestResult = {
          timestamp: new Date(),
          provider: data.provider,
          model: data.model,
          promptType,
          response: data.response as any,
          tokensUsed: data.tokensUsed,
          duration: data.duration,
          apiRequest: data.apiRequest,
          fullApiResponse: data.fullApiResponse
        }

        setCurrentResponse(result)
        setTestHistory(prev => [result, ...prev])
        setShowModal(true)
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Test failed:', error)
      alert('Failed to test prompt')
    } finally {
      setTesting(false)
    }
  }

  async function handleTestMultipleWithOffset(offset: number, batchLabel: string) {
    if (!prompt.trim()) {
      alert('Please enter a prompt')
      return
    }

    const sanitizedPrompt = sanitizeJsonString(prompt)
    let promptJson
    try {
      promptJson = JSON.parse(sanitizedPrompt)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      alert(`Invalid JSON format: ${errorMsg}\n\nCommon issues:\n- Curly quotes (\u201C \u201D) instead of straight quotes (" ")\n- Missing commas between properties\n- Trailing commas after last property`)
      return
    }

    if (recentPosts.length === 0) {
      alert('No posts available for testing')
      return
    }

    savePrompt(prompt)

    setTesting(true)
    setCurrentResponse(null)

    try {
      const moduleId = getModuleIdFromPromptType(promptType)

      const res = await fetch('/api/ai/test-prompt-multiple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          promptJson,
          publication_id: slug,
          prompt_type: promptType,
          module_id: moduleId,
          post_source: postSource,
          limit: 10,
          offset,
          isCustomFreeform: promptType === 'custom'
        })
      })

      const data = await res.json()

      if (data.success) {
        const responseText = data.responses && data.responses[0]
          ? (typeof data.responses[0] === 'string' ? data.responses[0] : JSON.stringify(data.responses[0], null, 2))
          : 'No responses'

        const responsesText = data.responses?.map((r: any) =>
          typeof r === 'string' ? r : JSON.stringify(r, null, 2)
        ) || []

        const result: TestResult = {
          timestamp: new Date(),
          provider: data.provider,
          model: data.model,
          promptType,
          response: responseText,
          tokensUsed: data.totalTokensUsed,
          duration: data.totalDuration,
          apiRequest: data.apiRequest,
          isMultiple: true,
          responses: responsesText,
          fullApiResponses: data.fullApiResponses,
          sourcePosts: data.sourcePosts,
          sourceIssues: data.sourceIssues,
          isCustomFreeform: data.isCustomFreeform
        }

        setCurrentResponse(result)
        setTestHistory(prev => [result, ...prev])
        setShowModal(true)
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error(`Test multiple (${batchLabel}) failed:`, error)
      alert(`Failed to test prompt for multiple articles (${batchLabel})`)
    } finally {
      setTesting(false)
    }
  }

  function handleTestMultiple() {
    handleTestMultipleWithOffset(0, '1-10')
  }

  function handleTestMultipleSecondBatch() {
    handleTestMultipleWithOffset(10, '11-20')
  }

  function openResultModal(result: TestResult) {
    setCurrentResponse(result)
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
  }

  const selectedPost = recentPosts.find(p => p.id === selectedPostId) || null

  return {
    // Form state
    provider,
    setProvider,
    promptType,
    setPromptType,
    prompt,
    setPrompt,
    selectedPostId,
    setSelectedPostId,
    selectedPost,

    // Article modules
    articleModules,
    loadingModules,

    // Post source
    postSource,
    setPostSource,

    // Data state
    recentPosts,
    loadingPosts,
    testing,
    testHistory,
    currentResponse,
    savedPromptInfo,
    showModal,

    // Live prompt
    livePrompt,
    livePromptProviderMatches,
    isModified,

    // Actions
    handleTest,
    handleTestMultiple,
    handleTestMultipleSecondBatch,
    resetToLivePrompt,
    openResultModal,
    closeModal,
  }
}
