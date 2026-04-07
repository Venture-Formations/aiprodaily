'use client'

import type { ArticleModuleCriteria } from '@/types/database'
import { detectProviderFromPrompt, formatJSON } from '@/components/settings/ai-prompts/utils'

export interface CriterionCardProps {
  criterion: ArticleModuleCriteria
  saving: string | null
  expandedPrompt: string | null
  editingPrompt: { key: string; value: string } | null
  editingWeight: { key: string; value: string } | null
  editingCriteriaName: { id: string; value: string } | null
  editingMinimum: { id: string; value: string } | null
  prettyPrint: boolean
  testingPrompt: boolean
  testResult: any

  // State setters
  setExpandedPrompt: (key: string | null) => void
  setEditingPrompt: (val: { key: string; value: string } | null) => void
  setEditingWeight: (val: { key: string; value: string } | null) => void
  setEditingCriteriaName: (val: { id: string; value: string } | null) => void
  setEditingMinimum: (val: { id: string; value: string } | null) => void
  setPrettyPrint: (val: boolean) => void

  // Handlers
  onNameEdit: (criterion: ArticleModuleCriteria) => void
  onNameSave: (criterion: ArticleModuleCriteria) => void
  onWeightEdit: (criterion: ArticleModuleCriteria) => void
  onWeightSave: (criterion: ArticleModuleCriteria) => void
  onToggleEnforceMinimum: (criterion: ArticleModuleCriteria, checked: boolean) => void
  onMinimumEdit: (criterion: ArticleModuleCriteria) => void
  onMinimumSave: (criterion: ArticleModuleCriteria) => void
  onEdit: (key: string, value: string) => void
  onCancel: () => void
  onSaveCriterionPrompt: (criterion: ArticleModuleCriteria) => void
  onResetToDefault: (key: string, type: 'criterion' | 'prompt') => void
  onSaveAsDefault: (key: string, type: 'criterion' | 'prompt') => void
  onTestPrompt: (promptKey: string) => void
}

