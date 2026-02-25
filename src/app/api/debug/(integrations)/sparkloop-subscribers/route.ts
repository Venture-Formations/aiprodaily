import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'

const SPARKLOOP_API_BASE = 'https://api.sparkloop.app/v2'

/**
 * GET /api/debug/sparkloop-subscribers
 *
 * Fetches subscriber-level data from SparkLoop API to reconcile referral counts.
 * Query params:
 *   type: 'all' | 'referrals' | 'advocates' (default: 'referrals')
 *   page: page number (default: 1)
 *   per_page: results per page (default: 50, max: 200)
 *   expand: 'campaigns' to include referral program data
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(integrations)/sparkloop-subscribers' },
  async ({ request, logger }) => {
  const apiKey = process.env.SPARKLOOP_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'SPARKLOOP_API_KEY not configured' },
      { status: 500 }
    )
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'referrals'
  const perPage = Math.min(Number(searchParams.get('per_page') || '200'), 200)
  const expand = searchParams.get('expand') || 'campaigns'
  const maxPages = Number(searchParams.get('max_pages') || '10')

  try {
    const allSubscribers: Record<string, unknown>[] = []
    let page = 1
    let hasMore = true

    while (hasMore && page <= maxPages) {
      const url = `${SPARKLOOP_API_BASE}/subscribers?type=${type}&per_page=${perPage}&page=${page}&expand=${expand}`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        return NextResponse.json(
          { error: `SparkLoop API error: ${response.status}`, details: errorText, page },
          { status: response.status }
        )
      }

      const data = await response.json()
      const subscribers = data.subscribers || data.data || []

      if (subscribers.length === 0) {
        hasMore = false
      } else {
        allSubscribers.push(...subscribers)
        page++
      }

      // Safety: if we got fewer than per_page, we're on the last page
      if (subscribers.length < perPage) {
        hasMore = false
      }
    }

    // Build summary
    const emails = allSubscribers.map((s: Record<string, unknown>) => ({
      email: s.email,
      name: s.name,
      uuid: s.uuid,
      referral_status: s.referral_status,
      referred: s.referred,
      referrer_code: s.referrer_code,
      origin: s.origin,
      utm_source: s.utm_source,
      created_at: s.created_at,
    }))

    return NextResponse.json({
      total: allSubscribers.length,
      pages_fetched: page - 1,
      type,
      subscribers: emails,
      raw_sample: allSubscribers.slice(0, 3),
    })
  } catch (error) {
    console.error('[SparkLoop Debug] Error fetching subscribers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscribers', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
  }
)
