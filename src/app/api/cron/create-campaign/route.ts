import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { supabaseAdmin } from '@/lib/supabase'
import { ScheduleChecker } from '@/lib/schedule-checker'
import type { Logger } from '@/lib/logger'

async function handleCreateCampaign(logger: Logger) {
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

  logger.info({ count: newsletters.length }, '=== AUTOMATED issue CREATION CHECK ===')

  // Always target tomorrow in Central Time (matches send-review logic)
  const ctParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date())
  const [ctYear, ctMonth, ctDay] = ctParts.split('-').map(Number)
  const tomorrowDate = new Date(ctYear, ctMonth - 1, ctDay + 1)
  const issueDate = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, '0')}-${String(tomorrowDate.getDate()).padStart(2, '0')}`

  logger.info({ issueDate, centralTime: ctParts }, 'issue date calculation: tomorrow in Central Time')

  const results: Array<{ pubId: string; slug: string; success: boolean; skipped?: boolean; message?: string; error?: string }> = []

  for (const pub of newsletters) {
    try {
      // Check if it's time to run issue creation based on database settings
      const shouldRun = await ScheduleChecker.shouldRunissueCreation(pub.id)

      if (!shouldRun) {
        results.push({ pubId: pub.id, slug: pub.slug, success: true, skipped: true, message: 'Not time to run or already ran today' })
        continue
      }

      logger.info({ slug: pub.slug }, '=== issue CREATION STARTED (Time Matched) ===')

      // Find issue for the calculated date with module articles
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
        .eq('publication_id', pub.id)
        .eq('date', issueDate)
        .maybeSingle()

      if (issueError || !issue) {
        logger.info({ issueDate, slug: pub.slug, errorCode: issueError?.code }, '[create-campaign] No issue for date yet')
        results.push({ pubId: pub.id, slug: pub.slug, success: true, skipped: true, message: 'No issue found for date yet' })
        continue
      }

      logger.info({ issueId: issue.id, status: issue.status, slug: pub.slug }, 'Found issue')

      // Only create if issue is in draft status
      if (issue.status !== 'draft') {
        results.push({ pubId: pub.id, slug: pub.slug, success: true, skipped: true, message: `Issue status is ${issue.status}` })
        continue
      }

      // Check if issue has active module articles
      const activeArticles = (issue.module_articles || []).filter((article: any) => article.is_active)
      if (activeArticles.length === 0) {
        results.push({ pubId: pub.id, slug: pub.slug, success: false, error: 'No active articles found' })
        continue
      }

      logger.info({ count: activeArticles.length, slug: pub.slug }, 'issue has active articles')

      // Check if subject line exists
      if (!issue.subject_line || issue.subject_line.trim() === '') {
        results.push({ pubId: pub.id, slug: pub.slug, success: false, error: 'No subject line found' })
        continue
      }

      logger.info({ subjectLine: issue.subject_line, slug: pub.slug }, 'Using subject line')
      logger.info({ slug: pub.slug }, '=== issue CREATION COMPLETED ===')

      results.push({
        pubId: pub.id,
        slug: pub.slug,
        success: true,
        message: `Issue ${issue.id} ready for review`
      })
    } catch (error) {
      logger.error({ err: error, slug: pub.slug }, '[create-campaign] Error processing publication')
      results.push({ pubId: pub.id, slug: pub.slug, success: false, error: String(error) })
    }
  }

  return NextResponse.json({
    success: results.every(r => r.success),
    results,
    issueDate,
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
