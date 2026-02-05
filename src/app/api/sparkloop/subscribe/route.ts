import { NextRequest, NextResponse } from 'next/server'
import { SparkLoopService } from '@/lib/sparkloop-client'

/**
 * POST /api/sparkloop/subscribe
 *
 * Subscribe a user to selected newsletter recommendations
 * Proxies to SparkLoop API to keep API key server-side
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, refCodes, countryCode } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    if (!refCodes || !Array.isArray(refCodes) || refCodes.length === 0) {
      return NextResponse.json(
        { error: 'At least one recommendation must be selected' },
        { status: 400 }
      )
    }

    const service = new SparkLoopService()

    await service.subscribeToNewsletters({
      subscriber_email: email,
      country_code: countryCode || 'US',
      recommendations: refCodes.join(','),
      utm_source: 'custom_popup',
    })

    console.log(`[SparkLoop Subscribe] Successfully subscribed ${email} to ${refCodes.length} newsletters`)

    return NextResponse.json({
      success: true,
      subscribedCount: refCodes.length,
    })
  } catch (error) {
    console.error('[SparkLoop Subscribe] Failed:', error)

    return NextResponse.json(
      {
        error: 'Failed to subscribe to newsletters',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
