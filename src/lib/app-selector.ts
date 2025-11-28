import { supabaseAdmin } from './supabase'
import type { AIApplication, AIAppCategory } from '@/types/database'

interface CategoryCount {
  category: AIAppCategory
  count: number
}

export class AppSelector {
  /**
   * Get app selection settings from publication_settings table
   */
  private static async getAppSettings(newsletterId: string): Promise<{
    totalApps: number
    categoryCounts: CategoryCount[]
    affiliateCooldownDays: number
  }> {
    try {
      const { data: settings } = await supabaseAdmin
        .from('publication_settings')
        .select('key, value')
        .eq('publication_id', newsletterId)
        .or('key.like.ai_apps_%,key.eq.affiliate_cooldown_days')

      const settingsMap = new Map(settings?.map(s => [s.key, parseInt(s.value || '0')]) || [])

      const totalApps = settingsMap.get('ai_apps_per_newsletter') || 6
      const affiliateCooldownDays = settingsMap.get('affiliate_cooldown_days') || 7

      const categoryCounts: CategoryCount[] = [
        { category: 'Payroll', count: settingsMap.get('ai_apps_payroll_count') || 0 },
        { category: 'HR', count: settingsMap.get('ai_apps_hr_count') || 0 },
        { category: 'Accounting System', count: settingsMap.get('ai_apps_accounting_count') || 0 },
        { category: 'Finance', count: settingsMap.get('ai_apps_finance_count') || 0 },
        { category: 'Productivity', count: settingsMap.get('ai_apps_productivity_count') || 0 },
        { category: 'Client Management', count: settingsMap.get('ai_apps_client_mgmt_count') || 0 },
        { category: 'Banking', count: settingsMap.get('ai_apps_banking_count') || 0 },
      ]

      return { totalApps, categoryCounts, affiliateCooldownDays }
    } catch (error) {
      console.error('Error fetching app settings:', error)
      // Return defaults
      return {
        totalApps: 6,
        affiliateCooldownDays: 7,
        categoryCounts: [
          { category: 'Payroll', count: 2 },
          { category: 'HR', count: 1 },
          { category: 'Accounting System', count: 2 },
          { category: 'Finance', count: 0 },
          { category: 'Productivity', count: 0 },
          { category: 'Client Management', count: 0 },
          { category: 'Banking', count: 1 },
        ]
      }
    }
  }

  /**
   * Get unused apps for a specific category
   * - Affiliate apps: Excluded if in cooldown period (checked in selectRandomApp)
   * - Non-affiliate apps: Excluded only if ALL non-affiliates in category have been used (then cycle through)
   */
  private static async getUnusedAppsForCategory(
    category: AIAppCategory,
    allApps: AIApplication[],
    usedNonAffiliateAppIds: Set<string>
  ): Promise<AIApplication[]> {
    const categoryApps = allApps.filter(app => app.category === category)
    const nonAffiliateApps = categoryApps.filter(app => !app.is_affiliate)

    // For non-affiliate apps: Only exclude if ALL non-affiliates in category have been used
    // This allows non-affiliates to cycle through all before repeating
    const unusedNonAffiliateApps = nonAffiliateApps.filter(app => !usedNonAffiliateAppIds.has(app.id))
    
    // If all non-affiliates have been used, reset and allow cycling through all non-affiliates
    if (unusedNonAffiliateApps.length === 0 && nonAffiliateApps.length > 0) {
      console.log(`All ${category} non-affiliate apps have been used, cycling through again`)
      // Return all apps (affiliates + all non-affiliates) to allow cycling
      return categoryApps
    }

    // For affiliates: Include all (cooldown check happens in selectRandomApp)
    // For non-affiliates: Only include unused ones
    const affiliateApps = categoryApps.filter(app => app.is_affiliate)
    const unusedApps = [...affiliateApps, ...unusedNonAffiliateApps]

    // If somehow all apps are excluded, return all category apps
    if (unusedApps.length === 0 && categoryApps.length > 0) {
      console.log(`All ${category} apps excluded, returning all category apps`)
      return categoryApps
    }

    return unusedApps
  }

  /**
   * Check if an affiliate app is within cooldown period
   */
  private static isInCooldown(app: AIApplication, cooldownDays: number): boolean {
    if (!app.is_affiliate || !app.last_used_date) {
      return false
    }

    const lastUsed = new Date(app.last_used_date)
    const now = new Date()
    const daysSinceLastUsed = Math.floor((now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24))

    return daysSinceLastUsed < cooldownDays
  }

  /**
   * Select random app from array with affiliate priority weighting
   * Affiliates have 3x higher chance of being selected
   */
  private static selectRandomApp(
    apps: AIApplication[],
    cooldownDays: number = 0
  ): AIApplication | null {
    if (apps.length === 0) return null

    // Filter out affiliates in cooldown if cooldownDays is specified
    const eligibleApps = cooldownDays > 0
      ? apps.filter(app => !this.isInCooldown(app, cooldownDays))
      : apps

    if (eligibleApps.length === 0) {
      // If all are in cooldown, fall back to non-affiliates only
      const nonAffiliates = apps.filter(app => !app.is_affiliate)
      if (nonAffiliates.length === 0) return null
      return nonAffiliates[Math.floor(Math.random() * nonAffiliates.length)]
    }

    // Create weighted selection: affiliates appear 3x in the pool
    const weightedPool: AIApplication[] = []
    for (const app of eligibleApps) {
      if (app.is_affiliate) {
        weightedPool.push(app, app, app) // Add 3 times for 3x weight
      } else {
        weightedPool.push(app) // Add once
      }
    }

    return weightedPool[Math.floor(Math.random() * weightedPool.length)]
  }

