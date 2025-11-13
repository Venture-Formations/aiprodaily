import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { MailerLiteService } from '@/lib/mailerlite'
import { ScheduleChecker } from '@/lib/schedule-checker'
import { SlackNotificationService } from '@/lib/slack'
import { newsletterArchiver } from '@/lib/newsletter-archiver'

// Helper function to log article positions at final send
async function logFinalArticlePositions(issue: any) {
  console.log('=== LOGGING ARTICLE POSITIONS FOR FINAL SEND ===')

  // PRIMARY ARTICLES
  const finalActiveArticles = issue.articles
    .filter((article: any) => article.is_active)
    .sort((a: any, b: any) => (a.rank || 999) - (b.rank || 999))
    .slice(0, 3) // Top 3 for final send

  console.log('Final active primary articles:', finalActiveArticles.map((a: any) => `ID: ${a.id}, Rank: ${a.rank}, Headline: ${a.headline}`))

  // Update final positions for primary articles
  for (let i = 0; i < finalActiveArticles.length; i++) {
    const position = i + 1
    const { error: updateError } = await supabaseAdmin
      .from('articles')
      .update({ final_position: position })
      .eq('id', finalActiveArticles[i].id)

    if (updateError) {
      console.error(`Failed to update final position for primary article ${finalActiveArticles[i].id}:`, updateError)
    } else {
      console.log(`✓ Primary article position ${position}: ${finalActiveArticles[i].headline}`)
    }
  }

  // SECONDARY ARTICLES
  const finalActiveSecondaryArticles = (issue.secondary_articles || [])
    .filter((article: any) => article.is_active)
    .sort((a: any, b: any) => (a.rank || 999) - (b.rank || 999))
    .slice(0, 3) // Top 3 for final send

  console.log('Final active secondary articles:', finalActiveSecondaryArticles.map((a: any) => `ID: ${a.id}, Rank: ${a.rank}, Headline: ${a.headline}`))

  // Update final positions for secondary articles
  for (let i = 0; i < finalActiveSecondaryArticles.length; i++) {
    const position = i + 1
    const { error: updateError } = await supabaseAdmin
      .from('secondary_articles')
      .update({ final_position: position })
      .eq('id', finalActiveSecondaryArticles[i].id)

    if (updateError) {
      console.error(`Failed to update final position for secondary article ${finalActiveSecondaryArticles[i].id}:`, updateError)
    } else {
      console.log(`✓ Secondary article position ${position}: ${finalActiveSecondaryArticles[i].headline}`)
    }
  }

  // MANUAL ARTICLES
  const finalActiveManualArticles = issue.manual_articles
    .filter((article: any) => article.is_active)
    .sort((a: any, b: any) => (a.rank || 999) - (b.rank || 999))
    .slice(0, 5)

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
 * Stage 2 Unassignment: Recycle posts that had articles generated but weren't selected
 * Runs AFTER final_position is set and issue is sent
 */
async function unassignUnusedArticlePosts(issueId: string) {
  console.log('=== STAGE 2: UNASSIGNING UNUSED ARTICLE POSTS ===')

  // Find posts with articles that don't have final_position set (not selected for send)
  const { data: unusedPrimaryPosts } = await supabaseAdmin
    .from('articles')
    .select('post_id')
    .eq('issue_id', issueId)
    .is('final_position', null) // Articles generated but NOT in final send

  const { data: unusedSecondaryPosts } = await supabaseAdmin
    .from('secondary_articles')
    .select('post_id')
    .eq('issue_id', issueId)
    .is('final_position', null)

  const unusedPostIds = [
    ...(unusedPrimaryPosts?.map(a => a.post_id) || []),
    ...(unusedSecondaryPosts?.map(a => a.post_id) || [])
  ].filter(Boolean) // Remove null values

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
        articles:articles(
          *,
          rss_post:rss_posts(
            *,
            rss_feed:rss_feeds(*)
          )
        ),
        secondary_articles:secondary_articles(
          *,
          rss_post:rss_posts(
            *,
            rss_feed:rss_feeds(*)
          )
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

    // Check if we have any active articles
    const activeArticles = issue.articles.filter((article: any) => article.is_active)
    if (activeArticles.length === 0) {
      console.log('issue has no active articles, skipping send')
      return NextResponse.json({
        message: 'issue has no active articles, skipping send',
        timestamp: new Date().toISOString()
      })
    }

    // Send the final issue
    const mailerLiteService = new MailerLiteService()

    // Get main group ID from settings
    const { data: mainGroupSetting } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'email_mainGroupId')
      .single()

    const mainGroupId = mainGroupSetting?.value

    if (!mainGroupId) {
      throw new Error('Main group ID not configured in settings')
    }

    console.log('Using main group ID from settings:', mainGroupId)

    // Log article positions at final send
    await logFinalArticlePositions(issue)

    const result = await mailerLiteService.createFinalissue(issue, mainGroupId)

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

    // Update issue status to sent and capture the previous status
    const { error: updateError } = await supabaseAdmin
      .from('publication_issues')
      .update({
        status: 'sent',
        status_before_send: issue.status, // Capture the status before sending
        final_sent_at: new Date().toISOString(),
        metrics: {
          ...issue.metrics,
          mailerlite_issue_id: result.issueId,
          sent_timestamp: new Date().toISOString()
        }
      })
      .eq('id', issue.id)

    if (updateError) {
      console.error('Failed to update issue status to sent:', updateError)
      // Don't fail the entire operation - the email was sent successfully
    } else {
      console.log('issue status updated to sent')
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
      message: 'Final newsletter sent successfully',
      issueId: issue.id,
      mailerliteissueId: result.issueId,
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
        articles:articles(
          *,
          rss_post:rss_posts(
            *,
            rss_feed:rss_feeds(*)
          )
        ),
        secondary_articles:secondary_articles(
          *,
          rss_post:rss_posts(
            *,
            rss_feed:rss_feeds(*)
          )
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

    // Check if we have any active articles
    const activeArticles = issue.articles.filter((article: any) => article.is_active)
    if (activeArticles.length === 0) {
      console.log('issue has no active articles, skipping send')
      return NextResponse.json({
        message: 'issue has no active articles, skipping send',
        timestamp: new Date().toISOString()
      })
    }

    // Send the final issue
    const mailerLiteService = new MailerLiteService()

    // Get main group ID from settings
    const { data: mainGroupSetting } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'email_mainGroupId')
      .single()

    const mainGroupId = mainGroupSetting?.value

    if (!mainGroupId) {
      throw new Error('Main group ID not configured in settings')
    }

    console.log('Using main group ID from settings:', mainGroupId)

    // Log article positions at final send
    await logFinalArticlePositions(issue)

    const result = await mailerLiteService.createFinalissue(issue, mainGroupId)

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

    // Update issue status to sent and capture the previous status
    const { error: updateError } = await supabaseAdmin
      .from('publication_issues')
      .update({
        status: 'sent',
        status_before_send: issue.status, // Capture the status before sending
        final_sent_at: new Date().toISOString(),
        metrics: {
          ...issue.metrics,
          mailerlite_issue_id: result.issueId,
          sent_timestamp: new Date().toISOString()
        }
      })
      .eq('id', issue.id)

    if (updateError) {
      console.error('Failed to update issue status to sent:', updateError)
      // Don't fail the entire operation - the email was sent successfully
    } else {
      console.log('issue status updated to sent')
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
      message: 'Final newsletter sent successfully',
      issueId: issue.id,
      mailerliteissueId: result.issueId,
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