import { supabaseAdmin } from '@/lib/supabase'
import { toProjectDateStr } from '@/lib/date-utils'
import { isIPExcluded, type IPExclusion } from '@/lib/ip-utils'

export interface AdData {
  id: string
  title: string
  body: string
  image_url: string | null
  image_alt: string | null
  button_text: string | null
  button_url: string | null
  cta_text: string | null
  status: string
  company_name: string | null
  publication_id: string
  times_used: number
  created_at: string
  ad_module_id: string | null
}

export interface IssueBreakdownItem {
  id: string
  date: string
  sentCount: number
  openedCount: number
  openRate: number | null
  totalClicks: number
  uniqueClickers: number
}

export interface DailyBreakdownItem {
  date: string
  totalClicks: number
  uniqueClickers: number
}

export interface AdAnalyticsData {
  ad: AdData
  showButton: boolean
  totalClicks: number
  uniqueClickers: number
  totalRecipients: number
  clickThroughRate: number | null
  dailyBreakdown: DailyBreakdownItem[]
  issueBreakdown: IssueBreakdownItem[]
}

export async function checkShowButton(ad: AdData): Promise<boolean> {
  if (!ad.ad_module_id) return true
  const { data: adModule } = await supabaseAdmin
    .from('ad_modules')
    .select('block_order')
    .eq('id', ad.ad_module_id)
    .single()

  if (adModule?.block_order) {
    const blockOrder = Array.isArray(adModule.block_order) ? adModule.block_order : []
    return blockOrder.includes('button')
  }
  return true
}

export async function fetchIssueIds(adId: string): Promise<string[]> {
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

  return Array.from(new Set(issueAds.map(ia => ia.issue_id)))
}

export async function fetchIssuesWithMetrics(issueIds: string[]) {
  if (issueIds.length === 0) return []

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

  return (issuesData || []).map((issue: any) => ({
    ...issue,
    email_metrics: Array.isArray(issue.email_metrics) && issue.email_metrics.length > 0
      ? issue.email_metrics[0]
      : null
  }))
}

export async function fetchAdClicks(
  issueIds: string[],
  publicationId: string,
  buttonUrl: string | null
) {
  if (issueIds.length === 0) return []

  // Get ad module names for link_section matching
  const { data: adModules } = await supabaseAdmin
    .from('ad_modules')
    .select('name')
    .eq('publication_id', publicationId)

  const adSectionNames = ['Advertorial']
  if (adModules) {
    for (const adModule of adModules) {
      if (adModule.name && !adSectionNames.includes(adModule.name)) {
        adSectionNames.push(adModule.name)
      }
    }
  }

  // Fetch excluded IPs
  const { data: excludedIpsData } = await supabaseAdmin
    .from('excluded_ips')
    .select('ip_address, is_range, cidr_prefix')
    .eq('publication_id', publicationId)

  const exclusions: IPExclusion[] = (excludedIpsData || []).map(e => ({
    ip_address: e.ip_address,
    is_range: e.is_range || false,
    cidr_prefix: e.cidr_prefix
  }))

  // Fetch link clicks
  const { data: clicksData } = await supabaseAdmin
    .from('link_clicks')
    .select('id, subscriber_email, issue_id, issue_date, clicked_at, link_url, ip_address, is_bot_ua')
    .in('issue_id', issueIds)
    .in('link_section', adSectionNames)
    .order('clicked_at', { ascending: false })

  const linkClicks = (clicksData || []).filter(click =>
    !click.is_bot_ua && !isIPExcluded(click.ip_address, exclusions)
  )

  // Filter clicks that match this ad
  const issueIdSet = new Set(issueIds)
  const normalizeUrl = (url: string) =>
    url.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').trim()

  return linkClicks.filter(click => {
    if (click.issue_id && issueIdSet.has(click.issue_id)) return true
    if (buttonUrl && click.link_url) {
      const normalizedClickUrl = normalizeUrl(click.link_url)
      const normalizedAdUrl = normalizeUrl(buttonUrl)
      return normalizedClickUrl === normalizedAdUrl ||
             normalizedClickUrl.includes(normalizedAdUrl) ||
             normalizedAdUrl.includes(normalizedClickUrl)
    }
    return false
  })
}

export function computeAnalytics(
  adClicks: any[],
  issues: any[],
  issueIds: string[]
): { totalClicks: number; uniqueClickers: number; totalRecipients: number; clickThroughRate: number | null; dailyBreakdown: DailyBreakdownItem[]; issueBreakdown: IssueBreakdownItem[] } {
  const totalClicks = adClicks.length
  const uniqueClickers = new Set(adClicks.map(click => click.subscriber_email)).size

  let totalRecipients = 0
  issues.forEach(issue => {
    if (issue.email_metrics?.sent_count) totalRecipients += issue.email_metrics.sent_count
  })
  const clickThroughRate = totalRecipients > 0
    ? Math.round((uniqueClickers / totalRecipients) * 10000) / 100
    : null

  // Daily breakdown
  const clicksByDate = new Map<string, { total: number; unique: Set<string> }>()
  adClicks.forEach(click => {
    const date = toProjectDateStr(click.clicked_at)
    if (!clicksByDate.has(date)) clicksByDate.set(date, { total: 0, unique: new Set() })
    const dayData = clicksByDate.get(date)!
    dayData.total++
    dayData.unique.add(click.subscriber_email)
  })

  const dailyBreakdown = Array.from(clicksByDate.entries())
    .map(([date, data]) => ({ date, totalClicks: data.total, uniqueClickers: data.unique.size }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 14)

  // Per-issue breakdown
  const issueIdSet = new Set(issueIds)
  const clicksByIssue = new Map<string, { total: number; unique: Set<string> }>()
  adClicks.forEach(click => {
    if (click.issue_id && issueIdSet.has(click.issue_id)) {
      if (!clicksByIssue.has(click.issue_id)) clicksByIssue.set(click.issue_id, { total: 0, unique: new Set() })
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

  return { totalClicks, uniqueClickers, totalRecipients, clickThroughRate, dailyBreakdown, issueBreakdown }
}

export function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}
