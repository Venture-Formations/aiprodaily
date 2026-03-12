import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { getCombinedFeed } from '@/lib/rss-combiner'

export const maxDuration = 60

export const GET = withApiHandler(
  { authTier: 'system', logContext: 'feeds/combined' },
  async ({ request, logger }) => {
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true'

    const xml = await getCombinedFeed(forceRefresh)
    logger.info({ forceRefresh, xmlLength: xml.length }, 'Combined feed generated')

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=900',
      },
    })
  }
)
