import { NextRequest, NextResponse } from 'next/server'
import { RSSProcessor } from '@/lib/rss-processor'

/**
 * RSS Ingestion Cron (runs every 15 minutes)
 * Fetches new posts, extracts full text, scores them, stores with campaign_id = NULL
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('[Ingest] Starting RSS ingestion...')

    const processor = new RSSProcessor()
    const result = await processor.ingestNewPosts()

    console.log(`[Ingest] ✓ Complete: ${result.fetched} fetched, ${result.scored} scored`)

    return NextResponse.json({
      success: true,
      fetched: result.fetched,
      scored: result.scored,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[Ingest] Error:', error)
    return NextResponse.json({
      error: 'Ingestion failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Vercel cron uses GET requests
export async function GET(request: NextRequest) {
  try {
    console.log('[Ingest] Starting RSS ingestion (GET)...')

    const processor = new RSSProcessor()
    const result = await processor.ingestNewPosts()

    console.log(`[Ingest] ✓ Complete: ${result.fetched} fetched, ${result.scored} scored`)

    return NextResponse.json({
      success: true,
      fetched: result.fetched,
      scored: result.scored,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[Ingest] Error:', error)
    return NextResponse.json({
      error: 'Ingestion failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export const maxDuration = 300 // 5 minutes
