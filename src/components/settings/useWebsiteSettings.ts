'use client'

import { useState, useEffect } from 'react'

const DEFAULT_JOB_OPTIONS = [
  { value: 'partner_owner', label: 'Partner/Owner' },
  { value: 'cfo', label: 'CFO' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'bookkeeper', label: 'Bookkeeper' },
  { value: 'other', label: 'Other' },
]

const DEFAULT_CLIENTS_OPTIONS = [
  { value: '1', label: "1 (just my employer's or my own company)" },
  { value: '2-20', label: '2-20' },
  { value: '21-100', label: '21-100' },
  { value: '101-299', label: '101-299' },
  { value: '300+', label: '300+' },
]

export interface WebsiteSettingsState {
  website_callout_text: string
  website_heading: string
  website_subheading: string
  tools_directory_enabled: boolean
  subscribe_heading: string
  subscribe_subheading: string
  subscribe_tagline: string
  subscribe_info_heading: string
  subscribe_info_subheading: string
  subscribe_info_job_label: string
  subscribe_info_job_options: { value: string; label: string }[]
  subscribe_info_clients_label: string
  subscribe_info_clients_options: { value: string; label: string }[]
  subscribe_info_submit_text: string
}

export function useWebsiteSettings(publicationId: string) {
  const [settings, setSettings] = useState<WebsiteSettingsState>({
    website_callout_text: '',
    website_heading: '',
    website_subheading: '',
    tools_directory_enabled: true,
    subscribe_heading: '',
    subscribe_subheading: '',
    subscribe_tagline: '',
    subscribe_info_heading: '',
    subscribe_info_subheading: '',
    subscribe_info_job_label: '',
    subscribe_info_job_options: DEFAULT_JOB_OPTIONS,
    subscribe_info_clients_label: '',
    subscribe_info_clients_options: DEFAULT_CLIENTS_OPTIONS,
    subscribe_info_submit_text: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [websiteBaseUrl, setWebsiteBaseUrl] = useState('')

  useEffect(() => {
    loadSettings()
  }, [publicationId])

  const loadSettings = async () => {
    try {
      const [settingsRes, pubRes] = await Promise.all([
        fetch(`/api/settings/website?publication_id=${publicationId}`),
        fetch(`/api/newsletters`),
      ])
      if (settingsRes.ok) {
        const data = await settingsRes.json()
        setSettings(prev => ({ ...prev, ...data }))
      }
      if (pubRes.ok) {
        const pubData = await pubRes.json()
        const pub = (pubData.newsletters || []).find((n: { id: string }) => n.id === publicationId)
        const domain = pub?.website_domain
        if (domain) {
          const isStaging = window.location.hostname.includes('staging')
          setWebsiteBaseUrl(isStaging ? '' : `https://${domain}`)
        }
      }
    } catch (error) {
      console.error('Failed to load website settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')

    try {
      const response = await fetch(`/api/settings/website?publication_id=${publicationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      if (response.ok) {
        setMessage('Website settings saved successfully!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        const error = await response.json()
        setMessage(`Error: ${error.error || 'Failed to save'}`)
      }
    } catch (error) {
      setMessage('Error saving website settings')
    } finally {
      setSaving(false)
    }
  }

  return {
    settings,
    setSettings,
    loading,
    saving,
    message,
    websiteBaseUrl,
    handleSave,
  }
}
