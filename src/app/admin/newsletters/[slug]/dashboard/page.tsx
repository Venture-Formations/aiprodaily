'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface DashboardData {
  newsletter: {
    id: string
    name: string
    slug: string
    subdomain: string
    description: string | null
    primary_color: string
  }
  campaign_counts: {
    draft: number
    in_review: number
    ready_to_send: number
    sent: number
    total: number
  }
  ai_apps: {
    total: number
    recent: Array<{
      id: string
      app_name: string
      category: string | null
      is_active: boolean
      times_used: number
      created_at: string
    }>
  }
  prompts: {
    total: number
    recent: Array<{
      id: string
      title: string
      category: string | null
      is_active: boolean
      times_used: number
      created_at: string
    }>
  }
  recent_campaigns: Array<{
    id: string
    status: string
    date: string
    subject_line: string | null
    article_count: number
    created_at: string
  }>
}

export default function NewsletterDashboard() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDashboardData()
  }, [slug])

  async function loadDashboardData() {
    try {
      setLoading(true)
      const response = await fetch(`/api/newsletters/${slug}/dashboard`)
      const result = await response.json()

      if (result.success) {
        setData(result.data)
      } else {
        setError(result.error || 'Failed to load dashboard')
      }
    } catch (err) {
      console.error('Error loading dashboard:', err)
      setError('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/admin/newsletters')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Newsletters
          </button>
        </div>
      </div>
    )
  }

  const { newsletter, campaign_counts, ai_apps, prompts, recent_campaigns } = data

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">{newsletter.name}</h1>
              <p className="text-gray-600 mt-2">{newsletter.description || 'Newsletter Dashboard'}</p>
              <p className="text-sm text-gray-500 mt-1">
                Subdomain: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{newsletter.subdomain}.yourdomain.com</span>
              </p>
            </div>
            <Link
              href="/admin/newsletters"
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
            >
              ← All Newsletters
            </Link>
          </div>
        </div>

        {/* Campaign Statistics */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Campaign Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <StatCard
              title="Draft"
              value={campaign_counts.draft}
              bgColor="bg-yellow-50"
              textColor="text-yellow-800"
              borderColor="border-yellow-200"
            />
            <StatCard
              title="In Review"
              value={campaign_counts.in_review}
              bgColor="bg-blue-50"
              textColor="text-blue-800"
              borderColor="border-blue-200"
            />
            <StatCard
              title="Ready to Send"
              value={campaign_counts.ready_to_send}
              bgColor="bg-purple-50"
              textColor="text-purple-800"
              borderColor="border-purple-200"
            />
            <StatCard
              title="Sent"
              value={campaign_counts.sent}
              bgColor="bg-green-50"
              textColor="text-green-800"
              borderColor="border-green-200"
            />
            <StatCard
              title="Total Campaigns"
              value={campaign_counts.total}
              bgColor="bg-gray-50"
              textColor="text-gray-800"
              borderColor="border-gray-300"
            />
          </div>
        </div>

        {/* Content Statistics */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Content Library</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* AI Applications */}
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">AI Applications</h3>
                <Link
                  href={`/admin/newsletters/${slug}/ai-apps`}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Manage →
                </Link>
              </div>
              <div className="text-3xl font-bold text-blue-600 mb-4">{ai_apps.total}</div>
              {ai_apps.recent.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700 mb-2">Recent Apps:</p>
                  {ai_apps.recent.map((app) => (
                    <div key={app.id} className="text-sm text-gray-600 flex justify-between items-center">
                      <span className="truncate">{app.app_name}</span>
                      <span className="text-xs text-gray-500 ml-2">Used {app.times_used}x</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No AI applications yet</p>
              )}
            </div>

            {/* Prompt Ideas */}
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Prompt Ideas</h3>
                <Link
                  href={`/admin/newsletters/${slug}/prompt-ideas`}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Manage →
                </Link>
              </div>
              <div className="text-3xl font-bold text-purple-600 mb-4">{prompts.total}</div>
              {prompts.recent.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700 mb-2">Recent Prompts:</p>
                  {prompts.recent.map((prompt) => (
                    <div key={prompt.id} className="text-sm text-gray-600 flex justify-between items-center">
                      <span className="truncate">{prompt.title}</span>
                      <span className="text-xs text-gray-500 ml-2">Used {prompt.times_used}x</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No prompt ideas yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href={`/admin/newsletters/${slug}/campaigns/new`}
              className="bg-blue-600 text-white p-6 rounded-lg hover:bg-blue-700 transition-colors text-center"
            >
              <div className="text-3xl mb-2">📧</div>
              <div className="font-semibold">Create Campaign</div>
            </Link>
            <Link
              href={`/admin/newsletters/${slug}/ai-apps`}
              className="bg-purple-600 text-white p-6 rounded-lg hover:bg-purple-700 transition-colors text-center"
            >
              <div className="text-3xl mb-2">🤖</div>
              <div className="font-semibold">Manage AI Apps</div>
            </Link>
            <Link
              href={`/admin/newsletters/${slug}/prompt-ideas`}
              className="bg-green-600 text-white p-6 rounded-lg hover:bg-green-700 transition-colors text-center"
            >
              <div className="text-3xl mb-2">💡</div>
              <div className="font-semibold">Manage Prompts</div>
            </Link>
          </div>
        </div>

        {/* Recent Campaigns */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Recent Campaigns</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {recent_campaigns.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No campaigns yet. Create your first campaign to get started!
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subject Line
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Articles
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recent_campaigns.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(campaign.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {campaign.subject_line || <span className="text-gray-400 italic">No subject line</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={campaign.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {campaign.article_count} articles
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link
                          href={`/admin/newsletters/${slug}/campaigns/${campaign.id}`}
                          className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper Components
function StatCard({ title, value, bgColor, textColor, borderColor }: {
  title: string
  value: number
  bgColor: string
  textColor: string
  borderColor: string
}) {
  return (
    <div className={`${bgColor} rounded-lg p-6 border ${borderColor}`}>
      <div className="text-sm font-medium text-gray-600 mb-1">{title}</div>
      <div className={`text-3xl font-bold ${textColor}`}>{value}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
    draft: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Draft' },
    in_review: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'In Review' },
    ready_to_send: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Ready to Send' },
    sent: { bg: 'bg-green-100', text: 'text-green-800', label: 'Sent' }
  }

  const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  )
}
