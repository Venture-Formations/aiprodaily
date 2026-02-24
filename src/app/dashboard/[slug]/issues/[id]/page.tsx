'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Layout from '@/components/Layout'
import DeleteIssueModal from '@/components/DeleteIssueModal'
import AdModulesPanel from '@/components/AdModulesPanel'
import PollModulesPanel from '@/components/PollModulesPanel'
import AIAppModulesPanel from '@/components/AIAppModulesPanel'
import PromptModulesPanel from '@/components/PromptModulesPanel'
import ArticleModulesPanel from '@/components/ArticleModulesPanel'
import TextBoxModulesPanel from '@/components/TextBoxModulesPanel'
import SparkLoopRecsModulesPanel from '@/components/SparkLoopRecsModulesPanel'
import NewsletterSectionComponent from '@/components/issue-detail/NewsletterSectionComponent'
import type { issueWithArticles, issueEvent, Event, NewsletterSection } from '@/types/database'
import {
  DndContext,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'

export default function IssueDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [issue, setissue] = useState<issueWithArticles | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState('')
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [generatingSubject, setGeneratingSubject] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  const [editingSubject, setEditingSubject] = useState(false)
  const [editSubjectValue, setEditSubjectValue] = useState('')
  const [savingSubject, setSavingSubject] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)
  const [testSendStatus, setTestSendStatus] = useState('')

  // Events state
  const [issueEvents, setissueEvents] = useState<issueEvent[]>([])
  const [availableEvents, setAvailableEvents] = useState<Event[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [eventsExpanded, setEventsExpanded] = useState(false)
  const [updatingEvents, setUpdatingEvents] = useState(false)
  const [articlesExpanded, setArticlesExpanded] = useState(false)
  const [secondaryArticlesExpanded, setSecondaryArticlesExpanded] = useState(false)

  // Newsletter sections state
  const [newsletterSections, setNewsletterSections] = useState<NewsletterSection[]>([])
  const [loadingSections, setLoadingSections] = useState(false)

  // Section IDs for Top and Secondary Articles (to filter from dynamic sections)
  // Use section_type for reliable identification
  const primaryArticlesSection = newsletterSections.find(s =>
    s.section_type === 'primary_articles'
  )
  const secondaryArticlesSection = newsletterSections.find(s =>
    s.section_type === 'secondary_articles'
  )

  // Criteria and article limits state
  const [criteriaConfig, setCriteriaConfig] = useState<Array<{name: string, weight: number}>>([])
  const [secondaryCriteriaConfig, setSecondaryCriteriaConfig] = useState<Array<{name: string, weight: number}>>([])
  const [maxTopArticles, setMaxTopArticles] = useState(3)
  const [maxBottomArticles, setMaxBottomArticles] = useState(3)
  const [maxSecondaryArticles, setMaxSecondaryArticles] = useState(3)
  const [totalMaxArticles, setTotalMaxArticles] = useState(6) // Sum of all article modules' articles_count
  const [sectionExpandedStates, setSectionExpandedStates] = useState<{ [key: string]: boolean }>({})

  // Drag and drop sensors with activation constraints for better mobile experience
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 250, // 250ms delay before drag starts (better for mobile)
        tolerance: 5, // Allow 5px of movement before drag starts
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250, // 250ms press delay before drag starts on touch devices
        tolerance: 5, // Allow 5px of movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    console.log('📄 issue page loaded, params:', params.id)
    if (params.id) {
      fetchissue(params.id as string)
      fetchissueEvents(params.id as string)
      fetchNewsletterSections()
      fetchCriteriaConfig()
    }
  }, [params.id])

  // Poll for status updates when issue is processing
  useEffect(() => {
    if (!issue || issue.status !== 'processing') {
      return
    }

    console.log('🔄 issue is processing, starting status polling...')

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/campaigns/${issue.id}`)
        if (response.ok) {
          const data = await response.json()
          const newStatus = data.issue.status

          console.log(`📊 Status poll: ${newStatus}`)

          if (newStatus !== 'processing') {
            console.log('✅ Processing complete! Refreshing issue data...')
            clearInterval(pollInterval)
            // Refresh all issue data
            await fetchissue(issue.id)
            await fetchissueEvents(issue.id)
          }
        }
      } catch (error) {
        console.error('Status poll error:', error)
      }
    }, 3000) // Poll every 3 seconds

    return () => clearInterval(pollInterval)
  }, [issue?.status, issue?.id])

  // Fetch article modules sum when publication_id is available
  useEffect(() => {
    if (issue?.publication_id) {
      fetchArticleModulesSum(issue.publication_id)
    }
  }, [issue?.publication_id])

  const fetchissue = async (id: string) => {
    try {
      const response = await fetch(`/api/campaigns/${id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch issue')
      }
      const data = await response.json()
      const issueData = data.issue
      // Debug: log articles shape to help diagnose render crashes
      if (issueData?.articles) {
        const nullArticles = issueData.articles.filter((a: any) => !a || !a.id)
        if (nullArticles.length > 0) {
          console.error('[Issue Page] Found null/invalid articles in API response:', nullArticles.length)
          issueData.articles = issueData.articles.filter((a: any) => a && a.id)
        }
      }
      setissue(issueData)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const fetchissueEvents = async (issueId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${issueId}/events`)
      if (response.ok) {
        const data = await response.json()
        setissueEvents(data.issue_events || [])
      }
    } catch (error) {
      console.error('Failed to fetch issue events:', error)
    }
  }

  const fetchCriteriaConfig = async () => {
    try {
      const response = await fetch('/api/settings/email')
      if (response.ok) {
        const data = await response.json()

        // Get enabled criteria counts for primary and secondary
        const primaryEnabledCountSetting = data.settings.find((s: any) => s.key === 'primary_criteria_enabled_count')
        const secondaryEnabledCountSetting = data.settings.find((s: any) => s.key === 'secondary_criteria_enabled_count')

        // Fallback to old criteria_enabled_count key if new ones don't exist
        const fallbackEnabledCountSetting = data.settings.find((s: any) => s.key === 'criteria_enabled_count')

        const primaryEnabledCount = primaryEnabledCountSetting?.value ? parseInt(primaryEnabledCountSetting.value) :
                                     (fallbackEnabledCountSetting?.value ? parseInt(fallbackEnabledCountSetting.value) : 3)
        const secondaryEnabledCount = secondaryEnabledCountSetting?.value ? parseInt(secondaryEnabledCountSetting.value) :
                                       (fallbackEnabledCountSetting?.value ? parseInt(fallbackEnabledCountSetting.value) : 3)

        // Build PRIMARY criteria config array
        const primaryCriteria: Array<{name: string, weight: number}> = []
        for (let i = 1; i <= primaryEnabledCount; i++) {
          const nameSetting = data.settings.find((s: any) => s.key === `criteria_${i}_name`)
          const weightSetting = data.settings.find((s: any) => s.key === `criteria_${i}_weight`)

          primaryCriteria.push({
            name: nameSetting?.value || `Criteria ${i}`,
            weight: weightSetting?.value ? parseFloat(weightSetting.value) : 1.0
          })
        }

        // Build SECONDARY criteria config array
        const secondaryCriteria: Array<{name: string, weight: number}> = []
        for (let i = 1; i <= secondaryEnabledCount; i++) {
          const nameSetting = data.settings.find((s: any) => s.key === `secondary_criteria_${i}_name`)
          const weightSetting = data.settings.find((s: any) => s.key === `secondary_criteria_${i}_weight`)

          // Fallback to primary criteria names/weights if secondary not set
          const fallbackNameSetting = data.settings.find((s: any) => s.key === `criteria_${i}_name`)
          const fallbackWeightSetting = data.settings.find((s: any) => s.key === `criteria_${i}_weight`)

          secondaryCriteria.push({
            name: nameSetting?.value || fallbackNameSetting?.value || `Criteria ${i}`,
            weight: weightSetting?.value ? parseFloat(weightSetting.value) :
                    (fallbackWeightSetting?.value ? parseFloat(fallbackWeightSetting.value) : 1.0)
          })
        }

        setCriteriaConfig(primaryCriteria)
        setSecondaryCriteriaConfig(secondaryCriteria)

        // Get max articles settings
        const maxTopSetting = data.settings.find((s: any) => s.key === 'max_top_articles')
        const maxBottomSetting = data.settings.find((s: any) => s.key === 'max_bottom_articles')
        const maxSecondarySetting = data.settings.find((s: any) => s.key === 'max_secondary_articles')

        const parsedMaxTop = maxTopSetting?.value ? parseInt(maxTopSetting.value, 10) : 3
        const parsedMaxBottom = maxBottomSetting?.value ? parseInt(maxBottomSetting.value, 10) : 3
        const parsedMaxSecondary = maxSecondarySetting?.value ? parseInt(maxSecondarySetting.value, 10) : 3

        setMaxTopArticles(isNaN(parsedMaxTop) ? 3 : parsedMaxTop)
        setMaxBottomArticles(isNaN(parsedMaxBottom) ? 3 : parsedMaxBottom)
        setMaxSecondaryArticles(isNaN(parsedMaxSecondary) ? 3 : parsedMaxSecondary)
      }
    } catch (error) {
      console.error('Failed to fetch criteria config:', error)
    }
  }

  const fetchAvailableEvents = async (startDate: string, endDate: string) => {
    setLoadingEvents(true)
    try {
      const response = await fetch(`/api/events?start_date=${startDate}&end_date=${endDate}&active=true`)
      if (response.ok) {
        const data = await response.json()
        setAvailableEvents(data.events || [])
      }
    } catch (error) {
      console.error('Failed to fetch available events:', error)
    } finally {
      setLoadingEvents(false)
    }
  }

  const fetchNewsletterSections = async () => {
    setLoadingSections(true)
    try {
      const response = await fetch('/api/settings/newsletter-sections')
      if (response.ok) {
        const data = await response.json()
        setNewsletterSections(data.sections || [])
      }
    } catch (error) {
      console.error('Failed to fetch newsletter sections:', error)
    } finally {
      setLoadingSections(false)
    }
  }

  // Fetch article modules to calculate total max articles
  const fetchArticleModulesSum = async (publicationId: string) => {
    try {
      const response = await fetch(`/api/article-modules?publication_id=${publicationId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.modules && Array.isArray(data.modules)) {
          // Sum up articles_count from all active modules
          const sum = data.modules
            .filter((m: any) => m.is_active)
            .reduce((total: number, m: any) => total + (m.articles_count || 3), 0)
          setTotalMaxArticles(sum > 0 ? sum : 6)
        }
      }
    } catch (error) {
      console.error('Failed to fetch article modules sum:', error)
    }
  }

  const toggleArticle = async (articleId: string, currentState: boolean) => {
    if (!issue) return

    // Prevent selecting a 6th article - simply return without action
    if (!currentState) { // currentState is false means we're trying to activate
      const activeCount = issue.articles.filter(article => article.is_active && !article.skipped).length
      if (activeCount >= 5) {
        return // No action taken, no alert - just prevent the selection
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

      // Update local state
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

      // Update local state to remove the skipped article
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

        // Update subject line if it was auto-regenerated
        if (responseData.subject_line_regenerated && responseData.new_subject_line) {
          console.log(`Subject line auto-updated after skip to: "${responseData.new_subject_line}"`)
          updatedissue.subject_line = responseData.new_subject_line
        }

        return updatedissue
      })

      // Show success message with subject line info if applicable
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

  // Secondary Article Functions
  const toggleSecondaryArticle = async (articleId: string, currentState: boolean) => {
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

      // Update local state
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

      // Update local state to remove the skipped article
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

    if (!over || active.id === over.id || !issue) {
      return
    }

    console.log('Reordering secondary articles:', { activeId: active.id, overId: over.id })

    // Get non-skipped secondary articles sorted by rank
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

    // Reorder the array
    const reorderedArticles = arrayMove(sortedSecondaryArticles, oldIndex, newIndex)

    // Update ranks: 1, 2, 3...
    const articleOrders = reorderedArticles.map((article, index) => ({
      articleId: article.id,
      rank: index + 1
    }))

    // Optimistically update UI
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

    // Send to API
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
      // Refresh to get correct state
      fetchissue(issue.id)
    }
  }

  const previewNewsletter = async () => {
    if (!issue) return

    setPreviewLoading(true)
    try {
      console.log('Calling preview API for issue:', issue.id)
      const response = await fetch(`/api/campaigns/${issue.id}/preview`)
      console.log('Preview API response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errorMessage = errorData?.error || `HTTP ${response.status}: ${response.statusText}`
        console.error('Preview API error:', errorMessage)
        throw new Error(errorMessage)
      }

      const data = await response.json()
      console.log('Preview data received:', !!data.html, 'HTML length:', data.html?.length)
      setPreviewHtml(data.html)
      setShowPreview(true)
    } catch (error) {
      console.error('Preview error:', error)
      alert('Failed to generate preview: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setPreviewLoading(false)
    }
  }

  const sendTestEmail = async () => {
    if (!issue) return

    setSendingTest(true)
    setTestSendStatus('')
    try {
      const response = await fetch(`/api/campaigns/${issue.id}/send-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await response.json()

      if (!response.ok) {
        alert(data.error || 'Failed to send test email')
        return
      }

      setTestSendStatus('Test email scheduled! Check your inbox in ~2 minutes.')
      setTimeout(() => setTestSendStatus(''), 10000)
    } catch (err) {
      alert('Failed to send test email. Check console for details.')
      console.error('Send test email error:', err)
    } finally {
      setSendingTest(false)
    }
  }

  const processRSSFeeds = async () => {
    if (!issue) return

    setProcessing(true)
    setProcessingStatus('Starting reprocess workflow...')

    try {
      const response = await fetch(`/api/campaigns/${issue.id}/reprocess`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        let errorMessage = 'Reprocess failed'
        try {
          const data = await response.json()
          errorMessage = data.message || data.error || errorMessage
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      console.log('[Client] Reprocess workflow started:', data)

      setProcessingStatus('Workflow started! Articles will regenerate in background. Refresh page to see progress.')

      // Wait a bit then refresh to show processing status
      setTimeout(async () => {
        await fetchissue(issue.id)
        setProcessingStatus('')
      }, 3000)

    } catch (error) {
      setProcessingStatus('')
      alert('Failed to start reprocess: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setProcessing(false)
    }
  }

  const generateSubjectLine = async () => {
    if (!issue) return

    // Check if there are any active articles
    const activeArticles = issue.articles.filter(article => article.is_active)
    if (activeArticles.length === 0) {
      alert('Please select at least one article before generating a subject line.')
      return
    }

    setGeneratingSubject(true)
    try {
      const response = await fetch(`/api/campaigns/${issue.id}/generate-subject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate subject line')
      }

      const data = await response.json()

      // Update issue locally with new subject line
      setissue(prev => {
        if (!prev) return prev
        return {
          ...prev,
          subject_line: data.subject_line
        }
      })

      console.log(`Generated subject line: "${data.subject_line}" (${data.character_count} characters)`)

    } catch (error) {
      alert('Failed to generate subject line: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setGeneratingSubject(false)
    }
  }

  const startEditingSubject = () => {
    setEditSubjectValue(issue?.subject_line || '')
    setEditingSubject(true)
  }

  const cancelEditingSubject = () => {
    setEditingSubject(false)
    setEditSubjectValue('')
  }

  const saveSubjectLine = async () => {
    if (!issue) return

    setSavingSubject(true)
    try {
      const response = await fetch(`/api/campaigns/${issue.id}/subject-line`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subject_line: editSubjectValue.trim()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update subject line')
      }

      const data = await response.json()
      setissue(prev => prev ? { ...prev, subject_line: data.subject_line } : null)
      setEditingSubject(false)
      setEditSubjectValue('')

    } catch (error) {
      alert('Failed to save subject line: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setSavingSubject(false)
    }
  }

  const updateEventSelections = async (eventDate: string, selectedEvents: string[], featuredEvent?: string) => {
    if (!issue) return

    setUpdatingEvents(true)
    try {
      const response = await fetch(`/api/campaigns/${issue.id}/events`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_date: eventDate,
          selected_events: selectedEvents,
          featured_event: featuredEvent
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update events')
      }

      // Refresh issue events
      await fetchissueEvents(issue.id)

    } catch (error) {
      alert('Failed to update events: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setUpdatingEvents(false)
    }
  }

  // Helper function to get events count by date with color coding
  const getEventCountsByDate = () => {
    if (!issue) return []

    // Calculate 3-day range starting from the newsletter date (issue.date)
    // Day 1: Newsletter date, Day 2: Next day, Day 3: Day after that
    const newsletterDate = new Date(issue.date + 'T00:00:00') // Parse as local date

    const dates = []
    for (let i = 0; i <= 2; i++) {
      const date = new Date(newsletterDate)
      date.setDate(newsletterDate.getDate() + i)
      const dateStr = date.toISOString().split('T')[0]

      // Count selected events for this date
      const eventCount = issueEvents.filter(ce =>
        ce.event_date === dateStr && ce.is_selected
      ).length

      // Determine color based on count
      let colorClass = 'text-red-600' // 0 events
      if (eventCount === 8) colorClass = 'text-green-600'
      else if (eventCount > 0) colorClass = 'text-yellow-600'

      dates.push({
        date: dateStr,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        monthDay: date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
        count: eventCount,
        colorClass
      })
    }

    return dates
  }

  const handleEventsExpand = () => {
    if (!eventsExpanded && issue) {
      // Calculate 3-day range starting from the newsletter date (issue.date)
      // Day 1: Newsletter date, Day 2: Next day, Day 3: Day after that
      const newsletterDate = new Date(issue.date + 'T00:00:00') // Parse as local date

      const dates = []
      for (let i = 0; i <= 2; i++) {
        const date = new Date(newsletterDate)
        date.setDate(newsletterDate.getDate() + i)
        dates.push(date.toISOString().split('T')[0])
      }

      const startDateStr = dates[0]
      const endDateStr = dates[dates.length - 1]

      console.log('Fetching events with date range:', startDateStr, 'to', endDateStr, 'for newsletter date:', issue.date)
      fetchAvailableEvents(startDateStr, endDateStr)
    }
    setEventsExpanded(!eventsExpanded)
  }

  const getScoreColor = (score: number) => {
    if (score >= 32) return 'text-green-600'  // 80% of 40
    if (score >= 26) return 'text-yellow-600' // 65% of 40
    return 'text-red-600'
  }

  const formatStatus = (status: string) => {
    switch (status) {
      case 'draft': return 'Draft'
      case 'in_review': return 'In Review'
      case 'changes_made': return 'Changes Made'
      case 'sent': return 'Sent'
      case 'failed': return 'Failed'
      case 'processing': return 'Processing RSS Feeds...'
      default: return status
    }
  }

  const updateIssueStatus = async (action: 'changes_made') => {
    if (!issue) return

    setUpdatingStatus(true)
    try {
      const response = await fetch(`/api/campaigns/${issue.id}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update issue status')
      }

      const data = await response.json()

      // Update local issue state
      setissue(prev => {
        if (!prev) return prev
        return {
          ...prev,
          status: 'changes_made',
          last_action: action,
          last_action_at: data.issue.last_action_at,
          last_action_by: data.issue.last_action_by
        }
      })

      alert(`issue marked as "Changes Made" and status updated. Slack notification sent.`)

    } catch (error) {
      alert('Failed to update issue status: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleDeleteConfirm = () => {
    setDeleteModal(false)
    router.push('/dashboard/issues')
  }

  const handleDeleteCancel = () => {
    setDeleteModal(false)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    console.log('🎯 handleDragEnd called with event:', event)
    const { active, over } = event

    if (!over || active.id === over.id || !issue) {
      console.log('⚠️ Early return from handleDragEnd:', { over: !!over, sameId: active.id === over?.id, issue: !!issue })
      return
    }

    console.log('Drag ended:', { activeId: active.id, overId: over.id })

    // Get current active articles sorted by rank
    const activeArticles = issue.articles
      .filter(article => article.is_active)
      .sort((a, b) => (a.rank || 999) - (b.rank || 999))

    const oldIndex = activeArticles.findIndex(article => article.id === active.id)
    const newIndex = activeArticles.findIndex(article => article.id === over.id)

    console.log('Indexes:', { oldIndex, newIndex, totalActive: activeArticles.length })

    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      // Create new order using arrayMove
      const newOrder = arrayMove(activeArticles, oldIndex, newIndex)

      console.log('New order:', newOrder.map((a, i) => `${i + 1}. ${a.headline} (was rank ${a.rank})`))

      // Update local state immediately for UI responsiveness
      setissue(prev => {
        if (!prev) return prev
        const updatedArticles = [...prev.articles]

        // Update ranks for all active articles based on new order
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

      // Send update to server
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

        // Check if subject line was auto-regenerated
        if (responseData.subject_line_regenerated && responseData.new_subject_line) {
          console.log(`Subject line auto-updated to: "${responseData.new_subject_line}"`)

          // Update the issue state with the new subject line
          setissue(prev => prev ? {
            ...prev,
            subject_line: responseData.new_subject_line
          } : null)
        }
      } catch (error) {
        console.error('Failed to update article order:', error)
        // Refresh issue to revert changes
        if (issue.id) {
          fetchissue(issue.id)
        }
      }
    }
  }

  const formatDate = (dateString: string) => {
    // Parse date as local date to avoid timezone offset issues
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day) // month is 0-indexed
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </Layout>
    )
  }

  if (error || !issue) {
    return (
      <Layout>
        <div className="text-center py-12">
          <div className="text-red-600 mb-4">
            {error || 'issue not found'}
          </div>
          <Link href="/dashboard/issues" className="text-brand-primary hover:text-blue-700">
            Back to Campaigns
          </Link>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        {/* issue Header */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Issue for {formatDate(issue.date)}
              </h1>
              <div className="flex items-center space-x-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  issue.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                  issue.status === 'in_review' ? 'bg-yellow-100 text-yellow-800' :
                  issue.status === 'changes_made' ? 'bg-orange-100 text-orange-800' :
                  issue.status === 'sent' ? 'bg-green-100 text-green-800' :
                  issue.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {issue.status === 'processing' && (
                    <svg className="animate-spin -ml-0.5 mr-1.5 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {formatStatus(issue.status)}
                </span>
                <span className="text-sm text-gray-500">
                  {(issue.articles || []).filter(a => a?.is_active && !a?.skipped).length}/{totalMaxArticles} selected
                </span>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={sendTestEmail}
                disabled={sendingTest || saving || issue.status === 'processing'}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium"
              >
                {sendingTest ? 'Sending...' : 'Send Test Email'}
              </button>
              <button
                onClick={processRSSFeeds}
                disabled={processing || saving || generatingSubject || issue.status === 'processing'}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium"
              >
                {(processing || issue.status === 'processing') ? 'Processing in background...' : 'Reprocess Articles'}
              </button>
              <button
                onClick={previewNewsletter}
                disabled={saving || generatingSubject || previewLoading}
                className="bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-800 px-4 py-2 rounded text-sm font-medium flex items-center space-x-2"
              >
                {previewLoading && (
                  <svg className="animate-spin h-4 w-4 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <span>{previewLoading ? 'Loading...' : 'Preview Email'}</span>
              </button>
            </div>
          </div>

          {processingStatus && (
            <div className="text-sm text-blue-600 font-medium mt-3 text-center">
              {processingStatus}
            </div>
          )}

          {testSendStatus && (
            <div className="text-sm text-green-600 font-medium mt-3 text-center">
              {testSendStatus}
            </div>
          )}

          {/* Subject Line Section */}
          <div className="mt-4 p-3 bg-gray-50 rounded">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="text-sm text-gray-600 mb-1">Subject Line:</div>
                {editingSubject ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editSubjectValue}
                      onChange={(e) => setEditSubjectValue(e.target.value)}
                      placeholder="Enter subject line..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        {editSubjectValue.length} characters
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={cancelEditingSubject}
                          disabled={savingSubject}
                          className="px-3 py-1 text-sm text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveSubjectLine}
                          disabled={savingSubject || !editSubjectValue.trim()}
                          className="px-3 py-1 text-sm text-white bg-green-600 border border-green-600 rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          {savingSubject ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {issue.subject_line ? (
                      <div className="font-medium text-gray-900">{issue.subject_line}</div>
                    ) : (
                      <div className="text-gray-500 italic">No subject line generated yet</div>
                    )}
                  </>
                )}
              </div>
              {!editingSubject && (
                <div className="ml-4 flex space-x-2">
                  {issue.subject_line && (
                    <button
                      onClick={startEditingSubject}
                      disabled={generatingSubject || processing || savingSubject}
                      className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white px-3 py-1 rounded text-sm font-medium"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={generateSubjectLine}
                    disabled={generatingSubject || processing || savingSubject}
                    className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-3 py-1 rounded text-sm font-medium"
                  >
                    {generatingSubject ? 'Generating...' : issue.subject_line ? 'Regenerate' : 'Generate'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* issue Approval Buttons */}
          <div className="mt-4 flex justify-end space-x-3">
            <button
              onClick={() => updateIssueStatus('changes_made')}
              disabled={updatingStatus}
              className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center"
            >
              {updatingStatus ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Updating...
                </>
              ) : (
                'Changes Made'
              )}
            </button>
            <button
              onClick={() => setDeleteModal(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md font-medium text-sm"
            >
              Delete Issue
            </button>
          </div>
        </div>

        {/* Dynamic Newsletter Sections */}
        {/* Note: Advertisement section (c0bc7173-de47-41b2-a260-77f55525ee3d) is excluded - handled by AdModulesPanel */}
        {/* Note: AI Applications section (853f8d0b-bc76-473a-bfc6-421418266222) is excluded - handled by AIAppModulesPanel */}
        {/* Note: Welcome section (section_type='welcome') is excluded - handled by TextBoxModulesPanel */}
        {newsletterSections
          .filter(section => section.is_active && section.id !== primaryArticlesSection?.id && section.id !== secondaryArticlesSection?.id && section.id !== 'c0bc7173-de47-41b2-a260-77f55525ee3d' && section.id !== '853f8d0b-bc76-473a-bfc6-421418266222' && section.section_type !== 'welcome')
          .map(section => (
            <NewsletterSectionComponent
              key={section.id}
              section={section}
              issue={issue}
              expanded={sectionExpandedStates[section.id] || false}
              onToggleExpanded={() => {
                setSectionExpandedStates(prev => ({
                  ...prev,
                  [section.id]: !prev[section.id]
                }))
              }}
            />
          ))}

        {/* Dynamic Article Sections */}
        {issue && <ArticleModulesPanel issueId={issue.id} issueStatus={issue.status} />}

        {/* Dynamic Ad Sections */}
        {issue && <AdModulesPanel issueId={issue.id} />}

        {/* Dynamic Poll Sections */}
        {issue && <PollModulesPanel issueId={issue.id} />}

        {/* Dynamic AI App Sections */}
        {issue && <AIAppModulesPanel issueId={issue.id} />}

        {/* Dynamic Prompt Sections */}
        {issue && <PromptModulesPanel issueId={issue.id} issueStatus={issue.status} />}

        {/* Text Box Sections */}
        {issue && <TextBoxModulesPanel issueId={issue.id} issueStatus={issue.status} />}

        {/* SparkLoop Recommendation Modules */}
        {issue && <SparkLoopRecsModulesPanel issueId={issue.id} />}

        {/* Preview Modal */}
        {showPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="text-lg font-medium text-gray-900">
                  Email Preview
                </h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      if (previewHtml) {
                        const blob = new Blob([previewHtml], { type: 'text/html' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `newsletter-${issue?.date}.html`
                        a.click()
                        URL.revokeObjectURL(url)
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                  >
                    Download HTML
                  </button>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                {previewHtml && (
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full h-full min-h-[600px]"
                    title="Email Preview"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Delete issue Modal */}
        {issue && (
          <DeleteIssueModal
            issue={issue}
            isOpen={deleteModal}
            onClose={handleDeleteCancel}
            onConfirm={handleDeleteConfirm}
          />
        )}
      </div>
    </Layout>
  )
}