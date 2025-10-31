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
 * Runs 8 workflow steps sequentially for ONE campaign:
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
 * - Single campaign processing
 */
export async function POST(request: NextRequest) {
  let campaign_id: string | undefined

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
    campaign_id = body.campaign_id

    if (!campaign_id) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 })
    }

    console.log(`[RSS] Start: ${campaign_id}`)

    const steps = [
      { name: 'Archive', fn: () => executeStep1(campaign_id!) },
      { name: 'Fetch+Extract', fn: () => executeStep2(campaign_id!) },
      { name: 'Score', fn: () => executeStep3(campaign_id!) },
      { name: 'Deduplicate', fn: () => executeStep4(campaign_id!) },
      { name: 'Generate', fn: () => executeStep5(campaign_id!) },
      { name: 'Select+Subject', fn: () => executeStep6(campaign_id!) },
      { name: 'Welcome', fn: () => executeStep7(campaign_id!) },
      { name: 'Finalize', fn: () => executeStep8(campaign_id!) }
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

        // Mark campaign as failed
        const { supabaseAdmin } = await import('@/lib/supabase')
        await supabaseAdmin
          .from('newsletter_campaigns')
          .update({ status: 'failed' })
          .eq('id', campaign_id)

        return NextResponse.json({
          success: false,
          message: 'RSS processing failed',
          campaign_id,
          results
        }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'RSS processing completed',
      campaign_id,
      results
    })

  } catch (error) {
    console.error('[RSS] Error:', error)
    return NextResponse.json({
      error: 'RSS processing failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      campaign_id
    }, { status: 500 })
  }
}
