import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Ads Analytics Endpoint
 * Provides effectiveness metrics for advertisements in newsletters
 *
 * Query Parameters:
 * - publication_id: Required - Filter by publication
 * - ad_id: Optional - Specific ad ID (if not provided, shows all ads or 'all')
 * - start_date: Optional - Start date (YYYY-MM-DD format)
 * - end_date: Optional - End date (YYYY-MM-DD format)
 * - days: Optional - Number of days to look back (default: 30, ignored if start_date provided)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const newsletterSlug = searchParams.get('newsletter_slug')
    const adIdFilter = searchParams.get('ad_id')
    const startDateParam = searchParams.get('start_date')
    const endDateParam = searchParams.get('end_date')
    const days = parseInt(searchParams.get('days') || '30')

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
      console.error('[Ads Analytics] Newsletter not found:', newsletterSlug)
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

    console.log(`[Ads Analytics] Fetching for newsletter_slug=${newsletterSlug}, publication ${publicationId}, date range: ${startDateStr} to ${endDateStr}`)

    // Fetch advertisements for this publication
    let adsQuery = supabaseAdmin
      .from('advertisements')
      .select('id, title, button_url, status, times_used, times_paid, last_used_date, frequency')
      .eq('publication_id', publicationId)
      .in('status', ['active', 'completed'])
      .order('title', { ascending: true })

    if (adIdFilter && adIdFilter !== 'all') {
      adsQuery = adsQuery.eq('id', adIdFilter)
    }

    const { data: ads, error: adsError } = await adsQuery

    if (adsError) {
      console.error('[Ads Analytics] Error fetching ads:', adsError)
      return NextResponse.json({ error: adsError.message }, { status: 500 })
    }

    if (!ads || ads.length === 0) {
      return NextResponse.json({
        ads: [],
        message: 'No advertisements found'
      })
    }

    // Fetch all issue_advertisements for these ads
    const { data: issueAds, error: issueAdsError } = await supabaseAdmin
      .from('issue_advertisements')
      .select('id, issue_id, advertisement_id, used_at')
      .in('advertisement_id', ads.map(ad => ad.id))

    if (issueAdsError) {
      console.error('[Ads Analytics] Error fetching issue advertisements:', issueAdsError)
      return NextResponse.json({ error: issueAdsError.message }, { status: 500 })
    }

    // Fetch campaigns for these issues
    const issueIds = Array.from(new Set((issueAds || []).map((ia: any) => ia.issue_id)))

    const { data: campaigns, error: campaignsError } = await supabaseAdmin
      .from('publication_issues')
      .select('id, date, publication_id, status')
      .in('id', issueIds)
      .eq('publication_id', publicationId)
      .eq('status', 'sent')
      .gte('date', startDateStr)
      .lte('date', endDateStr)

    if (campaignsError) {
      console.error('[Ads Analytics] Error fetching campaigns:', campaignsError)
    }

    const campaignMap = new Map((campaigns || []).map(c => [c.id, c]))

    console.log(`[Ads Analytics] Found ${ads.length} ads, ${issueAds?.length || 0} issue_ads, ${campaigns?.length || 0} campaigns in range`)

    // Filter issue_ads by campaigns in date range
    const filteredIssueAds = (issueAds || []).filter((issueAd: any) => {
      return campaignMap.has(issueAd.issue_id)
    }).map((issueAd: any) => ({
      ...issueAd,
      campaign: campaignMap.get(issueAd.issue_id)
    }))

    console.log(`[Ads Analytics] Filtered to ${filteredIssueAds.length} issue_ads in date range`)

    // Fetch ALL link clicks for Advertorial section in date range
    // Fetch in batches to avoid pagination limits
    let allLinkClicks: any[] = []
    let hasMore = true
    let offset = 0
    const batchSize = 1000

    while (hasMore) {
      const { data: linkClicksBatch, error: clicksError } = await supabaseAdmin
        .from('link_clicks')
        .select('id, link_url, subscriber_email, issue_date, issue_id, clicked_at')
        .eq('link_section', 'Advertorial')
        .gte('issue_date', startDateStr)
        .lte('issue_date', endDateStr)
        .range(offset, offset + batchSize - 1)
        .order('clicked_at', { ascending: false })

      if (clicksError) {
        console.error('[Ads Analytics] Error fetching link clicks:', clicksError)
        return NextResponse.json({ error: clicksError.message }, { status: 500 })
      }

      if (!linkClicksBatch || linkClicksBatch.length === 0) {
        hasMore = false
      } else {
        allLinkClicks = allLinkClicks.concat(linkClicksBatch)
        offset += batchSize
        hasMore = linkClicksBatch.length === batchSize
      }
    }

    const linkClicks = allLinkClicks

    console.log(`[Ads Analytics] Found ${linkClicks?.length || 0} link clicks with section='Advertorial'`)

    // Fetch issues in date range for recipient counts (for CTR calculation)
    const { data: issues, error: issuesError } = await supabaseAdmin
      .from('publication_issues')
      .select('id, date, email_metrics')
      .eq('publication_id', publicationId)
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .eq('status', 'sent')

    if (issuesError) {
      console.error('[Ads Analytics] Error fetching issues:', issuesError)
    }

    // Build analytics for each ad
    const adAnalytics = ads.map(ad => {
      // Count issues where this ad was used
      const adIssues = filteredIssueAds.filter((ia: any) => ia.advertisement_id === ad.id)
      const timesUsedInRange = adIssues.length

      // Get unique issue IDs and dates
      const issueIds = new Set(adIssues.map((ia: any) => ia.issue_id))
      const issueDates = Array.from(new Set(adIssues.map((ia: any) => ia.campaign?.date).filter(Boolean))).sort()

      // Match clicks to this ad by URL or by issue
      // Since multiple ads might share similar URLs, we'll match by issue_id where the ad was used
      if (adIssues.length > 0) {
        console.log(`[Ads Analytics] Ad "${ad.title}": ${adIssues.length} issues, dates: ${issueDates.join(', ')}`)
      }

      const adClicks = (linkClicks || []).filter(click => {
        // First try to match by issue - this is the most accurate method
        if (click.issue_id && issueIds.has(click.issue_id)) {
          return true
        }

        // Fallback: match by URL if button_url is available
        if (ad.button_url && click.link_url) {
          // Normalize both URLs by removing protocol, www, and trailing slashes
          const normalizeUrl = (url: string) => {
            return url.toLowerCase()
              .replace(/^https?:\/\//, '')
              .replace(/^www\./, '')
              .replace(/\/$/, '')
              .trim()
          }

          const normalizedClickUrl = normalizeUrl(click.link_url)
          const normalizedAdUrl = normalizeUrl(ad.button_url)

          // Check if URLs match exactly or if one contains the other
          return normalizedClickUrl === normalizedAdUrl ||
                 normalizedClickUrl.includes(normalizedAdUrl) ||
                 normalizedAdUrl.includes(normalizedClickUrl)
        }

        return false
      })

      const totalClicks = adClicks.length
      const uniqueClickers = new Set(adClicks.map(click => click.subscriber_email)).size

      // Calculate CTR (unique clickers / total recipients who saw this ad)
      let clickThroughRate: number | null = null
      let totalRecipients = 0

      if (timesUsedInRange > 0 && issues) {
        // Sum up recipients from issues where this ad appeared
        issues.forEach(issue => {
          if (issueIds.has(issue.id) && issue.email_metrics?.sent_count) {
            totalRecipients += issue.email_metrics.sent_count
          }
        })

        if (totalRecipients > 0) {
          clickThroughRate = Math.round((uniqueClickers / totalRecipients) * 10000) / 100 // 2 decimal places
        }
      }

      // Get clicks per issue for detailed breakdown
      const clicksByIssue: Record<string, any> = {}
      adClicks.forEach(click => {
        if (click.issue_id && issueIds.has(click.issue_id)) {
          if (!clicksByIssue[click.issue_id]) {
            const issueData = adIssues.find((ia: any) => ia.issue_id === click.issue_id)
            clicksByIssue[click.issue_id] = {
              issue_id: click.issue_id,
              issue_date: issueData?.campaign?.date || click.issue_date,
              clicks: [],
              total_clicks: 0,
              unique_clickers: new Set()
            }
          }

          clicksByIssue[click.issue_id].clicks.push(click)
          clicksByIssue[click.issue_id].total_clicks++
          clicksByIssue[click.issue_id].unique_clickers.add(click.subscriber_email)
        }
      })

      // Convert unique clickers set to count
      const issueBreakdown = Object.values(clicksByIssue).map((issueData: any) => ({
        issue_id: issueData.issue_id,
        issue_date: issueData.issue_date,
        total_clicks: issueData.total_clicks,
        unique_clickers: issueData.unique_clickers.size
      })).sort((a, b) => (b.issue_date || '').localeCompare(a.issue_date || ''))

      return {
        ad_id: ad.id,
        ad_title: ad.title,
        button_url: ad.button_url,
        status: ad.status,
        frequency: ad.frequency,
        lifetime_times_used: ad.times_used,
        times_paid: ad.times_paid,
        last_used_date: ad.last_used_date,
        metrics: {
          times_used_in_range: timesUsedInRange,
          issue_dates: issueDates,
          unique_clickers: uniqueClickers,
          total_clicks: totalClicks,
          click_through_rate: clickThroughRate,
          total_recipients: totalRecipients > 0 ? totalRecipients : null,
          by_issue: issueBreakdown
        }
      }
    })

    // Sort by unique clickers descending
    adAnalytics.sort((a, b) => b.metrics.unique_clickers - a.metrics.unique_clickers)

    console.log(`[Ads Analytics] Returned analytics for ${adAnalytics.length} ad(s)`)

    return NextResponse.json({
      success: true,
      date_range: {
        start: startDateStr,
        end: endDateStr
      },
      ads: adAnalytics
    })

  } catch (error) {
    console.error('[Ads Analytics] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
