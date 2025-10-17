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
  }> {
    try {
      const { data: settings } = await supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .like('key', 'ai_apps_%')

      const settingsMap = new Map(settings?.map(s => [s.key, parseInt(s.value || '0')]) || [])

      const totalApps = settingsMap.get('ai_apps_per_newsletter') || 6

      const categoryCounts: CategoryCount[] = [
        { category: 'Payroll', count: settingsMap.get('ai_apps_payroll_count') || 0 },
        { category: 'HR', count: settingsMap.get('ai_apps_hr_count') || 0 },
        { category: 'Accounting System', count: settingsMap.get('ai_apps_accounting_count') || 0 },
        { category: 'Finance', count: settingsMap.get('ai_apps_finance_count') || 0 },
        { category: 'Productivity', count: settingsMap.get('ai_apps_productivity_count') || 0 },
        { category: 'Client Management', count: settingsMap.get('ai_apps_client_mgmt_count') || 0 },
        { category: 'Banking', count: settingsMap.get('ai_apps_banking_count') || 0 },
      ]

      return { totalApps, categoryCounts }
    } catch (error) {
      console.error('Error fetching app settings:', error)
      // Return defaults
      return {
        totalApps: 6,
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
   * Apps are considered "used" if they appear in campaign_ai_app_selections
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
   * Select random app from array
   */
  private static selectRandomApp(apps: AIApplication[]): AIApplication | null {
    if (apps.length === 0) return null
    return apps[Math.floor(Math.random() * apps.length)]
  }

  /**
   * Select apps for a campaign based on category counts and rotation
   * Ensures variety by tracking which apps have been used across all campaigns
   */
  static async selectAppsForCampaign(campaignId: string, newsletterId: string): Promise<AIApplication[]> {
    try {
      // Check if apps already selected for this campaign
      const { data: existingSelections } = await supabaseAdmin
        .from('campaign_ai_app_selections')
        .select('*, app:ai_applications(*)')
        .eq('campaign_id', campaignId)

      if (existingSelections && existingSelections.length > 0) {
        console.log('Apps already selected for campaign:', campaignId)
        return existingSelections.map(s => s.app).filter(Boolean)
      }

      // Get selection settings
      const { totalApps, categoryCounts } = await this.getAppSettings()

      // Get all active apps for this newsletter
      const { data: allApps } = await supabaseAdmin
        .from('ai_applications')
        .select('*')
        .eq('newsletter_id', newsletterId)
        .eq('is_active', true)

      if (!allApps || allApps.length === 0) {
        console.log('No active apps available for newsletter:', newsletterId)
        return []
      }

      // Get recently used app IDs across all campaigns
      const { data: recentSelections } = await supabaseAdmin
        .from('campaign_ai_app_selections')
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
          const selectedApp = this.selectRandomApp(availableApps)

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
        for (const category of fillerCategories) {
          if (selectedApps.length >= totalApps) break

          const unusedApps = await this.getUnusedAppsForCategory(category, allApps, usedAppIds)
          const availableApps = unusedApps.filter(app => !selectedAppIds.has(app.id))
          const selectedApp = this.selectRandomApp(availableApps)

          if (selectedApp) {
            selectedApps.push(selectedApp)
            selectedAppIds.add(selectedApp.id)
            usedAppIds.add(selectedApp.id)
          }
        }

        // Safety break if we can't fill more slots
        if (selectedApps.length === allApps.length) break
      }

      // 3. If still need more, grab any unused apps
      while (selectedApps.length < totalApps && selectedApps.length < allApps.length) {
        const availableApps = allApps.filter(app => !selectedAppIds.has(app.id))
        const selectedApp = this.selectRandomApp(availableApps)

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
          campaign_id: campaignId,
          app_id: app.id,
          selection_order: index + 1,
          is_featured: app.is_featured
        }))

        await supabaseAdmin
          .from('campaign_ai_app_selections')
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

        console.log(`Selected ${selectedApps.length} apps for campaign:`, campaignId)
      }

      return selectedApps

    } catch (error) {
      console.error('Error selecting apps for campaign:', error)
      return []
    }
  }

  /**
   * Get the selected apps for a campaign
   */
  static async getAppsForCampaign(campaignId: string): Promise<AIApplication[]> {
    try {
      const { data } = await supabaseAdmin
        .from('campaign_ai_app_selections')
        .select('*, app:ai_applications(*)')
        .eq('campaign_id', campaignId)
        .order('selection_order', { ascending: true })

      return data?.map(s => s.app).filter(Boolean) || []
    } catch (error) {
      console.error('Error getting apps for campaign:', error)
      return []
    }
  }
}
