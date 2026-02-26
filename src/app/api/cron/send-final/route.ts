import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SendGridService } from '@/lib/sendgrid'
import { MailerLiteService } from '@/lib/mailerlite'
import { ScheduleChecker } from '@/lib/schedule-checker'
import { SlackNotificationService } from '@/lib/slack'
import { newsletterArchiver } from '@/lib/newsletter-archiver'
import { getEmailProviderSettings } from '@/lib/publication-settings'
import { ModuleAdSelector } from '@/lib/ad-modules'
import { withApiHandler } from '@/lib/api-handler'
import type { Logger } from '@/lib/logger'

// Helper function to log article positions at final send
// Re-queries fresh data to capture any changes made after initial issue fetch
async function logFinalArticlePositions(issueId: string, log: Logger) {
  log.info('=== LOGGING ARTICLE POSITIONS FOR FINAL SEND ===')

  // MODULE ARTICLES - Query fresh data grouped by module
  const { data: moduleArticles, error: moduleError } = await supabaseAdmin
    .from('module_articles')
    .select('id, headline, rank, is_active, article_module_id, article_module:article_modules(name)')
    .eq('issue_id', issueId)
    .eq('is_active', true)
    .order('rank', { ascending: true, nullsFirst: false })

  if (moduleError) {
    log.error({ err: moduleError }, 'Failed to fetch module articles')
  }

  const finalActiveArticles = moduleArticles || []
  log.info({ articles: finalActiveArticles.map((a: any) =>
    `${a.article_module?.name}:${a.rank}:${a.headline}`) }, 'Final active module articles')

  // Update final positions for module articles
  for (let i = 0; i < finalActiveArticles.length; i++) {
    const position = i + 1
    const { error: updateError } = await supabaseAdmin
      .from('module_articles')
      .update({ final_position: position })
      .eq('id', finalActiveArticles[i].id)

    if (updateError) {
      log.error({ articleId: finalActiveArticles[i].id, err: updateError }, 'Failed to update final position for article')
    } else {
      log.info({ position, headline: finalActiveArticles[i].headline }, 'Article position set')
    }
  }

  // MANUAL ARTICLES - Query fresh data
  const { data: manualArticles, error: manualError } = await supabaseAdmin
    .from('manual_articles')
    .select('id, title, rank, is_active')
    .eq('issue_id', issueId)
    .eq('is_active', true)
    .order('rank', { ascending: true, nullsFirst: false })
    .limit(5)

  if (manualError) {
    log.error({ err: manualError }, 'Failed to fetch manual articles')
  }

  const finalActiveManualArticles = manualArticles || []
  log.info({ articles: finalActiveManualArticles.map((a: any) => `${a.rank}:${a.title}`) }, 'Final active manual articles')

  // Update final positions for manual articles
  for (let i = 0; i < finalActiveManualArticles.length; i++) {
    const position = i + 1
    const { error: updateError } = await supabaseAdmin
      .from('manual_articles')
      .update({ final_position: position })
      .eq('id', finalActiveManualArticles[i].id)

    if (updateError) {
      log.error({ articleId: finalActiveManualArticles[i].id, err: updateError }, 'Failed to update final position for manual article')
    } else {
      log.info({ position, title: finalActiveManualArticles[i].title }, 'Manual article position set')
    }
  }

  log.info('=== FINAL ARTICLE POSITION LOGGING COMPLETE ===')
}

/**
 * Capture the active poll for this issue at send time
 * Stores both the poll_id and a snapshot of the poll data
 */
async function capturePollForIssue(issueId: string, publicationId: string, log: Logger) {
  log.info({ issueId }, '[Polls] Capturing active poll for issue')

  // Get active poll for this publication
  const { data: activePoll, error } = await supabaseAdmin
    .from('polls')
    .select('id, title, question, options')
    .eq('publication_id', publicationId)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
    log.error({ err: error }, '[Polls] Error fetching active poll')
    return { poll_id: null, poll_snapshot: null }
  }

  if (!activePoll) {
    log.info('[Polls] No active poll found for this publication')
    return { poll_id: null, poll_snapshot: null }
  }

  const pollSnapshot = {
    id: activePoll.id,
    title: activePoll.title,
    question: activePoll.question,
    options: activePoll.options
  }

  log.info({ pollId: activePoll.id, title: activePoll.title }, '[Polls] Captured poll')
  return { poll_id: activePoll.id, poll_snapshot: pollSnapshot }
}

/**
 * Stage 2 Unassignment: Recycle posts that had articles generated but weren't selected
 * Runs AFTER final_position is set and issue is sent
 */
