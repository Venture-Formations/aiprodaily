'use client'

interface GlobalPromptCardProps {
  promptKey: string
  label: string
  description: string
  value: string | null
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
  onResetToDefault: () => void
  onSaveAsDefault: () => void
  setPrettyPrint: (value: boolean) => void
}

// Global Prompt Card Component (for deduplication and fact checker)
export function GlobalPromptCard({
  promptKey,
  label,
  description,
  value,
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
  onResetToDefault,
  onSaveAsDefault,
  setPrettyPrint
}: GlobalPromptCardProps) {
  // Helper to format JSON for display
  const formatJSON = (val: string | null, pretty: boolean): string => {
    if (!val) return ''
    try {
      const parsed = JSON.parse(val)
      return pretty ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed)
    } catch {
      return val
    }
  }

  // Detect provider from prompt JSON
  const detectProvider = (promptJson: string | null): 'claude' | 'openai' => {
    if (!promptJson) return 'openai'
    const lower = promptJson.toLowerCase()
    if (lower.includes('claude') || lower.includes('anthropic')) return 'claude'
    return 'openai'
  }

  return (
    <div className="p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <h4 className="text-sm font-medium text-gray-900">{label}</h4>
            {value && (
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                detectProvider(value) === 'claude'
                  ? 'bg-purple-100 text-purple-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {detectProvider(value) === 'claude' ? 'Claude' : 'OpenAI'}
              </span>
            )}
            <span className="px-2 py-0.5 text-xs font-medium rounded bg-amber-100 text-amber-800">
              Global
            </span>
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
          {/* Warning banner */}
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex gap-2">
              <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-xs text-amber-700">
                Changes to this prompt will affect all article sections in this publication.
              </p>
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              Prompt Content
            </label>
            <span className="text-xs text-gray-500">
              {isEditing
                ? editingValue?.length || 0
                : (value?.length || 0)} characters
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
                  {promptKey.includes('deduper')
                    ? '{ "groups": [...], "unique_articles": [<indices>] }'
                    : '{ "score": <3-30>, "details": "<text>", "passed": <boolean> }'}
                </code>
              </p>
              <div className="mt-3 flex items-center justify-end">
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
                {value ? formatJSON(value, prettyPrint) : 'No prompt configured'}
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
