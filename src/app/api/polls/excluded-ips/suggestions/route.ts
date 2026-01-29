import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET - Get suggested IPs to exclude based on suspicious voting patterns
 *
 * Suspicious patterns detected:
 * 1. Multiple different emails voting from the same IP within a short time window
 *    (indicates email security scanners like Barracuda, Mimecast, Proofpoint)
 * 2. High volume of votes from a single IP
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
    const { data: excludedIps } = await supabaseAdmin
      .from('poll_excluded_ips')
      .select('ip_address')
      .eq('publication_id', publicationId)

    const excludedSet = new Set(excludedIps?.map(e => e.ip_address) || [])

    // Find suspicious IPs: multiple different emails voting from same IP within 5 minutes
    // This is a strong indicator of email security scanners/bots
    const { data: suspiciousIps, error } = await supabaseAdmin.rpc('get_suspicious_poll_ips', {
      p_publication_id: publicationId
    })

    // If the RPC doesn't exist, fall back to a raw query approach
    if (error?.code === '42883') { // function does not exist
      // Use a direct query approach
      const { data: rawData, error: rawError } = await supabaseAdmin
        .from('poll_responses')
        .select('ip_address, subscriber_email, responded_at')
        .eq('publication_id', publicationId)
        .not('ip_address', 'is', null)
        .order('ip_address')
        .order('responded_at')

      if (rawError) {
        console.error('[Polls] Error fetching poll responses for suggestions:', rawError)
        return NextResponse.json({ error: rawError.message }, { status: 500 })
      }

      // Process in JavaScript to find suspicious patterns
      const ipStats: Record<string, {
        ip_address: string
        total_votes: number
        unique_emails: Set<string>
        first_vote: Date
        last_vote: Date
        votes: { email: string; time: Date }[]
      }> = {}

      for (const row of rawData || []) {
        if (!row.ip_address) continue

        if (!ipStats[row.ip_address]) {
          ipStats[row.ip_address] = {
            ip_address: row.ip_address,
            total_votes: 0,
            unique_emails: new Set(),
            first_vote: new Date(row.responded_at),
            last_vote: new Date(row.responded_at),
            votes: []
          }
        }

        const stats = ipStats[row.ip_address]
        stats.total_votes++
        stats.unique_emails.add(row.subscriber_email)
        const voteTime = new Date(row.responded_at)
        if (voteTime < stats.first_vote) stats.first_vote = voteTime
        if (voteTime > stats.last_vote) stats.last_vote = voteTime
        stats.votes.push({ email: row.subscriber_email, time: voteTime })
      }

      // Find IPs with suspicious patterns
      const suggestions = Object.values(ipStats)
        .filter(stats => {
          // Skip already excluded IPs
          if (excludedSet.has(stats.ip_address)) return false

          // Suspicious: multiple different emails from same IP
          if (stats.unique_emails.size < 2) return false

          // Calculate time span in seconds
          const timeSpanSeconds = (stats.last_vote.getTime() - stats.first_vote.getTime()) / 1000

          // Very suspicious: multiple emails within 5 minutes (300 seconds)
          if (timeSpanSeconds < 300 && stats.unique_emails.size >= 2) return true

          // Somewhat suspicious: many votes from same IP
          if (stats.total_votes >= 5) return true

          return false
        })
        .map(stats => {
          const timeSpanSeconds = (stats.last_vote.getTime() - stats.first_vote.getTime()) / 1000

          // Determine suspicion reason
          let reason = ''
          let suspicion_level: 'high' | 'medium' = 'medium'

          if (timeSpanSeconds < 60 && stats.unique_emails.size >= 2) {
            reason = `${stats.unique_emails.size} different emails in ${Math.round(timeSpanSeconds)} seconds - likely email security scanner`
            suspicion_level = 'high'
          } else if (timeSpanSeconds < 300 && stats.unique_emails.size >= 2) {
            reason = `${stats.unique_emails.size} different emails in ${Math.round(timeSpanSeconds / 60)} minutes - possible bot`
            suspicion_level = 'high'
          } else {
            reason = `${stats.total_votes} votes from this IP`
            suspicion_level = 'medium'
          }

          return {
            ip_address: stats.ip_address,
            total_votes: stats.total_votes,
            unique_emails: stats.unique_emails.size,
            time_span_seconds: Math.round(timeSpanSeconds),
            reason,
            suspicion_level,
            first_vote: stats.first_vote.toISOString(),
            last_vote: stats.last_vote.toISOString()
          }
        })
        .sort((a, b) => {
          // Sort by suspicion level (high first), then by time span (shortest first)
          if (a.suspicion_level !== b.suspicion_level) {
            return a.suspicion_level === 'high' ? -1 : 1
          }
          return a.time_span_seconds - b.time_span_seconds
        })

      return NextResponse.json({
        success: true,
        suggestions
      })
    }

    if (error) {
      console.error('[Polls] Error fetching suspicious IPs:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Filter out already excluded IPs
    const filteredSuggestions = (suspiciousIps || []).filter(
      (s: any) => !excludedSet.has(s.ip_address)
    )

    return NextResponse.json({
      success: true,
      suggestions: filteredSuggestions
    })

  } catch (error) {
    console.error('[Polls] Excluded IPs suggestions error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
