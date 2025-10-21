import { NextRequest, NextResponse } from 'next/server'
import { RSSProcessor } from '@/lib/rss-processor'
import { supabaseAdmin } from '@/lib/supabase'
import { startWorkflowStep, completeWorkflowStep, failWorkflow } from '@/lib/workflow-state'

/**
 * Step 5: Generate newsletter articles (title + body + fact check)
 * Processes both primary and secondary sections
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { campaign_id } = body

    if (!campaign_id) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 })
    }

    console.log(`[Step 5/7] Starting: Generate newsletter articles for campaign ${campaign_id}`)

    const startResult = await startWorkflowStep(campaign_id, 'pending_generate')
    if (!startResult.success) {
      console.log(`[Step 5] Skipping - ${startResult.message}`)
      return NextResponse.json({
        success: false,
        message: startResult.message,
        step: '5/7'
      }, { status: 409 })
    }

    const processor = new RSSProcessor()

    // Generate primary articles
    console.log('Generating primary newsletter articles...')
    await processor.generateArticlesForSection(campaign_id, 'primary')

    // Generate secondary articles
    console.log('Generating secondary newsletter articles...')
    await processor.generateArticlesForSection(campaign_id, 'secondary')

    // Count generated articles
    const { data: primaryArticles } = await supabaseAdmin
      .from('articles')
      .select('id, fact_check_score')
      .eq('campaign_id', campaign_id)

    const { data: secondaryArticles } = await supabaseAdmin
      .from('secondary_articles')
      .select('id, fact_check_score')
      .eq('campaign_id', campaign_id)

    const primaryCount = primaryArticles?.length || 0
    const secondaryCount = secondaryArticles?.length || 0
    const totalArticles = primaryCount + secondaryCount

    // Count articles that passed fact checking
    const primaryPassed = primaryArticles?.filter(a => a.fact_check_score >= 70).length || 0
    const secondaryPassed = secondaryArticles?.filter(a => a.fact_check_score >= 70).length || 0
    const totalPassed = primaryPassed + secondaryPassed

    console.log(`[Step 5/7] Complete: Generated ${totalArticles} articles (${totalPassed} passed fact check)`)

    await completeWorkflowStep(campaign_id, 'generating')

    return NextResponse.json({
      success: true,
      message: 'Generate articles step completed',
      campaign_id,
      primary_articles: primaryCount,
      secondary_articles: secondaryCount,
      total_articles: totalArticles,
      fact_check_passed: totalPassed,
      next_state: 'pending_finalize',
      step: '5/7'
    })

  } catch (error) {
    console.error('[Step 5] Generate articles failed:', error)

    await failWorkflow(
      body.campaign_id,
      `Generate articles step failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )

    return NextResponse.json({
      error: 'Generate articles step failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      step: '5/7'
    }, { status: 500 })
  }
}
