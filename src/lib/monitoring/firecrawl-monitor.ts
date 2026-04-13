import { supabaseAdmin } from '../supabase'
import { SlackNotificationService } from '../slack'
import type { ArticleExtractionResult } from '../article-extractor'

const LOG_SOURCE = 'firecrawl_monitor'
const ALERT_COOLDOWN_MINUTES = 60

/**
 * Scans extraction results for Firecrawl HTTP 402 (Payment Required) errors
 * and sends a debounced Slack alert.
 *
 * Debounced via system_logs: alerts at most once per ALERT_COOLDOWN_MINUTES
 * window. Callers should invoke this after every extractBatch() — cost of
 * a no-op call (no 402s) is a single SELECT.
 */
export async function alertOnFirecrawl402(
  results: Map<string, ArticleExtractionResult>,
  context?: { feedName?: string }
): Promise<void> {
  let errorCount = 0
  results.forEach(result => {
    if (!result.success && result.error?.includes('Firecrawl HTTP 402')) {
      errorCount++
    }
  })

  if (errorCount === 0) return

  try {
    const cooldownCutoff = new Date(Date.now() - ALERT_COOLDOWN_MINUTES * 60 * 1000).toISOString()
    const { data: recent } = await supabaseAdmin
      .from('system_logs')
      .select('id')
      .eq('source', LOG_SOURCE)
      .eq('level', 'error')
      .gte('timestamp', cooldownCutoff)
      .limit(1)

    if (recent && recent.length > 0) {
      return
    }

    const feedLabel = context?.feedName ? ` (feed: ${context.feedName})` : ''
    const message =
      `Firecrawl quota exhausted — HTTP 402 on ${errorCount} URL${errorCount === 1 ? '' : 's'}${feedLabel}. ` +
      `Top up credits at https://www.firecrawl.dev/app/billing. ` +
      `Article extraction success rate will stay degraded until resolved.`

    const slack = new SlackNotificationService()
    await slack.sendAlert(message, 'error', 'system_errors')

    await supabaseAdmin
      .from('system_logs')
      .insert([{
        level: 'error',
        message,
        source: LOG_SOURCE,
        context: { errorCount, feedName: context?.feedName ?? null },
        timestamp: new Date().toISOString(),
      }])
  } catch (err) {
    console.error(
      '[firecrawl-monitor] Failed to send 402 alert:',
      err instanceof Error ? err.message : 'Unknown'
    )
  }
}
