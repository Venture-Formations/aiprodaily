import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { ArticleArchiveService } from '@/lib/article-archive'
import { ErrorHandler } from '@/lib/slack'
import { startWorkflowStep, completeWorkflowStep, failWorkflow } from '@/lib/workflow-state'

/**
 * Step 1: Archive old campaign data and clear previous articles/posts
 * This is the first step in the RSS processing workflow
 * Uses state machine pattern - coordinator triggers this when state = 'pending_archive'
 */
export async function POST(request: NextRequest) {
  let campaign_id: string | undefined

  try {
    const body = await request.json()
    campaign_id = body.campaign_id

    if (!campaign_id) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 })
    }


    // Start workflow step - marks as "archiving" and prevents race conditions
    const startResult = await startWorkflowStep(campaign_id, 'pending_archive')
    if (!startResult.success) {
      return NextResponse.json({
        success: false,
        message: startResult.message,
        step: '1/7'
      }, { status: 409 })
    }

    const archiveService = new ArticleArchiveService()
    const errorHandler = new ErrorHandler()

    // Archive existing articles and posts before clearing (PRESERVES POSITION DATA!)
    try {
      await archiveService.archiveCampaignArticles(campaign_id, 'rss_processing_clear')
    } catch (archiveError) {
      await errorHandler.logInfo('Archive failed but RSS processing continuing', {
        campaignId: campaign_id,
        archiveError: archiveError instanceof Error ? archiveError.message : 'Unknown error'
      }, 'rss_step_archive')
    }


    // Delete existing articles for this campaign
    const { error: articlesDeleteError } = await supabaseAdmin
      .from('articles')
      .delete()
      .eq('campaign_id', campaign_id)


    // Delete existing secondary articles for this campaign
    const { error: secondaryDeleteError } = await supabaseAdmin
      .from('secondary_articles')
      .delete()
      .eq('campaign_id', campaign_id)


    // Delete existing posts for this campaign
    const { error: postsDeleteError } = await supabaseAdmin
      .from('rss_posts')
      .delete()
      .eq('campaign_id', campaign_id)



    // Complete workflow step - transitions to 'pending_fetch_feeds'
    await completeWorkflowStep(campaign_id, 'archiving')

    return NextResponse.json({
      success: true,
      message: 'Archive step completed',
      campaign_id,
      next_state: 'pending_fetch_feeds',
      step: '1/7'
    })

  } catch (error) {
    console.error('[Step 1] Archive failed:', error)

    // Mark workflow as failed if we have campaign_id
    if (campaign_id) {
      await failWorkflow(
        campaign_id,
        `Archive step failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }

    return NextResponse.json({
      error: 'Archive step failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      step: '1/7'
    }, { status: 500 })
  }
}
