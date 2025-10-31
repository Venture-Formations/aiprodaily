import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
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
 * After this completes, call /api/rss/process-phase2 with the campaign_id
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

    console.log(`[RSS Phase 1] Start: ${campaign_id}`)

    const steps = [
      { name: 'Archive', fn: () => executeStep1(campaign_id!) },
      { name: 'Fetch+Extract', fn: () => executeStep2(campaign_id!) },
      { name: 'Score', fn: () => executeStep3(campaign_id!) }
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
        console.error(`[RSS Phase 1] Failed: ${step.name}`)
        results.push({ step: step.name, status: 'failed', error: lastError })

        const { supabaseAdmin } = await import('@/lib/supabase')
        await supabaseAdmin
          .from('newsletter_campaigns')
          .update({ status: 'failed' })
          .eq('id', campaign_id)

        return NextResponse.json({
          success: false,
          message: 'RSS processing phase 1 failed',
          campaign_id,
          results
        }, { status: 500 })
      }
    }

    console.log(`[RSS Phase 1] All steps completed successfully for campaign: ${campaign_id}`)

    // Return Phase 1 response immediately
    const response = NextResponse.json({
      success: true,
      message: 'RSS processing phase 1 completed - phase 2 will be triggered automatically',
      campaign_id,
      results,
      phase2_triggered: true
    })

    // Automatically trigger Phase 2 in the background after a short delay
    // This ensures Phase 1 response is fully sent before Phase 2 starts
    // Delay prevents race conditions and ensures Phase 1 is fully complete
    setTimeout(() => {
      const baseUrl = process.env.NEXTAUTH_URL || process.env.PRODUCTION_URL || 'https://aiprodaily.vercel.app'
      const phase2Url = `${baseUrl}/api/rss/process-phase2`
      
      console.log(`[RSS Phase 1] Triggering Phase 2 in background after delay for campaign: ${campaign_id}`)
      
      // Fire and forget - don't await, let Phase 2 run independently
      fetch(phase2Url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CRON_SECRET}`
        },
        body: JSON.stringify({ campaign_id })
      }).catch(error => {
        // Log but don't fail Phase 1 if Phase 2 trigger fails
        console.error(`[RSS Phase 1] Failed to trigger Phase 2:`, error instanceof Error ? error.message : 'Unknown error')
      })
    }, 2000) // 2 second delay to ensure Phase 1 is fully complete

    return response

  } catch (error) {
    console.error('[RSS Phase 1] Error:', error)
    return NextResponse.json({
      error: 'RSS processing phase 1 failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      campaign_id
    }, { status: 500 })
  }
}

