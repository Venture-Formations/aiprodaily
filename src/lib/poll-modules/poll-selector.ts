/**
 * Poll Module Selector
 *
 * Handles poll selection for poll modules.
 * Unlike ad modules, poll modules only support manual selection.
 */

import { supabaseAdmin } from '../supabase'
import type { PollModule, Poll, IssuePollModule, PollSnapshot } from '@/types/database'

export class PollModuleSelector {
  /**
   * Initialize selections for all active poll modules
   * Uses the current active poll for the publication
   * Falls back to last used poll only if it's still active
   * Called during issue creation workflow
   */
  static async initializeSelectionsForIssue(
    issueId: string,
    publicationId: string
  ): Promise<void> {
    // Check if selections already exist
    const { data: existing } = await supabaseAdmin
      .from('issue_poll_modules')
      .select('poll_module_id')
      .eq('issue_id', issueId)

    if (existing && existing.length > 0) {
      console.log('[PollSelector] Selections already exist for issue:', issueId)
      return
    }

    // Get all active poll modules
    const { data: modules, error } = await supabaseAdmin
      .from('poll_modules')
      .select('*')
      .eq('publication_id', publicationId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error || !modules || modules.length === 0) {
      console.log('[PollSelector] No active poll modules found')
      return
    }

    // Get the current active poll for this publication
    const { data: activePoll } = await supabaseAdmin
      .from('polls')
      .select('id')
      .eq('publication_id', publicationId)
      .eq('is_active', true)
      .limit(1)
      .single()

    const activePollId = activePoll?.id || null

    // For each mod, use the current active poll (or fall back to last used if still active)
    for (const mod of modules) {
      let selectedPollId = activePollId

      // If no active poll, check if the last used poll is still valid
      if (!selectedPollId) {
        const { data: lastSelection } = await supabaseAdmin
          .from('issue_poll_modules')
          .select('poll_id, poll:polls!inner(is_active)')
          .eq('poll_module_id', mod.id)
          .not('poll_id', 'is', null)
          .order('selected_at', { ascending: false })
          .limit(1)
          .single()

        // Only use last poll if it's still active
        if (lastSelection?.poll && (lastSelection.poll as any).is_active) {
          selectedPollId = lastSelection.poll_id
        }
      }

      const { error: insertError } = await supabaseAdmin
        .from('issue_poll_modules')
        .insert({
          issue_id: issueId,
          poll_module_id: mod.id,
          poll_id: selectedPollId,
          selected_at: selectedPollId ? new Date().toISOString() : null
        })

      if (insertError) {
        console.error('[PollSelector] Error creating selection:', insertError)
      } else if (selectedPollId) {
        console.log(`[PollSelector] Selected active poll ${selectedPollId} for mod ${mod.name}`)
      }
    }

    console.log(`[PollSelector] Initialized ${modules.length} poll mod selections for issue ${issueId}`)
  }

  /**
   * Clear poll selection for a mod (set to No Poll)
   */
  static async clearPollSelection(
    issueId: string,
    moduleId: string
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabaseAdmin
      .from('issue_poll_modules')
      .upsert({
        issue_id: issueId,
        poll_module_id: moduleId,
        poll_id: null,
        selected_at: new Date().toISOString()
      }, {
        onConflict: 'issue_id,poll_module_id'
      })

    if (error) {
      console.error('[PollSelector] Error clearing selection:', error)
      return { success: false, error: error.message }
    }

    console.log(`[PollSelector] Cleared poll for issue ${issueId}, mod ${moduleId}`)
    return { success: true }
  }

  /**
   * Manually select a poll for a mod
   */
  static async manuallySelectPoll(
    issueId: string,
    moduleId: string,
    pollId: string
  ): Promise<{ success: boolean; error?: string }> {
    // Verify the poll exists and is for the right publication
    const { data: poll } = await supabaseAdmin
      .from('polls')
      .select('id, publication_id')
      .eq('id', pollId)
      .single()

    if (!poll) {
      return { success: false, error: 'Poll not found' }
    }

    // Verify the mod exists and belongs to same publication
    const { data: mod } = await supabaseAdmin
      .from('poll_modules')
      .select('id, publication_id')
      .eq('id', moduleId)
      .single()

    if (!mod || mod.publication_id !== poll.publication_id) {
      return { success: false, error: 'Module and poll publication mismatch' }
    }

    // Upsert the selection
    const { error } = await supabaseAdmin
      .from('issue_poll_modules')
      .upsert({
        issue_id: issueId,
        poll_module_id: moduleId,
        poll_id: pollId,
        selected_at: new Date().toISOString()
      }, {
        onConflict: 'issue_id,poll_module_id'
      })

    if (error) {
      console.error('[PollSelector] Error manual selection:', error)
      return { success: false, error: error.message }
    }

    console.log(`[PollSelector] Manual selection: issue ${issueId}, mod ${moduleId}, poll ${pollId}`)
    return { success: true }
  }

