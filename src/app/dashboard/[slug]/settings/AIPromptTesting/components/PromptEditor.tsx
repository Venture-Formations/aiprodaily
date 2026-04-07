'use client'

import type { PromptType, SavedPrompt, TestResult } from '../types'
import { getExpectedResponseHint } from '../types'

interface PromptEditorProps {
  prompt: string
  setPrompt: (p: string) => void
  promptType: PromptType
  testing: boolean
  savedPromptInfo: SavedPrompt | null
  livePrompt: string | null
  livePromptProviderMatches: boolean
  isModified: boolean
  currentResponse: TestResult | null
  onTest: () => void
  onTestMultiple: () => void
  onTestMultipleSecondBatch: () => void
  onResetToLivePrompt: () => void
}

export default function PromptEditor({
  prompt,
  setPrompt,
  promptType,
  testing,
  savedPromptInfo,
  livePrompt,
  livePromptProviderMatches,
  isModified,
  currentResponse,
  onTest,
  onTestMultiple,
  onTestMultipleSecondBatch,
  onResetToLivePrompt,
}: PromptEditorProps) {
  const hint = getExpectedResponseHint(promptType)

  return (
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
                {'\u2713'} Saved {new Date(savedPromptInfo.updated_at).toLocaleDateString()}
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

        {/* Expected Response Hint */}
        {hint && (
          <p className="mt-2 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
            <span className="font-medium">Expected Response:</span>{' '}
            <code className="bg-amber-100 px-1 rounded">{hint.replace('Expects: ', '')}</code>
          </p>
        )}

        {/* Reset to Live Prompt Button - Only show when provider matches */}
        {livePrompt && livePromptProviderMatches && isModified && (
          <button
            onClick={onResetToLivePrompt}
            className="mt-3 w-full py-2 px-4 bg-purple-100 text-purple-700 font-medium rounded-lg hover:bg-purple-200 border border-purple-300 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset to Live Prompt
          </button>
        )}

        <button
          onClick={onTest}
          disabled={testing || !prompt.trim()}
          className="mt-4 w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {testing ? 'Testing...' : 'Test Prompt'}
        </button>

        <button
          onClick={onTestMultiple}
          disabled={testing || !prompt.trim()}
          className="mt-2 w-full py-3 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {testing ? 'Testing...' : promptType === 'custom'
            ? 'Test Prompt for Multiple (Issues 1-10)'
            : 'Test Prompt for Multiple (Articles 1-10)'}
        </button>

        <button
          onClick={onTestMultipleSecondBatch}
          disabled={testing || !prompt.trim()}
          className="mt-2 w-full py-3 px-4 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {testing ? 'Testing...' : promptType === 'custom'
            ? 'Test Prompt for Multiple (Issues 11-20)'
            : 'Test Prompt for Multiple (Articles 11-20)'}
        </button>
      </div>

      {/* Inline Response Preview */}
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
    </div>
  )
}
