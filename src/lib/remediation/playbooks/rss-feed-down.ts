import { supabaseAdmin } from '@/lib/supabase'

/**
 * RSS Feed Down Playbook
 *
 * When an RSS feed accumulates 5+ consecutive processing errors,
 * auto-deactivate it to prevent wasting resources on broken feeds.
 * The feed can be manually re-checked or auto-reactivated on next success.
 */

const ERROR_THRESHOLD = 5

export interface FeedDownResult {
  action: 'deactivated' | 'skipped' | 'reactivated'
  reason?: string
  feedId?: string
  feedName?: string
  errorCount?: number
}

/**
 * Deactivate a feed that has exceeded the error threshold.
 */
export async function remediateFeedDown(
  feedId: string,
  errorCount: number
): Promise<FeedDownResult> {
  if (errorCount < ERROR_THRESHOLD) {
    return { action: 'skipped', reason: `Error count ${errorCount} below threshold ${ERROR_THRESHOLD}` }
  }

  // Fetch feed details (only if still active)
  const { data: feed, error: fetchError } = await supabaseAdmin
    .from('rss_feeds')
    .select('id, name, active, publication_id')
    .eq('id', feedId)
    .single()

  if (fetchError || !feed) {
    return { action: 'skipped', reason: `Could not fetch feed: ${fetchError?.message}` }
  }

  if (!feed.active) {
    return { action: 'skipped', reason: 'Feed already deactivated' }
  }

  // Deactivate
  const { error: updateError } = await supabaseAdmin
    .from('rss_feeds')
    .update({ active: false })
    .eq('id', feedId)

  if (updateError) {
    return { action: 'skipped', reason: `Update failed: ${updateError.message}` }
  }

  console.log(`[Remediation] Feed deactivated: "${feed.name}" (${feedId}) after ${errorCount} errors`)

  return {
    action: 'deactivated',
    feedId,
    feedName: feed.name,
    errorCount,
  }
}

/**
 * Reactivate a feed and reset its error counters.
 * Called after a successful manual re-check.
 */
export async function reactivateFeed(feedId: string): Promise<FeedDownResult> {
  const { data: feed, error: fetchError } = await supabaseAdmin
    .from('rss_feeds')
    .select('id, name, active')
    .eq('id', feedId)
    .single()

  if (fetchError || !feed) {
    return { action: 'skipped', reason: `Could not fetch feed: ${fetchError?.message}` }
  }

  if (feed.active) {
    return { action: 'skipped', reason: 'Feed already active' }
  }

  const { error: updateError } = await supabaseAdmin
    .from('rss_feeds')
    .update({
      active: true,
      processing_errors: 0,
      last_error: null,
    })
    .eq('id', feedId)

  if (updateError) {
    return { action: 'skipped', reason: `Update failed: ${updateError.message}` }
  }

  console.log(`[Remediation] Feed reactivated: "${feed.name}" (${feedId})`)

  return { action: 'reactivated', feedId, feedName: feed.name }
}
