'use client'

import type { ArticleModuleCriteria, ArticleModulePrompt } from '@/types/database'
import { useArticleModulePrompts } from './prompts-tab/useArticleModulePrompts'
import { CriterionCard } from './prompts-tab/CriterionCard'
import { EvaluationOrderList } from './prompts-tab/EvaluationOrderList'
import { ArticlePromptCard } from './ArticlePromptCard'
import { GlobalPromptCard } from './GlobalPromptCard'
import { AIImagePromptModal } from './AIImagePromptModal'

interface ArticleModulePromptsTabProps {
  moduleId: string
  publicationId: string
  criteria: ArticleModuleCriteria[]
  prompts: ArticleModulePrompt[]
  aiImagePrompt: string | null
  onAiImagePromptChange: (prompt: string | null) => Promise<void>
}

export default function ArticleModulePromptsTab(props: ArticleModulePromptsTabProps) {
  const h = useArticleModulePrompts(props)

  if (h.loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-6 w-6 text-emerald-600" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Messages */}
      {h.error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center justify-between">
          <span>{h.error}</span>
          <button onClick={() => h.setError(null)} className="text-red-500 hover:text-red-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      {h.message && (
        <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm flex items-center justify-between">
          <span>{h.message}</span>
          <button onClick={() => h.setMessage(null)} className="text-green-500 hover:text-green-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* RSS Post Selector for Testing */}
      <div className="p-4 bg-gray-50 rounded-lg">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          RSS Post for Testing Prompts
        </label>
        <select
          value={h.selectedRssPost}
          onChange={(e) => h.setSelectedRssPost(e.target.value)}
          disabled={h.loadingRssPosts}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500"
        >
          {h.loadingRssPosts ? (
            <option>Loading posts...</option>
          ) : h.rssPosts.length === 0 ? (
            <option>No RSS posts available</option>
          ) : (
            h.rssPosts.map((post) => (
              <option key={post.id} value={post.id}>
                {post.title?.substring(0, 80)}... {post.rss_feed?.name ? `(${post.rss_feed.name})` : ''}
              </option>
            ))
          )}
        </select>
        <p className="mt-1 text-xs text-gray-500">
          Select a post to use when testing prompts
        </p>
      </div>

      {/* Scoring Criteria */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-gray-900">Scoring Criteria</h4>
              <p className="text-xs text-gray-500 mt-0.5">
                Configure evaluation criteria for scoring articles. {h.criteria.filter(c => c.is_active).length} of {h.criteria.length} criteria active.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={h.handleAddCriterion}
                disabled={h.criteria.length >= 5 || h.saving === 'add_criterion'}
                className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {h.saving === 'add_criterion' ? 'Adding...' : 'Add Criteria'}
              </button>
              {h.criteria.length > 1 && (
                <button
                  onClick={() => h.handleDeleteCriterion(h.criteria[h.criteria.length - 1].id)}
                  disabled={h.saving?.startsWith('delete_')}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {h.saving?.startsWith('delete_') ? 'Removing...' : 'Remove Criteria'}
                </button>
              )}
            </div>
          </div>
        </div>

        <EvaluationOrderList
          criteria={h.criteria}
          saving={h.saving}
          onReorder={h.handleReorderEvalOrder}
        />

        <div className="divide-y divide-gray-200">
          {h.criteria.filter(c => c.is_active).map((criterion) => (
            <CriterionCard
              key={criterion.id}
              criterion={criterion}
              saving={h.saving}
              expandedPrompt={h.expandedPrompt}
              editingPrompt={h.editingPrompt}
              editingWeight={h.editingWeight}
              editingCriteriaName={h.editingCriteriaName}
              editingMinimum={h.editingMinimum}
              prettyPrint={h.prettyPrint}
              testingPrompt={h.testingPrompt}
              testResult={h.testResult}
              setExpandedPrompt={h.setExpandedPrompt}
              setEditingPrompt={h.setEditingPrompt}
              setEditingWeight={h.setEditingWeight}
              setEditingCriteriaName={h.setEditingCriteriaName}
              setEditingMinimum={h.setEditingMinimum}
              setPrettyPrint={h.setPrettyPrint}
              onNameEdit={h.handleNameEdit}
              onNameSave={h.handleNameSave}
              onWeightEdit={h.handleWeightEdit}
              onWeightSave={h.handleWeightSave}
              onToggleEnforceMinimum={h.handleToggleEnforceMinimum}
              onMinimumEdit={h.handleMinimumEdit}
              onMinimumSave={h.handleMinimumSave}
              onEdit={h.handleEdit}
              onCancel={h.handleCancel}
              onSaveCriterionPrompt={h.handleSaveCriterionPrompt}
              onResetToDefault={h.handleResetToDefault}
              onSaveAsDefault={h.handleSaveAsDefault}
              onTestPrompt={h.handleTestPrompt}
            />
          ))}
        </div>
      </div>

      {/* Article Prompts */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-900">Article Prompts</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure prompts for generating article titles and body content.
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {h.titlePrompt && (
            <ArticlePromptCard
              prompt={h.titlePrompt}
              label="Article Title Prompt"
              description="Generates headlines for articles based on the original content"
              isExpanded={h.expandedPrompt === `prompt_${h.titlePrompt.id}`}
              isEditing={h.editingPrompt?.key === `prompt_${h.titlePrompt.id}`}
              editingValue={h.editingPrompt?.key === `prompt_${h.titlePrompt.id}` ? h.editingPrompt.value : null}
              isSaving={h.saving === h.titlePrompt.id}
              prettyPrint={h.prettyPrint}
              onToggleExpand={() => h.setExpandedPrompt(h.expandedPrompt === `prompt_${h.titlePrompt!.id}` ? null : `prompt_${h.titlePrompt!.id}`)}
              onEdit={() => h.handleEdit(`prompt_${h.titlePrompt!.id}`, h.titlePrompt!.ai_prompt || '')}
              onEditChange={(value) => h.setEditingPrompt({ key: `prompt_${h.titlePrompt!.id}`, value })}
              onCancel={h.handleCancel}
              onSave={() => h.handleSaveArticlePrompt(h.titlePrompt!)}
              onTestPrompt={() => h.handleTestPrompt(`prompt_${h.titlePrompt!.id}`)}
              onResetToDefault={() => h.handleResetToDefault(h.titlePrompt!.id, 'prompt')}
              onSaveAsDefault={() => h.handleSaveAsDefault(h.titlePrompt!.id, 'prompt')}
              testingPrompt={h.testingPrompt}
              testResult={h.testResult}
              setPrettyPrint={h.setPrettyPrint}
            />
          )}

          {h.bodyPrompt && (
            <ArticlePromptCard
              prompt={h.bodyPrompt}
              label="Article Body Prompt"
              description="Generates the main content/summary for articles"
              isExpanded={h.expandedPrompt === `prompt_${h.bodyPrompt.id}`}
              isEditing={h.editingPrompt?.key === `prompt_${h.bodyPrompt.id}`}
              editingValue={h.editingPrompt?.key === `prompt_${h.bodyPrompt.id}` ? h.editingPrompt.value : null}
              isSaving={h.saving === h.bodyPrompt.id}
              prettyPrint={h.prettyPrint}
              onToggleExpand={() => h.setExpandedPrompt(h.expandedPrompt === `prompt_${h.bodyPrompt!.id}` ? null : `prompt_${h.bodyPrompt!.id}`)}
              onEdit={() => h.handleEdit(`prompt_${h.bodyPrompt!.id}`, h.bodyPrompt!.ai_prompt || '')}
              onEditChange={(value) => h.setEditingPrompt({ key: `prompt_${h.bodyPrompt!.id}`, value })}
              onCancel={h.handleCancel}
              onSave={() => h.handleSaveArticlePrompt(h.bodyPrompt!)}
              onTestPrompt={() => h.handleTestPrompt(`prompt_${h.bodyPrompt!.id}`)}
              onResetToDefault={() => h.handleResetToDefault(h.bodyPrompt!.id, 'prompt')}
              onSaveAsDefault={() => h.handleSaveAsDefault(h.bodyPrompt!.id, 'prompt')}
              testingPrompt={h.testingPrompt}
              testResult={h.testResult}
              setPrettyPrint={h.setPrettyPrint}
            />
          )}

          {!h.titlePrompt && !h.bodyPrompt && (
            <div className="p-4 text-center text-sm text-gray-500">
              No article prompts configured. Prompts will be migrated from Publication Settings.
            </div>
          )}
        </div>
      </div>

      {/* AI Image Prompt */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <h4 className="text-sm font-medium text-gray-900">AI Image Generation</h4>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure prompt for generating AI images for articles in this section.
          </p>
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-sm font-medium text-gray-900">AI Image Prompt</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {h.localAiImagePrompt ? 'Configured - AI will generate images for articles' : 'Not configured (optional)'}
              </p>
            </div>
            <button
              onClick={() => h.setEditingAiImagePrompt(true)}
              className="text-emerald-600 hover:text-emerald-800 text-sm font-medium"
            >
              {h.localAiImagePrompt ? 'View/Edit Prompt' : 'Configure'}
            </button>
          </div>

          {h.editingAiImagePrompt && (
            <AIImagePromptModal
              prompt={h.localAiImagePrompt}
              onSave={async (newPrompt) => {
                h.setLocalAiImagePrompt(newPrompt)
                await h.onAiImagePromptChange(newPrompt || null)
                h.setEditingAiImagePrompt(false)
              }}
              onClose={() => h.setEditingAiImagePrompt(false)}
              saving={h.saving === 'ai_image'}
            />
          )}
        </div>
      </div>

      {/* Global Prompts */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-gray-900">Global Prompts</h4>
              <p className="text-xs text-amber-700 mt-0.5">
                These prompts are shared across all article sections. Changes here will apply to the entire publication.
              </p>
            </div>
          </div>
        </div>

        {h.loadingGlobalPrompts ? (
          <div className="p-8 flex items-center justify-center">
            <svg className="animate-spin h-5 w-5 text-emerald-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            <GlobalPromptCard
              promptKey="ai_prompt_topic_deduper"
              label="Deduplication Prompt"
              description="Identifies and removes duplicate/similar articles across RSS feeds"
              value={h.globalPrompts.deduplication}
              isExpanded={h.expandedGlobalPrompt === 'ai_prompt_topic_deduper'}
              isEditing={h.editingGlobalPrompt?.key === 'ai_prompt_topic_deduper'}
              editingValue={h.editingGlobalPrompt?.key === 'ai_prompt_topic_deduper' ? h.editingGlobalPrompt.value : null}
              isSaving={h.savingGlobalPrompt === 'ai_prompt_topic_deduper'}
              prettyPrint={h.prettyPrint}
              onToggleExpand={() => h.setExpandedGlobalPrompt(h.expandedGlobalPrompt === 'ai_prompt_topic_deduper' ? null : 'ai_prompt_topic_deduper')}
              onEdit={() => h.handleEditGlobalPrompt('ai_prompt_topic_deduper', h.globalPrompts.deduplication || '')}
              onEditChange={(value) => h.setEditingGlobalPrompt({ key: 'ai_prompt_topic_deduper', value })}
              onCancel={h.handleCancelGlobalPrompt}
              onSave={() => h.handleSaveGlobalPrompt('ai_prompt_topic_deduper')}
              onResetToDefault={() => h.handleResetGlobalPromptToDefault('ai_prompt_topic_deduper')}
              onSaveAsDefault={() => h.handleSaveGlobalPromptAsDefault('ai_prompt_topic_deduper')}
              setPrettyPrint={h.setPrettyPrint}
            />

            <GlobalPromptCard
              promptKey="ai_prompt_fact_checker"
              label="Fact Checker Prompt"
              description="Verifies factual accuracy and identifies potential issues in generated content"
              value={h.globalPrompts.factChecker}
              isExpanded={h.expandedGlobalPrompt === 'ai_prompt_fact_checker'}
              isEditing={h.editingGlobalPrompt?.key === 'ai_prompt_fact_checker'}
              editingValue={h.editingGlobalPrompt?.key === 'ai_prompt_fact_checker' ? h.editingGlobalPrompt.value : null}
              isSaving={h.savingGlobalPrompt === 'ai_prompt_fact_checker'}
              prettyPrint={h.prettyPrint}
              onToggleExpand={() => h.setExpandedGlobalPrompt(h.expandedGlobalPrompt === 'ai_prompt_fact_checker' ? null : 'ai_prompt_fact_checker')}
              onEdit={() => h.handleEditGlobalPrompt('ai_prompt_fact_checker', h.globalPrompts.factChecker || '')}
              onEditChange={(value) => h.setEditingGlobalPrompt({ key: 'ai_prompt_fact_checker', value })}
              onCancel={h.handleCancelGlobalPrompt}
              onSave={() => h.handleSaveGlobalPrompt('ai_prompt_fact_checker')}
              onResetToDefault={() => h.handleResetGlobalPromptToDefault('ai_prompt_fact_checker')}
              onSaveAsDefault={() => h.handleSaveGlobalPromptAsDefault('ai_prompt_fact_checker')}
              setPrettyPrint={h.setPrettyPrint}
            />
          </div>
        )}
      </div>
    </div>
  )
}