async function unassignUnusedArticlePosts(issueId: string, log: Logger) {
  log.info('=== STAGE 2: UNASSIGNING UNUSED ARTICLE POSTS ===')

  // Find posts with module_articles that don't have final_position set (not selected for send)
  const { data: unusedModuleArticles } = await supabaseAdmin
    .from('module_articles')
    .select('post_id')
    .eq('issue_id', issueId)
    .is('final_position', null) // Articles generated but NOT in final send

  const unusedPostIds = (unusedModuleArticles?.map(a => a.post_id) || []).filter(Boolean)

  if (unusedPostIds.length === 0) {
    log.info('[Stage 2] All generated articles were used in final send')
    return { unassigned: 0 }
  }

  // Unassign posts back to pool (set issueId = NULL)
  const { error } = await supabaseAdmin
    .from('rss_posts')
    .update({ issue_id: null })
    .in('id', unusedPostIds)

  if (error) {
    log.error({ err: error }, '[Stage 2] Error unassigning posts')
    throw error
  }

  log.info({ count: unusedPostIds.length }, '[Stage 2] Unassigned posts back to pool')
  log.info('=== STAGE 2 UNASSIGNMENT COMPLETE ===')

  return { unassigned: unusedPostIds.length }
}

/**
 * Shared final send logic used by both POST and GET handlers.
 * Keeps its own try/catch for Slack failure alerting.
 */
