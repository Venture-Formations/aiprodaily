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
    // Start the workflow using the API from workflow/api
    // Arguments must be passed as an array
    const result = await start(processRSSWorkflow, [{ trigger: 'cron' }])

    return NextResponse.json({
      success: true,
      campaignId: result.campaignId,
      message: 'Workflow started',
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
