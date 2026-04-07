'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'

const DEFAULT_SETTINGS = {
  emailProvider: 'mailerlite' as 'mailerlite' | 'sendgrid' | 'beehiiv',
  beehiivPublicationId: '',
  beehiivApiKey: '',
  hasBeehiivApiKey: false,
  mailerliteReviewGroupId: '',
  mailerliteMainGroupId: '',
  mailerliteSecondaryGroupId: '',
  mailerliteTestGroupId: '',
  sendgridReviewListId: '',
  sendgridMainListId: '',
  sendgridSecondaryListId: '',
  sendgridTestListId: '',
  sendgridSenderId: '',
  sendgridUnsubscribeGroupId: '',
  fromEmail: 'scoop@stcscoop.com',
  senderName: 'St. Cloud Scoop',
  reviewScheduleEnabled: true,
  rssProcessingTime: '20:30',
  issueCreationTime: '20:50',
  scheduledSendTime: '21:00',
  dailyScheduleEnabled: false,
  dailyissueCreationTime: '04:30',
  dailyScheduledSendTime: '04:55',
  secondaryScheduleEnabled: false,
  secondaryissueCreationTime: '04:30',
  secondaryScheduledSendTime: '04:55',
  secondarySendDays: [1, 2, 3, 4, 5],
}

