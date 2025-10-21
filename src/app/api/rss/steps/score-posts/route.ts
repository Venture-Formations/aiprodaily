import { NextRequest, NextResponse } from 'next/server'
import { RSSProcessor } from '@/lib/rss-processor'

/**
 * Step 4: Score/evaluate posts with AI criteria
 * Processes both primary and secondary sections sequentially
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { campaign_id } = body

    if (!campaign_id) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 })
    }

    console.log(`[Step 4/7] Starting: Score posts for campaign ${campaign_id}`)

    const processor = new RSSProcessor()
    const overallStartTime = Date.now()

    // Score primary posts first
    console.log('Scoring primary posts...')
    const primaryStartTime = Date.now()
    const primaryResults = await processor.scorePostsForSection(campaign_id, 'primary')
    const primaryDuration = ((Date.now() - primaryStartTime) / 1000).toFixed(1)
    console.log(`Primary scoring: ${primaryResults.scored} scored, ${primaryResults.errors} errors (${primaryDuration}s)`)

    // Score secondary posts
    console.log('Scoring secondary posts...')
    const secondaryStartTime = Date.now()
    const secondaryResults = await processor.scorePostsForSection(campaign_id, 'secondary')
    const secondaryDuration = ((Date.now() - secondaryStartTime) / 1000).toFixed(1)
    console.log(`Secondary scoring: ${secondaryResults.scored} scored, ${secondaryResults.errors} errors (${secondaryDuration}s)`)

    const totalDuration = ((Date.now() - overallStartTime) / 1000).toFixed(1)
    console.log(`[Step 4/7] Complete: Scored ${primaryResults.scored + secondaryResults.scored} posts in ${totalDuration}s`)

    // Chain to next step: Generate newsletter articles
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://aiprodaily.vercel.app'
    const nextStepUrl = `${baseUrl}/api/rss/steps/generate-articles`

    console.log(`[Step 4] Triggering next step: ${nextStepUrl}`)

    // Fire-and-forget: trigger next step without awaiting to avoid deep call stack
    fetch(nextStepUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign_id })
    }).then(response => {
      console.log(`[Step 4] Next step responded with: ${response.status}`)
    }).catch(error => {
      console.error('[Step 4] Failed to trigger next step:', error)
    })

    // Keep function alive for 1 second to ensure HTTP request is fully sent
    await new Promise(resolve => setTimeout(resolve, 1000))

    return NextResponse.json({
      success: true,
      message: 'Score posts step completed, generate-articles step triggered',
      campaign_id,
      primary: primaryResults,
      secondary: secondaryResults,
      total_scored: primaryResults.scored + secondaryResults.scored,
      total_errors: primaryResults.errors + secondaryResults.errors,
      duration_seconds: totalDuration,
      next_step: 'generate-articles',
      step: '4/7'
    })

  } catch (error) {
    console.error('[Step 4] Score posts failed:', error)
    return NextResponse.json({
      error: 'Score posts step failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      step: '4/7'
    }, { status: 500 })
  }
}
