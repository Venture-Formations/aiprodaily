import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * AI Apps Analytics Endpoint
 * Provides effectiveness metrics for AI applications in newsletters
 *
 * Query Parameters:
 * - publication_id: Required - Filter by publication
 * - affiliate: Optional - Filter by affiliate status ('true', 'false', or 'all')
 * - category: Optional - Filter by category
 * - tool_type: Optional - Filter by tool type ('Client' or 'Firm')
 * - start_date: Optional - Start date (YYYY-MM-DD format)
 * - end_date: Optional - End date (YYYY-MM-DD format)
 * - days: Optional - Number of days to look back (default: 7, ignored if start_date provided)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const newsletterSlug = searchParams.get('newsletter_slug')
    const affiliateFilter = searchParams.get('affiliate')
    const categoryFilter = searchParams.get('category')
    const toolTypeFilter = searchParams.get('tool_type')
    const startDateParam = searchParams.get('start_date')
    const endDateParam = searchParams.get('end_date')
    const days = parseInt(searchParams.get('days') || '7')

    if (!newsletterSlug) {
      return NextResponse.json(
        { error: 'newsletter_slug is required' },
        { status: 400 }
      )
    }

    // Get publication_id from slug (REQUIRED for multi-tenant isolation)
    const { data: newsletter, error: newsletterError } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('slug', newsletterSlug)
      .single()

    if (newsletterError || !newsletter) {
      console.error('[AI Apps Analytics] Newsletter not found:', newsletterSlug)
      return NextResponse.json(
        { error: 'Newsletter not found' },
        { status: 404 }
      )
    }

    const publicationId = newsletter.id

    // Calculate date range using local timezone (NO UTC - per CLAUDE.md)
    let startDateStr: string
    let endDateStr: string

    if (startDateParam && endDateParam) {
      startDateStr = startDateParam
      endDateStr = endDateParam
    } else {
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
      endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
    }

    console.log(`[AI Apps Analytics] Fetching for publication ${publicationId}, date range: ${startDateStr} to ${endDateStr}`)

    // Fetch AI applications with optional filters
    let appsQuery = supabaseAdmin
      .from('ai_applications')
      .select('id, app_name, category, tool_type, app_url, is_affiliate, is_active, times_used, last_used_date')
      .eq('publication_id', publicationId)
      .eq('is_active', true)
      .order('app_name', { ascending: true })

    if (affiliateFilter && affiliateFilter !== 'all') {
      appsQuery = appsQuery.eq('is_affiliate', affiliateFilter === 'true')
    }

    if (categoryFilter && categoryFilter !== 'all') {
      appsQuery = appsQuery.eq('category', categoryFilter)
    }

    if (toolTypeFilter && toolTypeFilter !== 'all') {
      appsQuery = appsQuery.eq('tool_type', toolTypeFilter)
    }

    const { data: apps, error: appsError } = await appsQuery

    if (appsError) {
      console.error('[AI Apps Analytics] Error fetching apps:', appsError)
      return NextResponse.json({ error: appsError.message }, { status: 500 })
    }

    if (!apps || apps.length === 0) {
      return NextResponse.json({
        apps: [],
        message: 'No AI applications found'
      })
    }

    // Fetch all issue_ai_app_selections in date range to count usage
    const { data: issueSelections, error: selectionsError } = await supabaseAdmin
      .from('issue_ai_app_selections')
      .select(`
        id,
        issue_id,
        app_id,
        newsletter_campaigns!inner(id, date, publication_id, status)
      `)
      .in('app_id', apps.map(app => app.id))

    if (selectionsError) {
      console.error('[AI Apps Analytics] Error fetching issue selections:', selectionsError)
      return NextResponse.json({ error: selectionsError.message }, { status: 500 })
    }

    // Filter selections by date range and publication
    const filteredSelections = (issueSelections || []).filter((selection: any) => {
      const campaign = selection.newsletter_campaigns
      if (!campaign || campaign.publication_id !== publicationId) return false
      if (campaign.status !== 'sent') return false

      const issueDate = campaign.date
      return issueDate >= startDateStr && issueDate <= endDateStr
    })

    // Fetch link clicks for AI Apps section in date range
    const { data: linkClicks, error: clicksError } = await supabaseAdmin
      .from('link_clicks')
      .select('id, link_url, subscriber_email, issue_date, clicked_at')
      .eq('link_section', 'AI Apps')
      .gte('issue_date', startDateStr)
      .lte('issue_date', endDateStr)

    if (clicksError) {
      console.error('[AI Apps Analytics] Error fetching link clicks:', clicksError)
      return NextResponse.json({ error: clicksError.message }, { status: 500 })
    }

    // Fetch issues in date range for recipient counts (for CTR calculation)
    const { data: issues, error: issuesError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, date, metrics')
      .eq('publication_id', publicationId)
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .eq('status', 'sent')

    if (issuesError) {
      console.error('[AI Apps Analytics] Error fetching issues:', issuesError)
    }

    // Build analytics for each app
    const appAnalytics = apps.map(app => {
      // Count issues where this app was included
      const appIssues = filteredSelections.filter((sel: any) => sel.app_id === app.id)
      const issuesUsedIn = appIssues.length

      // Get unique issue IDs and dates
      const issueIds = new Set(appIssues.map((sel: any) => sel.issue_id))
      const issueDates = Array.from(new Set(appIssues.map((sel: any) => {
        const campaign = Array.isArray(sel.newsletter_campaigns) ? sel.newsletter_campaigns[0] : sel.newsletter_campaigns
        return campaign.date
      }))).sort()

      // Match clicks to this app by URL
      // The link_url in link_clicks should contain or match the app_url
      const appClicks = (linkClicks || []).filter(click => {
        // Extract the destination URL from the tracking URL
        try {
          const clickUrl = new URL(click.link_url)
          const destUrl = clickUrl.searchParams.get('url')

          // Check if destination URL matches app URL (handle with/without trailing slashes and protocols)
          if (destUrl && app.app_url) {
            const normalizedDestUrl = destUrl.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
            const normalizedAppUrl = app.app_url.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '')
            return normalizedDestUrl === normalizedAppUrl || normalizedDestUrl.includes(normalizedAppUrl)
          }
        } catch (e) {
          // If URL parsing fails, try simple string matching
          return click.link_url.toLowerCase().includes(app.app_url.toLowerCase())
        }
        return false
      })

      const totalClicks = appClicks.length
      const uniqueClickers = new Set(appClicks.map(click => click.subscriber_email)).size

      // Calculate CTR (unique clickers / total recipients who saw this app)
      let clickThroughRate: number | null = null
      let totalRecipients = 0

      if (issuesUsedIn > 0 && issues) {
        // Sum up recipients from issues where this app appeared
        issues.forEach(issue => {
          if (issueIds.has(issue.id) && issue.metrics?.sent_count) {
            totalRecipients += issue.metrics.sent_count
          }
        })

        if (totalRecipients > 0) {
          clickThroughRate = Math.round((uniqueClickers / totalRecipients) * 10000) / 100 // 2 decimal places
        }
      }

      return {
        app_id: app.id,
        app_name: app.app_name,
        category: app.category,
        tool_type: app.tool_type,
        is_affiliate: app.is_affiliate,
        app_url: app.app_url,
        metrics: {
          issues_used: issuesUsedIn,
          issue_dates: issueDates,
          unique_clickers: uniqueClickers,
          total_clicks: totalClicks,
          click_through_rate: clickThroughRate,
          total_recipients: totalRecipients > 0 ? totalRecipients : null
        }
      }
    })

    // Sort by unique clickers (primary metric) descending
    appAnalytics.sort((a, b) => b.metrics.unique_clickers - a.metrics.unique_clickers)

    console.log(`[AI Apps Analytics] Returned analytics for ${appAnalytics.length} app(s)`)

    return NextResponse.json({
      success: true,
      date_range: {
        start: startDateStr,
        end: endDateStr
      },
      filters: {
        affiliate: affiliateFilter || 'all',
        category: categoryFilter || 'all',
        tool_type: toolTypeFilter || 'all'
      },
      apps: appAnalytics
    })

  } catch (error) {
    console.error('[AI Apps Analytics] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
