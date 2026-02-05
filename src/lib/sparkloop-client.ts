/**
 * SparkLoop API Client
 *
 * Server-side client for interacting with SparkLoop API v2
 * Used for fetching Upscribe recommendations and subscribing users.
 */

import type {
  SparkLoopRecommendation,
  SparkLoopRecommendationsResponse,
  SparkLoopGenerateRequest,
  SparkLoopSubscribeRequest,
} from '@/types/sparkloop'

const SPARKLOOP_API_BASE = 'https://api.sparkloop.app/v2'

export class SparkLoopService {
  private apiKey: string
  private upscribeId: string

  constructor() {
    const apiKey = process.env.SPARKLOOP_API_KEY
    const upscribeId = process.env.SPARKLOOP_UPSCRIBE_ID

    if (!apiKey) {
      throw new Error('SPARKLOOP_API_KEY environment variable is not set')
    }
    if (!upscribeId) {
      throw new Error('SPARKLOOP_UPSCRIBE_ID environment variable is not set')
    }

    this.apiKey = apiKey
    this.upscribeId = upscribeId
  }

  /**
   * Get all recommendations for the Upscribe
   * Returns active recommendations sorted by potential value
   */
  async getRecommendations(): Promise<SparkLoopRecommendation[]> {
    const url = `${SPARKLOOP_API_BASE}/upscribes/${this.upscribeId}/recommendations?per_page=50`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[SparkLoop] Failed to fetch recommendations:', response.status, errorText)
      throw new Error(`SparkLoop API error: ${response.status}`)
    }

    const data: SparkLoopRecommendationsResponse = await response.json()
    console.log(`[SparkLoop] Fetched ${data.recommendations.length} recommendations`)

    // Filter to only active recommendations
    return data.recommendations.filter(rec => rec.status === 'active')
  }

  /**
   * Generate personalized recommendations for a subscriber
   * Uses country/region codes for better targeting
   */
  async generateRecommendations(
    params: SparkLoopGenerateRequest
  ): Promise<SparkLoopRecommendation[]> {
    const url = `${SPARKLOOP_API_BASE}/upscribes/${this.upscribeId}/recommendations`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        country_code: params.country_code || 'US',
        region_code: params.region_code,
        limit: params.limit || 10,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[SparkLoop] Failed to generate recommendations:', response.status, errorText)
      throw new Error(`SparkLoop API error: ${response.status}`)
    }

    const data: SparkLoopRecommendationsResponse = await response.json()
    console.log(`[SparkLoop] Generated ${data.recommendations.length} recommendations`)

    return data.recommendations.filter(rec => rec.status === 'active')
  }

  /**
   * Subscribe a user to selected newsletter recommendations
   */
  async subscribeToNewsletters(params: SparkLoopSubscribeRequest): Promise<void> {
    const url = `${SPARKLOOP_API_BASE}/upscribes/${this.upscribeId}/subscribe`

    console.log(`[SparkLoop] Subscribing ${params.subscriber_email} to: ${params.recommendations}`)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscriber_email: params.subscriber_email,
        country_code: params.country_code,
        recommendations: params.recommendations,
        utm_source: params.utm_source || 'custom_popup',
        utm_campaign: params.utm_campaign,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[SparkLoop] Failed to subscribe:', response.status, errorText)
      throw new Error(`SparkLoop subscribe error: ${response.status}`)
    }

    console.log(`[SparkLoop] Successfully subscribed ${params.subscriber_email}`)
  }

  /**
   * Score and sort recommendations for pre-selection
   * Prioritizes by: CPA (payout) * estimated value
   */
  static scoreAndSortRecommendations(
    recommendations: SparkLoopRecommendation[]
  ): SparkLoopRecommendation[] {
    return [...recommendations].sort((a, b) => {
      // Paid recommendations with CPA get priority
      const scoreA = (a.cpa || 0) + (a.type === 'paid' ? 100 : 0)
      const scoreB = (b.cpa || 0) + (b.type === 'paid' ? 100 : 0)
      return scoreB - scoreA
    })
  }

  /**
   * Get pre-selected ref_codes based on scoring
   * Returns top N recommendations by value
   */
  static getPreSelectedRefCodes(
    recommendations: SparkLoopRecommendation[],
    count: number = 3
  ): string[] {
    const sorted = SparkLoopService.scoreAndSortRecommendations(recommendations)
    return sorted.slice(0, count).map(rec => rec.ref_code)
  }
}

/**
 * Create a SparkLoop service instance
 * Returns null if environment variables are not configured
 */
export function createSparkLoopService(): SparkLoopService | null {
  try {
    return new SparkLoopService()
  } catch (error) {
    console.warn('[SparkLoop] Service not configured:', error)
    return null
  }
}
