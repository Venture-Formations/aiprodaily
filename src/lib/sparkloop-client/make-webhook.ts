/**
 * Outbound Make.com webhook for SparkLoop subscribe events.
 *
 * Replaces the previous indirection where MailerLite's `sparkloop=true` segment
 * trigger fired Make. We now POST directly from the subscribe routes so Make
 * does not depend on email-provider automation. The MailerLite/Beehiiv field
 * flip still happens for other downstream consumers.
 */

import { supabaseAdmin } from '@/lib/supabase'

export interface MakeWebhookPayload {
  subscriber_email: string
  subscriber_id: string
}

export interface ClaimMakeWebhookFireArgs {
  publicationId: string
  subscriberEmail: string
  source: 'sparkloop' | 'afteroffers'
  subscriberId: string
  /** Initial lifecycle state. Defaults to 'fired' (legacy immediate-fire flow). */
  status?: 'pending' | 'fired'
}

/**
 * Atomically claim the right to fire the Make webhook for this subscriber.
 *
 * When status === 'fired' (default), this matches the legacy semantics: the
 * caller intends to fire the webhook immediately after a successful claim.
 * When status === 'pending', the row is reserved for the check-pending-webhooks
 * cron to transition once a first open is detected.
 *
 * Inserts a row into `make_webhook_fires` keyed on (publication_id, subscriber_email).
 * Returns true on a fresh insert (caller should fire / wait for cron). Returns
 * false if a row already exists for this subscriber (existing claim) or on any
 * other DB error (failing closed — safer to skip than risk a duplicate).
 *
 * Email is lowercased before insert/check so case variants don't bypass dedup.
 */
export async function claimMakeWebhookFire(
  args: ClaimMakeWebhookFireArgs
): Promise<boolean> {
  const email = args.subscriberEmail.trim().toLowerCase()
  if (!email) return false

  const status = args.status ?? 'fired'
  const now = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('make_webhook_fires')
    .insert({
      publication_id: args.publicationId,
      subscriber_email: email,
      source: args.source,
      subscriber_id: args.subscriberId,
      status,
      fired_at: status === 'fired' ? now : null,
    })
    .select('id')
    .maybeSingle()

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      console.log(
        `[MakeWebhook] Skipped: already claimed for ${email} pub=${args.publicationId} (existing row)`
      )
      return false
    }
    console.error(
      `[MakeWebhook] Claim insert failed for ${email} (failing closed): ${error.message} pub=${args.publicationId}`
    )
    return false
  }

  return !!data
}

export interface FireMakeWebhookOptions {
  publicationId?: string
  /** Override the default 5s timeout (ms). */
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 5000

/**
 * POST a SparkLoop-subscribe payload to a configured Make.com webhook URL.
 *
 * Never throws. Returns true on a 2xx response, false otherwise (including
 * skipped, timeout, network error, non-2xx status). Failures are logged with
 * the `[MakeWebhook]` prefix and never block the calling request.
 */
export async function fireMakeWebhook(
  url: string | null | undefined,
  payload: MakeWebhookPayload,
  opts: FireMakeWebhookOptions = {}
): Promise<boolean> {
  const pubTag = opts.publicationId ? ` pub=${opts.publicationId}` : ''

  if (!url || !url.trim()) {
    console.log(`[MakeWebhook] Skipped: no webhook URL configured${pubTag}`)
    return false
  }

  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    console.error(`[MakeWebhook] Skipped: invalid URL${pubTag}`)
    return false
  }

  if (parsed.protocol !== 'https:') {
    console.error(`[MakeWebhook] Skipped: URL must be https${pubTag}`)
    return false
  }

  if (!payload.subscriber_email || !payload.subscriber_id) {
    console.log(`[MakeWebhook] Skipped: missing subscriber_email or subscriber_id${pubTag}`)
    return false
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(parsed.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriber_email: payload.subscriber_email,
        subscriber_id: payload.subscriber_id,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      console.error(
        `[MakeWebhook] Non-2xx response: ${response.status} ${response.statusText}${pubTag}`
      )
      return false
    }

    console.log(`[MakeWebhook] Delivered for ${payload.subscriber_email}${pubTag}`)
    return true
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError'
    const msg = err instanceof Error ? err.message : String(err)
    console.error(
      `[MakeWebhook] ${isAbort ? `Timeout after ${timeoutMs}ms` : 'Network error'}: ${msg}${pubTag}`
    )
    return false
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Transition a pending row to 'fired' and timestamp it. Returns true on
 * successful DB update, false on error (caller should NOT fire the webhook
 * if false — the row remains 'pending' and will be retried by the next cron
 * cycle, preserving at-most-once delivery semantics).
 */
export async function markMakeWebhookFired(rowId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('make_webhook_fires')
    .update({ status: 'fired', fired_at: new Date().toISOString() })
    .eq('id', rowId)
  if (error) {
    console.error(`[MakeWebhook] markFired failed id=${rowId}: ${error.message}`)
    return false
  }
  return true
}

/**
 * Transition a pending row to 'expired' with a reason tag.
 */
export async function markMakeWebhookExpired(rowId: string, reason: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('make_webhook_fires')
    .update({ status: 'expired', expired_reason: reason })
    .eq('id', rowId)
  if (error) {
    console.error(`[MakeWebhook] markExpired failed id=${rowId} reason=${reason}: ${error.message}`)
  }
}

/**
 * Bump last_polled_at + poll_attempts on a pending row that didn't change state.
 */
export async function recordPollAttempt(rowId: string, currentAttempts: number): Promise<void> {
  const { error } = await supabaseAdmin
    .from('make_webhook_fires')
    .update({ last_polled_at: new Date().toISOString(), poll_attempts: currentAttempts + 1 })
    .eq('id', rowId)
  if (error) {
    console.error(`[MakeWebhook] recordPollAttempt failed id=${rowId}: ${error.message}`)
  }
}
