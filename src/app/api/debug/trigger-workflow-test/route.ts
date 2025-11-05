import { NextRequest, NextResponse } from 'next/server'
import { start } from 'workflow/api'
import { processRSSWorkflow } from '@/lib/workflows/process-rss-workflow'

/**
 * Debug endpoint to manually trigger RSS workflow for testing
 * Uses query parameter authentication like other cron endpoints
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = new URL(request.url).searchParams
    const secret = searchParams.get('secret')
    const newsletterId = searchParams.get('newsletter_id')

    // Auth check
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!newsletterId) {
      return NextResponse.json({
        error: 'newsletter_id query parameter is required'
      }, { status: 400 })
    }

    console.log(`[Debug] Manually triggering workflow for newsletter: ${newsletterId}`)

    // Start the workflow
    await start(processRSSWorkflow, [{
      trigger: 'manual',
      newsletter_id: newsletterId
    }])

    return NextResponse.json({
      success: true,
      message: 'Workflow started successfully',
      newsletter_id: newsletterId,
      trigger: 'manual',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[Debug] Workflow trigger failed:', error)
    return NextResponse.json({
      error: 'Workflow trigger failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export const maxDuration = 60
