import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase'
import { ExternalLink, MousePointer, Users, TrendingUp, Calendar, BarChart3 } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ 'ad-id': string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { 'ad-id': adId } = await params

  const { data: ad } = await supabaseAdmin
    .from('advertisements')
    .select('title, company_name')
    .eq('id', adId)
    .single()

  if (!ad) {
    return {
      title: 'Ad Not Found'
    }
  }

  return {
    title: `${ad.title} - Ad Analytics`,
    description: `Performance analytics for ${ad.company_name || ad.title} advertisement`
  }
}

export default async function AdAnalyticsPage({ params }: PageProps) {
  const { 'ad-id': adId } = await params

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(adId)) {
    notFound()
  }

  // Fetch the advertisement with its ad module
  const { data: ad, error: adError } = await supabaseAdmin
    .from('advertisements')
    .select('id, title, body, image_url, button_text, button_url, status, company_name, publication_id, times_used, created_at, ad_module_id')
    .eq('id', adId)
    .single()

  if (adError || !ad) {
    notFound()
  }

  // Check if the ad's module includes a button block
  let showButton = true // Default to showing button for legacy ads
  if (ad.ad_module_id) {
    const { data: adModule } = await supabaseAdmin
      .from('ad_modules')
      .select('block_order')
      .eq('id', ad.ad_module_id)
      .single()

    if (adModule?.block_order) {
      // block_order is an array like ['title', 'image', 'body', 'button']
      const blockOrder = Array.isArray(adModule.block_order) ? adModule.block_order : []
      showButton = blockOrder.includes('button')
    }
  }

  // Fetch issue associations from BOTH legacy and module tables
  const [legacyResult, moduleResult] = await Promise.all([
    supabaseAdmin
      .from('issue_advertisements')
      .select('issue_id, used_at')
      .eq('advertisement_id', adId),
    supabaseAdmin
      .from('issue_module_ads')
      .select('issue_id, used_at')
      .eq('advertisement_id', adId)
  ])

  const issueAds = [
    ...(legacyResult.data || []),
    ...(moduleResult.data || [])
  ]

  // Get unique issue IDs
  const issueIds = Array.from(new Set(issueAds.map(ia => ia.issue_id)))

  // Fetch issues with email metrics
  let issues: any[] = []
  if (issueIds.length > 0) {
    const { data: issuesData } = await supabaseAdmin
      .from('publication_issues')
      .select(`
        id,
        date,
        status,
        email_metrics(*)
      `)
      .in('id', issueIds)
      .eq('status', 'sent')
      .order('date', { ascending: false })

    // Transform email_metrics from array to single object
    issues = (issuesData || []).map((issue: any) => ({
      ...issue,
      email_metrics: Array.isArray(issue.email_metrics) && issue.email_metrics.length > 0
        ? issue.email_metrics[0]
        : null
    }))
  }

  // Get ad module names for this publication (for link_section matching)
  const { data: adModules } = await supabaseAdmin
    .from('ad_modules')
    .select('name')
    .eq('publication_id', ad.publication_id)

  // Build list of section names to look for
  const adSectionNames = ['Advertorial']
  if (adModules) {
    for (const module of adModules) {
      if (module.name && !adSectionNames.includes(module.name)) {
        adSectionNames.push(module.name)
      }
    }
  }

  // Fetch link clicks for this ad's issues
  let linkClicks: any[] = []
  if (issueIds.length > 0) {
    const { data: clicksData } = await supabaseAdmin
      .from('link_clicks')
      .select('id, subscriber_email, issue_id, issue_date, clicked_at, link_url')
      .in('issue_id', issueIds)
      .in('link_section', adSectionNames)
      .order('clicked_at', { ascending: false })

    linkClicks = clicksData || []
  }

  // Filter clicks that match this ad (by issue_id or URL)
  const issueIdSet = new Set(issueIds)
  const normalizeUrl = (url: string) => {
    return url.toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
      .trim()
  }

  const adClicks = linkClicks.filter(click => {
    // Match by issue_id (most accurate)
    if (click.issue_id && issueIdSet.has(click.issue_id)) {
      return true
    }
    // Fallback: match by URL
    if (ad.button_url && click.link_url) {
      const normalizedClickUrl = normalizeUrl(click.link_url)
      const normalizedAdUrl = normalizeUrl(ad.button_url)
      return normalizedClickUrl === normalizedAdUrl ||
             normalizedClickUrl.includes(normalizedAdUrl) ||
             normalizedAdUrl.includes(normalizedClickUrl)
    }
    return false
  })

  // Calculate analytics
  const totalClicks = adClicks.length
  const uniqueClickers = new Set(adClicks.map(click => click.subscriber_email)).size

  // Calculate total recipients and CTR
  let totalRecipients = 0
  issues.forEach(issue => {
    if (issue.email_metrics?.sent_count) {
      totalRecipients += issue.email_metrics.sent_count
    }
  })
  const clickThroughRate = totalRecipients > 0
    ? Math.round((uniqueClickers / totalRecipients) * 10000) / 100
    : null

  // Calculate daily breakdown
  const clicksByDate = new Map<string, { total: number; unique: Set<string> }>()
  adClicks.forEach(click => {
    const date = click.clicked_at.split('T')[0]
    if (!clicksByDate.has(date)) {
      clicksByDate.set(date, { total: 0, unique: new Set() })
    }
    const dayData = clicksByDate.get(date)!
    dayData.total++
    dayData.unique.add(click.subscriber_email)
  })

  const dailyBreakdown = Array.from(clicksByDate.entries())
    .map(([date, data]) => ({
      date,
      totalClicks: data.total,
      uniqueClickers: data.unique.size
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 14) // Last 14 days

  // Calculate per-issue breakdown
  const clicksByIssue = new Map<string, { total: number; unique: Set<string> }>()
  adClicks.forEach(click => {
    if (click.issue_id && issueIdSet.has(click.issue_id)) {
      if (!clicksByIssue.has(click.issue_id)) {
        clicksByIssue.set(click.issue_id, { total: 0, unique: new Set() })
      }
      const issueData = clicksByIssue.get(click.issue_id)!
      issueData.total++
      issueData.unique.add(click.subscriber_email)
    }
  })

  const issueBreakdown = issues.map(issue => {
    const clickData = clicksByIssue.get(issue.id) || { total: 0, unique: new Set() }
    const sentCount = issue.email_metrics?.sent_count || 0
    const openedCount = issue.email_metrics?.opened_count || 0
    const openRate = sentCount > 0 ? Math.round((openedCount / sentCount) * 1000) / 10 : null

    return {
      id: issue.id,
      date: issue.date,
      sentCount,
      openedCount,
      openRate,
      totalClicks: clickData.total,
      uniqueClickers: clickData.unique.size
    }
  }).sort((a, b) => b.date.localeCompare(a.date))

  // Format date helper
  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-blue-600" />
              <span className="text-xl font-semibold text-gray-900">Ad Analytics</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Ad Preview Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
          <div className="bg-blue-600 px-6 py-3">
            <h1 className="text-xl font-semibold text-white">
              {ad.company_name || ad.title}
            </h1>
          </div>
          <div className="p-6">
            <div className="flex gap-6">
              {/* Ad Content */}
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">{ad.title}</h2>
                <div
                  className="prose prose-sm max-w-none text-gray-700 mb-4"
                  dangerouslySetInnerHTML={{ __html: ad.body }}
                />
                {showButton && ad.button_url && (
                  <a
                    href={ad.button_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {ad.button_text || 'Learn More'}
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
              {/* Ad Image */}
              {ad.image_url && (
                <div className="flex-shrink-0">
                  <img
                    src={ad.image_url}
                    alt={ad.title}
                    className="w-72 h-auto rounded-lg border border-gray-200"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Analytics Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Clicks */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MousePointer className="w-5 h-5 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Total Clicks</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{totalClicks.toLocaleString()}</p>
          </div>

          {/* Unique Clickers */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Unique Clickers</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">{uniqueClickers.toLocaleString()}</p>
          </div>

          {/* Click-Through Rate */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-gray-500">Click-Through Rate</span>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {clickThroughRate !== null ? `${clickThroughRate}%` : '—'}
            </p>
            {totalRecipients > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {uniqueClickers.toLocaleString()} of {totalRecipients.toLocaleString()} recipients
              </p>
            )}
          </div>
        </div>

        {/* Daily Click Breakdown */}
        {dailyBreakdown.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Daily Click Breakdown</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Clicks</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unique Clickers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {dailyBreakdown.map((day, idx) => (
                    <tr key={day.date} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(day.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {day.totalClicks}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {day.uniqueClickers}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Issues Table */}
        {issueBreakdown.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Newsletter Issues</h2>
              <p className="text-sm text-gray-500 mt-1">
                Ad appeared in {issueBreakdown.length} newsletter{issueBreakdown.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issue Date</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Sent</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Opened</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Open Rate</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Clicks</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unique</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {issueBreakdown.map((issue, idx) => (
                    <tr key={issue.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatDate(issue.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {issue.sentCount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {issue.openedCount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {issue.openRate !== null ? `${issue.openRate}%` : '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {issue.totalClicks}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {issue.uniqueClickers}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* No Data State */}
        {issueBreakdown.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Newsletter Data Yet</h3>
            <p className="text-gray-500">
              This ad hasn't been sent in any newsletters yet. Analytics will appear here once the ad runs.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <p className="text-sm text-gray-500 text-center">
            Ad Analytics Dashboard
          </p>
        </div>
      </footer>
    </div>
  )
}
