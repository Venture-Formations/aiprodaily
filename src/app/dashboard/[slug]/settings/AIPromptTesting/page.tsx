'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Layout from '@/components/Layout'

type Provider = 'openai' | 'claude'
type PromptType = 'primary-title' | 'primary-body' | 'secondary-title' | 'secondary-body' | 'post-scorer' | 'subject-line' | 'custom'

interface RSSPost {
  id: string
  title: string
  description: string | null
  full_article_text: string | null
  source_url: string | null
  publication_date: string | null
}

interface TestResult {
  timestamp: Date
  provider: Provider
  model: string
  promptType: PromptType
  response: string
  tokensUsed?: number
  duration: number
  apiRequest?: any // The exact API request sent
  isMultiple?: boolean // Whether this was a multiple article test
  responses?: string[] // Array of responses for multiple article tests
  sourcePosts?: Array<{ // Source posts used for multiple article tests
    id: string
    title: string
    description: string | null
    content: string | null
    source_url: string | null
    publication_date: string | null
  }>
}

interface SavedPrompt {
  id: string
  prompt: string
  updated_at: string
}

const OPENAI_MODELS = [
  'gpt-5',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-4',
  'gpt-3.5-turbo'
]

const CLAUDE_MODELS = [
  'claude-sonnet-4-5-20250929',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307'
]

