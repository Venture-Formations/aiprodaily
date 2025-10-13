import { NextRequest, NextResponse } from 'next/server'
import { BreakingNewsProcessor } from '@/lib/breaking-news-processor'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Process Breaking News RSS Feeds
 * GET /api/cron/process-breaking-news
 *
 * This endpoint processes RSS feeds for Breaking News section:
 * - Fetches articles from configured RSS feeds (3-day window)
 * - Scores articles using AI (0-100 scale)
 * - Generates summaries and alternative titles
 * - Categorizes as 'breaking' (≥70) or 'beyond_feed' (≥40)
 *
 * Can be triggered by:
 * 1. Vercel cron (automated)
 * 2. Manual testing with secret parameter
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const secret = searchParams.get('secret')

    // For manual testing with secret parameter
    if (secret !== process.env.CRON_SECRET && secret !== null) {
      return NextResponse.json(
        { error: 'Invalid secret' },
        { status: 401 }
      )
    }

    console.log('Starting Breaking News RSS processing...')

    // Get the latest draft campaign for AI Accounting newsletter
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, date, status')
      .eq('status', 'draft')
      .order('date', { ascending: false })
      .limit(1)
      .single()

    if (campaignError || !campaign) {
      console.log('No draft campaign found for Breaking News processing')
      return NextResponse.json({
        success: false,
        message: 'No draft campaign found',
        timestamp: new Date().toISOString()
      })
    }

    console.log(`Processing Breaking News for campaign ${campaign.id} (date: ${campaign.date})`)

    // Initialize and run Breaking News processor
    const processor = new BreakingNewsProcessor()
    await processor.processBreakingNewsFeeds(campaign.id)

    console.log('Breaking News RSS processing completed successfully')

    return NextResponse.json({
      success: true,
      message: 'Breaking News RSS processing completed',
      campaign_id: campaign.id,
      campaign_date: campaign.date,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error in Breaking News RSS processing:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Support POST for manual triggering
export async function POST(request: NextRequest) {
  return GET(request)
}
