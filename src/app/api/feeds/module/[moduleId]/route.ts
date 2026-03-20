import { NextRequest, NextResponse } from 'next/server'
import { ModuleFeedGenerator } from '@/lib/article-modules/feed-generator'

export const maxDuration = 30

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const { moduleId } = await params
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Validate token against module config
  const { valid, publicationId } = await ModuleFeedGenerator.validateFeedToken(moduleId, token)

  if (!valid || !publicationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true'

  try {
    const xml = await ModuleFeedGenerator.generateFeed(moduleId, publicationId, forceRefresh)

    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=900',
      },
    })
  } catch (error) {
    console.error('[Module Feed] Generation failed:', error)
    return NextResponse.json(
      { error: 'Failed to generate module feed' },
      { status: 500 }
    )
  }
}