export function useEmailSettings(publicationId: string) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [maxTopArticles, setMaxTopArticles] = useState<number>(3)
  const [maxBottomArticles, setMaxBottomArticles] = useState<number>(3)
  const [savingMaxArticles, setSavingMaxArticles] = useState(false)
  const [primaryLookbackHours, setPrimaryLookbackHours] = useState<number>(72)
  const [secondaryLookbackHours, setSecondaryLookbackHours] = useState<number>(36)
  const [savingLookbackHours, setSavingLookbackHours] = useState(false)
  const [dedupLookbackDays, setDedupLookbackDays] = useState<number>(3)
  const [dedupStrictnessThreshold, setDedupStrictnessThreshold] = useState<number>(0.80)
  const [savingDedupSettings, setSavingDedupSettings] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  // Subject Line Prompt state
  const pathname = usePathname()
  const newsletterSlug = pathname ? pathname.match(/^\/dashboard\/([^\/]+)/)?.[1] : null
  const [subjectLinePrompt, setSubjectLinePrompt] = useState<string>('')
  const [subjectLinePromptOriginal, setSubjectLinePromptOriginal] = useState<string>('')
  const [editingSubjectLine, setEditingSubjectLine] = useState(false)
  const [expandedSubjectLine, setExpandedSubjectLine] = useState(false)
  const [savingSubjectLine, setSavingSubjectLine] = useState(false)
  const [prettyPrintSubjectLine, setPrettyPrintSubjectLine] = useState(true)

  const showMessage = (msg: string, duration = 3000) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), duration)
  }

  // --- Load functions ---

  const loadSettings = async () => {
    try {
      const response = await fetch(`/api/settings/email?publication_id=${publicationId}`)
      if (response.ok) {
        const data = await response.json()
        const { max_top_articles, max_bottom_articles, ...emailSettings } = data
        const processedData = {
          ...emailSettings,
          reviewScheduleEnabled: emailSettings.reviewScheduleEnabled === 'true',
          dailyScheduleEnabled: emailSettings.dailyScheduleEnabled === 'true',
          secondaryScheduleEnabled: emailSettings.secondaryScheduleEnabled === 'true',
        }
        setSettings(processedData)
        if (data.max_top_articles) setMaxTopArticles(parseInt(data.max_top_articles))
        if (data.max_bottom_articles) setMaxBottomArticles(parseInt(data.max_bottom_articles))
        if (data.primary_article_lookback_hours) setPrimaryLookbackHours(parseInt(data.primary_article_lookback_hours))
        if (data.secondary_article_lookback_hours) setSecondaryLookbackHours(parseInt(data.secondary_article_lookback_hours))
        if (data.dedup_historical_lookback_days) setDedupLookbackDays(parseInt(data.dedup_historical_lookback_days))
        if (data.dedup_strictness_threshold) setDedupStrictnessThreshold(parseFloat(data.dedup_strictness_threshold))
        setIsLoaded(true)
      }
    } catch (error) {
      console.error('Failed to load email settings:', error)
    }
  }

  const loadSubjectLinePrompt = async () => {
    try {
      const response = await fetch(`/api/settings/ai-prompts?publication_id=${publicationId}`)
      if (response.ok) {
        const data = await response.json()
        const subjectPrompt = data.prompts?.find((p: any) => p.key === 'ai_prompt_subject_line')
        if (subjectPrompt) {
          const promptValue = typeof subjectPrompt.value === 'string' ? subjectPrompt.value : JSON.stringify(subjectPrompt.value, null, 2)
          setSubjectLinePrompt(promptValue)
          setSubjectLinePromptOriginal(promptValue)
        }
      }
    } catch (error) {
      console.error('Failed to load subject line prompt:', error)
    }
  }

  useEffect(() => {
    loadSettings()
    loadSubjectLinePrompt()
  }, [publicationId])

  // --- Save handlers ---

  const handleChange = (field: string, value: string | boolean | number[]) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    const emailSettings: any = { ...settings }
    delete emailSettings.primary_article_lookback_hours
    delete emailSettings.secondary_article_lookback_hours
    delete emailSettings.dedup_historical_lookback_days
    delete emailSettings.dedup_strictness_threshold
    try {
      const response = await fetch(`/api/settings/email?publication_id=${publicationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailSettings),
      })
      if (response.ok) {
        showMessage('Settings saved successfully!')
      } else {
        throw new Error('Failed to save settings')
      }
    } catch (error) {
      setMessage('Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const saveMaxArticles = async () => {
    if (maxTopArticles < 1 || maxTopArticles > 10) { alert('Max primary articles must be between 1 and 10'); return }
    if (maxBottomArticles < 1 || maxBottomArticles > 10) { alert('Max secondary articles must be between 1 and 10'); return }
    setSavingMaxArticles(true)
    setMessage('')
    try {
      const response = await fetch(`/api/settings/email?publication_id=${publicationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_top_articles: maxTopArticles.toString(), max_bottom_articles: maxBottomArticles.toString() }),
      })
      if (response.ok) showMessage('Max articles settings updated successfully!')
      else throw new Error('Failed to update settings')
    } catch (error) {
      setMessage('Failed to update max articles settings. Please try again.')
    } finally {
      setSavingMaxArticles(false)
    }
  }

  const saveLookbackHours = async () => {
    if (primaryLookbackHours < 1 || primaryLookbackHours > 168) { alert('Primary article lookback hours must be between 1 and 168 (1 week)'); return }
    if (secondaryLookbackHours < 1 || secondaryLookbackHours > 168) { alert('Secondary article lookback hours must be between 1 and 168 (1 week)'); return }
    setSavingLookbackHours(true)
    setMessage('')
    try {
      const response = await fetch(`/api/settings/email?publication_id=${publicationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primary_article_lookback_hours: primaryLookbackHours.toString(), secondary_article_lookback_hours: secondaryLookbackHours.toString() }),
      })
      if (response.ok) showMessage('Article lookback hours updated successfully!')
      else throw new Error('Failed to update settings')
    } catch (error) {
      setMessage('Failed to update lookback hours. Please try again.')
    } finally {
      setSavingLookbackHours(false)
    }
  }

  const saveDedupSettings = async () => {
    if (dedupLookbackDays < 1 || dedupLookbackDays > 14) { alert('Historical lookback days must be between 1 and 14'); return }
    if (dedupStrictnessThreshold < 0.5 || dedupStrictnessThreshold > 1.0) { alert('Strictness threshold must be between 0.5 and 1.0'); return }
    setSavingDedupSettings(true)
    setMessage('')
    try {
      const response = await fetch(`/api/settings/email?publication_id=${publicationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dedup_historical_lookback_days: dedupLookbackDays.toString(), dedup_strictness_threshold: dedupStrictnessThreshold.toString() }),
      })
      if (response.ok) showMessage('Deduplication settings updated successfully!')
      else throw new Error('Failed to update settings')
    } catch (error) {
      setMessage('Failed to update deduplication settings. Please try again.')
    } finally {
      setSavingDedupSettings(false)
    }
  }

  // --- Subject line prompt handlers ---

  const handleEditSubjectLine = () => {
    let valueStr: string
    try {
      const parsed = JSON.parse(subjectLinePromptOriginal)
      valueStr = JSON.stringify(parsed, null, 2)
    } catch (e) {
      valueStr = subjectLinePromptOriginal
    }
    setSubjectLinePrompt(valueStr)
    setEditingSubjectLine(true)
    setExpandedSubjectLine(true)
  }

  const handleCancelSubjectLine = () => {
    setSubjectLinePrompt(subjectLinePromptOriginal)
    setEditingSubjectLine(false)
  }

  const saveSubjectLinePrompt = async () => {
    if (!newsletterSlug) return
    setSavingSubjectLine(true)
    setMessage('')
    try {
      const response = await fetch(`/api/settings/ai-prompts?publication_id=${publicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'ai_prompt_subject_line', value: subjectLinePrompt }),
      })
      if (response.ok) {
        showMessage('Subject line prompt saved successfully!')
        setSubjectLinePromptOriginal(subjectLinePrompt)
        setEditingSubjectLine(false)
      } else {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to save prompt (${response.status})`)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      setMessage(`Failed to save: ${errorMsg}`)
    } finally {
      setSavingSubjectLine(false)
    }
  }

  const handleResetSubjectLine = async () => {
    if (!confirm('Are you sure you want to reset this prompt to its default value? This cannot be undone.')) return
    setSavingSubjectLine(true)
    setMessage('')
    try {
      const response = await fetch(`/api/settings/ai-prompts?publication_id=${publicationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'ai_prompt_subject_line' }),
      })
      if (response.ok) {
        const data = await response.json()
        showMessage(data.used_custom_default ? 'Prompt reset to your custom default!' : 'Prompt reset to original code default!')
        await loadSubjectLinePrompt()
      } else {
        throw new Error('Failed to reset prompt')
      }
    } catch (error) {
      showMessage('Error: Failed to reset prompt', 5000)
    } finally {
      setSavingSubjectLine(false)
    }
  }

  const handleSaveAsDefaultSubjectLine = async () => {
    if (!confirm('Save this as the default prompt for all new publications?')) return
    setSavingSubjectLine(true)
    setMessage('')
    try {
      const response = await fetch(`/api/settings/ai-prompts?publication_id=${publicationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'ai_prompt_subject_line', action: 'save_as_default' }),
      })
      if (response.ok) showMessage('Saved as default successfully!')
      else throw new Error('Failed to save as default')
    } catch (error) {
      showMessage('Error: Failed to save as default', 5000)
    } finally {
      setSavingSubjectLine(false)
    }
  }

  return {
    settings, handleChange, saving, handleSave, message, isLoaded, newsletterSlug,
    maxTopArticles, setMaxTopArticles, maxBottomArticles, setMaxBottomArticles, savingMaxArticles, saveMaxArticles,
    primaryLookbackHours, setPrimaryLookbackHours, secondaryLookbackHours, setSecondaryLookbackHours, savingLookbackHours, saveLookbackHours,
    dedupLookbackDays, setDedupLookbackDays, dedupStrictnessThreshold, setDedupStrictnessThreshold, savingDedupSettings, saveDedupSettings,
    subjectLinePrompt, setSubjectLinePrompt, subjectLinePromptOriginal, editingSubjectLine, expandedSubjectLine, setExpandedSubjectLine,
    savingSubjectLine, prettyPrintSubjectLine, setPrettyPrintSubjectLine,
    handleEditSubjectLine, handleCancelSubjectLine, saveSubjectLinePrompt, handleResetSubjectLine, handleSaveAsDefaultSubjectLine,
  }
}
