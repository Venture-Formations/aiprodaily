import { supabaseAdmin } from './supabase'
import type { AIApplication } from '@/types/database'

export class AppSelector {
  /**
   * Get app selection settings from publication_settings table
   */
  private static async getAppSettings(newsletterId: string): Promise<{
    totalApps: number
    maxPerCategory: number
    affiliateCooldownDays: number
  }> {
    try {
      const { data: settings } = await supabaseAdmin
        .from('publication_settings')
        .select('key, value')
        .eq('publication_id', newsletterId)
        .in('key', ['ai_apps_per_newsletter', 'ai_apps_max_per_category', 'affiliate_cooldown_days'])

      const settingsMap = new Map(settings?.map(s => [s.key, parseInt(s.value || '0')]) || [])

      return {
        totalApps: settingsMap.get('ai_apps_per_newsletter') || 6,
        maxPerCategory: settingsMap.get('ai_apps_max_per_category') || 3,
        affiliateCooldownDays: settingsMap.get('affiliate_cooldown_days') || 7
      }
    } catch (error) {
      console.error('Error fetching app settings:', error)
      // Return defaults
      return {
        totalApps: 6,
        maxPerCategory: 3,
        affiliateCooldownDays: 7
      }
    }
  }

  /**
   * Check if an affiliate app is within cooldown period
   * Cooldown is based on last_used_date which is set during send-final
   */
  static isInCooldown(app: AIApplication, cooldownDays: number): boolean {
    if (!app.is_affiliate || !app.last_used_date) {
      return false
    }

    const lastUsed = new Date(app.last_used_date)
    const now = new Date()
    const daysSinceLastUsed = Math.floor((now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24))

    return daysSinceLastUsed < cooldownDays
  }

  /**
   * Count how many apps from each category are already selected
   */
  static getCategoryCounts(selectedApps: AIApplication[]): Map<string, number> {
    const counts = new Map<string, number>()
    for (const app of selectedApps) {
      const category = app.category || 'Unknown'
      const current = counts.get(category) || 0
      counts.set(category, current + 1)
    }
    return counts
  }

  /**
   * Check if adding an app would exceed the category maximum
   */
  static wouldExceedCategoryMax(
    app: AIApplication,
    selectedApps: AIApplication[],
    maxPerCategory: number
  ): boolean {
    const categoryCounts = this.getCategoryCounts(selectedApps)
    const category = app.category || 'Unknown'
    const currentCount = categoryCounts.get(category) || 0
    return currentCount >= maxPerCategory
  }

