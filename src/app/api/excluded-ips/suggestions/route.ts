import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { isIPExcluded, IPExclusion } from '@/lib/ip-utils'
import { getKnownIPRange, getKnownRangesByOrganization, KnownIPRange } from '@/lib/known-ip-ranges'

/**
 * GET - Get suggested IPs to exclude based on suspicious patterns
 *
 * Suspicious patterns detected in both polls and link clicks:
 * 1. Multiple different emails from the same IP within a short time window
 *    (indicates email security scanners like Barracuda, Mimecast, Proofpoint)
 * 2. High volume of activity from a single IP
 *
 * Query params: publication_id (required)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const publicationId = searchParams.get('publication_id')

    if (!publicationId) {
      return NextResponse.json(
        { error: 'publication_id is required' },
        { status: 400 }
      )
    }

    // Get already excluded IPs to filter them out of suggestions
    // Use pagination since Supabase limits to 1000 rows per query
    const BATCH_SIZE = 1000
    let excludedIpsData: any[] = []
    let excludedOffset = 0
    let excludedHasMore = true

    while (excludedHasMore) {
      const { data: batch } = await supabaseAdmin
        .from('excluded_ips')
        .select('ip_address, is_range, cidr_prefix')
        .eq('publication_id', publicationId)
        .range(excludedOffset, excludedOffset + BATCH_SIZE - 1)

      if (batch && batch.length > 0) {
        excludedIpsData = excludedIpsData.concat(batch)
        excludedOffset += BATCH_SIZE
        excludedHasMore = batch.length === BATCH_SIZE
      } else {
        excludedHasMore = false
      }
    }

    const exclusions: IPExclusion[] = excludedIpsData.map(e => ({
      ip_address: e.ip_address,
      is_range: e.is_range || false,
      cidr_prefix: e.cidr_prefix
    }))

    // Fetch poll responses with IP (with pagination to handle >1000 rows)
    let pollData: any[] = []
    let pollOffset = 0
    let pollHasMore = true

    while (pollHasMore) {
      const { data: batch, error: pollError } = await supabaseAdmin
        .from('poll_responses')
        .select('ip_address, subscriber_email, responded_at')
        .eq('publication_id', publicationId)
        .not('ip_address', 'is', null)
        .range(pollOffset, pollOffset + BATCH_SIZE - 1)

      if (pollError) {
        console.error('[IP Exclusion] Error fetching poll responses:', pollError)
        break
      }

      if (batch && batch.length > 0) {
        pollData = pollData.concat(batch)
        pollOffset += BATCH_SIZE
        pollHasMore = batch.length === BATCH_SIZE
      } else {
        pollHasMore = false
      }
    }

    // Fetch link clicks with IP (with pagination to handle >1000 rows)
    let clickData: any[] = []
    let clickOffset = 0
    let clickHasMore = true

    while (clickHasMore) {
      const { data: batch, error: clickError } = await supabaseAdmin
        .from('link_clicks')
        .select('ip_address, subscriber_email, clicked_at')
        .eq('publication_id', publicationId)
        .not('ip_address', 'is', null)
        .range(clickOffset, clickOffset + BATCH_SIZE - 1)

      if (clickError) {
        console.error('[IP Exclusion] Error fetching link clicks:', clickError)
        break
      }

      if (batch && batch.length > 0) {
        clickData = clickData.concat(batch)
        clickOffset += BATCH_SIZE
        clickHasMore = batch.length === BATCH_SIZE
      } else {
        clickHasMore = false
      }
    }

    console.log(`[IP Exclusion] Fetched ${pollData.length} poll responses and ${clickData.length} link clicks for suggestions`)

    // Process data to find suspicious patterns
    const ipStats: Record<string, {
      ip_address: string
      total_activity: number
      unique_emails: Set<string>
      first_seen: Date
      last_seen: Date
      poll_votes: number
      link_clicks: number
    }> = {}

    // Process poll responses
    for (const row of pollData || []) {
      if (!row.ip_address) continue

      if (!ipStats[row.ip_address]) {
        ipStats[row.ip_address] = {
          ip_address: row.ip_address,
          total_activity: 0,
          unique_emails: new Set(),
          first_seen: new Date(row.responded_at),
          last_seen: new Date(row.responded_at),
          poll_votes: 0,
          link_clicks: 0
        }
      }

      const stats = ipStats[row.ip_address]
      stats.total_activity++
      stats.poll_votes++
      stats.unique_emails.add(row.subscriber_email)
      const time = new Date(row.responded_at)
      if (time < stats.first_seen) stats.first_seen = time
      if (time > stats.last_seen) stats.last_seen = time
    }

    // Process link clicks
    for (const row of clickData || []) {
      if (!row.ip_address) continue

      if (!ipStats[row.ip_address]) {
        ipStats[row.ip_address] = {
          ip_address: row.ip_address,
          total_activity: 0,
          unique_emails: new Set(),
          first_seen: new Date(row.clicked_at),
          last_seen: new Date(row.clicked_at),
          poll_votes: 0,
          link_clicks: 0
        }
      }

      const stats = ipStats[row.ip_address]
      stats.total_activity++
      stats.link_clicks++
      stats.unique_emails.add(row.subscriber_email)
      const time = new Date(row.clicked_at)
      if (time < stats.first_seen) stats.first_seen = time
      if (time > stats.last_seen) stats.last_seen = time
    }

    // Find IPs with suspicious patterns
    const suggestions = Object.values(ipStats)
      .filter(stats => {
        // Skip already excluded IPs (including CIDR matches)
        if (isIPExcluded(stats.ip_address, exclusions)) return false

        // Suspicious: multiple different emails from same IP
        if (stats.unique_emails.size < 2) return false

        // Calculate time span in seconds
        const timeSpanSeconds = (stats.last_seen.getTime() - stats.first_seen.getTime()) / 1000

        // Very suspicious: multiple emails within 5 minutes (300 seconds)
        if (timeSpanSeconds < 300 && stats.unique_emails.size >= 2) return true

        // Somewhat suspicious: many activities from same IP
        if (stats.total_activity >= 5) return true

        return false
      })
      .map(stats => {
        const timeSpanSeconds = (stats.last_seen.getTime() - stats.first_seen.getTime()) / 1000

        // Check if this IP belongs to a known email scanner
        const knownRange = getKnownIPRange(stats.ip_address)

        // Determine suspicion reason
        let reason = ''
        let suspicion_level: 'high' | 'medium' = 'medium'

        if (knownRange) {
          reason = `Known ${knownRange.organization} ${knownRange.type === 'email_scanner' ? 'email scanner' : knownRange.type} (${knownRange.description || knownRange.cidr})`
          suspicion_level = 'high'
        } else if (timeSpanSeconds < 60 && stats.unique_emails.size >= 2) {
          reason = `${stats.unique_emails.size} different emails in ${Math.round(timeSpanSeconds)} seconds - likely email security scanner`
          suspicion_level = 'high'
        } else if (timeSpanSeconds < 300 && stats.unique_emails.size >= 2) {
          reason = `${stats.unique_emails.size} different emails in ${Math.round(timeSpanSeconds / 60)} minutes - possible bot`
          suspicion_level = 'high'
        } else {
          reason = `${stats.total_activity} activities from this IP (${stats.poll_votes} poll votes, ${stats.link_clicks} link clicks)`
          suspicion_level = 'medium'
        }

        return {
          ip_address: stats.ip_address,
          total_activity: stats.total_activity,
          poll_votes: stats.poll_votes,
          link_clicks: stats.link_clicks,
          unique_emails: stats.unique_emails.size,
          time_span_seconds: Math.round(timeSpanSeconds),
          reason,
          suspicion_level,
          first_seen: stats.first_seen.toISOString(),
          last_seen: stats.last_seen.toISOString(),
          known_scanner: knownRange ? {
            organization: knownRange.organization,
            type: knownRange.type,
            description: knownRange.description,
            recommended_cidr: knownRange.cidr
          } : null
        }
      })
      .sort((a, b) => {
        // Sort by suspicion level (high first), then by time span (shortest first)
        if (a.suspicion_level !== b.suspicion_level) {
          return a.suspicion_level === 'high' ? -1 : 1
        }
        return a.time_span_seconds - b.time_span_seconds
      })

    // Build summary of detected known scanners with recommended ranges
    const detectedScanners: Record<string, {
      organization: string
      type: string
      ip_count: number
      total_activity: number
      recommended_ranges: string[]
    }> = {}

    for (const suggestion of suggestions) {
      if (suggestion.known_scanner) {
        const org = suggestion.known_scanner.organization
        if (!detectedScanners[org]) {
          const ranges = getKnownRangesByOrganization(org)
          detectedScanners[org] = {
            organization: org,
            type: suggestion.known_scanner.type,
            ip_count: 0,
            total_activity: 0,
            recommended_ranges: Array.from(new Set(ranges.map(r => r.cidr)))
          }
        }
        detectedScanners[org].ip_count++
        detectedScanners[org].total_activity += suggestion.total_activity
      }
    }

    return NextResponse.json({
      success: true,
      suggestions,
      detected_scanners: Object.values(detectedScanners).sort((a, b) => b.total_activity - a.total_activity)
    })

  } catch (error) {
    console.error('[IP Exclusion] Suggestions error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
