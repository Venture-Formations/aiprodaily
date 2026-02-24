import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SendGridService } from '@/lib/sendgrid'
import { MailerLiteService } from '@/lib/mailerlite'
import { ScheduleChecker } from '@/lib/schedule-checker'
import { getEmailProviderSettings } from '@/lib/publication-settings'
import { withApiHandler } from '@/lib/api-handler'

async function handleReviewSend(): Promise<NextResponse> {
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

  console.log('=== AUTOMATED REVIEW SEND CHECK ===')
  console.log('Time:', new Date().toISOString())

  // Check if it's time to run review sending based on database settings
  const shouldRun = await ScheduleChecker.shouldRunReviewSend(activeNewsletter.id)

  if (!shouldRun) {
    return NextResponse.json({
      success: true,
      message: 'Not time to run review send or already ran today',
      skipped: true,
      timestamp: new Date().toISOString()
    })
  }

  console.log('=== REVIEW SEND STARTED (Time Matched) ===')
  console.log('Central Time:', new Date().toLocaleString("en-US", {timeZone: "America/Chicago"}))

  // Get tomorrow's issue that's in draft status and ready for review
  // Use Central Time for consistent date calculations
  const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
  const centralDate = new Date(nowCentral)
  const tomorrow = new Date(centralDate)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const issueDate = tomorrow.toISOString().split('T')[0]

  console.log('Sending review for tomorrow\'s issue date:', issueDate)

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

  // Find tomorrow's issue with module articles
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
    .eq('publication_id', newsletter.id)
    .eq('date', issueDate)
    .eq('status', 'draft')
    .single()

  if (issueError || !issue) {
    return NextResponse.json({
      success: false,
      error: 'No draft issue found for tomorrow',
      issueDate: issueDate
    }, { status: 404 })
  }

  console.log('Found issue:', issue.id, 'Status:', issue.status)

  // Check if issue has active module articles
  const activeArticles = (issue.module_articles || []).filter((article: any) => article.is_active)
  if (activeArticles.length === 0) {
    return NextResponse.json({
      success: false,
      error: 'No active articles found for review sending',
      issueId: issue.id
    }, { status: 400 })
  }

  console.log(`issue has ${activeArticles.length} active articles`)

  // Check if subject line exists
  if (!issue.subject_line || issue.subject_line.trim() === '') {
    return NextResponse.json({
      success: false,
      error: 'No subject line found for issue. Run subject line generation first.',
      issueId: issue.id
    }, { status: 400 })
  }

  console.log('Using subject line:', issue.subject_line)

  // Check which email provider to use
  const providerSettings = await getEmailProviderSettings(newsletter.id)
  console.log(`[Review Send] Using email provider: ${providerSettings.provider}`)

  let result: { success: boolean; campaignId?: string; issueId?: string; error?: string }

  if (providerSettings.provider === 'sendgrid') {
    // Create SendGrid review campaign
    const sendGridService = new SendGridService()
    result = await sendGridService.createReviewCampaign(issue)

    if (!result.success) {
      throw new Error(result.error || 'Failed to create SendGrid campaign')
    }
    console.log('SendGrid campaign created:', result.campaignId)
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
    console.log('MailerLite campaign created:', result.campaignId)
  }

  // Note: Both services update issue status to in_review
  console.log('=== REVIEW SEND COMPLETED ===')

  return NextResponse.json({
    success: true,
    message: 'Review campaign sent to SendGrid successfully',
    issueId: issue.id,
    issueDate: issueDate,
    sendgridCampaignId: result.campaignId,
    subjectLine: issue.subject_line,
    activeArticlesCount: activeArticles.length,
    timestamp: new Date().toISOString()
  })
}

export const POST = withApiHandler(
  { authTier: 'system', logContext: 'send-review' },
  async () => handleReviewSend()
)

export const GET = withApiHandler(
  { authTier: 'system', logContext: 'send-review' },
  async () => handleReviewSend()
)
