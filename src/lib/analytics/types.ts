/**
 * Type definitions for the analytics metrics library.
 * Shared between pure formulas (metrics.ts), bot policy (bot-policy.ts),
 * and the DAL (src/lib/dal/analytics.ts).
 */

/**
 * Email delivery counts sourced from email_metrics.
 * Denominator for issue-level rates.
 */
export interface DeliveryCounts {
  issueId: string
  sentCount: number
  deliveredCount: number
  openedCount: number
  clickedCount: number
  bouncedCount: number
  unsubscribedCount: number
  /** ESP-reported open rate; displayed separately from computed open rate. */
  espOpenRate: number | null
  /** ESP-reported click rate; displayed separately from computed click rate. */
  espClickRate: number | null
  /** Timestamp of last sync from ESP. null for legacy rows. */
  lastSyncedAt: string | null
}

/**
 * Aggregated click/engagement metrics for a single issue.
 * Always derived from link_clicks; bot/IP filter applied per excludeBots flag.
 */
export interface IssueEngagement {
  issueId: string
  publicationId: string
  totalClicks: number
  uniqueClickers: number
  delivery: DeliveryCounts
}

/**
 * Aggregated click metrics for a single module within an issue.
 * moduleRecipients defaults to delivery.deliveredCount for non-segmented modules.
 */
export interface ModuleEngagement {
  moduleId: string
  issueId: string
  publicationId: string
  totalClicks: number
  uniqueClickers: number
  moduleRecipients: number
}

/** Columns on link_clicks used by bot policy and DAL reads. */
export interface LinkClickRow {
  id: string
  publication_id: string
  issue_id: string | null
  subscriber_email: string
  link_url: string
  link_section: string
  ip_address: string | null
  is_bot_ua: boolean | null
}

/** Columns on excluded_ips used by bot policy. */
export interface ExcludedIpRow {
  ip_address: string
  is_range: boolean
  cidr_prefix: number | null
}
