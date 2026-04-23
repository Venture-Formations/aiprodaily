#!/usr/bin/env node
/**
 * Replay SparkLoop subscribes that failed during an API key outage.
 *
 * For each email with a `subscriptions_failed` event in the given window,
 * find its most recent prior `popup_opened` event to recover the ref_codes,
 * then POST to /api/sparkloop/subscribe so both the SparkLoop subscribe
 * and the MailerLite/Beehiiv `sparkloop` field update happen.
 *
 * Usage:
 *   node scripts/replay-sparkloop-failed-subscribes.mjs --dry-run
 *   node scripts/replay-sparkloop-failed-subscribes.mjs --base-url=https://aiprodaily.com
 *
 * Flags:
 *   --dry-run              Preview what would run; do not POST to the API
 *   --since=<ISO>          Start of window (default: 2026-04-22T19:00:00Z)
 *   --until=<ISO>          End of window (default: now)
 *   --publication-id=<id>  Publication ID (default: AI Pros Daily)
 *   --base-url=<url>       Base URL for the API (default: https://aiprodaily.com)
 *   --delay-ms=<n>         Delay between requests to avoid rate limits (default: 1500)
 *
 * Environment (loaded from .env.local):
 *   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)  (required)
 *   SUPABASE_SERVICE_ROLE_KEY                    (required)
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config() // fallback to .env

const DEFAULT_PUBLICATION_ID = 'eaaf8ba4-a3eb-4fff-9cad-6776acc36dcf'
const DEFAULT_SINCE = '2026-04-22T19:00:00Z'
const DEFAULT_BASE_URL = 'https://aiprodaily.com'
const DEFAULT_DELAY_MS = 2500

function parseArgs() {
  const args = { dryRun: false }
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true
    else if (arg.startsWith('--since=')) args.since = arg.slice('--since='.length)
    else if (arg.startsWith('--until=')) args.until = arg.slice('--until='.length)
    else if (arg.startsWith('--publication-id=')) args.publicationId = arg.slice('--publication-id='.length)
    else if (arg.startsWith('--base-url=')) args.baseUrl = arg.slice('--base-url='.length)
    else if (arg.startsWith('--delay-ms=')) args.delayMs = parseInt(arg.slice('--delay-ms='.length), 10)
  }
  return {
    dryRun: args.dryRun,
    since: args.since ?? DEFAULT_SINCE,
    until: args.until ?? new Date().toISOString(),
    publicationId: args.publicationId ?? DEFAULT_PUBLICATION_ID,
    baseUrl: (args.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, ''),
    delayMs: Number.isFinite(args.delayMs) ? args.delayMs : DEFAULT_DELAY_MS,
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  const opts = parseArgs()

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY in env')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })

  console.log('--- Replay SparkLoop failed subscribes ---')
  console.log(`Publication: ${opts.publicationId}`)
  console.log(`Window:      ${opts.since} → ${opts.until}`)
  console.log(`Base URL:    ${opts.baseUrl}`)
  console.log(`Delay:       ${opts.delayMs}ms`)
  console.log(`Mode:        ${opts.dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log()

  // 1. Pull distinct failed emails in the window (most recent failure per email)
  const { data: failedRows, error: failedErr } = await supabase
    .from('sparkloop_events')
    .select('subscriber_email, event_timestamp')
    .eq('publication_id', opts.publicationId)
    .eq('event_type', 'subscriptions_failed')
    .gte('event_timestamp', opts.since)
    .lte('event_timestamp', opts.until)
    .order('event_timestamp', { ascending: false })

  if (failedErr) {
    console.error('Failed to query subscriptions_failed events:', failedErr.message)
    process.exit(1)
  }

  const latestFailureByEmail = new Map()
  for (const row of failedRows ?? []) {
    if (!row.subscriber_email) continue
    if (!latestFailureByEmail.has(row.subscriber_email)) {
      latestFailureByEmail.set(row.subscriber_email, row.event_timestamp)
    }
  }

  console.log(`Found ${latestFailureByEmail.size} unique failed emails in window`)

  // 2. For each email, get the most recent popup_opened <= failure time
  const replayQueue = []
  const skipped = []

  for (const [email, failedAt] of latestFailureByEmail) {
    const { data: popup, error: popupErr } = await supabase
      .from('sparkloop_events')
      .select('raw_payload, event_timestamp')
      .eq('publication_id', opts.publicationId)
      .eq('event_type', 'popup_opened')
      .eq('subscriber_email', email)
      .lte('event_timestamp', failedAt)
      .order('event_timestamp', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (popupErr) {
      skipped.push({ email, reason: `popup query error: ${popupErr.message}` })
      continue
    }

    const refCodes = popup?.raw_payload?.ref_codes
    const source = popup?.raw_payload?.source === 'recs_page' ? 'recs_page' : 'custom_popup'

    if (!Array.isArray(refCodes) || refCodes.length === 0) {
      skipped.push({ email, reason: 'no ref_codes in popup_opened' })
      continue
    }

    // Skip if we already have a successful confirmation for this email in the window
    const { data: alreadyConfirmed } = await supabase
      .from('sparkloop_events')
      .select('id')
      .eq('publication_id', opts.publicationId)
      .eq('event_type', 'api_subscribe_confirmed')
      .eq('subscriber_email', email)
      .gte('event_timestamp', opts.since)
      .limit(1)
      .maybeSingle()

    if (alreadyConfirmed) {
      skipped.push({ email, reason: 'already confirmed in window' })
      continue
    }

    replayQueue.push({ email, refCodes, source })
  }

  console.log(`Replay queue: ${replayQueue.length}`)
  console.log(`Skipped:      ${skipped.length}`)
  if (skipped.length > 0) {
    for (const s of skipped) console.log(`  - ${s.email}: ${s.reason}`)
  }
  console.log()

  if (opts.dryRun) {
    console.log('DRY RUN — preview of requests that would be sent:')
    for (const { email, refCodes, source } of replayQueue) {
      console.log(`  ${email}  [${refCodes.length} recs, source=${source}]`)
    }
    return
  }

  // 3. Fire the replay requests
  const results = { ok: 0, failed: 0, errors: [] }
  const url = `${opts.baseUrl}/api/sparkloop/subscribe`

  for (let i = 0; i < replayQueue.length; i++) {
    const { email, refCodes, source } = replayQueue[i]
    const label = `[${i + 1}/${replayQueue.length}] ${email}`

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          refCodes,
          source,
          publicationId: opts.publicationId,
        }),
      })
      const body = await res.json().catch(() => ({}))

      if (res.ok && body.success) {
        console.log(`${label} ✅ subscribed (${body.subscribedCount ?? refCodes.length} recs)`)
        results.ok++
      } else {
        const errMsg = body.error || `HTTP ${res.status}`
        console.log(`${label} ❌ ${errMsg}`)
        results.failed++
        results.errors.push({ email, error: errMsg })
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.log(`${label} ❌ network error: ${errMsg}`)
      results.failed++
      results.errors.push({ email, error: errMsg })
    }

    if (i < replayQueue.length - 1) await sleep(opts.delayMs)
  }

  console.log()
  console.log(`--- Summary ---`)
  console.log(`Succeeded: ${results.ok}`)
  console.log(`Failed:    ${results.failed}`)
  if (results.errors.length > 0) {
    console.log('Failures:')
    for (const e of results.errors) console.log(`  - ${e.email}: ${e.error}`)
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
