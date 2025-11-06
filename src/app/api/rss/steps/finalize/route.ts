import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { ErrorHandler, SlackNotificationService } from '@/lib/slack'
import { startWorkflowStep, completeWorkflowStep, failWorkflow } from '@/lib/workflow-state'
import { AdScheduler } from '@/lib/ad-scheduler'

/**
 * Step 6: Finalize campaign
 * Updates campaign status to draft and sends Slack notifications
 */
export async function POST(request: NextRequest) {
  let campaign_id: string | undefined

  try {
    const body = await request.json()
    campaign_id = body.campaign_id

    if (!campaign_id) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 })
    }


    const startResult = await startWorkflowStep(campaign_id, 'pending_finalize')
    if (!startResult.success) {
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

    // Select and assign advertisement for this campaign
    try {
      const { data: campaignData } = await supabaseAdmin
        .from('newsletter_campaigns')
        .select('date')
        .eq('id', campaign_id)
        .single()

      if (campaignData) {
        const selectedAd = await AdScheduler.selectAdForCampaign({
          campaignId: campaign_id,
          campaignDate: campaignData.date
        })

        if (selectedAd) {
          // Check if ad already assigned to prevent duplicates
          const { data: existingAssignment } = await supabaseAdmin
            .from('campaign_advertisements')
            .select('id')
            .eq('campaign_id', campaign_id)
            .single()

          if (!existingAssignment) {
            // Store the selected ad (without recording usage yet)
            await supabaseAdmin
              .from('campaign_advertisements')
              .insert({
                campaign_id: campaign_id,
                advertisement_id: selectedAd.id,
                campaign_date: campaignData.date,
                used_at: new Date().toISOString()
              })

            console.log(`[Finalize] Selected ad: ${selectedAd.title} (ID: ${selectedAd.id})`)
          } else {
            console.log('[Finalize] Ad already assigned to this campaign')
          }
        } else {
          console.log('[Finalize] No active ads available for this campaign')
        }
      }
    } catch (adError) {
      console.error('[Finalize] Error selecting ad:', adError)
      // Don't fail the entire step if ad selection fails
    }

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
    } catch (slackError) {
      console.error('Failed to send Slack notification:', slackError)
      // Don't fail the entire step if Slack fails
    }


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

    if (campaign_id) {
      await failWorkflow(
        campaign_id,
        `Finalize step failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }

    return NextResponse.json({
      error: 'Finalize step failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      step: '7/7'
    }, { status: 500 })
  }
}
