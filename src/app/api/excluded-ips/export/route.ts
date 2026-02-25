import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { parseCIDR, ipMatchesCIDR } from '@/lib/ip-utils'
import { withApiHandler } from '@/lib/api-handler'

/**
 * GET - Export all excluded IPs with associated email addresses as CSV
 * Query params: publication_id (required)
 */
export const GET = withApiHandler(
  { authTier: 'authenticated', logContext: 'excluded-ips/export' },
  async ({ request }) => {
    const { searchParams } = new URL(request.url)
    const publicationId = searchParams.get('publication_id')

    if (!publicationId) {
      return NextResponse.json(
        { error: 'publication_id is required' },
        { status: 400 }
      )
    }

    // Fetch all excluded IPs
    const BATCH_SIZE = 1000
    let allExcludedIps: {
      id: string
      ip_address: string
      is_range: boolean
      cidr_prefix: number | null
      reason: string | null
      added_by: string | null
      created_at: string
    }[] = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const { data: batch, error } = await supabaseAdmin
        .from('excluded_ips')
        .select('id, ip_address, is_range, cidr_prefix, reason, added_by, created_at')
        .eq('publication_id', publicationId)
        .order('created_at', { ascending: false })
        .range(offset, offset + BATCH_SIZE - 1)

      if (error) {
        console.error('[IP Exclusion Export] Error fetching excluded IPs:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      if (batch && batch.length > 0) {
        allExcludedIps = allExcludedIps.concat(batch)
        offset += BATCH_SIZE
        hasMore = batch.length === BATCH_SIZE
      } else {
        hasMore = false
      }
    }

    if (allExcludedIps.length === 0) {
      // Return empty CSV with headers
      const headers = 'IP Address,Type,CIDR Prefix,Reason,Added By,Created At,Associated Emails (Source|Count|First Seen|Last Seen)\n'
      return new NextResponse(headers, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="excluded-ips-export-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

    // Fetch all poll responses and link clicks for the publication (for email lookup)
    let allPollResponses: { subscriber_email: string; ip_address: string; responded_at: string }[] = []
    let allLinkClicks: { subscriber_email: string; ip_address: string; clicked_at: string }[] = []

    // Fetch poll responses
    offset = 0
    hasMore = true
    while (hasMore) {
      const { data: batch, error } = await supabaseAdmin
        .from('poll_responses')
        .select('subscriber_email, ip_address, responded_at')
        .eq('publication_id', publicationId)
        .not('ip_address', 'is', null)
        .range(offset, offset + BATCH_SIZE - 1)

      if (error) {
        console.error('[IP Exclusion Export] Error fetching poll responses:', error)
        break
      }

      if (batch && batch.length > 0) {
        allPollResponses = allPollResponses.concat(batch)
        offset += BATCH_SIZE
        hasMore = batch.length === BATCH_SIZE
      } else {
        hasMore = false
      }
    }

    // Fetch link clicks
    offset = 0
    hasMore = true
    while (hasMore) {
      const { data: batch, error } = await supabaseAdmin
        .from('link_clicks')
        .select('subscriber_email, ip_address, clicked_at')
        .eq('publication_id', publicationId)
        .not('ip_address', 'is', null)
        .range(offset, offset + BATCH_SIZE - 1)

      if (error) {
        console.error('[IP Exclusion Export] Error fetching link clicks:', error)
        break
      }

      if (batch && batch.length > 0) {
        allLinkClicks = allLinkClicks.concat(batch)
        offset += BATCH_SIZE
        hasMore = batch.length === BATCH_SIZE
      } else {
        hasMore = false
      }
    }

    // Build CSV rows
    const csvRows: string[] = []

    // Add header row
    csvRows.push('IP Address,Type,CIDR Prefix,Reason,Added By,Created At,Associated Emails (Source|Count|First Seen|Last Seen)')

    for (const ip of allExcludedIps) {
      const displayIp = ip.is_range ? `${ip.ip_address}/${ip.cidr_prefix}` : ip.ip_address
      const ipType = ip.is_range ? 'Range' : 'Single'
      const cidrPrefix = ip.cidr_prefix?.toString() || ''
      const reason = escapeCSV(ip.reason || '')
      const addedBy = escapeCSV(ip.added_by || '')
      const createdAt = new Date(ip.created_at).toISOString()

      // Find associated emails for this IP
      const emailMap: Record<string, {
        email: string
        source: 'poll' | 'link_click'
        count: number
        first_seen: string
        last_seen: string
      }> = {}

      // Check if this is a CIDR range
      const cidrParsed = ip.is_range ? parseCIDR(`${ip.ip_address}/${ip.cidr_prefix}`) : null

      // Process poll responses
      for (const row of allPollResponses) {
        let matches = false
        if (ip.is_range && cidrParsed) {
          matches = ipMatchesCIDR(row.ip_address, cidrParsed.ip, cidrParsed.prefix)
        } else {
          matches = row.ip_address === ip.ip_address
        }

        if (matches) {
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

      // Process link clicks
      for (const row of allLinkClicks) {
        let matches = false
        if (ip.is_range && cidrParsed) {
          matches = ipMatchesCIDR(row.ip_address, cidrParsed.ip, cidrParsed.prefix)
        } else {
          matches = row.ip_address === ip.ip_address
        }

        if (matches) {
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

      // Format associated emails
      const emails = Object.values(emailMap)
        .sort((a, b) => b.count - a.count)
        .map(e => `${e.email}|${e.source}|${e.count}|${new Date(e.first_seen).toISOString()}|${new Date(e.last_seen).toISOString()}`)
        .join('; ')

      csvRows.push(`${escapeCSV(displayIp)},${ipType},${cidrPrefix},${reason},${addedBy},${createdAt},"${emails}"`)
    }

    const csvContent = csvRows.join('\n')

    console.log(`[IP Exclusion Export] Exported ${allExcludedIps.length} IPs for publication ${publicationId}`)

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="excluded-ips-export-${new Date().toISOString().split('T')[0]}.csv"`
      }
    })
  }
)

/**
 * Escape a value for CSV (handle commas, quotes, newlines)
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
