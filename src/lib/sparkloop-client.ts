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
  SparkLoopSubscriber,
  SparkLoopSubscriberResponse,
  StoredSparkLoopRecommendation,
} from '@/types/sparkloop'
import { supabaseAdmin } from '@/lib/supabase'

const SPARKLOOP_API_BASE = 'https://api.sparkloop.app/v2'

// Default publication ID for AI Pro Daily
const DEFAULT_PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'

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
   * Get all recommendations for the Upscribe (including paused)
   * Used for syncing to database — paginates through all pages
   */
  async getAllRecommendations(): Promise<SparkLoopRecommendation[]> {
    const allRecs: SparkLoopRecommendation[] = []
    let page = 1

    while (true) {
      const url = `${SPARKLOOP_API_BASE}/upscribes/${this.upscribeId}/recommendations?per_page=200&page=${page}`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[SparkLoop] Failed to fetch recommendations:', response.status, errorText)
        throw new Error(`SparkLoop API error: ${response.status}`)
      }

      const data: SparkLoopRecommendationsResponse = await response.json()
      allRecs.push(...data.recommendations)

      if (page >= data.meta.total_pages) break
      page++
    }

    const active = allRecs.filter(r => r.status === 'active').length
    const paused = allRecs.filter(r => r.status === 'paused').length
    console.log(`[SparkLoop] Fetched ${allRecs.length} total recommendations (${active} active, ${paused} paused) across ${page} page(s)`)

    return allRecs
  }

  /**
   * Get active recommendations for the Upscribe
   * Used for displaying in popup (only show active ones)
   */
  async getRecommendations(): Promise<SparkLoopRecommendation[]> {
    const all = await this.getAllRecommendations()
    const active = all.filter(rec => rec.status === 'active')
    console.log(`[SparkLoop] ${active.length} active of ${all.length} total`)
    return active
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
        'X-API-KEY': this.apiKey,
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
   * Create or fetch a subscriber in SparkLoop (Step 2 of Upscribe flow)
   * POST /v2/subscribers — if 400 (already exists), GET /v2/subscribers/:email
   */
  async createOrFetchSubscriber(params: {
    email: string
    country_code: string
    ip_address?: string
    user_agent?: string
  }): Promise<SparkLoopSubscriber> {
    const createUrl = `${SPARKLOOP_API_BASE}/subscribers`

    const createBody: Record<string, string> = {
      email: params.email,
      country_code: params.country_code,
    }
    if (params.ip_address) createBody.ip_address = params.ip_address
    if (params.user_agent) createBody.user_agent = params.user_agent

    const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'X-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createBody),
    })

    if (createResponse.ok) {
      const data: SparkLoopSubscriberResponse = await createResponse.json()
      console.log(`[SparkLoop] Created subscriber: ${data.subscriber.uuid}`)
      return data.subscriber
    }

    // Log the error body for debugging
    const createErrorText = await createResponse.text()
    console.log(`[SparkLoop] Create subscriber returned ${createResponse.status}: ${createErrorText}`)

    // 400 typically means subscriber already exists — fetch instead
    if (createResponse.status === 400) {
      const fetchUrl = `${SPARKLOOP_API_BASE}/subscribers/${encodeURIComponent(params.email)}`
      console.log(`[SparkLoop] Fetching existing subscriber by email...`)

      const fetchResponse = await fetch(fetchUrl, {
        method: 'GET',
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
        },
      })

      if (fetchResponse.ok) {
        const data: SparkLoopSubscriberResponse = await fetchResponse.json()
        console.log(`[SparkLoop] Fetched existing subscriber: ${data.subscriber.uuid}`)
        return data.subscriber
      }

      // GET by email failed — try extracting UUID from the 400 error body if present
      const fetchErrorText = await fetchResponse.text()
      console.log(`[SparkLoop] GET by email returned ${fetchResponse.status}: ${fetchErrorText}`)

      // Some APIs return the existing subscriber info in the 400 response
      try {
        const errorJson = JSON.parse(createErrorText)
        if (errorJson.subscriber?.uuid) {
          console.log(`[SparkLoop] Found subscriber UUID in 400 response: ${errorJson.subscriber.uuid}`)
          return errorJson.subscriber as SparkLoopSubscriber
        }
      } catch {
        // Not JSON or no subscriber in error response
      }

      throw new Error(`SparkLoop fetch subscriber failed: POST 400 (${createErrorText}), GET ${fetchResponse.status} (${fetchErrorText})`)
    }

    throw new Error(`SparkLoop create subscriber error: ${createResponse.status} - ${createErrorText}`)
  }

  /**
   * Subscribe a user to selected newsletter recommendations
   * Returns the SparkLoop API response for verification
   */
  async subscribeToNewsletters(params: SparkLoopSubscribeRequest): Promise<{ success: boolean; response?: unknown }> {
    const url = `${SPARKLOOP_API_BASE}/upscribes/${this.upscribeId}/subscribe`

    console.log(`[SparkLoop] Subscribing ${params.subscriber_email} to: ${params.recommendations}`)

    const payload: Record<string, string | undefined> = {
      subscriber_email: params.subscriber_email,
      country_code: params.country_code,
      recommendations: params.recommendations,
      utm_source: params.utm_source || 'custom_popup',
      utm_campaign: params.utm_campaign,
    }
    // subscriber_uuid is required for proper referral tracking attribution
    if (params.subscriber_uuid) {
      payload.subscriber_uuid = params.subscriber_uuid
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const responseText = await response.text()
    let responseData: unknown = null
    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = responseText
    }

    if (!response.ok) {
      console.error('[SparkLoop] Failed to subscribe:', response.status, responseData)
      throw new Error(`SparkLoop subscribe error: ${response.status} - ${responseText}`)
    }

    console.log(`[SparkLoop] Successfully subscribed ${params.subscriber_email}`, responseData)
    return { success: true, response: responseData }
  }

  /**
   * Fetch partner campaign details which includes remaining_budget_dollars
   * This tells us which recommendations are out of budget
   * Returns campaign data indexed by UUID and by normalized name for reliable matching
   */
  async getPartnerCampaigns(): Promise<{
    byUuid: Map<string, { remaining_budget_dollars: number; referral_pending_period: number; name: string; status: string }>;
    nameSet: Set<string>;
    byName: Map<string, { remaining_budget_dollars: number; referral_pending_period: number; status: string }>;
  }> {
    const emptyResult = { byUuid: new Map(), nameSet: new Set<string>(), byName: new Map() }
    const url = `${SPARKLOOP_API_BASE}/partner_profile/partner_campaigns?per_page=200`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error('[SparkLoop] Failed to fetch partner campaigns:', response.status)
      return emptyResult
    }

    const data = await response.json()
    const campaigns = data.partner_campaigns || []

    // Log first campaign shape for diagnostics
    if (campaigns.length > 0) {
      const sample = campaigns[0]
      console.log(`[SparkLoop] Sample campaign keys: ${Object.keys(sample).join(', ')}`)
      const sampleName = sample.name || sample.publication_name || sample.title || 'N/A'
      console.log(`[SparkLoop] Sample campaign: uuid=${sample.uuid}, name=${sampleName}, status=${sample.status || 'N/A'}, budget=$${sample.remaining_budget_dollars}`)
    }

    // Build multiple lookup maps for reliable matching
    const byUuid = new Map<string, { remaining_budget_dollars: number; referral_pending_period: number; name: string; status: string }>()
    const nameSet = new Set<string>()
    const byName = new Map<string, { remaining_budget_dollars: number; referral_pending_period: number; status: string }>()

    for (const campaign of campaigns) {
      const campaignName = (campaign.name || campaign.publication_name || campaign.title || '').trim().toLowerCase()
      const budgetData = {
        remaining_budget_dollars: campaign.remaining_budget_dollars ?? 0,
        referral_pending_period: campaign.referral_pending_period ?? 14,
        status: (campaign.status || 'active').toLowerCase(),
      }

      byUuid.set(campaign.uuid, { ...budgetData, name: campaignName })
      if (campaignName) {
        nameSet.add(campaignName)
        byName.set(campaignName, budgetData)
      }
    }

    const statusCounts: Record<string, number> = {}
    for (const c of Array.from(byUuid.values())) {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1
    }
    console.log(`[SparkLoop] Fetched ${byUuid.size} partner campaigns (${nameSet.size} unique names, statuses: ${JSON.stringify(statusCounts)})`)
    return { byUuid, nameSet, byName }
  }

  /**
   * Sync all recommendations from SparkLoop API to our database
   * Updates existing records and creates new ones
   * Includes both active AND paused recommendations to track status changes
   * Also fetches budget info to auto-exclude out-of-budget recommendations
   * Tracks deltas in confirms/rejections for timeframe-based RCR calculation
   */
  async syncRecommendationsToDatabase(publicationId: string = DEFAULT_PUBLICATION_ID): Promise<{
    synced: number
    created: number
    updated: number
    active: number
    paused: number
    outOfBudget: number
    confirmDeltas: number
    rejectionDeltas: number
  }> {
    // Fetch recommendations and partner campaign budget info in parallel
    const [recommendations, campaignData] = await Promise.all([
      this.getAllRecommendations(),
      this.getPartnerCampaigns(),
    ])
    let created = 0
    let updated = 0
    let outOfBudget = 0
    let confirmDeltas = 0
    let rejectionDeltas = 0

    // Log budget match diagnostics
    let budgetMatched = 0
    let budgetUnmatched = 0
    let matchedByUuid = 0
    let matchedByName = 0
    let pausedByCampaignStatus = 0

    // Check if partner campaigns data is available (non-empty API response)
    const partnerCampaignsAvailable = campaignData.byUuid.size > 0 || campaignData.byName.size > 0

    // Log first rec UUIDs for diagnostics
    if (recommendations.length > 0) {
      const r = recommendations[0]
      console.log(`[SparkLoop] Sample rec: uuid=${r.uuid}, partner_program_uuid=${r.partner_program_uuid}, ref_code=${r.ref_code}, name=${r.publication_name}`)
      console.log(`[SparkLoop] Campaign UUID map size: ${campaignData.byUuid.size}, name map size: ${campaignData.byName.size}`)
    }

    for (const rec of recommendations) {
      const { data: existing } = await supabaseAdmin
        .from('sparkloop_recommendations')
        .select('id, excluded, excluded_reason, sparkloop_confirmed, sparkloop_rejected')
        .eq('publication_id', publicationId)
        .eq('ref_code', rec.ref_code)
        .single()

      // Get budget info from partner campaigns using multiple matching strategies
      // Strategy 1: Match by partner_program_uuid (trust UUID — it's a unique identifier)
      // Strategy 2: Match by rec.uuid
      // Strategy 3: Match by publication name (case-insensitive, fallback)
      const recNameNormalized = (rec.publication_name || '').trim().toLowerCase()

      let budgetInfo: { remaining_budget_dollars: number; referral_pending_period: number; status: string } | undefined
      let matchMethod = 'none'

      // Try UUID-based matching first — trust UUID matches without name verification.
      // UUIDs are unique identifiers; requiring name verification caused mass false-negatives
      // because campaign names often differ slightly from recommendation names.
      const uuidMatch = campaignData.byUuid.get(rec.partner_program_uuid) || campaignData.byUuid.get(rec.uuid)
      if (uuidMatch) {
        budgetInfo = uuidMatch
        matchMethod = 'uuid'
      } else {
        // No UUID match — try name-based matching
        budgetInfo = campaignData.byName.get(recNameNormalized)
        if (budgetInfo) {
          matchMethod = 'name'
          matchedByName++
        }
      }

      if (budgetInfo) { budgetMatched++; if (matchMethod === 'uuid') matchedByUuid++ } else { budgetUnmatched++ }

      // Debug: log specific rec for diagnostics
      if (rec.ref_code === '3bff334870') {
        console.log(`[SparkLoop DEBUG] Colin Rocker: rec.status=${rec.status}, match=${matchMethod}, budgetInfo.status=${budgetInfo?.status ?? 'N/A'}, budget=$${budgetInfo?.remaining_budget_dollars ?? 'N/A'}`)
      }

      // Determine effective status:
      // - If rec.status is already 'paused' from the API, trust it
      // - If partner campaign has status 'paused', trust that over the recommendations API
      //   (SparkLoop's recommendations API often reports 'active' for paused recs)
      // - If partner_campaigns data is available and this rec is NOT in it, mark as paused
      // - Otherwise, use the API status
      const isPausedByPartner = !budgetInfo && partnerCampaignsAvailable
      const isPausedByCampaignStatus = budgetInfo && budgetInfo.status === 'paused'
      const effectiveStatus = (isPausedByPartner || isPausedByCampaignStatus) ? 'paused' : rec.status

      const remainingBudget = (isPausedByPartner || isPausedByCampaignStatus) ? 0 : (budgetInfo?.remaining_budget_dollars ?? 0)
      const screeningPeriod = budgetInfo?.referral_pending_period ?? null
      const cpaInDollars = (rec.cpa || 0) / 100
      const minBudgetRequired = cpaInDollars * 5 // Need at least 5 referrals worth of budget

      // Budget-based auto-exclusion only for active recs with known budget
      const isOutOfBudget = !isPausedByPartner && !isPausedByCampaignStatus && remainingBudget < minBudgetRequired

      // Auto-exclude/reactivate only for budget reasons (paused is handled by status alone)
      let excluded = existing?.excluded ?? false
      let excludedReason = existing?.excluded_reason ?? null

      if (isOutOfBudget && !excluded) {
        excluded = true
        excludedReason = 'budget_used_up'
        outOfBudget++
        console.log(`[SparkLoop] Auto-excluding ${rec.publication_name} (budget $${remainingBudget} < 5x CPA $${minBudgetRequired})`)
      } else if (!isOutOfBudget && excluded && excludedReason === 'budget_used_up') {
        // Budget restored, reactivate if it was auto-excluded for budget
        excluded = false
        excludedReason = null
        console.log(`[SparkLoop] Auto-reactivating ${rec.publication_name} (budget restored: $${remainingBudget})`)
      }

      // If previously auto-excluded as partner_paused but now back in partner campaigns, clear it
      if (!isPausedByPartner && excluded && excludedReason === 'partner_paused') {
        excluded = false
        excludedReason = null
        console.log(`[SparkLoop] Clearing partner_paused exclusion for ${rec.publication_name} (back in partner campaigns)`)
      }

      if (isPausedByCampaignStatus) {
        pausedByCampaignStatus++
        console.log(`[SparkLoop] ${rec.publication_name} — paused (campaign status='paused', match: ${matchMethod})`)
      } else if (isPausedByPartner) {
        console.log(`[SparkLoop] ${rec.publication_name} — paused (not in partner campaigns, match: ${matchMethod})`)
      }

      const recordData = {
        publication_id: publicationId,
        ref_code: rec.ref_code,
        sparkloop_uuid: rec.uuid,
        publication_name: rec.publication_name,
        publication_logo: rec.publication_logo,
        description: rec.description,
        type: rec.type,
        status: effectiveStatus,
        cpa: rec.cpa,
        sparkloop_rcr: rec.last_30_days_confirmation_rate,
        pinned: rec.pinned,
        position: rec.position,
        max_payout: rec.max_payout,
        partner_program_uuid: rec.partner_program_uuid,
        sparkloop_pending: rec.referrals?.pending || 0,
        sparkloop_rejected: rec.referrals?.rejected || 0,
        sparkloop_confirmed: rec.referrals?.confirmed || 0,
        sparkloop_earnings: rec.earnings || 0,
        sparkloop_net_earnings: rec.net_earnings || 0,
        remaining_budget_dollars: remainingBudget,
        screening_period: screeningPeriod,
        excluded,
        excluded_reason: excludedReason,
        last_synced_at: new Date().toISOString(),
      }

      if (existing) {
        // Track deltas for confirms and rejections (for timeframe-based RCR)
        const currentConfirmed = rec.referrals?.confirmed || 0
        const currentRejected = rec.referrals?.rejected || 0
        const previousConfirmed = existing.sparkloop_confirmed || 0
        const previousRejected = existing.sparkloop_rejected || 0

        const confirmDelta = currentConfirmed - previousConfirmed
        const rejectionDelta = currentRejected - previousRejected

        // Log confirm deltas as individual events
        if (confirmDelta > 0) {
          await supabaseAdmin.from('sparkloop_events').insert({
            publication_id: publicationId,
            event_type: 'sync_confirm_delta',
            subscriber_email: 'system_sync',
            referred_publication: rec.publication_name,
            referred_publication_id: rec.ref_code,
            raw_payload: {
              delta: confirmDelta,
              previous: previousConfirmed,
              current: currentConfirmed,
              ref_code: rec.ref_code,
            },
            event_timestamp: new Date().toISOString(),
          })
          confirmDeltas += confirmDelta
          console.log(`[SparkLoop] +${confirmDelta} confirms for ${rec.publication_name}`)
        }

        // Log rejection deltas as individual events
        if (rejectionDelta > 0) {
          await supabaseAdmin.from('sparkloop_events').insert({
            publication_id: publicationId,
            event_type: 'sync_rejection_delta',
            subscriber_email: 'system_sync',
            referred_publication: rec.publication_name,
            referred_publication_id: rec.ref_code,
            raw_payload: {
              delta: rejectionDelta,
              previous: previousRejected,
              current: currentRejected,
              ref_code: rec.ref_code,
            },
            event_timestamp: new Date().toISOString(),
          })
          rejectionDeltas += rejectionDelta
          console.log(`[SparkLoop] +${rejectionDelta} rejections for ${rec.publication_name}`)
        }

        // Update existing record (don't overwrite our tracking metrics)
        await supabaseAdmin
          .from('sparkloop_recommendations')
          .update(recordData)
          .eq('id', existing.id)
        updated++
      } else {
        // Create new record
        await supabaseAdmin
          .from('sparkloop_recommendations')
          .insert(recordData)
        created++
      }
    }

    // Detect recommendations that disappeared from the API (partner paused their campaign)
    // SparkLoop removes paused campaigns from the recommendations response entirely
    const apiRefCodes = new Set(recommendations.map(r => r.ref_code))
    const { data: storedActive } = await supabaseAdmin
      .from('sparkloop_recommendations')
      .select('id, ref_code, publication_name, status')
      .eq('publication_id', publicationId)
      .eq('status', 'active')

    let pausedByPartner = 0
    for (const stored of (storedActive || [])) {
      if (!apiRefCodes.has(stored.ref_code)) {
        // This recommendation was active in our DB but is no longer in the API response
        await supabaseAdmin
          .from('sparkloop_recommendations')
          .update({
            status: 'paused',
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', stored.id)
        pausedByPartner++
        console.log(`[SparkLoop] Auto-paused ${stored.publication_name} (disappeared from API — partner likely paused)`)
      }
    }

    // Also detect recommendations that reappeared (partner un-paused)
    const { data: storedPaused } = await supabaseAdmin
      .from('sparkloop_recommendations')
      .select('id, ref_code, publication_name, status')
      .eq('publication_id', publicationId)
      .eq('status', 'paused')

    let reactivated = 0
    for (const stored of (storedPaused || [])) {
      if (apiRefCodes.has(stored.ref_code)) {
        // This was paused in our DB but is back in the API — already updated above in the main loop
        reactivated++
        console.log(`[SparkLoop] Reactivated ${stored.publication_name} (reappeared in API — partner un-paused)`)
      }
    }

    const active = recommendations.filter(r => r.status === 'active').length
    const paused = recommendations.filter(r => r.status === 'paused').length

    console.log(`[SparkLoop] Synced ${recommendations.length} recommendations: ${created} created, ${updated} updated (API: ${active} active, ${paused} paused | ${pausedByCampaignStatus} campaign-paused, ${budgetUnmatched} absent-paused, ${pausedByPartner} disappeared, ${outOfBudget} budget-excluded, ${reactivated} reactivated | budget match: ${budgetMatched} [${matchedByUuid} uuid, ${matchedByName} name], unmatched: ${budgetUnmatched})`)
    if (confirmDeltas > 0 || rejectionDeltas > 0) {
      console.log(`[SparkLoop] Deltas tracked: +${confirmDeltas} confirms, +${rejectionDeltas} rejections`)
    }
    return { synced: recommendations.length, created, updated, active, paused, outOfBudget, confirmDeltas, rejectionDeltas }
  }

  /**
   * Get stored recommendations from our database
   * Falls back to API if no stored data
   */
  async getStoredRecommendations(publicationId: string = DEFAULT_PUBLICATION_ID): Promise<StoredSparkLoopRecommendation[]> {
    const { data, error } = await supabaseAdmin
      .from('sparkloop_recommendations')
      .select('*')
      .eq('publication_id', publicationId)
      .eq('status', 'active')
      .order('cpa', { ascending: false })

    if (error || !data || data.length === 0) {
      console.log('[SparkLoop] No stored recommendations, syncing from API...')
      await this.syncRecommendationsToDatabase(publicationId)

      // Retry fetch after sync
      const { data: refreshedData } = await supabaseAdmin
        .from('sparkloop_recommendations')
        .select('*')
        .eq('publication_id', publicationId)
        .eq('status', 'active')
        .order('cpa', { ascending: false })

      return (refreshedData || []) as StoredSparkLoopRecommendation[]
    }

    return data as StoredSparkLoopRecommendation[]
  }

  /**
   * Increment impression count for recommendations shown in popup
   */
  static async recordImpressions(refCodes: string[], publicationId: string = DEFAULT_PUBLICATION_ID): Promise<void> {
    if (refCodes.length === 0) return

    const { error } = await supabaseAdmin.rpc('increment_sparkloop_impressions', {
      p_publication_id: publicationId,
      p_ref_codes: refCodes,
    })

    if (error) {
      console.error('[SparkLoop] Failed to record impressions:', error)
    } else {
      console.log(`[SparkLoop] Recorded impressions for ${refCodes.length} recommendations`)
    }
  }

  /**
   * Increment selection count when user selects a recommendation
   */
  static async recordSelections(refCodes: string[], publicationId: string = DEFAULT_PUBLICATION_ID): Promise<void> {
    if (refCodes.length === 0) return

    const { error } = await supabaseAdmin.rpc('increment_sparkloop_selections', {
      p_publication_id: publicationId,
      p_ref_codes: refCodes,
    })

    if (error) {
      console.error('[SparkLoop] Failed to record selections:', error)
    }
  }

  /**
   * Increment submission count when user submits selections
   */
  static async recordSubmissions(refCodes: string[], publicationId: string = DEFAULT_PUBLICATION_ID): Promise<void> {
    if (refCodes.length === 0) return

    const { error } = await supabaseAdmin.rpc('increment_sparkloop_submissions', {
      p_publication_id: publicationId,
      p_ref_codes: refCodes,
    })

    if (error) {
      console.error('[SparkLoop] Failed to record submissions:', error)
    } else {
      console.log(`[SparkLoop] Recorded submissions for ${refCodes.length} recommendations`)
    }
  }

  /**
   * Record a confirmed referral (called from webhook handler)
   */
  static async recordConfirm(refCode: string, publicationId: string = DEFAULT_PUBLICATION_ID): Promise<void> {
    const { error } = await supabaseAdmin.rpc('record_sparkloop_confirm', {
      p_publication_id: publicationId,
      p_ref_code: refCode,
    })

    if (error) {
      console.error(`[SparkLoop] Failed to record confirm for ${refCode}:`, error)
    } else {
      console.log(`[SparkLoop] Recorded confirm for ${refCode}`)
    }
  }

  /**
   * Record a rejected referral (called from webhook handler)
   */
  static async recordRejection(refCode: string, publicationId: string = DEFAULT_PUBLICATION_ID): Promise<void> {
    const { error } = await supabaseAdmin.rpc('record_sparkloop_rejection', {
      p_publication_id: publicationId,
      p_ref_code: refCode,
    })

    if (error) {
      console.error(`[SparkLoop] Failed to record rejection for ${refCode}:`, error)
    } else {
      console.log(`[SparkLoop] Recorded rejection for ${refCode}`)
    }
  }

  /**
   * Score a recommendation using CR × CPA × RCR formula
   * Returns expected revenue per impression (higher = better)
   *
   * @param rec - SparkLoop recommendation from API
   * @param ourCR - Our conversion rate (submissions/impressions), null if < 20 impressions
   * @param ourRCR - Our referral confirmation rate, null if < 20 outcomes
   */
  static scoreRecommendation(
    rec: SparkLoopRecommendation,
    ourCR: number | null = null,
    ourRCR: number | null = null
  ): number {
    // CPA in dollars (convert from cents)
    const cpa = (rec.cpa || 0) / 100

    // Use our CR if we have 20+ impressions, otherwise assume 22%
    const cr = ourCR !== null ? ourCR / 100 : 0.22

    // Use our RCR if we have 20+ outcomes, otherwise use SparkLoop's, otherwise assume 25%
    const rcr = ourRCR !== null
      ? ourRCR / 100
      : (rec.last_30_days_confirmation_rate !== null
          ? rec.last_30_days_confirmation_rate / 100
          : 0.25)

    // CR × CPA × RCR = expected revenue per impression
    return cr * cpa * rcr
  }

  /**
   * Score and sort recommendations for display using CR × CPA × RCR
   * Optionally uses our stored metrics if provided
   *
   * @param recommendations - SparkLoop recommendations from API
   * @param storedMetrics - Optional map of ref_code -> { our_cr, our_rcr } from our database
   */
  static scoreAndSortRecommendations(
    recommendations: SparkLoopRecommendation[],
    storedMetrics?: Map<string, { our_cr: number | null; our_rcr: number | null }>
  ): SparkLoopRecommendation[] {
    return [...recommendations].sort((a, b) => {
      const metricsA = storedMetrics?.get(a.ref_code)
      const metricsB = storedMetrics?.get(b.ref_code)

      const scoreA = SparkLoopService.scoreRecommendation(
        a,
        metricsA?.our_cr ?? null,
        metricsA?.our_rcr ?? null
      )
      const scoreB = SparkLoopService.scoreRecommendation(
        b,
        metricsB?.our_cr ?? null,
        metricsB?.our_rcr ?? null
      )
      return scoreB - scoreA
    })
  }

  /**
   * Calculate RCR for a recommendation within a specific timeframe
   * Uses delta events logged during sync to compute confirms/(confirms+rejections)
   *
   * @param refCode - The recommendation ref_code
   * @param days - Number of days to look back (default: 30)
   * @param publicationId - Publication ID
   * @returns RCR percentage (0-100) or null if insufficient data
   */
  static async calculateRCRForTimeframe(
    refCode: string,
    days: number = 30,
    publicationId: string = DEFAULT_PUBLICATION_ID
  ): Promise<number | null> {
    const since = new Date()
    since.setDate(since.getDate() - days)

    // Sum up confirm deltas in timeframe
    const { data: confirmData } = await supabaseAdmin
      .from('sparkloop_events')
      .select('raw_payload')
      .eq('publication_id', publicationId)
      .eq('event_type', 'sync_confirm_delta')
      .eq('referred_publication_id', refCode)
      .gte('event_timestamp', since.toISOString())

    // Sum up rejection deltas in timeframe
    const { data: rejectionData } = await supabaseAdmin
      .from('sparkloop_events')
      .select('raw_payload')
      .eq('publication_id', publicationId)
      .eq('event_type', 'sync_rejection_delta')
      .eq('referred_publication_id', refCode)
      .gte('event_timestamp', since.toISOString())

    const confirms = confirmData?.reduce((sum, e) => sum + ((e.raw_payload as { delta?: number })?.delta || 0), 0) || 0
    const rejections = rejectionData?.reduce((sum, e) => sum + ((e.raw_payload as { delta?: number })?.delta || 0), 0) || 0

    const total = confirms + rejections
    if (total < 5) {
      // Need at least 5 outcomes for meaningful RCR
      return null
    }

    return (confirms / total) * 100
  }

  /**
   * Get RCR for all recommendations within a timeframe
   * Returns a map of ref_code -> RCR percentage
   */
  static async getRCRsForTimeframe(
    days: number = 30,
    publicationId: string = DEFAULT_PUBLICATION_ID
  ): Promise<Map<string, number>> {
    const since = new Date()
    since.setDate(since.getDate() - days)

    // Get all confirm deltas in timeframe grouped by ref_code
    const { data: confirmData } = await supabaseAdmin
      .from('sparkloop_events')
      .select('referred_publication_id, raw_payload')
      .eq('publication_id', publicationId)
      .eq('event_type', 'sync_confirm_delta')
      .gte('event_timestamp', since.toISOString())

    // Get all rejection deltas in timeframe grouped by ref_code
    const { data: rejectionData } = await supabaseAdmin
      .from('sparkloop_events')
      .select('referred_publication_id, raw_payload')
      .eq('publication_id', publicationId)
      .eq('event_type', 'sync_rejection_delta')
      .gte('event_timestamp', since.toISOString())

    // Aggregate by ref_code
    const confirms = new Map<string, number>()
    const rejections = new Map<string, number>()

    confirmData?.forEach(e => {
      const refCode = e.referred_publication_id || ''
      const delta = (e.raw_payload as { delta?: number })?.delta || 0
      confirms.set(refCode, (confirms.get(refCode) || 0) + delta)
    })

    rejectionData?.forEach(e => {
      const refCode = e.referred_publication_id || ''
      const delta = (e.raw_payload as { delta?: number })?.delta || 0
      rejections.set(refCode, (rejections.get(refCode) || 0) + delta)
    })

    // Calculate RCR for each ref_code
    const rcrMap = new Map<string, number>()
    const allRefCodes = new Set([...Array.from(confirms.keys()), ...Array.from(rejections.keys())])

    allRefCodes.forEach(refCode => {
      const c = confirms.get(refCode) || 0
      const r = rejections.get(refCode) || 0
      const total = c + r
      if (total >= 5) {
        rcrMap.set(refCode, (c / total) * 100)
      }
    })

    return rcrMap
  }

  /**
   * Get our stored metrics for recommendations (CR and RCR)
   * Returns a map of ref_code -> metrics for use in scoring
   */
  static async getStoredMetrics(
    publicationId: string = DEFAULT_PUBLICATION_ID
  ): Promise<Map<string, { our_cr: number | null; our_rcr: number | null }>> {
    const { data } = await supabaseAdmin
      .from('sparkloop_recommendations')
      .select('ref_code, our_cr, our_rcr')
      .eq('publication_id', publicationId)

    const metricsMap = new Map<string, { our_cr: number | null; our_rcr: number | null }>()

    if (data) {
      for (const row of data) {
        metricsMap.set(row.ref_code, {
          our_cr: row.our_cr,
          our_rcr: row.our_rcr,
        })
      }
    }

    return metricsMap
  }

  /**
   * Get the top N recommendations to display in the popup
   * Sorts by CR × CPA × RCR score and returns only the best ones
   *
   * @param recommendations - SparkLoop recommendations from API
   * @param count - Number of recommendations to return (default: 5)
   * @param storedMetrics - Optional map of ref_code -> metrics from our database
   */
  static getTopRecommendations(
    recommendations: SparkLoopRecommendation[],
    count: number = 5,
    storedMetrics?: Map<string, { our_cr: number | null; our_rcr: number | null }>
  ): SparkLoopRecommendation[] {
    const sorted = SparkLoopService.scoreAndSortRecommendations(recommendations, storedMetrics)
    return sorted.slice(0, count)
  }

  /**
   * Get pre-selected ref_codes based on scoring
   * Returns top N recommendations by value (from already-filtered list)
   */
  static getPreSelectedRefCodes(
    recommendations: SparkLoopRecommendation[],
    count: number = 3
  ): string[] {
    // Don't re-sort, just take first N (already sorted)
    return recommendations.slice(0, count).map(rec => rec.ref_code)
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
