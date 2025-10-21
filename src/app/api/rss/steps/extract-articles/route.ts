import { NextRequest, NextResponse } from 'next/server'
import { RSSProcessor } from '@/lib/rss-processor'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Step 3: Extract full article text from URLs
 * Uses Readability.js to get full content from past 24 hours posts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { campaign_id } = body

    if (!campaign_id) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 })
    }

    console.log(`[Step 3/7] Starting: Extract full article text for campaign ${campaign_id}`)

    // Get count of posts to extract
    const yesterday = new Date()
    yesterday.setHours(yesterday.getHours() - 24)
    const yesterdayTimestamp = yesterday.toISOString()

    const { data: posts } = await supabaseAdmin
      .from('rss_posts')
      .select('id')
      .eq('campaign_id', campaign_id)
      .not('source_url', 'is', null)
      .gte('processed_at', yesterdayTimestamp)

    const postsToExtract = posts?.length || 0
    console.log(`Found ${postsToExtract} posts from past 24 hours to extract`)

    // Extract full article text for posts from past 24 hours
    const processor = new RSSProcessor()

    try {
      await processor.extractFullArticleText(campaign_id)
      console.log(`✅ Article extraction completed successfully`)
    } catch (extractionError) {
      console.error('Failed to extract full articles, but continuing with RSS summaries:', extractionError)
      // Don't fail the entire process if article extraction fails
    }

    // Count how many successfully extracted
    const { data: extractedPosts } = await supabaseAdmin
      .from('rss_posts')
      .select('id, full_article_text')
      .eq('campaign_id', campaign_id)
      .not('full_article_text', 'is', null)

    const extractedCount = extractedPosts?.length || 0

    console.log(`[Step 3/7] Complete: Extracted ${extractedCount}/${postsToExtract} articles`)

    // Chain to next step: Score posts
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://aiprodaily.vercel.app'
    const nextStepUrl = `${baseUrl}/api/rss/steps/score-posts`

    console.log(`[Step 3] Triggering next step: ${nextStepUrl}`)

    // Fire-and-forget: trigger next step without awaiting to avoid deep call stack
    fetch(nextStepUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id })
    }).then(response => {
      console.log(`[Step 3] Next step responded with: ${response.status}`)
    }).catch(error => {
      console.error('[Step 3] Failed to trigger next step:', error)
    })

    // Keep function alive for 1 second to ensure HTTP request is fully sent
    await new Promise(resolve => setTimeout(resolve, 1000))

    return NextResponse.json({
      success: true,
      message: 'Extract articles step completed, score-posts step triggered',
      campaign_id,
      posts_to_extract: postsToExtract,
      extracted_count: extractedCount,
      next_step: 'score-posts',
      step: '3/7'
    })

  } catch (error) {
    console.error('[Step 3] Extract articles failed:', error)
    return NextResponse.json({
      error: 'Extract articles step failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      step: '3/7'
    }, { status: 500 })
  }
}
