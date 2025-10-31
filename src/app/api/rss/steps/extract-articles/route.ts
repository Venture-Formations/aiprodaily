import { NextRequest, NextResponse } from 'next/server'
import { RSSProcessor } from '@/lib/rss-processor'
import { supabaseAdmin } from '@/lib/supabase'
import { startWorkflowStep, completeWorkflowStep, failWorkflow } from '@/lib/workflow-state'

/**
 * Step 3: Extract full article text from URLs
 * Uses Readability.js to get full content from past 24 hours posts
 */
export async function POST(request: NextRequest) {
  let campaign_id: string | undefined

  try {
    const body = await request.json()
    campaign_id = body.campaign_id

    if (!campaign_id) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 })
    }


    const startResult = await startWorkflowStep(campaign_id, 'pending_extract')
    if (!startResult.success) {
      return NextResponse.json({
        success: false,
        message: startResult.message,
        step: '3/7'
      }, { status: 409 })
    }

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


    await completeWorkflowStep(campaign_id, 'extracting')

    return NextResponse.json({
      success: true,
      message: 'Extract articles step completed',
      campaign_id,
      posts_to_extract: postsToExtract,
      extracted_count: extractedCount,
      next_state: 'pending_score',
      step: '3/7'
    })

  } catch (error) {
    console.error('[Step 3] Extract articles failed:', error)

    if (campaign_id) {
      await failWorkflow(
        campaign_id,
        `Extract articles step failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }

    return NextResponse.json({
      error: 'Extract articles step failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      step: '3/7'
    }, { status: 500 })
  }
}
