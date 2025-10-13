'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import Link from 'next/link'
import type { NewsletterCampaign } from '@/types/database'

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState<NewsletterCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const fetchCampaigns = async () => {
    try {
      const response = await fetch('/api/campaigns?limit=3')
      if (!response.ok) {
        throw new Error('Failed to fetch campaigns')
      }
      const data = await response.json()
      setCampaigns(data.campaigns)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800'
      case 'in_review': return 'bg-yellow-100 text-yellow-800'
      case 'changes_made': return 'bg-orange-100 text-orange-800'
      case 'sent': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatStatus = (status: string) => {
    switch (status) {
      case 'draft': return 'Draft'
      case 'in_review': return 'In Review'
      case 'changes_made': return 'Changes Made'
      case 'sent': return 'Sent'
      case 'failed': return 'Failed'
      default: return status
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Newsletter Dashboard
            </h1>
            <p className="text-lg text-gray-600">
              Manage your St. Cloud Scoop newsletter campaigns
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-2xl font-bold text-brand-primary mb-1">
                {campaigns.filter(c => c.status === 'sent').length}
              </div>
              <div className="text-sm text-gray-600">Newsletters Sent</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-2xl font-bold text-yellow-600 mb-1">
                {campaigns.filter(c => c.status === 'in_review').length}
              </div>
              <div className="text-sm text-gray-600">In Review</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {campaigns.filter(c => c.status === 'changes_made').length}
              </div>
              <div className="text-sm text-gray-600">Changes Made</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-2xl font-bold text-gray-600 mb-1">
                {campaigns.filter(c => c.status === 'draft').length}
              </div>
              <div className="text-sm text-gray-600">Drafts</div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="text-2xl font-bold text-red-600 mb-1">
                {campaigns.filter(c => c.status === 'failed').length}
              </div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
          </div>

          {/* Recent Campaigns */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium text-gray-900">
                  Recent Campaigns
                </h2>
                <Link
                  href="/dashboard/campaigns"
                  className="text-brand-primary hover:text-blue-700 text-sm font-medium"
                >
                  View All
                </Link>
              </div>
            </div>
            <div className="divide-y divide-gray-200">
              {loading ? (
                <div className="p-6 text-center text-gray-500">
                  Loading campaigns...
                </div>
              ) : error ? (
                <div className="p-6 text-center text-red-600">
                  Error: {error}
                </div>
              ) : campaigns.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  No campaigns found
                </div>
              ) : (
                campaigns.map((campaign) => (
                  <Link
                    key={campaign.id}
                    href={`/dashboard/campaigns/${campaign.id}`}
                    className="block p-6 hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {formatDate(campaign.date)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {campaign.subject_line || 'No subject line'}
                        </div>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>
                        {formatStatus(campaign.status)}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link
              href="/dashboard/campaigns/new"
              className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <div className="text-center">
                <div className="text-3xl mb-2">📝</div>
                <div className="text-lg font-medium text-gray-900 mb-1">
                  Create Campaign
                </div>
                <div className="text-sm text-gray-600">
                  Start a new newsletter campaign
                </div>
              </div>
            </Link>
            <Link
              href="/dashboard/analytics"
              className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <div className="text-center">
                <div className="text-3xl mb-2">📊</div>
                <div className="text-lg font-medium text-gray-900 mb-1">
                  View Analytics
                </div>
                <div className="text-sm text-gray-600">
                  Check performance metrics
                </div>
              </div>
            </Link>
            <Link
              href="/dashboard/settings"
              className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <div className="text-center">
                <div className="text-3xl mb-2">⚙️</div>
                <div className="text-lg font-medium text-gray-900 mb-1">
                  Settings
                </div>
                <div className="text-sm text-gray-600">
                  Configure RSS feeds and options
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </Layout>
  )
}