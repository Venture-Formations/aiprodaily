import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { start } from 'workflow/api'
import { processRSSWorkflow } from '@/lib/workflows/process-rss-workflow'

/**
 * RSS Processing Workflow Endpoint
 * Triggered by cron or manually
 * Each step gets its own 800-second timeout via Vercel Workflow DevKit
 */
export const POST = withApiHandler(
  { authTier: 'system', logContext: 'workflows/process-rss' },
  async ({ request }) => {
    const body = await request.json()
    const { publication_id } = body

    if (!publication_id) {
      return NextResponse.json({
        error: 'publication_id is required'
      }, { status: 400 })
    }

    // Start the workflow using the API from workflow/api
    // Arguments must be passed as an array
    // Workflows execute asynchronously across multiple steps
    await start(processRSSWorkflow, [{ trigger: 'cron', publication_id }])

    return NextResponse.json({
      success: true,
      message: 'Workflow started successfully',
      publication_id,
      timestamp: new Date().toISOString()
    })
  }
)

export const maxDuration = 800
