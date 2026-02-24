'use client'

import { useState, useEffect } from 'react'

export default function PublicEventsSettings() {
  const [settings, setSettings] = useState({
    paidPlacementPrice: '5',
    featuredEventPrice: '15'
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings/public-events')
      if (response.ok) {
        const data = await response.json()
        setSettings(prev => ({ ...prev, ...data }))
      }
    } catch (error) {
      console.error('Failed to load public events settings:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')

    try {
      const response = await fetch('/api/settings/public-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      if (response.ok) {
        setMessage('Settings saved successfully!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to save settings')
      }
    } catch (error) {
      setMessage('Failed to save settings. Please try again.')
      console.error('Save error:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="space-y-6">
      {/* Pricing Configuration */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Public Event Submission Pricing</h3>
        <p className="text-sm text-gray-600 mb-4">
          Configure pricing for public event submissions. All events are promoted for 3 days.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Paid Placement Price (3 days)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                $
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={settings.paidPlacementPrice}
                onChange={(e) => handleChange('paidPlacementPrice', e.target.value)}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Price for paid placement in newsletter for 3 days
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Featured Event Price (3 days)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">
                $
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={settings.featuredEventPrice}
                onChange={(e) => handleChange('featuredEventPrice', e.target.value)}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Price for featured event status for 3 days
            </p>
          </div>
        </div>
      </div>

      {/* Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">How Public Event Submissions Work</h4>
        <ul className="space-y-1 text-sm text-blue-800">
          <li>• Public users can submit events through the website</li>
          <li>• Submissions require payment via Stripe Checkout</li>
          <li>• All submissions are automatically activated upon successful payment</li>
          <li>• Admins receive Slack notifications for new submissions</li>
          <li>• Admins can review, edit, or reject submissions in the dashboard</li>
          <li>• Paid Placement: Event appears in paid section of newsletter</li>
          <li>• Featured Event: Event appears prominently in the Local Events section</li>
          <li>• All promotions last for 3 days from the event start date</li>
        </ul>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-brand-primary hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-md font-medium"
        >
          {saving ? 'Saving...' : 'Save Settings'}
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
    </div>
  )
}
