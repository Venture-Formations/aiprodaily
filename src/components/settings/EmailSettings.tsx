'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function EmailSettings() {
  const [settings, setSettings] = useState({
    // Email Provider Toggle
    emailProvider: 'mailerlite' as 'mailerlite' | 'sendgrid',

    // MailerLite Settings
    mailerliteReviewGroupId: '',
    mailerliteMainGroupId: '',
    mailerliteSecondaryGroupId: '',
    mailerliteTestGroupId: '',

    // SendGrid Settings
    sendgridReviewListId: '',
    sendgridMainListId: '',
    sendgridSecondaryListId: '',
    sendgridTestListId: '',
    sendgridSenderId: '',
    sendgridUnsubscribeGroupId: '',

    // Common Email Settings
    fromEmail: 'scoop@stcscoop.com',
    senderName: 'St. Cloud Scoop',

    // Review Schedule Settings (Central Time)
    reviewScheduleEnabled: true,
    rssProcessingTime: '20:30',  // 8:30 PM
    issueCreationTime: '20:50',  // 8:50 PM
    scheduledSendTime: '21:00',  // 9:00 PM

    // Daily Newsletter Settings (Central Time)
    dailyScheduleEnabled: false,
    dailyissueCreationTime: '04:30',  // 4:30 AM
    dailyScheduledSendTime: '04:55',  // 4:55 AM

    // Secondary Newsletter Settings (Central Time)
    secondaryScheduleEnabled: false,
    secondaryissueCreationTime: '04:30',  // 4:30 AM
    secondaryScheduledSendTime: '04:55',  // 4:55 AM
    secondarySendDays: [1, 2, 3, 4, 5]  // Mon-Fri by default
  })
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

  useEffect(() => {
    loadSettings()
    loadMaxArticles()
    loadLookbackHours()
    loadDedupSettings()
    loadSubjectLinePrompt()
  }, [])

  const loadSettings = async () => {
    try {
      console.log('FRONTEND: Loading email settings...')
      const response = await fetch('/api/settings/email')
      if (response.ok) {
        const data = await response.json()
        console.log('FRONTEND: Loaded settings from API:', data)

        // Exclude max articles fields - they have their own state and save button
        const { max_top_articles, max_bottom_articles, ...emailSettings } = data

        // Convert string boolean values back to actual booleans
        const processedData = {
          ...emailSettings,
          reviewScheduleEnabled: emailSettings.reviewScheduleEnabled === 'true',
          dailyScheduleEnabled: emailSettings.dailyScheduleEnabled === 'true',
          secondaryScheduleEnabled: emailSettings.secondaryScheduleEnabled === 'true'
        }
        console.log('FRONTEND: Processed settings with boolean conversion (max articles excluded):', processedData)
        setSettings(processedData)  // Don't merge with prev - use fresh data from API
        setIsLoaded(true)
        console.log('FRONTEND: Settings state updated')
      }
    } catch (error) {
      console.error('FRONTEND: Failed to load email settings:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')

    // Exclude lookback hours and dedup settings from email settings save (they have their own save buttons)
    const emailSettings: any = { ...settings }
    delete emailSettings.primary_article_lookback_hours
    delete emailSettings.secondary_article_lookback_hours
    delete emailSettings.dedup_historical_lookback_days
    delete emailSettings.dedup_strictness_threshold

    console.log('FRONTEND: Saving email settings:', emailSettings)

    try {
      const response = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailSettings)
      })

      console.log('FRONTEND: Response status:', response.status)

      if (response.ok) {
        const result = await response.json()
        console.log('FRONTEND: Save successful:', result)
        setMessage('Settings saved successfully!')
        // Don't reload - keep current state to avoid clearing user's input
        setTimeout(() => setMessage(''), 3000)
      } else {
        const errorData = await response.json()
        console.error('FRONTEND: Save failed:', errorData)
        throw new Error('Failed to save settings')
      }
    } catch (error) {
      setMessage('Failed to save settings. Please try again.')
      console.error('FRONTEND: Save error:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field: string, value: string | boolean | number[]) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  const loadMaxArticles = async () => {
    try {
      const response = await fetch('/api/settings/email')
      if (response.ok) {
        const data = await response.json()

        // Data is a flat object, not { settings: [...] }
        if (data.max_top_articles) {
          setMaxTopArticles(parseInt(data.max_top_articles))
        }
        if (data.max_bottom_articles) {
          setMaxBottomArticles(parseInt(data.max_bottom_articles))
        }
      }
    } catch (error) {
      console.error('Failed to load max articles settings:', error)
    }
  }

  const saveMaxArticles = async () => {
    if (maxTopArticles < 1 || maxTopArticles > 10) {
      alert('Max primary articles must be between 1 and 10')
      return
    }
    if (maxBottomArticles < 1 || maxBottomArticles > 10) {
      alert('Max secondary articles must be between 1 and 10')
      return
    }

    setSavingMaxArticles(true)
    setMessage('')

    try {
      const response = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_top_articles: maxTopArticles.toString(),
          max_bottom_articles: maxBottomArticles.toString()
        })
      })

      if (response.ok) {
        setMessage('Max articles settings updated successfully!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to update settings')
      }
    } catch (error) {
      setMessage('Failed to update max articles settings. Please try again.')
      console.error('Save error:', error)
    } finally {
      setSavingMaxArticles(false)
    }
  }

  const loadLookbackHours = async () => {
    try {
      const response = await fetch('/api/settings/email')
      if (response.ok) {
        const data = await response.json()

        if (data.primary_article_lookback_hours) {
          setPrimaryLookbackHours(parseInt(data.primary_article_lookback_hours))
        }
        if (data.secondary_article_lookback_hours) {
          setSecondaryLookbackHours(parseInt(data.secondary_article_lookback_hours))
        }
      }
    } catch (error) {
      console.error('Failed to load lookback hours settings:', error)
    }
  }

  const saveLookbackHours = async () => {
    if (primaryLookbackHours < 1 || primaryLookbackHours > 168) {
      alert('Primary article lookback hours must be between 1 and 168 (1 week)')
      return
    }
    if (secondaryLookbackHours < 1 || secondaryLookbackHours > 168) {
      alert('Secondary article lookback hours must be between 1 and 168 (1 week)')
      return
    }

    setSavingLookbackHours(true)
    setMessage('')

    try {
      const response = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primary_article_lookback_hours: primaryLookbackHours.toString(),
          secondary_article_lookback_hours: secondaryLookbackHours.toString()
        })
      })

      if (response.ok) {
        setMessage('Article lookback hours updated successfully!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to update settings')
      }
    } catch (error) {
      setMessage('Failed to update lookback hours. Please try again.')
      console.error('Save error:', error)
    } finally {
      setSavingLookbackHours(false)
    }
  }

  const loadDedupSettings = async () => {
    try {
      const response = await fetch('/api/settings/email')
      if (response.ok) {
        const data = await response.json()

        if (data.dedup_historical_lookback_days) {
          setDedupLookbackDays(parseInt(data.dedup_historical_lookback_days))
        }
        if (data.dedup_strictness_threshold) {
          setDedupStrictnessThreshold(parseFloat(data.dedup_strictness_threshold))
        }
      }
    } catch (error) {
      console.error('Failed to load deduplication settings:', error)
    }
  }

  const saveDedupSettings = async () => {
    if (dedupLookbackDays < 1 || dedupLookbackDays > 14) {
      alert('Historical lookback days must be between 1 and 14')
      return
    }
    if (dedupStrictnessThreshold < 0.5 || dedupStrictnessThreshold > 1.0) {
      alert('Strictness threshold must be between 0.5 and 1.0')
      return
    }

    setSavingDedupSettings(true)
    setMessage('')

    try {
      const response = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dedup_historical_lookback_days: dedupLookbackDays.toString(),
          dedup_strictness_threshold: dedupStrictnessThreshold.toString()
        })
      })

      if (response.ok) {
        setMessage('Deduplication settings updated successfully!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to update settings')
      }
    } catch (error) {
      setMessage('Failed to update deduplication settings. Please try again.')
      console.error('Save error:', error)
    } finally {
      setSavingDedupSettings(false)
    }
  }

  // Subject Line Prompt helper functions
  const detectProviderFromPrompt = (value: any): 'openai' | 'claude' => {
    try {
      const parsed = typeof value === 'string' ? JSON.parse(value) : value
      const model = (parsed?.model || '').toLowerCase()
      if (model.includes('claude') || model.includes('sonnet') || model.includes('opus') || model.includes('haiku')) {
        return 'claude'
      }
    } catch (e) {
      // Not valid JSON, default to openai
    }
    return 'openai'
  }

  const formatJSONForDisplay = (value: any, prettyPrint: boolean): string => {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        const jsonStr = prettyPrint ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed)
        if (prettyPrint) {
          return jsonStr.replace(/\\n/g, '\n')
        }
        return jsonStr
      } catch (e) {
        if (prettyPrint) {
          return value.replace(/\\n/g, '\n')
        }
        return value
      }
    }
    if (typeof value === 'object' && value !== null) {
      const jsonStr = prettyPrint ? JSON.stringify(value, null, 2) : JSON.stringify(value)
      if (prettyPrint) {
        return jsonStr.replace(/\\n/g, '\n')
      }
      return jsonStr
    }
    return String(value)
  }

  // Subject Line Prompt functions
  const loadSubjectLinePrompt = async () => {
    try {
      const response = await fetch('/api/settings/ai-prompts')
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
      const response = await fetch('/api/settings/ai-prompts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'ai_prompt_subject_line',
          value: subjectLinePrompt
        })
      })

      if (response.ok) {
        setMessage('Subject line prompt saved successfully!')
        setSubjectLinePromptOriginal(subjectLinePrompt)
        setEditingSubjectLine(false)
        setTimeout(() => setMessage(''), 3000)
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Save failed:', response.status, errorData)
        throw new Error(errorData.error || `Failed to save prompt (${response.status})`)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      setMessage(`Failed to save: ${errorMsg}`)
      console.error('Save error:', error)
    } finally {
      setSavingSubjectLine(false)
    }
  }

  const handleResetSubjectLine = async () => {
    if (!confirm('Are you sure you want to reset this prompt to its default value? This cannot be undone.')) {
      return
    }

    setSavingSubjectLine(true)
    setMessage('')

    try {
      const response = await fetch('/api/settings/ai-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'ai_prompt_subject_line' })
      })

      if (response.ok) {
        const data = await response.json()
        const msg = data.used_custom_default
          ? 'Prompt reset to your custom default!'
          : 'Prompt reset to original code default!'
        setMessage(msg)
        await loadSubjectLinePrompt()
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to reset prompt')
      }
    } catch (error) {
      setMessage('Error: Failed to reset prompt')
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setSavingSubjectLine(false)
    }
  }

  const handleSaveAsDefaultSubjectLine = async () => {
    if (!confirm('Save this as the default prompt for all new publications?')) {
      return
    }

    setSavingSubjectLine(true)
    setMessage('')

    try {
      const response = await fetch('/api/settings/ai-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'ai_prompt_subject_line',
          action: 'save_as_default'
        })
      })

      if (response.ok) {
        setMessage('Saved as default successfully!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to save as default')
      }
    } catch (error) {
      setMessage('Error: Failed to save as default')
      setTimeout(() => setMessage(''), 5000)
    } finally {
      setSavingSubjectLine(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Email Provider Selection */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Email Service Provider</h3>
        <p className="text-sm text-gray-600 mb-4">
          Choose which email service provider to use for sending newsletters. Configure both providers below to enable easy switching.
        </p>

        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={() => handleChange('emailProvider', 'mailerlite')}
            className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
              settings.emailProvider === 'mailerlite'
                ? 'border-brand-primary bg-brand-primary/10 text-brand-primary font-medium'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
              <span>MailerLite</span>
            </div>
            {settings.emailProvider === 'mailerlite' && (
              <div className="text-xs mt-1 text-brand-primary">Active Provider</div>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleChange('emailProvider', 'sendgrid')}
            className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
              settings.emailProvider === 'sendgrid'
                ? 'border-brand-primary bg-brand-primary/10 text-brand-primary font-medium'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
              <span>SendGrid</span>
            </div>
            {settings.emailProvider === 'sendgrid' && (
              <div className="text-xs mt-1 text-brand-primary">Active Provider</div>
            )}
          </button>
        </div>
      </div>

      {/* Common Email Settings */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Sender Settings</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Email
            </label>
            <input
              type="email"
              value={settings.fromEmail}
              onChange={(e) => handleChange('fromEmail', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sender Name
            </label>
            <input
              type="text"
              value={settings.senderName}
              onChange={(e) => handleChange('senderName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>
        </div>
      </div>

      {/* MailerLite Configuration */}
      <div className={`bg-white shadow rounded-lg p-6 ${settings.emailProvider !== 'mailerlite' ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">MailerLite Configuration</h3>
          {settings.emailProvider === 'mailerlite' && (
            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
              Active
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Review Group ID
            </label>
            <input
              type="text"
              value={settings.mailerliteReviewGroupId}
              onChange={(e) => handleChange('mailerliteReviewGroupId', e.target.value)}
              placeholder="MailerLite group ID for review emails"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Main Group ID
            </label>
            <input
              type="text"
              value={settings.mailerliteMainGroupId}
              onChange={(e) => handleChange('mailerliteMainGroupId', e.target.value)}
              placeholder="MailerLite group ID for main newsletter"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Secondary Group ID
            </label>
            <input
              type="text"
              value={settings.mailerliteSecondaryGroupId}
              onChange={(e) => handleChange('mailerliteSecondaryGroupId', e.target.value)}
              placeholder="MailerLite group ID for secondary sends"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Test Group ID
            </label>
            <input
              type="text"
              value={settings.mailerliteTestGroupId}
              onChange={(e) => handleChange('mailerliteTestGroupId', e.target.value)}
              placeholder="MailerLite group ID for test sends"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>
        </div>
      </div>

      {/* SendGrid Configuration */}
      <div className={`bg-white shadow rounded-lg p-6 ${settings.emailProvider !== 'sendgrid' ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">SendGrid Configuration</h3>
          {settings.emailProvider === 'sendgrid' && (
            <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
              Active
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Review List ID
            </label>
            <input
              type="text"
              value={settings.sendgridReviewListId}
              onChange={(e) => handleChange('sendgridReviewListId', e.target.value)}
              placeholder="SendGrid list ID for review emails"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Main List ID
            </label>
            <input
              type="text"
              value={settings.sendgridMainListId}
              onChange={(e) => handleChange('sendgridMainListId', e.target.value)}
              placeholder="SendGrid list ID for main newsletter"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Secondary List ID
            </label>
            <input
              type="text"
              value={settings.sendgridSecondaryListId}
              onChange={(e) => handleChange('sendgridSecondaryListId', e.target.value)}
              placeholder="SendGrid list ID for secondary sends"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Test List ID
            </label>
            <input
              type="text"
              value={settings.sendgridTestListId}
              onChange={(e) => handleChange('sendgridTestListId', e.target.value)}
              placeholder="SendGrid list ID for test sends"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sender ID
            </label>
            <input
              type="text"
              value={settings.sendgridSenderId}
              onChange={(e) => handleChange('sendgridSenderId', e.target.value)}
              placeholder="SendGrid verified sender ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unsubscribe Group ID
            </label>
            <input
              type="text"
              value={settings.sendgridUnsubscribeGroupId}
              onChange={(e) => handleChange('sendgridUnsubscribeGroupId', e.target.value)}
              placeholder="SendGrid unsubscribe group ID"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
            />
          </div>
        </div>
      </div>

      {/* Automated Publication Review Schedule */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Automated Publication Review Schedule</h3>
          <div className="flex items-center">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.reviewScheduleEnabled}
                onChange={(e) => handleChange('reviewScheduleEnabled', e.target.checked)}
                className="sr-only"
              />
              <div className={`relative w-11 h-6 rounded-full transition-colors ${
                settings.reviewScheduleEnabled ? 'bg-brand-primary' : 'bg-gray-300'
              }`}>
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.reviewScheduleEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}></div>
              </div>
              <span className="ml-3 text-sm font-medium text-gray-700">
                {settings.reviewScheduleEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Configure the automated review workflow times (Central Time Zone).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Issue Processing Time
            </label>
            <div className="flex space-x-2 items-center">
              <select
                value={(() => {
                  const hour24 = parseInt(settings.rssProcessingTime.split(':')[0])
                  return hour24 === 0 ? '12' : hour24 > 12 ? (hour24 - 12).toString() : hour24.toString()
                })()}
                onChange={(e) => {
                  const minutes = settings.rssProcessingTime.split(':')[1] || '00'
                  const hour12 = parseInt(e.target.value)
                  const currentHour24 = parseInt(settings.rssProcessingTime.split(':')[0])
                  const isAM = currentHour24 < 12
                  let hour24
                  if (hour12 === 12) {
                    hour24 = isAM ? 0 : 12
                  } else {
                    hour24 = isAM ? hour12 : hour12 + 12
                  }
                  handleChange('rssProcessingTime', `${hour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.reviewScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const hour = i + 1
                  return (
                    <option key={hour} value={hour.toString()}>
                      {hour}
                    </option>
                  )
                })}
              </select>
              <span>:</span>
              <select
                value={settings.rssProcessingTime.split(':')[1] || '00'}
                onChange={(e) => {
                  const hour24 = parseInt(settings.rssProcessingTime.split(':')[0])
                  handleChange('rssProcessingTime', `${hour24.toString().padStart(2, '0')}:${e.target.value}`)
                }}
                disabled={!settings.reviewScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="00">00</option>
                <option value="05">05</option>
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="20">20</option>
                <option value="25">25</option>
                <option value="30">30</option>
                <option value="35">35</option>
                <option value="40">40</option>
                <option value="45">45</option>
                <option value="50">50</option>
                <option value="55">55</option>
              </select>
              <select
                value={parseInt(settings.rssProcessingTime.split(':')[0]) < 12 ? 'AM' : 'PM'}
                onChange={(e) => {
                  const minutes = settings.rssProcessingTime.split(':')[1] || '00'
                  const currentHour24 = parseInt(settings.rssProcessingTime.split(':')[0])
                  const currentHour12 = currentHour24 === 0 ? 12 : currentHour24 > 12 ? currentHour24 - 12 : currentHour24
                  let newHour24
                  if (e.target.value === 'AM') {
                    newHour24 = currentHour12 === 12 ? 0 : currentHour12
                  } else {
                    newHour24 = currentHour12 === 12 ? 12 : currentHour12 + 12
                  }
                  handleChange('rssProcessingTime', `${newHour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.reviewScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-1">Daily issue creation and processing</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Campaign Creation Time
            </label>
            <div className="flex space-x-2 items-center">
              <select
                value={(() => {
                  const hour24 = parseInt(settings.issueCreationTime.split(':')[0])
                  return hour24 === 0 ? '12' : hour24 > 12 ? (hour24 - 12).toString() : hour24.toString()
                })()}
                onChange={(e) => {
                  const minutes = settings.issueCreationTime.split(':')[1] || '00'
                  const hour12 = parseInt(e.target.value)
                  const currentHour24 = parseInt(settings.issueCreationTime.split(':')[0])
                  const isAM = currentHour24 < 12
                  let hour24
                  if (hour12 === 12) {
                    hour24 = isAM ? 0 : 12
                  } else {
                    hour24 = isAM ? hour12 : hour12 + 12
                  }
                  handleChange('issueCreationTime', `${hour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.reviewScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const hour = i + 1
                  return (
                    <option key={hour} value={hour.toString()}>
                      {hour}
                    </option>
                  )
                })}
              </select>
              <span>:</span>
              <select
                value={settings.issueCreationTime.split(':')[1] || '00'}
                onChange={(e) => {
                  const hour24 = parseInt(settings.issueCreationTime.split(':')[0])
                  handleChange('issueCreationTime', `${hour24.toString().padStart(2, '0')}:${e.target.value}`)
                }}
                disabled={!settings.reviewScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="00">00</option>
                <option value="05">05</option>
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="20">20</option>
                <option value="25">25</option>
                <option value="30">30</option>
                <option value="35">35</option>
                <option value="40">40</option>
                <option value="45">45</option>
                <option value="50">50</option>
                <option value="55">55</option>
              </select>
              <select
                value={parseInt(settings.issueCreationTime.split(':')[0]) < 12 ? 'AM' : 'PM'}
                onChange={(e) => {
                  const minutes = settings.issueCreationTime.split(':')[1] || '00'
                  const currentHour24 = parseInt(settings.issueCreationTime.split(':')[0])
                  const currentHour12 = currentHour24 === 0 ? 12 : currentHour24 > 12 ? currentHour24 - 12 : currentHour24
                  let newHour24
                  if (e.target.value === 'AM') {
                    newHour24 = currentHour12 === 12 ? 0 : currentHour12
                  } else {
                    newHour24 = currentHour12 === 12 ? 12 : currentHour12 + 12
                  }
                  handleChange('issueCreationTime', `${newHour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.reviewScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-1">SendGrid campaign setup and review</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Scheduled Send Time
            </label>
            <div className="flex space-x-2 items-center">
              <select
                value={(() => {
                  const hour24 = parseInt(settings.scheduledSendTime.split(':')[0])
                  return hour24 === 0 ? '12' : hour24 > 12 ? (hour24 - 12).toString() : hour24.toString()
                })()}
                onChange={(e) => {
                  const minutes = settings.scheduledSendTime.split(':')[1] || '00'
                  const hour12 = parseInt(e.target.value)
                  const currentHour24 = parseInt(settings.scheduledSendTime.split(':')[0])
                  const isAM = currentHour24 < 12
                  let hour24
                  if (hour12 === 12) {
                    hour24 = isAM ? 0 : 12
                  } else {
                    hour24 = isAM ? hour12 : hour12 + 12
                  }
                  handleChange('scheduledSendTime', `${hour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.reviewScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const hour = i + 1
                  return (
                    <option key={hour} value={hour.toString()}>
                      {hour}
                    </option>
                  )
                })}
              </select>
              <span>:</span>
              <select
                value={settings.scheduledSendTime.split(':')[1] || '00'}
                onChange={(e) => {
                  const hour24 = parseInt(settings.scheduledSendTime.split(':')[0])
                  handleChange('scheduledSendTime', `${hour24.toString().padStart(2, '0')}:${e.target.value}`)
                }}
                disabled={!settings.reviewScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="00">00</option>
                <option value="05">05</option>
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="20">20</option>
                <option value="25">25</option>
                <option value="30">30</option>
                <option value="35">35</option>
                <option value="40">40</option>
                <option value="45">45</option>
                <option value="50">50</option>
                <option value="55">55</option>
              </select>
              <select
                value={parseInt(settings.scheduledSendTime.split(':')[0]) < 12 ? 'AM' : 'PM'}
                onChange={(e) => {
                  const minutes = settings.scheduledSendTime.split(':')[1] || '00'
                  const currentHour24 = parseInt(settings.scheduledSendTime.split(':')[0])
                  const currentHour12 = currentHour24 === 0 ? 12 : currentHour24 > 12 ? currentHour24 - 12 : currentHour24
                  let newHour24
                  if (e.target.value === 'AM') {
                    newHour24 = currentHour12 === 12 ? 0 : currentHour12
                  } else {
                    newHour24 = currentHour12 === 12 ? 12 : currentHour12 + 12
                  }
                  handleChange('scheduledSendTime', `${newHour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.reviewScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-1">Review newsletter delivery (5-minute increments)</p>
          </div>
        </div>

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Review Workflow Overview</h4>
          <div className="text-sm text-blue-800 space-y-1">
            <div>1. <strong>{settings.rssProcessingTime}</strong> - Create tomorrow&apos;s issue, process RSS feeds, and generate AI subject line</div>
            <div>2. <strong>{settings.issueCreationTime}</strong> - Create review campaign and schedule for delivery</div>
            <div>3. <strong>{settings.scheduledSendTime}</strong> - SendGrid sends review to review list only</div>
          </div>
        </div>
      </div>

      {/* Automated Daily Publication Schedule */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Automated Daily Publication Schedule</h3>
          <div className="flex items-center">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.dailyScheduleEnabled}
                onChange={(e) => handleChange('dailyScheduleEnabled', e.target.checked)}
                className="sr-only"
              />
              <div className={`relative w-11 h-6 rounded-full transition-colors ${
                settings.dailyScheduleEnabled ? 'bg-brand-primary' : 'bg-gray-300'
              }`}>
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.dailyScheduleEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}></div>
              </div>
              <span className="ml-3 text-sm font-medium text-gray-700">
                {settings.dailyScheduleEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Configure the automated daily newsletter delivery times (Central Time Zone).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Campaign Creation Time
            </label>
            <div className="flex space-x-2 items-center">
              <select
                value={(() => {
                  const hour24 = parseInt(settings.dailyissueCreationTime.split(':')[0])
                  return hour24 === 0 ? '12' : hour24 > 12 ? (hour24 - 12).toString() : hour24.toString()
                })()}
                onChange={(e) => {
                  const minutes = settings.dailyissueCreationTime.split(':')[1] || '00'
                  const hour12 = parseInt(e.target.value)
                  const currentHour24 = parseInt(settings.dailyissueCreationTime.split(':')[0])
                  const isAM = currentHour24 < 12
                  let hour24
                  if (hour12 === 12) {
                    hour24 = isAM ? 0 : 12
                  } else {
                    hour24 = isAM ? hour12 : hour12 + 12
                  }
                  handleChange('dailyissueCreationTime', `${hour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.dailyScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const hour = i + 1
                  return (
                    <option key={hour} value={hour.toString()}>
                      {hour}
                    </option>
                  )
                })}
              </select>
              <span>:</span>
              <select
                value={settings.dailyissueCreationTime.split(':')[1] || '00'}
                onChange={(e) => {
                  const hour24 = parseInt(settings.dailyissueCreationTime.split(':')[0])
                  handleChange('dailyissueCreationTime', `${hour24.toString().padStart(2, '0')}:${e.target.value}`)
                }}
                disabled={!settings.dailyScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="00">00</option>
                <option value="05">05</option>
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="20">20</option>
                <option value="25">25</option>
                <option value="30">30</option>
                <option value="35">35</option>
                <option value="40">40</option>
                <option value="45">45</option>
                <option value="50">50</option>
                <option value="55">55</option>
              </select>
              <select
                value={parseInt(settings.dailyissueCreationTime.split(':')[0]) < 12 ? 'AM' : 'PM'}
                onChange={(e) => {
                  const minutes = settings.dailyissueCreationTime.split(':')[1] || '00'
                  const currentHour24 = parseInt(settings.dailyissueCreationTime.split(':')[0])
                  const currentHour12 = currentHour24 === 0 ? 12 : currentHour24 > 12 ? currentHour24 - 12 : currentHour24
                  let newHour24
                  if (e.target.value === 'AM') {
                    newHour24 = currentHour12 === 12 ? 0 : currentHour12
                  } else {
                    newHour24 = currentHour12 === 12 ? 12 : currentHour12 + 12
                  }
                  handleChange('dailyissueCreationTime', `${newHour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.dailyScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-1">Final campaign creation with any review changes</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Scheduled Send Time
            </label>
            <div className="flex space-x-2 items-center">
              <select
                value={(() => {
                  const hour24 = parseInt(settings.dailyScheduledSendTime.split(':')[0])
                  return hour24 === 0 ? '12' : hour24 > 12 ? (hour24 - 12).toString() : hour24.toString()
                })()}
                onChange={(e) => {
                  const minutes = settings.dailyScheduledSendTime.split(':')[1] || '00'
                  const hour12 = parseInt(e.target.value)
                  const currentHour24 = parseInt(settings.dailyScheduledSendTime.split(':')[0])
                  const isAM = currentHour24 < 12
                  let hour24
                  if (hour12 === 12) {
                    hour24 = isAM ? 0 : 12
                  } else {
                    hour24 = isAM ? hour12 : hour12 + 12
                  }
                  handleChange('dailyScheduledSendTime', `${hour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.dailyScheduleEnabled}
                className="w-16 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const hour = i + 1
                  return (
                    <option key={hour} value={hour.toString()}>
                      {hour}
                    </option>
                  )
                })}
              </select>
              <span>:</span>
              <select
                value={settings.dailyScheduledSendTime.split(':')[1] || '00'}
                onChange={(e) => {
                  const hour24 = parseInt(settings.dailyScheduledSendTime.split(':')[0])
                  handleChange('dailyScheduledSendTime', `${hour24.toString().padStart(2, '0')}:${e.target.value}`)
                }}
                disabled={!settings.dailyScheduleEnabled}
                className="w-16 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="00">00</option>
                <option value="05">05</option>
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="20">20</option>
                <option value="25">25</option>
                <option value="30">30</option>
                <option value="35">35</option>
                <option value="40">40</option>
                <option value="45">45</option>
                <option value="50">50</option>
                <option value="55">55</option>
              </select>
              <select
                value={parseInt(settings.dailyScheduledSendTime.split(':')[0]) < 12 ? 'AM' : 'PM'}
                onChange={(e) => {
                  const minutes = settings.dailyScheduledSendTime.split(':')[1] || '00'
                  const currentHour24 = parseInt(settings.dailyScheduledSendTime.split(':')[0])
                  const currentHour12 = currentHour24 === 0 ? 12 : currentHour24 > 12 ? currentHour24 - 12 : currentHour24
                  let newHour24
                  if (e.target.value === 'AM') {
                    newHour24 = currentHour12 === 12 ? 0 : currentHour12
                  } else {
                    newHour24 = currentHour12 === 12 ? 12 : currentHour12 + 12
                  }
                  handleChange('dailyScheduledSendTime', `${newHour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.dailyScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-1">Final publication delivery to main subscriber group (5-minute increments)</p>
          </div>
        </div>

        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="font-medium text-green-900 mb-2">Daily Publication Workflow</h4>
          <div className="text-sm text-green-800 space-y-1">
            <div>1. <strong>{settings.dailyissueCreationTime}</strong> - Create final campaign with any changes made to issue during review</div>
            <div>2. <strong>{settings.dailyScheduledSendTime}</strong> - Send final issue to main subscriber group</div>
          </div>
        </div>
      </div>

      {/* Automated Secondary Publication Schedule */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Automated Secondary Publication Schedule</h3>
          <div className="flex items-center">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.secondaryScheduleEnabled}
                onChange={(e) => handleChange('secondaryScheduleEnabled', e.target.checked)}
                className="sr-only"
              />
              <div className={`relative w-11 h-6 rounded-full transition-colors ${
                settings.secondaryScheduleEnabled ? 'bg-brand-primary' : 'bg-gray-300'
              }`}>
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.secondaryScheduleEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}></div>
              </div>
              <span className="ml-3 text-sm font-medium text-gray-700">
                {settings.secondaryScheduleEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </label>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Configure secondary newsletter delivery to a different subscriber group on selected days (Central Time Zone).
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Campaign Creation Time
            </label>
            <div className="flex space-x-2 items-center">
              <select
                value={(() => {
                  const hour24 = parseInt(settings.secondaryissueCreationTime.split(':')[0])
                  return hour24 === 0 ? '12' : hour24 > 12 ? (hour24 - 12).toString() : hour24.toString()
                })()}
                onChange={(e) => {
                  const minutes = settings.secondaryissueCreationTime.split(':')[1] || '00'
                  const hour12 = parseInt(e.target.value)
                  const currentHour24 = parseInt(settings.secondaryissueCreationTime.split(':')[0])
                  const isAM = currentHour24 < 12
                  let hour24
                  if (hour12 === 12) {
                    hour24 = isAM ? 0 : 12
                  } else {
                    hour24 = isAM ? hour12 : hour12 + 12
                  }
                  handleChange('secondaryissueCreationTime', `${hour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.secondaryScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const hour = i + 1
                  return (
                    <option key={hour} value={hour.toString()}>
                      {hour}
                    </option>
                  )
                })}
              </select>
              <span>:</span>
              <select
                value={settings.secondaryissueCreationTime.split(':')[1] || '00'}
                onChange={(e) => {
                  const hour24 = parseInt(settings.secondaryissueCreationTime.split(':')[0])
                  handleChange('secondaryissueCreationTime', `${hour24.toString().padStart(2, '0')}:${e.target.value}`)
                }}
                disabled={!settings.secondaryScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="00">00</option>
                <option value="05">05</option>
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="20">20</option>
                <option value="25">25</option>
                <option value="30">30</option>
                <option value="35">35</option>
                <option value="40">40</option>
                <option value="45">45</option>
                <option value="50">50</option>
                <option value="55">55</option>
              </select>
              <select
                value={parseInt(settings.secondaryissueCreationTime.split(':')[0]) < 12 ? 'AM' : 'PM'}
                onChange={(e) => {
                  const minutes = settings.secondaryissueCreationTime.split(':')[1] || '00'
                  const currentHour24 = parseInt(settings.secondaryissueCreationTime.split(':')[0])
                  const currentHour12 = currentHour24 === 0 ? 12 : currentHour24 > 12 ? currentHour24 - 12 : currentHour24
                  let newHour24
                  if (e.target.value === 'AM') {
                    newHour24 = currentHour12 === 12 ? 0 : currentHour12
                  } else {
                    newHour24 = currentHour12 === 12 ? 12 : currentHour12 + 12
                  }
                  handleChange('secondaryissueCreationTime', `${newHour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.secondaryScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-1">Secondary campaign creation with existing issue content</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Scheduled Send Time
            </label>
            <div className="flex space-x-2 items-center">
              <select
                value={(() => {
                  const hour24 = parseInt(settings.secondaryScheduledSendTime.split(':')[0])
                  return hour24 === 0 ? '12' : hour24 > 12 ? (hour24 - 12).toString() : hour24.toString()
                })()}
                onChange={(e) => {
                  const minutes = settings.secondaryScheduledSendTime.split(':')[1] || '00'
                  const hour12 = parseInt(e.target.value)
                  const currentHour24 = parseInt(settings.secondaryScheduledSendTime.split(':')[0])
                  const isAM = currentHour24 < 12
                  let hour24
                  if (hour12 === 12) {
                    hour24 = isAM ? 0 : 12
                  } else {
                    hour24 = isAM ? hour12 : hour12 + 12
                  }
                  handleChange('secondaryScheduledSendTime', `${hour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.secondaryScheduleEnabled}
                className="w-16 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const hour = i + 1
                  return (
                    <option key={hour} value={hour.toString()}>
                      {hour}
                    </option>
                  )
                })}
              </select>
              <span>:</span>
              <select
                value={settings.secondaryScheduledSendTime.split(':')[1] || '00'}
                onChange={(e) => {
                  const hour24 = parseInt(settings.secondaryScheduledSendTime.split(':')[0])
                  handleChange('secondaryScheduledSendTime', `${hour24.toString().padStart(2, '0')}:${e.target.value}`)
                }}
                disabled={!settings.secondaryScheduleEnabled}
                className="w-16 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="00">00</option>
                <option value="05">05</option>
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="20">20</option>
                <option value="25">25</option>
                <option value="30">30</option>
                <option value="35">35</option>
                <option value="40">40</option>
                <option value="45">45</option>
                <option value="50">50</option>
                <option value="55">55</option>
              </select>
              <select
                value={parseInt(settings.secondaryScheduledSendTime.split(':')[0]) < 12 ? 'AM' : 'PM'}
                onChange={(e) => {
                  const minutes = settings.secondaryScheduledSendTime.split(':')[1] || '00'
                  const currentHour24 = parseInt(settings.secondaryScheduledSendTime.split(':')[0])
                  const currentHour12 = currentHour24 === 0 ? 12 : currentHour24 > 12 ? currentHour24 - 12 : currentHour24
                  let newHour24
                  if (e.target.value === 'AM') {
                    newHour24 = currentHour12 === 12 ? 0 : currentHour12
                  } else {
                    newHour24 = currentHour12 === 12 ? 12 : currentHour12 + 12
                  }
                  handleChange('secondaryScheduledSendTime', `${newHour24.toString().padStart(2, '0')}:${minutes}`)
                }}
                disabled={!settings.secondaryScheduleEnabled}
                className="w-20 px-2 py-2 pr-8 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-gray-100 appearance-none bg-white"
                style={{backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: "right 0.5rem center", backgroundRepeat: "no-repeat", backgroundSize: "1.5em 1.5em"}}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-1">Delivery to secondary subscriber group (5-minute increments)</p>
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Send Days
          </label>
          <div className="grid grid-cols-7 gap-2">
            {[
              { day: 0, label: 'Sun' },
              { day: 1, label: 'Mon' },
              { day: 2, label: 'Tue' },
              { day: 3, label: 'Wed' },
              { day: 4, label: 'Thu' },
              { day: 5, label: 'Fri' },
              { day: 6, label: 'Sat' }
            ].map(({ day, label }) => (
              <label
                key={day}
                className={`flex items-center justify-center p-3 border rounded-md cursor-pointer transition-colors ${
                  settings.secondarySendDays.includes(day)
                    ? 'bg-brand-primary border-brand-primary text-white'
                    : 'bg-white border-gray-300 text-gray-700 hover:border-brand-primary'
                } ${!settings.secondaryScheduleEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={settings.secondarySendDays.includes(day)}
                  onChange={(e) => {
                    const days = settings.secondarySendDays
                    if (e.target.checked) {
                      handleChange('secondarySendDays', [...days, day].sort())
                    } else {
                      handleChange('secondarySendDays', days.filter(d => d !== day))
                    }
                  }}
                  disabled={!settings.secondaryScheduleEnabled}
                  className="sr-only"
                />
                <span className="text-sm font-medium">{label}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">Select the days when the secondary newsletter should be sent</p>
        </div>

        <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h4 className="font-medium text-purple-900 mb-2">Secondary Publication Workflow</h4>
          <div className="text-sm text-purple-800 space-y-1">
            <div>1. <strong>{settings.secondaryissueCreationTime}</strong> - Create campaign using existing issue content</div>
            <div>2. <strong>{settings.secondaryScheduledSendTime}</strong> - Send to secondary subscriber group (on selected days only)</div>
          </div>
        </div>
      </div>

      {/* Save Email & Schedule Settings Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-brand-primary hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-md font-medium"
        >
          {saving ? 'Saving...' : 'Save Email & Schedule Settings'}
        </button>
      </div>

      {message && (
        <div className={`mt-4 p-4 rounded-md ${
          message.includes('successfully')
            ? 'bg-green-50 border border-green-200 text-green-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {message}
        </div>
      )}

      {/* Deduplication Settings */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Deduplication Settings</h3>
        <p className="text-sm text-gray-600 mb-4">
          Configure how the system detects and prevents duplicate articles from appearing in your newsletters. The system uses a 4-stage detection process: historical checking, exact content matching, title similarity, and AI semantic analysis.
        </p>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="font-medium text-gray-700 w-56">Historical Lookback Days:</label>
            <input
              type="number"
              min="1"
              max="14"
              value={dedupLookbackDays}
              onChange={(e) => setDedupLookbackDays(parseInt(e.target.value) || 1)}
              className="w-24 px-3 py-2 border border-gray-300 rounded-md"
              disabled={savingDedupSettings}
            />
            <span className="text-sm text-gray-500">(1-14 days)</span>
          </div>

          <div className="flex items-center gap-4">
            <label className="font-medium text-gray-700 w-56">Strictness Threshold:</label>
            <input
              type="number"
              min="0.5"
              max="1.0"
              step="0.05"
              value={dedupStrictnessThreshold}
              onChange={(e) => setDedupStrictnessThreshold(parseFloat(e.target.value) || 0.8)}
              className="w-24 px-3 py-2 border border-gray-300 rounded-md"
              disabled={savingDedupSettings}
            />
            <span className="text-sm text-gray-500">(0.5-1.0, lower = stricter)</span>
          </div>

          <button
            onClick={saveDedupSettings}
            disabled={savingDedupSettings}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-blue-300"
          >
            {savingDedupSettings ? 'Saving...' : 'Save Deduplication Settings'}
          </button>
        </div>

        <div className="mt-4 bg-blue-50 p-4 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Current configuration:</strong> Checking {dedupLookbackDays} days of past newsletters with {Math.round(dedupStrictnessThreshold * 100)}% similarity threshold
          </p>
          <p className="text-xs text-blue-700 mt-2">
            <strong>How it works:</strong> Stage 1 checks against articles used in the last {dedupLookbackDays} sent newsletters. Stages 2-4 check exact content matches (100% similarity), title similarity (&gt;{Math.round(dedupStrictnessThreshold * 100)}%), and AI semantic analysis (&gt;{Math.round(dedupStrictnessThreshold * 100)}%) within the current issue&apos;s articles.
          </p>
        </div>
      </div>

      {/* Subject Line AI Prompt */}
      <div className="bg-white shadow rounded-lg">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-medium text-gray-900">Subject Line Generator</h3>
                {subjectLinePromptOriginal && (
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                    detectProviderFromPrompt(editingSubjectLine ? subjectLinePrompt : subjectLinePromptOriginal) === 'claude'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {detectProviderFromPrompt(editingSubjectLine ? subjectLinePrompt : subjectLinePromptOriginal) === 'claude' ? 'Claude' : 'OpenAI'}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Configure the AI prompt used to generate engaging subject lines for your newsletters.
              </p>
            </div>
            <button
              onClick={() => setExpandedSubjectLine(!expandedSubjectLine)}
              className="ml-4 text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              {expandedSubjectLine ? 'Collapse' : 'View/Edit'}
            </button>
          </div>
        </div>

        {expandedSubjectLine && (
          <div className="p-6">
            {!subjectLinePromptOriginal ? (
              <div className="text-gray-500 italic">Loading prompt...</div>
            ) : (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">
                    Prompt Content
                  </label>
                  <span className="text-xs text-gray-500">
                    {editingSubjectLine
                      ? subjectLinePrompt.length
                      : subjectLinePromptOriginal.length} characters
                  </span>
                </div>

                {editingSubjectLine ? (
              <>
                <textarea
                  value={subjectLinePrompt}
                  onChange={(e) => setSubjectLinePrompt(e.target.value)}
                  rows={15}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="mt-2 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                  <span className="font-medium">Expected Response:</span>{' '}
                  <code className="bg-amber-100 px-1 rounded">Plain text (max 40 characters)</code>
                </p>
                <div className="mt-3 flex items-center justify-end">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleCancelSubjectLine}
                      disabled={savingSubjectLine}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveSubjectLinePrompt}
                      disabled={savingSubjectLine}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingSubjectLine ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="mb-2 flex items-center">
                  <label className="flex items-center text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prettyPrintSubjectLine}
                      onChange={(e) => setPrettyPrintSubjectLine(e.target.checked)}
                      className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    Pretty-print
                  </label>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-md p-4 font-mono text-xs whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                  {formatJSONForDisplay(subjectLinePromptOriginal, prettyPrintSubjectLine)}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleResetSubjectLine}
                      disabled={savingSubjectLine}
                      className="px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                    >
                      {savingSubjectLine ? 'Resetting...' : 'Reset to Default'}
                    </button>
                    <button
                      onClick={handleSaveAsDefaultSubjectLine}
                      disabled={savingSubjectLine}
                      className="px-4 py-2 text-sm font-medium text-green-700 bg-white border border-green-300 rounded-md hover:bg-green-50 disabled:opacity-50"
                    >
                      {savingSubjectLine ? 'Saving...' : 'Save as Default'}
                    </button>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleEditSubjectLine}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                      Edit Prompt
                    </button>
                  </div>
                </div>
              </>
            )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Testing Playground Button */}
      {newsletterSlug && (
        <div className="flex justify-center">
          <Link
            href={`/dashboard/${newsletterSlug}/settings/AIPromptTesting`}
            className="px-6 py-3 text-base font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors duration-200 shadow-md hover:shadow-lg"
          >
            AI Testing Playground
          </Link>
        </div>
      )}
    </div>
  )
}
