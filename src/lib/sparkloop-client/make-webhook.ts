/**
 * Outbound Make.com webhook for SparkLoop subscribe events.
 *
 * Replaces the previous indirection where MailerLite's `sparkloop=true` segment
 * trigger fired Make. We now POST directly from the subscribe routes so Make
 * does not depend on email-provider automation. The MailerLite/Beehiiv field
 * flip still happens for other downstream consumers.
 */

export interface MakeWebhookPayload {
  subscriber_email: string
  subscriber_id: string
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
