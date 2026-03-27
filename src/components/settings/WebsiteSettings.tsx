'use client'

import { useState, useEffect } from 'react'

export default function WebsiteSettings({ publicationId }: { publicationId: string }) {
  const [settings, setSettings] = useState({
    website_callout_text: '',
    website_heading: '',
    website_subheading: '',
    tools_directory_enabled: true,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadSettings()
  }, [publicationId])

  const loadSettings = async () => {
    try {
      const response = await fetch(`/api/settings/website?publication_id=${publicationId}`)
      if (response.ok) {
        const data = await response.json()
        setSettings(prev => ({ ...prev, ...data }))
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

  if (loading) {
    return <div className="text-gray-500">Loading website settings...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Website Settings</h2>
        <p className="text-sm text-gray-500 mt-1">Control the text and features shown on your public website.</p>
      </div>

      {message && (
        <div className={`p-3 rounded text-sm ${message.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}

      {/* Home Page Hero Section */}
      <div className="border rounded-lg p-4 space-y-4">
        <h3 className="font-medium text-gray-900">Home Page Hero</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Callout Text
          </label>
          <input
            type="text"
            value={settings.website_callout_text}
            onChange={(e) => setSettings(prev => ({ ...prev, website_callout_text: e.target.value }))}
            placeholder="Join 10,000+ accounting professionals"
            className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">The dark pill badge at the top of the home page.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Heading
          </label>
          <input
            type="text"
            value={settings.website_heading}
            onChange={(e) => setSettings(prev => ({ ...prev, website_heading: e.target.value }))}
            placeholder="Stay Ahead of **AI Trends** in Accounting and Finance"
            className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Wrap text in **double asterisks** to apply the gradient underline style. Example: Stay Ahead of **AI Trends** in Accounting</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subheading
          </label>
          <textarea
            value={settings.website_subheading}
            onChange={(e) => setSettings(prev => ({ ...prev, website_subheading: e.target.value }))}
            placeholder="Daily insights, tools, and strategies to help accountants and finance professionals leverage AI for better outcomes."
            rows={3}
            className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">The description text below the heading.</p>
        </div>
      </div>

      {/* Navigation Features */}
      <div className="border rounded-lg p-4 space-y-4">
        <h3 className="font-medium text-gray-900">Navigation</h3>

        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">AI Tools Directory</label>
            <p className="text-xs text-gray-400">Show the AI Tools link in website navigation.</p>
          </div>
          <button
            type="button"
            onClick={() => setSettings(prev => ({ ...prev, tools_directory_enabled: !prev.tools_directory_enabled }))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.tools_directory_enabled ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.tools_directory_enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Website Settings'}
        </button>
      </div>
    </div>
  )
}