  /**
   * Select apps for a issue based on category counts and rotation
   * Ensures variety by tracking which apps have been used across all campaigns
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
      const { totalApps, categoryCounts, affiliateCooldownDays } = await this.getAppSettings(newsletterId)
      console.log(`[AppSelector] Settings: totalApps=${totalApps}, categories=${categoryCounts.length}, cooldown=${affiliateCooldownDays} days`)

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

      // Separate tracking for affiliate vs non-affiliate apps
      // Affiliates: Subject to cooldown period only (from "Affiliate App Cooldown (Days)" setting)
      // Non-affiliates: Cycle through all before repeating (not subject to cooldown or issue exclusion)
      
      // For non-affiliates: Track all non-affiliate apps that have been used (for cycling)
      // This allows non-affiliates to cycle through all before repeating
      const { data: allRecentSelections } = await supabaseAdmin
        .from('issue_ai_app_selections')
        .select('app_id')
        .order('created_at', { ascending: false })
        .limit(allApps.length * 2) // Look back at last 2 full cycles

      const usedNonAffiliateAppIds = new Set<string>()
      // Filter to only non-affiliate apps by checking against allApps
      allRecentSelections?.forEach(selection => {
        const app = allApps.find(a => a.id === selection.app_id)
        if (app && !app.is_affiliate) {
          usedNonAffiliateAppIds.add(selection.app_id)
        }
      })
      console.log(`[AppSelector] Found ${usedNonAffiliateAppIds.size} non-affiliate apps in recent selections`)
      console.log(`[AppSelector] Affiliate cooldown period: ${affiliateCooldownDays} days`)

      // Select apps by category
      const selectedApps: AIApplication[] = []
      const selectedAppIds = new Set<string>()

      // 1. Select required apps for each category
      for (const { category, count } of categoryCounts) {
        if (count === 0) continue // Skip filler categories for now

        const unusedApps = await this.getUnusedAppsForCategory(category, allApps, usedNonAffiliateAppIds)

        for (let i = 0; i < count; i++) {
          const availableApps = unusedApps.filter(app => !selectedAppIds.has(app.id))
          const selectedApp = this.selectRandomApp(availableApps, affiliateCooldownDays)

          if (selectedApp) {
            selectedApps.push(selectedApp)
            selectedAppIds.add(selectedApp.id)
            // Mark non-affiliates as used for cycling
            if (!selectedApp.is_affiliate) {
              usedNonAffiliateAppIds.add(selectedApp.id)
            }
          }
        }
      }

      // 2. Fill remaining slots with filler categories (count = 0)
      const fillerCategories = categoryCounts
        .filter(cc => cc.count === 0)
        .map(cc => cc.category)

      while (selectedApps.length < totalApps && fillerCategories.length > 0) {
        const previousLength = selectedApps.length

        for (const category of fillerCategories) {
          if (selectedApps.length >= totalApps) break

          const unusedApps = await this.getUnusedAppsForCategory(category, allApps, usedNonAffiliateAppIds)
          const availableApps = unusedApps.filter(app => !selectedAppIds.has(app.id))
          const selectedApp = this.selectRandomApp(availableApps, affiliateCooldownDays)

          if (selectedApp) {
            selectedApps.push(selectedApp)
            selectedAppIds.add(selectedApp.id)
            // Mark non-affiliates as used for cycling
            if (!selectedApp.is_affiliate) {
              usedNonAffiliateAppIds.add(selectedApp.id)
            }
          }
        }

        // Safety breaks
        if (selectedApps.length === allApps.length) break // Selected all available apps
        if (selectedApps.length === previousLength) break // No progress made, can't fill more slots
      }

      // 3. If still need more, grab any unused apps
      // For affiliates: cooldown check happens in selectRandomApp
      // For non-affiliates: allow all (they cycle through)
      while (selectedApps.length < totalApps && selectedApps.length < allApps.length) {
        const availableApps = allApps
          .filter(app => {
            if (selectedAppIds.has(app.id)) return false
            // Non-affiliates: allow all (they cycle through)
            // Affiliates: cooldown check happens in selectRandomApp
            return true
          })
          .sort((a, b) => {
            // Prefer apps that haven't been used recently
            // Apps without last_used_date come first (never used)
            if (!a.last_used_date && !b.last_used_date) return 0
            if (!a.last_used_date) return -1
            if (!b.last_used_date) return 1
            // Otherwise, oldest last_used_date comes first
            return new Date(a.last_used_date).getTime() - new Date(b.last_used_date).getTime()
          })
        
        // Take from the least recently used apps
        const leastRecentlyUsed = availableApps.slice(0, Math.min(3, availableApps.length))
        const selectedApp = this.selectRandomApp(leastRecentlyUsed, affiliateCooldownDays)

        if (selectedApp) {
          selectedApps.push(selectedApp)
          selectedAppIds.add(selectedApp.id)
          // Mark non-affiliates as used for cycling
          if (!selectedApp.is_affiliate) {
            usedNonAffiliateAppIds.add(selectedApp.id)
          }
        } else {
          break // No more apps available
        }
      }

      // 4. Record selections in database
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

        // Update last_used_date and times_used
        const now = new Date().toISOString()
        for (const app of selectedApps) {
          const { error: updateError } = await supabaseAdmin
            .from('ai_applications')
            .update({
              last_used_date: now,
              times_used: (app.times_used || 0) + 1
            })
            .eq('id', app.id)

          if (updateError) {
            console.error(`Error updating app ${app.id}:`, updateError)
            // Don't throw - this is less critical than the insert
          }
        }

        console.log(`Selected ${selectedApps.length} apps for issue:`, issueId)
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
}
