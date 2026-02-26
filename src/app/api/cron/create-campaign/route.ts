import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { ScheduleChecker } from '@/lib/schedule-checker'
import type { Logger } from '@/lib/logger'

async function handleCreateCampaign(logger: Logger) {
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

  logger.info('=== AUTOMATED issue CREATION CHECK ===')
  logger.info({ time: new Date().toISOString() }, 'Time check')

  // Check if it's time to run issue creation based on database settings
  const shouldRun = await ScheduleChecker.shouldRunissueCreation(activeNewsletter.id)

  if (!shouldRun) {
    return NextResponse.json({
      success: true,
      message: 'Not time to run issue creation or already ran today',
      skipped: true,
      timestamp: new Date().toISOString()
    })
  }

  logger.info('=== issue CREATION STARTED (Time Matched) ===')
  logger.info({ centralTime: new Date().toLocaleString("en-US", {timeZone: "America/Chicago"}) }, 'Central Time')

  // Get issue (already processed with RSS and subject line)
  // Use Central Time + 12 hours for consistent date calculations
  // This ensures evening runs (8pm+) create issues for tomorrow
  const nowCentral = new Date().toLocaleString("en-US", {timeZone: "America/Chicago"})
  const centralDate = new Date(nowCentral)
  // Add 12 hours to determine issue date (same logic as RSS Processing)
  centralDate.setHours(centralDate.getHours() + 12)
  const issueDate = centralDate.toISOString().split('T')[0]

  logger.info({ issueDate }, 'issue date calculation: Current CT time + 12 hours')
  logger.info({ issueDate }, 'Creating review issue for date')

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
  // Use maybeSingle() so 0 rows returns null instead of Supabase 406 (PGRST116)
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
    .maybeSingle()

  if (issueError || !issue) {
    // Issue not created yet (workflow runs at rssProcessingTime; ensure issueCreationTime is after that)
    logger.info({ issueDate, errorCode: issueError?.code }, '[create-campaign] No issue for date yet')
    return NextResponse.json({
      success: true,
      skipped: true,
      message: 'No issue found for date yet; workflow may run later or still processing.',
      issueDate
    })
  }

  logger.info({ issueId: issue.id, status: issue.status }, 'Found issue')

  // Only create if issue is in draft status
  if (issue.status !== 'draft') {
    return NextResponse.json({
      success: true,
      message: `issue status is ${issue.status}, skipping issue creation`,
      issueId: issue.id,
      skipped: true
    })
  }

  // Check if issue has active module articles
  const activeArticles = (issue.module_articles || []).filter((article: any) => article.is_active)
  if (activeArticles.length === 0) {
    return NextResponse.json({
      success: false,
      error: 'No active articles found for issue creation',
      issueId: issue.id
    }, { status: 400 })
  }

  logger.info({ count: activeArticles.length }, 'issue has active articles')

  // Check if subject line exists
  if (!issue.subject_line || issue.subject_line.trim() === '') {
    return NextResponse.json({
      success: false,
      error: 'No subject line found for issue. Run subject line generation first.',
      issueId: issue.id
    }, { status: 400 })
  }

  logger.info({ subjectLine: issue.subject_line }, 'Using subject line')
  logger.info('=== issue CREATION COMPLETED ===')

  return NextResponse.json({
    success: true,
    message: 'issue created successfully - ready for MailerLite review sending',
    issueId: issue.id,
    issueDate: issueDate,
    subjectLine: issue.subject_line,
    activeArticlesCount: activeArticles.length,
    status: 'draft',
    timestamp: new Date().toISOString()
  })
}

export const POST = withApiHandler(
  { authTier: 'system', logContext: 'create-campaign' },
  async ({ logger }) => handleCreateCampaign(logger)
)

export const GET = withApiHandler(
  { authTier: 'system', logContext: 'create-campaign' },
  async ({ logger }) => handleCreateCampaign(logger)
)
