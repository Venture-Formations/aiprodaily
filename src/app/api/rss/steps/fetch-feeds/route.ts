import { NextRequest, NextResponse } from 'next/server'
import { RSSProcessor } from '@/lib/rss-processor'
import { supabaseAdmin } from '@/lib/supabase'
import { startWorkflowStep, completeWorkflowStep, failWorkflow } from '@/lib/workflow-state'

/**
 * Step 2: Fetch RSS feeds and insert posts from past 24 hours
 * Processes both primary and secondary feeds
 */
export async function POST(request: NextRequest) {
  let issue_id: string | undefined

  try {
    const body = await request.json()
    issue_id = body.issue_id

    if (!issue_id) {
      return NextResponse.json({ error: 'issue_id is required' }, { status: 400 })
    }


    // Start workflow step
    const startResult = await startWorkflowStep(issue_id, 'pending_fetch_feeds')
    if (!startResult.success) {
      return NextResponse.json({
        success: false,
        message: startResult.message,
        step: '2/7'
      }, { status: 409 })
    }

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


    const processor = new RSSProcessor()
    let totalPosts = 0

    // Process primary feeds
    for (const feed of primaryFeeds) {
      try {
        // Use the existing processFeed method via a helper
        // We'll need to expose this method or refactor it
        await processor.processSingleFeed(feed, issue_id, 'primary')
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
        await processor.processSingleFeed(feed, issue_id, 'secondary')
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
      .eq('issue_id', issue_id)

    totalPosts = posts?.length || 0


    // Complete workflow step
    await completeWorkflowStep(issue_id, 'fetching_feeds')

    return NextResponse.json({
      success: true,
      message: 'Fetch feeds step completed',
      issue_id,
      posts_count: totalPosts,
      feeds_processed: allFeeds.length,
      next_state: 'pending_extract',
      step: '2/7'
    })

  } catch (error) {
    console.error('[Step 2] Fetch feeds failed:', error)

    if (issue_id) {
      await failWorkflow(
        issue_id,
        `Fetch feeds step failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }

    return NextResponse.json({
      error: 'Fetch feeds step failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      step: '2/7'
    }, { status: 500 })
  }
}
