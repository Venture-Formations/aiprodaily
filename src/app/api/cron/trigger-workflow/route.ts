import { NextResponse } from 'next/server'
import { ScheduleChecker } from '@/lib/schedule-checker'
import { start } from 'workflow/api'
import { processRSSWorkflow } from '@/lib/workflows/process-rss-workflow'
import { supabaseAdmin } from '@/lib/supabase'
import { withApiHandler } from '@/lib/api-handler'

/**
 * Workflow Trigger Cron
 * Runs every 5 minutes to check if it's time to execute the RSS workflow
 * for any newsletter based on their individual schedules
 *
 * Multi-tenant: Each newsletter has its own schedule in app_settings
 */
export const GET = withApiHandler(
  { authTier: 'system', logContext: 'trigger-workflow' },
  async ({ logger }) => {
    const { data: newsletters, error: newslettersError } = await supabaseAdmin
      .from('publications')
      .select('id, name, slug')
      .eq('is_active', true)

    if (newslettersError || !newsletters || newsletters.length === 0) {
      logger.info('No active newsletters found')
      return NextResponse.json({
        success: true,
        message: 'No active newsletters',
        skipped: true,
        timestamp: new Date().toISOString()
      })
    }

    logger.info({ count: newsletters.length }, 'Checking schedules')

    // RECOVERY: Check for campaigns stuck in 'processing' due to OIDC errors
    const { data: stuckCampaigns } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('id, publication_id, status, created_at')
      .eq('status', 'processing')
      .lt('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // Older than 30 mins

    if (stuckCampaigns && stuckCampaigns.length > 0) {
      logger.info({ count: stuckCampaigns.length }, 'Found stuck campaigns - checking for OIDC recovery')

      for (const campaign of stuckCampaigns) {
        // Check if articles were actually generated despite OIDC error
        const { count: articleCount } = await supabaseAdmin
          .from('articles')
          .select('id', { count: 'exact' })
          .eq('campaign_id', campaign.id)
          .not('content', 'is', null)
          .not('headline', 'is', null)

        // If sufficient articles exist, the work completed but OIDC failed - manually finalize
        if (articleCount && articleCount >= 3) {
          logger.info({ campaignId: campaign.id, articleCount }, 'Campaign has articles - attempting recovery')

          // Check if welcome section exists (indicates finalize step ran)
          const { data: campaignData } = await supabaseAdmin
            .from('newsletter_campaigns')
            .select('welcome_section')
            .eq('id', campaign.id)
            .single()

          if (campaignData?.welcome_section) {
            logger.info({ campaignId: campaign.id }, 'Campaign complete - updating to draft')
            await supabaseAdmin
              .from('newsletter_campaigns')
              .update({ status: 'draft' })
              .eq('id', campaign.id)
          } else {
            logger.info({ campaignId: campaign.id }, 'Campaign incomplete - leaving as processing for retry')
          }
        }
      }
    }

    // Check each newsletter's schedule and start workflows as needed
    const startedWorkflows: string[] = []

    for (const newsletter of newsletters) {
      const shouldRun = await ScheduleChecker.shouldRunRSSProcessing(newsletter.id)

      if (shouldRun) {
        logger.info({ newsletter: newsletter.name, publicationId: newsletter.id }, 'Starting workflow')

        await start(processRSSWorkflow, [{
          trigger: 'cron',
          publication_id: newsletter.id
        }])

        startedWorkflows.push(newsletter.name)
      } else {
        logger.debug({ newsletter: newsletter.name }, 'Not time yet')
      }
    }

    if (startedWorkflows.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No workflows scheduled at this time',
        skipped: true,
        timestamp: new Date().toISOString()
      })
    }

    logger.info({ started: startedWorkflows }, 'Workflows started')

    return NextResponse.json({
      success: true,
      message: `Started ${startedWorkflows.length} workflow(s)`,
      newsletters: startedWorkflows,
      timestamp: new Date().toISOString()
    })
  }
)

export const maxDuration = 60
