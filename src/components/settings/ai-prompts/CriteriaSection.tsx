'use client'

import { detectProviderFromPrompt, formatJSON } from './utils'
import { PromptCard } from './PromptCard'

interface CriteriaSectionProps {
  title: string
  description: string
  isSecondary: boolean
  criteria: any[]
  criteriaPrompts: any[]
  enabledCount: number
  saving: string | null
  expandedPrompt: string | null
  editingPrompt: {key: string, value: string} | null
  editingWeight: {key: string, value: string} | null
  editingName: {number: number, value: string} | null
  prettyPrint: boolean
  setPrettyPrint: (v: boolean) => void
  rssPosts: any[]
  selectedRssPost: string
  loadingRssPosts: boolean
  titlePrompt: any
  bodyPrompt: any
  onSetActiveTab?: () => void
  onSetExpandedPrompt: (key: string | null) => void
  onSetEditingPrompt: (v: {key: string, value: string} | null) => void
  onSetEditingWeight: (v: {key: string, value: string} | null) => void
  onSetEditingName: (v: {number: number, value: string} | null) => void
  onSetSelectedRssPost: (id: string) => void
  onAddCriteria: () => void
  onRemoveCriteria: () => void
  onEdit: (prompt: any) => void
  onCancel: () => void
  onSave: (key: string) => void
  onReset: (key: string) => void
  onSaveAsDefault: (key: string) => void
  onTest: (key: string) => void
  onWeightEdit: (prompt: any) => void
  onWeightCancel: () => void
  onWeightSave: (key: string) => void
  onNameSave: (number: number) => void
}

