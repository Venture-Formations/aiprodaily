/**
 * Data Access Layer — Analytics Domain
 *
 * All reads that feed the analytics library go through here.
 * Every method requires publicationId for multi-tenant isolation.
 * Explicit column lists — no select('*').
 * Errors are logged, never thrown — callers receive null/empty on failure.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { loadExcludedIps, isClickCountable } from '@/lib/analytics/bot-policy'
import type {
  DeliveryCounts,
  IssueEngagement,
  ModuleEngagement,
  LinkClickRow,
} from '@/lib/analytics/types'

const log = createLogger({ module: 'dal:analytics' })

// Explicit column lists
const EMAIL_METRICS_COLUMNS = `
  issue_id,
  sent_count, delivered_count, opened_count, clicked_count,
  bounced_count, unsubscribed_count,
  open_rate, click_rate,
  imported_at
` as const

const LINK_CLICK_COLUMNS = `
  id, publication_id, issue_id, subscriber_email,
  link_url, link_section, ip_address, is_bot_ua
` as const

// ==================== READ OPERATIONS ====================

/**
 * Fetch delivery counts for an issue, verifying publication ownership
 * via a join on publication_issues.
 */
export async function getDeliveryCounts(args: {
  issueId: string
  publicationId: string
}): Promise<DeliveryCounts | null> {
  const { issueId, publicationId } = args

  try {
    const { data, error } = await supabaseAdmin
      .from('email_metrics')
      .select(`${EMAIL_METRICS_COLUMNS}, publication_issues!inner(publication_id)`)
      .eq('issue_id', issueId)
      .eq('publication_issues.publication_id', publicationId)
      .single()

    if (error || !data) {
      if (error) log.error({ err: error, issueId, publicationId }, 'getDeliveryCounts failed')
      return null
    }

    return {
      issueId: data.issue_id,
      sentCount: data.sent_count ?? 0,
      deliveredCount: data.delivered_count ?? 0,
      openedCount: data.opened_count ?? 0,
      clickedCount: data.clicked_count ?? 0,
      bouncedCount: data.bounced_count ?? 0,
      unsubscribedCount: data.unsubscribed_count ?? 0,
      espOpenRate: data.open_rate,
      espClickRate: data.click_rate,
      lastSyncedAt: data.imported_at ?? null,
    }
  } catch (err) {
    log.error({ err, issueId, publicationId }, 'getDeliveryCounts threw')
    return null
  }
}
