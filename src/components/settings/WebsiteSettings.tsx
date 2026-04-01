'use client'

import { useState, useEffect } from 'react'

export default function WebsiteSettings({ publicationId }: { publicationId: string }) {
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

  const [settings, setSettings] = useState({
    website_callout_text: '',
    website_heading: '',
    website_subheading: '',
    tools_directory_enabled: true,
    // Subscribe page
    subscribe_heading: '',
    subscribe_heading_styled: '',
    subscribe_subheading: '',
    subscribe_tagline: '',
    // Subscribe info page
    subscribe_info_heading: '',
    subscribe_info_heading_styled: '',
    subscribe_info_subheading: '',
    subscribe_info_job_label: '',
    subscribe_info_job_options: DEFAULT_JOB_OPTIONS as { value: string; label: string }[],
    subscribe_info_clients_label: '',
    subscribe_info_clients_options: DEFAULT_CLIENTS_OPTIONS as { value: string; label: string }[],
    subscribe_info_submit_text: '',
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
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Home Page Hero</h3>
          <a href="/" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800">View Page &rarr;</a>
        </div>

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

      {/* Subscribe Page */}
      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Subscribe Page</h3>
          <a href="/subscribe" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800">View Page &rarr;</a>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Heading</label>
          <input
            type="text"
            value={settings.subscribe_heading}
            onChange={(e) => setSettings(prev => ({ ...prev, subscribe_heading: e.target.value }))}
            placeholder="Master AI Tools, Prompts & News"
            className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Heading (Styled Line)</label>
          <input
            type="text"
            value={settings.subscribe_heading_styled}
            onChange={(e) => setSettings(prev => ({ ...prev, subscribe_heading_styled: e.target.value }))}
            placeholder="in Just 3 Minutes a Day"
            className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">This line appears with the gradient underline style.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subheadline</label>
          <textarea
            value={settings.subscribe_subheading}
            onChange={(e) => setSettings(prev => ({ ...prev, subscribe_subheading: e.target.value }))}
            placeholder="Join 10,000+ accounting professionals staying current as AI reshapes bookkeeping, tax, and advisory work."
            rows={2}
            className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tagline</label>
          <input
            type="text"
            value={settings.subscribe_tagline}
            onChange={(e) => setSettings(prev => ({ ...prev, subscribe_tagline: e.target.value }))}
            placeholder="FREE FOREVER"
            className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">Shown below the subscribe form. Leave empty to hide.</p>
        </div>
      </div>

      {/* Subscribe Info Page */}
      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Subscribe Info Page</h3>
          <a href="/subscribe/info" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800">View Page &rarr;</a>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Heading</label>
          <input
            type="text"
            value={settings.subscribe_info_heading}
            onChange={(e) => setSettings(prev => ({ ...prev, subscribe_info_heading: e.target.value }))}
            placeholder="One Last Step!"
            className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Heading (Styled Line)</label>
          <input
            type="text"
            value={settings.subscribe_info_heading_styled}
            onChange={(e) => setSettings(prev => ({ ...prev, subscribe_info_heading_styled: e.target.value }))}
            placeholder="Personalize Your Experience"
            className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Subheadline</label>
          <textarea
            value={settings.subscribe_info_subheading}
            onChange={(e) => setSettings(prev => ({ ...prev, subscribe_info_subheading: e.target.value }))}
            placeholder="Help us tailor your newsletter to your needs. This only takes 30 seconds!"
            rows={2}
            className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Question 1 Label</label>
          <input
            type="text"
            value={settings.subscribe_info_job_label}
            onChange={(e) => setSettings(prev => ({ ...prev, subscribe_info_job_label: e.target.value }))}
            placeholder="What best describes your role?"
            className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Question 1 Options</label>
          {settings.subscribe_info_job_options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={opt.label}
                onChange={(e) => {
                  const updated = [...settings.subscribe_info_job_options]
                  updated[i] = { value: e.target.value, label: e.target.value }
                  setSettings(prev => ({ ...prev, subscribe_info_job_options: updated }))
                }}
                className="flex-1 border rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => {
                  const updated = settings.subscribe_info_job_options.filter((_, idx) => idx !== i)
                  setSettings(prev => ({ ...prev, subscribe_info_job_options: updated }))
                }}
                className="text-red-400 hover:text-red-600 text-sm px-1"
                title="Remove option"
              >
                &times;
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              setSettings(prev => ({
                ...prev,
                subscribe_info_job_options: [...prev.subscribe_info_job_options, { value: '', label: '' }]
              }))
            }}
            className="text-xs text-blue-600 hover:text-blue-800 mt-1"
          >
            + Add option
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Question 2 Label</label>
          <input
            type="text"
            value={settings.subscribe_info_clients_label}
            onChange={(e) => setSettings(prev => ({ ...prev, subscribe_info_clients_label: e.target.value }))}
            placeholder="How many clients' books/tax returns/financials do you handle yearly?"
            className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Question 2 Options</label>
          {settings.subscribe_info_clients_options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={opt.label}
                onChange={(e) => {
                  const updated = [...settings.subscribe_info_clients_options]
                  updated[i] = { value: e.target.value, label: e.target.value }
                  setSettings(prev => ({ ...prev, subscribe_info_clients_options: updated }))
                }}
                className="flex-1 border rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => {
                  const updated = settings.subscribe_info_clients_options.filter((_, idx) => idx !== i)
                  setSettings(prev => ({ ...prev, subscribe_info_clients_options: updated }))
                }}
                className="text-red-400 hover:text-red-600 text-sm px-1"
                title="Remove option"
              >
                &times;
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              setSettings(prev => ({
                ...prev,
                subscribe_info_clients_options: [...prev.subscribe_info_clients_options, { value: '', label: '' }]
              }))
            }}
            className="text-xs text-blue-600 hover:text-blue-800 mt-1"
          >
            + Add option
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Submit Button Text</label>
          <input
            type="text"
            value={settings.subscribe_info_submit_text}
            onChange={(e) => setSettings(prev => ({ ...prev, subscribe_info_submit_text: e.target.value }))}
            placeholder="Complete Sign Up"
            className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
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
