import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { executeStep4 } from '../combined-steps/step4-deduplicate'
import { executeStep5 } from '../combined-steps/step5-generate-headlines'
import { executeStep6 } from '../combined-steps/step6-select-subject'
import { executeStep7 } from '../combined-steps/step7-welcome'
import { executeStep8 } from '../combined-steps/step8-finalize'

/**
 * RSS Processing Phase 2: Generate Articles, Select, Welcome, Finalize
 *
 * This runs the remaining 5 steps:
 * 4. Deduplicate posts
 * 5. Generate headlines/bodies
 * 6. Select articles and generate subject line
 * 7. Generate welcome section
 * 8. Finalize (mark draft + notifications)
 *
 * Requires phase 1 to be completed first.
 */
export const POST = withApiHandler(
  { authTier: 'authenticated', logContext: 'rss/process-phase2' },
  async ({ logger, request }) => {
    const body = await request.json()
    const issue_id = body.issue_id

    if (!issue_id) {
      return NextResponse.json({ error: 'issue_id is required' }, { status: 400 })
    }

    logger.info(`[RSS Phase 2] Start: ${issue_id}`)

    const steps = [
      { name: 'Deduplicate', fn: () => executeStep4(issue_id) },
      { name: 'Generate', fn: () => executeStep5(issue_id) },
      { name: 'Select+Subject', fn: () => executeStep6(issue_id) },
      { name: 'Welcome', fn: () => executeStep7(issue_id) },
      { name: 'Finalize', fn: () => executeStep8(issue_id) }
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
        logger.error(`[RSS Phase 2] Failed: ${step.name}`)
        results.push({ step: step.name, status: 'failed', error: lastError })

        const { supabaseAdmin } = await import('@/lib/supabase')
        await supabaseAdmin
          .from('publication_issues')
          .update({ status: 'failed' })
          .eq('id', issue_id)

        return NextResponse.json({
          success: false,
          message: 'RSS processing phase 2 failed',
          issue_id: issue_id,
          results
        }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'RSS processing phase 2 completed',
      issue_id: issue_id,
      results
    })
  }
)
