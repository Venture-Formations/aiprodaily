import { withApiHandler } from '@/lib/api-handler'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { FeedHealthAnalyzer } from '@/lib/monitoring/feed-health-analyzer'

/**
 * Feed Health Analysis Cron
 *
 * Runs daily at 6 AM. For each active publication:
 * 1. Analyzes RSS feed health data from the last 7 days
 * 2. Uses AI to generate monitoring rules for concerning patterns
 * 3. Stores rules in feed_health_rules table
 *
 * AI-generated rules are replaced each run; manual rules are preserved.
 */
const handler = withApiHandler(
  { authTier: 'system', logContext: 'feed-health-analysis' },
  async ({ logger }) => {
    logger.info('Starting feed health analysis')

    const { data: publications, error } = await supabaseAdmin
      .from('publications')
      .select('id, name')
      .eq('is_active', true)

    if (error || !publications) {
      logger.error({ err: error }, 'Failed to fetch publications')
      return NextResponse.json({ error: 'Failed to fetch publications' }, { status: 500 })
    }

    const results = []

    for (const pub of publications) {
      try {
        const analyzer = new FeedHealthAnalyzer(pub.id, logger)
        const rules = await analyzer.generateRules()

        results.push({
          publication: pub.name,
          rulesGenerated: rules.length,
          status: 'success',
        })
      } catch (pubError) {
        logger.error({ err: pubError, publicationId: pub.id }, 'Feed health analysis failed')
        results.push({
          publication: pub.name,
          status: 'failed',
          error: pubError instanceof Error ? pubError.message : 'Unknown error',
        })
      }
    }

    logger.info({ results }, 'Feed health analysis complete')

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
    })
  }
)

export const GET = handler
export const POST = handler
export const maxDuration = 120
