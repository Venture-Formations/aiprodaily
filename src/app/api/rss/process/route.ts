import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { executeStep1 } from '../combined-steps/step1-archive'
import { executeStep2 } from '../combined-steps/step2-fetch-extract'
import { executeStep3 } from '../combined-steps/step3-score'
import { executeStep4 } from '../combined-steps/step4-deduplicate'
import { executeStep5 } from '../combined-steps/step5-generate-headlines'
import { executeStep6 } from '../combined-steps/step6-select-subject'
import { executeStep7 } from '../combined-steps/step7-welcome'
import { executeStep8 } from '../combined-steps/step8-finalize'

/**
 * RSS Processing Endpoint
 *
 * Runs 8 workflow steps sequentially for ONE issue:
 * 1. Archive old data
 * 2. Fetch RSS feeds and extract full text
 * 3. Score posts with AI
 * 4. Deduplicate posts
 * 5. Generate headlines/bodies
 * 6. Select articles and generate subject line
 * 7. Generate welcome section
 * 8. Finalize (mark draft + notifications)
 *
 * Features:
 * - Minimal logging to prevent log overflow
 * - Retry logic for each step
 * - Single issue processing
 */
export async function POST(request: NextRequest) {
  let issue_id: string | undefined

  try {
    // Check for cron secret OR authenticated session
    const cronSecret = request.headers.get('Authorization')
    const isCronRequest = cronSecret === `Bearer ${process.env.CRON_SECRET}`

    if (!isCronRequest) {
      const session = await getServerSession(authOptions)
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const body = await request.json()
    issue_id = body.issue_id

    if (!issue_id) {
      return NextResponse.json({ error: 'issue_id is required' }, { status: 400 })
    }

    console.log(`[RSS] Start: ${issue_id}`)

    const steps = [
      { name: 'Archive', fn: () => executeStep1(issue_id!) },
      { name: 'Fetch+Extract', fn: () => executeStep2(issue_id!) },
      { name: 'Score', fn: () => executeStep3(issue_id!) },
      { name: 'Deduplicate', fn: () => executeStep4(issue_id!) },
      { name: 'Generate', fn: () => executeStep5(issue_id!) },
      { name: 'Select+Subject', fn: () => executeStep6(issue_id!) },
      { name: 'Welcome', fn: () => executeStep7(issue_id!) },
      { name: 'Finalize', fn: () => executeStep8(issue_id!) }
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
          if (attempt <= 2) {
          }
        }
      }

      if (!stepSuccessful) {
        console.error(`[RSS] Failed: ${step.name}`)
        results.push({ step: step.name, status: 'failed', error: lastError })

        // Mark issue as failed
        const { supabaseAdmin } = await import('@/lib/supabase')
        await supabaseAdmin
          .from('publication_issues')
          .update({ status: 'failed' })
          .eq('id', issue_id)

        return NextResponse.json({
          success: false,
          message: 'RSS processing failed',
          issue_id: issue_id,
          results
        }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'RSS processing completed',
      issue_id: issue_id,
      results
    })

  } catch (error) {
    console.error('[RSS] Error:', error)
    return NextResponse.json({
      error: 'RSS processing failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      issue_id
    }, { status: 500 })
  }
}
