import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * Single RSS Processing Endpoint
 *
 * Runs all 7 workflow steps sequentially for ONE campaign:
 * 1. Archive old data
 * 2. Fetch RSS feeds
 * 3. Extract full article text
 * 4. Score posts with AI
 * 5. Generate newsletter articles
 * 6. (Future: Activate/select top articles)
 * 7. Finalize campaign
 *
 * Features:
 * - Processes only the specified campaign_id
 * - Runs all steps in sequence
 * - Retries failed steps once before marking as failed
 * - Updates workflow_state for tracking/debugging
 */
export async function POST(request: NextRequest) {
  let campaign_id: string | undefined

  try {
    // Check for cron secret OR authenticated session
    const cronSecret = request.headers.get('Authorization')
    const isCronRequest = cronSecret === `Bearer ${process.env.CRON_SECRET}`

    if (!isCronRequest) {
      // Check for authenticated user session
      const session = await getServerSession(authOptions)
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await request.json()
    campaign_id = body.campaign_id

    if (!campaign_id) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 })
    }

    console.log(`[RSS Processing] Starting full workflow for campaign ${campaign_id}`)

    // Initialize workflow by setting campaign to first pending state
    const { supabaseAdmin } = await import('@/lib/supabase')

    // First, check current state
    const { data: campaign } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('workflow_state')
      .eq('id', campaign_id)
      .single()

    // Only set to pending_archive if not already in a workflow state
    if (!campaign?.workflow_state || campaign.workflow_state === 'processing') {
      const { error: updateError } = await supabaseAdmin
        .from('newsletter_campaigns')
        .update({
          workflow_state: 'pending_archive',
          workflow_state_started_at: new Date().toISOString()
        })
        .eq('id', campaign_id)

      if (updateError) {
        console.error('[RSS Processing] Failed to initialize workflow state:', updateError)
        throw new Error(`Failed to initialize workflow: ${updateError.message}`)
      }

      console.log(`[RSS Processing] Initialized campaign to pending_archive state`)
    } else {
      console.log(`[RSS Processing] Campaign already in workflow state: ${campaign.workflow_state}`)
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://aiprodaily.vercel.app'

    // Define all workflow steps in order
    const steps = [
      { name: 'Archive', endpoint: '/api/rss/steps/archive', stepNumber: '1/7' },
      { name: 'Fetch Feeds', endpoint: '/api/rss/steps/fetch-feeds', stepNumber: '2/7' },
      { name: 'Extract Articles', endpoint: '/api/rss/steps/extract-articles', stepNumber: '3/7' },
      { name: 'Score Posts', endpoint: '/api/rss/steps/score-posts', stepNumber: '4/7' },
      { name: 'Generate Articles', endpoint: '/api/rss/steps/generate-articles', stepNumber: '5/7' },
      { name: 'Finalize', endpoint: '/api/rss/steps/finalize', stepNumber: '7/7' }
    ]

    const results = []
    let allSuccessful = true

    // Execute each step sequentially
    for (const step of steps) {
      console.log(`[RSS Processing] Running ${step.name} (${step.stepNumber})...`)

      let attempt = 1
      let stepSuccessful = false
      let lastError: any = null

      // Try step up to 2 times (original + 1 retry)
      while (attempt <= 2 && !stepSuccessful) {
        try {
          if (attempt > 1) {
            console.log(`[RSS Processing] Retrying ${step.name} (attempt ${attempt}/2)...`)
          }

          const response = await fetch(`${baseUrl}${step.endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaign_id })
          })

          const data = await response.json()

          if (response.ok) {
            console.log(`[RSS Processing] ✅ ${step.name} completed successfully`)
            results.push({
              step: step.name,
              stepNumber: step.stepNumber,
              status: 'success',
              attempt,
              data
            })
            stepSuccessful = true
          } else {
            lastError = data
            console.error(`[RSS Processing] ❌ ${step.name} failed (attempt ${attempt}):`, data)
            attempt++
          }
        } catch (error) {
          lastError = error
          console.error(`[RSS Processing] ❌ ${step.name} error (attempt ${attempt}):`, error)
          attempt++
        }
      }

      // If step failed after retries, mark entire workflow as failed
      if (!stepSuccessful) {
        console.error(`[RSS Processing] ${step.name} failed after ${attempt - 1} attempts. Stopping workflow.`)
        allSuccessful = false
        results.push({
          step: step.name,
          stepNumber: step.stepNumber,
          status: 'failed',
          attempts: attempt - 1,
          error: lastError
        })
        break // Stop processing remaining steps
      }
    }

    if (allSuccessful) {
      console.log(`[RSS Processing] ✅ All steps completed successfully for campaign ${campaign_id}`)
      return NextResponse.json({
        success: true,
        message: 'RSS processing completed successfully',
        campaign_id,
        results
      })
    } else {
      console.error(`[RSS Processing] ❌ Workflow failed for campaign ${campaign_id}`)
      return NextResponse.json({
        success: false,
        message: 'RSS processing failed',
        campaign_id,
        results
      }, { status: 500 })
    }

  } catch (error) {
    console.error('[RSS Processing] Fatal error:', error)
    return NextResponse.json({
      error: 'RSS processing failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      campaign_id
    }, { status: 500 })
  }
}

