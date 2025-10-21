import { NextRequest, NextResponse } from 'next/server'
import { RSSProcessor } from '@/lib/rss-processor'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Step 2: Fetch RSS feeds and insert posts from past 24 hours
 * Processes both primary and secondary feeds
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { campaign_id } = body

    if (!campaign_id) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 })
    }

    console.log(`[Step 2/7] Starting: Fetch RSS feeds for campaign ${campaign_id}`)

    // Get active RSS feeds - separate primary and secondary
    const { data: allFeeds, error: feedsError } = await supabaseAdmin
      .from('rss_feeds')
      .select('*')
      .eq('active', true)

    if (feedsError) {
      throw new Error(`Failed to fetch feeds: ${feedsError.message}`)
    }

    if (!allFeeds || allFeeds.length === 0) {
      console.log('⚠️ No active RSS feeds found')
      return NextResponse.json({
        error: 'No active RSS feeds found'
      }, { status: 400 })
    }

    // Separate feeds by section
    const primaryFeeds = allFeeds.filter(feed => feed.use_for_primary_section)
    const secondaryFeeds = allFeeds.filter(feed => feed.use_for_secondary_section)

    console.log(`Processing ${primaryFeeds.length} primary feeds and ${secondaryFeeds.length} secondary feeds`)

    const processor = new RSSProcessor()
    let totalPosts = 0

    // Process primary feeds
    for (const feed of primaryFeeds) {
      try {
        // Use the existing processFeed method via a helper
        // We'll need to expose this method or refactor it
        await processor.processSingleFeed(feed, campaign_id, 'primary')
      } catch (error) {
        console.error(`Failed to process primary feed ${feed.name}:`, error)

        // Increment error count
        await supabaseAdmin
          .from('rss_feeds')
          .update({
            processing_errors: feed.processing_errors + 1
          })
          .eq('id', feed.id)
      }
    }

    // Process secondary feeds
    for (const feed of secondaryFeeds) {
      try {
        await processor.processSingleFeed(feed, campaign_id, 'secondary')
      } catch (error) {
        console.error(`Failed to process secondary feed ${feed.name}:`, error)

        // Increment error count
        await supabaseAdmin
          .from('rss_feeds')
          .update({
            processing_errors: feed.processing_errors + 1
          })
          .eq('id', feed.id)
      }
    }

    // Count total posts inserted
    const { data: posts } = await supabaseAdmin
      .from('rss_posts')
      .select('id')
      .eq('campaign_id', campaign_id)

    totalPosts = posts?.length || 0

    console.log(`[Step 2/7] Complete: Fetched ${totalPosts} posts from ${allFeeds.length} feeds`)

    // Chain to next step: Extract full article text
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://aiprodaily.vercel.app'
    const nextStepUrl = `${baseUrl}/api/rss/steps/extract-articles`

    console.log(`[Step 2] Triggering next step: ${nextStepUrl}`)

    try {
      const response = await fetch(nextStepUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[Step 2] Next step returned ${response.status}:`, errorText)
      } else {
        const result = await response.json()
        console.log('[Step 2] Next step triggered successfully:', result)
      }
    } catch (error) {
      console.error('[Step 2] Failed to trigger next step:', error)
    }

    return NextResponse.json({
      success: true,
      message: 'Fetch feeds step completed, extract-articles step triggered',
      campaign_id,
      posts_count: totalPosts,
      feeds_processed: allFeeds.length,
      next_step: 'extract-articles',
      step: '2/7'
    })

  } catch (error) {
    console.error('[Step 2] Fetch feeds failed:', error)
    return NextResponse.json({
      error: 'Fetch feeds step failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      step: '2/7'
    }, { status: 500 })
  }
}
