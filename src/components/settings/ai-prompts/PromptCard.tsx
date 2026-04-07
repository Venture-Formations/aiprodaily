'use client'

import { detectProviderFromPrompt, formatJSON } from './utils'

interface PromptCardProps {
  prompt: any
  isExpanded: boolean
  isEditing: boolean
  isSaving: boolean
  editingValue: string | null
  prettyPrint: boolean
  setPrettyPrint: (v: boolean) => void
  onToggleExpand: () => void
  onEdit: () => void
  onCancel: () => void
  onSave: () => void
  onReset: () => void
  onSaveAsDefault: () => void
  onTest: () => void
  onChangeEditValue: (value: string) => void
  expectedResponseHint?: string
}

export function PromptCard({
  prompt,
  isExpanded,
  isEditing,
  isSaving,
  editingValue,
  prettyPrint,
  setPrettyPrint,
  onToggleExpand,
  onEdit,
  onCancel,
  onSave,
  onReset,
  onSaveAsDefault,
  onTest,
  onChangeEditValue,
  expectedResponseHint,
}: PromptCardProps) {
  const provider = detectProviderFromPrompt(isEditing ? editingValue : prompt.value)
  const charCount = isEditing
    ? editingValue?.length || 0
    : typeof prompt.value === 'object'
      ? JSON.stringify(prompt.value).length
      : prompt.value.length

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-base font-medium text-gray-900">{prompt.name}</h4>
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
              provider === 'claude'
                ? 'bg-purple-100 text-purple-800'
                : 'bg-blue-100 text-blue-800'
            }`}>
              {provider === 'claude' ? 'Claude' : 'OpenAI'}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">{prompt.description}</p>
        </div>
        <button
          onClick={onToggleExpand}
          className="ml-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          {isExpanded ? 'Collapse' : 'View/Edit'}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">Prompt Content</label>
            <span className="text-xs text-gray-500">{charCount} characters</span>
          </div>
          {isEditing ? (
            <>
              <textarea
                value={editingValue || ''}
                onChange={(e) => onChangeEditValue(e.target.value)}
                rows={15}
                className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {expectedResponseHint && (
                <p className="mt-2 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                  <span className="font-medium">Expected Response:</span>{' '}
                  <code className="bg-amber-100 px-1 rounded">{expectedResponseHint}</code>
                </p>
              )}
              <div className="mt-3 flex items-center justify-between">
                <button
                  onClick={onTest}
                  className="px-4 py-2 text-sm font-medium text-purple-700 bg-white border border-purple-300 rounded-md hover:bg-purple-50"
                >
                  Test Prompt
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
                    onClick={onReset}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                  >
                    {isSaving ? 'Resetting...' : 'Reset to Default'}
                  </button>
                  <button
                    onClick={onSaveAsDefault}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-green-700 bg-white border border-green-300 rounded-md hover:bg-green-50 disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save as Default'}
                  </button>
                </div>
                <button
                  onClick={onEdit}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Edit Prompt
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
