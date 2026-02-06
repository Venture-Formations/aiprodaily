import { NextRequest, NextResponse } from 'next/server'
import { SparkLoopService } from '@/lib/sparkloop-client'
import { supabaseAdmin } from '@/lib/supabase'

// Default publication ID for AI Pro Daily
const DEFAULT_PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

/**
 * GET /api/sparkloop/recommendations
 *
 * Returns top recommendations from our database (not SparkLoop API)
 * - Filters to active recommendations only
 * - Scores by CR × CPA × RCR (expected revenue per impression)
 * - Uses our CR/RCR if we have 20+ data points
 * - Falls back to 10% CR, SparkLoop RCR or 25% if null
 */
export async function GET(request: NextRequest) {
  try {
    // Fetch active, non-excluded recommendations from our database
    const { data: recommendations, error } = await supabaseAdmin
      .from('sparkloop_recommendations')
      .select('*')
      .eq('publication_id', DEFAULT_PUBLICATION_ID)
      .eq('status', 'active')
      .or('excluded.is.null,excluded.eq.false') // Not excluded
      .not('cpa', 'is', null) // Must have CPA to be useful

    if (error) {
      throw new Error(`Database error: ${error.message}`)
    }

    if (!recommendations || recommendations.length === 0) {
      console.log('[SparkLoop] No active recommendations in database, syncing from API...')
      const service = new SparkLoopService()
      await service.syncRecommendationsToDatabase(DEFAULT_PUBLICATION_ID)

      // Retry after sync
      const { data: refreshed } = await supabaseAdmin
        .from('sparkloop_recommendations')
        .select('*')
        .eq('publication_id', DEFAULT_PUBLICATION_ID)
        .eq('status', 'active')
        .not('cpa', 'is', null)

      if (!refreshed || refreshed.length === 0) {
        return NextResponse.json({
          recommendations: [],
          preSelectedRefCodes: [],
          total: 0,
        })
      }
    }

    // Score and sort recommendations by CR × CPA × RCR
    const scored = (recommendations || []).map(rec => {
      // Use our CR if 20+ impressions, otherwise 10%
      const cr = rec.our_cr !== null ? rec.our_cr / 100 : 0.10

      // Use our RCR if 20+ outcomes, otherwise SparkLoop's, otherwise 25%
      const rcr = rec.our_rcr !== null
        ? rec.our_rcr / 100
        : (rec.sparkloop_rcr !== null ? rec.sparkloop_rcr / 100 : 0.25)

      // CPA in dollars
      const cpa = (rec.cpa || 0) / 100

      // Score = CR × CPA × RCR (expected revenue per impression)
      const score = cr * cpa * rcr

      return { ...rec, score }
    })

    // Sort by score descending and take top 5
    scored.sort((a, b) => b.score - a.score)
    const top5 = scored.slice(0, 5)

    // Pre-select all 5
    const preSelectedRefCodes = top5.map(r => r.ref_code)

    // Convert to SparkLoop API format for frontend compatibility
    const formattedRecommendations = top5.map(rec => ({
      uuid: rec.sparkloop_uuid,
      ref_code: rec.ref_code,
      type: rec.type,
      status: rec.status,
      publication_name: rec.publication_name,
      publication_logo: rec.publication_logo,
      description: rec.description,
      cpa: rec.cpa,
      max_payout: rec.max_payout,
      last_30_days_confirmation_rate: rec.sparkloop_rcr,
      pinned: rec.pinned,
      position: rec.position,
      referrals: {
        pending: rec.sparkloop_pending,
        rejected: rec.sparkloop_rejected,
        confirmed: rec.sparkloop_confirmed,
      },
      earnings: rec.sparkloop_earnings,
      net_earnings: rec.sparkloop_net_earnings,
      partner_program_uuid: rec.partner_program_uuid,
      // Include our metrics for debugging
      _score: rec.score,
      _our_cr: rec.our_cr,
      _our_rcr: rec.our_rcr,
    }))

    console.log(`[SparkLoop] Showing top 5 of ${recommendations?.length || 0} active recommendations (scored by CR×CPA×RCR)`)

    return NextResponse.json({
      recommendations: formattedRecommendations,
      preSelectedRefCodes,
      total: formattedRecommendations.length,
    })
  } catch (error) {
    console.error('[SparkLoop API] Failed to fetch recommendations:', error)

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
 * Same as GET - returns top recommendations from our database
 * POST is kept for API compatibility but ignores location params
 * (We use our own scoring instead of SparkLoop's geo-targeting)
 */
export async function POST(request: NextRequest) {
  // Redirect to GET logic - we use our database scoring now
  return GET(request)
}
