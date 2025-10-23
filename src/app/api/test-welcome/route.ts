import { NextRequest, NextResponse } from 'next/server'
import { RSSProcessor } from '@/lib/rss-processor'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaignId')

    if (!campaignId) {
      return NextResponse.json(
        { error: 'campaignId parameter required' },
        { status: 400 }
      )
    }

    console.log('[TEST] Testing welcome section for campaign:', campaignId)

    const processor = new RSSProcessor()
    const welcomeText = await processor.generateWelcomeSection(campaignId)

    console.log('[TEST] Welcome section generated successfully')

    return NextResponse.json({
      success: true,
      welcomeText,
      message: 'Check campaign in database for welcome_intro, welcome_tagline, welcome_summary fields'
    })
  } catch (error: any) {
    console.error('[TEST] Error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export const maxDuration = 60
