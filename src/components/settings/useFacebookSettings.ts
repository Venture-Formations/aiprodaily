'use client'

import { useState, useEffect } from 'react'

interface FacebookSettingsState {
  enabled: boolean
  pageId: string
  accessToken: string
  postTime: string
  adModuleId: string
}

interface TokenStatus {
  valid: boolean
  expiresAt?: string
  pageName?: string
}

export function useFacebookSettings(publicationId: string) {
  const [settings, setSettings] = useState<FacebookSettingsState>({
    enabled: false,
    pageId: '',
    accessToken: '',
    postTime: '10:00',
    adModuleId: '',
  })
  const [adModules, setAdModules] = useState<Array<{ id: string; name: string }>>([])
  const [hasAccessToken, setHasAccessToken] = useState(false)
  const [lastPostDate, setLastPostDate] = useState('')
  const [lastPostId, setLastPostId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [verifying, setVerifying] = useState(false)
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [publicationId])

  const loadSettings = async () => {
    try {
      const response = await fetch(`/api/settings/facebook?publication_id=${publicationId}`)
      if (response.ok) {
        const data = await response.json()
        setSettings({
          enabled: data.enabled || false,
          pageId: data.pageId || '',
          accessToken: '', // Never pre-fill token for security
          postTime: data.postTime || '10:00',
          adModuleId: data.adModuleId || '',
        })
        setHasAccessToken(data.hasAccessToken || false)
        setAdModules(data.adModules || [])
        setLastPostDate(data.lastPostDate || '')
        setLastPostId(data.lastPostId || '')
      }
    } catch (error) {
      console.error('Failed to load Facebook settings:', error)
      showMessage('Failed to load settings', 'error')
    } finally {
      setLoading(false)
    }
  }

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage(text)
    setMessageType(type)
    setTimeout(() => setMessage(''), 5000)
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')

    try {
      const response = await fetch(`/api/settings/facebook?publication_id=${publicationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (response.ok) {
        showMessage('Facebook settings saved successfully!', 'success')
        await loadSettings()
      } else {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save settings')
      }
    } catch (error) {
      console.error('Failed to save Facebook settings:', error)
      showMessage(error instanceof Error ? error.message : 'Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleVerifyToken = async () => {
    setVerifying(true)
    setTokenStatus(null)

    try {
      const response = await fetch(`/api/settings/facebook?publication_id=${publicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify' }),
      })

      const data = await response.json()
      setTokenStatus({
        valid: data.valid,
        expiresAt: data.expiresAt,
        pageName: data.pageName,
      })

      if (!data.valid) {
        showMessage(data.error || 'Token verification failed', 'error')
      }
    } catch (error) {
      console.error('Failed to verify token:', error)
      showMessage('Failed to verify token', 'error')
    } finally {
      setVerifying(false)
    }
  }

  const handleTestPost = async () => {
    setTesting(true)

    try {
      const response = await fetch(`/api/settings/facebook?publication_id=${publicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test' }),
      })

      const data = await response.json()
      if (data.success) {
        showMessage(`Test post created! Post ID: ${data.postId}`, 'success')
      } else {
        showMessage(data.error || 'Test post failed', 'error')
      }
    } catch (error) {
      console.error('Failed to send test post:', error)
      showMessage('Failed to send test post', 'error')
    } finally {
      setTesting(false)
    }
  }

  const handleTestAdPost = async () => {
    setTesting(true)

    try {
      const response = await fetch(`/api/settings/facebook?publication_id=${publicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test-ad' }),
      })

      const data = await response.json()
      if (data.success) {
        showMessage(`Test ad post created! Ad: "${data.adTitle}"`, 'success')
      } else {
        showMessage(data.error || 'Test ad post failed', 'error')
      }
    } catch (error) {
      console.error('Failed to send test ad post:', error)
      showMessage('Failed to send test ad post', 'error')
    } finally {
      setTesting(false)
    }
  }

  return {
    settings,
    setSettings,
    adModules,
    hasAccessToken,
    lastPostDate,
    lastPostId,
    loading,
    saving,
    message,
    messageType,
    verifying,
    tokenStatus,
    testing,
    handleSave,
    handleVerifyToken,
    handleTestPost,
    handleTestAdPost,
  }
}

export function generateTimeOptions() {
  const options: { value: string; label: string }[] = []
  for (let hour = 0; hour < 24; hour++) {
    for (const minute of [0, 30]) {
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      const displayTime = new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
      options.push({ value: time, label: displayTime })
    }
  }
  return options
}
