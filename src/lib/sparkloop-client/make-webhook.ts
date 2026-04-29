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
}

/**
 * Atomically claim the right to fire the Make webhook for this subscriber.
 *
 * Inserts a row into `make_webhook_fires` keyed on (publication_id, subscriber_email).
 * Returns true on a fresh insert (caller should fire), false if a row already
 * exists (caller should skip). Email is lowercased before insert/check so
 * case variants don't bypass the dedup.
 *
 * Cross-source, per-publication: a subscriber who triggered via SparkLoop will
 * not re-trigger via AfterOffers (and vice-versa) for the same publication.
 *
 * Returns false on DB error too — failing closed (skip the fire) is safer than
 * failing open (potential duplicate). The error is logged.
 */
export async function claimMakeWebhookFire(
  args: ClaimMakeWebhookFireArgs
): Promise<boolean> {
  const email = args.subscriberEmail.trim().toLowerCase()
  if (!email) return false

  const { data, error } = await supabaseAdmin
    .from('make_webhook_fires')
    .insert({
      publication_id: args.publicationId,
      subscriber_email: email,
      source: args.source,
      subscriber_id: args.subscriberId,
    })
    .select('id')
    .maybeSingle()

  if (error) {
    // 23505 = unique violation: already fired for this (publication, email).
    if ((error as { code?: string }).code === '23505') {
      console.log(
        `[MakeWebhook] Skipped: already fired for ${email} pub=${args.publicationId} (existing claim)`
      )
      return false
    }
    console.error(
      `[MakeWebhook] Claim insert failed (failing closed): ${error.message} pub=${args.publicationId}`
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
