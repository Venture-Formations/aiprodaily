import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SendGridService } from '@/lib/sendgrid'
import { MailerLiteService } from '@/lib/mailerlite'
import { ScheduleChecker } from '@/lib/schedule-checker'
import { SlackNotificationService } from '@/lib/slack'
import { newsletterArchiver } from '@/lib/newsletter-archiver'
import { getEmailProviderSettings } from '@/lib/publication-settings'
import { ModuleAdSelector } from '@/lib/ad-modules'

// Helper function to log article positions at final send
// Re-queries fresh data to capture any changes made after initial issue fetch
async function logFinalArticlePositions(issueId: string) {
  console.log('=== LOGGING ARTICLE POSITIONS FOR FINAL SEND ===')

  // MODULE ARTICLES - Query fresh data grouped by module
  const { data: moduleArticles, error: moduleError } = await supabaseAdmin
    .from('module_articles')
    .select('id, headline, rank, is_active, article_module_id, article_module:article_modules(name)')
    .eq('issue_id', issueId)
    .eq('is_active', true)
    .order('rank', { ascending: true, nullsFirst: false })

  if (moduleError) {
    console.error('Failed to fetch module articles:', moduleError)
  }

  const finalActiveArticles = moduleArticles || []
  console.log('Final active module articles:', finalActiveArticles.map((a: any) =>
    `ID: ${a.id}, Module: ${a.article_module?.name}, Rank: ${a.rank}, Headline: ${a.headline}`))

  // Update final positions for module articles
  for (let i = 0; i < finalActiveArticles.length; i++) {
    const position = i + 1
    const { error: updateError } = await supabaseAdmin
      .from('module_articles')
      .update({ final_position: position })
      .eq('id', finalActiveArticles[i].id)

    if (updateError) {
      console.error(`Failed to update final position for article ${finalActiveArticles[i].id}:`, updateError)
    } else {
      console.log(`✓ Article position ${position}: ${finalActiveArticles[i].headline}`)
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
    console.error('Failed to fetch manual articles:', manualError)
  }

  const finalActiveManualArticles = manualArticles || []
  console.log('Final active manual articles:', finalActiveManualArticles.map((a: any) => `ID: ${a.id}, Rank: ${a.rank}, Title: ${a.title}`))

  // Update final positions for manual articles
  for (let i = 0; i < finalActiveManualArticles.length; i++) {
    const position = i + 1
    const { error: updateError } = await supabaseAdmin
      .from('manual_articles')
      .update({ final_position: position })
      .eq('id', finalActiveManualArticles[i].id)

    if (updateError) {
      console.error(`Failed to update final position for manual article ${finalActiveManualArticles[i].id}:`, updateError)
    } else {
      console.log(`✓ Manual article position ${position}: ${finalActiveManualArticles[i].title}`)
    }
  }

  console.log('=== FINAL ARTICLE POSITION LOGGING COMPLETE ===')
}

/**
 * Capture the active poll for this issue at send time
 * Stores both the poll_id and a snapshot of the poll data
 */
async function capturePollForIssue(issueId: string, publicationId: string) {
  console.log('[Polls] Capturing active poll for issue:', issueId)

  // Get active poll for this publication
  const { data: activePoll, error } = await supabaseAdmin
    .from('polls')
    .select('id, title, question, options')
    .eq('publication_id', publicationId)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
    console.error('[Polls] Error fetching active poll:', error)
    return { poll_id: null, poll_snapshot: null }
  }

  if (!activePoll) {
    console.log('[Polls] No active poll found for this publication')
    return { poll_id: null, poll_snapshot: null }
  }

  const pollSnapshot = {
    id: activePoll.id,
    title: activePoll.title,
    question: activePoll.question,
    options: activePoll.options
  }

  console.log(`[Polls] Captured poll: ${activePoll.title} (${activePoll.id})`)
  return { poll_id: activePoll.id, poll_snapshot: pollSnapshot }
}

