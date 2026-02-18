import { supabaseAdmin } from '../supabase'
import type {
  PromptModule,
  PromptIdea,
  PromptSelectionMode,
  IssuePromptModule
} from '@/types/database'

interface PromptSelectionResult {
  prompt: PromptIdea | null
  reason: string
}

export class PromptModuleSelector {
  /**
   * Get eligible prompts for a mod
   * If mod has prompts assigned (via prompt_module_id), use those.
   * Otherwise, use all prompts without a mod assignment (null).
   */
  private static async getEligiblePrompts(
    moduleId: string,
    publicationId: string
  ): Promise<PromptIdea[]> {
    // First check if any prompts are specifically assigned to this mod
    const { data: modulePrompts } = await supabaseAdmin
      .from('prompt_ideas')
      .select('id')
      .eq('prompt_module_id', moduleId)
      .eq('is_active', true)

    console.log(`[PromptSelector] Module ${moduleId}: ${modulePrompts?.length || 0} mod-specific prompts found`)

    let query = supabaseAdmin
      .from('prompt_ideas')
      .select('*')
      .eq('publication_id', publicationId)
      .eq('is_active', true)

    if (modulePrompts && modulePrompts.length > 0) {
      // Use mod-specific prompts
      console.log('[PromptSelector] Using mod-specific prompts')
      query = query.eq('prompt_module_id', moduleId)
    } else {
      // Use prompts without mod assignment (available to all modules)
      console.log('[PromptSelector] Using prompts with null module_id')
      query = query.is('prompt_module_id', null)
    }

    const { data, error } = await query.order('display_order', { ascending: true, nullsFirst: false })

    if (error || !data) {
      console.error('[PromptSelector] Error fetching prompts:', error)
      return []
    }

    console.log(`[PromptSelector] Found ${data.length} eligible prompts for publication ${publicationId}`)

    return data as PromptIdea[]
  }

  /**
   * Select prompt using Sequential mode (fixed order rotation)
   * Follows the display_order, cycling through in order.
   * Uses the mod's next_position to track which position to pick next.
   */
  private static selectSequential(
    prompts: PromptIdea[],
    nextPosition: number
  ): PromptIdea | null {
    if (prompts.length === 0) return null

    // Sort by display_order
    const sorted = [...prompts].sort((a, b) => (a.display_order || 0) - (b.display_order || 0))

    // Find prompt at the next_position
    let selected = sorted.find(p => p.display_order === nextPosition)

    // If no prompt at that position (gap or past end), find next available
    if (!selected) {
      selected = sorted.find(p => (p.display_order || 0) >= nextPosition)
      if (!selected) {
        // Loop back to first prompt
        selected = sorted[0]
      }
    }

    return selected
  }

  /**
   * Select prompt using Random mode (shuffle without repeat)
   * Randomly picks from prompts that haven't been used in the current cycle.
   * A cycle completes when all prompts have been used once, then resets.
   */
  private static selectRandom(prompts: PromptIdea[]): PromptIdea | null {
    if (prompts.length === 0) return null

    // Find the minimum times_used among eligible prompts
    const minTimesUsed = Math.min(...prompts.map(p => p.times_used || 0))

    // Filter to only prompts at minimum times_used (not yet used this cycle)
    const available = prompts.filter(p => (p.times_used || 0) === minTimesUsed)

    // Random pick from available prompts
    const randomIndex = Math.floor(Math.random() * available.length)
    return available[randomIndex]
  }

