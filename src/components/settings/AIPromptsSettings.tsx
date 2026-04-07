'use client'

import Link from 'next/link'
import { useAIPrompts } from './ai-prompts/useAIPrompts'
import { PromptCard } from './ai-prompts/PromptCard'
import { CriteriaSection } from './ai-prompts/CriteriaSection'
import { TestResultsModal } from './ai-prompts/TestResultsModal'

export default function AIPromptsSettings() {
  const h = useAIPrompts()

  if (h.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
      </div>
    )
  }

  const makePromptCardProps = (prompt: any) => ({
    prompt,
    isExpanded: h.expandedPrompt === prompt.key,
    isEditing: h.editingPrompt?.key === prompt.key,
    isSaving: h.saving === prompt.key,
    editingValue: h.editingPrompt?.key === prompt.key ? h.editingPrompt?.value ?? null : null,
    prettyPrint: h.prettyPrint,
    setPrettyPrint: h.setPrettyPrint,
    onToggleExpand: () => h.setExpandedPrompt(h.expandedPrompt === prompt.key ? null : prompt.key),
    onEdit: () => h.handleEdit(prompt),
    onCancel: h.handleCancel,
    onSave: () => h.handleSave(prompt.key),
    onReset: () => h.handleReset(prompt.key),
    onSaveAsDefault: () => h.handleSaveAsDefault(prompt.key),
    onTest: () => h.handleTestPrompt(prompt.key),
    onChangeEditValue: (value: string) => h.setEditingPrompt({ key: prompt.key, value }),
  })

  const criteriaSectionSharedProps = {
    saving: h.saving,
    expandedPrompt: h.expandedPrompt,
    editingPrompt: h.editingPrompt,
    editingWeight: h.editingWeight,
    prettyPrint: h.prettyPrint,
    setPrettyPrint: h.setPrettyPrint,
    onSetExpandedPrompt: h.setExpandedPrompt,
    onSetEditingPrompt: h.setEditingPrompt,
    onSetEditingWeight: h.setEditingWeight,
    onEdit: h.handleEdit,
    onCancel: h.handleCancel,
    onSave: h.handleSave,
    onReset: h.handleReset,
    onSaveAsDefault: h.handleSaveAsDefault,
    onTest: h.handleTestPrompt,
    onWeightEdit: h.handleWeightEdit,
    onWeightCancel: h.handleWeightCancel,
    onWeightSave: h.handleWeightSave,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">AI Prompts</h2>
        <p className="text-sm text-gray-600">
          Customize the AI prompts used throughout the newsletter system. Changes take effect immediately.
          Use <code className="bg-gray-100 px-1 rounded text-xs">{'{{}}'}</code> placeholders for dynamic content.
        </p>
        {h.message && (
          <div className={`mt-4 p-3 rounded ${h.message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {h.message}
          </div>
        )}
      </div>

      {/* Primary Criteria */}
      <CriteriaSection
        title="Primary Article Prompts"
        description="Configure evaluation criteria and content generation for primary (top) articles. Includes Article Title and Article Body prompts."
        isSecondary={false}
        criteria={h.primaryCriteria}
        criteriaPrompts={h.criteriaPrompts}
        enabledCount={h.primaryEnabledCount}
        rssPosts={h.primaryRssPosts}
        selectedRssPost={h.selectedPrimaryRssPost}
        loadingRssPosts={h.loadingPrimaryRssPosts}
        titlePrompt={h.primaryTitlePrompt}
        bodyPrompt={h.primaryBodyPrompt}
        editingName={h.editingPrimaryName}
        onSetEditingName={h.setEditingPrimaryName}
        onSetSelectedRssPost={h.setSelectedPrimaryRssPost}
        onAddCriteria={() => h.handleChangeCriteriaCount(false, 1)}
        onRemoveCriteria={() => h.handleChangeCriteriaCount(false, -1)}
        onNameSave={(n) => h.handleCriteriaNameSave(n, false)}
        {...criteriaSectionSharedProps}
      />

      {/* Secondary Criteria */}
      <CriteriaSection
        title="Secondary Article Prompts"
        description="Configure evaluation criteria and content generation for secondary (bottom) articles. Includes Article Title and Article Body prompts."
        isSecondary={true}
        criteria={h.secondaryCriteria}
        criteriaPrompts={h.secondaryCriteriaPrompts}
        enabledCount={h.secondaryEnabledCount}
        rssPosts={h.secondaryRssPosts}
        selectedRssPost={h.selectedSecondaryRssPost}
        loadingRssPosts={h.loadingSecondaryRssPosts}
        titlePrompt={h.secondaryTitlePrompt}
        bodyPrompt={h.secondaryBodyPrompt}
        editingName={h.editingSecondaryName}
        onSetEditingName={h.setEditingSecondaryName}
        onSetSelectedRssPost={h.setSelectedSecondaryRssPost}
        onAddCriteria={() => h.handleChangeCriteriaCount(true, 1)}
        onRemoveCriteria={() => h.handleChangeCriteriaCount(true, -1)}
        onNameSave={(n) => h.handleCriteriaNameSave(n, true)}
        {...criteriaSectionSharedProps}
      />

      {/* Secondary Other Prompts */}
      {h.secondaryOtherPrompts.length > 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Other Secondary Prompts</h3>
            <p className="text-sm text-gray-600 mt-1">
              Additional AI prompts for secondary article processing (content evaluator, etc.)
            </p>
          </div>
          <div className="divide-y divide-gray-200">
            {h.secondaryOtherPrompts.map((prompt) => (
              <PromptCard key={prompt.key} {...makePromptCardProps(prompt)} />
            ))}
          </div>
        </div>
      )}

      {/* Other Prompts by Category */}
      {Object.entries(h.otherGrouped).map(([category, categoryPrompts]) => (
        <div key={category} className="bg-white shadow rounded-lg">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">{category}</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {(categoryPrompts as any[]).map((prompt) => (
              <PromptCard key={prompt.key} {...makePromptCardProps(prompt)} />
            ))}
          </div>
        </div>
      ))}

      {/* Help Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h4 className="font-medium text-blue-900 mb-3">Prompt Placeholders</h4>
        <div className="text-sm text-blue-800 space-y-2">
          <p><code className="bg-blue-100 px-2 py-0.5 rounded">{'{'}title{'}'}</code> - Article/event title</p>
          <p><code className="bg-blue-100 px-2 py-0.5 rounded">{'{'}description{'}'}</code> - Article/event description</p>
          <p><code className="bg-blue-100 px-2 py-0.5 rounded">{'{'}content{'}'}</code> - Full article content</p>
          <p><code className="bg-blue-100 px-2 py-0.5 rounded">{'{'}date{'}'}</code> - Issue date</p>
          <p><code className="bg-blue-100 px-2 py-0.5 rounded">{'{'}headline{'}'}</code> - Newsletter article headline</p>
          <p className="mt-3 text-xs text-blue-700">
            ⚠️ <strong>Important:</strong> Changes take effect immediately. Test prompts carefully before saving.
          </p>
        </div>
      </div>

      {/* Testing Playground */}
      {h.newsletterSlug && (
        <div className="flex justify-center">
          <Link
            href={`https://www.aiprodaily.com/dashboard/${h.newsletterSlug}/settings/AIPromptTesting`}
            className="px-6 py-3 text-base font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors duration-200 shadow-md hover:shadow-lg"
          >
            Testing Playground
          </Link>
        </div>
      )}

      {/* Test Modal */}
      <TestResultsModal
        isOpen={h.testModalOpen}
        onClose={() => h.setTestModalOpen(false)}
        loading={h.testLoading}
        error={h.testError}
        results={h.testResults}
      />
    </div>
  )
}
