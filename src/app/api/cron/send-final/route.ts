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
 * Process final send for a single publication.
 * Returns result object; throws on fatal error (caught by caller for Slack alerting).
 */
async function processFinalSendForPub(pub: { id: string; slug: string }, log: Logger): Promise<{ success: boolean; skipped?: boolean; message?: string; issueId?: string }> {
  // Check if it's time to run final send based on database settings
  const shouldRun = await ScheduleChecker.shouldRunFinalSend(pub.id)

  if (!shouldRun) {
    return { success: true, skipped: true, message: 'Not time to run or already ran today' }
  }

  log.info({ slug: pub.slug }, '=== FINAL SEND STARTED (Time Matched) ===')

  // Get the most recent issue with status 'in_review' or 'changes_made'
  const { data: issue, error } = await supabaseAdmin
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
    .eq('publication_id', pub.id)
    .in('status', ['in_review', 'changes_made'])
    .order('date', { ascending: false })
    .limit(1)
    .single()

  if (error || !issue) {
    log.info({ slug: pub.slug }, 'No issue with in_review or changes_made status found')
    return { success: true, skipped: true, message: 'No issue with in_review or changes_made status' }
  }

  log.info({ issueId: issue.id, date: issue.date, status: issue.status, slug: pub.slug }, 'Found issue')

  // Check if we have any active module articles
  const activeArticles = (issue.module_articles || []).filter((article: any) => article.is_active)
  if (activeArticles.length === 0) {
    log.info({ slug: pub.slug }, 'issue has no active articles, skipping send')
    return { success: true, skipped: true, message: 'No active articles' }
  }

  // Log article positions at final send
  await logFinalArticlePositions(issue.id, log)

  // Check which email provider to use
  const providerSettings = await getEmailProviderSettings(pub.id)
  log.info({ provider: providerSettings.provider, slug: pub.slug }, '[Send Final] Using email provider')

  let result: { success: boolean; campaignId?: string; issueId?: string; error?: string }

  if (providerSettings.provider === 'sendgrid') {
    // Send via SendGrid
    const sendGridService = new SendGridService()
    result = await sendGridService.createFinalCampaign(issue)

    if (!result.success) {
      throw new Error(result.error || 'Failed to create SendGrid campaign')
    }
    log.info({ campaignId: result.campaignId, slug: pub.slug }, 'SendGrid campaign created')
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
    log.info({ campaignId: result.campaignId, slug: pub.slug }, 'MailerLite campaign created')
  }

  // Record ad module usage (ads are now handled via ad_modules system)
  try {
    const issueDate = new Date(issue.date)
    const moduleUsageResult = await ModuleAdSelector.recordUsageSimple(issue.id, issueDate)
    if (moduleUsageResult.recorded > 0) {
      log.info({ recorded: moduleUsageResult.recorded, slug: pub.slug }, '[Send Final] Ad module usage recorded')
    }
  } catch (moduleAdError) {
    log.error({ err: moduleAdError, slug: pub.slug }, '[Send Final] Failed to record ad module usage (non-critical)')
  }

  // Record AI app usage (starts cooldown timer for affiliates)
  try {
    const { AppModuleSelector } = await import('@/lib/ai-app-modules')
    const moduleResult = await AppModuleSelector.recordUsage(issue.id)
    log.info({ recorded: moduleResult.recorded, slug: pub.slug }, '[Send Final] AI app module usage recorded')
  } catch (appError) {
    log.error({ err: appError, slug: pub.slug }, '[Send Final] Failed to record AI app usage (non-critical)')
  }

  // Record poll module usage (stores snapshots for archive)
  try {
    const { PollModuleSelector } = await import('@/lib/poll-modules')
    const pollResult = await PollModuleSelector.recordUsage(issue.id)
    if (pollResult.recorded > 0) {
      log.info({ recorded: pollResult.recorded, slug: pub.slug }, '[Send Final] Poll module usage recorded')
    }
  } catch (pollError) {
    log.error({ err: pollError, slug: pub.slug }, '[Send Final] Failed to record poll module usage (non-critical)')
  }

  // Record SparkLoop rec module usage
  try {
    const { SparkLoopRecModuleSelector } = await import('@/lib/sparkloop-rec-modules')
    const slRecResult = await SparkLoopRecModuleSelector.recordUsage(issue.id)
    if (slRecResult.recorded > 0) {
      log.info({ recorded: slRecResult.recorded, slug: pub.slug }, '[Send Final] SparkLoop rec module usage recorded')
    }
  } catch (slRecError) {
    log.error({ err: slRecError, slug: pub.slug }, '[Send Final] Failed to record SparkLoop rec module usage (non-critical)')
  }

  // Capture the active poll for this issue
  const { poll_id, poll_snapshot } = await capturePollForIssue(issue.id, pub.id, log)

  // Archive the newsletter for website display
  try {
    const archiveResult = await newsletterArchiver.archiveNewsletter({
      issueId: issue.id,
      issueDate: issue.date,
      subjectLine: issue.subject_line || 'Newsletter',
      recipientCount: 0 // Will be updated with actual stats later
    })

    if (!archiveResult.success) {
      log.error({ error: archiveResult.error, slug: pub.slug }, 'Failed to archive newsletter')
    } else {
      log.info({ date: issue.date, slug: pub.slug }, 'Newsletter archived successfully')
    }
  } catch (archiveError) {
    log.error({ err: archiveError, slug: pub.slug }, 'Error archiving newsletter')
  }

  // Update issue status to sent, capture the previous status, and record poll
  const { error: updateError } = await supabaseAdmin
    .from('publication_issues')
    .update({
      status: 'sent',
      status_before_send: issue.status,
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
    log.error({ err: updateError, slug: pub.slug }, 'Failed to update issue status to sent')
  } else {
    log.info({ slug: pub.slug }, 'issue status updated to sent')
    if (poll_id) {
      log.info({ pollTitle: poll_snapshot?.title, slug: pub.slug }, 'Poll recorded')
    }
  }

  // Stage 2 Unassignment - Free up unused article posts
  try {
    const unassignResult = await unassignUnusedArticlePosts(issue.id, log)
    log.info({ unassigned: unassignResult.unassigned, slug: pub.slug }, 'Stage 2 complete: posts recycled back to pool')
  } catch (unassignError) {
    log.error({ err: unassignError, slug: pub.slug }, 'Stage 2 unassignment failed (non-fatal)')
  }

  return { success: true, issueId: issue.id, message: `Final send completed, campaign ${result.campaignId}` }
}

/**
 * Shared final send logic used by both POST and GET handlers.
 */
async function handleFinalSend(log: Logger): Promise<NextResponse> {
  // Get all active publications
  const { data: newsletters } = await supabaseAdmin
    .from('publications')
    .select('id, name, slug')
    .eq('is_active', true)

  if (!newsletters || newsletters.length === 0) {
    return NextResponse.json({
      success: false,
      error: 'No active publications found'
    }, { status: 404 })
  }

  log.info({ count: newsletters.length }, '=== AUTOMATED FINAL SEND CHECK ===')

  const results: Array<{ pubId: string; slug: string; success: boolean; skipped?: boolean; message?: string; error?: string }> = []

  for (const pub of newsletters) {
    try {
      const pubResult = await processFinalSendForPub(pub, log)
      results.push({ pubId: pub.id, slug: pub.slug, ...pubResult })
    } catch (error) {
      log.error({ err: error, slug: pub.slug }, 'Scheduled final newsletter send failed')

      // Send Slack notification for scheduled send failure
      try {
        const slack = new SlackNotificationService()
        const currentCentralTime = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})

        await slack.sendScheduledSendFailureAlert(
          `${pub.slug}:unknown`,
          currentCentralTime,
          error instanceof Error ? error.message : 'Unknown error',
          {
            operation: 'final_send',
            timestamp: new Date().toISOString(),
            publication_slug: pub.slug
          }
        )
      } catch (slackError) {
        log.error({ err: slackError, slug: pub.slug }, 'Failed to send Slack notification for send failure')
      }

      results.push({ pubId: pub.id, slug: pub.slug, success: false, error: String(error) })
    }
  }

  const hasFailures = results.some(r => !r.success && !r.skipped)

  return NextResponse.json({
    success: !hasFailures,
    results,
    timestamp: new Date().toISOString()
  }, hasFailures ? { status: 500 } : undefined)
}

export const POST = withApiHandler(
  { authTier: 'system', logContext: 'send-final' },
  async ({ logger }) => handleFinalSend(logger)
)

export const GET = withApiHandler(
  { authTier: 'system', logContext: 'send-final' },
  async ({ logger }) => handleFinalSend(logger)
)