/**
 * Stage 2 Unassignment: Recycle posts that had articles generated but weren't selected
 * Runs AFTER final_position is set and issue is sent
 */
async function unassignUnusedArticlePosts(issueId: string) {
  console.log('=== STAGE 2: UNASSIGNING UNUSED ARTICLE POSTS ===')

  // Find posts with module_articles that don't have final_position set (not selected for send)
  const { data: unusedModuleArticles } = await supabaseAdmin
    .from('module_articles')
    .select('post_id')
    .eq('issue_id', issueId)
    .is('final_position', null) // Articles generated but NOT in final send

  const unusedPostIds = (unusedModuleArticles?.map(a => a.post_id) || []).filter(Boolean)

  if (unusedPostIds.length === 0) {
    console.log('[Stage 2] All generated articles were used in final send')
    return { unassigned: 0 }
  }

  // Unassign posts back to pool (set issueId = NULL)
  const { error } = await supabaseAdmin
    .from('rss_posts')
    .update({ issue_id: null })
    .in('id', unusedPostIds)

  if (error) {
    console.error('[Stage 2] Error unassigning posts:', error.message)
    throw error
  }

  console.log(`[Stage 2] ✓ Unassigned ${unusedPostIds.length} posts back to pool`)
  console.log('=== STAGE 2 UNASSIGNMENT COMPLETE ===')

  return { unassigned: unusedPostIds.length }
}

