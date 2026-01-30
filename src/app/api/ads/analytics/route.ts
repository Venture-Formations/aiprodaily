import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { isIPExcluded, IPExclusion } from '@/lib/ip-utils'

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
    const adModuleFilter = searchParams.get('ad_module') // Filter by ad section/module name
    const startDateParam = searchParams.get('start_date')
    const endDateParam = searchParams.get('end_date')
    const days = parseInt(searchParams.get('days') || '30')
    const excludeIpsParam = searchParams.get('exclude_ips')
    const shouldExcludeIps = excludeIpsParam !== 'false' // Default to true

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

    // Fetch excluded IPs for this publication
    const { data: excludedIpsData } = await supabaseAdmin
      .from('excluded_ips')
      .select('ip_address, is_range, cidr_prefix')
      .eq('publication_id', publicationId)

    const exclusions: IPExclusion[] = (excludedIpsData || []).map(e => ({
      ip_address: e.ip_address,
      is_range: e.is_range || false,
      cidr_prefix: e.cidr_prefix
    }))

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

    // Fetch issue associations from BOTH legacy (issue_advertisements) and new (issue_module_ads) tables
    const adIds = ads.map(ad => ad.id)

    // Legacy table
    const { data: legacyIssueAds, error: legacyError } = await supabaseAdmin
      .from('issue_advertisements')
      .select('id, issue_id, advertisement_id, used_at')
      .in('advertisement_id', adIds)

    if (legacyError) {
      console.error('[Ads Analytics] Error fetching legacy issue advertisements:', legacyError)
    }

    // New module-based table - also fetch ad_module_id to track which section the ad was in
    const { data: moduleIssueAds, error: moduleError } = await supabaseAdmin
      .from('issue_module_ads')
      .select('id, issue_id, advertisement_id, ad_module_id, used_at')
      .in('advertisement_id', adIds)

    if (moduleError) {
      console.error('[Ads Analytics] Error fetching module issue ads:', moduleError)
    }

    // Fetch all ad modules for this publication to build a name lookup
    const { data: adModulesWithIds } = await supabaseAdmin
      .from('ad_modules')
      .select('id, name')
      .eq('publication_id', publicationId)

    // Build module ID -> name map
    const moduleNameMap = new Map<string, string>()
    if (adModulesWithIds) {
      for (const m of adModulesWithIds) {
        moduleNameMap.set(m.id, m.name)
      }
    }

    // Combine both result sets, adding module_name for module-based ads
    const issueAds = [
      ...(legacyIssueAds || []).map((ia: any) => ({ ...ia, ad_module_name: 'Advertorial' })),
      ...(moduleIssueAds || []).map((ia: any) => ({
        ...ia,
        ad_module_name: moduleNameMap.get(ia.ad_module_id) || 'Unknown Section'
      }))
    ]

    console.log(`[Ads Analytics] Found ${legacyIssueAds?.length || 0} legacy + ${moduleIssueAds?.length || 0} module associations`)

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

    // Filter issue_ads by campaigns in date range and optionally by ad module
    const filteredIssueAds = (issueAds || []).filter((issueAd: any) => {
      // Must be in date range
      if (!campaignMap.has(issueAd.issue_id)) return false
      // Filter by ad module if specified
      if (adModuleFilter && adModuleFilter !== 'all' && issueAd.ad_module_name !== adModuleFilter) return false
      return true
    }).map((issueAd: any) => ({
      ...issueAd,
      campaign: campaignMap.get(issueAd.issue_id)
    }))

    console.log(`[Ads Analytics] Filtered to ${filteredIssueAds.length} issue_ads in date range${adModuleFilter && adModuleFilter !== 'all' ? ` (module: ${adModuleFilter})` : ''}`)

    // Get all ad module names for this publication (for link_section matching)
    const { data: adModules } = await supabaseAdmin
      .from('ad_modules')
      .select('name')
      .eq('publication_id', publicationId)

    // Build list of section names to look for (legacy + all module names)
    const adSectionNames = ['Advertorial'] // Legacy name
    if (adModules) {
      for (const module of adModules) {
        if (module.name && !adSectionNames.includes(module.name)) {
          adSectionNames.push(module.name)
        }
      }
    }

    console.log(`[Ads Analytics] Looking for link sections: ${adSectionNames.join(', ')}`)

    // Fetch ALL link clicks for ad-related sections in date range
    // Fetch in batches to avoid pagination limits
    let allLinkClicks: any[] = []
    let hasMore = true
    let offset = 0
    const batchSize = 1000

    while (hasMore) {
      const { data: linkClicksBatch, error: clicksError } = await supabaseAdmin
        .from('link_clicks')
        .select('id, link_url, subscriber_email, issue_date, issue_id, clicked_at, link_section, ip_address')
        .in('link_section', adSectionNames)
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

    // Filter out excluded IPs from analytics (only if enabled)
    const totalFetched = allLinkClicks.length
    const linkClicks = shouldExcludeIps
      ? allLinkClicks.filter(click => !isIPExcluded(click.ip_address, exclusions))
      : allLinkClicks
    const excludedClickCount = shouldExcludeIps ? totalFetched - linkClicks.length : 0

    if (excludedClickCount > 0) {
      console.log(`[Ads Analytics] Filtered ${excludedClickCount} clicks from ${exclusions.length} excluded IP(s)`)
    }

    console.log(`[Ads Analytics] Found ${totalFetched} total clicks, ${linkClicks.length} after IP filtering (exclusion ${shouldExcludeIps ? 'enabled' : 'disabled'})`)

    // Fetch issues in date range for recipient counts (for CTR calculation)
    const { data: issuesRaw, error: issuesError } = await supabaseAdmin
      .from('publication_issues')
      .select(`
        id,
        date,
        email_metrics(*)
      `)
      .eq('publication_id', publicationId)
      .gte('date', startDateStr)
      .lte('date', endDateStr)
      .eq('status', 'sent')

    if (issuesError) {
      console.error('[Ads Analytics] Error fetching issues:', issuesError)
    }

    // Transform email_metrics from array to single object (Supabase returns it as array)
    const issues = (issuesRaw || []).map((issue: any) => ({
      ...issue,
      email_metrics: Array.isArray(issue.email_metrics) && issue.email_metrics.length > 0
        ? issue.email_metrics[0]
        : null
    }))

    console.log(`[Ads Analytics] Found ${issues?.length || 0} issues for CTR calculation`)
    if (issues && issues.length > 0) {
      console.log('[Ads Analytics] Sample issue for CTR:', {
        id: issues[0].id,
        date: issues[0].date,
        email_metrics: issues[0].email_metrics
      })
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

        // Debug logging for first ad
        if (ads.indexOf(ad) === 0) {
          console.log(`[Ads Analytics] CTR Debug for "${ad.title}":`, {
            timesUsedInRange,
            issueIdsCount: issueIds.size,
            totalIssuesAvailable: issues.length,
            totalRecipients,
            uniqueClickers,
            clickThroughRate
          })
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
              ad_section: issueData?.ad_module_name || 'Unknown',
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
        ad_section: issueData.ad_section,
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
          ad_sections: Array.from(new Set(adIssues.map((ia: any) => ia.ad_module_name))),
          by_issue: issueBreakdown
        }
      }
    })

    // Sort by unique clickers descending
    adAnalytics.sort((a, b) => b.metrics.unique_clickers - a.metrics.unique_clickers)

    console.log(`[Ads Analytics] Returned analytics for ${adAnalytics.length} ad(s)`)

    // Build list of available ad modules for filter dropdown
    const availableAdModules = ['Advertorial'] // Legacy section
    if (adModulesWithIds) {
      for (const m of adModulesWithIds) {
        if (m.name && !availableAdModules.includes(m.name)) {
          availableAdModules.push(m.name)
        }
      }
    }

    return NextResponse.json({
      success: true,
      date_range: {
        start: startDateStr,
        end: endDateStr
      },
      ad_modules: availableAdModules,
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
