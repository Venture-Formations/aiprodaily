import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { isIPExcluded, IPExclusion, ipMatchesCIDR, parseCIDR } from '@/lib/ip-utils'

/**
 * GET - Get all email addresses that used a specific IP address
 *
 * Query params:
 * - publication_id (required)
 * - source: 'all' | 'polls' | 'clicks' (default: 'all')
 *
 * Returns emails from poll_responses and/or link_clicks
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ip: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { ip } = await params
    const decodedIp = decodeURIComponent(ip)

    const { searchParams } = new URL(request.url)
    const publicationId = searchParams.get('publication_id')
    const source = searchParams.get('source') || 'all'

    if (!publicationId) {
      return NextResponse.json(
        { error: 'publication_id is required' },
        { status: 400 }
      )
    }

    // Check if this is a CIDR range
    const cidrParsed = parseCIDR(decodedIp)
    const isRange = cidrParsed !== null

    interface EmailEntry {
      email: string
      source: 'poll' | 'link_click'
      count: number
      first_seen: string
      last_seen: string
    }

    const emailMap: Record<string, EmailEntry> = {}

    const BATCH_SIZE = 1000

    // Fetch poll responses
    if (source === 'all' || source === 'polls') {
      let pollData: any[] = []

      // For single IP, filter in query (efficient)
      if (!isRange) {
        const { data, error: pollError } = await supabaseAdmin
          .from('poll_responses')
          .select('subscriber_email, ip_address, responded_at')
          .eq('publication_id', publicationId)
          .eq('ip_address', decodedIp)

        if (pollError) {
          console.error('[IP Exclusion] Error fetching poll responses:', pollError)
        } else {
          pollData = data || []
        }
      } else {
        // For CIDR ranges, need to fetch all and filter in JS (with pagination)
        let offset = 0
        let hasMore = true

        while (hasMore) {
          const { data: batch, error: pollError } = await supabaseAdmin
            .from('poll_responses')
            .select('subscriber_email, ip_address, responded_at')
            .eq('publication_id', publicationId)
            .not('ip_address', 'is', null)
            .range(offset, offset + BATCH_SIZE - 1)

          if (pollError) {
            console.error('[IP Exclusion] Error fetching poll responses:', pollError)
            break
          }

          if (batch && batch.length > 0) {
            pollData = pollData.concat(batch)
            offset += BATCH_SIZE
            hasMore = batch.length === BATCH_SIZE
          } else {
            hasMore = false
          }
        }
      }

      for (const row of pollData) {
        // For CIDR ranges, filter in JavaScript
        if (isRange && cidrParsed) {
          if (!ipMatchesCIDR(row.ip_address, cidrParsed.ip, cidrParsed.prefix)) {
            continue
          }
        }

        const key = `${row.subscriber_email}|poll`
        if (!emailMap[key]) {
          emailMap[key] = {
            email: row.subscriber_email,
            source: 'poll',
            count: 0,
            first_seen: row.responded_at,
            last_seen: row.responded_at
          }
        }
        emailMap[key].count++
        if (row.responded_at < emailMap[key].first_seen) {
          emailMap[key].first_seen = row.responded_at
        }
        if (row.responded_at > emailMap[key].last_seen) {
          emailMap[key].last_seen = row.responded_at
        }
      }
    }

    // Fetch link clicks
    if (source === 'all' || source === 'clicks') {
      let clickData: any[] = []

      // For single IP, filter in query (efficient)
      if (!isRange) {
        const { data, error: clickError } = await supabaseAdmin
          .from('link_clicks')
          .select('subscriber_email, ip_address, clicked_at')
          .eq('publication_id', publicationId)
          .eq('ip_address', decodedIp)

        if (clickError) {
          console.error('[IP Exclusion] Error fetching link clicks:', clickError)
        } else {
          clickData = data || []
        }
      } else {
        // For CIDR ranges, need to fetch all and filter in JS (with pagination)
        let offset = 0
        let hasMore = true

        while (hasMore) {
          const { data: batch, error: clickError } = await supabaseAdmin
            .from('link_clicks')
            .select('subscriber_email, ip_address, clicked_at')
            .eq('publication_id', publicationId)
            .not('ip_address', 'is', null)
            .range(offset, offset + BATCH_SIZE - 1)

          if (clickError) {
            console.error('[IP Exclusion] Error fetching link clicks:', clickError)
            break
          }

          if (batch && batch.length > 0) {
            clickData = clickData.concat(batch)
            offset += BATCH_SIZE
            hasMore = batch.length === BATCH_SIZE
          } else {
            hasMore = false
          }
        }
      }

      for (const row of clickData) {
        // For CIDR ranges, filter in JavaScript
        if (isRange && cidrParsed) {
          if (!ipMatchesCIDR(row.ip_address, cidrParsed.ip, cidrParsed.prefix)) {
            continue
          }
        }

        const key = `${row.subscriber_email}|link_click`
        if (!emailMap[key]) {
          emailMap[key] = {
            email: row.subscriber_email,
            source: 'link_click',
            count: 0,
            first_seen: row.clicked_at,
            last_seen: row.clicked_at
          }
        }
        emailMap[key].count++
        if (row.clicked_at < emailMap[key].first_seen) {
          emailMap[key].first_seen = row.clicked_at
        }
        if (row.clicked_at > emailMap[key].last_seen) {
          emailMap[key].last_seen = row.clicked_at
        }
      }
    }

    // Convert to array and sort by count descending
    const emails = Object.values(emailMap).sort((a, b) => b.count - a.count)

    // Calculate totals
    const pollEmails = new Set(emails.filter(e => e.source === 'poll').map(e => e.email))
    const clickEmails = new Set(emails.filter(e => e.source === 'link_click').map(e => e.email))
    const allEmails = new Set(emails.map(e => e.email))

    return NextResponse.json({
      success: true,
      ip_address: decodedIp,
      is_range: isRange,
      emails,
      totals: {
        poll_emails: pollEmails.size,
        click_emails: clickEmails.size,
        total_unique: allEmails.size
      }
    })

  } catch (error) {
    console.error('[IP Exclusion] Emails by IP error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
