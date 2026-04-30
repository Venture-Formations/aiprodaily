import { NextResponse } from 'next/server'
import { withApiHandler } from '@/lib/api-handler'
import type { Logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase'
import { getPublicationSetting, getEmailProviderSettings } from '@/lib/publication-settings'
import { getBeehiivSubscriberStats } from '@/lib/beehiiv'
import {
  fireMakeWebhook,
  markMakeWebhookExpired,
  markMakeWebhookFired,
  recordPollAttempt,
} from '@/lib/sparkloop-client'

const BATCH_SIZE = 500
const CONCURRENCY = 5
const POLL_ATTEMPTS_EXPIRE_THRESHOLD = 168 // ~7 days at hourly cadence

interface PendingRow {
  id: string
  subscriber_email: string
  subscriber_id: string
  source: 'sparkloop' | 'afteroffers'
  poll_attempts: number
}

interface PerPubSummary {
  pubId: string
  checked: number
  fired: number
  expired: number
  skipped: number
  durationMs: number
}

const handler = withApiHandler(
  { authTier: 'system', logContext: 'check-pending-webhooks' },
  async ({ logger }) => {
    const startedAt = Date.now()

    const { data: pubs, error: pubsErr } = await supabaseAdmin
      .from('publications')
      .select('id')
      .eq('is_active', true)
    if (pubsErr) {
      throw new Error(`Failed to load publications: ${pubsErr.message}`)
    }

    const summaries: PerPubSummary[] = []
    for (const pub of pubs || []) {
      const summary = await processPublication(pub.id, logger)
      if (summary) summaries.push(summary)
    }

    return NextResponse.json({
      success: true,
      durationMs: Date.now() - startedAt,
      publicationsChecked: summaries.length,
      summaries,
    })
  }
)

async function processPublication(pubId: string, logger: Logger): Promise<PerPubSummary | null> {
  const requireFirstOpen = await getPublicationSetting(pubId, 'make_webhook_require_first_open')
  if (requireFirstOpen !== 'true') return null

  const provider = await getEmailProviderSettings(pubId)
  if (provider.provider !== 'beehiiv') return null

  const beehiivPubId = provider.beehiivPublicationId
  const beehiivApiKey = provider.beehiivApiKey
  const webhookUrl = await getPublicationSetting(pubId, 'sparkloop_webhook_url')

  if (!beehiivPubId || !beehiivApiKey || !webhookUrl) {
    logger.warn({ pubId }, '[CheckPendingWebhooks] Missing Beehiiv credentials or webhook URL; skipping publication')
    return null
  }

  const startedAt = Date.now()
  const { data: rows, error } = await supabaseAdmin
    .from('make_webhook_fires')
    .select('id, subscriber_email, subscriber_id, source, poll_attempts')
    .eq('publication_id', pubId)
    .eq('status', 'pending')
    .order('last_polled_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)
  if (error) {
    logger.error({ pubId, err: error.message }, '[CheckPendingWebhooks] Failed to load pending rows')
    return null
  }

  const summary: PerPubSummary = {
    pubId,
    checked: 0,
    fired: 0,
    expired: 0,
    skipped: 0,
    durationMs: 0,
  }
  if (!rows || rows.length === 0) {
    summary.durationMs = Date.now() - startedAt
    return summary
  }

  let bail = false
  const queue = [...(rows as PendingRow[])]
  await Promise.all(
    Array.from({ length: CONCURRENCY }).map(async () => {
      while (!bail && queue.length > 0) {
        const row = queue.shift()!
        const outcome = await processRow({ row, pubId, beehiivPubId, beehiivApiKey, webhookUrl })
        summary.checked += 1
        if (outcome === 'fired') summary.fired += 1
        else if (outcome === 'expired') summary.expired += 1
        else if (outcome === 'skipped') summary.skipped += 1
        else if (outcome === 'rate_limited') {
          bail = true
          summary.skipped += 1
        }
      }
    })
  )

  summary.durationMs = Date.now() - startedAt
  logger.info(
    {
      pubId,
      checked: summary.checked,
      fired: summary.fired,
      expired: summary.expired,
      skipped: summary.skipped,
      rateLimited: bail,
      durationMs: summary.durationMs,
    },
    '[CheckPendingWebhooks] Per-publication summary'
  )
  return summary
}

type RowOutcome = 'fired' | 'expired' | 'skipped' | 'pending' | 'rate_limited'

async function processRow(args: {
  row: PendingRow
  pubId: string
  beehiivPubId: string
  beehiivApiKey: string
  webhookUrl: string
}): Promise<RowOutcome> {
  const { row, pubId, beehiivPubId, beehiivApiKey, webhookUrl } = args
  const stats = await getBeehiivSubscriberStats(row.subscriber_email, beehiivPubId, beehiivApiKey)

  if (stats.rateLimited) {
    // Don't increment poll_attempts — rate limit is transient, not the subscriber's fault.
    return 'rate_limited'
  }
  if (!stats.found) {
    if (stats.error) {
      // Transient API error (5xx, network). Skip without consuming a poll attempt.
      return 'skipped'
    }
    if (row.poll_attempts + 1 >= POLL_ATTEMPTS_EXPIRE_THRESHOLD) {
      await markMakeWebhookExpired(row.id, 'not_found')
      return 'expired'
    }
    await recordPollAttempt(row.id, row.poll_attempts)
    return 'pending'
  }

  const opens = stats.uniqueOpens || 0
  if (opens > 0) {
    const marked = await markMakeWebhookFired(row.id)
    if (!marked) {
      // DB update failed; do NOT fire — row stays pending and will be
      // retried next hour. Preserves at-most-once delivery.
      return 'skipped'
    }
    await fireMakeWebhook(
      webhookUrl,
      { subscriber_email: row.subscriber_email, subscriber_id: row.subscriber_id },
      { publicationId: pubId }
    )
    return 'fired'
  }

  const status = stats.status
  if (status === 'unsubscribed' || status === 'inactive' || status === 'deleted') {
    await markMakeWebhookExpired(row.id, status)
    return 'expired'
  }
  if (status === 'pending') {
    if (row.poll_attempts + 1 >= POLL_ATTEMPTS_EXPIRE_THRESHOLD) {
      await markMakeWebhookExpired(row.id, 'unconfirmed')
      return 'expired'
    }
  }

  // Active subscriber with no opens yet, or any unknown future Beehiiv status: keep polling.
  await recordPollAttempt(row.id, row.poll_attempts)
  return 'pending'
}

export const GET = handler
export const POST = handler
export const maxDuration = 300
