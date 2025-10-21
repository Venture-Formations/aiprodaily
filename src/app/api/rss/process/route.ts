import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

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

    if (!campaign_id) {
      return NextResponse.json({ error: 'campaign_id is required' }, { status: 400 })
    }

    // Trigger step-based RSS processing workflow
    console.log(`Starting step-based RSS processing for campaign ${campaign_id}`)

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://aiprodaily.vercel.app'

    try {
      const response = await fetch(`${baseUrl}/api/rss/steps/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(`Step 1 failed: ${result.message || 'Unknown error'}`)
      }

      console.log('✅ Step-based processing initiated successfully')
    } catch (stepError) {
      console.error('Failed to initiate step-based processing:', stepError)
      throw stepError
    }

    return NextResponse.json({
      success: true,
      message: 'Step-based RSS processing workflow initiated successfully',
      note: 'Processing will continue in background through 6 steps with no time limits'
    })

  } catch (error) {
    console.error('RSS processing failed:', error)

    // Detailed error logging
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }

    // Check if it's an HTTP error
    const errorString = String(error)
    if (errorString.includes('405') || errorString.includes('HTTP')) {
      console.error('⚠️ HTTP ERROR DETECTED IN RSS PROCESSING')
      console.error('Full error:', JSON.stringify(error, null, 2))
    }

    return NextResponse.json({
      error: 'RSS processing failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.name : 'Unknown',
      errorString: String(error)
    }, { status: 500 })
  }
}

