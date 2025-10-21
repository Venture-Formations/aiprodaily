import { supabaseAdmin } from './supabase'
import { WorkflowState, STATE_TRANSITIONS } from '@/types/workflow-states'

/**
 * Workflow State Manager
 *
 * Handles state transitions for RSS processing workflow
 * Includes race condition prevention and error handling
 */

/**
 * Start a workflow step - sets state to "in progress" variant
 * Returns false if another process already started this step (race condition)
 */
export async function startWorkflowStep(
  campaignId: string,
  currentState: WorkflowState
): Promise<{ success: boolean; message?: string }> {
  try {
    // Atomic update: only transition if state is still in "pending_*" state
    const { data, error } = await supabaseAdmin
      .from('newsletter_campaigns')
      .update({
        workflow_state: STATE_TRANSITIONS[currentState],
        workflow_state_started_at: new Date().toISOString()
      })
      .eq('id', campaignId)
      .eq('workflow_state', currentState) // Only update if still in expected state
      .select('workflow_state')
      .single()

    if (error) {
      console.error(`Failed to start workflow step ${currentState}:`, error)
      return { success: false, message: error.message }
    }

    if (!data) {
      // State was already changed by another process (race condition)
      return {
        success: false,
        message: 'Step already in progress or completed by another process'
      }
    }

    console.log(`[Workflow] Campaign ${campaignId}: ${currentState} → ${STATE_TRANSITIONS[currentState]}`)
    return { success: true }

  } catch (error) {
    console.error('Failed to start workflow step:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Complete a workflow step - transitions to next "pending_*" state
 */
export async function completeWorkflowStep(
  campaignId: string,
  currentState: WorkflowState
): Promise<{ success: boolean; message?: string }> {
  try {
    const nextState = STATE_TRANSITIONS[currentState]

    const { error } = await supabaseAdmin
      .from('newsletter_campaigns')
      .update({
        workflow_state: nextState,
        workflow_state_started_at: new Date().toISOString(),
        workflow_error: null // Clear any previous errors
      })
      .eq('id', campaignId)

    if (error) {
      console.error(`Failed to complete workflow step ${currentState}:`, error)
      return { success: false, message: error.message }
    }

    console.log(`[Workflow] Campaign ${campaignId}: ${currentState} → ${nextState}`)
    return { success: true }

  } catch (error) {
    console.error('Failed to complete workflow step:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Mark workflow as failed
 */
export async function failWorkflow(
  campaignId: string,
  error: string
): Promise<void> {
  try {
    await supabaseAdmin
      .from('newsletter_campaigns')
      .update({
        workflow_state: 'failed',
        workflow_error: error.substring(0, 500), // Limit error message length
        status: 'failed'
      })
      .eq('id', campaignId)

    console.error(`[Workflow] Campaign ${campaignId} failed:`, error)

  } catch (updateError) {
    console.error('Failed to mark workflow as failed:', updateError)
  }
}

/**
 * Get current workflow state for a campaign
 */
export async function getWorkflowState(
  campaignId: string
): Promise<WorkflowState | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('newsletter_campaigns')
      .select('workflow_state')
      .eq('id', campaignId)
      .single()

    if (error || !data) {
      return null
    }

    return data.workflow_state as WorkflowState

  } catch (error) {
    console.error('Failed to get workflow state:', error)
    return null
  }
}
