/**
 * AI App Module Selector
 * Handles app selection for AI app modules with three modes:
 * - affiliate_priority: Affiliates first (respecting cooldown), then non-affiliates
 * - random: Random selection from all active apps
 * - manual: Admin manually selects apps
 */

import { supabaseAdmin } from '../supabase'
import type {
  AIAppModule,
  AIApplication,
  AIAppSelectionMode,
  IssueAIAppModule
} from '@/types/database'

interface AppSelectionResult {
  apps: AIApplication[]
  reason: string
}

interface PinnedApp {
  position: number  // 1-based position
  app: AIApplication
}

export class AppModuleSelector {
  /**
   * Check if an affiliate app is within cooldown period
   * Cooldown is based on last_used_date which is set during send-final
   */
  private static isInCooldown(
    app: AIApplication,
    cooldownDays: number,
    issueDate: Date
  ): boolean {
    if (!app.is_affiliate || !app.last_used_date) {
      return false
    }

    const lastUsed = new Date(app.last_used_date)
    const daysSinceLastUsed = Math.floor(
      (issueDate.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24)
    )

    return daysSinceLastUsed < cooldownDays
  }

  /**
   * Count how many apps from each category are already selected
   */
  private static getCategoryCounts(apps: AIApplication[]): Map<string, number> {
    const counts = new Map<string, number>()
    for (const app of apps) {
      const category = app.category || 'Unknown'
      counts.set(category, (counts.get(category) || 0) + 1)
    }
    return counts
  }

  /**
   * Check if adding an app would exceed the category maximum
   */
  private static wouldExceedCategoryMax(
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
   * Get pinned apps for a module, considering global pins and per-issue overrides
   * @param publicationId - Publication ID
   * @param moduleId - Module ID
   * @param issueId - Optional issue ID for per-issue overrides
   * @returns Array of pinned apps with their positions
   */
  private static async getPinnedApps(
    publicationId: string,
    moduleId: string,
    issueId?: string
  ): Promise<PinnedApp[]> {
    // Get globally pinned apps (where pinned_position is set)
    const { data: globalPinned, error } = await supabaseAdmin
      .from('ai_applications')
      .select('*')
      .eq('publication_id', publicationId)
      .eq('is_active', true)
      .not('pinned_position', 'is', null)
      .order('pinned_position', { ascending: true })

    if (error) {
      console.error('[AppModuleSelector] Error fetching pinned apps:', error)
      return []
    }

    if (!globalPinned || globalPinned.length === 0) {
      // No global pins - check for per-issue only pins
      if (!issueId) return []
    }

    // Get per-issue overrides if issue exists
    let overrides: Record<string, number | null> = {}
    if (issueId) {
      const { data: selection } = await supabaseAdmin
        .from('issue_ai_app_modules')
        .select('pinned_overrides')
        .eq('issue_id', issueId)
        .eq('ai_app_module_id', moduleId)
        .single()

      if (selection?.pinned_overrides) {
        overrides = selection.pinned_overrides as Record<string, number | null>
      }
    }

    const pinnedWithOverrides: PinnedApp[] = []
    const processedAppIds = new Set<string>()

    // Process globally pinned apps with overrides
    for (const app of globalPinned || []) {
      const override = overrides[app.id]

      if (override === null) {
        // Explicitly unpinned for this issue - skip
        console.log(`[AppModuleSelector] App ${app.app_name} unpinned for this issue`)
        processedAppIds.add(app.id)
        continue
      } else if (override !== undefined) {
        // Position override for this issue
        pinnedWithOverrides.push({ position: override, app: app as AIApplication })
        console.log(`[AppModuleSelector] App ${app.app_name} position overridden to ${override}`)
      } else {
        // Use global position
        pinnedWithOverrides.push({ position: app.pinned_position!, app: app as AIApplication })
        console.log(`[AppModuleSelector] App ${app.app_name} pinned to position ${app.pinned_position}`)
      }
      processedAppIds.add(app.id)
    }

    // Check for apps that are ONLY pinned per-issue (not globally pinned)
    for (const [appId, position] of Object.entries(overrides)) {
      if (position !== null && !processedAppIds.has(appId)) {
        // This app is pinned only for this issue
        const { data: app } = await supabaseAdmin
          .from('ai_applications')
          .select('*')
          .eq('id', appId)
          .eq('is_active', true)
          .single()

        if (app) {
          pinnedWithOverrides.push({ position, app: app as AIApplication })
          console.log(`[AppModuleSelector] App ${app.app_name} pinned for this issue only at position ${position}`)
        }
      }
    }

    // Sort by position
    return pinnedWithOverrides.sort((a, b) => a.position - b.position)
  }

  /**
   * Select apps using affiliate_priority mode (current logic)
   * Phase 0: Place pinned apps first
   * Phase 1: Affiliates (respecting cooldown and category max)
   * Phase 2: Non-affiliates to fill remaining (respecting category max)
   */
  private static async selectAffiliatePriority(
    allApps: AIApplication[],
    module: AIAppModule,
    issueDate: Date,
    pinnedApps: PinnedApp[] = []
  ): Promise<AIApplication[]> {
    const { apps_count, max_per_category, affiliate_cooldown_days } = module

    // Initialize array with null slots
    const selectedApps: (AIApplication | null)[] = new Array(apps_count).fill(null)
    const selectedAppIds = new Set<string>()

    // Phase 0: Place pinned apps in their positions
    for (const { position, app } of pinnedApps) {
      if (position >= 1 && position <= apps_count) {
        selectedApps[position - 1] = app  // Convert to 0-based index
        selectedAppIds.add(app.id)
        console.log(`[AppModuleSelector] Pinned app ${app.app_name} placed at position ${position}`)
      }
    }

    // Get remaining apps (excluding already pinned)
    const availableApps = allApps.filter(app => !selectedAppIds.has(app.id))

    // Separate affiliates and non-affiliates
    const affiliates = availableApps.filter(app => app.is_affiliate)
    const nonAffiliates = availableApps.filter(app => !app.is_affiliate)

    // Phase 1: Select affiliates first
    const availableAffiliates = affiliates.filter(
      app => !this.isInCooldown(app, affiliate_cooldown_days, issueDate)
    )

    // Sort by priority (higher first)
    const sortedAffiliates = [...availableAffiliates]
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))

