import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { ErrorHandler, SlackNotificationService } from '@/lib/slack'
import { startWorkflowStep, completeWorkflowStep, failWorkflow } from '@/lib/workflow-state'

/**
 * Step 6: Finalize campaign
 * Updates campaign status to draft and sends Slack notifications
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { campaign_id } = body

    if (!campaign_id) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 })
    }

    console.log(`[Step 7/7] Starting: Finalize campaign ${campaign_id}`)

    const startResult = await startWorkflowStep(campaign_id, 'pending_finalize')
    if (!startResult.success) {
      console.log(`[Step 7] Skipping - ${startResult.message}`)
      return NextResponse.json({
        success: false,
        message: startResult.message,
        step: '7/7'
      }, { status: 409 })
    }

    const errorHandler = new ErrorHandler()
    const slack = new SlackNotificationService()

    // Update campaign status from processing to draft
    await supabaseAdmin
      .from('newsletter_campaigns')
      .update({ status: 'draft' })
      .eq('id', campaign_id)

    console.log('Campaign status updated to draft')

    // Get final article count to report to Slack
    const { data: finalArticles } = await supabaseAdmin
      .from('articles')
      .select('id')
      .eq('campaign_id', campaign_id)

    const articleCount = finalArticles?.length || 0

    // Get campaign date for notifications
    const { data: campaignInfo } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('date')
      .eq('id', campaign_id)
      .maybeSingle()

    const campaignDate = campaignInfo?.date || 'Unknown'

    await errorHandler.logInfo('RSS processing completed successfully', {
      campaignId: campaign_id,
      articleCount,
      campaignDate
    }, 'rss_step_finalize')

    // Send Slack notification
    try {
      await slack.sendRSSProcessingCompleteAlert(
        campaign_id,
        articleCount,
        campaignDate
      )
      console.log('Slack notification sent')
    } catch (slackError) {
      console.error('Failed to send Slack notification:', slackError)
      // Don't fail the entire step if Slack fails
    }

    console.log(`[Step 7/7] Complete: Campaign finalized with ${articleCount} articles`)

    await completeWorkflowStep(campaign_id, 'finalizing')

    return NextResponse.json({
      success: true,
      message: 'RSS processing workflow complete!',
      campaign_id,
      article_count: articleCount,
      campaign_date: campaignDate,
      status: 'draft',
      workflow_state: 'complete',
      step: '7/7'
    })

  } catch (error) {
    console.error('[Step 7] Finalize failed:', error)

    await failWorkflow(
      body.campaign_id,
      `Finalize step failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )

    return NextResponse.json({
      error: 'Finalize step failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      step: '7/7'
    }, { status: 500 })
  }
}
