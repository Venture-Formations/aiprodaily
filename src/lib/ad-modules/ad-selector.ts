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
  scheduledOverride?: boolean
}

interface EligibleCompany {
  junction: AdModuleAdvertiser
  advertiser: Advertiser
  ads: AdvertisementWithAdvertiser[]  // Eligible ads for this company
}

/**
 * Helper: extract local date string from a Date without UTC shift
 */
function toLocalDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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
    const issueDateStr = toLocalDateStr(issueDate)

    if (ad.preferred_start_date && ad.preferred_start_date > issueDateStr) {
      return false
    }

    return true
  }

  /**
   * Check if a single ad is eligible (date range only — paid/frequency checks moved to company level)
   */
  private static isAdEligible(ad: Advertisement, issueDate: Date): boolean {
    return this.isAdInDateRange(ad, issueDate)
  }

  /**
   * Check if a company is eligible for the current billing period based on junction-level frequency.
   * - 'weekly': company hasn't appeared in current Sun-Sat week AND has remaining paid weeks
   * - 'monthly': company hasn't appeared in current calendar month AND has remaining paid months
   * - 'single': always eligible (no period tracking)
   */
  private static isCompanyEligibleThisPeriod(
    junction: AdModuleAdvertiser,
    issueDate: Date
  ): boolean {
    const frequency = junction.frequency || 'single'

    if (frequency === 'single') return true

    // Check remaining paid periods
    if (junction.times_paid > 0 && junction.times_used >= junction.times_paid) {
      return false
    }

    // Check if company already appeared in current period
    if (junction.last_used_date) {
      // Parse date string as local date (avoid UTC shift from new Date(string))
      const dateParts = String(junction.last_used_date).split('T')[0].split('-')
      const lastUsed = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]))

      if (frequency === 'weekly') {
        const issueWeekStart = getWeekStart(issueDate)
        const lastUsedWeekStart = getWeekStart(lastUsed)
        if (issueWeekStart.getTime() === lastUsedWeekStart.getTime()) {
          return false
        }
      } else if (frequency === 'monthly') {
        const issueMonth = issueDate.getFullYear() * 12 + issueDate.getMonth()
        const lastUsedMonth = lastUsed.getFullYear() * 12 + lastUsed.getMonth()
        if (issueMonth === lastUsedMonth) {
          return false
        }
      }
    }

    return true
  }

  /**
   * Get the set of weekday numbers (0=Sun..6=Sat) this advertiser was used on
   * in the given module within the last `lookbackWeeks` weeks.
   * Used for day-of-week diversification so scheduled advertisers don't repeat
   * the same weekday across consecutive weeks.
   */
  private static async getRecentUsedWeekdays(
    moduleId: string,
    advertiserId: string,
    publicationId: string,
    issueDate: Date,
    lookbackWeeks: number
  ): Promise<Set<number> | null> {
    const cutoff = new Date(issueDate)
    cutoff.setDate(cutoff.getDate() - lookbackWeeks * 7)
    const cutoffStr = toLocalDateStr(cutoff)

    // Query sent selections for this module+advertiser within lookback window
    const { data, error } = await supabaseAdmin
      .from('issue_module_ads')
      .select(`
        used_at,
        advertisement:advertisements!inner(advertiser_id, publication_id)
      `)
      .eq('ad_module_id', moduleId)
      .not('used_at', 'is', null)
      .gte('used_at', cutoffStr)

    if (error || !data) {
      console.error(`[AdSelector] Error fetching recent weekday history for module ${moduleId}, advertiser ${advertiserId}:`, error)
      return null
    }

    const days = new Set<number>()
    for (const row of data) {
      const ad = row.advertisement as any
      if (ad?.advertiser_id !== advertiserId) continue
      if (ad?.publication_id !== publicationId) continue
      if (!row.used_at) continue
      const parts = String(row.used_at).split('T')[0].split('-')
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      days.add(d.getDay())
    }

    return days
  }

  /**
   * Get eligible companies for a mod with their eligible ads.
   * A company is eligible if: its advertiser is active, not already used in this issue,
   * and has at least one eligible ad.
   */
  private static async getEligibleCompanies(
    moduleId: string,
    publicationId: string,
    issueDate: Date,
    excludedAdvertiserIds: Set<string> = new Set()
  ): Promise<EligibleCompany[]> {
    // Fetch junction entries for this mod with advertiser details
    const { data: junctions, error: junctionError } = await supabaseAdmin
      .from('ad_module_advertisers')
      .select(`
        id,
        ad_module_id,
        advertiser_id,
        display_order,
        next_ad_position,
        times_used,
        times_paid,
        paid,
        frequency,
        priority,
        last_used_date,
        created_at,
        updated_at,
        advertiser:advertisers(id, publication_id, company_name, is_active, times_used, last_used_date, created_at, updated_at)
      `)
      .eq('ad_module_id', moduleId)
      .order('display_order', { ascending: true })

    if (junctionError || !junctions) {
      console.error('[AdSelector] Error fetching company junctions:', junctionError)
      return []
    }

    // Fetch all active ads for this mod
    const { data: allAds, error: adsError } = await supabaseAdmin
      .from('advertisements')
      .select(`
        id,
        title,
        body,
        word_count,
        button_text,
        button_url,
        image_url,
        image_alt,
        frequency,
        times_paid,
        times_used,
        status,
        display_order,
        paid,
        preferred_start_date,
        actual_start_date,
        last_used_date,
        payment_intent_id,
        payment_amount,
        payment_status,
        submission_date,
        approved_by,
        approved_at,
        rejection_reason,
        created_at,
        updated_at,
        clerk_user_id,
        company_name,
        ad_type,
        preview_image_url,
        ad_module_id,
        advertiser_id,
        priority,
        cta_text,
        advertiser:advertisers(id, publication_id, company_name, is_active, times_used, last_used_date, created_at, updated_at)
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
      const advertiser = (Array.isArray(junction.advertiser) ? junction.advertiser[0] : junction.advertiser) as unknown as Advertiser
      if (!advertiser) continue

      // Check advertiser is active
      if (!advertiser.is_active) continue

      // Check advertiser not already selected in another mod for this issue
      if (excludedAdvertiserIds.has(junction.advertiser_id)) continue

      // Check company-level frequency eligibility (weekly/monthly period guard)
      if (!this.isCompanyEligibleThisPeriod(junction as AdModuleAdvertiser, issueDate)) continue

      // Get this company's eligible ads in this mod
      const companyAds = allAds
        .filter(ad => ad.advertiser_id === junction.advertiser_id)
        .filter(ad => this.isAdEligible(ad as unknown as Advertisement, issueDate)) as unknown as AdvertisementWithAdvertiser[]

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
   * Uses the mod's next_position to track which company display_order to pick next.
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
      if ((b.junction.priority ?? 0) !== (a.junction.priority ?? 0)) {
        return (b.junction.priority ?? 0) - (a.junction.priority ?? 0)
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
   * Select an ad for a mod using two-tier selection:
   * 1. Select a company (using mod's selection mode)
   * 2. Select the next ad within that company (always sequential)
   */
  static async selectAd(
    mod: AdModule,
    publicationId: string,
    issueDate: Date,
    excludedAdvertiserIds: Set<string> = new Set()
  ): Promise<AdSelectionResult> {
    const selectionMode = mod.selection_mode

    // Manual mode returns null - admin must pick
    if (selectionMode === 'manual') {
      return { ad: null, reason: 'Manual selection required' }
    }

    // Get eligible companies (excluding ones already selected for this issue)
    const eligibleCompanies = await this.getEligibleCompanies(mod.id, publicationId, issueDate, excludedAdvertiserIds)

    if (eligibleCompanies.length === 0) {
      return { ad: null, reason: 'No eligible companies available (all used in other modules or inactive)' }
    }

    // Paid-first tier: prioritize paid sponsors before falling back to all eligible
    const paidCompanies = eligibleCompanies.filter(c => c.junction.paid === true)
    const candidatePool = paidCompanies.length > 0 ? paidCompanies : eligibleCompanies
    const poolLabel = paidCompanies.length > 0 ? 'paid-first' : 'all-eligible'

    // Scheduled-frequency override: weekly/monthly advertisers that are due this period
    // get priority over the normal rotation so they don't get skipped by sequential cycling.
    // These companies already passed the eligibility check in getEligibleCompanies(),
    // so being in the pool means they haven't run yet this period and have remaining paid slots.
    // Constraints: weekdays only, and day-of-week diversification (no repeating a weekday
    // used in the prior 2 weeks).
    const issueDayOfWeek = issueDate.getDay()
    const isWeekday = issueDayOfWeek >= 1 && issueDayOfWeek <= 5
    const scheduledCandidates = isWeekday
      ? candidatePool.filter(c => c.junction.frequency === 'weekly' || c.junction.frequency === 'monthly')
      : []

    // Filter out candidates whose recent history blocks today's day of the week
    const scheduledDue: EligibleCompany[] = []
    const blockedNames: string[] = []
    for (const company of scheduledCandidates) {
      const recentDays = await this.getRecentUsedWeekdays(
        mod.id, company.junction.advertiser_id, publicationId, issueDate, 2
      )
      // If history lookup failed (null), skip this company's override to avoid
      // accidentally double-running — they'll go through normal rotation instead.
      if (recentDays === null) continue
      if (!recentDays.has(issueDayOfWeek)) {
        scheduledDue.push(company)
      } else {
        blockedNames.push(company.advertiser.company_name)
      }
    }
    if (blockedNames.length > 0) {
      console.log(`[AdSelector] Scheduled companies blocked on day ${issueDayOfWeek} (weekday used in prior 2 weeks): ${blockedNames.join(', ')}`)
    }

    let selectedCompany: EligibleCompany | null = null

    if (scheduledDue.length > 0) {
      // Among multiple due scheduled companies, pick the one with fewest times_used (fairness)
      const sorted = [...scheduledDue].sort((a, b) => {
        if (a.junction.times_used !== b.junction.times_used) {
          return a.junction.times_used - b.junction.times_used
        }
        return a.junction.display_order - b.junction.display_order
      })
      selectedCompany = sorted[0]
      console.log(`[AdSelector] Scheduled-frequency override: "${sorted[0].advertiser.company_name}" (${sorted[0].junction.frequency}, due this period)`)
    } else {
      // Tier 1: Select company based on mod's selection mode
      switch (selectionMode) {
        case 'sequential':
          selectedCompany = this.selectCompanySequential(candidatePool, mod.next_position || 1)
          break
        case 'random':
          selectedCompany = this.selectCompanyRandom(candidatePool)
          break
        case 'priority':
          selectedCompany = this.selectCompanyPriority(candidatePool)
          break
        default:
          selectedCompany = this.selectCompanySequential(candidatePool, mod.next_position || 1)
      }
    }

    if (!selectedCompany) {
      return { ad: null, reason: 'Company selection algorithm returned no company' }
    }

    // Tier 2: Select ad within company (always sequential)
    const selectedAd = this.selectAdWithinCompany(selectedCompany)

    if (!selectedAd) {
      return { ad: null, reason: `Company "${selectedCompany.advertiser.company_name}" has no eligible ads` }
    }

    const isScheduledOverride = scheduledDue.some(c => c.junction.id === selectedCompany!.junction.id)
    const modeLabel = isScheduledOverride
      ? `scheduled-${selectedCompany.junction.frequency}/${poolLabel}`
      : `${selectionMode}/${poolLabel}`

    return {
      ad: selectedAd,
      reason: `Selected via ${modeLabel} mode: company "${selectedCompany.advertiser.company_name}" (pos ${selectedCompany.junction.display_order}), ad "${selectedAd.title}" (pos ${selectedAd.display_order}) from ${candidatePool.length}/${eligibleCompanies.length} companies`,
      scheduledOverride: isScheduledOverride
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
      .select('id, name, publication_id, selection_mode, next_position, display_order, is_active')
      .eq('publication_id', publicationId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error || !modules || modules.length === 0) {
      console.log('[AdSelector] No active ad modules found')
      return []
    }

    const results: { moduleId: string; result: AdSelectionResult }[] = []
    const usedAdvertiserIds = new Set<string>()

    // Select ad for each mod, excluding companies already picked for this issue
    for (const mod of modules) {
      const result = await this.selectAd(
        mod as AdModule,
        publicationId,
        issueDate,
        usedAdvertiserIds
      )

      // Track the selected advertiser so it won't be picked by another mod
      if (result.ad?.advertiser_id) {
        usedAdvertiserIds.add(result.ad.advertiser_id)
      }

      // Store selection in database (using advertisement_id) — idempotent upsert
      // Mark scheduled overrides so recordUsageSimple knows not to advance next_position
      const storedMode = result.scheduledOverride
        ? `scheduled-${mod.selection_mode}`
        : mod.selection_mode
      const { error: insertError } = await supabaseAdmin
        .from('issue_module_ads')
        .upsert({
          issue_id: issueId,
          ad_module_id: mod.id,
          advertisement_id: result.ad?.id || null,
          selection_mode: storedMode
        }, {
          onConflict: 'issue_id,ad_module_id',
          ignoreDuplicates: true
        })

      if (insertError) {
        console.error('[AdSelector] Error storing selection:', insertError)
      }

      results.push({ moduleId: mod.id, result })
      console.log(`[AdSelector] Module "${mod.name}": ${result.reason}`)
    }

    return results
  }

  /**
   * Record ad usage at send time (updates cooldown tracking and advances both company and ad positions)
   */
  static async recordUsageSimple(
    issueId: string,
    issueDate: Date,
    publicationId?: string
  ): Promise<{ success: boolean; recorded: number }> {
    // Verify issue belongs to publication if publicationId provided
    if (publicationId) {
      const { data: issue, error: issueError } = await supabaseAdmin
        .from('publication_issues')
        .select('id')
        .eq('id', issueId)
        .eq('publication_id', publicationId)
        .single()

      if (issueError || !issue) {
        console.error('[AdSelector] Issue does not belong to publication or not found:', issueError)
        return { success: false, recorded: 0 }
      }
    }

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

    const issueDateStr = toLocalDateStr(issueDate)
    let recorded = 0

    for (const selection of selections) {
      try {
        if (!selection.advertisement_id || !selection.advertisement) continue

        const ad = selection.advertisement as any
        const advertiser = ad.advertiser
        const adModule = selection.ad_module as any

        // Update ad in advertisements table
        const newTimesUsed = (ad.times_used || 0) + 1
        const { error: adUpdateError } = await supabaseAdmin
          .from('advertisements')
          .update({
            times_used: newTimesUsed,
            last_used_date: issueDateStr,
            updated_at: new Date().toISOString()
          })
          .eq('id', ad.id)

        if (adUpdateError) {
          console.error(`[AdSelector] Error updating ad ${ad.id}:`, adUpdateError)
          continue
        }

        // Update advertiser (if linked)
        if (advertiser) {
          const { error: advUpdateError } = await supabaseAdmin
            .from('advertisers')
            .update({
              times_used: (advertiser.times_used || 0) + 1,
              last_used_date: issueDateStr,
              updated_at: new Date().toISOString()
            })
            .eq('id', advertiser.id)

          if (advUpdateError) {
            console.error(`[AdSelector] Error updating advertiser ${advertiser.id}:`, advUpdateError)
          }
        }

        // Mark selection as used
        const { error: markError } = await supabaseAdmin
          .from('issue_module_ads')
          .update({ used_at: new Date().toISOString() })
          .eq('id', selection.id)

        if (markError) {
          console.error(`[AdSelector] Error marking selection ${selection.id} as used:`, markError)
          continue
        }

        // Update junction table: increment times_used, advance next_ad_position, update last_used_date
        if (ad.advertiser_id && ad.ad_module_id) {
          await this.advanceAdPositionWithinCompany(ad.ad_module_id, ad.advertiser_id, ad.display_order, issueDateStr)
        }

        // Advance company position for sequential modules — but NOT for scheduled overrides,
        // because the override jumped ahead of the normal rotation and the company at
        // next_position should still get its turn on the next non-scheduled day.
        const wasScheduledOverride = selection.selection_mode?.startsWith('scheduled-')
        if (adModule && adModule.selection_mode === 'sequential' && ad.advertiser_id && !wasScheduledOverride) {
          await this.advanceCompanyPosition(adModule.id, ad.advertiser_id)
        }

        recorded++
      } catch (err) {
        console.error(`[AdSelector] Unexpected error processing selection ${selection.id}:`, err)
        continue
      }
    }

    console.log(`[AdSelector] Recorded usage for ${recorded} ad selections`)
    return { success: true, recorded }
  }

  /**
   * Advance the next_ad_position within a company after an ad is used.
   * Also increments times_used and updates last_used_date on the junction.
   * If a paid company is now exhausted, marks all its ads as completed.
   */
  private static async advanceAdPositionWithinCompany(
    moduleId: string,
    advertiserId: string,
    usedDisplayOrder: number,
    issueDateStr: string
  ): Promise<void> {
    // Get all active ads for this company in this mod
    const { data: ads, error: adsError } = await supabaseAdmin
      .from('advertisements')
      .select('display_order')
      .eq('ad_module_id', moduleId)
      .eq('advertiser_id', advertiserId)
      .eq('status', 'active')
      .order('display_order', { ascending: true })

    if (adsError) {
      console.error(`[AdSelector] Error fetching ads for position advance in mod ${moduleId}:`, adsError)
      return
    }

    if (!ads || ads.length === 0) return

    const maxPosition = Math.max(...ads.map(ad => ad.display_order || 0))
    let nextAdPosition = usedDisplayOrder + 1

    if (nextAdPosition > maxPosition) {
      nextAdPosition = 1
    }

    // Get current junction row
    const { data: junction, error: junctionError } = await supabaseAdmin
      .from('ad_module_advertisers')
      .select('times_used, times_paid, paid, frequency')
      .eq('ad_module_id', moduleId)
      .eq('advertiser_id', advertiserId)
      .single()

    if (junctionError) {
      console.error(`[AdSelector] Error fetching junction for mod ${moduleId}, advertiser ${advertiserId}:`, junctionError)
      return
    }

    const newTimesUsed = (junction?.times_used || 0) + 1

    // Update junction: advance ad position, increment times_used, update last_used_date
    const { error: updateError } = await supabaseAdmin
      .from('ad_module_advertisers')
      .update({
        next_ad_position: nextAdPosition,
        times_used: newTimesUsed,
        last_used_date: issueDateStr,
        updated_at: new Date().toISOString()
      })
      .eq('ad_module_id', moduleId)
      .eq('advertiser_id', advertiserId)

    if (updateError) {
      console.error(`[AdSelector] Error updating junction for mod ${moduleId}, advertiser ${advertiserId}:`, updateError)
      return
    }

    console.log(`[AdSelector] Company in mod ${moduleId}: ad position -> ${nextAdPosition}, times_used -> ${newTimesUsed}, last_used_date -> ${issueDateStr}`)

    // PAID COMPANIES: Check if junction is exhausted and mark all company ads as completed
    if (junction?.paid === true && junction?.times_paid > 0 && newTimesUsed >= junction.times_paid) {
      const { error: completedError } = await supabaseAdmin
        .from('advertisements')
        .update({ status: 'completed' })
        .eq('ad_module_id', moduleId)
        .eq('advertiser_id', advertiserId)
        .eq('status', 'active')

      if (completedError) {
        console.error(`[AdSelector] Error marking ads as completed for mod ${moduleId}, advertiser ${advertiserId}:`, completedError)
        return
      }

      console.log(`[AdSelector] Paid company in mod ${moduleId} exhausted (${newTimesUsed}/${junction.times_paid}), all ads set to completed`)
    }
  }

  /**
   * Advance the company position for a sequential mod after a company's ad is used.
   * Queries ad_module_advertisers for the next company in display_order.
   */
  private static async advanceCompanyPosition(
    moduleId: string,
    usedAdvertiserId: string
  ): Promise<void> {
    // Get all junction entries for this mod to find positions
    const { data: junctions, error: junctionsError } = await supabaseAdmin
      .from('ad_module_advertisers')
      .select('advertiser_id, display_order')
      .eq('ad_module_id', moduleId)
      .order('display_order', { ascending: true })

    if (junctionsError) {
      console.error(`[AdSelector] Error fetching junctions for company position advance in mod ${moduleId}:`, junctionsError)
      return
    }

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

    // Update the mod's next_position (now tracks company position)
    const { error: updateError } = await supabaseAdmin
      .from('ad_modules')
      .update({
        next_position: nextPosition,
        updated_at: new Date().toISOString()
      })
      .eq('id', moduleId)

    if (updateError) {
      console.error(`[AdSelector] Error advancing company position for mod ${moduleId}:`, updateError)
    }
  }

  /**
   * Reset the next_position for a mod to 1
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

    console.log(`[AdSelector] Reset position to 1 for mod ${moduleId}`)
    return { success: true }
  }

  /**
   * Set a specific next_position for a mod
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

    console.log(`[AdSelector] Set position to ${position} for mod ${moduleId}`)
    return { success: true }
  }

  /**
   * Get selected ads for an issue (for display on issue page)
   */
  static async getIssueAdSelections(issueId: string, publicationId?: string): Promise<IssueModuleAd[]> {
    let query = supabaseAdmin
      .from('issue_module_ads')
      .select(`
        id,
        issue_id,
        ad_module_id,
        advertisement_id,
        selection_mode,
        selected_at,
        used_at,
        ad_module:ad_modules(id, name, publication_id, selection_mode, block_order, config, next_position, display_order, is_active, created_at, updated_at),
        advertisement:advertisements(
          id,
          title,
          body,
          word_count,
          button_text,
          button_url,
          image_url,
          image_alt,
          frequency,
          times_paid,
          times_used,
          status,
          display_order,
          paid,
          preferred_start_date,
          actual_start_date,
          last_used_date,
          payment_intent_id,
          payment_amount,
          payment_status,
          submission_date,
          approved_by,
          approved_at,
          rejection_reason,
          created_at,
          updated_at,
          clerk_user_id,
          company_name,
          ad_type,
          preview_image_url,
          ad_module_id,
          advertiser_id,
          priority,
          cta_text,
          advertiser:advertisers(id, publication_id, company_name, is_active, times_used, last_used_date, created_at, updated_at)
        )
      `)
      .eq('issue_id', issueId)

    // Filter through ad_module join if publicationId provided
    if (publicationId) {
      query = query.eq('ad_module.publication_id', publicationId)
    }

    const { data, error } = await query
      .order('ad_module(display_order)', { ascending: true })

    if (error) {
      console.error('[AdSelector] Error fetching issue selections:', error)
      return []
    }

    return data || []
  }

  /**
   * Manually select an ad for a mod (for manual mode)
   */
  static async manuallySelectAd(
    issueId: string,
    moduleId: string,
    adId: string,
    publicationId?: string
  ): Promise<{ success: boolean; error?: string }> {
    // Verify the ad belongs to this mod (and publication if provided)
    let adQuery = supabaseAdmin
      .from('advertisements')
      .select('id, ad_module_id')
      .eq('id', adId)

    if (publicationId) {
      adQuery = adQuery.eq('publication_id', publicationId)
    }

    const { data: ad } = await adQuery.single()

    if (!ad || ad.ad_module_id !== moduleId) {
      return { success: false, error: 'Ad does not belong to this mod' }
    }

    // Verify issue belongs to publication if publicationId provided
    if (publicationId) {
      const { data: issue, error: issueError } = await supabaseAdmin
        .from('publication_issues')
        .select('id')
        .eq('id', issueId)
        .eq('publication_id', publicationId)
        .single()

      if (issueError || !issue) {
        return { success: false, error: 'Issue does not belong to this publication' }
      }
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
