'use client'

import { useState, useEffect } from 'react'

export default function FacebookSettings() {
  const [settings, setSettings] = useState({
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
  const [tokenStatus, setTokenStatus] = useState<{ valid: boolean; expiresAt?: string; pageName?: string } | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings/facebook')
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
      const response = await fetch('/api/settings/facebook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })

      if (response.ok) {
        showMessage('Facebook settings saved successfully!', 'success')
        // Reload to get updated state
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
      const response = await fetch('/api/settings/facebook', {
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
      const response = await fetch('/api/settings/facebook', {
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
      const response = await fetch('/api/settings/facebook', {
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

  // Generate time options from 00:00 to 23:30 in 30-minute intervals
  const timeOptions = []
  for (let hour = 0; hour < 24; hour++) {
    for (let minute of [0, 30]) {
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      const displayTime = new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
      timeOptions.push({ value: time, label: displayTime })
    }
  }

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            messageType === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message}
        </div>
      )}

      {/* Main Settings Card */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Facebook Page Posting</h3>
        <p className="text-sm text-gray-600 mb-6">
          Automatically post ad content from your newsletter to your Facebook Page on a daily schedule.
        </p>

        {/* Enable Toggle */}
        <div className="flex items-center justify-between py-4 border-b border-gray-200">
          <div>
            <div className="font-medium text-gray-900">Enable Facebook Posting</div>
            <div className="text-sm text-gray-500">Turn on automatic daily posts to your Facebook Page</div>
          </div>
          <button
            onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.enabled ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Page Configuration */}
        <div className="py-4 border-b border-gray-200">
          <h4 className="font-medium text-gray-900 mb-4">Page Configuration</h4>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Facebook Page ID</label>
              <input
                type="text"
                value={settings.pageId}
                onChange={(e) => setSettings({ ...settings, pageId: e.target.value })}
                placeholder="Enter your Facebook Page ID"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Find this in your Facebook Page settings under &quot;Page transparency&quot; or in the Page URL
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Page Access Token</label>
              <div className="flex space-x-2">
                <input
                  type="password"
                  value={settings.accessToken}
                  onChange={(e) => setSettings({ ...settings, accessToken: e.target.value })}
                  placeholder={hasAccessToken ? '••••••••••••••••' : 'Enter your Page Access Token'}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleVerifyToken}
                  disabled={verifying || !hasAccessToken}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50"
                >
                  {verifying ? 'Verifying...' : 'Verify'}
                </button>
              </div>
              {hasAccessToken && (
                <p className="text-xs text-green-600 mt-1">Token is saved. Enter a new token to replace it.</p>
              )}
            </div>

            {/* Token Status */}
            {tokenStatus && (
              <div
                className={`p-3 rounded-md ${
                  tokenStatus.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}
              >
                {tokenStatus.valid ? (
                  <div className="text-sm text-green-800">
                    <div className="font-medium">Token is valid</div>
                    {tokenStatus.pageName && <div>Page: {tokenStatus.pageName}</div>}
                    {tokenStatus.expiresAt && (
                      <div>Expires: {new Date(tokenStatus.expiresAt).toLocaleDateString()}</div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-red-800 font-medium">Token is invalid or expired</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Schedule Configuration */}
        <div className="py-4 border-b border-gray-200">
          <h4 className="font-medium text-gray-900 mb-4">Posting Schedule</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Post Time (Central Time)</label>
              <select
                value={settings.postTime}
                onChange={(e) => setSettings({ ...settings, postTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {timeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ad Module to Post</label>
              <select
                value={settings.adModuleId}
                onChange={(e) => setSettings({ ...settings, adModuleId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select an ad module...</option>
                {adModules.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Content from this module will be posted to Facebook daily
              </p>
            </div>
          </div>
        </div>

        {/* Last Post Status */}
        {(lastPostDate || lastPostId) && (
          <div className="py-4 border-b border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">Last Post</h4>
            <div className="text-sm text-gray-600 space-y-1">
              {lastPostDate && <div>Date: {new Date(lastPostDate).toLocaleDateString()}</div>}
              {lastPostId && <div>Post ID: {lastPostId}</div>}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-4 flex flex-wrap gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>

          <button
            onClick={handleTestPost}
            disabled={testing || !hasAccessToken}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50"
          >
            {testing ? 'Posting...' : 'Send Test Post'}
          </button>

          <button
            onClick={handleTestAdPost}
            disabled={testing || !hasAccessToken || !settings.adModuleId}
            className="px-4 py-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200 disabled:opacity-50"
          >
            {testing ? 'Posting...' : 'Test Ad Post'}
          </button>
        </div>
      </div>

      {/* Setup Help */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">How to Set Up Facebook Posting:</h4>
        <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
          <li>
            <strong>Create a Facebook App:</strong> Go to{' '}
            <a
              href="https://developers.facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              developers.facebook.com
            </a>{' '}
            and create a new app
          </li>
          <li>
            <strong>Add Permissions:</strong> Your app needs <code className="bg-blue-100 px-1 rounded">pages_manage_posts</code> and{' '}
            <code className="bg-blue-100 px-1 rounded">pages_read_engagement</code> permissions
          </li>
          <li>
            <strong>Generate Page Access Token:</strong> Use the Graph API Explorer to generate a long-lived Page Access Token
          </li>
          <li>
            <strong>Find your Page ID:</strong> Go to your Facebook Page, click About, then scroll to find &quot;Page ID&quot;
          </li>
          <li>
            <strong>Configure above:</strong> Enter your Page ID and Access Token, select your ad module, and set your preferred posting time
          </li>
        </ol>
        <p className="text-xs text-blue-700 mt-3">
          See the full setup guide in <code className="bg-blue-100 px-1 rounded">docs/integrations/facebook-setup.md</code>
        </p>
      </div>
    </div>
  )
}
