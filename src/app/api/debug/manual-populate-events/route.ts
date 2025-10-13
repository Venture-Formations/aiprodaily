import { NextRequest, NextResponse } from 'next/server'
import { validateDebugAuth } from '@/lib/debug-auth'
import { RSSProcessor } from '@/lib/rss-processor'

export async function GET(request: NextRequest) {
  // Validate authentication
  const authResult = validateDebugAuth(request)
  if (!authResult.authorized) {
    return authResult.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id')

    if (!campaignId) {
      return NextResponse.json({
        error: 'campaign_id parameter required'
      }, { status: 400 })
    }

    console.log('Manually populating events for campaign:', campaignId)

    // Use the existing RSS processor method
    const rssProcessor = new RSSProcessor()
    await rssProcessor.populateEventsForCampaignSmart(campaignId)

    return NextResponse.json({
      success: true,
      message: 'Events populated successfully for campaign',
      campaign_id: campaignId,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error populating events:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}