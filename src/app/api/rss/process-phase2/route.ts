import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
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

    console.log(`[RSS Phase 2] Start: ${issue_id}`)

    const steps = [
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
        }
      }

      if (!stepSuccessful) {
        console.error(`[RSS Phase 2] Failed: ${step.name}`)
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

  } catch (error) {
    console.error('[RSS Phase 2] Error:', error)
    return NextResponse.json({
      error: 'RSS processing phase 2 failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      issue_id
    }, { status: 500 })
  }
}

