'use client'

import { useEffect, useState } from 'react'
import Layout from '@/components/Layout'
import Link from 'next/link'
import DeleteCampaignModal from '@/components/DeleteCampaignModal'
import type { NewsletterCampaign } from '@/types/database'

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<NewsletterCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    campaign: NewsletterCampaign | null
  }>({ isOpen: false, campaign: null })

  useEffect(() => {
    fetchCampaigns()
  }, [filter])

  const fetchCampaigns = async () => {
    try {
      const url = filter === 'all' ? '/api/campaigns?limit=50' : `/api/campaigns?status=${filter}&limit=50`
      const response = await fetch(url)
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
    // Parse date as local date to avoid timezone offset issues
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day) // month is 0-indexed
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const handleDeleteClick = (campaign: NewsletterCampaign) => {
    setDeleteModal({ isOpen: true, campaign })
  }

  const handleDeleteConfirm = () => {
    setDeleteModal({ isOpen: false, campaign: null })
    fetchCampaigns() // Refresh the campaigns list
  }

  const handleDeleteCancel = () => {
    setDeleteModal({ isOpen: false, campaign: null })
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Newsletter Campaigns
            </h1>
            <Link
              href="/dashboard/campaigns/new"
              className="bg-brand-primary hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Create Campaign
            </Link>
          </div>

          {/* Filter buttons */}
          <div className="flex space-x-2">
            {['all', 'draft', 'in_review', 'changes_made', 'sent', 'failed'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-1 text-sm font-medium rounded-md ${
                  filter === status
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {status === 'all' ? 'All' : formatStatus(status)}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white shadow rounded-lg">
          {loading ? (
            <div className="p-8 text-center text-gray-500">
              Loading campaigns...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-600">
              Error: {error}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No campaigns found
            </div>
          ) : (
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
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
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {campaigns.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatDate(campaign.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {campaign.subject_line || (
                          <span className="italic text-gray-400">No subject line</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(campaign.status)}`}>
                          {formatStatus(campaign.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(campaign.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-3">
                          <Link
                            href={`/dashboard/campaigns/${campaign.id}`}
                            className="text-brand-primary hover:text-blue-700"
                          >
                            View
                          </Link>
                          <button
                            onClick={() => handleDeleteClick(campaign)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Delete Campaign Modal */}
        {deleteModal.campaign && (
          <DeleteCampaignModal
            campaign={deleteModal.campaign}
            isOpen={deleteModal.isOpen}
            onClose={handleDeleteCancel}
            onConfirm={handleDeleteConfirm}
          />
        )}
      </div>
    </Layout>
  )
}