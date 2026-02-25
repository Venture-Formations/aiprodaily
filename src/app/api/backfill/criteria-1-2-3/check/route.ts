import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Check how many posts need criteria 1-3 backfilling
 * Provides recommendations on how to run the backfill
 */
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'backfill/criteria-1-2-3/check' },
  async ({ request, logger }) => {
    const body = await request.json()
    const { newsletterId } = body

    if (!newsletterId) {
      return NextResponse.json({ error: 'publication_id required' }, { status: 400 })
    }

    console.log(`[Check C1-3] Checking backfill needs for: ${newsletterId}`)

    const now = new Date()

    // Get PRIMARY feeds only
    const { data: feeds, error: feedsError } = await supabaseAdmin
      .from('rss_feeds')
      .select('id')
      .eq('publication_id', newsletterId)
      .eq('use_for_primary_section', true)

    if (feedsError || !feeds || feeds.length === 0) {
      return NextResponse.json({
        error: 'Failed to fetch primary feeds',
        details: feedsError?.message || 'No primary feeds found'
      }, { status: 500 })
    }

    const primaryFeedIds = feeds.map(f => f.id)
    console.log(`[Check C1-3] Found ${primaryFeedIds.length} primary feeds`)

    // Check different time windows
    const checks = {
      '6-36_hours': {
        start: new Date(now.getTime() - (36 * 60 * 60 * 1000)),
        end: new Date(now.getTime() - (6 * 60 * 60 * 1000))
      },
      '6-24_hours': {
        start: new Date(now.getTime() - (24 * 60 * 60 * 1000)),
        end: new Date(now.getTime() - (6 * 60 * 60 * 1000))
      },
      '24-36_hours': {
        start: new Date(now.getTime() - (36 * 60 * 60 * 1000)),
        end: new Date(now.getTime() - (24 * 60 * 60 * 1000))
      },
      '36-60_hours': {
        start: new Date(now.getTime() - (60 * 60 * 60 * 1000)),
        end: new Date(now.getTime() - (36 * 60 * 60 * 1000))
      }
    }

    const results: any = {}

    for (const [window, times] of Object.entries(checks)) {
      const { data: posts, error } = await supabaseAdmin
        .from('rss_posts')
        .select('id, processed_at', { count: 'exact', head: false })
        .in('feed_id', primaryFeedIds)
        .gte('processed_at', times.start.toISOString())
        .lte('processed_at', times.end.toISOString())

      if (error) {
        console.error(`[Check C1-3] Error checking ${window}:`, error)
        results[window] = { error: error.message }
      } else {
        results[window] = {
          count: posts?.length || 0,
          timeRange: {
            start: times.start.toISOString(),
            end: times.end.toISOString()
          }
        }
      }
    }

    // Determine recommendation
    const total = results['6-36_hours'].count || 0
    let recommendation: string

    if (total === 0) {
      recommendation = 'No posts to backfill'
    } else if (total <= 75) {
      recommendation = 'Run with timeWindow: "all" - processes all posts in one batch'
    } else {
      recommendation = `
Split into two batches:
1. First run with timeWindow: "6-24" (${results['6-24_hours'].count || 0} posts)
2. Then run with timeWindow: "24-36" (${results['24-36_hours'].count || 0} posts)
      `.trim()
    }

    console.log(`[Check C1-3] Total posts: ${total}, Recommendation: ${recommendation}`)

    return NextResponse.json({
      success: true,
      newsletterId,
      windows: results,
      recommendation,
      totalPosts: total,
      shouldSplit: total > 75
    })
  }
)
