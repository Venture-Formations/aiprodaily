import { supabaseAdmin } from '../supabase'
import type {
  AdModule,
  Advertisement,
  Advertiser,
  AdvertisementWithAdvertiser,
  AdModuleAdvertiser,
  IssueModuleAd
} from '@/types/database'

interface AdSelectionResult {
  ad: AdvertisementWithAdvertiser | null
  reason: string
}

interface EligibleCompany {
  junction: AdModuleAdvertiser
  advertiser: Advertiser
  ads: AdvertisementWithAdvertiser[]  // Eligible ads for this company
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
  // No global cooldown — same-day dedup is handled in selectAdsForIssue
  // by passing excludedAdvertiserIds to getEligibleCompanies

  /**
   * Check if an ad is within its valid date range
   */
  private static isAdInDateRange(ad: Advertisement, issueDate: Date): boolean {
    const issueDateStr = issueDate.toISOString().split('T')[0]

    if (ad.preferred_start_date && ad.preferred_start_date > issueDateStr) {
      return false
    }

    return true
  }

  /**
   * Check if a single ad is eligible (date range, paid limits, etc.)
   */
  private static isAdEligible(ad: Advertisement, issueDate: Date): boolean {
    // Check date range
    if (!this.isAdInDateRange(ad, issueDate)) {
      return false
    }

    // PAID ADS ONLY: Additional checks for sponsored ads with weekly limits
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

        if (issueWeekStart.getTime() === lastUsedWeekStart.getTime()) {
          return false
        }

        const lastDayOfWeek = lastUsed.getDay()
        const issueDayOfWeek = issueDate.getDay()

        if (lastDayOfWeek === issueDayOfWeek) {
          return false
        }
      }
    }

    return true
  }

  /**
   * Get eligible companies for a module with their eligible ads.
   * A company is eligible if: its advertiser is active, not already used in this issue,
   * and has at least one eligible ad.
   */
  private static async getEligibleCompanies(
    moduleId: string,
    publicationId: string,
    issueDate: Date,
    excludedAdvertiserIds: Set<string> = new Set()
  ): Promise<EligibleCompany[]> {
    // Fetch junction entries for this module with advertiser details
    const { data: junctions, error: junctionError } = await supabaseAdmin
      .from('ad_module_advertisers')
      .select(`
        *,
        advertiser:advertisers(*)
      `)
      .eq('ad_module_id', moduleId)
      .order('display_order', { ascending: true })

    if (junctionError || !junctions) {
      console.error('[AdSelector] Error fetching company junctions:', junctionError)
      return []
    }

    // Fetch all active ads for this module
    const { data: allAds, error: adsError } = await supabaseAdmin
      .from('advertisements')
      .select(`
        *,
        advertiser:advertisers(*)
      `)
      .eq('ad_module_id', moduleId)
      .eq('publication_id', publicationId)
      .eq('status', 'active')
      .order('display_order', { ascending: true, nullsFirst: false })

    if (adsError || !allAds) {
      console.error('[AdSelector] Error fetching ads:', adsError)
      return []
    }

    const eligibleCompanies: EligibleCompany[] = []

    for (const junction of junctions) {
      const advertiser = junction.advertiser as Advertiser
      if (!advertiser) continue

      // Check advertiser is active
      if (!advertiser.is_active) continue

      // Check advertiser not already selected in another module for this issue
      if (excludedAdvertiserIds.has(junction.advertiser_id)) continue

      // Get this company's eligible ads in this module
      const companyAds = allAds
        .filter(ad => ad.advertiser_id === junction.advertiser_id)
        .filter(ad => this.isAdEligible(ad, issueDate)) as AdvertisementWithAdvertiser[]

      // Company is only eligible if it has at least one eligible ad
      if (companyAds.length === 0) continue

      eligibleCompanies.push({
        junction: junction as AdModuleAdvertiser,
        advertiser,
        ads: companyAds
      })
    }

    return eligibleCompanies
  }

  /**
   * Select company using Sequential mode (fixed order rotation)
   * Uses the module's next_position to track which company display_order to pick next.
   */
  private static selectCompanySequential(
    companies: EligibleCompany[],
    nextPosition: number
  ): EligibleCompany | null {
    if (companies.length === 0) return null

    // Sort by display_order
    const sorted = [...companies].sort((a, b) => a.junction.display_order - b.junction.display_order)

    // Find company at the next_position
    let selected = sorted.find(c => c.junction.display_order === nextPosition)

    // If no company at that position, find next available
    if (!selected) {
      selected = sorted.find(c => c.junction.display_order >= nextPosition)

      // If still none found (past the end), loop back to first
      if (!selected) {
        selected = sorted[0]
      }
    }

    return selected
  }

  /**
   * Select company using Random mode (shuffle without repeat)
   * Picks from companies with minimum times_used.
   */
  private static selectCompanyRandom(companies: EligibleCompany[]): EligibleCompany | null {
    if (companies.length === 0) return null

    const minTimesUsed = Math.min(...companies.map(c => c.junction.times_used))
    const available = companies.filter(c => c.junction.times_used === minTimesUsed)

    const randomIndex = Math.floor(Math.random() * available.length)
    return available[randomIndex]
  }

  /**
   * Select company using Priority mode (priority tiers with rotation)
   * Higher priority companies are shown first. Within each tier,
   * companies rotate by times_used.
   */
  private static selectCompanyPriority(companies: EligibleCompany[]): EligibleCompany | null {
    if (companies.length === 0) return null

    const sorted = [...companies].sort((a, b) => {
      // First: cycle position (least used first)
      if (a.junction.times_used !== b.junction.times_used) {
        return a.junction.times_used - b.junction.times_used
      }
      // Same cycle position: higher priority first
      if (b.junction.priority !== a.junction.priority) {
        return b.junction.priority - a.junction.priority
      }
      // Same priority: by display_order
      return a.junction.display_order - b.junction.display_order
    })
    return sorted[0]
  }

  /**
   * Select the next ad within a company (always sequential).
   * Uses the junction's next_ad_position to pick.
   */
  private static selectAdWithinCompany(
    company: EligibleCompany
  ): AdvertisementWithAdvertiser | null {
    const ads = company.ads
    if (ads.length === 0) return null

    // Sort by display_order
    const sorted = [...ads].sort((a, b) => (a.display_order || 0) - (b.display_order || 0))

    const nextPos = company.junction.next_ad_position || 1

    // Find ad at next_ad_position
    let selected = sorted.find(ad => ad.display_order === nextPos)

    // If not found, find next available
    if (!selected) {
      selected = sorted.find(ad => (ad.display_order || 0) >= nextPos)

      // If past end, loop back
      if (!selected) {
        selected = sorted[0]
      }
    }

    return selected
  }

  /**
   * Select an ad for a module using two-tier selection:
   * 1. Select a company (using module's selection mode)
   * 2. Select the next ad within that company (always sequential)
   */
  static async selectAd(
    module: AdModule,
    publicationId: string,
    issueDate: Date,
    excludedAdvertiserIds: Set<string> = new Set()
  ): Promise<AdSelectionResult> {
    const selectionMode = module.selection_mode

    // Manual mode returns null - admin must pick
    if (selectionMode === 'manual') {
      return { ad: null, reason: 'Manual selection required' }
    }

    // Get eligible companies (excluding ones already selected for this issue)
    const eligibleCompanies = await this.getEligibleCompanies(module.id, publicationId, issueDate, excludedAdvertiserIds)

    if (eligibleCompanies.length === 0) {
      return { ad: null, reason: 'No eligible companies available (all used in other modules or inactive)' }
    }

    // Tier 1: Select company based on module's selection mode
    let selectedCompany: EligibleCompany | null = null

    switch (selectionMode) {
      case 'sequential':
        selectedCompany = this.selectCompanySequential(eligibleCompanies, module.next_position || 1)
        break
      case 'random':
        selectedCompany = this.selectCompanyRandom(eligibleCompanies)
        break
      case 'priority':
        selectedCompany = this.selectCompanyPriority(eligibleCompanies)
        break
      default:
        selectedCompany = this.selectCompanySequential(eligibleCompanies, module.next_position || 1)
    }

    if (!selectedCompany) {
      return { ad: null, reason: 'Company selection algorithm returned no company' }
    }

    // Tier 2: Select ad within company (always sequential)
    const selectedAd = this.selectAdWithinCompany(selectedCompany)

    if (!selectedAd) {
      return { ad: null, reason: `Company "${selectedCompany.advertiser.company_name}" has no eligible ads` }
    }

    return {
      ad: selectedAd,
      reason: `Selected via ${selectionMode} mode: company "${selectedCompany.advertiser.company_name}" (pos ${selectedCompany.junction.display_order}), ad "${selectedAd.title}" (pos ${selectedAd.display_order}) from ${eligibleCompanies.length} eligible companies`
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
    const usedAdvertiserIds = new Set<string>()

    // Select ad for each module, excluding companies already picked for this issue
    for (const module of modules) {
      const result = await this.selectAd(
        module as AdModule,
        publicationId,
        issueDate,
        usedAdvertiserIds
      )

      // Track the selected advertiser so it won't be picked by another module
      if (result.ad?.advertiser_id) {
        usedAdvertiserIds.add(result.ad.advertiser_id)
      }

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
   * Record ad usage at send time (updates cooldown tracking and advances both company and ad positions)
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

      // Update junction table: increment times_used, advance next_ad_position
      if (ad.advertiser_id && ad.ad_module_id) {
        await this.advanceAdPositionWithinCompany(ad.ad_module_id, ad.advertiser_id, ad.display_order)
      }

      // Advance company position for sequential modules
      if (adModule && adModule.selection_mode === 'sequential' && ad.advertiser_id) {
        await this.advanceCompanyPosition(adModule.id, ad.advertiser_id)
      }

      recorded++
    }

    console.log(`[AdSelector] Recorded usage for ${recorded} ad selections`)
    return { success: true, recorded }
  }

  /**
   * Advance the next_ad_position within a company after an ad is used.
   * Also increments times_used on the junction.
   */
  private static async advanceAdPositionWithinCompany(
    moduleId: string,
    advertiserId: string,
    usedDisplayOrder: number
  ): Promise<void> {
    // Get all active ads for this company in this module
    const { data: ads } = await supabaseAdmin
      .from('advertisements')
      .select('display_order')
      .eq('ad_module_id', moduleId)
      .eq('advertiser_id', advertiserId)
      .eq('status', 'active')
      .order('display_order', { ascending: true })

    if (!ads || ads.length === 0) return

    const maxPosition = Math.max(...ads.map(ad => ad.display_order || 0))
    let nextAdPosition = usedDisplayOrder + 1

    if (nextAdPosition > maxPosition) {
      nextAdPosition = 1
    }

    // Get current junction row
    const { data: junction } = await supabaseAdmin
      .from('ad_module_advertisers')
      .select('times_used')
      .eq('ad_module_id', moduleId)
      .eq('advertiser_id', advertiserId)
      .single()

    // Update junction: advance ad position and increment times_used
    await supabaseAdmin
      .from('ad_module_advertisers')
      .update({
        next_ad_position: nextAdPosition,
        times_used: (junction?.times_used || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('ad_module_id', moduleId)
      .eq('advertiser_id', advertiserId)

    console.log(`[AdSelector] Company in module ${moduleId}: ad position -> ${nextAdPosition}, times_used -> ${(junction?.times_used || 0) + 1}`)
  }

  /**
   * Advance the company position for a sequential module after a company's ad is used.
   * Queries ad_module_advertisers for the next company in display_order.
   */
  private static async advanceCompanyPosition(
    moduleId: string,
    usedAdvertiserId: string
  ): Promise<void> {
    // Get all junction entries for this module to find positions
    const { data: junctions } = await supabaseAdmin
      .from('ad_module_advertisers')
      .select('advertiser_id, display_order')
      .eq('ad_module_id', moduleId)
      .order('display_order', { ascending: true })

    if (!junctions || junctions.length === 0) return

    // Find the used company's position
    const usedJunction = junctions.find(j => j.advertiser_id === usedAdvertiserId)
    if (!usedJunction) return

    const usedPosition = usedJunction.display_order
    const maxPosition = Math.max(...junctions.map(j => j.display_order))

    let nextPosition = usedPosition + 1

    if (nextPosition > maxPosition) {
      nextPosition = 1
      console.log(`[AdSelector] Module ${moduleId}: Reached end of company rotation, looping back to position 1`)
    } else {
      console.log(`[AdSelector] Module ${moduleId}: Advancing to company position ${nextPosition}`)
    }

    // Update the module's next_position (now tracks company position)
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
