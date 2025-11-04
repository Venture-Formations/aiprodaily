import { NextRequest, NextResponse } from 'next/server'
import { ScheduleChecker } from '@/lib/schedule-checker'
import { start } from 'workflow/api'
import { processRSSWorkflow } from '@/lib/workflows/process-rss-workflow'

/**
 * Workflow Trigger Cron
 * Runs every 5 minutes to check if it's time to execute the RSS workflow
 * based on the schedule configured in Settings > Email
 *
 * This replaces the hardcoded vercel.json schedule with a dynamic,
 * database-driven schedule that can be changed via the UI
 */
export async function GET(request: NextRequest) {
  try {
    // For Vercel cron: check secret in URL params, for manual: require secret param
    const searchParams = new URL(request.url).searchParams
    const secret = searchParams.get('secret')

    // Allow both manual testing (with secret param) and Vercel cron (no auth needed)
    const isVercelCron = !secret && !searchParams.has('secret')
    const isManualTest = secret === process.env.CRON_SECRET

    if (!isVercelCron && !isManualTest) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if it's time to run RSS processing based on database schedule
    const shouldRun = await ScheduleChecker.shouldRunRSSProcessing()

    if (!shouldRun) {
      console.log('[Workflow Trigger] Not time to run workflow yet')
      return NextResponse.json({
        success: true,
        message: 'Not time to run RSS workflow',
        skipped: true,
        timestamp: new Date().toISOString()
      })
    }

    console.log('[Workflow Trigger] Time to run workflow - starting...')

    // Start the workflow
    await start(processRSSWorkflow, [{ trigger: 'cron' }])

    console.log('[Workflow Trigger] Workflow started successfully')

    return NextResponse.json({
      success: true,
      message: 'Workflow started successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[Workflow Trigger] Failed:', error)
    return NextResponse.json({
      error: 'Workflow trigger failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export const maxDuration = 60
