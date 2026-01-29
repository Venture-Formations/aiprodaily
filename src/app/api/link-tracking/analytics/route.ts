import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { isIPExcluded, IPExclusion } from '@/lib/ip-utils'

/**
 * Link Click Analytics Endpoint
 * Provides aggregated click tracking data for the analytics dashboard
 *
 * Query Parameters:
 * - newsletter_slug: Required - Filter by publication (multi-tenant isolation)
 * - days: Number of days to look back (default: 30)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const newsletterSlug = searchParams.get('newsletter_slug')
    const days = parseInt(searchParams.get('days') || '30')

    // Get publication_id from slug (REQUIRED for multi-tenant isolation)
    let publicationId: string | null = null

    if (newsletterSlug) {
      const { data: newsletter, error: newsletterError } = await supabaseAdmin
        .from('publications')
        .select('id')
        .eq('slug', newsletterSlug)
        .single()

      if (newsletterError || !newsletter) {
        console.error('[Link Analytics] Newsletter not found:', newsletterSlug)
        return NextResponse.json(
          { error: 'Newsletter not found' },
          { status: 404 }
        )
      }
      publicationId = newsletter.id
    }

    // Fetch excluded IPs for this publication (if we have a publication_id)
    let exclusions: IPExclusion[] = []
    if (publicationId) {
      const { data: excludedIpsData } = await supabaseAdmin
        .from('excluded_ips')
        .select('ip_address, is_range, cidr_prefix')
        .eq('publication_id', publicationId)

      exclusions = (excludedIpsData || []).map(e => ({
        ip_address: e.ip_address,
        is_range: e.is_range || false,
        cidr_prefix: e.cidr_prefix
      }))
    }

    // Calculate date range using local timezone
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Use local date strings (NO UTC conversion - per CLAUDE.md)
    const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
    const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`

    console.log(`[Link Analytics] Fetching for ${newsletterSlug || 'all'}, date range: ${startDateStr} to ${endDateStr}`)

    // Fetch ALL link clicks within date range using pagination (Supabase has 1000 row limit per query)
    const BATCH_SIZE = 1000
    let allClicks: any[] = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
      let query = supabaseAdmin
        .from('link_clicks')
        .select('*')
        .gte('issue_date', startDateStr)
        .lte('issue_date', endDateStr)
        .order('clicked_at', { ascending: false })

      // Filter by publication_id if available
      if (publicationId) {
        query = query.eq('publication_id', publicationId)
      }

      const { data: clicks, error } = await query.range(offset, offset + BATCH_SIZE - 1)

      if (error) {
        console.error('Error fetching link clicks:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      if (clicks && clicks.length > 0) {
        allClicks = allClicks.concat(clicks)
        offset += BATCH_SIZE
        hasMore = clicks.length === BATCH_SIZE // Continue if we got a full batch
      } else {
        hasMore = false
      }
    }

    const totalFetched = allClicks.length

    // Filter out excluded IPs from analytics (clicks are still recorded, just not counted)
    // Supports both single IPs and CIDR ranges
    const clicks = allClicks.filter(click =>
      !isIPExcluded(click.ip_address, exclusions)
    )
    const excludedClickCount = totalFetched - clicks.length

    if (excludedClickCount > 0) {
      console.log(`[Link Analytics] Filtered ${excludedClickCount} clicks from ${exclusions.length} excluded IP(s)`)
    }

    console.log(`[Link Analytics] Fetched ${totalFetched} total clicks, ${clicks.length} after IP filtering`)

    // Calculate total clicks
    const totalClicks = clicks?.length || 0

    // Calculate clicks by section
    const clicksBySection: { [key: string]: number } = {}
    clicks?.forEach(click => {
      clicksBySection[click.link_section] = (clicksBySection[click.link_section] || 0) + 1
    })

    // Calculate unique users by section
    const uniqueUsersBySection: { [key: string]: Set<string> } = {}
    clicks?.forEach(click => {
      if (!uniqueUsersBySection[click.link_section]) {
        uniqueUsersBySection[click.link_section] = new Set()
      }
      uniqueUsersBySection[click.link_section].add(click.subscriber_email)
    })

    const uniqueUsersCount: { [key: string]: number } = {}
    Object.keys(uniqueUsersBySection).forEach(section => {
      uniqueUsersCount[section] = uniqueUsersBySection[section].size
    })

    // Calculate daily click counts
    const dailyClicks: { [key: string]: number } = {}
    clicks?.forEach(click => {
      const date = click.issue_date
      dailyClicks[date] = (dailyClicks[date] || 0) + 1
    })

    // Calculate top clicked URLs with unique users
    const urlClickCounts: { [key: string]: { count: number; section: string; uniqueUsers: Set<string> } } = {}
    clicks?.forEach(click => {
      if (!urlClickCounts[click.link_url]) {
        urlClickCounts[click.link_url] = { count: 0, section: click.link_section, uniqueUsers: new Set() }
      }
      urlClickCounts[click.link_url].count++
      urlClickCounts[click.link_url].uniqueUsers.add(click.subscriber_email)
    })

    const topUrls = Object.entries(urlClickCounts)
      .map(([url, data]) => ({
        url,
        section: data.section,
        clicks: data.count,
        unique_users: data.uniqueUsers.size
      }))
      .sort((a, b) => b.unique_users - a.unique_users)
      .slice(0, 10)

    // Calculate click-through rate by issue
    const clicksByissue: { [key: string]: number } = {}
    clicks?.forEach(click => {
      const issueId = click.issue_id || click.issue_date
      clicksByissue[issueId] = (clicksByissue[issueId] || 0) + 1
    })

    // Get recent clicks for display
    const recentClicks = clicks?.slice(0, 20).map(click => ({
      issue_date: click.issue_date,
      link_section: click.link_section,
      link_url: click.link_url,
      clicked_at: click.clicked_at
    }))

    // Calculate unique users overall
    const uniqueUsers = new Set(clicks?.map(c => c.subscriber_email) || []).size

    return NextResponse.json({
      success: true,
      analytics: {
        totalClicks,
        uniqueUsers,
        clicksBySection,
        uniqueUsersBySection: uniqueUsersCount,
        dailyClicks,
        topUrls,
        clicksByissue,
        recentClicks,
        dateRange: {
          start: startDateStr,
          end: endDateStr
        },
        excluded_ips: publicationId ? {
          count: exclusions.length,
          filtered_clicks: excludedClickCount
        } : null
      }
    })

  } catch (error) {
    console.error('Link click analytics error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