export function CriteriaSection({
  title,
  description,
  isSecondary,
  criteria,
  criteriaPrompts,
  enabledCount,
  saving,
  expandedPrompt,
  editingPrompt,
  editingWeight,
  editingName,
  prettyPrint,
  setPrettyPrint,
  rssPosts,
  selectedRssPost,
  loadingRssPosts,
  titlePrompt,
  bodyPrompt,
  onSetExpandedPrompt,
  onSetEditingPrompt,
  onSetEditingWeight,
  onSetEditingName,
  onSetSelectedRssPost,
  onAddCriteria,
  onRemoveCriteria,
  onEdit,
  onCancel,
  onSave,
  onReset,
  onSaveAsDefault,
  onTest,
  onWeightEdit,
  onWeightCancel,
  onWeightSave,
  onNameSave,
}: CriteriaSectionProps) {
  const promptKeyPrefix = isSecondary ? 'ai_prompt_secondary_criteria_' : 'ai_prompt_criteria_'
  const addSavingKey = isSecondary ? 'add_secondary_criteria' : 'add_primary_criteria'
  const removeSavingKey = isSecondary ? 'remove_secondary_criteria' : 'remove_primary_criteria'
  const sectionLabel = isSecondary ? 'Secondary' : 'Primary'

  const makePromptCardProps = (prompt: any) => ({
    prompt,
    isExpanded: expandedPrompt === prompt.key,
    isEditing: editingPrompt?.key === prompt.key,
    isSaving: saving === prompt.key,
    editingValue: editingPrompt?.key === prompt.key ? editingPrompt?.value ?? null : null,
    prettyPrint,
    setPrettyPrint,
    onToggleExpand: () => onSetExpandedPrompt(expandedPrompt === prompt.key ? null : prompt.key),
    onEdit: () => onEdit(prompt),
    onCancel,
    onSave: () => onSave(prompt.key),
    onReset: () => onReset(prompt.key),
    onSaveAsDefault: () => onSaveAsDefault(prompt.key),
    onTest: () => onTest(prompt.key),
    onChangeEditValue: (value: string) => onSetEditingPrompt({ key: prompt.key, value }),
    expectedResponseHint: prompt.key.includes('_title')
      ? 'Plain text OR { "headline": "<text>" }'
      : '{ "content": "<text>", "word_count": <integer> }',
  })

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">{title}</h3>
            <p className="text-sm text-gray-600 mt-1">{description} {enabledCount} of 5 criteria enabled.</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onAddCriteria}
              disabled={enabledCount >= 5 || saving === addSavingKey}
              className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving === addSavingKey ? 'Adding...' : 'Add Criteria'}
            </button>
            <button
              onClick={onRemoveCriteria}
              disabled={enabledCount <= 1 || saving === removeSavingKey}
              className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving === removeSavingKey ? 'Removing...' : 'Remove Criteria'}
            </button>
          </div>
        </div>
        {/* RSS Post Selector */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            RSS Post for Testing {sectionLabel} Prompts
          </label>
          <select
            value={selectedRssPost}
            onChange={(e) => onSetSelectedRssPost(e.target.value)}
            disabled={loadingRssPosts}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            {loadingRssPosts ? (
              <option>Loading posts...</option>
            ) : rssPosts.length === 0 ? (
              <option>No {sectionLabel.toLowerCase()} RSS posts available</option>
            ) : (
              rssPosts.map((post) => (
                <option key={post.id} value={post.id}>
                  {post.title} {post.rss_feed?.name ? `(${post.rss_feed.name})` : ''} - {new Date(post.processed_at).toLocaleDateString()}
                </option>
              ))
            )}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Only showing posts from feeds assigned to {sectionLabel} section
          </p>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {criteria.filter(c => c.enabled).map((criterion) => {
          const promptKey = `${promptKeyPrefix}${criterion.number}`
          const prompt = criteriaPrompts.find(p => p.key === promptKey)
          if (!prompt && isSecondary) return null

          const isExpanded = expandedPrompt === promptKey
          const isEditing = editingPrompt?.key === promptKey
          const isSaving = saving === promptKey
          const isEditingWeightThis = editingWeight?.key === promptKey
          const isEditingNameThis = editingName?.number === criterion.number
          const criteriaName = isSecondary ? criterion.secondaryName : criterion.name
          const criteriaWeight = isSecondary ? (criterion.secondaryWeight || 1.0) : criterion.weight

          return (
            <div key={criterion.number} className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  {/* Criteria Name */}
                  <div className="flex items-center space-x-2 mb-2">
                    <label className="text-xs font-medium text-gray-500 uppercase">Criteria Name:</label>
                    {isEditingNameThis ? (
                      <>
                        <input
                          type="text"
                          value={editingName?.value || ''}
                          onChange={(e) => onSetEditingName({ number: criterion.number, value: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded text-sm flex-1 max-w-xs"
                          placeholder="Enter criteria name"
                        />
                        <button
                          onClick={() => onNameSave(criterion.number)}
                          disabled={saving === `criteria_${criterion.number}_name`}
                          className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {saving === `criteria_${criterion.number}_name` ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => onSetEditingName(null)}
                          disabled={saving === `criteria_${criterion.number}_name`}
                          className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <h4 className="text-base font-medium text-gray-900">{criteriaName}</h4>
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
                          onClick={() => onSetEditingName({ number: criterion.number, value: criteriaName })}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Edit Name
                        </button>
                      </>
                    )}
                  </div>

                  {/* Weight */}
                  <div className="mt-2 flex items-center space-x-3">
                    <label className="text-sm font-medium text-gray-700">Weight:</label>
                    {isEditingWeightThis ? (
                      <>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.1"
                          value={editingWeight?.value || '1.0'}
                          onChange={(e) => onSetEditingWeight({ key: promptKey, value: e.target.value })}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                        <button
                          onClick={() => onWeightSave(promptKey)}
                          disabled={isSaving}
                          className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={onWeightCancel}
                          disabled={isSaving}
                          className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-semibold text-brand-primary">{criteriaWeight}</span>
                        <button
                          onClick={() => onWeightEdit({ key: promptKey, weight: criteriaWeight.toString() })}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        <span className="text-xs text-gray-500">
                          (Max final score contribution: {(criteriaWeight * 10).toFixed(1)} points)
                        </span>
                      </>
                    )}
                  </div>

                  {prompt && <p className="text-sm text-gray-600 mt-2">{prompt.description}</p>}
                </div>
                <button
                  onClick={() => onSetExpandedPrompt(isExpanded ? null : promptKey)}
                  className="ml-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  {isExpanded ? 'Collapse' : 'View/Edit Prompt'}
                </button>
              </div>

              {isExpanded && prompt && (
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">Prompt Content</label>
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
                        onChange={(e) => editingPrompt && onSetEditingPrompt({ ...editingPrompt, value: e.target.value })}
                        rows={15}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="mt-2 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                        <span className="font-medium">Expected Response:</span>{' '}
                        <code className="bg-amber-100 px-1 rounded">{'{ "score": <0-10>, "reason": "<explanation>" }'}</code>
                      </p>
                      <div className="mt-3 flex items-center justify-between">
                        <button
                          onClick={() => onTest(promptKey)}
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
                            onClick={() => onSave(promptKey)}
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
                            onClick={() => onReset(promptKey)}
                            disabled={saving === promptKey}
                            className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                          >
                            {saving === promptKey ? 'Resetting...' : 'Reset to Default'}
                          </button>
                          <button
                            onClick={() => onSaveAsDefault(promptKey)}
                            disabled={saving === promptKey}
                            className="px-4 py-2 text-sm font-medium text-green-700 bg-white border border-green-300 rounded-md hover:bg-green-50 disabled:opacity-50"
                          >
                            {saving === promptKey ? 'Saving...' : 'Save as Default'}
                          </button>
                        </div>
                        <button
                          onClick={() => onEdit(prompt)}
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
        })}

        {/* Article Title + Body Prompts */}
        {titlePrompt && <PromptCard {...makePromptCardProps(titlePrompt)} />}
        {bodyPrompt && <PromptCard {...makePromptCardProps(bodyPrompt)} />}
      </div>
    </div>
  )
}
