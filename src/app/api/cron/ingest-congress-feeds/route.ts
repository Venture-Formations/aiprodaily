import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { runIngestion } from '@/lib/rss-combiner'

/**
 * Congress Feed Ingestion Cron (runs every 3 hours)
 * Fetches Google News articles for top congressional trades, filters by approved sources.
 *
 * Both GET (Vercel cron) and POST (manual with Bearer token) are secured via system auth tier.
 */
const handler = withApiHandler(
  { authTier: 'system', logContext: 'ingest-congress-feeds' },
  async ({ logger }) => {
    logger.info('Starting congress feed ingestion')

    const result = await runIngestion()

    logger.info(
      {
        feedsFetched: result.feedsFetched,
        articlesStored: result.articlesStored,
        articlesFiltered: result.articlesFiltered,
      },
      'Congress feed ingestion complete'
    )

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    })
  }
)

export const POST = handler
export const GET = handler

export const maxDuration = 300 // 5 minutes
