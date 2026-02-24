import { withApiHandler } from '@/lib/api-handler'
import { NextResponse } from 'next/server'
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
export const GET = withApiHandler(
  { authTier: 'system', logContext: 'workflow-coordinator' },
  async ({ logger }) => {
    logger.info('Starting workflow state check')

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
      logger.error({ err: error }, 'Failed to fetch issues')
      return NextResponse.json({
        error: 'Failed to fetch issues',
        message: error.message
      }, { status: 500 })
    }

    if (!issues || issues.length === 0) {
      logger.info('No issues ready for processing')
      return NextResponse.json({
        message: 'No issues ready for processing',
        processed: 0
      })
    }

    logger.info(`Found ${issues.length} issue(s) ready for processing`)

    const results = []

    // Process each issue
    for (const issue of issues) {
      const endpoint = STEP_ENDPOINTS[issue.workflow_state]

      if (!endpoint) {
        logger.error({ workflowState: issue.workflow_state, issueId: issue.id }, 'Unknown state')
        continue
      }

      const stepUrl = `${baseUrl}${endpoint}`

      logger.info({ issueId: issue.id, date: issue.date, state: issue.workflow_state }, 'Triggering step')

      try {
        // Trigger the step endpoint
        const response = await fetch(stepUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issue_id: issue.id })
        })

        if (response.ok) {
          logger.info({ issueId: issue.id, state: issue.workflow_state }, 'Successfully triggered step')
          results.push({
            issue_id: issue.id,
            state: issue.workflow_state,
            status: 'triggered',
            response_status: response.status
          })
        } else {
          const errorText = await response.text()
          logger.error({ issueId: issue.id, status: response.status, error: errorText }, 'Step returned error')

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
        logger.error({ err: fetchError, issueId: issue.id }, 'Failed to trigger step')

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
      logger.warn({ stuck: stuckCampaigns.map(c => `${c.id} (${c.workflow_state} since ${c.workflow_state_started_at})`) },
        `Found ${stuckCampaigns.length} stuck issue(s)`)
    }

    return NextResponse.json({
      message: 'Workflow coordinator completed',
      processed: issues.length,
      results,
      stuck_issues: stuckCampaigns?.length || 0
    })
  }
)
