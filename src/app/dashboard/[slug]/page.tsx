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
      setIssues(data.campaigns)
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
              <Link
                href={`/dashboard/${slug}/issues/new`}
                className="group focus:outline-none focus:ring-2 focus:ring-brand-primary rounded-lg"
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
              </Link>
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
    </Layout>
  )
}
