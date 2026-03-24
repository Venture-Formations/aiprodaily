import { supabaseAdmin } from '@/lib/supabase'

/**
 * AI Refusal Spike Playbook
 *
 * When 3+ AI refusals are detected in a single workflow run,
 * activate a fallback model for the remainder of that run.
 *
 * The flag is stored in app_settings with a timestamp so it can
 * auto-expire. callAIWithPrompt() checks this flag before each call.
 *
 * Uses the first active publication_id since app_settings requires it.
 */

const REFUSAL_THRESHOLD = 3
const FALLBACK_KEY = 'ai_fallback_model_active'
const FALLBACK_EXPIRY_MS = 30 * 60 * 1000 // 30 minutes max

/** Cache the publication ID */
let cachedPublicationId: string | null = null

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

export interface RefusalSpikeResult {
  action: 'fallback_activated' | 'skipped' | 'fallback_cleared'
  reason?: string
  refusalCount?: number
}

/**
 * Activate the fallback model if refusal count exceeds threshold.
 */
export async function remediateRefusalSpike(
  refusalCount: number,
  issueId: string
): Promise<RefusalSpikeResult> {
  if (refusalCount < REFUSAL_THRESHOLD) {
    return { action: 'skipped', reason: `Refusal count ${refusalCount} below threshold ${REFUSAL_THRESHOLD}` }
  }

  // Check if already active
  const { data: existing } = await supabaseAdmin
    .from('app_settings')
    .select('value')
    .eq('key', FALLBACK_KEY)
    .limit(1)
    .single()

  if (existing?.value) {
    const activatedAt = new Date(existing.value).getTime()
    if (Date.now() - activatedAt < FALLBACK_EXPIRY_MS) {
      return { action: 'skipped', reason: 'Fallback model already active' }
    }
  }

  // Activate fallback with current timestamp
  const publicationId = await getGlobalPublicationId()
  await supabaseAdmin
    .from('app_settings')
    .upsert(
      { publication_id: publicationId, key: FALLBACK_KEY, value: new Date().toISOString(), updated_at: new Date().toISOString() },
      { onConflict: 'publication_id,key' }
    )

  console.log(`[Remediation] AI fallback model activated for issue ${issueId} after ${refusalCount} refusals`)

  return { action: 'fallback_activated', refusalCount }
}

/**
 * Check whether the fallback model should be used for the current AI call.
 */
export async function isFallbackModelActive(): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', FALLBACK_KEY)
      .limit(1)
      .single()

    if (!data?.value) return false

    const activatedAt = new Date(data.value).getTime()
    if (Date.now() - activatedAt >= FALLBACK_EXPIRY_MS) {
      // Expired — clean up
      await clearFallbackModel()
      return false
    }

    return true
  } catch {
    return false
  }
}

/**
 * Clear the fallback model flag (called when workflow completes).
 */
export async function clearFallbackModel(): Promise<RefusalSpikeResult> {
  const publicationId = await getGlobalPublicationId()
  await supabaseAdmin
    .from('app_settings')
    .delete()
    .eq('key', FALLBACK_KEY)
    .eq('publication_id', publicationId)

  console.log('[Remediation] AI fallback model cleared')
  return { action: 'fallback_cleared' }
}
