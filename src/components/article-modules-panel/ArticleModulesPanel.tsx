'use client'

import type { ArticleModulesPanelProps } from './types'
import { SELECTION_MODE_LABELS } from './types'
import { useArticleModules } from './useArticleModules'
import { ArticleModuleList } from './ArticleModuleList'

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-green-600'
  if (score >= 50) return 'text-yellow-600'
  return 'text-red-600'
}

export default function ArticleModulesPanel({ issueId, issueStatus }: ArticleModulesPanelProps) {
  const isSent = issueStatus === 'sent'
  const {
    loading,
    selections,
    modules,
    expanded,
    saving,
    allArticlesMap,
    loadingModules,
    recheckingImages,
    recheckResult,
    handleRecheckImages,
    toggleExpanded,
    toggleArticle,
    skipArticle,
    handleReorder,
  } = useArticleModules(issueId)

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-4 mt-8">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-20 bg-gray-100 rounded"></div>
        </div>
      </div>
    )
  }

  if (modules.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow mt-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Article Sections</h2>
          <p className="text-sm text-gray-500 mt-1">Dynamic article sections configured in Settings</p>
        </div>
        <div className="p-6">
          <p className="text-gray-500 text-sm">
            No article modules configured. Create article modules in Settings &gt; Sections.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg mt-8">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Article Sections</h2>
          <p className="text-sm text-gray-500 mt-1">Dynamic article sections configured in Settings</p>
        </div>
        <div className="flex items-center gap-2">
          {recheckResult && <span className="text-xs text-gray-500">{recheckResult}</span>}
          <button
            onClick={handleRecheckImages}
            disabled={recheckingImages}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            {recheckingImages ? 'Checking...' : 'Refresh Images'}
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-200">
        {modules.map(module => {
          const selection = selections.find(s => s.article_module_id === module.id)
          const activeArticles = selection?.articles || []
          const allArticles = allArticlesMap[module.id] || []
          const isExpanded = expanded[module.id]
          const isLoadingModule = loadingModules[module.id]
          const selectionMode = module.selection_mode || 'top_score'
          const totalArticles = allArticles.length
          const selectedCount = activeArticles.length

          return (
            <div key={module.id}>
              {/* Module Header */}
              <div
                className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                onClick={() => toggleExpanded(module.id)}
              >
                <div className="flex items-center space-x-3">
                  <span className="font-medium text-gray-900">{module.name}</span>
                  <span className="text-xs text-gray-400">Display Order: {module.display_order}</span>
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                    {SELECTION_MODE_LABELS[selectionMode]}
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  {isExpanded ? (
                    <span className="text-sm text-gray-500">Click to collapse</span>
                  ) : (
                    <span className={`text-sm font-medium ${
                      selectedCount === 0 ? 'text-red-600' :
                      selectedCount >= module.articles_count ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                      {selectedCount}/{module.articles_count} selected
                      {totalArticles > 0 && ` \u2022 ${totalArticles} total articles`}
                    </span>
                  )}
                  <svg
                    className={`w-5 h-5 text-gray-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-6 pb-6 bg-gray-50 border-t border-gray-200">
                  <div className="flex items-center justify-between py-3 text-sm text-gray-600">
                    <span>Check articles to select them for the issue. Drag to reorder selected articles.</span>
                    <span className={`font-medium ${
                      selectedCount === 0 ? 'text-red-600' :
                      selectedCount >= module.articles_count ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                      {selectedCount}/{module.articles_count} selected {totalArticles > 0 && `\u2022 ${totalArticles} total articles`}
                    </span>
                  </div>

                  {isLoadingModule ? (
                    <div className="flex items-center justify-center py-12">
                      <svg className="animate-spin h-8 w-8 text-emerald-600" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    </div>
                  ) : allArticles.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      No articles generated for this section yet.
                      <br />
                      <span className="text-sm">Articles will be generated when the workflow runs.</span>
                    </div>
                  ) : (
                    <ArticleModuleList
                      moduleId={module.id}
                      articles={allArticles}
                      criteriaConfig={module.criteria || []}
                      isSent={isSent}
                      saving={saving}
                      onToggle={(articleId, currentState) => toggleArticle(module.id, articleId, currentState)}
                      onSkip={(articleId) => skipArticle(module.id, articleId)}
                      onReorder={(articleIds) => handleReorder(module.id, articleIds)}
                      getScoreColor={getScoreColor}
                    />
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
