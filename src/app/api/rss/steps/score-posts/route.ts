import { NextRequest, NextResponse } from 'next/server'
import { RSSProcessor } from '@/lib/rss-processor'

/**
 * Step 4: Score/evaluate posts with AI criteria
 * Processes both primary and secondary sections
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { campaign_id } = body

    if (!campaign_id) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 })
    }

    console.log(`[Step 4/6] Starting: Score posts for campaign ${campaign_id}`)

    const processor = new RSSProcessor()

    // Score primary posts
    console.log('Scoring primary posts...')
    const primaryResults = await processor.scorePostsForSection(campaign_id, 'primary')
    console.log(`Primary scoring: ${primaryResults.scored} scored, ${primaryResults.errors} errors`)

    // Score secondary posts
    console.log('Scoring secondary posts...')
    const secondaryResults = await processor.scorePostsForSection(campaign_id, 'secondary')
    console.log(`Secondary scoring: ${secondaryResults.scored} scored, ${secondaryResults.errors} errors`)

    const totalScored = primaryResults.scored + secondaryResults.scored
    const totalErrors = primaryResults.errors + secondaryResults.errors

    console.log(`[Step 4/6] Complete: Scored ${totalScored} posts with ${totalErrors} errors`)

    // Chain to next step: Generate newsletter articles
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    fetch(`${baseUrl}/api/rss/steps/generate-articles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id })
    }).catch(error => {
      console.error('[Step 4] Failed to trigger next step:', error)
    })

    return NextResponse.json({
      success: true,
      message: 'Score posts step completed, generate-articles step triggered',
      campaign_id,
      primary: primaryResults,
      secondary: secondaryResults,
      total_scored: totalScored,
      total_errors: totalErrors,
      next_step: 'generate-articles',
      step: '4/6'
    })

  } catch (error) {
    console.error('[Step 4] Score posts failed:', error)
    return NextResponse.json({
      error: 'Score posts step failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      step: '4/6'
    }, { status: 500 })
  }
}
