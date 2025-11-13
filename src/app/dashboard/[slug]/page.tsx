'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, Button, StatusBadge, EmptyState, StatCardSkeleton, IssueCardSkeleton } from '@/components/ui'
import type { Newsletterissue, Newsletter } from '@/types/database'
import type { IssueStatus } from '@/components/ui/StatusBadge'

export default function NewsletterDashboard() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [newsletter, setNewsletter] = useState<Newsletter | null>(null)
  const [issues, setIssues] = useState<Newsletterissue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createModal, setCreateModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (slug) {
      fetchNewsletter()
      fetchIssues()
    }
  }, [slug])

  const fetchNewsletter = async () => {
    try {
      const response = await fetch('/api/newsletters')
      if (!response.ok) throw new Error('Failed to fetch newsletters')
      const data = await response.json()
      const found = data.newsletters?.find((n: Newsletter) => n.slug === slug)
      if (!found) {
        setError('Newsletter not found')
        router.push('/dashboard')
        return
      }
      setNewsletter(found)
    } catch (error) {
      console.error('Error fetching newsletter:', error)
      setError('Failed to load newsletter')
    }
  }

  const fetchIssues = async () => {
    try {
      const response = await fetch(`/api/campaigns?limit=3&newsletter_slug=${slug}`)
      if (!response.ok) {
        throw new Error('Failed to fetch issues')
      }
      const data = await response.json()
      setIssues(data.issues)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    // Parse as local date to avoid timezone shifts
    // "2025-11-03" should display as November 3, not November 2
    const [year, month, day] = dateString.split('-').map(Number)
    const date = new Date(year, month - 1, day) // month is 0-indexed
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const handleCreateNewIssue = () => {
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
          publication_id: slug
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create issue')
      }

      const data = await response.json()
      console.log('Issue created:', data)

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

  const statCards = [
    { label: 'Publications Sent', count: issues.filter(c => c.status === 'sent').length, color: 'text-brand-primary' },
    { label: 'In Review', count: issues.filter(c => c.status === 'in_review').length, color: 'text-yellow-600' },
    { label: 'Changes Made', count: issues.filter(c => c.status === 'changes_made').length, color: 'text-blue-600' },
    { label: 'Drafts', count: issues.filter(c => c.status === 'draft').length, color: 'text-gray-600' },
    { label: 'Failed', count: issues.filter(c => c.status === 'failed').length, color: 'text-red-600' },
  ]

  return (
    <Layout>
      <div className="px-4 py-6 sm:px-0">
        <div className="border-4 border-dashed border-gray-200 rounded-lg p-4 sm:p-8">
          {/* Header */}
          <header className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
              Publication Dashboard
            </h1>
            <p className="text-base sm:text-lg text-gray-600">
              Manage your {newsletter?.name || 'publication'} campaigns
            </p>
          </header>

          {/* Quick Stats */}
          <section aria-label="issue statistics">
            <h2 className="sr-only">issue Statistics</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-8">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <StatCardSkeleton key={i} />
                ))
              ) : (
                statCards.map((stat, index) => (
                  <Card key={index} padding="md" className="text-center">
                    <div className={`text-xl sm:text-2xl font-bold ${stat.color} mb-1`} aria-label={`${stat.count} ${stat.label}`}>
                      {stat.count}
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600">{stat.label}</div>
                  </Card>
                ))
              )}
            </div>
          </section>

          {/* Recent Issues */}
          <section aria-labelledby="recent-campaigns-heading">
            <Card padding="none" className="mb-8">
              <CardHeader className="px-4 sm:px-6 py-4 mb-0">
                <div className="flex justify-between items-center">
                  <h2 id="recent-campaigns-heading" className="text-xl font-semibold text-gray-900">
                    Recent Issues
                  </h2>
                  <Link
                    href={`/dashboard/${slug}/issues`}
                    className="text-brand-primary hover:text-blue-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-primary rounded px-2 py-1"
                    aria-label="View all issues"
                  >
                    View All
                  </Link>
                </div>
              </CardHeader>
              <div className="divide-y divide-gray-200" role="list">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <IssueCardSkeleton key={i} />
                  ))
                ) : error ? (
                  <EmptyState
                    icon="⚠️"
                    title="Error Loading Issues"
                    description={error}
                    actionLabel="Try Again"
                    onAction={fetchIssues}
                  />
                ) : issues.length === 0 ? (
                  <EmptyState
                    icon="📧"
                    title="No issues yet"
                    description="Get started by creating your first publication issue"
                    actionLabel="Create issue"
                    actionHref={`/dashboard/${slug}/issues/new`}
                  />
                ) : (
                  issues.map((issue) => (
                    <Link
                      key={issue.id}
                      href={`/dashboard/${slug}/issues/${issue.id}`}
                      className="block p-4 sm:p-6 hover:bg-gray-50 focus:outline-none focus:bg-gray-50 transition-colors"
                      role="listitem"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {formatDate(issue.date)}
                          </div>
                          <div className="text-sm text-gray-500 truncate mt-1">
                            {issue.subject_line || 'No subject line'}
                          </div>
                        </div>
                        <StatusBadge status={issue.status as IssueStatus} />
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </Card>
          </section>

          {/* Quick Actions */}
          <section aria-label="Quick actions">
            <h2 className="sr-only">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <button
                onClick={handleCreateNewIssue}
                className="group focus:outline-none focus:ring-2 focus:ring-brand-primary rounded-lg text-left"
                aria-label="Create a new issue"
              >
                <Card hover padding="lg" className="h-full">
                  <div className="text-center">
                    <div className="text-4xl mb-3" role="img" aria-label="Notebook emoji">📝</div>
                    <div className="text-lg font-medium text-gray-900 mb-2 group-hover:text-brand-primary transition-colors">
                      Create Issue
                    </div>
                    <div className="text-sm text-gray-600">
                      Start a new publication issue
                    </div>
                  </div>
                </Card>
              </button>
              <Link
                href={`/dashboard/${slug}/analytics`}
                className="group focus:outline-none focus:ring-2 focus:ring-brand-primary rounded-lg"
                aria-label="View analytics"
              >
                <Card hover padding="lg" className="h-full">
                  <div className="text-center">
                    <div className="text-4xl mb-3" role="img" aria-label="Chart emoji">📊</div>
                    <div className="text-lg font-medium text-gray-900 mb-2 group-hover:text-brand-primary transition-colors">
                      View Analytics
                    </div>
                    <div className="text-sm text-gray-600">
                      Check performance metrics
                    </div>
                  </div>
                </Card>
              </Link>
              <Link
                href={`/dashboard/${slug}/settings`}
                className="group focus:outline-none focus:ring-2 focus:ring-brand-primary rounded-lg"
                aria-label="Open settings"
              >
                <Card hover padding="lg" className="h-full">
                  <div className="text-center">
                    <div className="text-4xl mb-3" role="img" aria-label="Gear emoji">⚙️</div>
                    <div className="text-lg font-medium text-gray-900 mb-2 group-hover:text-brand-primary transition-colors">
                      Settings
                    </div>
                    <div className="text-sm text-gray-600">
                      Configure RSS feeds and options
                    </div>
                  </div>
                </Card>
              </Link>
            </div>
          </section>
        </div>
      </div>

      {/* Create New Issue Modal */}
      {createModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
                Create New Issue
              </h3>
              <div className="mb-4">
                <label htmlFor="issue-date" className="block text-sm font-medium text-gray-700 mb-2">
                  Issue Date
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
                  {creating ? 'Creating...' : 'Create Issue'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
