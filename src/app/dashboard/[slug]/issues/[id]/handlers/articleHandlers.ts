import type { issueWithArticles } from '@/types/database'
import { arrayMove } from '@dnd-kit/sortable'
import type { DragEndEvent } from '@dnd-kit/core'

type SetIssue = React.Dispatch<React.SetStateAction<issueWithArticles | null>>
type SetSaving = React.Dispatch<React.SetStateAction<boolean>>

export function createArticleHandlers(
  getIssue: () => issueWithArticles | null,
  setissue: SetIssue,
  setSaving: SetSaving,
  fetchissue: (id: string) => Promise<void>,
) {
  const toggleArticle = async (articleId: string, currentState: boolean) => {
    const issue = getIssue()
    if (!issue) return

    // Prevent selecting a 6th article - simply return without action
    if (!currentState) {
      const activeCount = issue.articles.filter(article => article.is_active && !article.skipped).length
      if (activeCount >= 5) {
        return
      }
    }

    setSaving(true)
    try {
      const response = await fetch(`/api/campaigns/${issue.id}/articles`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          article_updates: [{
            article_id: articleId,
            is_active: !currentState
          }]
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update article')
      }

      setissue(prev => {
        if (!prev) return prev
        return {
          ...prev,
          articles: prev.articles.map(article =>
            article.id === articleId
              ? { ...article, is_active: !currentState }
              : article
          )
        }
      })

    } catch (error) {
      alert('Failed to update article: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const skipArticle = async (articleId: string) => {
    const issue = getIssue()
    if (!issue) return

    setSaving(true)
    try {
      const response = await fetch(`/api/articles/${articleId}/skip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to skip article')
      }

      const responseData = await response.json()

      setissue(prev => {
        if (!prev) return prev

        const updatedissue = {
          ...prev,
          articles: prev.articles.map(article =>
            article.id === articleId
              ? { ...article, skipped: true }
              : article
          )
        }

        if (responseData.subject_line_regenerated && responseData.new_subject_line) {
          console.log(`Subject line auto-updated after skip to: "${responseData.new_subject_line}"`)
          updatedissue.subject_line = responseData.new_subject_line
        }

        return updatedissue
      })

      const message = responseData.subject_line_regenerated
        ? `Article skipped successfully! Subject line auto-updated to: "${responseData.new_subject_line}"`
        : 'Article skipped successfully'

      alert(message)

    } catch (error) {
      alert('Failed to skip article: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const toggleSecondaryArticle = async (articleId: string, currentState: boolean) => {
    const issue = getIssue()
    if (!issue) return

    setSaving(true)
    try {
      const response = await fetch(`/api/secondary-articles/${articleId}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: !currentState })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to toggle secondary article')
      }

      setissue(prev => {
        if (!prev) return prev
        return {
          ...prev,
          secondary_articles: prev.secondary_articles.map(article =>
            article.id === articleId
              ? { ...article, is_active: !currentState }
              : article
          )
        }
      })

    } catch (error) {
      alert('Failed to toggle secondary article: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const skipSecondaryArticle = async (articleId: string) => {
    const issue = getIssue()
    if (!issue) return

    setSaving(true)
    try {
      const response = await fetch(`/api/secondary-articles/${articleId}/skip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to skip secondary article')
      }

      setissue(prev => {
        if (!prev) return prev
        return {
          ...prev,
          secondary_articles: prev.secondary_articles.map(article =>
            article.id === articleId
              ? { ...article, skipped: true, is_active: false }
              : article
          )
        }
      })

      alert('Secondary article skipped successfully')

    } catch (error) {
      alert('Failed to skip secondary article: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const handleSecondaryDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    const issue = getIssue()

    if (!over || active.id === over.id || !issue) {
      return
    }

    console.log('Reordering secondary articles:', { activeId: active.id, overId: over.id })

    const sortedSecondaryArticles = issue.secondary_articles
      .filter(article => !article.skipped)
      .sort((a, b) => {
        const rankA = a.rank ?? 9999
        const rankB = b.rank ?? 9999
        return rankA - rankB
      })

    const oldIndex = sortedSecondaryArticles.findIndex(article => article.id === active.id)
    const newIndex = sortedSecondaryArticles.findIndex(article => article.id === over.id)

    if (oldIndex === -1 || newIndex === -1) {
      console.error('Could not find secondary articles in list')
      return
    }

    const reorderedArticles = arrayMove(sortedSecondaryArticles, oldIndex, newIndex)

    const articleOrders = reorderedArticles.map((article, index) => ({
      articleId: article.id,
      rank: index + 1
    }))

    setissue(prev => {
      if (!prev) return prev
      return {
        ...prev,
        secondary_articles: prev.secondary_articles.map(article => {
          const order = articleOrders.find(o => o.articleId === article.id)
          return order ? { ...article, rank: order.rank } : article
        })
      }
    })

    try {
      const response = await fetch(`/api/campaigns/${issue.id}/secondary-articles/reorder`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ articleOrders })
      })

      if (!response.ok) {
        throw new Error('Failed to reorder secondary articles')
      }

      console.log('Secondary articles reordered successfully')
    } catch (error) {
      console.error('Failed to reorder secondary articles:', error)
      alert('Failed to reorder secondary articles')
      fetchissue(issue.id)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    console.log('handleDragEnd called with event:', event)
    const { active, over } = event
    const issue = getIssue()

    if (!over || active.id === over.id || !issue) {
      console.log('Early return from handleDragEnd:', { over: !!over, sameId: active.id === over?.id, issue: !!issue })
      return
    }

    console.log('Drag ended:', { activeId: active.id, overId: over.id })

    const activeArticles = issue.articles
      .filter(article => article.is_active)
      .sort((a, b) => (a.rank || 999) - (b.rank || 999))

    const oldIndex = activeArticles.findIndex(article => article.id === active.id)
    const newIndex = activeArticles.findIndex(article => article.id === over.id)

    console.log('Indexes:', { oldIndex, newIndex, totalActive: activeArticles.length })

    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      const newOrder = arrayMove(activeArticles, oldIndex, newIndex)

      console.log('New order:', newOrder.map((a, i) => `${i + 1}. ${a.headline} (was rank ${a.rank})`))

      setissue(prev => {
        if (!prev) return prev
        const updatedArticles = [...prev.articles]

        newOrder.forEach((article, index) => {
          const articleIndex = updatedArticles.findIndex(a => a.id === article.id)
          if (articleIndex !== -1) {
            updatedArticles[articleIndex] = {
              ...updatedArticles[articleIndex],
              rank: index + 1
            }
          }
        })

        return { ...prev, articles: updatedArticles }
      })

      try {
        const articleOrders = newOrder.map((article, index) => ({
          articleId: article.id,
          rank: index + 1
        }))

        console.log('Sending rank updates:', articleOrders)

        const response = await fetch(`/api/campaigns/${issue.id}/articles/reorder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articleOrders })
        })

        if (!response.ok) {
          throw new Error(`Failed to update order: ${response.status}`)
        }

        const responseData = await response.json()
        console.log('Successfully updated article ranks')

        if (responseData.subject_line_regenerated && responseData.new_subject_line) {
          console.log(`Subject line auto-updated to: "${responseData.new_subject_line}"`)

          setissue(prev => prev ? {
            ...prev,
            subject_line: responseData.new_subject_line
          } : null)
        }
      } catch (error) {
        console.error('Failed to update article order:', error)
        if (issue.id) {
          fetchissue(issue.id)
        }
      }
    }
  }

  return {
    toggleArticle,
    skipArticle,
    toggleSecondaryArticle,
    skipSecondaryArticle,
    handleSecondaryDragEnd,
    handleDragEnd,
  }
}
