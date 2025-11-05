import { NextRequest, NextResponse } from 'next/server'
import { start } from 'workflow/api'
import { processRSSWorkflow } from '@/lib/workflows/process-rss-workflow'

/**
 * RSS Processing Workflow Endpoint
 * Triggered by cron or manually
 * Each step gets its own 800-second timeout via Vercel Workflow DevKit
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { newsletter_id } = body

    if (!newsletter_id) {
      return NextResponse.json({
        error: 'newsletter_id is required'
      }, { status: 400 })
    }

    // Start the workflow using the API from workflow/api
    // Arguments must be passed as an array
    // Workflows execute asynchronously across multiple steps
    await start(processRSSWorkflow, [{ trigger: 'cron', newsletter_id }])

    return NextResponse.json({
      success: true,
      message: 'Workflow started successfully',
      newsletter_id,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('[Workflow] Failed:', error)
    return NextResponse.json({
      error: 'Workflow failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export const maxDuration = 800
