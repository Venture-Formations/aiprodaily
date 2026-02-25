import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isIPExcluded, IPExclusion } from '@/lib/ip-utils'
import { withApiHandler } from '@/lib/api-handler'

export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'feedback/analytics' },
  async ({ request }) => {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')
    const publicationId = searchParams.get('publication_id')
    const excludeIpsParam = searchParams.get('exclude_ips')
    const shouldExcludeIps = excludeIpsParam !== 'false' // Default to true

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
      const { data: excludedIpsData } = await supabaseAdmin
        .from('excluded_ips')
        .select('ip_address, is_range, cidr_prefix')
        .eq('publication_id', publicationId)

      exclusions = (excludedIpsData || []).map(e => ({
        ip_address: e.ip_address,
        is_range: e.is_range || false,
        cidr_prefix: e.cidr_prefix
      }))
      excludedIpCount = exclusions.length
    }

    // Fetch feedback responses within date range
    let query = supabaseAdmin
      .from('feedback_responses')
      .select('*')
      .gte('campaign_date', startDateStr)
      .lte('campaign_date', endDateStr)
      .order('created_at', { ascending: false })

    // Filter by publication_id if provided
    if (publicationId) {
      query = query.eq('publication_id', publicationId)
    }

    const { data: responsesRaw, error } = await query

    if (error) {
      console.error('[Feedback Analytics] Error fetching responses:', error)
      // If table doesn't exist or other DB error, return empty analytics
      const isMissingTable =
        error.code === 'PGRST116' ||
        error.code === '42P01' ||
        error.message?.includes('relation') ||
        error.message?.includes('does not exist') ||
        error.message?.includes('feedback_responses')

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
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Filter out excluded IPs from analytics
    const responses = shouldExcludeIps && exclusions.length > 0
      ? (responsesRaw || []).filter(r => !isIPExcluded(r.ip_address, exclusions))
      : (responsesRaw || [])
    const excludedResponseCount = (responsesRaw?.length || 0) - responses.length

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
