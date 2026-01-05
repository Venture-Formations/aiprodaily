'use client'

import { useState, useEffect } from 'react'
import type { ArticleModule, ModuleArticle, ArticleSelectionMode } from '@/types/database'

interface ArticleModulesPanelProps {
  issueId: string
  issueStatus?: string
}

interface ArticleSelection {
  id: string
  issue_id: string
  article_module_id: string
  article_ids: string[]
  selection_mode?: ArticleSelectionMode
  selected_at?: string
  used_at?: string
  article_module?: ArticleModule
  articles?: ModuleArticle[]
}

interface PublicationStyles {
  primaryColor: string
  secondaryColor: string
  tertiaryColor: string
  headingFont: string
  bodyFont: string
}

const SELECTION_MODE_LABELS: Record<ArticleSelectionMode, string> = {
  top_score: 'Top Score',
  manual: 'Manual'
}

export default function ArticleModulesPanel({ issueId, issueStatus }: ArticleModulesPanelProps) {
  const isSent = issueStatus === 'sent'
  const [loading, setLoading] = useState(true)
  const [selections, setSelections] = useState<ArticleSelection[]>([])
  const [modules, setModules] = useState<ArticleModule[]>([])
  const [styles, setStyles] = useState<PublicationStyles>({
    primaryColor: '#667eea',
    secondaryColor: '#764ba2',
    tertiaryColor: '#ffffff',
    headingFont: 'Georgia, serif',
    bodyFont: 'Arial, sans-serif'
  })
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [swapModalOpen, setSwapModalOpen] = useState<string | null>(null)
  const [allArticles, setAllArticles] = useState<ModuleArticle[]>([])
  const [loadingSwap, setLoadingSwap] = useState(false)

  useEffect(() => {
    fetchArticleModules()
  }, [issueId])

  const fetchArticleModules = async () => {
    try {
      const response = await fetch(`/api/campaigns/${issueId}/article-modules`)
      if (response.ok) {
        const data = await response.json()
        setSelections(data.selections || [])
        setModules(data.modules || [])
        if (data.styles) {
          setStyles(data.styles)
        }
      }
    } catch (error) {
      console.error('Failed to fetch article modules:', error)
    } finally {
      setLoading(false)
    }
  }

  const openSwapModal = async (moduleId: string) => {
    setSwapModalOpen(moduleId)
    setLoadingSwap(true)
    try {
      const response = await fetch(`/api/campaigns/${issueId}/article-modules?moduleId=${moduleId}`, {
        method: 'PATCH'
      })
      if (response.ok) {
        const data = await response.json()
        setAllArticles(data.articles || [])
      }
    } catch (error) {
      console.error('Failed to fetch swap articles:', error)
    } finally {
      setLoadingSwap(false)
    }
  }

  const handleSwapArticles = async (moduleId: string, selectedIds: string[]) => {
    setSaving(moduleId)
    try {
      const response = await fetch(`/api/campaigns/${issueId}/article-modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moduleId, articleIds: selectedIds })
      })

      if (response.ok) {
        await fetchArticleModules()
        setSwapModalOpen(null)
      } else {
        const error = await response.json()
        alert(`Failed to swap articles: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to swap articles:', error)
      alert('Failed to swap articles')
    } finally {
      setSaving(null)
    }
  }

  const toggleExpanded = (moduleId: string) => {
    setExpanded(prev => ({ ...prev, [moduleId]: !prev[moduleId] }))
  }

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
          <p className="text-sm text-gray-500 mt-1">
            Dynamic article sections configured in Settings
          </p>
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
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900">Article Sections</h2>
        <p className="text-sm text-gray-500 mt-1">
          Dynamic article sections configured in Settings
        </p>
      </div>

      <div className="divide-y divide-gray-200">
        {modules.map(module => {
          const selection = selections.find(s => s.article_module_id === module.id)
          const articles = selection?.articles || []
          const isExpanded = expanded[module.id]
          const isSaving = saving === module.id
          const selectionMode = module.selection_mode || 'top_score'

          return (
            <div key={module.id} className="p-4">
              {/* Module Header */}
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleExpanded(module.id)}
              >
                <div className="flex items-center space-x-3">
                  <span className="font-medium text-gray-900">{module.name}</span>
                  <span className="text-xs text-gray-400">Display Order: {module.display_order}</span>
                  <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">
                    {SELECTION_MODE_LABELS[selectionMode]}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                    {module.articles_count} articles
                  </span>
                </div>
                <div className="flex items-center space-x-3">
                  {articles.length > 0 ? (
                    <span className="text-sm text-green-600">
                      {articles.length} article{articles.length !== 1 ? 's' : ''} selected
                    </span>
                  ) : (
                    <span className="text-sm text-yellow-600">
                      No articles generated
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
                <div className="mt-4 space-y-4">
                  {/* Swap Articles Button - Hide for sent issues */}
                  {!isSent && articles.length > 0 && (
                    <div className="bg-yellow-50 p-3 rounded-lg flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-700">Swap Articles</p>
                        <p className="text-xs text-gray-500">
                          Replace current articles with other generated options
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openSwapModal(module.id)
                        }}
                        disabled={isSaving}
                        className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                      >
                        Swap Articles
                      </button>
                    </div>
                  )}

                  {/* Articles List */}
                  {articles.length > 0 ? (
                    <div className="space-y-4">
                      {articles.map((article, idx) => (
                        <ArticlePreview
                          key={article.id}
                          article={article}
                          rank={idx + 1}
                          module={module}
                          styles={styles}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 text-sm">
                      No articles generated for this section yet.
                      <br />
                      <span className="text-xs">Articles will be generated when the workflow runs.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Swap Modal */}
      {swapModalOpen && (
        <SwapArticlesModal
          moduleId={swapModalOpen}
          module={modules.find(m => m.id === swapModalOpen)}
          articles={allArticles}
          currentSelection={selections.find(s => s.article_module_id === swapModalOpen)?.articles || []}
          loading={loadingSwap}
          onClose={() => setSwapModalOpen(null)}
          onSave={(selectedIds) => handleSwapArticles(swapModalOpen, selectedIds)}
          saving={saving === swapModalOpen}
        />
      )}
    </div>
  )
}

// Article Preview Component
function ArticlePreview({
  article,
  rank,
  module,
  styles
}: {
  article: ModuleArticle
  rank: number
  module: ArticleModule
  styles: PublicationStyles
}) {
  const rssPost = (article as any).rss_post

  return (
    <div
      className="rounded-lg shadow-lg overflow-hidden mx-auto"
      style={{
        border: '1px solid #ddd',
        backgroundColor: '#fff',
        fontFamily: styles.bodyFont,
        maxWidth: '650px'
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-2 flex items-center justify-between"
        style={{ backgroundColor: styles.primaryColor }}
      >
        <span className="text-white text-sm font-medium">
          {module.name} - Article {rank}
        </span>
        {article.fact_check_score && (
          <span className={`text-xs px-2 py-0.5 rounded ${
            article.fact_check_score >= 4 ? 'bg-green-200 text-green-800' :
            article.fact_check_score >= 3 ? 'bg-yellow-200 text-yellow-800' :
            'bg-red-200 text-red-800'
          }`}>
            Fact Check: {article.fact_check_score}/5
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Render blocks in configured order */}
        {(module.block_order || ['source_image', 'title', 'body']).map((blockType: string) => {
          if (blockType === 'source_image' && rssPost?.image_url) {
            return (
              <div key="source_image" className="mb-4">
                <img
                  src={rssPost.image_url}
                  alt={article.headline || 'Article image'}
                  className="w-full h-48 object-cover rounded"
                />
              </div>
            )
          }
          if (blockType === 'ai_image' && article.ai_image_url) {
            return (
              <div key="ai_image" className="mb-4">
                <img
                  src={article.ai_image_url}
                  alt="AI generated"
                  className="w-full h-48 object-cover rounded"
                />
                <p className="text-xs text-gray-400 mt-1 text-center">AI Generated Image</p>
              </div>
            )
          }
          if (blockType === 'title' && article.headline) {
            return (
              <h3
                key="title"
                className="text-lg font-bold mb-2"
                style={{ fontFamily: styles.headingFont }}
              >
                {article.headline}
              </h3>
            )
          }
          if (blockType === 'body' && article.content) {
            return (
              <div key="body" className="text-sm text-gray-700 leading-relaxed">
                {article.content}
                {article.word_count && (
                  <span className="text-xs text-gray-400 block mt-2">
                    {article.word_count} words
                  </span>
                )}
              </div>
            )
          }
          return null
        })}

        {/* Source Link */}
        {rssPost?.link && (
          <div className="mt-4 pt-3 border-t border-gray-200">
            <a
              href={rssPost.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Read original article
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

// Swap Articles Modal
function SwapArticlesModal({
  moduleId,
  module,
  articles,
  currentSelection,
  loading,
  onClose,
  onSave,
  saving
}: {
  moduleId: string
  module?: ArticleModule
  articles: ModuleArticle[]
  currentSelection: ModuleArticle[]
  loading: boolean
  onClose: () => void
  onSave: (selectedIds: string[]) => void
  saving: boolean
}) {
  const currentIds = currentSelection.map(a => a.id)
  const [selectedIds, setSelectedIds] = useState<string[]>(currentIds)
  const maxArticles = module?.articles_count || 3

  const toggleArticle = (articleId: string) => {
    setSelectedIds(prev => {
      if (prev.includes(articleId)) {
        return prev.filter(id => id !== articleId)
      }
      if (prev.length < maxArticles) {
        return [...prev, articleId]
      }
      return prev
    })
  }

  const handleSave = () => {
    onSave(selectedIds)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h3 className="text-lg font-semibold">Swap Articles</h3>
            <p className="text-sm text-gray-500">
              Select up to {maxArticles} articles for {module?.name || 'this section'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-8 w-8 text-emerald-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No articles available for swapping.
            </div>
          ) : (
            <div className="space-y-2">
              {articles.map(article => {
                const isSelected = selectedIds.includes(article.id)
                const isCurrentlyActive = article.is_active
                const rating = (article as any).rss_post?.post_ratings?.[0]?.total_score

                return (
                  <div
                    key={article.id}
                    onClick={() => toggleArticle(article.id)}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900 truncate">
                            {article.headline || 'Untitled'}
                          </h4>
                          {isCurrentlyActive && (
                            <span className="text-xs px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {article.content || 'No content'}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          {rating && <span>Score: {rating.toFixed(1)}</span>}
                          {article.fact_check_score && <span>Fact Check: {article.fact_check_score}/5</span>}
                          {article.word_count && <span>{article.word_count} words</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 border-t">
          <span className="text-sm text-gray-500">
            {selectedIds.length} of {maxArticles} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || selectedIds.length === 0}
              className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Selection'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
