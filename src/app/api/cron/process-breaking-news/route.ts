import { withApiHandler } from '@/lib/api-handler'
import { NextResponse } from 'next/server'
import { BreakingNewsProcessor } from '@/lib/breaking-news-processor'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Process Breaking News RSS Feeds
 * GET /api/cron/process-breaking-news
 *
 * This endpoint processes RSS feeds for Breaking News section:
 * - Fetches articles from configured RSS feeds (3-day window)
 * - Scores articles using AI (0-100 scale)
 * - Generates summaries and alternative titles
 * - Categorizes as 'breaking' (≥70) or 'beyond_feed' (≥40)
 *
 * Can be triggered by:
 * 1. Vercel cron (automated)
 * 2. Manual testing with secret parameter
 */

const handler = withApiHandler(
  { authTier: 'system', logContext: 'process-breaking-news' },
  async ({ logger }) => {
    logger.info('Starting Breaking News RSS processing...')

    // Get the latest draft issue for AI Accounting newsletter
    const { data: issue, error: issueError } = await supabaseAdmin
      .from('publication_issues')
      .select('id, date, status')
      .eq('status', 'draft')
      .order('date', { ascending: false })
      .limit(1)
      .single()

    if (issueError || !issue) {
      logger.info('No draft issue found for Breaking News processing')
      return NextResponse.json({
        success: false,
        message: 'No draft issue found',
        timestamp: new Date().toISOString()
      })
    }

    logger.info(`Processing Breaking News for issue ${issue.id} (date: ${issue.date})`)

    // Initialize and run Breaking News processor
    const processor = new BreakingNewsProcessor()
    await processor.processBreakingNewsFeeds(issue.id)

    logger.info('Breaking News RSS processing completed successfully')

    return NextResponse.json({
      success: true,
      message: 'Breaking News RSS processing completed',
      issue_id: issue.id,
      issue_date: issue.date,
      timestamp: new Date().toISOString()
    })
  }
)

export const GET = handler
export const POST = handler