export async function POST(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

    console.log('=== AUTOMATED FINAL SEND CHECK ===')
    console.log('Time:', new Date().toISOString())

    // Check if it's time to run final send based on database settings
    const shouldRun = await ScheduleChecker.shouldRunFinalSend(activeNewsletter.id)

    if (!shouldRun) {
      // Check if there's a issue that's ready to send but missed its window
      const { data: readyIssues } = await supabaseAdmin
        .from('publication_issues')
        .select('id, date, status, created_at')
        .eq('status', 'ready_to_send')
        .order('created_at', { ascending: false })
        .limit(5)

      if (readyIssues && readyIssues.length > 0) {
        // There are issues ready but we're not sending - this could indicate a timing issue
        const slack = new SlackNotificationService()

        await slack.sendAlert(
          `⏰ Scheduled Send Check: Found ${readyIssues.length} issues with 'ready_to_send' status but shouldRun returned false. This may indicate a timing configuration issue.`,
          'warn',
          'scheduled_send_timing'
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Not time to run final send or already ran today',
        skipped: true,
        timestamp: new Date().toISOString()
      })
    }

    console.log('=== FINAL SEND STARTED (Time Matched) ===')
    console.log('Central Time:', new Date().toLocaleString("en-US", {timeZone: "America/Chicago"}))

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
      console.log('No issue with in_review or changes_made status found')
      return NextResponse.json({
        message: 'No issue with in_review or changes_made status found',
        timestamp: new Date().toISOString()
      })
    }

    console.log(`Found issue: ${issue.id} (date: ${issue.date}, status: ${issue.status})`)

    // Check if we have any active module articles
    const activeArticles = (issue.module_articles || []).filter((article: any) => article.is_active)
    if (activeArticles.length === 0) {
      console.log('issue has no active articles, skipping send')
      return NextResponse.json({
        message: 'issue has no active articles, skipping send',
        timestamp: new Date().toISOString()
      })
    }

    // Log article positions at final send
    await logFinalArticlePositions(issue.id)

    // Check which email provider to use
    const providerSettings = await getEmailProviderSettings(newsletter.id)
    console.log(`[Send Final] Using email provider: ${providerSettings.provider}`)

    let result: { success: boolean; campaignId?: string; issueId?: string; error?: string }

    if (providerSettings.provider === 'sendgrid') {
      // Send via SendGrid
      const sendGridService = new SendGridService()
      result = await sendGridService.createFinalCampaign(issue)

      if (!result.success) {
        throw new Error(result.error || 'Failed to create SendGrid campaign')
      }
      console.log('SendGrid campaign created:', result.campaignId)
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
      console.log('MailerLite campaign created:', result.campaignId)
    }

    // Record ad module usage (ads are now handled via ad_modules system)
    try {
      const issueDate = new Date(issue.date)
      const moduleUsageResult = await ModuleAdSelector.recordUsageSimple(issue.id, issueDate)
      if (moduleUsageResult.recorded > 0) {
        console.log(`[Send Final] ✓ Ad module usage recorded (${moduleUsageResult.recorded} ads)`)
      }
    } catch (moduleAdError) {
      console.error('[Send Final] Failed to record ad module usage (non-critical):', moduleAdError)
      // Don't fail the send if ad module tracking fails
    }

    // Record AI app usage (starts cooldown timer for affiliates)
    try {
      const { AppModuleSelector } = await import('@/lib/ai-app-modules')
      const moduleResult = await AppModuleSelector.recordUsage(issue.id)
      console.log(`[Send Final] ✓ AI app module usage recorded (${moduleResult.recorded} modules, cooldown started)`)
    } catch (appError) {
      console.error('[Send Final] Failed to record AI app usage (non-critical):', appError)
      // Don't fail the send if app tracking fails
    }

    // Record poll module usage (stores snapshots for archive)
    try {
      const { PollModuleSelector } = await import('@/lib/poll-modules')
      const pollResult = await PollModuleSelector.recordUsage(issue.id)
      if (pollResult.recorded > 0) {
        console.log(`[Send Final] ✓ Poll module usage recorded (${pollResult.recorded} polls)`)
      }
    } catch (pollError) {
      console.error('[Send Final] Failed to record poll module usage (non-critical):', pollError)
      // Don't fail the send if poll tracking fails
    }

    // Record SparkLoop rec module usage
    try {
      const { SparkLoopRecModuleSelector } = await import('@/lib/sparkloop-rec-modules')
      const slRecResult = await SparkLoopRecModuleSelector.recordUsage(issue.id)
      if (slRecResult.recorded > 0) {
        console.log(`[Send Final] ✓ SparkLoop rec module usage recorded (${slRecResult.recorded} modules)`)
      }
    } catch (slRecError) {
      console.error('[Send Final] Failed to record SparkLoop rec module usage (non-critical):', slRecError)
    }

    // Capture the active poll for this issue
    const { poll_id, poll_snapshot } = await capturePollForIssue(issue.id, newsletter.id)

    // Archive the newsletter for website display
    try {
      const archiveResult = await newsletterArchiver.archiveNewsletter({
        issueId: issue.id,
        issueDate: issue.date,
        subjectLine: issue.subject_line || 'Newsletter',
        recipientCount: 0 // Will be updated with actual stats later
      })

      if (!archiveResult.success) {
        console.error('Failed to archive newsletter:', archiveResult.error)
        // Don't fail the send if archiving fails
      } else {
        console.log('✓ Newsletter archived successfully for', issue.date)
      }
    } catch (archiveError) {
      console.error('Error archiving newsletter:', archiveError)
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
      console.error('Failed to update issue status to sent:', updateError)
      // Don't fail the entire operation - the email was sent successfully
    } else {
      console.log('issue status updated to sent')
      if (poll_id) {
        console.log(`✓ Poll recorded: ${poll_snapshot?.title}`)
      }
    }

    // 🔄 Stage 2 Unassignment - Free up unused article posts
    try {
      const unassignResult = await unassignUnusedArticlePosts(issue.id)
      console.log(`✓ Stage 2 complete: ${unassignResult.unassigned} posts recycled back to pool`)
    } catch (unassignError) {
      console.error('Stage 2 unassignment failed (non-fatal):', unassignError)
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
    console.error('Scheduled final newsletter send failed:', error)

    // Send Slack notification for scheduled send failure
    try {
      const slack = new SlackNotificationService()
      const currentCentralTime = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})

      await slack.sendScheduledSendFailureAlert(
        issue?.id || 'Unknown',
        currentCentralTime,
        error instanceof Error ? error.message : 'Unknown error',
        {
          operation: 'final_send_post',
          timestamp: new Date().toISOString(),
          attempted_issue_status: issue?.status || 'Unknown'
        }
      )
    } catch (slackError) {
      console.error('Failed to send Slack notification for send failure:', slackError)
    }

    return NextResponse.json({
      error: 'Final newsletter send failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Handle GET requests from Vercel cron (no auth header, uses URL secret)
export async function GET(request: NextRequest) {
  let issue: any = null

  try {
    // For Vercel cron: check secret in URL params, for manual: require secret param
    const searchParams = new URL(request.url).searchParams
    const secret = searchParams.get('secret')

    // Allow both manual testing (with secret param) and Vercel cron (no auth needed)
    const isVercelCron = !secret && !searchParams.has('secret')
    const isManualTest = secret === process.env.CRON_SECRET

    if (!isVercelCron && !isManualTest) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    console.log('=== AUTOMATED FINAL SEND CHECK (GET) ===')
    console.log('Time:', new Date().toISOString())
    console.log('Request type:', isVercelCron ? 'Vercel Cron' : 'Manual Test')

    // Check if it's time to run final send based on database settings
    const shouldRun = await ScheduleChecker.shouldRunFinalSend(activeNewsletter.id)

    if (!shouldRun) {
      // Check if there's a issue that's ready to send but missed its window
      const { data: readyIssues } = await supabaseAdmin
        .from('publication_issues')
        .select('id, date, status, created_at')
        .eq('status', 'ready_to_send')
        .order('created_at', { ascending: false })
        .limit(5)

      if (readyIssues && readyIssues.length > 0) {
        // There are issues ready but we're not sending - this could indicate a timing issue
        const slack = new SlackNotificationService()

        await slack.sendAlert(
          `⏰ Scheduled Send Check: Found ${readyIssues.length} issues with 'ready_to_send' status but shouldRun returned false. This may indicate a timing configuration issue.`,
          'warn',
          'scheduled_send_timing'
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Not time to run final send or already ran today',
        skipped: true,
        timestamp: new Date().toISOString()
      })
    }

    console.log('=== FINAL SEND STARTED (Time Matched) ===')
    console.log('Central Time:', new Date().toLocaleString("en-US", {timeZone: "America/Chicago"}))

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
      console.log('No issue with in_review or changes_made status found')
      return NextResponse.json({
        message: 'No issue with in_review or changes_made status found',
        timestamp: new Date().toISOString()
      })
    }

    console.log(`Found issue: ${issue.id} (date: ${issue.date}, status: ${issue.status})`)

    // Check if we have any active module articles
    const activeArticles = (issue.module_articles || []).filter((article: any) => article.is_active)
    if (activeArticles.length === 0) {
      console.log('issue has no active articles, skipping send')
      return NextResponse.json({
        message: 'issue has no active articles, skipping send',
        timestamp: new Date().toISOString()
      })
    }

    // Log article positions at final send
    await logFinalArticlePositions(issue.id)

    // Check which email provider to use
    const providerSettings = await getEmailProviderSettings(newsletter.id)
    console.log(`[Send Final] Using email provider: ${providerSettings.provider}`)

    let result: { success: boolean; campaignId?: string; issueId?: string; error?: string }

    if (providerSettings.provider === 'sendgrid') {
      // Send via SendGrid
      const sendGridService = new SendGridService()
      result = await sendGridService.createFinalCampaign(issue)

      if (!result.success) {
        throw new Error(result.error || 'Failed to create SendGrid campaign')
      }
      console.log('SendGrid campaign created:', result.campaignId)
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
      console.log('MailerLite campaign created:', result.campaignId)
    }

    // Record ad module usage (ads are now handled via ad_modules system)
    try {
      const issueDate = new Date(issue.date)
      const moduleUsageResult = await ModuleAdSelector.recordUsageSimple(issue.id, issueDate)
      if (moduleUsageResult.recorded > 0) {
        console.log(`[Send Final] ✓ Ad module usage recorded (${moduleUsageResult.recorded} ads)`)
      }
    } catch (moduleAdError) {
      console.error('[Send Final] Failed to record ad module usage (non-critical):', moduleAdError)
      // Don't fail the send if ad module tracking fails
    }

    // Record AI app usage (starts cooldown timer for affiliates)
    try {
      const { AppModuleSelector } = await import('@/lib/ai-app-modules')
      const moduleResult = await AppModuleSelector.recordUsage(issue.id)
      console.log(`[Send Final] ✓ AI app module usage recorded (${moduleResult.recorded} modules, cooldown started)`)
    } catch (appError) {
      console.error('[Send Final] Failed to record AI app usage (non-critical):', appError)
      // Don't fail the send if app tracking fails
    }

    // Record poll module usage (stores snapshots for archive)
    try {
      const { PollModuleSelector } = await import('@/lib/poll-modules')
      const pollResult = await PollModuleSelector.recordUsage(issue.id)
      if (pollResult.recorded > 0) {
        console.log(`[Send Final] ✓ Poll module usage recorded (${pollResult.recorded} polls)`)
      }
    } catch (pollError) {
      console.error('[Send Final] Failed to record poll module usage (non-critical):', pollError)
      // Don't fail the send if poll tracking fails
    }

    // Record SparkLoop rec module usage
    try {
      const { SparkLoopRecModuleSelector } = await import('@/lib/sparkloop-rec-modules')
      const slRecResult = await SparkLoopRecModuleSelector.recordUsage(issue.id)
      if (slRecResult.recorded > 0) {
        console.log(`[Send Final] ✓ SparkLoop rec module usage recorded (${slRecResult.recorded} modules)`)
      }
    } catch (slRecError) {
      console.error('[Send Final] Failed to record SparkLoop rec module usage (non-critical):', slRecError)
    }

    // Capture the active poll for this issue
    const { poll_id, poll_snapshot } = await capturePollForIssue(issue.id, newsletter.id)

    // Archive the newsletter for website display
    try {
      const archiveResult = await newsletterArchiver.archiveNewsletter({
        issueId: issue.id,
        issueDate: issue.date,
        subjectLine: issue.subject_line || 'Newsletter',
        recipientCount: 0 // Will be updated with actual stats later
      })

      if (!archiveResult.success) {
        console.error('Failed to archive newsletter:', archiveResult.error)
        // Don't fail the send if archiving fails
      } else {
        console.log('✓ Newsletter archived successfully for', issue.date)
      }
    } catch (archiveError) {
      console.error('Error archiving newsletter:', archiveError)
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
      console.error('Failed to update issue status to sent:', updateError)
      // Don't fail the entire operation - the email was sent successfully
    } else {
      console.log('issue status updated to sent')
      if (poll_id) {
        console.log(`✓ Poll recorded: ${poll_snapshot?.title}`)
      }
    }

    // 🔄 Stage 2 Unassignment - Free up unused article posts
    try {
      const unassignResult = await unassignUnusedArticlePosts(issue.id)
      console.log(`✓ Stage 2 complete: ${unassignResult.unassigned} posts recycled back to pool`)
    } catch (unassignError) {
      console.error('Stage 2 unassignment failed (non-fatal):', unassignError)
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
    console.error('Scheduled final newsletter send failed:', error)

    // Send Slack notification for scheduled send failure
    try {
      const slack = new SlackNotificationService()
      const currentCentralTime = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})

      await slack.sendScheduledSendFailureAlert(
        issue?.id || 'Unknown',
        currentCentralTime,
        error instanceof Error ? error.message : 'Unknown error',
        {
          operation: 'final_send_get',
          timestamp: new Date().toISOString(),
          attempted_issue_status: issue?.status || 'Unknown'
        }
      )
    } catch (slackError) {
      console.error('Failed to send Slack notification for send failure:', slackError)
    }

    return NextResponse.json({
      error: 'Final newsletter send failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}