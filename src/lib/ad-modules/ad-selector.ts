import { supabaseAdmin } from '../supabase'
import type {
  AdModule,
  Advertisement,
  Advertiser,
  AdSelectionMode,
  AdvertisementWithAdvertiser,
  IssueModuleAd
} from '@/types/database'

interface AdSelectionResult {
  ad: AdvertisementWithAdvertiser | null
  reason: string
}

/**
 * Helper function to get the start of a week (Sunday)
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay() // 0 = Sunday
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d
}

export class ModuleAdSelector {
  /**
   * Get the global company cooldown days setting
   */
  static async getCooldownDays(publicationId: string): Promise<number> {
    try {
      const { data } = await supabaseAdmin
        .from('publication_settings')
        .select('value')
        .eq('publication_id', publicationId)
        .eq('key', 'ad_company_cooldown_days')
        .single()

      return data?.value ? parseInt(data.value) : 7
    } catch {
      return 7 // Default
    }
  }

  /**
   * Check if an advertiser is within cooldown period
   * Cooldown is based on last_used_date (set during send-final)
   */
  private static isAdvertiserInCooldown(
    advertiser: Advertiser,
    cooldownDays: number,
    issueDate: Date
  ): boolean {
    if (!advertiser.last_used_date) {
      return false
    }

    const lastUsed = new Date(advertiser.last_used_date)
    const daysSinceLastUsed = Math.floor(
      (issueDate.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24)
    )

    return daysSinceLastUsed < cooldownDays
  }

  /**
   * Check if an ad is within its valid date range
   * Uses preferred_start_date as start and checks status for completion
   */
  private static isAdInDateRange(ad: Advertisement, issueDate: Date): boolean {
    const issueDateStr = issueDate.toISOString().split('T')[0]

    // Check start date if set
    if (ad.preferred_start_date && ad.preferred_start_date > issueDateStr) {
      return false
    }

    return true
  }

  /**
   * Get all eligible ads for a module (respecting cooldown and date ranges)
   */
  private static async getEligibleAds(
    moduleId: string,
    publicationId: string,
    issueDate: Date,
    cooldownDays: number
  ): Promise<AdvertisementWithAdvertiser[]> {
    // Fetch all active ads for this module with their advertisers
    const { data: ads, error } = await supabaseAdmin
      .from('advertisements')
      .select(`
        *,
        advertiser:advertisers(*)
      `)
      .eq('ad_module_id', moduleId)
      .eq('publication_id', publicationId)
      .eq('status', 'active')
      .order('display_order', { ascending: true, nullsFirst: false })

    if (error || !ads) {
      console.error('[AdSelector] Error fetching ads:', error)
      return []
    }

    // Filter by eligibility
    const eligibleAds = ads.filter(ad => {
      // Check date range
      if (!this.isAdInDateRange(ad, issueDate)) {
        return false
      }

      // Check advertiser cooldown (if advertiser is linked)
      if (ad.advertiser && this.isAdvertiserInCooldown(ad.advertiser, cooldownDays, issueDate)) {
        return false
      }

      // Check advertiser is active (if linked)
      if (ad.advertiser && !ad.advertiser.is_active) {
        return false
      }

      // PAID ADS ONLY: Additional checks for sponsored ads with weekly limits
      // paid=true identifies sponsored ads that have weekly limits
      const isPaidWeeklyAd = ad.paid === true && ad.frequency === 'weekly' && ad.times_paid && ad.times_paid > 0

      if (isPaidWeeklyAd) {
        // Check if ad has remaining uses
        const remaining = ad.times_paid - (ad.times_used || 0)
        if (remaining <= 0) {
          return false
        }

        // Check if ad already ran this week (Sun-Sat)
        if (ad.last_used_date) {
          const lastUsed = new Date(ad.last_used_date)
          const issueWeekStart = getWeekStart(issueDate)
          const lastUsedWeekStart = getWeekStart(lastUsed)

          // If last used is in same week, skip this ad
          if (issueWeekStart.getTime() === lastUsedWeekStart.getTime()) {
            return false
          }

          // Cannot run on same day of week as last time
          const lastDayOfWeek = lastUsed.getDay() // 0=Sun, 6=Sat
          const issueDayOfWeek = issueDate.getDay()

          if (lastDayOfWeek === issueDayOfWeek) {
            return false
          }
        }
      }
      // Non-paid ads (paid=false) have no additional restrictions

      return true
    })

    return eligibleAds as AdvertisementWithAdvertiser[]
  }

  /**
   * Select ad using Sequential mode (fixed order rotation)
   * Follows the display_order set on the ads page, cycling through in order.
   * Uses the module's next_position field to track which display_order to pick next.
   * Loops back to position 1 after reaching the last ad.
   */
  private static selectSequential(
    ads: AdvertisementWithAdvertiser[],
    nextPosition: number
  ): AdvertisementWithAdvertiser | null {
    if (ads.length === 0) return null

    // Sort by display_order
    const sorted = [...ads].sort((a, b) => (a.display_order || 0) - (b.display_order || 0))

    // Find ad at the next_position
    let selectedAd = sorted.find(ad => ad.display_order === nextPosition)

    // If no ad at that position (gap or past end), find next available
    if (!selectedAd) {
      // Find first ad with display_order >= nextPosition
      selectedAd = sorted.find(ad => (ad.display_order || 0) >= nextPosition)

      // If still none found (past the end), loop back to first ad
      if (!selectedAd) {
        selectedAd = sorted[0]
      }
    }

    return selectedAd
  }

  /**
   * Select ad using Random mode (shuffle without repeat)
   * Randomly picks from ads that haven't been used in the current cycle.
   * A cycle completes when all eligible ads have been used once, then resets.
   * Only picks from ads with the minimum times_used (those not yet used this cycle).
   */
  private static selectRandom(ads: AdvertisementWithAdvertiser[]): AdvertisementWithAdvertiser | null {
    if (ads.length === 0) return null

    // Find the minimum times_used among eligible ads
    const minTimesUsed = Math.min(...ads.map(ad => ad.times_used))

    // Filter to only ads at minimum times_used (not yet used this cycle)
    const availableAds = ads.filter(ad => ad.times_used === minTimesUsed)

    // Random pick from available ads
    const randomIndex = Math.floor(Math.random() * availableAds.length)
    return availableAds[randomIndex]
  }

  /**
   * Select ad using Priority mode (priority tiers with rotation)
   * Higher priority ads are shown first. Within each priority tier,
   * ads rotate sequentially. Only moves to lower priority tier after
   * all higher priority ads have been used in the current cycle.
   *
   * Logic: Sort by times_used first (cycle tracking), then by priority DESC,
   * then by display_order. This ensures all priority 10 ads show before
   * any priority 5 ads in each cycle.
   */
  private static selectPriority(ads: AdvertisementWithAdvertiser[]): AdvertisementWithAdvertiser | null {
    if (ads.length === 0) return null

    // Sort by: times_used ASC (cycle), then priority DESC (high priority first), then display_order
    const sorted = [...ads].sort((a, b) => {
      // First: cycle position (least used first)
      if (a.times_used !== b.times_used) {
        return a.times_used - b.times_used
      }
      // Same cycle position: higher priority first
      if ((b.priority || 0) !== (a.priority || 0)) {
        return (b.priority || 0) - (a.priority || 0)
      }
      // Same priority: by display_order
      return (a.display_order || 0) - (b.display_order || 0)
    })
    return sorted[0]
  }

  /**
   * Select an ad for a module based on its selection mode
   */
  static async selectAd(
    module: AdModule,
    publicationId: string,
    issueDate: Date
  ): Promise<AdSelectionResult> {
    const selectionMode = module.selection_mode

    // Manual mode returns null - admin must pick
    if (selectionMode === 'manual') {
      return { ad: null, reason: 'Manual selection required' }
    }

    // Get cooldown setting
    const cooldownDays = await this.getCooldownDays(publicationId)

    // Get eligible ads
    const eligibleAds = await this.getEligibleAds(module.id, publicationId, issueDate, cooldownDays)

    if (eligibleAds.length === 0) {
      return { ad: null, reason: 'No eligible ads available (check cooldown, dates, status)' }
    }

    // Select based on mode
    let selectedAd: AdvertisementWithAdvertiser | null = null

    switch (selectionMode) {
      case 'sequential':
        // Use the module's next_position for sequential mode
        selectedAd = this.selectSequential(eligibleAds, module.next_position || 1)
        break
      case 'random':
        selectedAd = this.selectRandom(eligibleAds)
        break
      case 'priority':
        selectedAd = this.selectPriority(eligibleAds)
        break
      default:
        selectedAd = this.selectSequential(eligibleAds, module.next_position || 1)
    }

    if (!selectedAd) {
      return { ad: null, reason: 'Selection algorithm returned no ad' }
    }

    return {
      ad: selectedAd,
      reason: `Selected via ${selectionMode} mode from ${eligibleAds.length} eligible ads (position ${module.next_position || 1})`
    }
  }

  /**
   * Select ads for all active modules for an issue
   */
  static async selectAdsForIssue(
    issueId: string,
    publicationId: string,
    issueDate: Date
  ): Promise<{ moduleId: string; result: AdSelectionResult }[]> {
    // Check if selections already exist
    const { data: existing } = await supabaseAdmin
      .from('issue_module_ads')
      .select('ad_module_id')
      .eq('issue_id', issueId)

    if (existing && existing.length > 0) {
      console.log('[AdSelector] Ads already selected for issue:', issueId)
      return []
    }

    // Get all active ad modules
    const { data: modules, error } = await supabaseAdmin
      .from('ad_modules')
      .select('*')
      .eq('publication_id', publicationId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error || !modules || modules.length === 0) {
      console.log('[AdSelector] No active ad modules found')
      return []
    }

    const results: { moduleId: string; result: AdSelectionResult }[] = []

    // Select ad for each module
    for (const module of modules) {
      const result = await this.selectAd(
        module as AdModule,
        publicationId,
        issueDate
      )

      // Store selection in database (using advertisement_id)
      const { error: insertError } = await supabaseAdmin
        .from('issue_module_ads')
        .insert({
          issue_id: issueId,
          ad_module_id: module.id,
          advertisement_id: result.ad?.id || null,
          selection_mode: module.selection_mode
        })

      if (insertError) {
        console.error('[AdSelector] Error storing selection:', insertError)
      }

      results.push({ moduleId: module.id, result })
      console.log(`[AdSelector] Module "${module.name}": ${result.reason}`)
    }

    return results
  }

  /**
   * Record ad usage at send time (updates cooldown tracking and advances sequential position)
   * Uses the unified advertisements table
   */
  static async recordUsageSimple(
    issueId: string,
    issueDate: Date
  ): Promise<{ success: boolean; recorded: number }> {
    const { data: selections, error } = await supabaseAdmin
      .from('issue_module_ads')
      .select(`
        id,
        ad_module_id,
        advertisement_id,
        selection_mode,
        ad_module:ad_modules(id, selection_mode, next_position),
        advertisement:advertisements(
          id,
          title,
          advertiser_id,
          times_used,
          times_paid,
          paid,
          frequency,
          display_order,
          ad_module_id,
          advertiser:advertisers(id, times_used)
        )
      `)
      .eq('issue_id', issueId)
      .is('used_at', null)

    if (error || !selections) {
      console.error('[AdSelector] Error fetching selections:', error)
      return { success: false, recorded: 0 }
    }

    const issueDateStr = issueDate.toISOString().split('T')[0]
    let recorded = 0

    for (const selection of selections) {
      if (!selection.advertisement_id || !selection.advertisement) continue

      const ad = selection.advertisement as any
      const advertiser = ad.advertiser
      const adModule = selection.ad_module as any

      // Update ad in advertisements table
      const newTimesUsed = (ad.times_used || 0) + 1
      await supabaseAdmin
        .from('advertisements')
        .update({
          times_used: newTimesUsed,
          last_used_date: issueDateStr,
          updated_at: new Date().toISOString()
        })
        .eq('id', ad.id)

      // PAID ADS: Check if weekly ad is exhausted and mark as completed
      if (ad.paid === true && ad.frequency === 'weekly' && ad.times_paid && ad.times_paid > 0) {
        if (newTimesUsed >= ad.times_paid) {
          await supabaseAdmin
            .from('advertisements')
            .update({ status: 'completed' })
            .eq('id', ad.id)
          console.log(`[AdSelector] Paid ad "${ad.title}" exhausted (${newTimesUsed}/${ad.times_paid}), set to completed`)
        }
      }

      // Update advertiser (if linked)
      if (advertiser) {
        await supabaseAdmin
          .from('advertisers')
          .update({
            times_used: (advertiser.times_used || 0) + 1,
            last_used_date: issueDateStr,
            updated_at: new Date().toISOString()
          })
          .eq('id', advertiser.id)
      }

      // Mark selection as used
      await supabaseAdmin
        .from('issue_module_ads')
        .update({ used_at: new Date().toISOString() })
        .eq('id', selection.id)

      // Advance next_position for sequential modules
      if (adModule && adModule.selection_mode === 'sequential') {
        await this.advanceSequentialPosition(adModule.id, ad.display_order)
      }

      recorded++
    }

    console.log(`[AdSelector] Recorded usage for ${recorded} ad selections`)
    return { success: true, recorded }
  }

  /**
   * Advance the next_position for a sequential module after an ad is used
   */
  private static async advanceSequentialPosition(
    moduleId: string,
    usedDisplayOrder: number
  ): Promise<void> {
    // Get all active ads for this module to find max position
    const { data: ads } = await supabaseAdmin
      .from('advertisements')
      .select('display_order')
      .eq('ad_module_id', moduleId)
      .eq('status', 'active')
      .order('display_order', { ascending: true })

    if (!ads || ads.length === 0) return

    const maxPosition = Math.max(...ads.map(ad => ad.display_order || 0))
    let nextPosition = usedDisplayOrder + 1

    // Loop back to 1 if we've passed the max
    if (nextPosition > maxPosition) {
      nextPosition = 1
      console.log(`[AdSelector] Module ${moduleId}: Reached end of rotation, looping back to position 1`)
    } else {
      console.log(`[AdSelector] Module ${moduleId}: Advancing to position ${nextPosition}`)
    }

    // Update the module's next_position
    await supabaseAdmin
      .from('ad_modules')
      .update({
        next_position: nextPosition,
        updated_at: new Date().toISOString()
      })
      .eq('id', moduleId)
  }

  /**
   * Reset the next_position for a module to 1
   */
  static async resetPosition(moduleId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabaseAdmin
      .from('ad_modules')
      .update({
        next_position: 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', moduleId)

    if (error) {
      console.error('[AdSelector] Error resetting position:', error)
      return { success: false, error: error.message }
    }

    console.log(`[AdSelector] Reset position to 1 for module ${moduleId}`)
    return { success: true }
  }

  /**
   * Set a specific next_position for a module
   */
  static async setPosition(
    moduleId: string,
    position: number
  ): Promise<{ success: boolean; error?: string }> {
    if (position < 1) {
      return { success: false, error: 'Position must be at least 1' }
    }

    const { error } = await supabaseAdmin
      .from('ad_modules')
      .update({
        next_position: position,
        updated_at: new Date().toISOString()
      })
      .eq('id', moduleId)

    if (error) {
      console.error('[AdSelector] Error setting position:', error)
      return { success: false, error: error.message }
    }

    console.log(`[AdSelector] Set position to ${position} for module ${moduleId}`)
    return { success: true }
  }

  /**
   * Get selected ads for an issue (for display on issue page)
   */
  static async getIssueAdSelections(issueId: string): Promise<IssueModuleAd[]> {
    const { data, error } = await supabaseAdmin
      .from('issue_module_ads')
      .select(`
        *,
        ad_module:ad_modules(*),
        advertisement:advertisements(
          *,
          advertiser:advertisers(*)
        )
      `)
      .eq('issue_id', issueId)
      .order('ad_module(display_order)', { ascending: true })

    if (error) {
      console.error('[AdSelector] Error fetching issue selections:', error)
      return []
    }

    return data || []
  }

  /**
   * Manually select an ad for a module (for manual mode)
   */
  static async manuallySelectAd(
    issueId: string,
    moduleId: string,
    adId: string
  ): Promise<{ success: boolean; error?: string }> {
    // Verify the ad belongs to this module
    const { data: ad } = await supabaseAdmin
      .from('advertisements')
      .select('id, ad_module_id')
      .eq('id', adId)
      .single()

    if (!ad || ad.ad_module_id !== moduleId) {
      return { success: false, error: 'Ad does not belong to this module' }
    }

    // Upsert the selection
    const { error } = await supabaseAdmin
      .from('issue_module_ads')
      .upsert({
        issue_id: issueId,
        ad_module_id: moduleId,
        advertisement_id: adId,
        selection_mode: 'manual',
        selected_at: new Date().toISOString()
      }, {
        onConflict: 'issue_id,ad_module_id'
      })

    if (error) {
      console.error('[AdSelector] Error manual selection:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  }
}
