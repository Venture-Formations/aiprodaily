import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { runIngestion, checkAndActivateSchedule } from '@/lib/rss-combiner'

/**
 * Congress Feed Ingestion Cron (runs every 3 hours)
 * 1. Checks if scheduled activation is due (staged trades → live)
 * 2. Fetches Google News articles for top congressional trades, filters by approved sources.
 *
 * Both GET (Vercel cron) and POST (manual with Bearer token) are secured via system auth tier.
 */
const handler = withApiHandler(
  { authTier: 'system', logContext: 'ingest-congress-feeds' },
  async ({ logger }) => {
    // Check if scheduled activation is due
    const activation = await checkAndActivateSchedule()

    if (activation.activated) {
      logger.info(
        { rowsCopied: activation.rowsCopied },
        'Scheduled activation completed, running ingestion with new trades'
      )
    }

    // Run ingestion (whether or not activation happened)
    const result = await runIngestion()

    logger.info(
      {
        activated: activation.activated,
        feedsFetched: result.feedsFetched,
        articlesStored: result.articlesStored,
        articlesFiltered: result.articlesFiltered,
      },
      'Congress feed ingestion complete'
    )

    return NextResponse.json({
      success: true,
      activated: activation.activated,
      rowsCopied: activation.rowsCopied,
      ...result,
      timestamp: new Date().toISOString(),
    })
  }
)

export const POST = handler
export const GET = handler

export const maxDuration = 300 // 5 minutes
