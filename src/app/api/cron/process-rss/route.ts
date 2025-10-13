import { NextRequest, NextResponse } from 'next/server'
import { RSSProcessor } from '@/lib/rss-processor'

export async function POST(request: NextRequest) {
  // Verify cron secret for security
  const authHeader = request.headers.get('Authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('Starting scheduled RSS processing...')

    const processor = new RSSProcessor()
    await processor.processAllFeeds()

    return NextResponse.json({
      success: true,
      message: 'RSS processing completed successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Scheduled RSS processing failed:', error)

    return NextResponse.json({
      error: 'RSS processing failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// For manual testing
export async function GET() {
  return NextResponse.json({
    message: 'RSS processing cron endpoint is active',
    timestamp: new Date().toISOString(),
    schedule: 'Daily at 8:30 PM CT'
  })
}