  /**
   * Select apps for a issue based on new logic:
   * 1. Affiliates first (random, respecting cooldown and category max)
   * 2. Non-affiliates to fill remaining (global rotation, respecting category max)
   */
  static async selectAppsForissue(issueId: string, newsletterId: string): Promise<AIApplication[]> {
    try {
      // Check if apps already selected for this issue
      const { data: existingSelections } = await supabaseAdmin
        .from('issue_ai_app_selections')
        .select('*, app:ai_applications(*)')
        .eq('issue_id', issueId)

      if (existingSelections && existingSelections.length > 0) {
        console.log('Apps already selected for issue:', issueId)
        return existingSelections.map(s => s.app).filter(Boolean)
      }

      // Get selection settings
      const { totalApps, maxPerCategory, affiliateCooldownDays } = await this.getAppSettings(newsletterId)
      console.log(`[AppSelector] Settings: totalApps=${totalApps}, maxPerCategory=${maxPerCategory}, cooldown=${affiliateCooldownDays} days`)

      // Get all active apps for this newsletter
      const { data: allApps, error: appsError } = await supabaseAdmin
        .from('ai_applications')
        .select('*')
        .eq('publication_id', newsletterId)
        .eq('is_active', true)

      if (appsError) {
        console.error('Error fetching apps:', appsError)
        throw new Error(`Failed to fetch apps: ${appsError.message}`)
      }

      if (!allApps || allApps.length === 0) {
        console.warn(`No active apps available for newsletter: ${newsletterId}`)
        return []
      }

      console.log(`[AppSelector] Found ${allApps.length} active apps for newsletter ${newsletterId}`)

      // Separate affiliate and non-affiliate apps
      const affiliateApps = allApps.filter(app => app.is_affiliate)
      const nonAffiliateApps = allApps.filter(app => !app.is_affiliate)

      console.log(`[AppSelector] ${affiliateApps.length} affiliate apps, ${nonAffiliateApps.length} non-affiliate apps`)

      // Track used non-affiliate app IDs for global rotation
      // Get all non-affiliate app IDs that have been used
      const { data: usedNonAffiliateSelections } = await supabaseAdmin
        .from('issue_ai_app_selections')
        .select('app_id')
        .order('created_at', { ascending: false })

      // Build set of used non-affiliate app IDs
      const usedNonAffiliateAppIds = new Set<string>()
      usedNonAffiliateSelections?.forEach(selection => {
        const app = nonAffiliateApps.find(a => a.id === selection.app_id)
        if (app) {
          usedNonAffiliateAppIds.add(selection.app_id)
        }
      })

      // Check if all non-affiliates have been used - if so, reset the cycle
      const allNonAffiliatesUsed = nonAffiliateApps.every(app => usedNonAffiliateAppIds.has(app.id))
      if (allNonAffiliatesUsed && nonAffiliateApps.length > 0) {
        console.log('[AppSelector] All non-affiliate apps used, resetting rotation cycle')
        usedNonAffiliateAppIds.clear()
      }

      console.log(`[AppSelector] ${usedNonAffiliateAppIds.size} non-affiliate apps in rotation history`)

      const selectedApps: AIApplication[] = []
      const selectedAppIds = new Set<string>()

      // PHASE 1: Select affiliate apps first (random, respecting cooldown and category max)
      const availableAffiliates = affiliateApps.filter(app => !this.isInCooldown(app, affiliateCooldownDays))
      console.log(`[AppSelector] ${availableAffiliates.length} affiliates available (not in cooldown)`)

      // Shuffle available affiliates for random selection
      const shuffledAffiliates = [...availableAffiliates].sort(() => Math.random() - 0.5)

      for (const app of shuffledAffiliates) {
        if (selectedApps.length >= totalApps) break

        // Check category maximum
        if (this.wouldExceedCategoryMax(app, selectedApps, maxPerCategory)) {
          console.log(`[AppSelector] Skipping affiliate ${app.app_name} - would exceed ${maxPerCategory} max for ${app.category}`)
          continue
        }

        selectedApps.push(app)
        selectedAppIds.add(app.id)
        console.log(`[AppSelector] Selected affiliate: ${app.app_name} (${app.category})`)
      }

      console.log(`[AppSelector] Selected ${selectedApps.length} affiliates, need ${totalApps - selectedApps.length} more`)

      // PHASE 2: Fill remaining slots with non-affiliate apps (global rotation, respecting category max)
      if (selectedApps.length < totalApps) {
        // Get unused non-affiliates first
        const unusedNonAffiliates = nonAffiliateApps.filter(app =>
          !usedNonAffiliateAppIds.has(app.id) && !selectedAppIds.has(app.id)
        )

        // Shuffle for random selection
        const shuffledUnused = [...unusedNonAffiliates].sort(() => Math.random() - 0.5)

        for (const app of shuffledUnused) {
          if (selectedApps.length >= totalApps) break

          // Check category maximum
          if (this.wouldExceedCategoryMax(app, selectedApps, maxPerCategory)) {
            console.log(`[AppSelector] Skipping non-affiliate ${app.app_name} - would exceed ${maxPerCategory} max for ${app.category}`)
            continue
          }

          selectedApps.push(app)
          selectedAppIds.add(app.id)
          console.log(`[AppSelector] Selected non-affiliate: ${app.app_name} (${app.category})`)
        }
      }

      // PHASE 3: If still need more and all unused are exhausted, use any remaining non-affiliates
      // This handles edge case where category limits prevent selecting all unused apps
      if (selectedApps.length < totalApps) {
        const remainingNonAffiliates = nonAffiliateApps.filter(app => !selectedAppIds.has(app.id))
        const shuffledRemaining = [...remainingNonAffiliates].sort(() => Math.random() - 0.5)

        for (const app of shuffledRemaining) {
          if (selectedApps.length >= totalApps) break

          // Check category maximum
          if (this.wouldExceedCategoryMax(app, selectedApps, maxPerCategory)) {
            continue
          }

          selectedApps.push(app)
          selectedAppIds.add(app.id)
          console.log(`[AppSelector] Selected (fallback): ${app.app_name} (${app.category})`)
        }
      }

      // Record selections in database (but DON'T update last_used_date - that happens in send-final)
      if (selectedApps.length > 0) {
        const selections = selectedApps.map((app, index) => ({
          issue_id: issueId,
          app_id: app.id,
          selection_order: index + 1,
          is_featured: app.is_featured
        }))

        const { error: insertError } = await supabaseAdmin
          .from('issue_ai_app_selections')
          .insert(selections)

        if (insertError) {
          console.error('Error inserting app selections:', insertError)
          throw new Error(`Failed to insert app selections: ${insertError.message}`)
        }

        console.log(`[AppSelector] Selected ${selectedApps.length} apps for issue: ${issueId}`)

        // Log category breakdown
        const categoryCounts = this.getCategoryCounts(selectedApps)
        const categoryBreakdown = Array.from(categoryCounts.entries())
          .map(([cat, count]) => `${cat}: ${count}`)
          .join(', ')
        console.log(`[AppSelector] Category breakdown: ${categoryBreakdown}`)

        const affiliateCount = selectedApps.filter(a => a.is_affiliate).length
        console.log(`[AppSelector] Affiliates: ${affiliateCount}, Non-affiliates: ${selectedApps.length - affiliateCount}`)
      } else {
        console.warn(`No apps selected for issue ${issueId} - check app settings and active apps`)
      }

      return selectedApps

    } catch (error) {
      console.error('Error selecting apps for issue:', error)
      return []
    }
  }

