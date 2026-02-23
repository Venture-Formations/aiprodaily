'use client'

import { useState, useEffect } from 'react'

export default function Notifications() {
  const [settings, setSettings] = useState({
    campaignStatusUpdates: true,
    workflowFailure: true,
    systemErrors: true,
    rssProcessingUpdates: true,
    rssProcessingIncomplete: true,
    lowArticleCount: true,
    scheduledSendFailure: true,
    scheduledSendTiming: true,
    healthCheckAlerts: true,
    emailDeliveryUpdates: true
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings/slack')
      if (response.ok) {
        const data = await response.json()
        setSettings(prev => ({ ...prev, ...data }))
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')

    try {
      const response = await fetch('/api/settings/slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      if (response.ok) {
        setMessage('Notification settings saved successfully!')
        setTimeout(() => setMessage(''), 3000)
      } else {
        throw new Error('Failed to save settings')
      }
    } catch (error) {
      console.error('Failed to save notification settings:', error)
      setMessage('Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = (field: string, value: boolean) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  const notificationTypes = [
    {
      id: 'campaignStatusUpdates',
      name: 'Issue Status Updates',
      description: 'Notifications when campaigns are marked as "Changes Made" by reviewers',
      examples: [
        'issue marked as "Changes Made" for Dec 15 by John Doe',
        'issue requires review before proceeding to send',
        'Manual edits detected - status updated to "Changes Made"'
      ]
    },
    {
      id: 'workflowFailure',
      name: 'Workflow Failures',
      description: 'Critical alerts when automated workflows fail after all retry attempts',
      examples: [
        'Workflow failed after retries - issue ID: abc123',
        'RSS processing workflow terminated due to repeated errors',
        'issue creation workflow failed - manual intervention required'
      ]
    },
    {
      id: 'rssProcessingUpdates',
      name: 'RSS Processing Completion',
      description: 'Success notifications when RSS processing completes',
      examples: [
        'RSS Processing Complete - issue abc123 - 8 articles generated',
        'Archive: 12 articles, 45 posts preserved',
        'Ready for review and scheduling'
      ]
    },
    {
      id: 'rssProcessingIncomplete',
      name: 'RSS Processing Incomplete',
      description: 'Alerts when RSS processing fails partway through steps',
      examples: [
        'RSS Processing Incomplete - Completed: Archive, Fetch - Failed at: Score Posts',
        'issue may be missing content or in invalid state',
        'Error: OpenAI API timeout during article generation'
      ]
    },
    {
      id: 'lowArticleCount',
      name: 'Low Article Count (≤6 articles)',
      description: 'Alerts when article count is too low for quality delivery',
      examples: [
        'Low Article Count Alert - 4 articles (≤6 threshold)',
        'Newsletter may not have enough content for quality delivery',
        'Action Required: Manual review before sending'
      ]
    },
    {
      id: 'scheduledSendFailure',
      name: 'Scheduled Send Failures',
      description: 'Alerts when scheduled sends fail to deliver to SendGrid',
      examples: [
        'Scheduled Send Failed - issue abc123',
        'Send triggered but no email delivered to SendGrid',
        'SendGrid API authentication failed during scheduled send'
      ]
    },
    {
      id: 'scheduledSendTiming',
      name: 'Scheduled Send Timing Issues',
      description: 'Warnings when scheduling logic detects configuration problems',
      examples: [
        'Found 2 issues with ready_to_send status but shouldRun returned false',
        'Timing configuration issue detected',
        'Send window may be misconfigured'
      ]
    },
    {
      id: 'emailDeliveryUpdates',
      name: 'Email Delivery Success',
      description: 'SendGrid campaign delivery confirmations',
      examples: [
        'Review issue sent successfully for issue abc123',
        'Final issue sent successfully for issue xyz789',
        'SendGrid delivery confirmed'
      ]
    },
    {
      id: 'healthCheckAlerts',
      name: 'Health Check Alerts',
      description: 'System health monitoring alerts for degraded or down services',
      examples: [
        'Health Check: RSS Feeds is degraded - 3 feeds have multiple errors',
        'Health Check: Database is down - Unable to connect',
        'System health check failed - some components not healthy'
      ]
    },
    {
      id: 'systemErrors',
      name: 'System Errors',
      description: 'Critical system-wide errors from various components',
      examples: [
        'Critical error in rss_processor during article generation',
        'System Alert: Database connection lost',
        'Authentication system failure detected'
      ]
    }
  ]

  return (
    <div className="space-y-6">
      {/* Slack Notification Types */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Slack Notification Types</h3>
        <p className="text-sm text-gray-600 mb-6">
          Control which types of notifications are sent to your Slack channel.
        </p>

        <div className="space-y-6">
          {notificationTypes.map((type) => (
            <div key={type.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium text-gray-900 mb-1">{type.name}</div>
                  <div className="text-sm text-gray-600 mb-3">{type.description}</div>

                  {/* Examples Section */}
                  <div className="bg-white rounded-md p-3 border border-gray-100">
                    <div className="text-xs font-medium text-gray-500 mb-2">Example notifications:</div>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {type.examples.map((example, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-gray-400 mr-2">•</span>
                          <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-xs">{example}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex flex-col items-end ml-4">
                  <button
                    onClick={() => handleToggle(type.id, !settings[type.id as keyof typeof settings])}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settings[type.id as keyof typeof settings] ? 'bg-brand-primary' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings[type.id as keyof typeof settings] ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className={`mt-2 text-sm font-medium ${
                    settings[type.id as keyof typeof settings] ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {settings[type.id as keyof typeof settings] ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
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
