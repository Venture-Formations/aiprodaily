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

/**
 * Count unique clickers for an issue (optionally filtered to a single link).
 * Applies bot and IP filtering in SQL where possible; CIDR matches applied in-app.
 *
 * "Unique clicker" = distinct subscriber_email for rows passing isClickCountable.
 */
export async function getUniqueClickers(args: {
  issueId: string
  publicationId: string
  linkUrl?: string
  excludeBots?: boolean
}): Promise<number> {
  const { issueId, publicationId, linkUrl, excludeBots = true } = args

  try {
    let query = supabaseAdmin
      .from('link_clicks')
      .select(LINK_CLICK_COLUMNS)
      .eq('publication_id', publicationId)
      .eq('issue_id', issueId)

    if (linkUrl) query = query.eq('link_url', linkUrl)

    // .is('is_bot_ua', false) matches IS FALSE only; NULL rows pass through
    // intentionally — historical rows pre-dating the bot flag are not bots.
    if (excludeBots) query = query.is('is_bot_ua', false)

    const { data, error } = await query

    if (error || !data) {
      if (error) log.error({ err: error, issueId, publicationId }, 'getUniqueClickers failed')
      return 0
    }

    if (!excludeBots) {
      return countUniqueEmails(data as LinkClickRow[])
    }

    // Apply in-app IP + CIDR filter, then count uniques.
    const excludedIps = await loadExcludedIps(publicationId)
    const countable = (data as LinkClickRow[]).filter((row) =>
      isClickCountable(row, excludedIps)
    )
    return countUniqueEmails(countable)
  } catch (err) {
    log.error({ err, issueId, publicationId }, 'getUniqueClickers threw')
    return 0
  }
}

function countUniqueEmails(rows: LinkClickRow[]): number {
  const set = new Set<string>()
  for (const row of rows) set.add(row.subscriber_email.toLowerCase())
  return set.size
}

/**
 * Single-query loader returning the bot/IP-filtered link_clicks rows
 * for an issue (optionally narrowed to a single link_section for module-scoped reads).
 *
 * Used by getIssueEngagement / getModuleEngagement to avoid duplicate fetches
 * when both totals and uniques are needed.
 *
 * Standalone callers (getTotalClicks, getUniqueClickers) keep their own
 * fetch path so each can be called independently from API routes.
 */
async function loadCountableLinkClicks(args: {
  issueId: string
  publicationId: string
  linkSection?: string
  excludeBots: boolean
}): Promise<LinkClickRow[]> {
  const { issueId, publicationId, linkSection, excludeBots } = args

  try {
    let query = supabaseAdmin
      .from('link_clicks')
      .select(LINK_CLICK_COLUMNS)
      .eq('publication_id', publicationId)
      .eq('issue_id', issueId)

    if (linkSection) query = query.eq('link_section', linkSection)
    // .is('is_bot_ua', false) matches IS FALSE only; NULL rows pass through
    // intentionally — historical rows pre-dating the bot flag are not bots.
    if (excludeBots) query = query.is('is_bot_ua', false)

    const { data, error } = await query
    if (error || !data) {
      if (error) log.error({ err: error, issueId, publicationId, linkSection }, 'loadCountableLinkClicks failed')
      return []
    }

    if (!excludeBots) return data as LinkClickRow[]

    const excludedIps = await loadExcludedIps(publicationId)
    return (data as LinkClickRow[]).filter((row) =>
      isClickCountable(row, excludedIps)
    )
  } catch (err) {
    log.error({ err, issueId, publicationId, linkSection }, 'loadCountableLinkClicks threw')
    return []
  }
}

/**
 * Total raw click count for an issue (pre-dedup). Bot/IP filter applied
 * when excludeBots is true; no uniqueness reduction.
 */
async function getTotalClicks(args: {
  issueId: string
  publicationId: string
  excludeBots: boolean
}): Promise<number> {
  const { issueId, publicationId, excludeBots } = args

  try {
    let query = supabaseAdmin
      .from('link_clicks')
      .select(LINK_CLICK_COLUMNS)
      .eq('publication_id', publicationId)
      .eq('issue_id', issueId)

    // .is('is_bot_ua', false) matches IS FALSE only; NULL rows pass through
    // intentionally — historical rows pre-dating the bot flag are not bots.
    if (excludeBots) query = query.is('is_bot_ua', false)

    const { data, error } = await query
    if (error || !data) {
      if (error) log.error({ err: error, issueId, publicationId }, 'getTotalClicks failed')
      return 0
    }

    if (!excludeBots) return data.length

    const excludedIps = await loadExcludedIps(publicationId)
    return (data as LinkClickRow[]).filter((row) =>
      isClickCountable(row, excludedIps)
    ).length
  } catch (err) {
    log.error({ err, issueId, publicationId }, 'getTotalClicks threw')
    return 0
  }
}

/**
 * Aggregate engagement for an issue: delivery counts + total clicks + unique clickers.
 * Returns null if delivery counts cannot be loaded (issue/publication mismatch or DB error).
 *
 * Uses a single link_clicks fetch to derive both total and unique counts;
 * standalone getTotalClicks / getUniqueClickers can still be called from
 * routes that need only one of those counts.
 */
export async function getIssueEngagement(args: {
  issueId: string
  publicationId: string
  excludeBots?: boolean
}): Promise<IssueEngagement | null> {
  const { issueId, publicationId, excludeBots = true } = args

  const delivery = await getDeliveryCounts({ issueId, publicationId })
  if (!delivery) return null

  const rows = await loadCountableLinkClicks({ issueId, publicationId, excludeBots })

  return {
    issueId,
    publicationId,
    totalClicks: rows.length,
    uniqueClickers: countUniqueEmails(rows),
    delivery,
  }
}

/**
 * Aggregate engagement for a module within an issue.
 *
 * Module scope is defined by linkSection (e.g., 'Ads', 'AI Apps', 'Articles').
 * Numbers are narrowed to clicks with that link_section.
 *
 * moduleRecipients defaults to delivery.deliveredCount for non-segmented modules.
 * For segmented modules (an ad shown to a subset), callers pass the explicit
 * recipient count from the per-issue module-assignment table.
 *
 * Uses a single link_clicks fetch (via loadCountableLinkClicks) to derive
 * both total and unique counts for the module.
 */
export async function getModuleEngagement(args: {
  moduleId: string
  issueId: string
  publicationId: string
  linkSection: string
  moduleRecipients?: number
  excludeBots?: boolean
}): Promise<ModuleEngagement | null> {
  const {
    moduleId,
    issueId,
    publicationId,
    linkSection,
    moduleRecipients,
    excludeBots = true,
  } = args

  const delivery = await getDeliveryCounts({ issueId, publicationId })
  if (!delivery) return null

  const rows = await loadCountableLinkClicks({
    issueId,
    publicationId,
    linkSection,
    excludeBots,
  })

  return {
    moduleId,
    issueId,
    publicationId,
    totalClicks: rows.length,
    uniqueClickers: countUniqueEmails(rows),
    moduleRecipients: moduleRecipients ?? delivery.deliveredCount,
  }
}
