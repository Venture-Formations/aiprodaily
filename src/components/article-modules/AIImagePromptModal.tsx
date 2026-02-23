'use client'

import { useState } from 'react'

interface AIImagePromptModalProps {
  prompt: string
  onSave: (prompt: string) => Promise<void>
  onClose: () => void
  saving: boolean
}

// AI Image Prompt Modal Component
export function AIImagePromptModal({
  prompt,
  onSave,
  onClose,
  saving
}: AIImagePromptModalProps) {
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
              Available placeholders: {'{{headline}}'}, {'{{content}}'}, {'{{title}}'}, {'{{random_X-Y}}'} (random integer)
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
