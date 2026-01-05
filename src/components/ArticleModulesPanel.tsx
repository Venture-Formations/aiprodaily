'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ArticleModule, ModuleArticle, ArticleSelectionMode } from '@/types/database'

interface ArticleModulesPanelProps {
  issueId: string
  issueStatus?: string
}

interface CriteriaConfig {
  id: string
  name: string
  weight: number
  criteria_number: number
}

interface ModuleWithCriteria extends ArticleModule {
  criteria?: CriteriaConfig[]
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

interface ArticleWithRssPost extends ModuleArticle {
  rss_post?: {
    id?: string
    title?: string
    source_url?: string
    image_url?: string
    author?: string
    rss_feed?: { name?: string }
    post_ratings?: Array<{
      total_score: number
      criteria_1_score?: number
      criteria_2_score?: number
      criteria_3_score?: number
      criteria_4_score?: number
      criteria_5_score?: number
    }>
  }
}

const SELECTION_MODE_LABELS: Record<ArticleSelectionMode, string> = {
  top_score: 'Top Score',
  manual: 'Manual'
}

export default function ArticleModulesPanel({ issueId, issueStatus }: ArticleModulesPanelProps) {
  const isSent = issueStatus === 'sent'
  const [loading, setLoading] = useState(true)
  const [selections, setSelections] = useState<ArticleSelection[]>([])
  const [modules, setModules] = useState<ModuleWithCriteria[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [allArticlesMap, setAllArticlesMap] = useState<Record<string, ArticleWithRssPost[]>>({})
  const [loadingModules, setLoadingModules] = useState<Record<string, boolean>>({})

  const fetchArticleModules = useCallback(async () => {
    try {
      const response = await fetch(`/api/campaigns/${issueId}/article-modules`)
      if (response.ok) {
        const data = await response.json()
        setSelections(data.selections || [])
        setModules(data.modules || [])
      }
    } catch (error) {
      console.error('Failed to fetch article modules:', error)
    } finally {
      setLoading(false)
    }
  }, [issueId])

  useEffect(() => {
    fetchArticleModules()
  }, [fetchArticleModules])

  const fetchAllArticlesForModule = async (moduleId: string) => {
    if (allArticlesMap[moduleId]) return // Already loaded

    setLoadingModules(prev => ({ ...prev, [moduleId]: true }))
    try {
      const response = await fetch(`/api/campaigns/${issueId}/article-modules?moduleId=${moduleId}`, {
        method: 'PATCH'
      })
      if (response.ok) {
        const data = await response.json()
        setAllArticlesMap(prev => ({ ...prev, [moduleId]: data.articles || [] }))
      }
    } catch (error) {
      console.error('Failed to fetch all articles:', error)
    } finally {
      setLoadingModules(prev => ({ ...prev, [moduleId]: false }))
    }
  }

  const toggleExpanded = async (moduleId: string) => {
    const newExpanded = !expanded[moduleId]
    setExpanded(prev => ({ ...prev, [moduleId]: newExpanded }))

    // Fetch all articles when expanding
    if (newExpanded) {
      await fetchAllArticlesForModule(moduleId)
    }
  }

  const toggleArticle = async (moduleId: string, articleId: string, currentState: boolean) => {
    setSaving(articleId)
    try {
      const response = await fetch(`/api/campaigns/${issueId}/article-modules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', moduleId, articleId, currentState })
      })

      if (response.ok) {
        const data = await response.json()
        setSelections(data.selections || [])
        if (data.allArticles) {
          setAllArticlesMap(prev => ({ ...prev, [moduleId]: data.allArticles }))
        }
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to toggle article')
      }
    } catch (error) {
      console.error('Failed to toggle article:', error)
      alert('Failed to toggle article')
    } finally {
      setSaving(null)
    }
  }

  const skipArticle = async (moduleId: string, articleId: string) => {
    if (!confirm('Are you sure you want to skip this article? It will be removed from consideration.')) {
      return
    }

    setSaving(articleId)
    try {
      const response = await fetch(`/api/campaigns/${issueId}/article-modules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'skip', moduleId, articleId })
      })

      if (response.ok) {
        const data = await response.json()
        setSelections(data.selections || [])
        if (data.allArticles) {
          setAllArticlesMap(prev => ({ ...prev, [moduleId]: data.allArticles }))
        }
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to skip article')
      }
    } catch (error) {
      console.error('Failed to skip article:', error)
      alert('Failed to skip article')
    } finally {
      setSaving(null)
    }
  }

  const handleReorder = async (moduleId: string, articleIds: string[]) => {
    setSaving(moduleId)
    try {
      const response = await fetch(`/api/campaigns/${issueId}/article-modules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', moduleId, articleIds })
      })

      if (response.ok) {
        const data = await response.json()
        setSelections(data.selections || [])
        if (data.allArticles) {
          setAllArticlesMap(prev => ({ ...prev, [moduleId]: data.allArticles }))
        }
      }
    } catch (error) {
      console.error('Failed to reorder articles:', error)
    } finally {
      setSaving(null)
    }
  }

  const getScoreColor = (score: number): string => {
    if (score >= 70) return 'text-green-600'
    if (score >= 50) return 'text-yellow-600'
    return 'text-red-600'
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
          const activeArticles = selection?.articles || []
          const allArticles = allArticlesMap[module.id] || []
          const isExpanded = expanded[module.id]
          const isLoadingModule = loadingModules[module.id]
          const selectionMode = module.selection_mode || 'top_score'
          const totalArticles = allArticles.length
          const selectedCount = activeArticles.length

          return (
            <div key={module.id}>
              {/* Module Header - Like Ad Sections */}
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
                    <span className="text-sm text-blue-600">Collapse</span>
                  ) : (
                    <span className="text-sm text-blue-600">
                      {selectedCount > 0 ? `${selectedCount} article${selectedCount !== 1 ? 's' : ''} selected` : 'No articles'}
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
                  {/* Instructions */}
                  <div className="flex items-center justify-between py-3 text-sm text-gray-600">
                    <span>Check articles to select them for the issue. Drag to reorder selected articles.</span>
                    <span className="text-blue-600 font-medium">
                      {selectedCount}/{module.articles_count} selected {totalArticles > 0 && `• ${totalArticles} total articles`}
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

// Article Module List with drag and drop for active articles
function ArticleModuleList({
  moduleId,
  articles,
  criteriaConfig,
  isSent,
  saving,
  onToggle,
  onSkip,
  onReorder,
  getScoreColor
}: {
  moduleId: string
  articles: ArticleWithRssPost[]
  criteriaConfig: CriteriaConfig[]
  isSent: boolean
  saving: string | null
  onToggle: (articleId: string, currentState: boolean) => void
  onSkip: (articleId: string) => void
  onReorder: (articleIds: string[]) => void
  getScoreColor: (score: number) => string
}) {
  // Separate active and inactive articles
  const activeArticles = articles.filter(a => a.is_active && !a.skipped).sort((a, b) => (a.rank || 999) - (b.rank || 999))
  const inactiveArticles = articles.filter(a => !a.is_active && !a.skipped)
  const skippedArticles = articles.filter(a => a.skipped)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = activeArticles.findIndex(a => a.id === active.id)
      const newIndex = activeArticles.findIndex(a => a.id === over.id)
      const newOrder = arrayMove(activeArticles, oldIndex, newIndex)
      onReorder(newOrder.map(a => a.id))
    }
  }

  return (
    <div className="space-y-2">
      {/* Active articles - sortable */}
      {activeArticles.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={activeArticles.map(a => a.id)}
            strategy={verticalListSortingStrategy}
          >
            {activeArticles.map((article) => (
              <SortableArticleCard
                key={article.id}
                article={article}
                criteriaConfig={criteriaConfig}
                isSent={isSent}
                saving={saving}
                onToggle={onToggle}
                onSkip={onSkip}
                getScoreColor={getScoreColor}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}

      {/* Inactive articles - not sortable */}
      {inactiveArticles.map((article) => (
        <ArticleCard
          key={article.id}
          article={article}
          criteriaConfig={criteriaConfig}
          isSent={isSent}
          saving={saving}
          onToggle={onToggle}
          onSkip={onSkip}
          getScoreColor={getScoreColor}
        />
      ))}

      {/* Skipped articles */}
      {skippedArticles.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Skipped Articles ({skippedArticles.length})</h4>
          {skippedArticles.map((article) => (
            <div key={article.id} className="p-3 bg-gray-100 rounded-lg mb-2 opacity-60">
              <span className="text-sm text-gray-600 line-through">{article.headline}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Sortable Article Card (for active articles)
function SortableArticleCard({
  article,
  criteriaConfig,
  isSent,
  saving,
  onToggle,
  onSkip,
  getScoreColor
}: {
  article: ArticleWithRssPost
  criteriaConfig: CriteriaConfig[]
  isSent: boolean
  saving: string | null
  onToggle: (articleId: string, currentState: boolean) => void
  onSkip: (articleId: string) => void
  getScoreColor: (score: number) => string
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: article.id, disabled: isSent })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <ArticleCard
        article={article}
        criteriaConfig={criteriaConfig}
        isSent={isSent}
        saving={saving}
        onToggle={onToggle}
        onSkip={onSkip}
        getScoreColor={getScoreColor}
        dragHandleProps={{ ...attributes, ...listeners }}
        showDragHandle={true}
      />
    </div>
  )
}

// Article Card Component
function ArticleCard({
  article,
  criteriaConfig,
  isSent,
  saving,
  onToggle,
  onSkip,
  getScoreColor,
  dragHandleProps,
  showDragHandle = false
}: {
  article: ArticleWithRssPost
  criteriaConfig: CriteriaConfig[]
  isSent: boolean
  saving: string | null
  onToggle: (articleId: string, currentState: boolean) => void
  onSkip: (articleId: string) => void
  getScoreColor: (score: number) => string
  dragHandleProps?: any
  showDragHandle?: boolean
}) {
  const [criteriaExpanded, setCriteriaExpanded] = useState(false)
  const isSaving = saving === article.id
  const isActive = article.is_active

  const rssPost = article.rss_post
  const postRating = rssPost?.post_ratings?.[0]
  const score = postRating?.total_score

  const source = (() => {
    const author = rssPost?.author
    const feedName = rssPost?.rss_feed?.name
    if (author && author !== 'St. Cloud Local News') return author
    return feedName || 'Unknown'
  })()

  return (
    <div className={`bg-white rounded-lg border ${isActive ? 'border-blue-300 border-l-4 border-l-blue-500' : 'border-gray-200'} p-4`}>
      <div className="flex items-start space-x-3">
        {/* Checkbox */}
        <button
          onClick={() => !isSent && onToggle(article.id, isActive)}
          disabled={isSent || isSaving}
          className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
            isActive
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'border-gray-300 hover:border-blue-400'
          } ${isSent || isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {isActive && (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        {/* Drag Handle (only for active articles) */}
        {showDragHandle && !isSent && (
          <div
            {...dragHandleProps}
            className="flex-shrink-0 cursor-move p-1 text-gray-400 hover:text-gray-600"
            title="Drag to reorder"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M7 2a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V4a2 2 0 00-2-2H7zM6 6h8v2H6V6zm0 4h8v2H6v-2zm0 4h8v2H6v-2z"/>
            </svg>
          </div>
        )}

        {/* Rank Badge */}
        {isActive && article.rank && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 flex-shrink-0">
            #{article.rank}
          </span>
        )}

        {/* Image Thumbnail */}
        {rssPost?.image_url && (
          <div className="flex-shrink-0">
            <img
              src={rssPost.image_url}
              alt=""
              className="w-16 h-16 object-cover rounded border border-gray-200"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <h3 className="text-base font-medium text-gray-900 pr-2">
              {article.headline}
            </h3>
            {score !== undefined && (
              <span className={`text-sm font-medium flex-shrink-0 ${getScoreColor(score)}`}>
                Score: {score}
              </span>
            )}
          </div>

          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{article.content}</p>

          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            <div className="flex items-center space-x-3">
              <span>Source: {source}</span>
              {article.word_count && <span>{article.word_count} words</span>}
              {article.fact_check_score !== undefined && article.fact_check_score !== null && (
                <span className={getScoreColor(article.fact_check_score * 10)}>
                  Fact-check: {article.fact_check_score}/30
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {rssPost?.source_url && (
                <a
                  href={rssPost.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700"
                >
                  View Original
                </a>
              )}
              {!isSent && (
                <button
                  onClick={() => onSkip(article.id)}
                  disabled={isSaving}
                  className="bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded text-xs font-medium disabled:opacity-50"
                  title="Skip this article"
                >
                  Skip Article
                </button>
              )}
            </div>
          </div>

          {/* Criteria Scores */}
          {postRating && criteriaConfig.length > 0 && (
            <div className="mt-3 border-t border-gray-200 pt-3">
              <button
                onClick={() => setCriteriaExpanded(!criteriaExpanded)}
                className="flex items-center justify-between w-full text-left text-xs font-medium text-gray-700 hover:text-gray-900"
              >
                <span>Criteria Scores</span>
                <svg
                  className={`w-4 h-4 transform transition-transform ${criteriaExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {criteriaExpanded && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-3">
                  {criteriaConfig.map((criterion) => {
                    const criterionKey = `criteria_${criterion.criteria_number}_score` as keyof typeof postRating
                    const rawScore = (postRating[criterionKey] as number) || 0
                    const weight = criterion.weight
                    const weightedScore = (rawScore * weight).toFixed(1)

                    return (
                      <div key={criterion.id} className="bg-gray-50 p-2 rounded text-xs">
                        <div className="text-gray-600 font-medium mb-1">{criterion.name}</div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-500">Raw Score:</span>
                          <span className="font-semibold text-gray-900">{rawScore}/10</span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-gray-500">Weight:</span>
                          <span className="font-medium text-gray-700">{weight}x</span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5 pt-1 border-t border-gray-200">
                          <span className="text-gray-600 font-medium">Weighted:</span>
                          <span className="font-bold text-blue-600">{weightedScore}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