    // Helper to get non-null apps for category counting
    const getNonNullApps = () => selectedApps.filter((a): a is AIApplication => a !== null)

    for (const app of sortedAffiliates) {
      // Find first empty slot
      const emptyIndex = selectedApps.findIndex(a => a === null)
      if (emptyIndex === -1) break  // No more empty slots

      // Check category maximum
      if (this.wouldExceedCategoryMax(app, getNonNullApps(), max_per_category)) {
        console.log(`[AppModuleSelector] Skipping affiliate ${app.app_name} - would exceed ${max_per_category} max for ${app.category}`)
        continue
      }

      selectedApps[emptyIndex] = app
      selectedAppIds.add(app.id)
      console.log(`[AppModuleSelector] Selected affiliate: ${app.app_name} (${app.category})`)
    }

    // Phase 2: Fill remaining slots with non-affiliates
    // Shuffle for variety
    const shuffledNonAffiliates = [...nonAffiliates].sort(() => Math.random() - 0.5)

    for (const app of shuffledNonAffiliates) {
      // Find first empty slot
      const emptyIndex = selectedApps.findIndex(a => a === null)
      if (emptyIndex === -1) break  // No more empty slots
      if (selectedAppIds.has(app.id)) continue

      // Check category maximum
      if (this.wouldExceedCategoryMax(app, getNonNullApps(), max_per_category)) {
        console.log(`[AppModuleSelector] Skipping non-affiliate ${app.app_name} - would exceed max for ${app.category}`)
        continue
      }

      selectedApps[emptyIndex] = app
      selectedAppIds.add(app.id)
      console.log(`[AppModuleSelector] Selected non-affiliate: ${app.app_name} (${app.category})`)
    }

