import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { RSSProcessor } from '@/lib/rss-processor'

export async function POST(request: NextRequest) {
  try {
    // Check for cron secret OR authenticated session
    const cronSecret = request.headers.get('Authorization')
    const isCronRequest = cronSecret === `Bearer ${process.env.CRON_SECRET}`

    if (!isCronRequest) {
      // Check for authenticated user session
      const session = await getServerSession(authOptions)
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Check if specific campaign ID was provided
    const body = await request.json().catch(() => ({}))
    const { campaign_id } = body

    const processor = new RSSProcessor()
    if (campaign_id) {
      await processor.processAllFeedsForCampaign(campaign_id)
    } else {
      await processor.processAllFeeds()
    }

    return NextResponse.json({
      success: true,
      message: 'RSS processing completed successfully'
    })

  } catch (error) {
    console.error('RSS processing failed:', error)

    return NextResponse.json({
      error: 'RSS processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Manual trigger endpoint (for testing/admin use)
export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated (for manual testing)
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const processor = new RSSProcessor()
    await processor.processAllFeeds()

    return NextResponse.json({
      success: true,
      message: 'RSS processing completed successfully'
    })

  } catch (error) {
    console.error('RSS processing failed:', error)

    return NextResponse.json({
      error: 'RSS processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}