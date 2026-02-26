import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SendGridService } from '@/lib/sendgrid'
import { MailerLiteService } from '@/lib/mailerlite'
import { getPublicationSetting, getEmailProviderSettings } from '@/lib/publication-settings'
import { withApiHandler } from '@/lib/api-handler'
import type { Logger } from '@/lib/logger'

export const maxDuration = 600 // 10 minutes

/**
 * Core logic for secondary newsletter send.
 * Shared by both POST (manual trigger) and GET (Vercel cron) handlers.
 */
async function handleSecondarySend(log: Logger): Promise<NextResponse> {
  log.info('[CRON] === SECONDARY SEND CHECK ===')

  // Get first active publication for backward compatibility
  const { data: activePublication } = await supabaseAdmin
    .from('publications')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .single()

  if (!activePublication) {
    return NextResponse.json({
      success: false,
      error: 'No active publication found'
    }, { status: 404 })
  }

  const publicationId = activePublication.id

  // Check if secondary schedule is enabled
  const secondaryScheduleEnabled = await getPublicationSetting(publicationId, 'email_secondaryScheduleEnabled')
  if (secondaryScheduleEnabled !== 'true') {
    log.info('[CRON] Secondary schedule is disabled, skipping')
    return NextResponse.json({
      success: true,
      message: 'Secondary schedule is disabled',
      skipped: true
    })
  }

  // Get secondary send days
  const secondarySendDaysRaw = await getPublicationSetting(publicationId, 'secondary_send_days')
  let secondarySendDays: number[] = []
  if (secondarySendDaysRaw) {
    try {
      secondarySendDays = JSON.parse(secondarySendDaysRaw)
    } catch {
      log.error('[CRON] Failed to parse secondary_send_days, using default Mon-Fri')
      secondarySendDays = [1, 2, 3, 4, 5]
    }
  } else {
    secondarySendDays = [1, 2, 3, 4, 5] // Default to Mon-Fri
  }

  // Check if today is a send day (0 = Sunday, 6 = Saturday)
  const today = new Date()
  const dayOfWeek = today.getDay()

  if (!secondarySendDays.includes(dayOfWeek)) {
    log.info({ dayOfWeek, configuredDays: secondarySendDays }, '[CRON] Today is not a configured send day, skipping')
    return NextResponse.json({
      success: true,
      message: `Today is not a configured send day`,
      skipped: true,
      dayOfWeek,
      configuredDays: secondarySendDays
    })
  }

  log.info({ dayOfWeek }, '[CRON] Today is a configured send day, proceeding...')

  // Get secondary list ID (SendGrid)
  const secondaryListId = await getPublicationSetting(publicationId, 'sendgrid_secondary_list_id')
  if (!secondaryListId) {
    log.error('[CRON] Secondary list ID not configured')
    return NextResponse.json({
      success: false,
      error: 'Secondary list ID not configured in settings (sendgrid_secondary_list_id)'
    }, { status: 400 })
  }

  log.info({ secondaryListId }, '[CRON] Using secondary list ID')

  // Get today's issue (can be in_review, changes_made, or sent)
  const localDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })

  const { data: issue, error } = await supabaseAdmin
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
    .eq('publication_id', publicationId)
    .in('status', ['in_review', 'changes_made', 'sent'])
    .eq('date', localDate)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !issue) {
    log.error({ err: error }, '[CRON] No issue found for today')
    return NextResponse.json({
      success: false,
      error: 'No issue found for today',
      date: localDate
    }, { status: 404 })
  }

  log.info({ issueId: issue.id, date: issue.date, status: issue.status }, '[CRON] Found issue')

  // Check if secondary send was already done today
  if (issue.secondary_sent_at) {
    const secondarySentDate = new Date(issue.secondary_sent_at).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
    if (secondarySentDate === localDate) {
      log.info({ secondary_sent_at: issue.secondary_sent_at }, '[CRON] Secondary send already completed today')
      return NextResponse.json({
        success: true,
        message: 'Secondary send already completed today',
        skipped: true,
        secondary_sent_at: issue.secondary_sent_at
      })
    }
  }

  // Check if we have any active articles
  const activeArticles = issue.articles.filter((article: any) => article.is_active && article.final_position)
  if (activeArticles.length === 0) {
    log.info('[CRON] Issue has no active articles with final positions, skipping send')
    return NextResponse.json({
      success: false,
      error: 'Issue has no active articles',
      skipped: true
    })
  }

  // Check which email provider to use
  const providerSettings = await getEmailProviderSettings(publicationId)
  log.info({ provider: providerSettings.provider }, '[CRON] Using email provider')

  let result: { success: boolean; campaignId?: string; issueId?: string; error?: string }

  if (providerSettings.provider === 'sendgrid') {
    // Create and send the secondary campaign via SendGrid
    const sendGridService = new SendGridService()
    result = await sendGridService.createFinalCampaign(issue, true) // true = isSecondary

    if (!result.success) {
      throw new Error(result.error || 'Failed to create secondary SendGrid campaign')
    }
  } else {
    // Create and send the secondary campaign via MailerLite
    const mailerliteService = new MailerLiteService()
    const mlResult = await mailerliteService.createFinalissue(issue, providerSettings.secondaryGroupId, true) // true = isSecondary

    result = {
      success: mlResult.success,
      campaignId: mlResult.issueId,
      error: mlResult.success ? undefined : 'Failed to create secondary MailerLite campaign'
    }

    if (!result.success) {
      throw new Error(result.error || 'Failed to create secondary MailerLite campaign')
    }
  }

  // Update issue to record secondary send
  const { error: updateError } = await supabaseAdmin
    .from('publication_issues')
    .update({
      secondary_sent_at: new Date().toISOString(),
      metrics: {
        ...issue.metrics,
        [`${providerSettings.provider}_secondary_singlesend_id`]: result.campaignId,
        secondary_sent_timestamp: new Date().toISOString()
      }
    })
    .eq('id', issue.id)

  if (updateError) {
    log.error({ err: updateError }, '[CRON] Failed to update issue with secondary send info')
    // Don't fail the entire operation - the email was sent successfully
  } else {
    log.info('[CRON] Issue updated with secondary send timestamp')
  }

  log.info('[CRON] === SECONDARY SEND COMPLETED ===')

  return NextResponse.json({
    success: true,
    message: 'Secondary newsletter sent successfully via SendGrid',
    issue_id: issue.id,
    issue_date: issue.date,
    secondary_list_id: secondaryListId,
    sendgrid_campaign_id: result.campaignId,
    sent_at: new Date().toISOString()
  })
}

/**
 * POST handler for manual triggers with Bearer token auth.
 */
export const POST = withApiHandler(
  { authTier: 'system', logContext: 'send-secondary' },
  async ({ logger }) => handleSecondarySend(logger)
)

/**
 * GET handler for Vercel cron jobs.
 * Vercel cron jobs make GET requests, so we need this handler.
 */
export const GET = withApiHandler(
  { authTier: 'system', logContext: 'send-secondary' },
  async ({ logger }) => handleSecondarySend(logger)
)
