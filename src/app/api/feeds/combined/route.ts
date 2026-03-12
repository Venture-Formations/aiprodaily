import { NextRequest, NextResponse } from 'next/server'
import { getCombinedFeed } from '@/lib/rss-combiner'

export const maxDuration = 60

export async function GET(request: NextRequest) {
  // Manual Bearer auth — not using withApiHandler({ authTier: 'system' })
  // because system tier includes the CRON_ENABLED kill switch, and this
  // endpoint is not a cron job.
  const authHeader = request.headers.get('authorization')
  const secret = request.nextUrl.searchParams.get('secret')
  const cronSecret = process.env.CRON_SECRET

  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!cronSecret || (token !== cronSecret && secret !== cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true'

  try {
    const xml = await getCombinedFeed(forceRefresh)

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=900',
      },
    })
  } catch (error) {
    console.error('[RSS-Combiner] Feed generation failed:', error)
    return NextResponse.json(
      { error: 'Failed to generate combined feed' },
      { status: 500 }
    )
  }
}
