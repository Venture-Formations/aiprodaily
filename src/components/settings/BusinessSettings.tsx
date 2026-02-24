'use client'

import { useState, useEffect } from 'react'

export default function BusinessSettings() {
  const [settings, setSettings] = useState({
    newsletter_name: '',
    business_name: '',
    subject_line_emoji: '🧮',
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
    instagram_url: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingHeader, setUploadingHeader] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingWebsiteHeader, setUploadingWebsiteHeader] = useState(false)
  const [message, setMessage] = useState('')

  const fontOptions = [
    'Arial, sans-serif',
    'Helvetica',
    'Georgia',
    'Times New Roman',
    'Verdana',
    'Trebuchet MS',
    'Courier New',
    'Tahoma'
  ]

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings/business')
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
      const response = await fetch('/api/settings/business', {
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
      // Create FormData with file and type
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)

      // Upload to server
      const uploadResponse = await fetch('/api/settings/upload-business-image', {
        method: 'POST',
        body: formData
      })

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json()
        throw new Error(error.error || 'Upload failed')
      }

      const data = await uploadResponse.json()

      // Update settings with new URL
      const fieldName = type === 'header' ? 'header_image_url' : type === 'logo' ? 'logo_url' : 'website_header_url'
      setSettings(prev => ({ ...prev, [fieldName]: data.url }))
      setMessage(data.message || `${type === 'header' ? 'Header' : type === 'logo' ? 'Logo' : 'Website Header'} image uploaded successfully!`)
      // Auto-save the settings with the new image URL
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

  if (loading) {
    return <div className="text-center py-8">Loading business settings...</div>
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Business Information</h3>

        {message && (
          <div className={`mb-4 p-3 rounded ${message.includes('Error') ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'}`}>
            {message}
          </div>
        )}

        <div className="space-y-4">
          {/* Newsletter Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Publication Name
            </label>
            <input
              type="text"
              value={settings.newsletter_name}
              onChange={(e) => setSettings({ ...settings, newsletter_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., AI Accounting Daily"
            />
          </div>

          {/* Business Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business Name
            </label>
            <input
              type="text"
              value={settings.business_name}
              onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., AI Pros Inc."
            />
          </div>

          {/* Subject Line Emoji */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject Line Emoji
            </label>
            <input
              type="text"
              value={settings.subject_line_emoji}
              onChange={(e) => setSettings({ ...settings, subject_line_emoji: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., 🧮"
              maxLength={2}
            />
            <p className="mt-1 text-sm text-gray-500">
              This emoji will appear at the beginning of all email subject lines
            </p>
          </div>

          {/* Contact Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact Email
            </label>
            <input
              type="email"
              value={settings.contact_email}
              onChange={(e) => setSettings({ ...settings, contact_email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., contact@aiaccountingdaily.com"
            />
          </div>

          {/* Website URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Website URL
            </label>
            <input
              type="url"
              value={settings.website_url}
              onChange={(e) => setSettings({ ...settings, website_url: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., https://aiaccountingdaily.com"
            />
          </div>

        </div>
      </div>

      {/* Colors */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Brand Colors</h3>
        <div className="grid grid-cols-2 gap-4">
          {/* Primary Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Primary Color (Header/Footer Background)
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={settings.primary_color}
                onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={settings.primary_color}
                onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="#3B82F6"
              />
            </div>
          </div>

          {/* Secondary Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Secondary Color (Buttons/Links)
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={settings.secondary_color}
                onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })}
                className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={settings.secondary_color}
                onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="#10B981"
              />
            </div>
          </div>

          {/* Tertiary Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tertiary Color (Accents)
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={settings.tertiary_color}
                onChange={(e) => setSettings({ ...settings, tertiary_color: e.target.value })}
                className="h-10 w-20 border border-gray-300 rounded cursor-pointer"
              />
              <input
                type="text"
                value={settings.tertiary_color}
                onChange={(e) => setSettings({ ...settings, tertiary_color: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="#F59E0B"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Fonts */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Typography</h3>
        <div className="grid grid-cols-2 gap-4">
          {/* Heading Font */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Heading Font
            </label>
            <select
              value={settings.heading_font}
              onChange={(e) => setSettings({ ...settings, heading_font: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              {fontOptions.map(font => (
                <option key={font} value={font}>{font}</option>
              ))}
            </select>
            <p className="mt-2 text-sm text-gray-600" style={{ fontFamily: settings.heading_font }}>
              This is how your headings will look in the newsletter.
            </p>
          </div>

          {/* Body Font */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Body Font
            </label>
            <select
              value={settings.body_font}
              onChange={(e) => setSettings({ ...settings, body_font: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              {fontOptions.map(font => (
                <option key={font} value={font}>{font}</option>
              ))}
            </select>
            <p className="mt-2 text-sm text-gray-600" style={{ fontFamily: settings.body_font }}>
              This is how your body text will appear in the newsletter.
            </p>
          </div>
        </div>
      </div>

      {/* Images */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Images</h3>

        {/* Header Image */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Header Image
          </label>
          {settings.header_image_url && (
            <div
              className="mb-2 p-4 rounded border"
              style={{ backgroundColor: settings.primary_color }}
            >
              <img
                src={settings.header_image_url}
                alt="Header preview"
                className="max-w-md h-32 object-contain mx-auto"
              />
            </div>
          )}
          <div className="flex items-center space-x-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImageUpload(file, 'header')
              }}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              disabled={uploadingHeader}
            />
            {uploadingHeader && <span className="text-sm text-gray-500">Uploading...</span>}
          </div>
        </div>

        {/* Logo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Logo (Square Image)
          </label>
          {settings.logo_url && (
            <div className="mb-2">
              <img
                src={settings.logo_url}
                alt="Logo preview"
                className="w-16 h-16 object-cover rounded border"
              />
            </div>
          )}
          <div className="flex items-center space-x-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImageUpload(file, 'logo')
              }}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              disabled={uploadingLogo}
            />
            {uploadingLogo && <span className="text-sm text-gray-500">Uploading...</span>}
          </div>
        </div>

        {/* Website Header Image */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Website Header Image
          </label>
          <p className="text-xs text-gray-500 mb-2">This image appears in the website header navigation.</p>
          {settings.website_header_url && (
            <div className="mb-2 p-4 rounded border">
              <img
                src={settings.website_header_url}
                alt="Website header preview"
                className="max-w-md h-32 object-contain mx-auto"
              />
            </div>
          )}
          <div className="flex items-center space-x-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImageUpload(file, 'website_header')
              }}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              disabled={uploadingWebsiteHeader}
            />
            {uploadingWebsiteHeader && <span className="text-sm text-gray-500">Uploading...</span>}
          </div>
        </div>
      </div>
      {/* Social Media */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Social Media Links</h3>
        <p className="text-sm text-gray-600 mb-4">Enable individual social media links to display in the newsletter footer.</p>

        <div className="space-y-4">
          {/* Facebook */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Facebook
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.facebook_enabled}
                  onChange={(e) => setSettings({ ...settings, facebook_enabled: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Enable</span>
              </label>
            </div>
            <input
              type="url"
              value={settings.facebook_url}
              onChange={(e) => setSettings({ ...settings, facebook_url: e.target.value })}
              disabled={!settings.facebook_enabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              placeholder="https://facebook.com/yourpage"
            />
          </div>

          {/* Twitter */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Twitter/X
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.twitter_enabled}
                  onChange={(e) => setSettings({ ...settings, twitter_enabled: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Enable</span>
              </label>
            </div>
            <input
              type="url"
              value={settings.twitter_url}
              onChange={(e) => setSettings({ ...settings, twitter_url: e.target.value })}
              disabled={!settings.twitter_enabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              placeholder="https://twitter.com/yourhandle"
            />
          </div>

          {/* LinkedIn */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                LinkedIn
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.linkedin_enabled}
                  onChange={(e) => setSettings({ ...settings, linkedin_enabled: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Enable</span>
              </label>
            </div>
            <input
              type="url"
              value={settings.linkedin_url}
              onChange={(e) => setSettings({ ...settings, linkedin_url: e.target.value })}
              disabled={!settings.linkedin_enabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              placeholder="https://linkedin.com/company/yourcompany"
            />
          </div>

          {/* Instagram */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Instagram
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.instagram_enabled}
                  onChange={(e) => setSettings({ ...settings, instagram_enabled: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Enable</span>
              </label>
            </div>
            <input
              type="url"
              value={settings.instagram_url}
              onChange={(e) => setSettings({ ...settings, instagram_url: e.target.value })}
              disabled={!settings.instagram_enabled}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              placeholder="https://instagram.com/yourhandle"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-md font-medium"
        >
          {saving ? 'Saving...' : 'Save Publication Settings'}
        </button>
      </div>
    </div>
  )
}
