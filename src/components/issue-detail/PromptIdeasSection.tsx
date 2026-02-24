'use client'

import { useState, useEffect } from 'react'

export default function PromptIdeasSection({ issue }: { issue: any }) {
  const [prompt, setPrompt] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPrompt = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/campaigns/${issue.id}/prompt`)
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.prompt) {
            setPrompt(data.prompt)
          }
        }
      } catch (error) {
        console.error('Failed to fetch prompt:', error)
      } finally {
        setLoading(false)
      }
    }

    if (issue?.id) {
      fetchPrompt()
    }
  }, [issue?.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
        <span className="ml-3 text-gray-600">Loading prompt...</span>
      </div>
    )
  }

  if (!prompt) {
    return (
      <div className="text-center py-8 text-gray-500">
        No prompt selected for this issue
      </div>
    )
  }

  return (
    <div className="p-6">
      <h3 className="text-xl font-bold text-gray-900 mb-4">{prompt.title}</h3>
      <div
        className="p-6 rounded-lg font-mono text-sm leading-relaxed"
        style={{
          backgroundColor: '#000000',
          color: '#00FF00',
          fontFamily: "'Courier New', Courier, monospace",
          whiteSpace: 'pre-wrap',
          border: '2px solid #333'
        }}
      >
        {prompt.prompt_text}
      </div>
      {prompt.use_case && (
        <div className="mt-4 text-sm text-gray-600">
          <strong>Use Case:</strong> {prompt.use_case}
        </div>
      )}
      {prompt.category && (
        <div className="mt-2 text-sm text-gray-600">
          <strong>Category:</strong> {prompt.category}
        </div>
      )}
    </div>
  )
}
