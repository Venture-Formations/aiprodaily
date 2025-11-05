import { NextRequest, NextResponse } from 'next/server'
import { ScheduleChecker } from '@/lib/schedule-checker'
import { start } from 'workflow/api'
import { processRSSWorkflow } from '@/lib/workflows/process-rss-workflow'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Workflow Trigger Cron
 * Runs every 5 minutes to check if it's time to execute the RSS workflow
 * for any newsletter based on their individual schedules
 *
 * Multi-tenant: Each newsletter has its own schedule in app_settings
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

    // Get all active newsletters
    const { data: newsletters, error: newslettersError } = await supabaseAdmin
      .from('newsletters')
      .select('id, name, slug')
      .eq('is_active', true)

    if (newslettersError || !newsletters || newsletters.length === 0) {
      console.log('[Workflow Trigger] No active newsletters found')
      return NextResponse.json({
        success: true,
        message: 'No active newsletters',
        skipped: true,
        timestamp: new Date().toISOString()
      })
    }

    console.log(`[Workflow Trigger] Checking schedules for ${newsletters.length} newsletters`)

    // Check each newsletter's schedule and start workflows as needed
    const startedWorkflows: string[] = []

    for (const newsletter of newsletters) {
      const shouldRun = await ScheduleChecker.shouldRunRSSProcessing(newsletter.id)

      if (shouldRun) {
        console.log(`[Workflow Trigger] Starting workflow for ${newsletter.name} (${newsletter.id})`)

        await start(processRSSWorkflow, [{
          trigger: 'cron',
          newsletter_id: newsletter.id
        }])

        startedWorkflows.push(newsletter.name)
      } else {
        console.log(`[Workflow Trigger] Not time yet for ${newsletter.name}`)
      }
    }

    if (startedWorkflows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No workflows scheduled at this time',
        skipped: true,
        timestamp: new Date().toISOString()
      })
    }

    console.log(`[Workflow Trigger] Started workflows for: ${startedWorkflows.join(', ')}`)

    return NextResponse.json({
      success: true,
      message: `Started ${startedWorkflows.length} workflow(s)`,
      newsletters: startedWorkflows,
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
