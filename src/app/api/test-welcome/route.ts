import { NextRequest, NextResponse } from 'next/server'
import { RSSProcessor } from '@/lib/rss-processor'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const issueId = searchParams.get('issueId')

    if (!issueId) {
      return NextResponse.json(
        { error: 'issueId parameter required' },
        { status: 400 }
      )
    }

    console.log('[TEST] Testing welcome section for issue:', issueId)

    const processor = new RSSProcessor()
    const welcomeText = await processor.generateWelcomeSection(issueId)

    console.log('[TEST] Welcome section generated successfully')

    return NextResponse.json({
      success: true,
      welcomeText,
      message: 'Check issue in database for welcome_intro, welcome_tagline, welcome_summary fields'
    })
  } catch (error: any) {
    console.error('[TEST] Error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

export const maxDuration = 600
