import { NextRequest, NextResponse } from 'next/server'
import { RSSProcessor } from '@/lib/rss-processor'
import { startWorkflowStep, completeWorkflowStep, failWorkflow } from '@/lib/workflow-state'

/**
 * Step 4: Score/evaluate posts with AI criteria
 * Processes both primary and secondary sections sequentially
 */
export async function POST(request: NextRequest) {
  let campaign_id: string | undefined

  try {
    const body = await request.json()
    campaign_id = body.campaign_id

    if (!campaign_id) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 })
    }


    const startResult = await startWorkflowStep(campaign_id, 'pending_score')
    if (!startResult.success) {
      return NextResponse.json({
        success: false,
        message: startResult.message,
        step: '4/7'
      }, { status: 409 })
    }

    const processor = new RSSProcessor()
    const overallStartTime = Date.now()

    // Score primary posts first
    const primaryStartTime = Date.now()
    const primaryResults = await processor.scorePostsForSection(campaign_id, 'primary')
    const primaryDuration = ((Date.now() - primaryStartTime) / 1000).toFixed(1)

    // Score secondary posts
    const secondaryStartTime = Date.now()
    const secondaryResults = await processor.scorePostsForSection(campaign_id, 'secondary')
    const secondaryDuration = ((Date.now() - secondaryStartTime) / 1000).toFixed(1)

    const totalDuration = ((Date.now() - overallStartTime) / 1000).toFixed(1)

    await completeWorkflowStep(campaign_id, 'scoring')

    return NextResponse.json({
      success: true,
      message: 'Score posts step completed',
      campaign_id,
      primary: primaryResults,
      secondary: secondaryResults,
      total_scored: primaryResults.scored + secondaryResults.scored,
      total_errors: primaryResults.errors + secondaryResults.errors,
      duration_seconds: totalDuration,
      next_state: 'pending_generate',
      step: '4/7'
    })

  } catch (error) {
    console.error('[Step 4] Score posts failed:', error)

    if (campaign_id) {
      await failWorkflow(
        campaign_id,
        `Score posts step failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }

    return NextResponse.json({
      error: 'Score posts step failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      step: '4/7'
    }, { status: 500 })
  }
}
