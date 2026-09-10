import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SendGridService } from '@/lib/sendgrid'
import { MailerLiteService } from '@/lib/mailerlite'
import { SlackNotificationService } from '@/lib/slack'
import { getPublicationSetting, getEmailProviderSettings } from '@/lib/publication-settings'
import { withApiHandler } from '@/lib/api-handler'
import { getEnvironment, isProduction, shouldSkipScheduleCheck } from '@/lib/env-guard'
import { getDayOfWeek } from '@/lib/date-utils'
import type { Logger } from '@/lib/logger'

export const maxDuration = 600 // 10 minutes

/**
 * Core logic for secondary newsletter send.
 * Shared by both POST (manual trigger) and GET (Vercel cron) handlers.
 */
async function handleSecondarySend(log: Logger): Promise<NextResponse> {
  log.info({ env: getEnvironment(), isProduction: isProduction() }, '[ENV] Environment check')
  log.info('[CRON] === SECONDARY SEND CHECK ===')

  // Get all active publications
  const { data: publications } = await supabaseAdmin
    .from('publications')
    .select('id, name, slug')
    .eq('is_active', true)

  if (!publications || publications.length === 0) {
    return NextResponse.json({
      success: false,
      error: 'No active publications found'
    }, { status: 404 })
  }

  log.info({ count: publications.length }, '[CRON] Processing publications for secondary send')

  const results: Array<{ pubId: string; slug: string; success: boolean; skipped?: boolean; message?: string; error?: string }> = []

  for (const pub of publications) {
    try {
      const publicationId = pub.id

      // Check if secondary schedule is enabled
      const secondaryScheduleEnabled = await getPublicationSetting(publicationId, 'email_secondaryScheduleEnabled')
      if (secondaryScheduleEnabled !== 'true') {
        results.push({ pubId: pub.id, slug: pub.slug, success: true, skipped: true, message: 'Secondary schedule is disabled' })
        continue
      }

      // Get secondary send days
      const secondarySendDaysRaw = await getPublicationSetting(publicationId, 'secondary_send_days')
      let secondarySendDays: number[] = []
      if (secondarySendDaysRaw) {
        try {
          secondarySendDays = JSON.parse(secondarySendDaysRaw)
        } catch {
          log.error({ slug: pub.slug }, '[CRON] Failed to parse secondary_send_days, using default Mon-Fri')
          secondarySendDays = [1, 2, 3, 4, 5]
        }
      } else {
        secondarySendDays = [1, 2, 3, 4, 5] // Default to Mon-Fri
      }

      // Check if today is a send day (0 = Sunday, 6 = Saturday).
      //
      // MUST be Central Time, not the server clock. Vercel runs UTC, so
      // `new Date().getDay()` rolls over to tomorrow at 19:00 CT while the issue
      // lookup below still resolves today's CT date. That skew fired AI
      // Accounting Daily's Thursday-only secondary every Wednesday evening
      // against Wednesday's already-sent issue, scheduling it for a time that
      // had passed 13 hours earlier. `getDayOfWeek('CST')` is derived from the
      // same date string used for `localDate`, so the two cannot disagree.
      const dayOfWeek = getDayOfWeek('CST')
      const skipSchedule = shouldSkipScheduleCheck()

      if (skipSchedule) {
        log.info({ slug: pub.slug }, '[ENV-GUARD] SKIP_SCHEDULE_CHECK is set — bypassing day-of-week and already-sent checks')
      }

      if (!skipSchedule && !secondarySendDays.includes(dayOfWeek)) {
        results.push({ pubId: pub.id, slug: pub.slug, success: true, skipped: true, message: `Not a configured send day (${dayOfWeek})` })
        continue
      }

      log.info({ dayOfWeek, slug: pub.slug }, '[CRON] Today is a configured send day, proceeding...')

      // Get secondary list ID (SendGrid)
      const secondaryListId = await getPublicationSetting(publicationId, 'sendgrid_secondary_list_id')
      if (!secondaryListId) {
        results.push({ pubId: pub.id, slug: pub.slug, success: false, error: 'Secondary list ID not configured' })
        continue
      }

      log.info({ secondaryListId, slug: pub.slug }, '[CRON] Using secondary list ID')

      // Get today's issue (can be in_review, changes_made, or sent)
      const localDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })

      // Note: do NOT select `rank` from manual_articles — PostgREST emits it
      // unquoted and PostgreSQL parses it as the `rank()` ordered-set aggregate,
      // returning 42809 ("WITHIN GROUP is required for ordered-set aggregate rank").
      // Also, manual_articles has no `is_active` column — selecting one would
      // cause 42703. Both bugs previously short-circuited every secondary send.
      const { data: issue, error } = await supabaseAdmin
        .from('publication_issues')
        .select(`
          id, date, status, subject_line, secondary_sent_at, publication_id, created_at, metrics,
          manual_articles:manual_articles(id, title, body, section_type)
        `)
        .eq('publication_id', publicationId)
        .in('status', ['in_review', 'changes_made', 'sent'])
        .eq('date', localDate)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !issue) {
        // Distinguish a real "no row" miss from a PostgREST error so the next
        // regression of this kind doesn't masquerade as a healthy skip.
        if (error && (error as any).code && (error as any).code !== 'PGRST116') {
          log.error({ err: error, slug: pub.slug, date: localDate }, '[CRON] Issue lookup failed')
          results.push({ pubId: pub.id, slug: pub.slug, success: false, error: `Issue lookup failed: ${(error as any).code} ${(error as any).message || ''}`.trim() })
          continue
        }
        results.push({ pubId: pub.id, slug: pub.slug, success: true, skipped: true, message: 'No issue found for today' })
        continue
      }

      log.info({ issueId: issue.id, date: issue.date, status: issue.status, slug: pub.slug }, '[CRON] Found issue')

      // Check if secondary send was already done today
      if (!skipSchedule && issue.secondary_sent_at) {
        const secondarySentDate = new Date(issue.secondary_sent_at).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' })
        if (secondarySentDate === localDate) {
          results.push({ pubId: pub.id, slug: pub.slug, success: true, skipped: true, message: 'Secondary send already completed today' })
          continue
        }
      }

      // Get active articles with final positions from module_articles
      const { data: activeModuleArticles } = await supabaseAdmin
        .from('module_articles')
        .select('id, headline, content, rank, is_active, final_position, article_module_id, post_id')
        .eq('issue_id', issue.id)
        .eq('is_active', true)
        .not('final_position', 'is', null)

      const activeArticles = activeModuleArticles || []

      // Attach for downstream compatibility
      ;(issue as any).articles = activeArticles

      // This is also what sequences the secondary send AFTER the primary one:
      // `final_position` is written by `logFinalArticlePositions` during
      // send-final, so on every earlier tick of the day this skip fires and the
      // secondary waits. Deliberately a skip and not a claimed schedule slot —
      // gating on `email_secondaryissueCreationTime` via ScheduleChecker would
      // run before positions exist, burn the day's `last_*_run` marker, and the
      // secondary would never go out at all.
      if (activeArticles.length === 0) {
        results.push({ pubId: pub.id, slug: pub.slug, success: true, skipped: true, message: 'No active articles with final positions' })
        continue
      }

      // Check which email provider to use
      const providerSettings = await getEmailProviderSettings(publicationId)
      log.info({ provider: providerSettings.provider, slug: pub.slug }, '[CRON] Using email provider')

      // `scheduled` is false when the provider created the campaign but rejected
      // the schedule. That campaign will never send on its own, so it must be
      // alerted rather than counted as a clean send.
      let result: {
        success: boolean
        campaignId?: string
        issueId?: string
        error?: string
        scheduled?: boolean
        scheduleError?: string
        scheduleData?: any
      }

      if (providerSettings.provider === 'sendgrid') {
        const sendGridService = new SendGridService()
        result = await sendGridService.createFinalCampaign(issue as any, true) // true = isSecondary

        if (!result.success) {
          throw new Error(result.error || 'Failed to create secondary SendGrid campaign')
        }
      } else {
        const mailerliteService = new MailerLiteService()
        const mlResult = await mailerliteService.createFinalissue(issue as any, providerSettings.secondaryGroupId, true) // true = isSecondary

        result = {
          success: mlResult.success,
          campaignId: mlResult.issueId,
          error: mlResult.success ? undefined : 'Failed to create secondary MailerLite campaign',
          scheduled: mlResult.scheduled,
          scheduleError: mlResult.scheduleError,
          scheduleData: mlResult.scheduleData
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
        log.error({ err: updateError, slug: pub.slug }, '[CRON] Failed to update issue with secondary send info')
      } else {
        log.info({ slug: pub.slug }, '[CRON] Issue updated with secondary send timestamp')
      }

      // The campaign exists but the provider refused the schedule: it will sit
      // as an unsent draft until someone acts. `secondary_sent_at` is still
      // stamped above on purpose — the campaign is already created, so a retry
      // would produce a duplicate rather than rescue this one.
      if (result.scheduled === false) {
        const requested = result.scheduleData?.schedule
        const requestedTime = requested
          ? `${requested.date} ${requested.hours}:${requested.minutes} CT`
          : 'unknown'
        log.error(
          { slug: pub.slug, campaignId: result.campaignId, requestedTime, scheduleError: result.scheduleError },
          '[CRON] Secondary campaign created but NOT scheduled — it will not send'
        )
        await new SlackNotificationService().sendScheduledSendFailureAlert(
          issue.id,
          requestedTime,
          result.scheduleError ?? 'Provider rejected the schedule',
          { campaignId: result.campaignId, publication: pub.slug, sendType: 'secondary' }
        )
        results.push({
          pubId: pub.id,
          slug: pub.slug,
          success: true,
          message: `Secondary campaign ${result.campaignId} created but not scheduled — needs manual scheduling`
        })
        continue
      }

      log.info({ slug: pub.slug }, '[CRON] === SECONDARY SEND COMPLETED ===')

      results.push({ pubId: pub.id, slug: pub.slug, success: true, message: `Secondary sent, campaign ${result.campaignId}` })
    } catch (error) {
      log.error({ err: error, slug: pub.slug }, '[send-secondary] Error processing publication')
      results.push({ pubId: pub.id, slug: pub.slug, success: false, error: String(error) })
    }
  }

  return NextResponse.json({
    success: results.every(r => r.success),
    results,
    timestamp: new Date().toISOString()
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
