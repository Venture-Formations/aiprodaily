import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { STEP_ENDPOINTS } from '@/types/workflow-states'

/**
 * Workflow Coordinator Cron Job
 *
 * Runs every 2 minutes to check for campaigns ready for next workflow step.
 * Uses state machine pattern to avoid Vercel's infinite loop detection.
 *
 * How it works:
 * 1. Find campaigns in "pending_*" states (ready for next step)
 * 2. Trigger the appropriate step endpoint for each campaign
 * 3. Each step updates state when complete
 *
 * This avoids chained HTTP calls that trigger Vercel's loop detection.
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Workflow Coordinator] Starting workflow state check')

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://aiprodaily.vercel.app'

    // Find all campaigns ready for next step (in "pending_*" states)
    const pendingStates = [
      'pending_archive',
      'pending_fetch_feeds',
      'pending_extract',
      'pending_score',
      'pending_generate',
      'pending_finalize'
    ]

    const { data: campaigns, error } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, date, workflow_state, workflow_state_started_at')
      .in('workflow_state', pendingStates)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[Workflow Coordinator] Failed to fetch campaigns:', error)
      return NextResponse.json({
        error: 'Failed to fetch campaigns',
        message: error.message
      }, { status: 500 })
    }

    if (!campaigns || campaigns.length === 0) {
      console.log('[Workflow Coordinator] No campaigns ready for processing')
      return NextResponse.json({
        message: 'No campaigns ready for processing',
        processed: 0
      })
    }

    console.log(`[Workflow Coordinator] Found ${campaigns.length} campaign(s) ready for processing`)

    const results = []

    // Process each campaign
    for (const campaign of campaigns) {
      const endpoint = STEP_ENDPOINTS[campaign.workflow_state]

      if (!endpoint) {
        console.error(`[Workflow Coordinator] Unknown state: ${campaign.workflow_state} for campaign ${campaign.id}`)
        continue
      }

      const stepUrl = `${baseUrl}${endpoint}`

      console.log(`[Workflow Coordinator] Triggering ${campaign.workflow_state} for campaign ${campaign.id} (${campaign.date})`)

      try {
        // Trigger the step endpoint
        const response = await fetch(stepUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaign_id: campaign.id })
        })

        if (response.ok) {
          console.log(`[Workflow Coordinator] ✅ Successfully triggered ${campaign.workflow_state} for campaign ${campaign.id}`)
          results.push({
            campaign_id: campaign.id,
            state: campaign.workflow_state,
            status: 'triggered',
            response_status: response.status
          })
        } else {
          const errorText = await response.text()
          console.error(`[Workflow Coordinator] ❌ Step returned ${response.status} for campaign ${campaign.id}:`, errorText)

          // Mark campaign as failed if step returns error
          await supabaseAdmin
            .from('newsletter_campaigns')
            .update({
              workflow_state: 'failed',
              workflow_error: `Step ${campaign.workflow_state} failed with status ${response.status}: ${errorText.substring(0, 200)}`
            })
            .eq('id', campaign.id)

          results.push({
            campaign_id: campaign.id,
            state: campaign.workflow_state,
            status: 'failed',
            error: errorText.substring(0, 100)
          })
        }
      } catch (fetchError) {
        console.error(`[Workflow Coordinator] Failed to trigger step for campaign ${campaign.id}:`, fetchError)

        results.push({
          campaign_id: campaign.id,
          state: campaign.workflow_state,
          status: 'error',
          error: fetchError instanceof Error ? fetchError.message : 'Unknown error'
        })
      }
    }

    // Check for stuck campaigns (in same state > 15 minutes)
    const fifteenMinutesAgo = new Date()
    fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15)

    const { data: stuckCampaigns } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, date, workflow_state, workflow_state_started_at')
      .in('workflow_state', [
        'archiving', 'fetching_feeds', 'extracting',
        'scoring', 'generating', 'finalizing'
      ])
      .lt('workflow_state_started_at', fifteenMinutesAgo.toISOString())

    if (stuckCampaigns && stuckCampaigns.length > 0) {
      console.warn(`[Workflow Coordinator] ⚠️ Found ${stuckCampaigns.length} stuck campaign(s):`,
        stuckCampaigns.map(c => `${c.id} (${c.workflow_state} since ${c.workflow_state_started_at})`))
    }

    return NextResponse.json({
      message: 'Workflow coordinator completed',
      processed: campaigns.length,
      results,
      stuck_campaigns: stuckCampaigns?.length || 0
    })

  } catch (error) {
    console.error('[Workflow Coordinator] Fatal error:', error)
    return NextResponse.json({
      error: 'Workflow coordinator failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
