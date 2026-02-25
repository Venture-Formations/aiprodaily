import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
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
export const POST = withApiHandler(
  { authTier: 'admin', logContext: 'debug/sparkloop-test' },
  async ({ request, logger }) => {
    const { email, refCodes } = await request.json()

    if (!email || !refCodes || !Array.isArray(refCodes)) {
      return NextResponse.json(
        { error: 'email and refCodes[] required' },
        { status: 400 }
      )
    }

    const service = new SparkLoopService()

    logger.info({ email, refCodes }, '[SparkLoop Test] Testing subscription...')

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
  }
)

/**
 * GET /api/debug/sparkloop-test
 *
 * Get current recommendations from our database for testing
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/sparkloop-test' },
  async ({ logger }) => {
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
  }
)
