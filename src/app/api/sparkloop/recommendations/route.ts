import { NextRequest, NextResponse } from 'next/server'
import { SparkLoopService } from '@/lib/sparkloop-client'
import { supabaseAdmin } from '@/lib/supabase'
import { getPublicationSettings } from '@/lib/publication-settings'

// Default publication ID for AI Pro Daily
const DEFAULT_PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

// Hardcoded fallbacks if no publication_settings exist
const FALLBACK_DEFAULT_CR = 0.22
const FALLBACK_DEFAULT_RCR = 0.25

/**
 * GET /api/sparkloop/recommendations
 *
 * Returns top recommendations from our database (not SparkLoop API)
 * - Filters to active recommendations only
 * - Scores by CR × CPA × RCR (expected revenue per impression)
 * - Uses our CR/RCR if we have 20+ data points
 * - Falls back to 22% CR, SparkLoop RCR or 25% if null
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

    // Filter out recs with no SL RCR that have hit 50 submissions (unless they have an override_rcr)
    const eligible = (recommendations || []).filter(rec => {
      const slRcr = rec.sparkloop_rcr !== null ? Number(rec.sparkloop_rcr) : null
      const hasSLRcr = slRcr !== null && slRcr > 0
      const hasOverrideRcr = rec.override_rcr !== null && rec.override_rcr !== undefined
      if (!hasSLRcr && !hasOverrideRcr && (rec.submissions || 0) >= 50) {
        return false // Capped: no SL RCR data after 50 submissions
      }
      return true
    })

    // Load configurable defaults from publication_settings
    const defaults = await getPublicationSettings(DEFAULT_PUBLICATION_ID, [
      'sparkloop_default_cr',
      'sparkloop_default_rcr',
    ])
    const defaultCr = defaults.sparkloop_default_cr ? parseFloat(defaults.sparkloop_default_cr) / 100 : FALLBACK_DEFAULT_CR
    const defaultRcr = defaults.sparkloop_default_rcr ? parseFloat(defaults.sparkloop_default_rcr) / 100 : FALLBACK_DEFAULT_RCR

    // Score and sort recommendations by CR × CPA × RCR
    // Priority: real data > override (replaces default) > default
    // CR:  our_cr (if 50+ impressions) > override_cr > configurable default
    // RCR: sparkloop_rcr > override_rcr > configurable default
    const scored = eligible.map(rec => {
      const hasOverrideCr = rec.override_cr !== null && rec.override_cr !== undefined
      const hasOverrideRcr = rec.override_rcr !== null && rec.override_rcr !== undefined
      const hasEnoughData = (rec.impressions || 0) >= 50
      const hasOurCr = hasEnoughData && rec.our_cr !== null && Number(rec.our_cr) > 0
      const slRcr = rec.sparkloop_rcr !== null ? Number(rec.sparkloop_rcr) : null
      const hasSLRcr = slRcr !== null && slRcr > 0

      const cr = hasOverrideCr ? Number(rec.override_cr) / 100
        : hasOurCr ? Number(rec.our_cr) / 100
        : defaultCr
      const rcr = hasOverrideRcr ? Number(rec.override_rcr) / 100
        : hasSLRcr ? slRcr! / 100
        : defaultRcr
      const cpa = (rec.cpa || 0) / 100
      const score = cr * cpa * rcr

      return { ...rec, score }
    })

    // Exclude recommendations missing a description
    const withDescription = scored.filter(rec => rec.description && rec.description.trim().length > 0)

    // Sort by score descending and slice with offset/limit
    withDescription.sort((a, b) => b.score - a.score)
    const url = new URL(request.url)
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10))
    const limit = Math.max(1, Math.min(parseInt(url.searchParams.get('limit') || '5', 10), 20))
    const selected = withDescription.slice(offset, offset + limit)

    // Pre-select all returned recommendations
    const preSelectedRefCodes = selected.map(r => r.ref_code)

    // Convert to SparkLoop API format for frontend compatibility
    const formattedRecommendations = selected.map(rec => ({
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

    console.log(`[SparkLoop] Showing ${selected.length} of ${recommendations?.length || 0} active recommendations (offset=${offset}, limit=${limit}, scored by CR×CPA×RCR)`)

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