  /**
   * Select prompt using Priority mode (priority tiers with rotation)
   * Higher priority prompts are shown first. Within each priority tier,
   * prompts rotate by display_order. Only moves to lower priority after
   * all higher priority prompts have been used in the current cycle.
   */
  private static selectPriority(prompts: PromptIdea[]): PromptIdea | null {
    if (prompts.length === 0) return null

    // Sort by: times_used ASC (cycle), then priority DESC (high first), then display_order
    const sorted = [...prompts].sort((a, b) => {
      // First: cycle position (least used first)
      if ((a.times_used || 0) !== (b.times_used || 0)) {
        return (a.times_used || 0) - (b.times_used || 0)
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
   * Select a prompt for a mod based on its selection mode
   */
  static async selectPrompt(
    mod: PromptModule,
    publicationId: string
  ): Promise<PromptSelectionResult> {
    const selectionMode = mod.selection_mode

    // Manual mode returns null - admin must pick
    if (selectionMode === 'manual') {
      return { prompt: null, reason: 'Manual selection required' }
    }

    // Get eligible prompts
    const eligiblePrompts = await this.getEligiblePrompts(mod.id, publicationId)

    if (eligiblePrompts.length === 0) {
      return { prompt: null, reason: 'No eligible prompts available' }
    }

    // Select based on mode
    let selected: PromptIdea | null = null

    switch (selectionMode) {
      case 'sequential':
        selected = this.selectSequential(eligiblePrompts, mod.next_position || 1)
        break
      case 'random':
        selected = this.selectRandom(eligiblePrompts)
        break
      case 'priority':
        selected = this.selectPriority(eligiblePrompts)
        break
      default:
        selected = this.selectRandom(eligiblePrompts)
    }

    if (!selected) {
      return { prompt: null, reason: 'Selection algorithm returned no prompt' }
    }

    return {
      prompt: selected,
      reason: `Selected via ${selectionMode} mode from ${eligiblePrompts.length} eligible prompts`
    }
  }

  /**
   * Initialize empty selections for an issue (for manual selection workflow)
   * Creates selection records but doesn't auto-select prompts
   */
  static async initializeSelectionsForIssue(
    issueId: string,
    publicationId: string
  ): Promise<void> {
    // Check if selections already exist
    const { data: existing } = await supabaseAdmin
      .from('issue_prompt_modules')
      .select('prompt_module_id')
      .eq('issue_id', issueId)

    if (existing && existing.length > 0) {
      console.log('[PromptSelector] Selections already exist for issue:', issueId)
      return
    }

    // Get all active prompt modules
    const { data: modules, error } = await supabaseAdmin
      .from('prompt_modules')
      .select('*')
      .eq('publication_id', publicationId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error || !modules || modules.length === 0) {
      console.log('[PromptSelector] No active prompt modules found')
      return
    }

    // Create empty selections for each mod
    for (const mod of modules) {
      await supabaseAdmin
        .from('issue_prompt_modules')
        .insert({
          issue_id: issueId,
          prompt_module_id: mod.id,
          prompt_id: null,
          selection_mode: mod.selection_mode
        })
    }

    console.log(`[PromptSelector] Initialized ${modules.length} empty selections for issue ${issueId}`)
  }

  /**
   * Select prompts for all active modules for an issue
   */
  static async selectPromptsForIssue(
    issueId: string,
    publicationId: string
  ): Promise<{ moduleId: string; result: PromptSelectionResult }[]> {
    // Check if selections already exist
    const { data: existing } = await supabaseAdmin
      .from('issue_prompt_modules')
      .select('prompt_module_id')
      .eq('issue_id', issueId)

    if (existing && existing.length > 0) {
      console.log('[PromptSelector] Prompts already selected for issue:', issueId)
      return []
    }

    // Get all active prompt modules
    const { data: modules, error } = await supabaseAdmin
      .from('prompt_modules')
      .select('*')
      .eq('publication_id', publicationId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error || !modules || modules.length === 0) {
      console.log('[PromptSelector] No active prompt modules found')
      return []
    }

    const results: { moduleId: string; result: PromptSelectionResult }[] = []

    // Select prompt for each mod
    for (const mod of modules) {
      const result = await this.selectPrompt(mod as PromptModule, publicationId)

      // Store selection in database
      const { error: insertError } = await supabaseAdmin
        .from('issue_prompt_modules')
        .insert({
          issue_id: issueId,
          prompt_module_id: mod.id,
          prompt_id: result.prompt?.id || null,
          selection_mode: mod.selection_mode
        })

      if (insertError) {
        console.error('[PromptSelector] Error storing selection:', insertError)
      }

      results.push({ moduleId: mod.id, result })
      console.log(`[PromptSelector] Module "${mod.name}": ${result.reason}`)
    }

    return results
  }

  /**
   * Record prompt usage at send time (updates times_used, last_used_date, advances sequential position)
   */
  static async recordUsage(
    issueId: string,
    issueDate: Date
  ): Promise<{ success: boolean; recorded: number }> {
    const { data: selections, error } = await supabaseAdmin
      .from('issue_prompt_modules')
      .select(`
        id,
        prompt_module_id,
        prompt_id,
        selection_mode,
        prompt_module:prompt_modules(id, selection_mode, next_position),
        prompt:prompt_ideas(id, times_used, display_order)
      `)
      .eq('issue_id', issueId)
      .is('used_at', null)

    if (error || !selections) {
      console.error('[PromptSelector] Error fetching selections:', error)
      return { success: false, recorded: 0 }
    }

    const issueDateStr = issueDate.toISOString().split('T')[0]
    let recorded = 0

    for (const selection of selections) {
      if (!selection.prompt_id || !selection.prompt) continue

      const prompt = selection.prompt as any
      const promptModule = selection.prompt_module as any

      // Update prompt
      await supabaseAdmin
        .from('prompt_ideas')
        .update({
          times_used: (prompt.times_used || 0) + 1,
          last_used_date: issueDateStr,
          updated_at: new Date().toISOString()
        })
        .eq('id', prompt.id)

      // Mark selection as used
      await supabaseAdmin
        .from('issue_prompt_modules')
        .update({ used_at: new Date().toISOString() })
        .eq('id', selection.id)

      // Advance next_position for sequential modules
      if (promptModule && promptModule.selection_mode === 'sequential') {
        await this.advanceSequentialPosition(promptModule.id, prompt.display_order)
      }

      recorded++
    }

    console.log(`[PromptSelector] Recorded usage for ${recorded} prompt selections`)
    return { success: true, recorded }
  }

  /**
   * Advance the next_position for a sequential mod after a prompt is used
   */
  private static async advanceSequentialPosition(
    moduleId: string,
    usedDisplayOrder: number
  ): Promise<void> {
    // Get all active prompts for this mod to find max position
    const { data: prompts } = await supabaseAdmin
      .from('prompt_ideas')
      .select('display_order')
      .or(`prompt_module_id.eq.${moduleId},prompt_module_id.is.null`)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (!prompts || prompts.length === 0) return

    const maxPosition = Math.max(...prompts.map(p => p.display_order || 0))
    let nextPosition = usedDisplayOrder + 1

    // Loop back to 1 if we've passed the max
    if (nextPosition > maxPosition) {
      nextPosition = 1
      console.log(`[PromptSelector] Module ${moduleId}: Reached end of rotation, looping back to position 1`)
    } else {
      console.log(`[PromptSelector] Module ${moduleId}: Advancing to position ${nextPosition}`)
    }

    // Update the mod's next_position
    await supabaseAdmin
      .from('prompt_modules')
      .update({
        next_position: nextPosition,
        updated_at: new Date().toISOString()
      })
      .eq('id', moduleId)
  }

  /**
   * Get selected prompts for an issue (for display on issue page)
   */
  static async getIssuePromptSelections(issueId: string): Promise<IssuePromptModule[]> {
    const { data, error } = await supabaseAdmin
      .from('issue_prompt_modules')
      .select(`
        *,
        prompt_module:prompt_modules(*),
        prompt:prompt_ideas(*)
      `)
      .eq('issue_id', issueId)
      .order('prompt_module(display_order)', { ascending: true })

    if (error) {
      console.error('[PromptSelector] Error fetching issue selections:', error)
      return []
    }

    return (data || []) as IssuePromptModule[]
  }

  /**
   * Manually select a prompt for a mod
   */
  static async manuallySelectPrompt(
    issueId: string,
    moduleId: string,
    promptId: string | null
  ): Promise<{ success: boolean; error?: string }> {
    // Upsert the selection
    const { error } = await supabaseAdmin
      .from('issue_prompt_modules')
      .upsert({
        issue_id: issueId,
        prompt_module_id: moduleId,
        prompt_id: promptId,
        selection_mode: 'manual',
        selected_at: new Date().toISOString()
      }, {
        onConflict: 'issue_id,prompt_module_id'
      })

    if (error) {
      console.error('[PromptSelector] Error manual selection:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  }

  /**
   * Clear a prompt selection for a mod (set prompt_id to null)
   */
  static async clearPromptSelection(
    issueId: string,
    moduleId: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.manuallySelectPrompt(issueId, moduleId, null)
  }

  /**
   * Get available prompts for manual selection dropdown
   */
  static async getAvailablePrompts(publicationId: string): Promise<PromptIdea[]> {
    const { data, error } = await supabaseAdmin
      .from('prompt_ideas')
      .select('*')
      .eq('publication_id', publicationId)
      .eq('is_active', true)
      .order('title', { ascending: true })

    if (error) {
      console.error('[PromptSelector] Error fetching available prompts:', error)
      return []
    }

    return (data || []) as PromptIdea[]
  }

  /**
   * Reset the next_position for a mod to 1
   */
  static async resetPosition(moduleId: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabaseAdmin
      .from('prompt_modules')
      .update({
        next_position: 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', moduleId)

    if (error) {
      console.error('[PromptSelector] Error resetting position:', error)
      return { success: false, error: error.message }
    }

    console.log(`[PromptSelector] Reset position to 1 for mod ${moduleId}`)
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
      .from('prompt_modules')
      .update({
        next_position: position,
        updated_at: new Date().toISOString()
      })
      .eq('id', moduleId)

    if (error) {
      console.error('[PromptSelector] Error setting position:', error)
      return { success: false, error: error.message }
    }

    console.log(`[PromptSelector] Set position to ${position} for mod ${moduleId}`)
    return { success: true }
  }
}
