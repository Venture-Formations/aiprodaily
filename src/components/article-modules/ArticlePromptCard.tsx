'use client'

import type { ArticleModulePrompt } from '@/types/database'

// Helper to format JSON for display
function formatJSON(value: string | null, pretty: boolean): string {
  if (!value) return ''
  try {
    const parsed = JSON.parse(value)
    return pretty ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed)
  } catch {
    return value
  }
}

interface ArticlePromptCardProps {
  prompt: ArticleModulePrompt
  label: string
  description: string
  isExpanded: boolean
  isEditing: boolean
  editingValue: string | null
  isSaving: boolean
  prettyPrint: boolean
  onToggleExpand: () => void
  onEdit: () => void
  onEditChange: (value: string) => void
  onCancel: () => void
  onSave: () => void
  onTestPrompt: () => void
  onResetToDefault: () => void
  onSaveAsDefault: () => void
  testingPrompt: boolean
  testResult: any
  setPrettyPrint: (value: boolean) => void
}

// Article Prompt Card Component (reusable for title/body prompts)
export function ArticlePromptCard({
  prompt,
  label,
  description,
  isExpanded,
  isEditing,
  editingValue,
  isSaving,
  prettyPrint,
  onToggleExpand,
  onEdit,
  onEditChange,
  onCancel,
  onSave,
  onTestPrompt,
  onResetToDefault,
  onSaveAsDefault,
  testingPrompt,
  testResult,
  setPrettyPrint
}: ArticlePromptCardProps) {
  return (
    <div className="p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <h4 className="text-sm font-medium text-gray-900">{label}</h4>
            {prompt.ai_model && (
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                prompt.ai_provider === 'anthropic' || prompt.ai_model?.toLowerCase().includes('claude')
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {prompt.ai_model}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
        <button
          onClick={onToggleExpand}
          className="ml-4 text-emerald-600 hover:text-emerald-800 text-sm font-medium"
        >
          {isExpanded ? 'Collapse' : 'View/Edit Prompt'}
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
                ? editingValue?.length || 0
                : (prompt.ai_prompt?.length || 0)} characters
            </span>
          </div>
          {isEditing ? (
            <>
              <textarea
                value={editingValue || ''}
                onChange={(e) => onEditChange(e.target.value)}
                rows={15}
                className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="mt-2 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                <span className="font-medium">Expected Response:</span>{' '}
                <code className="bg-amber-100 px-1 rounded">
                  {label.toLowerCase().includes('title')
                    ? 'Plain text OR { "headline": "<text>" }'
                    : '{ "content": "<text>", "word_count": <integer> }'}
                </code>
              </p>
              <div className="mt-3 flex items-center justify-between">
                <button
                  onClick={onTestPrompt}
                  disabled={testingPrompt}
                  className="px-4 py-2 text-sm font-medium text-purple-700 bg-white border border-purple-300 rounded-md hover:bg-purple-50 disabled:opacity-50"
                >
                  {testingPrompt ? 'Testing...' : 'Test Prompt'}
                </button>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={onCancel}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onSave}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
              {/* Test Results */}
              {testResult && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <h5 className="text-xs font-medium text-gray-700 mb-2">Test Result</h5>
                  <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="mb-2 flex items-center">
                <label className="flex items-center text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prettyPrint}
                    onChange={(e) => setPrettyPrint(e.target.checked)}
                    className="mr-2 h-4 w-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                  />
                  Pretty-print
                </label>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4 font-mono text-xs whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                {prompt.ai_prompt ? formatJSON(prompt.ai_prompt, prettyPrint) : 'No prompt configured'}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={onResetToDefault}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                  >
                    Reset to Default
                  </button>
                  <button
                    onClick={onSaveAsDefault}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-green-700 bg-white border border-green-300 rounded-md hover:bg-green-50 disabled:opacity-50"
                  >
                    Save as Default
                  </button>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={onEdit}
                    className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700"
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
