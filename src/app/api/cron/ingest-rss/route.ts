import { NextResponse } from 'next/server'
import { RSSProcessor } from '@/lib/rss-processor'
import { withApiHandler } from '@/lib/api-handler'
import { declareRoute } from '@/lib/auth-tiers'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const routeConfig = declareRoute({
  authTier: 'system',
  description: 'RSS ingestion cron (runs every 15 minutes)'
})

/**
 * RSS Ingestion Cron (runs every 15 minutes)
 * Fetches new posts, extracts full text, scores them, stores with issueId = NULL
 *
 * Both GET (Vercel cron) and POST (manual with Bearer token) are secured via system auth tier.
 */
const handler = withApiHandler(
  { authTier: 'system', logContext: 'ingest-rss' },
  async ({ logger }) => {
    logger.info('Starting RSS ingestion')

    const processor = new RSSProcessor()
    const result = await processor.ingestNewPosts()

    logger.info({ fetched: result.fetched, scored: result.scored }, 'Ingestion complete')

    return NextResponse.json({
      success: true,
      fetched: result.fetched,
      scored: result.scored,
      timestamp: new Date().toISOString()
    })
  }
)

export const POST = handler
export const GET = handler

export const maxDuration = 300 // 5 minutes
