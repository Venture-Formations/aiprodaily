'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import type { issueWithArticles, issueEvent, Event, NewsletterSection } from '@/types/database'
import type { CriteriaItem } from './types'
import { createArticleHandlers } from './handlers/articleHandlers'
import { createIssueActions } from './handlers/issueActions'
import { createEventHandlers } from './handlers/eventHandlers'

export function useIssueDetail() {
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

  const primaryArticlesSection = newsletterSections.find(s =>
    s.section_type === 'primary_articles'
  )
  const secondaryArticlesSection = newsletterSections.find(s =>
    s.section_type === 'secondary_articles'
  )

  // Criteria and article limits state
  const [criteriaConfig, setCriteriaConfig] = useState<CriteriaItem[]>([])
  const [secondaryCriteriaConfig, setSecondaryCriteriaConfig] = useState<CriteriaItem[]>([])
  const [maxTopArticles, setMaxTopArticles] = useState(3)
  const [maxBottomArticles, setMaxBottomArticles] = useState(3)
  const [maxSecondaryArticles, setMaxSecondaryArticles] = useState(3)
  const [totalMaxArticles, setTotalMaxArticles] = useState(6)
  const [sectionExpandedStates, setSectionExpandedStates] = useState<{ [key: string]: boolean }>({})

  // Refs for stable access in handler factories
  const issueRef = useRef(issue)
  issueRef.current = issue
  const issueEventsRef = useRef(issueEvents)
  issueEventsRef.current = issueEvents
  const eventsExpandedRef = useRef(eventsExpanded)
  eventsExpandedRef.current = eventsExpanded
  const editSubjectValueRef = useRef(editSubjectValue)
  editSubjectValueRef.current = editSubjectValue

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // --- Data fetching ---

  const fetchissue = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/campaigns/${id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch issue')
      }
      const data = await response.json()
      const issueData = data.issue
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
  }, [])

  const fetchCriteriaConfig = useCallback(async (publicationId: string) => {
    try {
      const response = await fetch(`/api/settings/email?publication_id=${publicationId}`)
      if (response.ok) {
        const data = await response.json()

        const primaryEnabledCountSetting = data.settings.find((s: any) => s.key === 'primary_criteria_enabled_count')
        const secondaryEnabledCountSetting = data.settings.find((s: any) => s.key === 'secondary_criteria_enabled_count')
        const fallbackEnabledCountSetting = data.settings.find((s: any) => s.key === 'criteria_enabled_count')

        const primaryEnabledCount = primaryEnabledCountSetting?.value ? parseInt(primaryEnabledCountSetting.value) :
                                     (fallbackEnabledCountSetting?.value ? parseInt(fallbackEnabledCountSetting.value) : 3)
        const secondaryEnabledCount = secondaryEnabledCountSetting?.value ? parseInt(secondaryEnabledCountSetting.value) :
                                       (fallbackEnabledCountSetting?.value ? parseInt(fallbackEnabledCountSetting.value) : 3)

        const primaryCriteria: CriteriaItem[] = []
        for (let i = 1; i <= primaryEnabledCount; i++) {
          const nameSetting = data.settings.find((s: any) => s.key === `criteria_${i}_name`)
          const weightSetting = data.settings.find((s: any) => s.key === `criteria_${i}_weight`)
          primaryCriteria.push({
            name: nameSetting?.value || `Criteria ${i}`,
            weight: weightSetting?.value ? parseFloat(weightSetting.value) : 1.0
          })
        }

        const secondaryCriteria: CriteriaItem[] = []
        for (let i = 1; i <= secondaryEnabledCount; i++) {
          const nameSetting = data.settings.find((s: any) => s.key === `secondary_criteria_${i}_name`)
          const weightSetting = data.settings.find((s: any) => s.key === `secondary_criteria_${i}_weight`)
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
  }, [])

  const fetchNewsletterSections = useCallback(async (publicationId: string) => {
    setLoadingSections(true)
    try {
      const response = await fetch(`/api/settings/newsletter-sections?publication_id=${publicationId}`)
      if (response.ok) {
        const data = await response.json()
        setNewsletterSections(data.sections || [])
      }
    } catch (error) {
      console.error('Failed to fetch newsletter sections:', error)
    } finally {
      setLoadingSections(false)
    }
  }, [])

  const fetchArticleModulesSum = useCallback(async (publicationId: string) => {
    try {
      const response = await fetch(`/api/article-modules?publication_id=${publicationId}`)
      if (response.ok) {
        const data = await response.json()
        if (data.modules && Array.isArray(data.modules)) {
          const sum = data.modules
            .filter((m: any) => m.is_active)
            .reduce((total: number, m: any) => total + (m.articles_count || 3), 0)
          setTotalMaxArticles(sum > 0 ? sum : 6)
        }
      }
    } catch (error) {
      console.error('Failed to fetch article modules sum:', error)
    }
  }, [])

  // --- Handler factories ---

  const getIssue = useCallback(() => issueRef.current, [])

  const articleHandlers = createArticleHandlers(
    getIssue,
    setissue,
    setSaving,
    fetchissue,
  )

  const eventHandlers = createEventHandlers(
    getIssue,
    () => issueEventsRef.current,
    setissueEvents,
    setAvailableEvents,
    setLoadingEvents,
    setUpdatingEvents,
    () => eventsExpandedRef.current,
    setEventsExpanded,
  )

  const issueActions = createIssueActions(
    getIssue,
    setissue,
    setProcessing,
    setProcessingStatus,
    setGeneratingSubject,
    setPreviewLoading,
    setPreviewHtml,
    setShowPreview,
    setSendingTest,
    setTestSendStatus,
    setUpdatingStatus,
    setEditingSubject,
    setSavingSubject,
    () => editSubjectValueRef.current,
    setEditSubjectValue,
    fetchissue,
  )

  // --- Effects ---

  useEffect(() => {
    console.log('issue page loaded, params:', params.id)
    if (params.id) {
      fetchissue(params.id as string)
      eventHandlers.fetchissueEvents(params.id as string)
    }
  }, [params.id])

  // Poll for status updates when issue is processing
  useEffect(() => {
    if (!issue || issue.status !== 'processing') {
      return
    }

    console.log('issue is processing, starting status polling...')

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/campaigns/${issue.id}`)
        if (response.ok) {
          const data = await response.json()
          const newStatus = data.issue.status

          console.log(`Status poll: ${newStatus}`)

          if (newStatus !== 'processing') {
            console.log('Processing complete! Refreshing issue data...')
            clearInterval(pollInterval)
            await fetchissue(issue.id)
            await eventHandlers.fetchissueEvents(issue.id)
          }
        }
      } catch (error) {
        console.error('Status poll error:', error)
      }
    }, 3000)

    return () => clearInterval(pollInterval)
  }, [issue?.status, issue?.id])

  // Fetch publication-scoped data when publication_id is available
  useEffect(() => {
    if (issue?.publication_id) {
      fetchArticleModulesSum(issue.publication_id)
      fetchNewsletterSections(issue.publication_id)
      fetchCriteriaConfig(issue.publication_id)
    }
  }, [issue?.publication_id])

  // --- Utility functions ---

  const getScoreColor = (score: number) => {
    if (score >= 32) return 'text-green-600'
    if (score >= 26) return 'text-yellow-600'
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

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const handleDeleteConfirm = () => {
    setDeleteModal(false)
    router.push('/dashboard/issues')
  }

  const handleDeleteCancel = () => {
    setDeleteModal(false)
  }

  const toggleSectionExpanded = (sectionId: string) => {
    setSectionExpandedStates(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }))
  }

  return {
    // Core state
    issue,
    loading,
    error,
    saving,
    processing,
    processingStatus,
    previewHtml,
    showPreview,
    setShowPreview,
    generatingSubject,
    previewLoading,
    updatingStatus,
    deleteModal,
    setDeleteModal,
    editingSubject,
    editSubjectValue,
    setEditSubjectValue,
    savingSubject,
    sendingTest,
    testSendStatus,

    // Events state
    issueEvents,
    availableEvents,
    loadingEvents,
    eventsExpanded,
    updatingEvents,
    articlesExpanded,
    setArticlesExpanded,
    secondaryArticlesExpanded,
    setSecondaryArticlesExpanded,

    // Newsletter sections
    newsletterSections,
    loadingSections,
    primaryArticlesSection,
    secondaryArticlesSection,

    // Criteria and article limits
    criteriaConfig,
    secondaryCriteriaConfig,
    maxTopArticles,
    maxBottomArticles,
    maxSecondaryArticles,
    totalMaxArticles,
    sectionExpandedStates,

    // DnD
    sensors,

    // Article actions
    ...articleHandlers,

    // Event actions
    ...eventHandlers,

    // Issue actions
    ...issueActions,

    // Utilities
    getScoreColor,
    formatStatus,
    formatDate,
    handleDeleteConfirm,
    handleDeleteCancel,
    toggleSectionExpanded,
  }
}
