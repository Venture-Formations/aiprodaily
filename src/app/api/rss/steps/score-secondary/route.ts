import { NextRequest, NextResponse } from 'next/server'
import { RSSProcessor } from '@/lib/rss-processor'

/**
 * Step 4b: Score/evaluate SECONDARY posts with AI criteria
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { campaign_id } = body

    if (!campaign_id) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 })
    }

    console.log(`[Step 4b/7] Starting: Score SECONDARY posts for campaign ${campaign_id}`)

    const processor = new RSSProcessor()
    const startTime = Date.now()

    // Score secondary posts only
    console.log('Scoring secondary posts...')
    const secondaryResults = await processor.scorePostsForSection(campaign_id, 'secondary')
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`Secondary scoring: ${secondaryResults.scored} scored, ${secondaryResults.errors} errors (${duration}s)`)

    console.log(`[Step 4b/7] Complete: Scored ${secondaryResults.scored} secondary posts in ${duration}s`)

    // Chain to next step: Generate newsletter articles
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://aiprodaily.vercel.app'
    const nextStepUrl = `${baseUrl}/api/rss/steps/generate-articles`

    console.log(`[Step 4b] Triggering next step: ${nextStepUrl}`)

    try {
      const response = await fetch(nextStepUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`[Step 4b] Next step returned ${response.status}:`, errorText)
      } else {
        const result = await response.json()
        console.log('[Step 4b] Next step triggered successfully:', result)
      }
    } catch (error) {
      console.error('[Step 4b] Failed to trigger next step:', error)
    }

    return NextResponse.json({
      success: true,
      message: 'Score secondary posts step completed, generate-articles step triggered',
      campaign_id,
      secondary: secondaryResults,
      next_step: 'generate-articles',
      step: '4b/7'
    })

  } catch (error) {
    console.error('[Step 4b] Score secondary posts failed:', error)
    return NextResponse.json({
      error: 'Score secondary posts step failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      step: '4b/7'
    }, { status: 500 })
  }
}
