import { supabaseAdmin } from '@/lib/supabase'
import type { WorkflowState } from '@/types/workflow-states'

/**
 * Stuck Workflow Playbook
 *
 * When an issue is stuck in an active state (archiving, fetching_feeds, etc.)
 * for >15 minutes, reset it to the previous pending_* state so the coordinator
 * can re-trigger the step.
 *
 * Guardrails:
 * - Max 1 auto-retry per issue (checked via auto_retry_count)
 * - Only resets active states, not pending or terminal states
 */

/** Maps each active state back to its preceding pending state */
const RESET_MAP: Record<string, WorkflowState> = {
  archiving: 'pending_archive',
  fetching_feeds: 'pending_fetch_feeds',
  extracting: 'pending_extract',
  scoring: 'pending_score',
  generating: 'pending_generate',
  finalizing: 'pending_finalize',
}

export interface StuckWorkflowResult {
  action: 'reset' | 'skipped'
  reason?: string
  previousState?: string
  resetTo?: string
}

export async function remediateStuckWorkflow(
  issueId: string,
  currentState: string
): Promise<StuckWorkflowResult> {
  const resetTo = RESET_MAP[currentState]
  if (!resetTo) {
    return { action: 'skipped', reason: `State "${currentState}" is not an active state` }
  }

  // Check if we've already retried this issue
  const { data: issue, error: fetchError } = await supabaseAdmin
    .from('publication_issues')
    .select('id, auto_retry_count, workflow_state')
    .eq('id', issueId)
    .single()

  if (fetchError || !issue) {
    return { action: 'skipped', reason: `Could not fetch issue: ${fetchError?.message}` }
  }

  if ((issue.auto_retry_count ?? 0) >= 1) {
    return { action: 'skipped', reason: 'Max auto-retries (1) already reached' }
  }

  // Verify the issue is still in the expected state (race condition guard)
  if (issue.workflow_state !== currentState) {
    return { action: 'skipped', reason: `State changed to "${issue.workflow_state}" before remediation` }
  }

  // Reset to previous pending state and increment retry count
  const { error: updateError } = await supabaseAdmin
    .from('publication_issues')
    .update({
      workflow_state: resetTo,
      workflow_state_started_at: new Date().toISOString(),
      workflow_error: null,
      auto_retry_count: (issue.auto_retry_count ?? 0) + 1,
    })
    .eq('id', issueId)
    .eq('workflow_state', currentState) // Atomic: only if still stuck

  if (updateError) {
    return { action: 'skipped', reason: `Update failed: ${updateError.message}` }
  }

  console.log(`[Remediation] Stuck workflow reset: ${issueId} ${currentState} → ${resetTo}`)

  return {
    action: 'reset',
    previousState: currentState,
    resetTo,
  }
}