async function handleFinalSend(log: Logger): Promise<NextResponse> {
  let issue: any = null

  try {
    // TODO: This legacy route should be deprecated in favor of trigger-workflow
    // Get first active newsletter for backward compatibility
    const { data: activeNewsletter } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!activeNewsletter) {
      return NextResponse.json({
        success: false,
        error: 'No active newsletter found'
      }, { status: 404 })
    }

    log.info('=== AUTOMATED FINAL SEND CHECK ===')

    // Check if it's time to run final send based on database settings
    const shouldRun = await ScheduleChecker.shouldRunFinalSend(activeNewsletter.id)

    if (!shouldRun) {
      return NextResponse.json({
        success: true,
        message: 'Not time to run final send or already ran today',
        skipped: true,
        timestamp: new Date().toISOString()
      })
    }

    log.info('=== FINAL SEND STARTED (Time Matched) ===')

    // Get accounting newsletter ID
    const { data: newsletter } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('slug', 'accounting')
      .single()

    if (!newsletter) {
      return NextResponse.json({
        success: false,
        error: 'Accounting newsletter not found'
      }, { status: 404 })
    }

    // Get the most recent issue with status 'in_review' or 'changes_made' (for testing/flexibility)
    // This allows sending review issues immediately instead of waiting for date match
    const { data, error } = await supabaseAdmin
      .from('publication_issues')
      .select(`
        *,
        module_articles:module_articles(
          *,
          rss_post:rss_posts(
            *,
            rss_feed:rss_feeds(*)
          ),
          article_module:article_modules(name, display_order)
        ),
        manual_articles:manual_articles(*)
      `)
      .eq('publication_id', newsletter.id)
      .in('status', ['in_review', 'changes_made'])
      .order('date', { ascending: false })
      .limit(1)
      .single()

    issue = data

    if (error || !issue) {
      log.info('No issue with in_review or changes_made status found')
      return NextResponse.json({
        message: 'No issue with in_review or changes_made status found',
        timestamp: new Date().toISOString()
      })
    }

    log.info({ issueId: issue.id, date: issue.date, status: issue.status }, 'Found issue')

    // Check if we have any active module articles
    const activeArticles = (issue.module_articles || []).filter((article: any) => article.is_active)
    if (activeArticles.length === 0) {
      log.info('issue has no active articles, skipping send')
      return NextResponse.json({
        message: 'issue has no active articles, skipping send',
        timestamp: new Date().toISOString()
      })
    }

    // Log article positions at final send
    await logFinalArticlePositions(issue.id, log)

    // Check which email provider to use
    const providerSettings = await getEmailProviderSettings(newsletter.id)
    log.info({ provider: providerSettings.provider }, '[Send Final] Using email provider')

    let result: { success: boolean; campaignId?: string; issueId?: string; error?: string }

    if (providerSettings.provider === 'sendgrid') {
      // Send via SendGrid
      const sendGridService = new SendGridService()
      result = await sendGridService.createFinalCampaign(issue)

      if (!result.success) {
        throw new Error(result.error || 'Failed to create SendGrid campaign')
      }
      log.info({ campaignId: result.campaignId }, 'SendGrid campaign created')
    } else {
      // Send via MailerLite
      const mailerliteService = new MailerLiteService()
      const mlResult = await mailerliteService.createFinalissue(issue, providerSettings.mainGroupId, false)

      result = {
        success: mlResult.success,
        campaignId: mlResult.issueId,
        error: mlResult.success ? undefined : 'Failed to create MailerLite campaign'
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to create MailerLite campaign')
      }
      log.info({ campaignId: result.campaignId }, 'MailerLite campaign created')
    }

    // Record ad module usage (ads are now handled via ad_modules system)
    try {
      const issueDate = new Date(issue.date)
      const moduleUsageResult = await ModuleAdSelector.recordUsageSimple(issue.id, issueDate)
      if (moduleUsageResult.recorded > 0) {
        log.info({ recorded: moduleUsageResult.recorded }, '[Send Final] Ad module usage recorded')
      }
    } catch (moduleAdError) {
      log.error({ err: moduleAdError }, '[Send Final] Failed to record ad module usage (non-critical)')
      // Don't fail the send if ad module tracking fails
    }

    // Record AI app usage (starts cooldown timer for affiliates)
    try {
      const { AppModuleSelector } = await import('@/lib/ai-app-modules')
      const moduleResult = await AppModuleSelector.recordUsage(issue.id)
      log.info({ recorded: moduleResult.recorded }, '[Send Final] AI app module usage recorded')
    } catch (appError) {
      log.error({ err: appError }, '[Send Final] Failed to record AI app usage (non-critical)')
      // Don't fail the send if app tracking fails
    }

    // Record poll module usage (stores snapshots for archive)
    try {
      const { PollModuleSelector } = await import('@/lib/poll-modules')
      const pollResult = await PollModuleSelector.recordUsage(issue.id)
      if (pollResult.recorded > 0) {
        log.info({ recorded: pollResult.recorded }, '[Send Final] Poll module usage recorded')
      }
    } catch (pollError) {
      log.error({ err: pollError }, '[Send Final] Failed to record poll module usage (non-critical)')
      // Don't fail the send if poll tracking fails
    }

    // Record SparkLoop rec module usage
    try {
      const { SparkLoopRecModuleSelector } = await import('@/lib/sparkloop-rec-modules')
      const slRecResult = await SparkLoopRecModuleSelector.recordUsage(issue.id)
      if (slRecResult.recorded > 0) {
        log.info({ recorded: slRecResult.recorded }, '[Send Final] SparkLoop rec module usage recorded')
      }
    } catch (slRecError) {
      log.error({ err: slRecError }, '[Send Final] Failed to record SparkLoop rec module usage (non-critical)')
    }

    // Capture the active poll for this issue
    const { poll_id, poll_snapshot } = await capturePollForIssue(issue.id, newsletter.id, log)

    // Archive the newsletter for website display
    try {
      const archiveResult = await newsletterArchiver.archiveNewsletter({
        issueId: issue.id,
        issueDate: issue.date,
        subjectLine: issue.subject_line || 'Newsletter',
        recipientCount: 0 // Will be updated with actual stats later
      })

      if (!archiveResult.success) {
        log.error({ error: archiveResult.error }, 'Failed to archive newsletter')
        // Don't fail the send if archiving fails
      } else {
        log.info({ date: issue.date }, 'Newsletter archived successfully')
      }
    } catch (archiveError) {
      log.error({ err: archiveError }, 'Error archiving newsletter')
      // Don't fail the send if archiving fails
    }

    // Update issue status to sent, capture the previous status, and record poll
    const { error: updateError } = await supabaseAdmin
      .from('publication_issues')
      .update({
        status: 'sent',
        status_before_send: issue.status, // Capture the status before sending
        final_sent_at: new Date().toISOString(),
        poll_id: poll_id,
        poll_snapshot: poll_snapshot,
        metrics: {
          ...issue.metrics,
          sendgrid_campaign_id: result.campaignId,
          sent_timestamp: new Date().toISOString()
        }
      })
      .eq('id', issue.id)

    if (updateError) {
      log.error({ err: updateError }, 'Failed to update issue status to sent')
      // Don't fail the entire operation - the email was sent successfully
    } else {
      log.info('issue status updated to sent')
      if (poll_id) {
        log.info({ pollTitle: poll_snapshot?.title }, 'Poll recorded')
      }
    }

    // Stage 2 Unassignment - Free up unused article posts
    try {
      const unassignResult = await unassignUnusedArticlePosts(issue.id, log)
      log.info({ unassigned: unassignResult.unassigned }, 'Stage 2 complete: posts recycled back to pool')
    } catch (unassignError) {
      log.error({ err: unassignError }, 'Stage 2 unassignment failed (non-fatal)')
      // Don't fail the entire send if unassignment fails
    }

    return NextResponse.json({
      success: true,
      message: 'Final newsletter sent successfully via SendGrid',
      issueId: issue.id,
      sendgridCampaignId: result.campaignId,
      pollId: poll_id,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    log.error({ err: error }, 'Scheduled final newsletter send failed')

    // Send Slack notification for scheduled send failure
    try {
      const slack = new SlackNotificationService()
      const currentCentralTime = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})

      await slack.sendScheduledSendFailureAlert(
        issue?.id || 'Unknown',
        currentCentralTime,
        error instanceof Error ? error.message : 'Unknown error',
        {
          operation: 'final_send',
          timestamp: new Date().toISOString(),
          attempted_issue_status: issue?.status || 'Unknown'
        }
      )
    } catch (slackError) {
      log.error({ err: slackError }, 'Failed to send Slack notification for send failure')
    }

    return NextResponse.json({
      error: 'Final newsletter send failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export const POST = withApiHandler(
  { authTier: 'system', logContext: 'send-final' },
  async ({ logger }) => handleFinalSend(logger)
)

export const GET = withApiHandler(
  { authTier: 'system', logContext: 'send-final' },
  async ({ logger }) => handleFinalSend(logger)
)
