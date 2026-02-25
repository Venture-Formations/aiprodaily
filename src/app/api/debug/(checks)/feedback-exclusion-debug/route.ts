import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { isIPExcluded, IPExclusion } from '@/lib/ip-utils'

/**
 * Debug endpoint to investigate feedback vote filtering
 * GET /api/debug/feedback-exclusion-debug?publication_id=...
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(checks)/feedback-exclusion-debug' },
  async ({ request, logger }) => {
    const { searchParams } = new URL(request.url)
    const publicationId = searchParams.get('publication_id')

    if (!publicationId) {
      return NextResponse.json({ error: 'publication_id required' }, { status: 400 })
    }

    // Get all excluded IPs with their sources
    const { data: excludedIps } = await supabaseAdmin
      .from('excluded_ips')
      .select('ip_address, is_range, cidr_prefix, exclusion_source, reason, added_by')
      .eq('publication_id', publicationId)

    // Group by exclusion_source
    const bySource: Record<string, number> = {}
    for (const ip of excludedIps || []) {
      const source = ip.exclusion_source || 'null'
      bySource[source] = (bySource[source] || 0) + 1
    }

    // Get feedback module
    const { data: module } = await supabaseAdmin
      .from('feedback_modules')
      .select('id')
      .eq('publication_id', publicationId)
      .eq('is_active', true)
      .single()

    if (!module) {
      return NextResponse.json({
        error: 'No active feedback module',
        excludedIpsBySource: bySource,
        totalExcludedIps: excludedIps?.length || 0
      })
    }

    // Get recent feedback votes with IPs
    const { data: votes } = await supabaseAdmin
      .from('feedback_votes')
      .select('id, subscriber_email, ip_address, selected_value, voted_at, campaign_date')
      .eq('feedback_module_id', module.id)
      .order('voted_at', { ascending: false })
      .limit(50)

    // Build exclusion list
    const exclusions: IPExclusion[] = (excludedIps || []).map(e => ({
      ip_address: e.ip_address,
      is_range: e.is_range || false,
      cidr_prefix: e.cidr_prefix
    }))

    // Analyze each vote
    const voteAnalysis = (votes || []).map(vote => {
      const excluded = isIPExcluded(vote.ip_address, exclusions)
      const matchingExclusion = excluded
        ? excludedIps?.find(e => e.ip_address === vote.ip_address)
        : null

      return {
        email: vote.subscriber_email,
        ip: vote.ip_address,
        rating: vote.selected_value,
        date: vote.campaign_date,
        isExcluded: excluded,
        exclusionSource: matchingExclusion?.exclusion_source || null,
        exclusionReason: matchingExclusion?.reason || null
      }
    })

    const visibleVotes = voteAnalysis.filter(v => !v.isExcluded)
    const excludedVotes = voteAnalysis.filter(v => v.isExcluded)

    return NextResponse.json({
      summary: {
        totalExcludedIps: excludedIps?.length || 0,
        excludedIpsBySource: bySource,
        totalVotesChecked: voteAnalysis.length,
        visibleVotes: visibleVotes.length,
        excludedVotes: excludedVotes.length
      },
      visibleVotes: visibleVotes.slice(0, 20),
      excludedVotes: excludedVotes.slice(0, 20),
      allExcludedIps: (excludedIps || []).slice(0, 50).map(ip => ({
        ip: ip.ip_address,
        source: ip.exclusion_source,
        reason: ip.reason?.substring(0, 50)
      }))
    })
  }
)