export default function AIPromptTestingPage() {
  const params = useParams()
  const slug = params.slug as string
  const { data: session, status } = useSession()

  // Form state
  const [provider, setProvider] = useState<Provider>('openai')
  const [promptType, setPromptType] = useState<PromptType>('primary-title')
  const [prompt, setPrompt] = useState('')
  const [selectedPostId, setSelectedPostId] = useState<string>('')

  // Data state
  const [recentPosts, setRecentPosts] = useState<RSSPost[]>([])
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testHistory, setTestHistory] = useState<TestResult[]>([])
  const [currentResponse, setCurrentResponse] = useState<TestResult | null>(null)
  const [savedPromptInfo, setSavedPromptInfo] = useState<SavedPrompt | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [showPromptDetails, setShowPromptDetails] = useState(false)
  const [showSourcePosts, setShowSourcePosts] = useState(false)

  // Live prompt tracking
  const [livePrompt, setLivePrompt] = useState<string | null>(null)
  const [livePromptProviderMatches, setLivePromptProviderMatches] = useState(false)
  const [isModified, setIsModified] = useState(false)

  // Helper function to determine section from prompt type
  const getSection = (type: PromptType): 'primary' | 'secondary' | 'all' => {
    if (type === 'primary-title' || type === 'primary-body' || type === 'subject-line') return 'primary'
    if (type === 'secondary-title' || type === 'secondary-body') return 'secondary'
    return 'all' // For post-scorer, custom
  }

  // Load recent RSS posts when authenticated or when prompt type changes
  useEffect(() => {
    if (status === 'authenticated') {
      loadRecentPosts()
    }
  }, [slug, status, promptType])

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
      const section = getSection(promptType)
      console.log('[Frontend] Fetching posts for newsletter:', slug, 'section:', section)
      const res = await fetch(`/api/rss/recent-posts?newsletter_id=${slug}&limit=50&section=${section}`)
      const data = await res.json()

      console.log('[Frontend] Response status:', res.status, 'data:', data)

      if (data.success) {
        console.log('[Frontend] Successfully loaded', data.posts.length, 'posts')
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
        `/api/ai/load-live-prompt?newsletter_id=${slug}&provider=${provider}&prompt_type=${promptType}`
      )
      const data = await res.json()

      if (data.success && data.data?.prompt) {
        console.log('[Frontend] Loaded live prompt from app_settings')
        console.log('[Frontend] Provider matches:', data.data.provider_matches)

        // Store provider match status
        setLivePromptProviderMatches(data.data.provider_matches || false)

        // Use prompt exactly as-is from database
        const promptToSet = data.data.prompt

        setLivePrompt(promptToSet)
        setPrompt(promptToSet)
        setSavedPromptInfo(null) // Clear saved prompt info when loading live
        console.log('[Frontend] Live prompt loaded and set')
        return
      }
    } catch (error) {
      console.error('[Frontend] Error loading live prompt:', error)
    }

    // STEP 2: Try to load saved prompt from database (ai_prompt_tests table)
    try {
      const res = await fetch(
        `/api/ai/load-prompt?newsletter_id=${slug}&provider=${provider}&prompt_type=${promptType}`
      )
      const data = await res.json()

      if (data.success && data.data) {
        console.log('[Frontend] Loaded saved prompt from ai_prompt_tests')
        setSavedPromptInfo(data.data)
        setPrompt(data.data.prompt)
        setLivePrompt(null) // No live prompt for comparison
        setLivePromptProviderMatches(false) // Clear provider match status
        return
      }
    } catch (error) {
      console.error('[Frontend] Error loading saved prompt:', error)
    }

    // STEP 3: No saved prompt or live prompt, clear the info and load template
    setSavedPromptInfo(null)
    setLivePrompt(null)
    setLivePromptProviderMatches(false) // Clear provider match status
    loadTemplate()
  }

  async function loadTemplate() {
    // Load template as complete JSON API request
    if (promptType === 'custom') {
      // Empty template - user enters everything
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
        // Use prompt exactly as returned - no parsing, no wrapping
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
      // Extract model from JSON prompt
      let model = 'unknown'
      try {
        const promptJson = JSON.parse(promptText)
        model = promptJson.model || 'unknown'
      } catch {
        // If not valid JSON, use 'unknown'
        model = 'unknown'
      }

      const res = await fetch('/api/ai/save-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newsletter_id: slug,
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

    // Validate JSON
    let promptJson
    try {
      promptJson = JSON.parse(prompt)
    } catch (error) {
      alert('Invalid JSON format. Please enter a valid JSON API request.')
      return
    }

    // Get the selected post for placeholder injection
    const selectedPost = recentPosts.find(p => p.id === selectedPostId)
    if (!selectedPost && promptType !== 'custom') {
      alert('Please select a post to test with')
      return
    }

    // Save the prompt for this combination
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
          post: selectedPost // Include post data for placeholder injection
        })
      })

      const data = await res.json()

      if (data.success) {
        const result: TestResult = {
          timestamp: new Date(),
          provider: data.provider,
          model: data.model,
          promptType,
          response: data.response,
          tokensUsed: data.tokensUsed,
          duration: data.duration,
          apiRequest: data.apiRequest
        }

        setCurrentResponse(result)
        setTestHistory(prev => [result, ...prev])
        setShowModal(true) // Show modal with results
        setShowPromptDetails(false) // Start with prompt details collapsed
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

  async function handleTestMultiple() {
    if (!prompt.trim()) {
      alert('Please enter a prompt')
      return
    }

    // Validate JSON
    let promptJson
    try {
      promptJson = JSON.parse(prompt)
    } catch (error) {
      alert('Invalid JSON format. Please enter a valid JSON API request.')
      return
    }

    // Check if we have posts
    if (recentPosts.length === 0) {
      alert('No posts available for testing')
      return
    }

    // Save the prompt for this combination
    savePrompt(prompt)

    setTesting(true)
    setCurrentResponse(null)

    try {
      const res = await fetch('/api/ai/test-prompt-multiple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          promptJson,
          newsletter_id: slug,
          prompt_type: promptType,
          limit: 10
        })
      })

      const data = await res.json()

      if (data.success) {
        const result: TestResult = {
          timestamp: new Date(),
          provider: data.provider,
          model: data.model,
          promptType,
          response: data.responses[0] || 'No responses',
          tokensUsed: data.totalTokensUsed,
          duration: data.totalDuration,
          apiRequest: data.apiRequest,
          isMultiple: true,
          responses: data.responses,
          sourcePosts: data.sourcePosts // Include source posts
        }

        setCurrentResponse(result)
        setTestHistory(prev => [result, ...prev])
        setShowModal(true)
        setShowPromptDetails(false)
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error('Test multiple failed:', error)
      alert('Failed to test prompt for multiple articles')
    } finally {
      setTesting(false)
    }
  }

  const selectedPost = recentPosts.find(p => p.id === selectedPostId)

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            AI Prompt Testing Playground
          </h1>
          <p className="text-sm text-gray-600">
            Test AI prompts without affecting live newsletter prompts. Prompts auto-save to database (accessible from any device).
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Configuration */}
          <div className="space-y-6">
            {/* Provider Selector */}
            <div className="bg-white rounded-lg shadow p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                AI Provider
              </label>
              <div className="flex gap-4">
                <button
                  onClick={() => setProvider('openai')}
                  className={`flex-1 py-2 px-4 rounded-lg border-2 transition-colors ${
                    provider === 'openai'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  OpenAI
                </button>
                <button
                  onClick={() => setProvider('claude')}
                  className={`flex-1 py-2 px-4 rounded-lg border-2 transition-colors ${
                    provider === 'claude'
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  Claude
                </button>
              </div>
            </div>

            {/* Prompt Type Selector */}
            <div className="bg-white rounded-lg shadow p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prompt Type
              </label>
              <select
                value={promptType}
                onChange={(e) => setPromptType(e.target.value as PromptType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                aria-label="Prompt Type"
              >
                <optgroup label="Primary Section">
                  <option value="primary-title">Primary Article Title</option>
                  <option value="primary-body">Primary Article Body</option>
                </optgroup>
                <optgroup label="Secondary Section">
                  <option value="secondary-title">Secondary Article Title</option>
                  <option value="secondary-body">Secondary Article Body</option>
                </optgroup>
                <optgroup label="Other">
                  <option value="post-scorer">Post Scorer/Evaluator</option>
                  <option value="subject-line">Subject Line Generator</option>
                  <option value="custom">Custom/Freeform</option>
                </optgroup>
              </select>
            </div>

            {/* RSS Post Selector */}
            {promptType !== 'custom' && (
              <div className="bg-white rounded-lg shadow p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sample RSS Post
                </label>
                {status === 'loading' ? (
                  <p className="text-gray-500 text-sm">Authenticating...</p>
                ) : loadingPosts ? (
                  <p className="text-gray-500 text-sm">Loading posts...</p>
                ) : recentPosts.length === 0 ? (
                  <div className="text-gray-500 text-sm bg-yellow-50 border border-yellow-200 rounded p-3">
                    <p className="font-medium text-yellow-800">No recent posts found</p>
                    <p className="text-xs mt-1">Make sure RSS feeds have been processed for this newsletter.</p>
                  </div>
                ) : (
                  <>
                    <select
                      value={selectedPostId}
                      onChange={(e) => setSelectedPostId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
                      aria-label="Sample RSS Post"
                    >
                      {recentPosts.map(post => (
                        <option key={post.id} value={post.id}>
                          {post.title.substring(0, 80)}...
                        </option>
                      ))}
                    </select>
                    {selectedPost && (
                      <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded border border-gray-200">
                        <p className="font-medium mb-1">{selectedPost.title}</p>
                        <p className="text-xs">{selectedPost.description?.substring(0, 150)}...</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Reference Guide */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Reference Guide</h2>

              {/* Placeholders */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Available Placeholders</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="font-mono">
                    <span className="text-blue-600">{'{{title}}'}</span>
                    <span className="text-gray-600 ml-2">- Article title/headline</span>
                  </div>
                  <div className="font-mono">
                    <span className="text-blue-600">{'{{description}}'}</span>
                    <span className="text-gray-600 ml-2">- Article description/summary</span>
                  </div>
                  <div className="font-mono">
                    <span className="text-blue-600">{'{{content}}'}</span>
                    <span className="text-gray-600 ml-2">- Full article text</span>
                  </div>
                  <div className="font-mono">
                    <span className="text-blue-600">{'{{url}}'}</span>
                    <span className="text-gray-600 ml-2">- Article source URL</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  Use these placeholders in your prompt content. They will be replaced with actual post data when testing.
                </p>
              </div>

              {/* Expected Response Formats */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Expected Response Formats</h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <div className="font-semibold text-gray-700 mb-1">Primary/Secondary Title:</div>
                    <pre className="bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto">
{`{
  "headline": "string"
}`}
                    </pre>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 mb-1">Primary/Secondary Body:</div>
                    <pre className="bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto">
{`{
  "content": "string",
  "word_count": integer
}`}
                    </pre>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 mb-1">Post Scorer:</div>
                    <pre className="bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto">
{`{
  "score": integer,
  "reasoning": "string"
}`}
                    </pre>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-700 mb-1">Subject Line:</div>
                    <pre className="bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto">
{`{
  "subject_line": "string"
}`}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Important Note */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Important</h3>
                <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-gray-700">
                  <p className="font-medium mb-2">Enter complete JSON API request:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Include all parameters you need (model, messages, temperature, max_output_tokens, response_format, etc.)</li>
                    <li>Use placeholders like <code className="bg-white px-1 rounded">{'{{title}}'}</code>, <code className="bg-white px-1 rounded">{'{{description}}'}</code>, <code className="bg-white px-1 rounded">{'{{content}}'}</code></li>
                    <li>JSON is sent to API exactly as-is (only placeholders replaced)</li>
                    <li>For OpenAI: Use <code className="bg-white px-1 rounded">max_output_tokens</code> (not max_tokens)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Prompt & Response */}
          <div className="space-y-6">
            {/* Prompt Editor */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  API Request JSON
                </label>
                <div className="flex items-center gap-3">
                  {/* Live Prompt Status Indicator - Only show when provider matches */}
                  {livePrompt && livePromptProviderMatches && !isModified && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Currently viewing: Live Prompt
                    </span>
                  )}
                  {livePrompt && livePromptProviderMatches && isModified && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Modified from live
                    </span>
                  )}
                  {savedPromptInfo && (
                    <span className="text-xs text-green-600">
                      ✓ Saved {new Date(savedPromptInfo.updated_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-600 mb-3">
                Enter the complete JSON API request. Model and parameters are included in the JSON.
                Use placeholders like {'{'}{'{'} title {'}'}{'}'}  or {'{'}{'{'} content {'}'}{'}'} for post data.
              </p>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={20}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-xs bg-gray-50"
                placeholder='Enter complete JSON API request here...'
              />

              {/* Reset to Live Prompt Button - Only show when provider matches */}
              {livePrompt && livePromptProviderMatches && isModified && (
                <button
                  onClick={resetToLivePrompt}
                  className="mt-3 w-full py-2 px-4 bg-purple-100 text-purple-700 font-medium rounded-lg hover:bg-purple-200 border border-purple-300 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reset to Live Prompt
                </button>
              )}

              <button
                onClick={handleTest}
                disabled={testing || !prompt.trim()}
                className="mt-4 w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {testing ? 'Testing...' : 'Test Prompt'}
              </button>

              <button
                onClick={handleTestMultiple}
                disabled={testing || !prompt.trim() || promptType === 'custom'}
                className="mt-2 w-full py-3 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {testing ? 'Testing...' : 'Test Prompt for Multiple (10 articles)'}
              </button>
              {promptType === 'custom' && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Multiple article testing is only available for Primary/Secondary prompt types
                </p>
              )}
            </div>

            {/* Response */}
            {currentResponse && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Response</h3>
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span>{currentResponse.duration}ms</span>
                    {currentResponse.tokensUsed && <span>{currentResponse.tokensUsed} tokens</span>}
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
                    {typeof currentResponse.response === 'object'
                      ? JSON.stringify(currentResponse.response, null, 2)
                      : currentResponse.response}
                  </pre>
                </div>
              </div>
            )}

            {/* Test History */}
            {testHistory.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Test History ({testHistory.length})
                </h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {testHistory.map((result, index) => (
                    <div
                      key={index}
                      className="p-3 bg-gray-50 rounded border border-gray-200 cursor-pointer hover:bg-gray-100 hover:shadow-sm transition-all"
                      onClick={() => {
                        setCurrentResponse(result)
                        setShowModal(true)
                        setShowPromptDetails(false)
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-900">
                          {result.provider === 'openai' ? '🟦' : '🟪'} {result.model}
                        </span>
                        <span className="text-xs text-gray-500">
                          {result.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 truncate">
                        {result.response.substring(0, 100)}...
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Test Results Modal */}
      {showModal && currentResponse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Test Results</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {currentResponse.provider.toUpperCase()} • {currentResponse.model} • {currentResponse.duration}ms
                  {currentResponse.tokensUsed && ` • ${currentResponse.tokensUsed} tokens`}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* API Call Details (Collapsible) */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowPromptDetails(!showPromptDetails)}
                  className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left"
                >
                  <span className="font-medium text-gray-900">
                    {showPromptDetails ? '▼' : '▶'} API Call Details
                  </span>
                  <span className="text-sm text-gray-500">
                    {showPromptDetails ? 'Click to collapse' : 'Click to expand'}
                  </span>
                </button>
                {showPromptDetails && (
                  <div className="p-4 bg-white">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      Exact API Request Sent to {currentResponse.provider.toUpperCase()}:
                    </h4>
                    <pre className="bg-gray-50 rounded p-4 overflow-x-auto text-xs font-mono whitespace-pre-wrap">
                      {currentResponse.apiRequest
                        ? JSON.stringify(currentResponse.apiRequest, null, 2)
                        : 'No API request details available'}
                    </pre>
                  </div>
                )}
              </div>

              {/* Source Posts Section (for multiple article tests) */}
              {currentResponse.isMultiple && currentResponse.sourcePosts && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setShowSourcePosts(!showSourcePosts)}
                    className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 flex items-center justify-between text-left"
                  >
                    <span className="font-medium text-gray-900">
                      {showSourcePosts ? '▼' : '▶'} Source Articles Used ({currentResponse.sourcePosts.length} posts)
                    </span>
                    <span className="text-sm text-gray-500">
                      {showSourcePosts ? 'Click to collapse' : 'Click to expand'}
                    </span>
                  </button>
                  {showSourcePosts && (
                    <div className="p-4 bg-white">
                      <div className="space-y-4 max-h-96 overflow-y-auto">
                        {currentResponse.sourcePosts.map((post, index) => (
                          <div key={post.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <h5 className="font-medium text-gray-900">Article {index + 1}</h5>
                              {post.source_url && (
                                <a
                                  href={post.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-600 hover:underline"
                                >
                                  View Source
                                </a>
                              )}
                            </div>
                            <div className="space-y-2">
                              <div>
                                <p className="text-xs font-semibold text-gray-600 mb-1">Title:</p>
                                <p className="text-sm text-gray-900">{post.title}</p>
                              </div>
                              {post.description && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-600 mb-1">Description:</p>
                                  <p className="text-sm text-gray-700">{post.description}</p>
                                </div>
                              )}
                              {post.content && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-600 mb-1">Full Content:</p>
                                  <div className="bg-gray-50 rounded p-3 max-h-48 overflow-y-auto">
                                    <p className="text-xs text-gray-700 whitespace-pre-wrap">
                                      {post.content || 'No content'}
                                    </p>
                                  </div>
                                </div>
                              )}
                              {post.publication_date && (
                                <p className="text-xs text-gray-500">
                                  Published: {new Date(post.publication_date).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Response Section */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
                  <h4 className="font-medium text-blue-900">
                    {currentResponse.isMultiple ? 'AI Responses (10 Articles)' : 'AI Response'}
                  </h4>
                </div>
                <div className="p-4 bg-white">
                  {currentResponse.isMultiple && currentResponse.responses ? (
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {currentResponse.responses.map((response, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-medium text-gray-900">Article {index + 1}</h5>
                          </div>
                          <div className="bg-gray-50 rounded p-3 whitespace-pre-wrap text-sm">
                            {typeof response === 'object'
                              ? JSON.stringify(response, null, 2)
                              : response}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded p-4 whitespace-pre-wrap text-sm">
                      {typeof currentResponse.response === 'object'
                        ? JSON.stringify(currentResponse.response, null, 2)
                        : currentResponse.response}
                    </div>
                  )}
                </div>
              </div>

              {/* Metadata */}
              <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Provider:</span>
                  <span className="ml-2 font-medium">{currentResponse.provider.toUpperCase()}</span>
                </div>
                <div>
                  <span className="text-gray-600">Model:</span>
                  <span className="ml-2 font-medium">{currentResponse.model}</span>
                </div>
                <div>
                  <span className="text-gray-600">Duration:</span>
                  <span className="ml-2 font-medium">{currentResponse.duration}ms</span>
                </div>
                {currentResponse.tokensUsed && (
                  <div>
                    <span className="text-gray-600">Tokens:</span>
                    <span className="ml-2 font-medium">{currentResponse.tokensUsed}</span>
                  </div>
                )}
                <div>
                  <span className="text-gray-600">Prompt Type:</span>
                  <span className="ml-2 font-medium capitalize">{currentResponse.promptType.replace('-', ' ')}</span>
                </div>
                <div>
                  <span className="text-gray-600">Timestamp:</span>
                  <span className="ml-2 font-medium">{currentResponse.timestamp.toLocaleTimeString()}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
