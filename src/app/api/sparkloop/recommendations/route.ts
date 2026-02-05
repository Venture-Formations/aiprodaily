import { NextRequest, NextResponse } from 'next/server'
import { SparkLoopService } from '@/lib/sparkloop-client'

/**
 * GET /api/sparkloop/recommendations
 *
 * Proxy endpoint to fetch SparkLoop Upscribe recommendations
 * This keeps the API key server-side and allows client-side fetching
 */
export async function GET(request: NextRequest) {
  try {
    const service = new SparkLoopService()
    const recommendations = await service.getRecommendations()

    // Sort and return with pre-selection info
    const sorted = SparkLoopService.scoreAndSortRecommendations(recommendations)
    const preSelectedRefCodes = SparkLoopService.getPreSelectedRefCodes(recommendations, 3)

    return NextResponse.json({
      recommendations: sorted,
      preSelectedRefCodes,
      total: sorted.length,
    })
  } catch (error) {
    console.error('[SparkLoop API] Failed to fetch recommendations:', error)

    // Return empty array instead of error to allow graceful degradation
    return NextResponse.json({
      recommendations: [],
      preSelectedRefCodes: [],
      total: 0,
      error: error instanceof Error ? error.message : 'Failed to fetch recommendations',
    })
  }
}

/**
 * POST /api/sparkloop/recommendations
 *
 * Generate personalized recommendations based on subscriber location
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { country_code, region_code, limit } = body

    const service = new SparkLoopService()
    const recommendations = await service.generateRecommendations({
      country_code: country_code || 'US',
      region_code,
      limit: limit || 10,
    })

    const sorted = SparkLoopService.scoreAndSortRecommendations(recommendations)
    const preSelectedRefCodes = SparkLoopService.getPreSelectedRefCodes(recommendations, 3)

    return NextResponse.json({
      recommendations: sorted,
      preSelectedRefCodes,
      total: sorted.length,
    })
  } catch (error) {
    console.error('[SparkLoop API] Failed to generate recommendations:', error)

    return NextResponse.json({
      recommendations: [],
      preSelectedRefCodes: [],
      total: 0,
      error: error instanceof Error ? error.message : 'Failed to generate recommendations',
    })
  }
}
