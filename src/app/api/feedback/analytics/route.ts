import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isIPExcluded, IPExclusion } from '@/lib/ip-utils'
import { withApiHandler } from '@/lib/api-handler'
import { fetchAllPaginated } from '@/lib/dal/paginate'

export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'feedback/analytics' },
  async ({ request }) => {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    let publicationId = searchParams.get('publication_id')
    const newsletterSlug = searchParams.get('newsletter_slug')
    const excludeIpsParam = searchParams.get('exclude_ips')
    const shouldExcludeIps = excludeIpsParam !== 'false' // Default to true

    // Resolve publication_id from slug if not provided directly
    if (!publicationId && newsletterSlug) {
      const { data: pub } = await supabaseAdmin
        .from('publications')
        .select('id')
        .eq('slug', newsletterSlug)
        .single()
      if (pub) publicationId = pub.id
    }

    if (!publicationId) {
      return NextResponse.json({ error: 'publication_id or newsletter_slug is required' }, { status: 400 })
    }

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`
    const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`

    console.log(`[Feedback Analytics] Fetching for last ${days} days (${startDateStr} to ${endDateStr})`)

    // Fetch excluded IPs if publication_id provided
    let exclusions: IPExclusion[] = []
    let excludedIpCount = 0

    if (publicationId && shouldExcludeIps) {
      try {
        const excludedIpsData = await fetchAllPaginated<{
          ip_address: string
          is_range: boolean | null
          cidr_prefix: number | null
        }>(
          () =>
            supabaseAdmin
              .from('excluded_ips')
              .select('ip_address, is_range, cidr_prefix')
              .eq('publication_id', publicationId!),
          { label: 'feedback/analytics:excluded_ips' },
        )

        exclusions = excludedIpsData.map(e => ({
          ip_address: e.ip_address,
          is_range: e.is_range || false,
          cidr_prefix: e.cidr_prefix
        }))
        excludedIpCount = exclusions.length
      } catch (err) {
        console.error('[Feedback Analytics] Failed to fetch excluded IPs:', err)
        // Continue with empty exclusions — analytics still useful, just not IP-filtered
      }
    }

    // Fetch feedback responses within date range, scoped to publication.
    // Paginated past Supabase's 1000-row default — section/daily aggregates
    // depend on the full set; truncation silently corrupts those metrics.
    let responsesRaw: Array<{
      id: string
      publication_id: string
      campaign_date: string
      section_choice: string
      ip_address: string
      mailerlite_updated: boolean | null
      created_at: string
    }> = []

    try {
      responsesRaw = await fetchAllPaginated<typeof responsesRaw[number]>(
        () =>
          supabaseAdmin
            .from('feedback_responses')
            .select('id, publication_id, campaign_date, section_choice, ip_address, mailerlite_updated, created_at')
            .eq('publication_id', publicationId!)
            .gte('campaign_date', startDateStr)
            .lte('campaign_date', endDateStr)
            .order('created_at', { ascending: false }),
        { label: 'feedback/analytics:feedback_responses' },
      )
    } catch (err: any) {
      console.error('[Feedback Analytics] Error fetching responses:', err)
      // If table doesn't exist or other DB error, return empty analytics
      const isMissingTable =
        err?.code === 'PGRST116' ||
        err?.code === '42P01' ||
        err?.message?.includes('relation') ||
        err?.message?.includes('does not exist') ||
        err?.message?.includes('feedback_responses')

      if (isMissingTable) {
        console.log('[Feedback Analytics] Table not found - returning empty analytics')
        return NextResponse.json({
          success: true,
          analytics: {
            totalResponses: 0,
            successfulSyncs: 0,
            syncSuccessRate: 0,
            sectionCounts: {},
            dailyResponses: {},
            recentResponses: [],
            dateRange: { start: startDateStr, end: endDateStr },
            ipExclusion: { enabled: shouldExcludeIps, excludedCount: 0, filteredResponses: 0 }
          }
        })
      }
      return NextResponse.json({ error: err?.message ?? 'unknown error' }, { status: 500 })
    }

    // Filter out excluded IPs from analytics
    const responses = shouldExcludeIps && exclusions.length > 0
      ? responsesRaw.filter(r => !isIPExcluded(r.ip_address, exclusions))
      : responsesRaw
    const excludedResponseCount = responsesRaw.length - responses.length

    if (excludedResponseCount > 0) {
      console.log(`[Feedback Analytics] Filtered ${excludedResponseCount} responses from ${excludedIpCount} excluded IP(s)`)
    }

    // Calculate section popularity
    const sectionCounts: { [key: string]: number } = {}
    responses.forEach(response => {
      sectionCounts[response.section_choice] = (sectionCounts[response.section_choice] || 0) + 1
    })

    // Calculate daily response counts
    const dailyResponses: { [key: string]: number } = {}
    responses.forEach(response => {
      const date = response.campaign_date
      dailyResponses[date] = (dailyResponses[date] || 0) + 1
    })

    // Calculate MailerLite sync success rate
    const totalResponses = responses.length
    const successfulSyncs = responses.filter(r => r.mailerlite_updated).length
    const syncSuccessRate = totalResponses > 0 ? (successfulSyncs / totalResponses) * 100 : 0

    // Get most recent responses
    const recentResponses = responses.slice(0, 10)

    return NextResponse.json({
      success: true,
      analytics: {
        totalResponses,
        successfulSyncs,
        syncSuccessRate,
        sectionCounts,
        dailyResponses,
        recentResponses,
        dateRange: { start: startDateStr, end: endDateStr },
        ipExclusion: {
          enabled: shouldExcludeIps,
          excludedCount: excludedIpCount,
          filteredResponses: excludedResponseCount
        }
      }
    })
  }
)
