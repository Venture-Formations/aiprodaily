'use client'

import { useState, useEffect } from 'react'

export default function SystemStatus() {
  const [status, setStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSystemStatus()
  }, [])

  const fetchSystemStatus = async () => {
    try {
      const response = await fetch('/api/health')
      const data = await response.json()
      setStatus(data)
    } catch (error) {
      console.error('Failed to fetch system status:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8">Loading system status...</div>
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">System Health</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 border rounded-lg">
            <div className={`text-2xl font-bold mb-1 ${
              status?.status === 'healthy' ? 'text-green-600' : 'text-red-600'
            }`}>
              {status?.status === 'healthy' ? '✓' : '✗'}
            </div>
            <div className="text-sm text-gray-600">Overall Status</div>
            <div className="text-xs text-gray-500 mt-1">
              {status?.status || 'Unknown'}
            </div>
          </div>

          <div className="text-center p-4 border rounded-lg">
            <div className={`text-2xl font-bold mb-1 ${
              status?.checks?.database?.healthy ? 'text-green-600' : 'text-red-600'
            }`}>
              {status?.checks?.database?.healthy ? '✓' : '✗'}
            </div>
            <div className="text-sm text-gray-600">Database</div>
            <div className="text-xs text-gray-500 mt-1">Connection</div>
          </div>

          <div className="text-center p-4 border rounded-lg">
            <div className={`text-2xl font-bold mb-1 ${
              status?.checks?.rssFeeds?.healthy ? 'text-green-600' : 'text-red-600'
            }`}>
              {status?.checks?.rssFeeds?.healthy ? '✓' : '✗'}
            </div>
            <div className="text-sm text-gray-600">RSS Feeds</div>
            <div className="text-xs text-gray-500 mt-1">Processing</div>
          </div>
        </div>

        <div className="mt-4 text-xs text-gray-500">
          Last checked: {status?.timestamp ? new Date(status.timestamp).toLocaleString() : 'Never'}
        </div>

        <button
          onClick={fetchSystemStatus}
          className="mt-4 bg-brand-primary hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium"
        >
          Refresh Status
        </button>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Cron Jobs</h3>

        {/* Workflow & Processing */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Workflow & Processing</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b">
              <div>
                <div className="font-medium">Trigger Workflow</div>
                <div className="text-sm text-gray-600">Every 5 minutes - Launches RSS workflow if schedule permits</div>
              </div>
              <span className="text-green-600 text-sm">Active</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <div>
                <div className="font-medium">RSS Ingestion</div>
                <div className="text-sm text-gray-600">Every 15 minutes - Fetches new posts from RSS feeds</div>
              </div>
              <span className="text-green-600 text-sm">Active</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <div>
                <div className="font-medium">Create Campaign</div>
                <div className="text-sm text-gray-600">Every 5 minutes - Creates issues when ready</div>
              </div>
              <span className="text-green-600 text-sm">Active</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <div>
                <div className="font-medium">Monitor Workflows</div>
                <div className="text-sm text-gray-600">Every 5 minutes - Detects stuck workflows</div>
              </div>
              <span className="text-green-600 text-sm">Active</span>
            </div>
          </div>
        </div>

        {/* Email */}
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Email</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b">
              <div>
                <div className="font-medium">Send Review</div>
                <div className="text-sm text-gray-600">Every 5 minutes - Sends review emails when ready</div>
              </div>
              <span className="text-green-600 text-sm">Active</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <div>
                <div className="font-medium">Send Final</div>
                <div className="text-sm text-gray-600">Every 5 minutes - Sends final newsletters</div>
              </div>
              <span className="text-green-600 text-sm">Active</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <div>
                <div className="font-medium">Send Secondary</div>
                <div className="text-sm text-gray-600">Every 5 minutes - Sends secondary newsletters</div>
              </div>
              <span className="text-green-600 text-sm">Active</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <div>
                <div className="font-medium">Process MailerLite Updates</div>
                <div className="text-sm text-gray-600">Every 5 minutes - Processes webhook updates</div>
              </div>
              <span className="text-green-600 text-sm">Active</span>
            </div>
          </div>
        </div>

        {/* System & Maintenance */}
        <div>
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">System & Maintenance</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b">
              <div>
                <div className="font-medium">Health Check</div>
                <div className="text-sm text-gray-600">Every 5 minutes (8 AM - 10 PM CT) - Monitors system health</div>
              </div>
              <span className="text-green-600 text-sm">Active</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <div>
                <div className="font-medium">Import Metrics</div>
                <div className="text-sm text-gray-600">Daily at 6:00 AM CT - Syncs MailerLite metrics</div>
              </div>
              <span className="text-green-600 text-sm">Active</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <div>
                <div className="font-medium">Cleanup Pending Submissions</div>
                <div className="text-sm text-gray-600">Daily at 7:00 AM CT - Removes stale pending submissions</div>
              </div>
              <span className="text-green-600 text-sm">Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
