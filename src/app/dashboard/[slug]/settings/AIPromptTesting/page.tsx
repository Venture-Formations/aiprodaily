'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Layout from '@/components/Layout'

type Provider = 'openai' | 'claude'
type PromptType = 'article-generator' | 'post-scorer' | 'subject-line' | 'custom'

interface RSSPost {
  id: string
  title: string
  description: string | null
  full_article_text: string | null
  source_url: string | null
  created_at: string
}

interface TestResult {
  timestamp: Date
  provider: Provider
  model: string
  promptType: PromptType
  response: string
  tokensUsed?: number
  duration: number
}

interface SavedPrompt {
  id: string
  prompt: string
  parameters: {
    temperature?: number
    maxTokens?: number
    topP?: number
    presencePenalty?: number
    frequencyPenalty?: number
  }
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
  const [model, setModel] = useState(OPENAI_MODELS[0])
  const [promptType, setPromptType] = useState<PromptType>('article-generator')
  const [prompt, setPrompt] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(1000)
  const [topP, setTopP] = useState(1.0)
  const [presencePenalty, setPresencePenalty] = useState(0.0)
  const [frequencyPenalty, setFrequencyPenalty] = useState(0.0)
  const [selectedPostId, setSelectedPostId] = useState<string>('')

  // Data state
  const [recentPosts, setRecentPosts] = useState<RSSPost[]>([])
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testHistory, setTestHistory] = useState<TestResult[]>([])
  const [currentResponse, setCurrentResponse] = useState<TestResult | null>(null)
  const [savedPromptInfo, setSavedPromptInfo] = useState<SavedPrompt | null>(null)

  // Load recent RSS posts when authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      loadRecentPosts()
    }
  }, [slug, status])

  // Update model when provider changes
  useEffect(() => {
    if (provider === 'openai') {
      setModel(OPENAI_MODELS[0])
    } else {
      setModel(CLAUDE_MODELS[0])
    }
  }, [provider])

  // Load saved prompt or template when settings change
  useEffect(() => {
    loadSavedPromptOrTemplate()
  }, [provider, model, promptType, selectedPostId, recentPosts])

  async function loadRecentPosts() {
    setLoadingPosts(true)
    try {
      console.log('[Frontend] Fetching posts for newsletter:', slug)
      const res = await fetch(`/api/rss/recent-posts?newsletter_id=${slug}&limit=50`)
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
    // Try to load saved prompt from database first
    try {
      const res = await fetch(
        `/api/ai/load-prompt?newsletter_id=${slug}&provider=${provider}&model=${model}&prompt_type=${promptType}`
      )
      const data = await res.json()

      if (data.success && data.data) {
        console.log('[Frontend] Loaded saved prompt from database')
        setSavedPromptInfo(data.data)
        setPrompt(data.data.prompt)

        // Restore saved parameters
        if (data.data.parameters) {
          if (data.data.parameters.temperature !== undefined) setTemperature(data.data.parameters.temperature)
          if (data.data.parameters.maxTokens !== undefined) setMaxTokens(data.data.parameters.maxTokens)
          if (data.data.parameters.topP !== undefined) setTopP(data.data.parameters.topP)
          if (data.data.parameters.presencePenalty !== undefined) setPresencePenalty(data.data.parameters.presencePenalty)
          if (data.data.parameters.frequencyPenalty !== undefined) setFrequencyPenalty(data.data.parameters.frequencyPenalty)
        }
        return
      }
    } catch (error) {
      console.error('[Frontend] Error loading saved prompt:', error)
    }

    // No saved prompt, clear the info
    setSavedPromptInfo(null)

    // If no saved prompt, load template
    if (promptType === 'custom') {
      setPrompt('')
      return
    }

    const selectedPost = recentPosts.find(p => p.id === selectedPostId)
    if (!selectedPost) return

    try {
      const res = await fetch('/api/ai/load-prompt-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptType,
          post: {
            title: selectedPost.title,
            description: selectedPost.description,
            full_article_text: selectedPost.full_article_text
          }
        })
      })

      const data = await res.json()

      if (data.success) {
        setPrompt(data.prompt)
      } else {
        setPrompt('Error loading prompt template: ' + data.error)
      }
    } catch (error) {
      console.error('Failed to load prompt template:', error)
      setPrompt('Error loading prompt template')
    }
  }

  async function savePrompt(promptText: string) {
    try {
      const res = await fetch('/api/ai/save-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newsletter_id: slug,
          provider,
          model,
          prompt_type: promptType,
          prompt: promptText,
          parameters: {
            temperature,
            maxTokens,
            topP,
            presencePenalty,
            frequencyPenalty
          }
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
          model,
          prompt,
          temperature,
          maxTokens,
          topP,
          presencePenalty,
          frequencyPenalty
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
          duration: data.duration
        }

        setCurrentResponse(result)
        setTestHistory(prev => [result, ...prev])
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

            {/* Model Selector */}
            <div className="bg-white rounded-lg shadow p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Model
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {(provider === 'openai' ? OPENAI_MODELS : CLAUDE_MODELS).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
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
              >
                <option value="article-generator">Article Generator</option>
                <option value="post-scorer">Post Scorer</option>
                <option value="subject-line">Subject Line Generator</option>
                <option value="custom">Custom/Freeform</option>
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

            {/* Advanced Parameters */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-4">Advanced Parameters</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Temperature: {temperature.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">Lower = more focused, Higher = more creative</p>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Max Tokens
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="4000"
                    step="100"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">Maximum length of response</p>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Top P (Nucleus Sampling): {topP.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={topP}
                    onChange={(e) => setTopP(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">Controls diversity via nucleus sampling (1.0 = no filtering)</p>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Presence Penalty: {presencePenalty.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="-2"
                    max="2"
                    step="0.1"
                    value={presencePenalty}
                    onChange={(e) => setPresencePenalty(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">Penalize tokens based on whether they appear (positive = less repetition)</p>
                </div>

                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Frequency Penalty: {frequencyPenalty.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="-2"
                    max="2"
                    step="0.1"
                    value={frequencyPenalty}
                    onChange={(e) => setFrequencyPenalty(parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">Penalize tokens based on frequency (positive = less repetition)</p>
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
                  Prompt
                </label>
                {savedPromptInfo && (
                  <span className="text-xs text-green-600">
                    ✓ Saved {new Date(savedPromptInfo.updated_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={15}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder="Enter your prompt here..."
              />

              <button
                onClick={handleTest}
                disabled={testing || !prompt.trim()}
                className="mt-4 w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {testing ? 'Testing...' : 'Test Prompt'}
              </button>
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
                    {currentResponse.response}
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
                      className="p-3 bg-gray-50 rounded border border-gray-200 cursor-pointer hover:bg-gray-100"
                      onClick={() => setCurrentResponse(result)}
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
    </Layout>
  )
}
