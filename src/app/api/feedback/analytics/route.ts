import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isIPExcluded, type IPExclusion } from '@/lib/ip-utils'
import { withApiHandler } from '@/lib/api-handler'
import { fetchAllPaginated, getExcludedIPs } from '@/lib/dal'

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

    // Both reads are independent — only depend on publicationId + date range.
    // Run in parallel: feedback_responses dominates latency on a hot dashboard
    // refresh, no point waiting for it sequentially after exclusions.
    type FeedbackResponseRow = {
      id: string
      publication_id: string
      campaign_date: string
      section_choice: string
      ip_address: string
      mailerlite_updated: boolean | null
      created_at: string
    }

    const [exclusionsResult, responsesResult] = await Promise.allSettled([
      shouldExcludeIps
        ? getExcludedIPs(publicationId, 'feedback/analytics:excluded_ips')
        : Promise.resolve<IPExclusion[]>([]),
      // No .order() in the builder — Supabase paginates via offset, and
      // ORDER BY + concurrent inserts can shift rows across page boundaries
      // (duplicates or skips). Sort in-memory after fetch instead.
      fetchAllPaginated<FeedbackResponseRow>(
        () =>
          supabaseAdmin
            .from('feedback_responses')
            .select('id, publication_id, campaign_date, section_choice, ip_address, mailerlite_updated, created_at')
            .eq('publication_id', publicationId!)
            .gte('campaign_date', startDateStr)
            .lte('campaign_date', endDateStr),
        { label: 'feedback/analytics:feedback_responses' },
      ),
    ])

    // getExcludedIPs swallows its own errors, so this branch is defensive only.
    const exclusions: IPExclusion[] =
      exclusionsResult.status === 'fulfilled' ? exclusionsResult.value : []
    const excludedIpCount = exclusions.length

    if (responsesResult.status === 'rejected') {
      const err = responsesResult.reason as any
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

    // Sort by created_at desc in-memory — see the .order() comment on the
    // paginated query above for why we don't sort at the DB layer.
    const responsesRaw = responsesResult.value
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))

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

    // Get most recent responses. Project away ip_address (PII) and
    // publication_id (already known to caller) before serializing.
    const recentResponses = responses.slice(0, 10).map(r => ({
      id: r.id,
      campaign_date: r.campaign_date,
      section_choice: r.section_choice,
      mailerlite_updated: r.mailerlite_updated,
      created_at: r.created_at,
    }))

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
