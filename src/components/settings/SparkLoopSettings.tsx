'use client'

import { useState, useEffect } from 'react'

export default function SparkLoopSettings({ publicationId }: { publicationId: string }) {
  const [settings, setSettings] = useState({
    upscribeId: '',
    webhookSecret: '',
    afteroffersFormId: '',
  })
  const [hasApiKey, setHasApiKey] = useState(false)
  const [hasWebhookSecret, setHasWebhookSecret] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')

  useEffect(() => {
    loadSettings()
  }, [publicationId])

  const loadSettings = async () => {
    try {
      const response = await fetch(`/api/settings/sparkloop?publication_id=${publicationId}`)
      if (response.ok) {
        const data = await response.json()
        setSettings({
          upscribeId: data.upscribeId || '',
          webhookSecret: '', // Never pre-fill secrets
          afteroffersFormId: data.afteroffersFormId || '',
        })
        setHasApiKey(data.hasApiKey || false)
        setHasWebhookSecret(data.hasWebhookSecret || false)
      }
    } catch (error) {
      console.error('Failed to load SparkLoop settings:', error)
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
      const response = await fetch(`/api/settings/sparkloop?publication_id=${publicationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (response.ok) {
        showMessage('SparkLoop settings saved!', 'success')
        await loadSettings()
      } else {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save settings')
      }
    } catch (error) {
      console.error('Failed to save SparkLoop settings:', error)
      showMessage(error instanceof Error ? error.message : 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-gray-500">Loading SparkLoop settings...</div>
  }

  const webhookUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/sparkloop/${publicationId}`

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">SparkLoop Integration</h2>
        <p className="text-sm text-gray-500 mt-1">
          Configure SparkLoop credentials for this publication. The API key is shared across all publications via env var; Upscribe ID and webhook secret are per-publication.
        </p>
      </div>

      {message && (
        <div className={`p-3 rounded-md text-sm ${messageType === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message}
        </div>
      )}

      <div className="space-y-4">
        {/* API Key (managed via SPARKLOOP_API_KEY env var — shared across publications) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            SparkLoop API Key
          </label>
          <div className={`px-3 py-2 border rounded-md text-sm ${hasApiKey ? 'border-gray-200 bg-gray-50 text-gray-600' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {hasApiKey ? 'Configured (managed via SPARKLOOP_API_KEY environment variable)' : 'Not configured — set SPARKLOOP_API_KEY in Vercel environment variables'}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            The SparkLoop API key is shared across all publications and managed via the <code className="font-mono">SPARKLOOP_API_KEY</code> env var.
          </p>
        </div>

        {/* Upscribe ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Upscribe ID
          </label>
          <input
            type="text"
            value={settings.upscribeId}
            onChange={(e) => setSettings({ ...settings, upscribeId: e.target.value })}
            placeholder="upscribe_..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Your Upscribe popup ID (e.g., upscribe_63c3547d9f3d)
          </p>
        </div>

        {/* Webhook Secret */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Webhook Secret
          </label>
          <input
            type="password"
            value={settings.webhookSecret}
            onChange={(e) => setSettings({ ...settings, webhookSecret: e.target.value })}
            placeholder={hasWebhookSecret ? '******** (saved, enter new value to update)' : 'Enter webhook secret'}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            Found in SparkLoop Dashboard &gt; Account Settings &gt; Integrations
          </p>
        </div>

        {/* AfterOffers Form ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            AfterOffers Form ID
          </label>
          <input
            type="text"
            value={settings.afteroffersFormId}
            onChange={(e) => setSettings({ ...settings, afteroffersFormId: e.target.value })}
            placeholder="e.g., 994-2MMat6y-1"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-xs text-gray-400 mt-1">
            The form ID from your AfterOffers embed URL (the part after /show_offers/)
          </p>
        </div>

        {/* Webhook URL (read-only) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Webhook URL <span className="font-normal text-gray-400">(configure in SparkLoop)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={webhookUrl}
              readOnly
              className="flex-1 px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-600"
            />
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(webhookUrl)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Copy
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Paste this URL into SparkLoop Dashboard &gt; Account Settings &gt; Integrations &gt; Webhook URL
          </p>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-200">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save SparkLoop Settings'}
        </button>
      </div>
    </div>
  )
}
