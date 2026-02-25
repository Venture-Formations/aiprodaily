import { NextRequest, NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'

const SPARKLOOP_API_BASE = 'https://api.sparkloop.app/v2'

/**
 * GET /api/debug/sparkloop-upscribes
 *
 * Debug endpoint to fetch all Upscribes from SparkLoop API
 * Used to find the correct Upscribe ID for configuration
 */
export const GET = withApiHandler(
  { authTier: 'admin', logContext: 'debug/(integrations)/sparkloop-upscribes' },
  async ({ logger }) => {
  const apiKey = process.env.SPARKLOOP_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'SPARKLOOP_API_KEY not configured' },
      { status: 500 }
    )
  }

  try {
    const response = await fetch(`${SPARKLOOP_API_BASE}/upscribes`, {
      method: 'GET',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: `SparkLoop API error: ${response.status}`, details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      upscribes: data,
      message: 'Use the uuid from the upscribe you want as SPARKLOOP_UPSCRIBE_ID',
    })
  } catch (error) {
    console.error('[SparkLoop Debug] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch upscribes', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
  }
)
