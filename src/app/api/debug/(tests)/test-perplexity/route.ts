import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import { getRoadWorkWithPerplexity } from '@/lib/perplexity'

export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(tests)/test-perplexity' },
  async ({ request, logger }) => {
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  const targetDate = searchParams.get('targetDate') || new Date().toISOString().split('T')[0]

  // Only allow with test secret
  if (secret !== 'test-perplexity-road-work') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('🔍 Testing Perplexity road work generation...')
    console.log('Target date:', targetDate)

    const startTime = Date.now()
    const roadWorkItems = await getRoadWorkWithPerplexity(targetDate)
    const duration = Date.now() - startTime

    console.log(`✅ Perplexity returned ${roadWorkItems.length} items in ${duration}ms`)

    return NextResponse.json({
      success: true,
      targetDate,
      duration: `${duration}ms`,
      itemCount: roadWorkItems.length,
      items: roadWorkItems,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Perplexity test failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
  }
)