  /**
   * Get the selected apps for an issue
   */
  static async getAppsForissue(issueId: string): Promise<AIApplication[]> {
    try {
      const { data } = await supabaseAdmin
        .from('issue_ai_app_selections')
        .select('*, app:ai_applications(*)')
        .eq('issue_id', issueId)
        .order('selection_order', { ascending: true })

      return data?.map(s => s.app).filter(Boolean) || []
    } catch (error) {
      console.error('Error getting apps for issue:', error)
      return []
    }
  }

  /**
   * Update last_used_date for apps in an issue (called from send-final)
   * This starts the cooldown timer for affiliate apps
   */
  static async recordAppUsageOnSend(issueId: string): Promise<void> {
    try {
      // Get apps selected for this issue
      const { data: selections } = await supabaseAdmin
        .from('issue_ai_app_selections')
        .select('app_id')
        .eq('issue_id', issueId)

      if (!selections || selections.length === 0) {
        console.log('[AppSelector] No apps to update for issue:', issueId)
        return
      }

      const appIds = selections.map(s => s.app_id)
      const now = new Date().toISOString()

      // Update last_used_date and times_used for all selected apps
      for (const appId of appIds) {
        // First get current times_used
        const { data: app } = await supabaseAdmin
          .from('ai_applications')
          .select('times_used')
          .eq('id', appId)
          .single()

        // Then update with incremented value
        const { error: updateError } = await supabaseAdmin
          .from('ai_applications')
          .update({
            last_used_date: now,
            times_used: (app?.times_used || 0) + 1
          })
          .eq('id', appId)

        if (updateError) {
          console.error(`[AppSelector] Error updating app ${appId}:`, updateError)
        }
      }

      console.log(`[AppSelector] Updated last_used_date for ${appIds.length} apps (cooldown started)`)

    } catch (error) {
      console.error('[AppSelector] Error recording app usage:', error)
      // Don't throw - this is non-critical
    }
  }
}
