import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { executeStep1 } from '../combined-steps/step1-archive'
import { executeStep2 } from '../combined-steps/step2-fetch-extract'
import { executeStep3 } from '../combined-steps/step3-score'

/**
 * RSS Processing Phase 1: Archive, Fetch+Extract, Score
 *
 * This runs the first 3 steps:
 * 1. Archive old data
 * 2. Fetch RSS feeds and extract full text
 * 3. Score posts with AI
 *
 * After this completes, call /api/rss/process-phase2 with the issue_id
 */
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'rss/process-phase1' },
  async ({ logger, request }) => {
    const body = await request.json()
    const issue_id = body.issue_id

    if (!issue_id) {
      return NextResponse.json({ error: 'issue_id is required' }, { status: 400 })
    }

    logger.info(`[RSS Phase 1] Start: ${issue_id}`)

    const steps = [
      { name: 'Archive', fn: () => executeStep1(issue_id) },
      { name: 'Fetch+Extract', fn: () => executeStep2(issue_id) },
      { name: 'Score', fn: () => executeStep3(issue_id) }
    ]

    const results = []

    for (const step of steps) {
      let attempt = 1
      let stepSuccessful = false
      let lastError: any = null

      while (attempt <= 2 && !stepSuccessful) {
        try {
          const result = await step.fn()
          results.push({ step: step.name, status: 'success', data: result })
          stepSuccessful = true
        } catch (error) {
          lastError = error
          attempt++
        }
      }

      if (!stepSuccessful) {
        logger.error(`[RSS Phase 1] Failed: ${step.name}`)
        results.push({ step: step.name, status: 'failed', error: lastError })

        const { supabaseAdmin } = await import('@/lib/supabase')
        await supabaseAdmin
          .from('publication_issues')
          .update({ status: 'failed' })
          .eq('id', issue_id)

        return NextResponse.json({
          success: false,
          message: 'RSS processing phase 1 failed',
          issue_id: issue_id,
          results
        }, { status: 500 })
      }
    }

    logger.info(`[RSS Phase 1] All steps completed successfully for issue: ${issue_id}`)

    // Update issue status to pending_phase2
    // Phase 2 will be triggered by a separate cron job after delay
    const { supabaseAdmin } = await import('@/lib/supabase')
    await supabaseAdmin
      .from('publication_issues')
      .update({
        status: 'pending_phase2',
        updated_at: new Date().toISOString()
      })
      .eq('id', issue_id)

    logger.info(`[RSS Phase 1] issue marked as pending_phase2 - Phase 2 will start automatically after delay`)

    return NextResponse.json({
      success: true,
      message: 'RSS processing phase 1 completed - phase 2 will start automatically',
      issue_id: issue_id,
      results,
      next_step: 'Phase 2 will be triggered by cron job after 5-minute delay'
    })
  }
)
