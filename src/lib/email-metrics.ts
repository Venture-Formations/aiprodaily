/**
 * Hybrid Email Metrics Service
 *
 * Orchestrates metrics import from both SendGrid (new campaigns)
 * and MailerLite (legacy campaigns).
 *
 * Priority:
 * 1. If sendgrid_singlesend_id exists → fetch from SendGrid
 * 2. Else if mailerlite_campaign_id exists → fetch from MailerLite
 * 3. Else → skip
 *
 * @see docs/migrations/SENDGRID_MIGRATION_PLAN.md
 */

import { supabaseAdmin } from './supabase'
import { SendGridService, type MetricsResult } from './sendgrid'
import { MailerLiteService } from './mailerlite'

export class EmailMetricsService {
  private sendgrid: SendGridService
  private mailerlite: MailerLiteService

  constructor() {
    this.sendgrid = new SendGridService()
    this.mailerlite = new MailerLiteService()
  }

  /**
   * Import metrics for an issue, automatically selecting the right provider
   */
  async importMetrics(issueId: string): Promise<MetricsResult> {
    try {
      // Fetch both campaign IDs
      // Note: MailerLite column is named mailerlite_issue_id (legacy naming)
      const { data: metrics, error } = await supabaseAdmin
        .from('email_metrics')
        .select('mailerlite_issue_id, sendgrid_singlesend_id')
        .eq('issue_id', issueId)
        .maybeSingle()

      if (error) {
        console.error(`[Metrics] Database error for issue ${issueId}:`, error)
        return { skipped: true, reason: `Database error: ${error.message}` }
      }

      if (!metrics) {
        return { skipped: true, reason: 'No email_metrics record found' }
      }

      // Priority 1: SendGrid (new campaigns)
      if (metrics.sendgrid_singlesend_id) {
        console.log(`[Metrics] Fetching from SendGrid for issue ${issueId}: ${metrics.sendgrid_singlesend_id}`)
        return await this.sendgrid.importCampaignMetrics(issueId, metrics.sendgrid_singlesend_id)
      }

      // Priority 2: MailerLite (legacy campaigns)
      if (metrics.mailerlite_issue_id) {
        console.log(`[Metrics] Fetching from MailerLite (legacy) for issue ${issueId}: ${metrics.mailerlite_issue_id}`)
        try {
          const result = await this.mailerlite.importissueMetrics(issueId)
          // MailerLite service returns the metrics object directly or throws
          return result as MetricsResult
        } catch (mlError: any) {
          // Handle skip indicators from MailerLite service
          if (mlError?.skipped) {
            return { skipped: true, reason: mlError.reason || 'MailerLite skip' }
          }
          throw mlError
        }
      }

      return { skipped: true, reason: 'No campaign ID found (neither SendGrid nor MailerLite)' }

    } catch (error) {
      console.error(`[Metrics] Error importing metrics for issue ${issueId}:`, error)
      return {
        skipped: true,
        reason: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Import metrics for all recent issues
   * Used by the import-metrics cron job
   */
  async importMetricsForRecentIssues(daysBack: number = 30): Promise<{
    processed: number
    successful: number
    skipped: number
    failed: number
    results: Array<{ issueId: string; status: string; details?: string }>
  }> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysBack)
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

    // Get all sent issues within the date range
    const { data: issues, error } = await supabaseAdmin
      .from('publication_issues')
      .select('id, date')
      .eq('status', 'sent')
      .gte('date', cutoffDateStr)
      .order('date', { ascending: false })

    if (error) {
      console.error('[Metrics] Error fetching issues:', error)
      return { processed: 0, successful: 0, skipped: 0, failed: 0, results: [] }
    }

    if (!issues || issues.length === 0) {
      console.log('[Metrics] No sent issues found in date range')
      return { processed: 0, successful: 0, skipped: 0, failed: 0, results: [] }
    }

    console.log(`[Metrics] Processing ${issues.length} issues from last ${daysBack} days`)

    const results: Array<{ issueId: string; status: string; details?: string }> = []
    let successful = 0
    let skipped = 0
    let failed = 0

    for (const issue of issues) {
      try {
        const result = await this.importMetrics(issue.id)

        if (result.skipped) {
          skipped++
          results.push({ issueId: issue.id, status: 'skipped', details: result.reason })
        } else {
          successful++
          results.push({ issueId: issue.id, status: 'success' })
        }
      } catch (err) {
        failed++
        results.push({
          issueId: issue.id,
          status: 'failed',
          details: err instanceof Error ? err.message : 'Unknown error'
        })
      }
    }

    console.log(`[Metrics] Completed: ${successful} successful, ${skipped} skipped, ${failed} failed`)

    return {
      processed: issues.length,
      successful,
      skipped,
      failed,
      results
    }
  }

  /**
   * Get provider info for an issue (for debugging)
   */
  async getProviderInfo(issueId: string): Promise<{
    provider: 'sendgrid' | 'mailerlite' | 'none'
    campaignId: string | null
  }> {
    const { data: metrics } = await supabaseAdmin
      .from('email_metrics')
      .select('mailerlite_issue_id, sendgrid_singlesend_id')
      .eq('issue_id', issueId)
      .maybeSingle()

    if (!metrics) {
      return { provider: 'none', campaignId: null }
    }

    if (metrics.sendgrid_singlesend_id) {
      return { provider: 'sendgrid', campaignId: metrics.sendgrid_singlesend_id }
    }

    if (metrics.mailerlite_issue_id) {
      return { provider: 'mailerlite', campaignId: metrics.mailerlite_issue_id }
    }

    return { provider: 'none', campaignId: null }
  }
}

// Export singleton instance for convenience
export const emailMetricsService = new EmailMetricsService()
