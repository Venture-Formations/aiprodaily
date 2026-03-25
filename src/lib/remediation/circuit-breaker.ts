import { supabaseAdmin } from '@/lib/supabase'

/**
 * MailerLite Circuit Breaker
 *
 * Trips open when 3+ rate-limit (429) hits occur within a 5-minute window.
 * While open, all MailerLite API calls are skipped for 5 minutes.
 * Auto-closes after the cooldown period elapses.
 *
 * State is stored in app_settings (global, not per-tenant) because
 * MailerLite rate limits are account-wide. Uses the first active
 * publication_id since app_settings requires it.
 */

const CIRCUIT_OPEN_KEY = 'mailerlite_circuit_open'
const CIRCUIT_429_COUNT_KEY = 'mailerlite_circuit_429_count'
const CIRCUIT_WINDOW_START_KEY = 'mailerlite_circuit_window_start'

const TRIP_THRESHOLD = 3
const WINDOW_MS = 5 * 60 * 1000 // 5 minutes
const COOLDOWN_MS = 5 * 60 * 1000 // 5 minutes

/** Cache the publication ID so we don't query on every call */
let cachedPublicationId: string | null = null

/** @internal Reset cache for testing */
export function _resetPublicationCache() { cachedPublicationId = null }

async function getGlobalPublicationId(): Promise<string> {
  if (cachedPublicationId) return cachedPublicationId
  const { data } = await supabaseAdmin
    .from('publications')
    .select('id')
    .eq('is_active', true)
    .limit(1)
    .single()
  cachedPublicationId = data?.id || ''
  return cachedPublicationId!
}

async function getSetting(key: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .limit(1)
    .single()
  return data?.value ?? null
}

async function upsertSetting(key: string, value: string): Promise<void> {
  const publicationId = await getGlobalPublicationId()
  await supabaseAdmin
    .from('app_settings')
    .upsert(
      { publication_id: publicationId, key, value, updated_at: new Date().toISOString() },
      { onConflict: 'publication_id,key' }
    )
}

/**
 * Check if the circuit breaker is currently open (blocking ML calls).
 * Auto-closes if the cooldown period has elapsed.
 */
export async function isCircuitOpen(): Promise<boolean> {
  try {
    const openedAt = await getSetting(CIRCUIT_OPEN_KEY)
    if (!openedAt) return false

    const elapsed = Date.now() - new Date(openedAt).getTime()
    if (elapsed >= COOLDOWN_MS) {
      // Cooldown elapsed — auto-close
      await closeCircuit()
      return false
    }

    return true
  } catch (error) {
    // If we can't check, assume closed (don't block sends on DB errors)
    console.error('[CircuitBreaker] Error checking circuit state:', error)
    return false
  }
}

/**
 * Record a 429 rate-limit hit. If this is the Nth hit within the window,
 * trips the circuit open.
 *
 * @returns Whether the circuit was tripped by this call
 */
export async function recordRateLimitHit(): Promise<{ tripped: boolean }> {
  try {
    const now = Date.now()
    const windowStart = await getSetting(CIRCUIT_WINDOW_START_KEY)
    const currentCount = parseInt(await getSetting(CIRCUIT_429_COUNT_KEY) ?? '0', 10)

    // If no window or window expired, start a new one
    if (!windowStart || (now - new Date(windowStart).getTime()) >= WINDOW_MS) {
      await upsertSetting(CIRCUIT_WINDOW_START_KEY, new Date(now).toISOString())
      await upsertSetting(CIRCUIT_429_COUNT_KEY, '1')
      return { tripped: false }
    }

    // Increment count within current window
    const newCount = currentCount + 1
    await upsertSetting(CIRCUIT_429_COUNT_KEY, String(newCount))

    if (newCount >= TRIP_THRESHOLD) {
      // Trip the circuit
      await upsertSetting(CIRCUIT_OPEN_KEY, new Date(now).toISOString())
      console.warn(`[CircuitBreaker] Circuit OPEN — ${newCount} rate-limit hits in ${WINDOW_MS / 1000}s window`)
      return { tripped: true }
    }

    return { tripped: false }
  } catch (error) {
    console.error('[CircuitBreaker] Error recording rate-limit hit:', error)
    return { tripped: false }
  }
}

/**
 * Explicitly close the circuit and reset counters.
 */
export async function closeCircuit(): Promise<void> {
  try {
    // Remove the open timestamp
    const publicationId = await getGlobalPublicationId()
    await supabaseAdmin
      .from('app_settings')
      .delete()
      .eq('key', CIRCUIT_OPEN_KEY)
      .eq('publication_id', publicationId)

    await upsertSetting(CIRCUIT_429_COUNT_KEY, '0')
    await upsertSetting(CIRCUIT_WINDOW_START_KEY, '')

    console.log('[CircuitBreaker] Circuit CLOSED — MailerLite calls resumed')
  } catch (error) {
    console.error('[CircuitBreaker] Error closing circuit:', error)
  }
}
