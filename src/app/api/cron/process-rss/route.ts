import { withApiHandler } from '@/lib/api-handler'
import { NextResponse } from 'next/server'
import { RSSProcessor } from '@/lib/rss-processor'

export const POST = withApiHandler(
  { authTier: 'system', logContext: 'process-rss' },
  async ({ logger }) => {
    logger.info('Starting scheduled RSS processing...')

    const processor = new RSSProcessor()
    await processor.processAllFeeds()

    return NextResponse.json({
      success: true,
      message: 'RSS processing completed successfully',
      timestamp: new Date().toISOString()
    })
  }
)

export const GET = withApiHandler(
  { authTier: 'system', logContext: 'process-rss' },
  async () => {
    return NextResponse.json({
      message: 'RSS processing cron endpoint is active',
      timestamp: new Date().toISOString(),
      schedule: 'Daily at 8:30 PM CT'
    })
  }
)
