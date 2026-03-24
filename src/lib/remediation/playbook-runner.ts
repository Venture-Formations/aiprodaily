import { supabaseAdmin } from '@/lib/supabase'
import type { Logger } from 'pino'
import { remediateStuckWorkflow } from './playbooks/stuck-workflow'
import { remediateFeedDown, reactivateFeed } from './playbooks/rss-feed-down'
import { remediateRefusalSpike, clearFallbackModel } from './playbooks/ai-refusal-spike'
import { recordRateLimitHit, isCircuitOpen, closeCircuit } from './circuit-breaker'

export interface PlaybookResult {
  playbook: string
  action: string
  result: 'success' | 'failed' | 'skipped'
  details?: string
}

/**
 * PlaybookRunner orchestrates automated remediation playbooks.
 *
 * Each method:
 * 1. Runs the appropriate playbook
 * 2. Logs the outcome to remediation_log
 * 3. Returns a structured result
 */
export class PlaybookRunner {
  constructor(
    private publicationId: string,
    private logger: Logger
  ) {}

  /**
   * Attempt to recover a stuck workflow by resetting to the previous pending state.
   */
  async runStuckWorkflow(issueId: string, currentState: string, stuckMinutes: number): Promise<PlaybookResult> {
    const playbookName = 'stuck-workflow'
    const triggerCondition = `Issue stuck in "${currentState}" for ${stuckMinutes} minutes`

    try {
      const outcome = await remediateStuckWorkflow(issueId, currentState)

      const result: PlaybookResult = {
        playbook: playbookName,
        action: outcome.action === 'reset'
          ? `Reset ${currentState} → ${outcome.resetTo}`
          : `Skipped: ${outcome.reason}`,
        result: outcome.action === 'reset' ? 'success' : 'skipped',
        details: outcome.reason,
      }

      await this.logRemediation(result, triggerCondition, issueId)
      return result
    } catch (error) {
      const result: PlaybookResult = {
        playbook: playbookName,
        action: 'Error running playbook',
        result: 'failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      }
      await this.logRemediation(result, triggerCondition, issueId)
      return result
    }
  }

  /**
   * Record a MailerLite 429 and potentially trip the circuit breaker.
   */
  async runMailerLiteCircuitBreaker(): Promise<PlaybookResult> {
    const playbookName = 'mailerlite-circuit-breaker'
    const triggerCondition = 'MailerLite 429 rate-limit response'

    try {
      const { tripped } = await recordRateLimitHit()

      const result: PlaybookResult = {
        playbook: playbookName,
        action: tripped ? 'Circuit breaker tripped — pausing ML calls for 5 minutes' : 'Rate-limit hit recorded',
        result: tripped ? 'success' : 'skipped',
      }

      if (tripped) {
        this.logger.warn('[Remediation] MailerLite circuit breaker tripped')
        await this.logRemediation(result, triggerCondition)
      }

      return result
    } catch (error) {
      const result: PlaybookResult = {
        playbook: playbookName,
        action: 'Error running playbook',
        result: 'failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      }
      await this.logRemediation(result, triggerCondition)
      return result
    }
  }

  /**
   * Deactivate an RSS feed that has too many consecutive errors.
   */
  async runRSSFeedDown(feedId: string, errorCount: number): Promise<PlaybookResult> {
    const playbookName = 'rss-feed-down'
    const triggerCondition = `Feed ${feedId} has ${errorCount} consecutive errors`

    try {
      const outcome = await remediateFeedDown(feedId, errorCount)

      const result: PlaybookResult = {
        playbook: playbookName,
        action: outcome.action === 'deactivated'
          ? `Deactivated feed "${outcome.feedName}"`
          : `Skipped: ${outcome.reason}`,
        result: outcome.action === 'deactivated' ? 'success' : 'skipped',
        details: outcome.reason,
      }

      await this.logRemediation(result, triggerCondition)
      return result
    } catch (error) {
      const result: PlaybookResult = {
        playbook: playbookName,
        action: 'Error running playbook',
        result: 'failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      }
      await this.logRemediation(result, triggerCondition)
      return result
    }
  }

  /**
   * Activate fallback AI model when too many refusals detected in a workflow run.
   */
  async runAIRefusalSpike(issueId: string, refusalCount: number): Promise<PlaybookResult> {
    const playbookName = 'ai-refusal-spike'
    const triggerCondition = `${refusalCount} AI refusals in workflow for issue ${issueId}`

    try {
      const outcome = await remediateRefusalSpike(refusalCount, issueId)

      const result: PlaybookResult = {
        playbook: playbookName,
        action: outcome.action === 'fallback_activated'
          ? 'Fallback AI model activated'
          : `Skipped: ${outcome.reason}`,
        result: outcome.action === 'fallback_activated' ? 'success' : 'skipped',
        details: outcome.reason,
      }

      await this.logRemediation(result, triggerCondition, issueId)
      return result
    } catch (error) {
      const result: PlaybookResult = {
        playbook: playbookName,
        action: 'Error running playbook',
        result: 'failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      }
      await this.logRemediation(result, triggerCondition, issueId)
      return result
    }
  }

  /**
   * Log a remediation attempt to the remediation_log table.
   */
  private async logRemediation(
    result: PlaybookResult,
    triggerCondition: string,
    issueId?: string
  ): Promise<void> {
    try {
      await supabaseAdmin
        .from('remediation_log')
        .insert({
          publication_id: this.publicationId,
          issue_id: issueId ?? null,
          playbook_name: result.playbook,
          trigger_condition: triggerCondition,
          action_taken: result.action,
          result: result.result,
          context: { details: result.details },
        })

      this.logger.info(
        { playbook: result.playbook, result: result.result, action: result.action },
        `[Remediation] ${result.playbook}: ${result.result}`
      )
    } catch (error) {
      this.logger.error({ err: error }, '[Remediation] Failed to log remediation')
    }
  }
}

// Re-export utilities for direct use
export { isCircuitOpen, closeCircuit } from './circuit-breaker'
export { reactivateFeed } from './playbooks/rss-feed-down'
export { isFallbackModelActive, clearFallbackModel } from './playbooks/ai-refusal-spike'
