import { NextRequest, NextResponse } from 'next/server'
import { RSSProcessor } from '@/lib/rss-processor'

/**
 * Step 4a: Score/evaluate PRIMARY posts with AI criteria
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { campaign_id } = body

    if (!campaign_id) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 })
    }

    console.log(`[Step 4a/7] Starting: Score PRIMARY posts for campaign ${campaign_id}`)

    const processor = new RSSProcessor()
    const startTime = Date.now()

    // Score primary posts only
    console.log('Scoring primary posts...')
    const primaryResults = await processor.scorePostsForSection(campaign_id, 'primary')
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`Primary scoring: ${primaryResults.scored} scored, ${primaryResults.errors} errors (${duration}s)`)

    console.log(`[Step 4a/7] Complete: Scored ${primaryResults.scored} primary posts in ${duration}s`)

    // Chain to next step: Score secondary posts
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://aiprodaily.vercel.app'
    const nextStepUrl = `${baseUrl}/api/rss/steps/score-secondary`

    console.log(`[Step 4a] Triggering next step: ${nextStepUrl}`)

    // Trigger next step without awaiting response to avoid deep call stack
    fetch(nextStepUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id })
    }).catch(error => {
      console.error('[Step 4a] Failed to trigger next step:', error)
    })

    // Small delay to ensure fetch request is sent before function terminates
    await new Promise(resolve => setTimeout(resolve, 100))

    return NextResponse.json({
      success: true,
      message: 'Score primary posts step completed, score-secondary step triggered',
      campaign_id,
      primary: primaryResults,
      next_step: 'score-secondary',
      step: '4a/7'
    })

  } catch (error) {
    console.error('[Step 4a] Score primary posts failed:', error)
    return NextResponse.json({
      error: 'Score primary posts step failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      step: '4a/7'
    }, { status: 500 })
  }
}
