import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SendGridService } from '@/lib/sendgrid'
import { MailerLiteService } from '@/lib/mailerlite'
import { ScheduleChecker } from '@/lib/schedule-checker'
import { getEmailProviderSettings } from '@/lib/publication-settings'
import { withApiHandler } from '@/lib/api-handler'
import type { Logger } from '@/lib/logger'

async function handleReviewSend(log: Logger): Promise<NextResponse> {
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

  log.info({ count: newsletters.length }, '=== AUTOMATED REVIEW SEND CHECK ===')

  const results: Array<{ pubId: string; slug: string; success: boolean; skipped?: boolean; message?: string; error?: string }> = []

  for (const pub of newsletters) {
    try {
      // Check if it's time to run review sending based on database settings
      const shouldRun = await ScheduleChecker.shouldRunReviewSend(pub.id)

      if (!shouldRun) {
        // Catch-up: If a draft issue exists for tomorrow with no review_sent_at,
        // and we're within 30 minutes after scheduled send time, still send it.
        const catchUp = await ScheduleChecker.shouldCatchUpReviewSend(pub.id)
        if (!catchUp) {
          results.push({ pubId: pub.id, slug: pub.slug, success: true, skipped: true, message: 'Not time to run or already ran today' })
          continue
        }
        log.info({ slug: pub.slug }, 'Catch-up review send triggered — draft issue found after scheduled window')
      }

      log.info({ slug: pub.slug }, '=== REVIEW SEND STARTED (Time Matched) ===')

      // Get tomorrow's issue that's in draft status and ready for review
      // Use Central Time for consistent date calculations
      const now = new Date()
      const ctParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Chicago',
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(now) // Returns YYYY-MM-DD in Central Time
      const [ctYear, ctMonth, ctDay] = ctParts.split('-').map(Number)
      const tomorrowDate = new Date(ctYear, ctMonth - 1, ctDay + 1)
      const issueDate = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`

      log.info({ issueDate, slug: pub.slug }, 'Sending review for tomorrow\'s issue date')

      // Find tomorrow's issue with module articles and related data
      // Uses broad select because generateEmailHTML needs many issue fields for template rendering
      const { data: issue, error: issueError } = await supabaseAdmin
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
        .eq('date', issueDate)
        .eq('status', 'draft')
        .single()

      if (issueError || !issue) {
        results.push({ pubId: pub.id, slug: pub.slug, success: true, skipped: true, message: 'No draft issue found for tomorrow' })
        continue
      }

      log.info({ issueId: issue.id, status: issue.status, slug: pub.slug }, 'Found issue')

      // Check if issue has active module articles
      const activeArticles = (issue.module_articles || []).filter((article: any) => article.is_active)
      if (activeArticles.length === 0) {
        results.push({ pubId: pub.id, slug: pub.slug, success: false, error: 'No active articles found' })
        continue
      }

      log.info({ count: activeArticles.length, slug: pub.slug }, 'issue has active articles')

      // Check if subject line exists
      if (!issue.subject_line || issue.subject_line.trim() === '') {
        results.push({ pubId: pub.id, slug: pub.slug, success: false, error: 'No subject line found' })
        continue
      }

      log.info({ subjectLine: issue.subject_line, slug: pub.slug }, 'Using subject line')

      // Check which email provider to use
      const providerSettings = await getEmailProviderSettings(pub.id)
      log.info({ provider: providerSettings.provider, slug: pub.slug }, '[Review Send] Using email provider')

      let result: { success: boolean; campaignId?: string; issueId?: string; error?: string }

      if (providerSettings.provider === 'sendgrid') {
        // Create SendGrid review campaign
        const sendGridService = new SendGridService()
        result = await sendGridService.createReviewCampaign(issue)

        if (!result.success) {
          throw new Error(result.error || 'Failed to create SendGrid campaign')
        }
        log.info({ campaignId: result.campaignId, slug: pub.slug }, 'SendGrid campaign created')
      } else {
        // Create MailerLite review campaign
        const mailerliteService = new MailerLiteService()
        const mlResult = await mailerliteService.createReviewissue(issue)

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

      // Note: Both services update issue status to in_review
      log.info({ slug: pub.slug }, '=== REVIEW SEND COMPLETED ===')

      results.push({ pubId: pub.id, slug: pub.slug, success: true, message: `Review sent, campaign ${result.campaignId}` })
    } catch (error) {
      log.error({ err: error, slug: pub.slug }, '[send-review] Error processing publication')
      results.push({ pubId: pub.id, slug: pub.slug, success: false, error: String(error) })
    }
  }

  return NextResponse.json({
    success: results.every(r => r.success),
    results,
    timestamp: new Date().toISOString()
  })
}

export const POST = withApiHandler(
  { authTier: 'system', logContext: 'send-review' },
  async ({ logger }) => handleReviewSend(logger)
)

export const GET = withApiHandler(
  { authTier: 'system', logContext: 'send-review' },
  async ({ logger }) => handleReviewSend(logger)
)
