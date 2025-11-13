'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import Link from 'next/link'
import DeleteIssueModal from '@/components/DeleteIssueModal'
import type { Newsletterissue } from '@/types/database'

export default function CampaignsPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const [issues, setIssues] = useState<Newsletterissue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    issue: Newsletterissue | null
  }>({ isOpen: false, issue: null })
  const [createModal, setCreateModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchIssues()
  }, [filter, slug])

  const fetchIssues = async () => {
    try {
      const baseParams = `newsletter_slug=${slug}&limit=50`
      const url = filter === 'all'
        ? `/api/campaigns?${baseParams}`
        : `/api/campaigns?${baseParams}&status=${filter}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch issues')
      }
      const data = await response.json()
      setIssues(data.campaigns)
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

  const handleDeleteClick = (issue: Newsletterissue) => {
    setDeleteModal({ isOpen: true, issue })
  }

  const handleDeleteConfirm = () => {
    setDeleteModal({ isOpen: false, issue: null })
    fetchIssues() // Refresh the issues list
  }

  const handleDeleteCancel = () => {
    setDeleteModal({ isOpen: false, issue: null })
  }

  const handleCreateNewissue = () => {
    // Set default date to tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateString = tomorrow.toISOString().split('T')[0]
    setSelectedDate(dateString)
    setCreateModal(true)
  }

  const handleCreateConfirm = async () => {
    if (!selectedDate) {
      alert('Please select a date')
      return
    }

    setCreating(true)
    try {
      const response = await fetch('/api/campaigns/create-with-workflow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: selectedDate,
          publication_id: 'accounting' // TODO: Get from context/params
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create issue')
      }

      const data = await response.json()
      console.log('issue created:', data)

      // Close modal and redirect to issue page
      setCreateModal(false)
      router.push(`/dashboard/${slug}/issues/${data.issue_id}`)
    } catch (error) {
      console.error('Error creating issue:', error)
      alert('Failed to create issue: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setCreating(false)
    }
  }

  const handleCreateCancel = () => {
    setCreateModal(false)
    setSelectedDate('')
  }

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">
              Publication Issues
            </h1>
            <div className="flex space-x-2">
              <Link
                href={`/dashboard/${slug}/issues/new`}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md text-sm font-medium"
              >
                Create Blank Issue
              </Link>
              <button
                onClick={handleCreateNewissue}
                className="bg-brand-primary hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Create New Issue
              </button>
            </div>
          </div>

          {/* Filter buttons */}
          <div className="flex space-x-2 overflow-x-auto pb-2">
            {['all', 'draft', 'in_review', 'changes_made', 'sent', 'failed'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-1 text-sm font-medium rounded-md whitespace-nowrap ${
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
              Loading issues...
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-600">
              Error: {error}
            </div>
          ) : issues.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No issues found
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                  {issues.map((issue) => (
                    <tr key={issue.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatDate(issue.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {issue.subject_line || (
                          <span className="italic text-gray-400">No subject line</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(issue.status)}`}>
                          {formatStatus(issue.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(issue.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-3">
                          <Link
                            href={`/dashboard/${slug}/issues/${issue.id}`}
                            className="text-brand-primary hover:text-blue-700"
                          >
                            View
                          </Link>
                          <button
                            onClick={() => handleDeleteClick(issue)}
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

        {/* Delete issue Modal */}
        {deleteModal.issue && (
          <DeleteIssueModal
            issue={deleteModal.issue}
            isOpen={deleteModal.isOpen}
            onClose={handleDeleteCancel}
            onConfirm={handleDeleteConfirm}
          />
        )}

        {/* Create New issue Modal */}
        {createModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
                  Create New Issue
                </h3>
                <div className="mb-4">
                  <label htmlFor="issue-date" className="block text-sm font-medium text-gray-700 mb-2">
                    issue Date
                  </label>
                  <input
                    type="date"
                    id="issue-date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    This will start the full RSS workflow to create articles for this date.
                  </p>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={handleCreateCancel}
                    disabled={creating}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateConfirm}
                    disabled={creating || !selectedDate}
                    className="px-4 py-2 bg-brand-primary text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create issue'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}