  /**
   * Get poll selections for an issue with poll and mod details
   */
  static async getIssuePollSelections(issueId: string): Promise<IssuePollModule[]> {
    // First get the selections
    const { data: selections, error } = await supabaseAdmin
      .from('issue_poll_modules')
      .select('*')
      .eq('issue_id', issueId)

    if (error || !selections) {
      console.error('[PollSelector] Error fetching selections:', error)
      return []
    }

    // Get all related mod IDs and poll IDs
    const moduleIds = selections.map(s => s.poll_module_id).filter(Boolean)
    const pollIds = selections.filter(s => s.poll_id).map(s => s.poll_id)

    // Fetch modules
    let modulesMap = new Map<string, PollModule>()
    if (moduleIds.length > 0) {
      const { data: modules } = await supabaseAdmin
        .from('poll_modules')
        .select('*')
        .in('id', moduleIds)
        .order('display_order', { ascending: true })

      if (modules) {
        modulesMap = new Map(modules.map(m => [m.id, m]))
      }
    }

    // Fetch polls
    let pollsMap = new Map<string, Poll>()
    if (pollIds.length > 0) {
      const { data: polls } = await supabaseAdmin
        .from('polls')
        .select('*')
        .in('id', pollIds)

      if (polls) {
        pollsMap = new Map(polls.map(p => [p.id, p]))
      }
    }

    // Combine selections with related data
    const result = selections.map(s => ({
      ...s,
      poll_module: s.poll_module_id ? modulesMap.get(s.poll_module_id) : undefined,
      poll: s.poll_id ? pollsMap.get(s.poll_id) : undefined
    }))

    // Sort by mod display_order
    result.sort((a, b) => {
      const orderA = a.poll_module?.display_order ?? 0
      const orderB = b.poll_module?.display_order ?? 0
      return orderA - orderB
    })

    return result
  }

  /**
   * Record poll usage at send time
   * Stores snapshot and sets used_at timestamp
   */
  static async recordUsage(issueId: string): Promise<{ success: boolean; recorded: number }> {
    // Get selections that haven't been used yet
    const { data: selections, error } = await supabaseAdmin
      .from('issue_poll_modules')
      .select('*, poll:polls(*)')
      .eq('issue_id', issueId)
      .is('used_at', null)

    if (error || !selections) {
      console.error('[PollSelector] Error fetching selections for usage:', error)
      return { success: false, recorded: 0 }
    }

    let recorded = 0

    for (const selection of selections) {
      if (!selection.poll_id || !selection.poll) continue

      const poll = selection.poll as Poll

      // Skip inactive polls - they may have been deactivated after issue creation
      if (!poll.is_active) {
        console.warn(`[PollSelector] Skipping inactive poll ${poll.id} for issue ${issueId}`)
        continue
      }

      // Create snapshot
      const snapshot: PollSnapshot = {
        id: poll.id,
        title: poll.title,
        question: poll.question,
        options: poll.options,
        image_url: poll.image_url
      }

      // Update selection with snapshot and used_at
      const { error: updateError } = await supabaseAdmin
        .from('issue_poll_modules')
        .update({
          poll_snapshot: snapshot,
          used_at: new Date().toISOString()
        })
        .eq('id', selection.id)

      if (updateError) {
        console.error('[PollSelector] Error recording usage:', updateError)
      } else {
        recorded++
      }
    }

    console.log(`[PollSelector] Recorded usage for ${recorded} poll selections`)
    return { success: true, recorded }
  }

  /**
   * Get all active polls for a publication (for manual selection dropdown)
   */
  static async getAvailablePolls(publicationId: string): Promise<Poll[]> {
    const { data: polls, error } = await supabaseAdmin
      .from('polls')
      .select('*')
      .eq('publication_id', publicationId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[PollSelector] Error fetching available polls:', error)
      return []
    }

    return polls || []
  }
}
