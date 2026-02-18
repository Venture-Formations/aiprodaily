import { NextRequest, NextResponse } from 'next/server'
import { SparkLoopService } from '@/lib/sparkloop-client'
import { PUBLICATION_ID } from '@/lib/config'

/**
 * POST /api/debug/sparkloop-test
 *
 * Test SparkLoop subscription flow
 * Body: { email: string, refCodes: string[] }
 *
 * Returns SparkLoop's response for verification
 */
export async function POST(request: NextRequest) {
  // Only allow in development or with CRON_SECRET
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isDev = process.env.NODE_ENV === 'development'

  if (!isDev && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { email, refCodes } = await request.json()

    if (!email || !refCodes || !Array.isArray(refCodes)) {
      return NextResponse.json(
        { error: 'email and refCodes[] required' },
        { status: 400 }
      )
    }

    const service = new SparkLoopService()

    console.log('[SparkLoop Test] Testing subscription...')
    console.log('[SparkLoop Test] Email:', email)
    console.log('[SparkLoop Test] Ref codes:', refCodes)

    const result = await service.subscribeToNewsletters({
      subscriber_email: email,
      country_code: 'US',
      recommendations: refCodes.join(','),
      utm_source: 'debug_test',
    })

    return NextResponse.json({
      success: true,
      message: 'Subscription sent to SparkLoop',
      sparkloopResponse: result.response,
      testData: { email, refCodes },
    })
  } catch (error) {
    console.error('[SparkLoop Test] Error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/debug/sparkloop-test
 *
 * Get current recommendations from our database for testing
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isDev = process.env.NODE_ENV === 'development'

  if (!isDev && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const service = new SparkLoopService()
    const stored = await service.getStoredRecommendations(PUBLICATION_ID)

    const active = stored.filter(r => r.status === 'active' && !(r as any).excluded)

    return NextResponse.json({
      message: 'Use these ref_codes to test subscription',
      activeCount: active.length,
      refCodes: active.slice(0, 5).map(r => ({
        ref_code: r.ref_code,
        name: r.publication_name,
        cpa: r.cpa,
      })),
      exampleRequest: {
        method: 'POST',
        body: {
          email: 'test@example.com',
          refCodes: active.slice(0, 2).map(r => r.ref_code),
        },
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
