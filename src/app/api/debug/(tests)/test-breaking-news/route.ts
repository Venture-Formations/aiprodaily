import { NextRequest, NextResponse } from 'next/server'
import { BreakingNewsProcessor } from '@/lib/breaking-news-processor'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Test Breaking News RSS Processing
 * GET /api/debug/test-breaking-news
 *
 * Manual testing endpoint for Breaking News processor
 * - Fetches and scores RSS articles
 * - Generates AI summaries and titles
 * - Categorizes articles by relevance score
 */
export async function GET() {
  try {
    console.log('=== Breaking News Processor Test ===')

    // Get latest campaign
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, date, status')
      .order('date', { ascending: false })
      .limit(1)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({
        success: false,
        error: 'No campaign found'
      }, { status: 404 })
    }

    console.log(`Testing with campaign: ${campaign.id} (${campaign.date})`)

    // Check RSS feeds
    const { data: feeds, error: feedsError } = await supabaseAdmin
      .from('rss_feeds')
      .select('*')
      .eq('active', true)
      .not('newsletter_id', 'is', null)

    console.log(`Found ${feeds?.length || 0} active Breaking News feeds`)

    if (!feeds || feeds.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No active RSS feeds configured',
        instructions: 'Add RSS feeds in Settings > RSS Feeds'
      })
    }

    // Process Breaking News
    const processor = new BreakingNewsProcessor()
    await processor.processBreakingNewsFeeds(campaign.id)

    // Get results
    const { data: posts, error: postsError } = await supabaseAdmin
      .from('rss_posts')
      .select('*')
      .eq('campaign_id', campaign.id)
      .not('breaking_news_score', 'is', null)
      .order('breaking_news_score', { ascending: false })

    console.log(`Processed ${posts?.length || 0} articles with Breaking News scores`)

    // Categorize results
    const breaking = posts?.filter(p => p.breaking_news_category === 'breaking') || []
    const beyondFeed = posts?.filter(p => p.breaking_news_category === 'beyond_feed') || []
    const other = posts?.filter(p => !p.breaking_news_category) || []

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        date: campaign.date,
        status: campaign.status
      },
      feeds_processed: feeds.length,
      articles_scored: posts?.length || 0,
      categories: {
        breaking: {
          count: breaking.length,
          articles: breaking.slice(0, 3).map(p => ({
            title: p.ai_title || p.title,
            score: p.breaking_news_score,
            summary: p.ai_summary
          }))
        },
        beyond_feed: {
          count: beyondFeed.length,
          articles: beyondFeed.slice(0, 3).map(p => ({
            title: p.ai_title || p.title,
            score: p.breaking_news_score,
            summary: p.ai_summary
          }))
        },
        other: {
          count: other.length
        }
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error testing Breaking News processor:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