export function CriterionCard({
  criterion,
  saving,
  expandedPrompt,
  editingPrompt,
  editingWeight,
  editingCriteriaName,
  editingMinimum,
  prettyPrint,
  testingPrompt,
  testResult,
  setExpandedPrompt,
  setEditingPrompt,
  setEditingWeight,
  setEditingCriteriaName,
  setEditingMinimum,
  setPrettyPrint,
  onNameEdit,
  onNameSave,
  onWeightEdit,
  onWeightSave,
  onToggleEnforceMinimum,
  onMinimumEdit,
  onMinimumSave,
  onEdit,
  onCancel,
  onSaveCriterionPrompt,
  onResetToDefault,
  onSaveAsDefault,
  onTestPrompt,
}: CriterionCardProps) {
  const promptKey = `criterion_${criterion.id}`
  const isExpanded = expandedPrompt === promptKey
  const isEditing = editingPrompt?.key === promptKey
  const isSaving = saving === criterion.id
  const isEditingWeight = editingWeight?.key === criterion.id
  const isEditingName = editingCriteriaName?.id === criterion.id

  return (
    <div className="p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          {/* Criteria Name */}
          <div className="flex items-center space-x-2 mb-2">
            <label className="text-xs font-medium text-gray-500 uppercase">Criteria Name:</label>
            {isEditingName ? (
              <>
                <input
                  type="text"
                  value={editingCriteriaName?.value || ''}
                  onChange={(e) => setEditingCriteriaName({ id: criterion.id, value: e.target.value })}
                  className="px-2 py-1 border border-gray-300 rounded text-sm flex-1 max-w-xs"
                  placeholder="Enter criteria name"
                />
                <button
                  onClick={() => onNameSave(criterion)}
                  disabled={saving === `name_${criterion.id}`}
                  className="text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving === `name_${criterion.id}` ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingCriteriaName(null)}
                  disabled={saving === `name_${criterion.id}`}
                  className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <h4 className="text-sm font-medium text-gray-900">{criterion.name}</h4>
                {!isEditing && criterion.ai_prompt && (
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                    detectProviderFromPrompt(criterion.ai_prompt) === 'claude'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {detectProviderFromPrompt(criterion.ai_prompt) === 'claude' ? 'Claude' : 'OpenAI'}
                  </span>
                )}
                <button
                  onClick={() => onNameEdit(criterion)}
                  className="text-xs text-emerald-600 hover:text-emerald-800"
                >
                  Edit Name
                </button>
              </>
            )}
          </div>

          {/* Weight Input */}
          <div className="mt-2 flex items-center space-x-3">
            <label className="text-sm font-medium text-gray-700">Weight:</label>
            {isEditingWeight ? (
              <>
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  value={editingWeight?.value || '1.0'}
                  onChange={(e) => setEditingWeight({ key: criterion.id, value: e.target.value })}
                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <button
                  onClick={() => onWeightSave(criterion)}
                  disabled={saving === `weight_${criterion.id}`}
                  className="text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving === `weight_${criterion.id}` ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingWeight(null)}
                  disabled={saving === `weight_${criterion.id}`}
                  className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span className="text-sm font-semibold text-emerald-600">{criterion.weight || 1.0}</span>
                <button
                  onClick={() => onWeightEdit(criterion)}
                  className="text-xs text-emerald-600 hover:text-emerald-800"
                >
                  Edit
                </button>
                <span className="text-xs text-gray-500">
                  (Max final score contribution: {((criterion.weight || 1) * 10).toFixed(1)} points)
                </span>
              </>
            )}
          </div>

          {/* Minimum Score Enforcement */}
          <div className="mt-3 flex items-center space-x-3 pt-3 border-t border-gray-100">
            <div className="flex items-center">
              <input
                type="checkbox"
                id={`enforce-min-${criterion.id}`}
                checked={criterion.enforce_minimum || false}
                onChange={(e) => onToggleEnforceMinimum(criterion, e.target.checked)}
                disabled={saving?.startsWith('enforce_') || isEditingWeight}
                className="h-4 w-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
              />
              <label
                htmlFor={`enforce-min-${criterion.id}`}
                className="ml-2 text-sm font-medium text-gray-700 cursor-pointer"
              >
                Enforce Minimum Score
              </label>
            </div>

            {criterion.enforce_minimum && (
              <>
                <span className="text-gray-400">|</span>
                {editingMinimum?.id === criterion.id ? (
                  <>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="1"
                      value={editingMinimum?.value || '5'}
                      onChange={(e) => setEditingMinimum({ id: criterion.id, value: e.target.value })}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <button
                      onClick={() => onMinimumSave(criterion)}
                      disabled={saving === `minimum_${criterion.id}`}
                      className="text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {saving === `minimum_${criterion.id}` ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingMinimum(null)}
                      className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-gray-600">
                      Minimum: <span className="font-semibold text-amber-600">{criterion.minimum_score ?? 5}</span>/10
                    </span>
                    <button
                      onClick={() => onMinimumEdit(criterion)}
                      className="text-xs text-emerald-600 hover:text-emerald-800"
                    >
                      Edit
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          {/* Warning about minimum score exclusion */}
          {criterion.enforce_minimum && (
            <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
              <svg className="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Articles scoring below {criterion.minimum_score ?? 5} on this criterion will be excluded from the newsletter.
            </div>
          )}
        </div>
        <button
          onClick={() => setExpandedPrompt(isExpanded ? null : promptKey)}
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
                ? editingPrompt?.value.length || 0
                : (criterion.ai_prompt?.length || 0)} characters
            </span>
          </div>
          {isEditing ? (
            <>
              <textarea
                value={editingPrompt?.value || ''}
                onChange={(e) => editingPrompt && setEditingPrompt({ ...editingPrompt, value: e.target.value })}
                rows={15}
                className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="mt-2 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                <span className="font-medium">Expected Response:</span>{' '}
                <code className="bg-amber-100 px-1 rounded">{'{ "score": <0-10>, "reason": "<explanation>" }'}</code>
              </p>
              <div className="mt-3 flex items-center justify-between">
                <button
                  onClick={() => onTestPrompt(promptKey)}
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
                    onClick={() => onSaveCriterionPrompt(criterion)}
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
                {criterion.ai_prompt ? formatJSON(criterion.ai_prompt, prettyPrint) : 'No prompt configured'}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => onResetToDefault(criterion.id, 'criterion')}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                  >
                    Reset to Default
                  </button>
                  <button
                    onClick={() => onSaveAsDefault(criterion.id, 'criterion')}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-green-700 bg-white border border-green-300 rounded-md hover:bg-green-50 disabled:opacity-50"
                  >
                    Save as Default
                  </button>
                </div>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => onEdit(promptKey, criterion.ai_prompt || '')}
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