    // Return non-null apps in order
    return selectedApps.filter((a): a is AIApplication => a !== null)
  }

  /**
   * Select apps using random mode
   * Phase 0: Place pinned apps first
   * Random selection respecting category limits for remaining slots
   */
  private static selectRandom(
    allApps: AIApplication[],
    module: AIAppModule,
    pinnedApps: PinnedApp[] = []
  ): AIApplication[] {
    const { apps_count, max_per_category } = module

    // Initialize array with null slots
    const selectedApps: (AIApplication | null)[] = new Array(apps_count).fill(null)
    const selectedAppIds = new Set<string>()

    // Phase 0: Place pinned apps in their positions
    for (const { position, app } of pinnedApps) {
      if (position >= 1 && position <= apps_count) {
        selectedApps[position - 1] = app  // Convert to 0-based index
        selectedAppIds.add(app.id)
        console.log(`[AppModuleSelector] Pinned app ${app.app_name} placed at position ${position}`)
      }
    }

    // Get remaining apps (excluding already pinned)
    const availableApps = allApps.filter(app => !selectedAppIds.has(app.id))

    // Shuffle all available apps
    const shuffled = [...availableApps].sort(() => Math.random() - 0.5)

    // Helper to get non-null apps for category counting
    const getNonNullApps = () => selectedApps.filter((a): a is AIApplication => a !== null)

    for (const app of shuffled) {
      // Find first empty slot
      const emptyIndex = selectedApps.findIndex(a => a === null)
      if (emptyIndex === -1) break  // No more empty slots

      // Check category maximum
      if (this.wouldExceedCategoryMax(app, getNonNullApps(), max_per_category)) {
        continue
      }

      selectedApps[emptyIndex] = app
      selectedAppIds.add(app.id)
    }

    // Return non-null apps in order
    return selectedApps.filter((a): a is AIApplication => a !== null)
  }

  /**
   * Select apps for a module based on its selection mode
   */
  static async selectAppsForModule(
    module: AIAppModule,
    publicationId: string,
    issueDate: Date,
    issueId?: string
  ): Promise<AppSelectionResult> {
    // Manual mode returns empty - admin must pick
    if (module.selection_mode === 'manual') {
      return { apps: [], reason: 'Manual selection required' }
    }

    // Get pinned apps first (global pins + per-issue overrides)
    const pinnedApps = await this.getPinnedApps(publicationId, module.id, issueId)
    const pinnedCount = pinnedApps.length
    if (pinnedCount > 0) {
      console.log(`[AppModuleSelector] Found ${pinnedCount} pinned app(s) for module ${module.name}`)
    }

    // Get all active apps for this publication
    // For now, get all active apps - module filtering can be added later when apps are assigned to modules
    const { data: allApps, error } = await supabaseAdmin
      .from('ai_applications')
      .select('*')
      .eq('publication_id', publicationId)
      .eq('is_active', true)

    if (error) {
      console.error('[AppModuleSelector] Error fetching apps:', error)
      return { apps: [], reason: `Error fetching apps: ${error.message}` }
    }

    console.log(`[AppModuleSelector] Found ${allApps?.length || 0} active apps for publication`)

    if (!allApps || allApps.length === 0) {
      return { apps: [], reason: 'No active apps available' }
    }

    let selectedApps: AIApplication[]

    switch (module.selection_mode) {
      case 'affiliate_priority':
        selectedApps = await this.selectAffiliatePriority(allApps, module, issueDate, pinnedApps)
        break
      case 'random':
        selectedApps = this.selectRandom(allApps, module, pinnedApps)
        break
      default:
        selectedApps = await this.selectAffiliatePriority(allApps, module, issueDate, pinnedApps)
    }

    const affiliateCount = selectedApps.filter(a => a.is_affiliate).length
    return {
      apps: selectedApps,
      reason: `Selected ${selectedApps.length} apps via ${module.selection_mode} (${pinnedCount} pinned, ${affiliateCount} affiliates, ${selectedApps.length - affiliateCount - pinnedCount} others)`
    }
  }

  /**
   * Select apps for all active modules for an issue
   */
  static async selectAppsForIssue(
    issueId: string,
    publicationId: string,
    issueDate: Date
  ): Promise<{ moduleId: string; result: AppSelectionResult }[]> {
    console.log(`[AppModuleSelector] Starting selection for issue ${issueId}, publication ${publicationId}`)

    // Check if selections already exist
    const { data: existing } = await supabaseAdmin
      .from('issue_ai_app_modules')
      .select('ai_app_module_id')
      .eq('issue_id', issueId)

    if (existing && existing.length > 0) {
      console.log('[AppModuleSelector] Apps already selected for issue:', issueId)
      return []
    }

    // Get all active AI app modules
    const { data: modules, error } = await supabaseAdmin
      .from('ai_app_modules')
      .select('*')
      .eq('publication_id', publicationId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('[AppModuleSelector] Error fetching modules:', error)
      return []
    }

    if (!modules || modules.length === 0) {
      console.log('[AppModuleSelector] No active AI app modules found for publication:', publicationId)
      return []
    }

    console.log(`[AppModuleSelector] Found ${modules.length} active module(s):`, modules.map(m => m.name))

    const results: { moduleId: string; result: AppSelectionResult }[] = []

    for (const module of modules) {
      const result = await this.selectAppsForModule(
        module as AIAppModule,
        publicationId,
        issueDate,
        issueId  // Pass issueId for per-issue pinning overrides
      )

      // Store selection
      const { error: insertError } = await supabaseAdmin
        .from('issue_ai_app_modules')
        .insert({
          issue_id: issueId,
          ai_app_module_id: module.id,
          app_ids: result.apps.map(a => a.id),
          selection_mode: module.selection_mode
        })

      if (insertError) {
        console.error('[AppModuleSelector] Error storing selection:', insertError)
      }

      results.push({ moduleId: module.id, result })
      console.log(`[AppModuleSelector] Module "${module.name}": ${result.reason}`)
    }

    return results
  }

  /**
   * Record app usage at send time
   * Updates last_used_date and times_used for selected apps
   */
  static async recordUsage(issueId: string): Promise<{ success: boolean; recorded: number }> {
    const { data: selections, error } = await supabaseAdmin
      .from('issue_ai_app_modules')
      .select('*, ai_app_module:ai_app_modules(*)')
      .eq('issue_id', issueId)
      .is('used_at', null)

    if (error || !selections) {
      console.error('[AppModuleSelector] Error fetching selections:', error)
      return { success: false, recorded: 0 }
    }

    const now = new Date().toISOString()
    let recorded = 0

    for (const selection of selections) {
      const appIds = selection.app_ids as string[]

      // Update each app's usage tracking
      for (const appId of appIds) {
        const { data: app } = await supabaseAdmin
          .from('ai_applications')
          .select('times_used')
          .eq('id', appId)
          .single()

        await supabaseAdmin
          .from('ai_applications')
          .update({
            last_used_date: now,
            times_used: (app?.times_used || 0) + 1
          })
          .eq('id', appId)
      }

      // Mark selection as used
      await supabaseAdmin
        .from('issue_ai_app_modules')
        .update({ used_at: now })
        .eq('id', selection.id)

      recorded++
    }

    console.log(`[AppModuleSelector] Recorded usage for ${recorded} module selections`)
    return { success: true, recorded }
  }

  /**
   * Get selections for an issue
   */
  static async getIssueSelections(issueId: string): Promise<IssueAIAppModule[]> {
    const { data, error } = await supabaseAdmin
      .from('issue_ai_app_modules')
      .select('*, ai_app_module:ai_app_modules(*)')
      .eq('issue_id', issueId)

    if (error) {
      console.error('[AppModuleSelector] Error fetching selections:', error)
      return []
    }

    // Fetch apps for each selection
    const results: IssueAIAppModule[] = []
    for (const selection of data || []) {
      const appIds = selection.app_ids as string[]

      let apps: AIApplication[] = []
      if (appIds && appIds.length > 0) {
        const { data: appsData } = await supabaseAdmin
          .from('ai_applications')
          .select('*')
          .in('id', appIds)

        // Preserve order based on app_ids
        apps = appIds
          .map(id => appsData?.find(a => a.id === id))
          .filter((a): a is AIApplication => a !== undefined)
      }

      results.push({
        ...selection,
        apps
      } as IssueAIAppModule)
    }

    return results
  }

  /**
   * Manually select apps for a module
   */
  static async manuallySelectApps(
    issueId: string,
    moduleId: string,
    appIds: string[]
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabaseAdmin
      .from('issue_ai_app_modules')
      .upsert({
        issue_id: issueId,
        ai_app_module_id: moduleId,
        app_ids: appIds,
        selection_mode: 'manual',
        selected_at: new Date().toISOString()
      }, {
        onConflict: 'issue_id,ai_app_module_id'
      })

    if (error) {
      console.error('[AppModuleSelector] Error manual selection:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  }

  /**
   * Clear app selection for a module (set app_ids to empty)
   */
  static async clearSelection(
    issueId: string,
    moduleId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabaseAdmin
      .from('issue_ai_app_modules')
      .upsert({
        issue_id: issueId,
        ai_app_module_id: moduleId,
        app_ids: [],
        selection_mode: 'manual',
        selected_at: new Date().toISOString()
      }, {
        onConflict: 'issue_id,ai_app_module_id'
      })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  }

  /**
   * Get available apps for a module (for dropdown selection)
   */
  static async getAvailableApps(
    publicationId: string,
    _moduleId?: string
  ): Promise<AIApplication[]> {
    // Get all active apps for this publication
    // Module filtering can be added later when apps are assigned to specific modules
    const { data, error } = await supabaseAdmin
      .from('ai_applications')
      .select('*')
      .eq('publication_id', publicationId)
      .eq('is_active', true)
      .order('app_name', { ascending: true })

    if (error) {
      console.error('[AppModuleSelector] Error fetching available apps:', error)
      return []
    }

    return data || []
  }

  /**
   * Initialize selections for an issue (creates empty selections for all active modules)
   */
  static async initializeSelectionsForIssue(
    issueId: string,
    publicationId: string
  ): Promise<void> {
    // Get all active AI app modules
    const { data: modules, error } = await supabaseAdmin
      .from('ai_app_modules')
      .select('*')
      .eq('publication_id', publicationId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error || !modules || modules.length === 0) {
      return
    }

    // Check for existing selections
    const { data: existing } = await supabaseAdmin
      .from('issue_ai_app_modules')
      .select('ai_app_module_id')
      .eq('issue_id', issueId)

    const existingModuleIds = new Set(existing?.map(e => e.ai_app_module_id) || [])

    // Create selections for modules without existing selections
    for (const module of modules) {
      if (existingModuleIds.has(module.id)) continue

      await supabaseAdmin
        .from('issue_ai_app_modules')
        .insert({
          issue_id: issueId,
          ai_app_module_id: module.id,
          app_ids: [],
          selection_mode: module.selection_mode
        })
    }
  }
}
