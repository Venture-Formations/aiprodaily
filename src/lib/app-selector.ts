import { supabaseAdmin } from './supabase'
import type { AIApplication, AIAppCategory } from '@/types/database'

interface CategoryCount {
  category: AIAppCategory
  count: number
}

export class AppSelector {
  /**
   * Get app selection settings from app_settings table
   */
  private static async getAppSettings(): Promise<{
    totalApps: number
    categoryCounts: CategoryCount[]
    affiliateCooldownDays: number
  }> {
    try {
      const { data: settings } = await supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .like('key', 'ai_apps_%')
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
   * Apps are considered "used" if they appear in issue_ai_app_selections
   */
  private static async getUnusedAppsForCategory(
    category: AIAppCategory,
    allApps: AIApplication[],
    usedAppIds: Set<string>
  ): Promise<AIApplication[]> {
    const categoryApps = allApps.filter(app => app.category === category)
    const unusedApps = categoryApps.filter(app => !usedAppIds.has(app.id))

    // If all apps have been used, reset and use all category apps
    if (unusedApps.length === 0 && categoryApps.length > 0) {
      console.log(`All ${category} apps have been used, cycling through again`)
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
      const { totalApps, categoryCounts, affiliateCooldownDays } = await this.getAppSettings()

      // Get all active apps for this newsletter
      const { data: allApps } = await supabaseAdmin
        .from('ai_applications')
        .select('*')
        .eq('publication_id', newsletterId)
        .eq('is_active', true)

      if (!allApps || allApps.length === 0) {
        console.log('No active apps available for newsletter:', newsletterId)
        return []
      }

      // Get recently used app IDs across all campaigns
      const { data: recentSelections } = await supabaseAdmin
        .from('issue_ai_app_selections')
        .select('app_id')
        .order('created_at', { ascending: false })
        .limit(allApps.length * 2) // Look back at last 2 full cycles

      const usedAppIds = new Set(recentSelections?.map(s => s.app_id) || [])

      // Select apps by category
      const selectedApps: AIApplication[] = []
      const selectedAppIds = new Set<string>()

      // 1. Select required apps for each category
      for (const { category, count } of categoryCounts) {
        if (count === 0) continue // Skip filler categories for now

        const unusedApps = await this.getUnusedAppsForCategory(category, allApps, usedAppIds)

        for (let i = 0; i < count; i++) {
          const availableApps = unusedApps.filter(app => !selectedAppIds.has(app.id))
          const selectedApp = this.selectRandomApp(availableApps, affiliateCooldownDays)

          if (selectedApp) {
            selectedApps.push(selectedApp)
            selectedAppIds.add(selectedApp.id)
            usedAppIds.add(selectedApp.id) // Mark as used for this cycle
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

          const unusedApps = await this.getUnusedAppsForCategory(category, allApps, usedAppIds)
          const availableApps = unusedApps.filter(app => !selectedAppIds.has(app.id))
          const selectedApp = this.selectRandomApp(availableApps, affiliateCooldownDays)

          if (selectedApp) {
            selectedApps.push(selectedApp)
            selectedAppIds.add(selectedApp.id)
            usedAppIds.add(selectedApp.id)
          }
        }

        // Safety breaks
        if (selectedApps.length === allApps.length) break // Selected all available apps
        if (selectedApps.length === previousLength) break // No progress made, can't fill more slots
      }

      // 3. If still need more, grab any unused apps
      while (selectedApps.length < totalApps && selectedApps.length < allApps.length) {
        const availableApps = allApps.filter(app => !selectedAppIds.has(app.id))
        const selectedApp = this.selectRandomApp(availableApps, affiliateCooldownDays)

        if (selectedApp) {
          selectedApps.push(selectedApp)
          selectedAppIds.add(selectedApp.id)
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

        await supabaseAdmin
          .from('issue_ai_app_selections')
          .insert(selections)

        // Update last_used_date and times_used
        const now = new Date().toISOString()
        for (const app of selectedApps) {
          await supabaseAdmin
            .from('ai_applications')
            .update({
              last_used_date: now,
              times_used: (app.times_used || 0) + 1
            })
            .eq('id', app.id)
        }

        console.log(`Selected ${selectedApps.length} apps for issue:`, issueId)
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
