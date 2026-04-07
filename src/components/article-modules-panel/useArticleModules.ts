'use client'

import { useState, useCallback, useEffect } from 'react'
import type { ArticleSelection, ModuleWithCriteria, ArticleWithRssPost } from './types'

export function useArticleModules(issueId: string) {
  const [loading, setLoading] = useState(true)
  const [selections, setSelections] = useState<ArticleSelection[]>([])
  const [modules, setModules] = useState<ModuleWithCriteria[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [allArticlesMap, setAllArticlesMap] = useState<Record<string, ArticleWithRssPost[]>>({})
  const [loadingModules, setLoadingModules] = useState<Record<string, boolean>>({})
  const [recheckingImages, setRecheckingImages] = useState(false)
  const [recheckResult, setRecheckResult] = useState<string | null>(null)

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

  const handleRecheckImages = useCallback(async () => {
    setRecheckingImages(true)
    setRecheckResult(null)
    try {
      const res = await fetch(`/api/campaigns/${issueId}/article-modules/recheck-images`, {
        method: 'POST'
      })
      if (res.ok) {
        const data = await res.json()
        const total = data.results?.reduce((sum: number, r: any) => sum + r.matched, 0) || 0
        setRecheckResult(`${total} image${total !== 1 ? 's' : ''} matched`)
        await fetchArticleModules()
      } else {
        setRecheckResult('Failed')
      }
    } catch {
      setRecheckResult('Error')
    } finally {
      setRecheckingImages(false)
      setTimeout(() => setRecheckResult(null), 3000)
    }
  }, [issueId, fetchArticleModules])

  const fetchAllArticlesForModule = useCallback(async (moduleId: string) => {
    if (allArticlesMap[moduleId]) return

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
  }, [issueId, allArticlesMap])

  const toggleExpanded = useCallback(async (moduleId: string) => {
    const newExpanded = !expanded[moduleId]
    setExpanded(prev => ({ ...prev, [moduleId]: newExpanded }))
    if (newExpanded) {
      await fetchAllArticlesForModule(moduleId)
    }
  }, [expanded, fetchAllArticlesForModule])

  const toggleArticle = useCallback(async (moduleId: string, articleId: string, currentState: boolean) => {
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
  }, [issueId])

  const skipArticle = useCallback(async (moduleId: string, articleId: string) => {
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
  }, [issueId])

  const handleReorder = useCallback(async (moduleId: string, articleIds: string[]) => {
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
  }, [issueId])

  return {
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
  }
}
