'use client'

import { useState, useEffect } from 'react'

export interface BusinessSettingsState {
  newsletter_name: string
  business_name: string
  subject_line_emoji: string
  primary_color: string
  secondary_color: string
  tertiary_color: string
  header_image_url: string
  website_header_url: string
  logo_url: string
  contact_email: string
  website_url: string
  heading_font: string
  body_font: string
  facebook_enabled: boolean
  facebook_url: string
  twitter_enabled: boolean
  twitter_url: string
  linkedin_enabled: boolean
  linkedin_url: string
  instagram_enabled: boolean
  instagram_url: string
}

const defaultSettings: BusinessSettingsState = {
  newsletter_name: '',
  business_name: '',
  subject_line_emoji: '',
  primary_color: '#3B82F6',
  secondary_color: '#10B981',
  tertiary_color: '#F59E0B',
  header_image_url: '',
  website_header_url: '',
  logo_url: '',
  contact_email: '',
  website_url: '',
  heading_font: 'Arial, sans-serif',
  body_font: 'Arial, sans-serif',
  facebook_enabled: false,
  facebook_url: '',
  twitter_enabled: false,
  twitter_url: '',
  linkedin_enabled: false,
  linkedin_url: '',
  instagram_enabled: false,
  instagram_url: '',
}

export const fontOptions = [
  'Arial, sans-serif',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Verdana',
  'Trebuchet MS',
  'Courier New',
  'Tahoma'
]

export function useBusinessSettings(publicationId: string) {
  const [settings, setSettings] = useState<BusinessSettingsState>(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingHeader, setUploadingHeader] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingWebsiteHeader, setUploadingWebsiteHeader] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadSettings()
  }, [publicationId])

  const loadSettings = async () => {
    try {
      const response = await fetch(`/api/settings/business?publication_id=${publicationId}`)
      if (response.ok) {
        const data = await response.json()
        setSettings(prev => ({ ...prev, ...data }))
      }
    } catch (error) {
      console.error('Failed to load business settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')

    try {
      const response = await fetch(`/api/settings/business?publication_id=${publicationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      if (response.ok) {
        setMessage('Business settings saved successfully!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        const error = await response.json()
        setMessage(`Error: ${error.message || 'Failed to save settings'}`)
      }
    } catch (error) {
      setMessage('Error: Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleImageUpload = async (file: File, type: 'header' | 'logo' | 'website_header') => {
    const setUploading = type === 'header' ? setUploadingHeader : type === 'logo' ? setUploadingLogo : setUploadingWebsiteHeader
    setMessage('')

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)
      formData.append('publication_id', publicationId)

      const uploadResponse = await fetch('/api/settings/upload-business-image', {
        method: 'POST',
        body: formData
      })

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json()
        throw new Error(error.error || 'Upload failed')
      }

      const data = await uploadResponse.json()

      const fieldName = type === 'header' ? 'header_image_url' : type === 'logo' ? 'logo_url' : 'website_header_url'
      setSettings(prev => ({ ...prev, [fieldName]: data.url }))
      setMessage(data.message || `${type === 'header' ? 'Header' : type === 'logo' ? 'Logo' : 'Website Header'} image uploaded successfully!`)
      setTimeout(async () => {
        await handleSave()
      }, 500)

    } catch (error) {
      console.error('Upload error:', error)
      setMessage(`Error: ${error instanceof Error ? error.message : 'Failed to upload image'}`)
    } finally {
      setUploading(false)
    }
  }

  const updateSetting = <K extends keyof BusinessSettingsState>(key: K, value: BusinessSettingsState[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  return {
    settings,
    updateSetting,
    setSettings,
    loading,
    saving,
    uploadingHeader,
    uploadingLogo,
    uploadingWebsiteHeader,
    message,
    handleSave,
    handleImageUpload,
  }
}
