import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { STEP_ENDPOINTS } from '@/types/workflow-states'

/**
 * Workflow Coordinator Cron Job
 *
 * Runs every 2 minutes to check for issues ready for next workflow step.
 * Uses state machine pattern to avoid Vercel's infinite loop detection.
 *
 * How it works:
 * 1. Find issues in "pending_*" states (ready for next step)
 * 2. Trigger the appropriate step endpoint for each issue
 * 3. Each step updates state when complete
 *
 * This avoids chained HTTP calls that trigger Vercel's loop detection.
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Workflow Coordinator] Starting workflow state check')

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://aiprodaily.vercel.app'

    // Find all issues ready for next step (in "pending_*" states)
    const pendingStates = [
      'pending_archive',
      'pending_fetch_feeds',
      'pending_extract',
      'pending_score',
      'pending_generate',
      'pending_finalize'
    ]

    const { data: issues, error } = await supabaseAdmin
      .from('publication_issues')
      .select('id, date, workflow_state, workflow_state_started_at')
      .in('workflow_state', pendingStates)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[Workflow Coordinator] Failed to fetch issues:', error)
      return NextResponse.json({
        error: 'Failed to fetch issues',
        message: error.message
      }, { status: 500 })
    }

    if (!issues || issues.length === 0) {
      console.log('[Workflow Coordinator] No issues ready for processing')
      return NextResponse.json({
        message: 'No issues ready for processing',
        processed: 0
      })
    }

    console.log(`[Workflow Coordinator] Found ${issues.length} issue(s) ready for processing`)

    const results = []

    // Process each issue
    for (const issue of issues) {
      const endpoint = STEP_ENDPOINTS[issue.workflow_state]

      if (!endpoint) {
        console.error(`[Workflow Coordinator] Unknown state: ${issue.workflow_state} for issue ${issue.id}`)
        continue
      }

      const stepUrl = `${baseUrl}${endpoint}`

      console.log(`[Workflow Coordinator] Triggering ${issue.workflow_state} for issue ${issue.id} (${issue.date})`)

      try {
        // Trigger the step endpoint
        const response = await fetch(stepUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issue_id: issue.id })
        })

        if (response.ok) {
          console.log(`[Workflow Coordinator] ✅ Successfully triggered ${issue.workflow_state} for issue ${issue.id}`)
          results.push({
            issue_id: issue.id,
            state: issue.workflow_state,
            status: 'triggered',
            response_status: response.status
          })
        } else {
          const errorText = await response.text()
          console.error(`[Workflow Coordinator] ❌ Step returned ${response.status} for issue ${issue.id}:`, errorText)

          // Mark issue as failed if step returns error
          await supabaseAdmin
            .from('publication_issues')
            .update({
              workflow_state: 'failed',
              workflow_error: `Step ${issue.workflow_state} failed with status ${response.status}: ${errorText.substring(0, 200)}`
            })
            .eq('id', issue.id)

          results.push({
            issue_id: issue.id,
            state: issue.workflow_state,
            status: 'failed',
            error: errorText.substring(0, 100)
          })
        }
      } catch (fetchError) {
        console.error(`[Workflow Coordinator] Failed to trigger step for issue ${issue.id}:`, fetchError)

        results.push({
          issue_id: issue.id,
          state: issue.workflow_state,
          status: 'error',
          error: fetchError instanceof Error ? fetchError.message : 'Unknown error'
        })
      }
    }

    // Check for stuck issues (in same state > 15 minutes)
    const fifteenMinutesAgo = new Date()
    fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15)

    const { data: stuckCampaigns } = await supabaseAdmin
      .from('publication_issues')
      .select('id, date, workflow_state, workflow_state_started_at')
      .in('workflow_state', [
        'archiving', 'fetching_feeds', 'extracting',
        'scoring', 'generating', 'finalizing'
      ])
      .lt('workflow_state_started_at', fifteenMinutesAgo.toISOString())

    if (stuckCampaigns && stuckCampaigns.length > 0) {
      console.warn(`[Workflow Coordinator] ⚠️ Found ${stuckCampaigns.length} stuck issue(s):`,
        stuckCampaigns.map(c => `${c.id} (${c.workflow_state} since ${c.workflow_state_started_at})`))
    }

    return NextResponse.json({
      message: 'Workflow coordinator completed',
      processed: issues.length,
      results,
      stuck_issues: stuckCampaigns?.length || 0
    })

  } catch (error) {
    console.error('[Workflow Coordinator] Fatal error:', error)
    return NextResponse.json({
      error: 'Workflow coordinator failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
