import { supabaseAdmin } from '@/lib/supabase'
import { callAIWithPrompt } from '@/lib/openai/core'

/**
 * AI-Powered Alert Triage
 *
 * Before sending an alert to Slack, this module classifies it using AI:
 * - auto_resolve: transient/self-healing issue → log only, skip Slack
 * - investigate: real but not urgent → send with [Low Priority] prefix
 * - critical: immediate action needed → send normally
 *
 * Safety: 5-second timeout, fail-open (on error, alert is sent normally).
 */

export type TriageClassification = 'auto_resolve' | 'investigate' | 'critical'

export interface TriageResult {
  classification: TriageClassification
  reasoning: string
  suggestedAction?: string
}

const TRIAGE_TIMEOUT_MS = 5_000

/** Inline fallback prompt used if ai_triage_alert isn't in the database yet */
const FALLBACK_PROMPT = JSON.stringify({
  model: 'gpt-4o-mini',
  messages: [
    {
      role: 'system',
      content: [
        'You are an ops triage agent for a newsletter automation platform.',
        'Classify alerts as one of: auto_resolve (transient, self-healing, or already remediated),',
        'investigate (needs human attention but not urgent), or critical (immediate action needed).',
        'Respond with JSON only: {"classification":"...","reasoning":"...","suggested_action":"..."}'
      ].join(' '),
    },
    {
      role: 'user',
      content: [
        'Alert: {{alert_message}}',
        'Level: {{alert_level}}',
        'Type: {{notification_type}}',
        '',
        'Recent logs from same source (last 10):',
        '{{recent_logs}}',
        '',
        'Classify this alert.',
      ].join('\n'),
    },
  ],
  temperature: 0.2,
  max_tokens: 200,
})

/**
 * Check if triage is enabled globally.
 */
export async function isTriageEnabled(): Promise<boolean> {
  try {
    const { data } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'ai_triage_enabled')
      .single()
    return data?.value === 'true'
  } catch {
    return false
  }
}

/**
 * Fetch recent system_logs entries that share a common source keyword with
 * the alert message. Used to give AI context about whether this is a pattern.
 */
async function fetchRecentContext(
  notificationType?: string
): Promise<Array<{ level: string; message: string; created_at: string }>> {
  try {
    // Use notification type as a proxy for source grouping
    const source = notificationType?.replace(/_/g, ' ') || ''
    let query = supabaseAdmin
      .from('system_logs')
      .select('level, message, timestamp')
      .order('timestamp', { ascending: false })
      .limit(10)

    // If we have a notification type, try to filter to relevant logs
    if (source) {
      // Map common notification types to system_logs sources
      const sourceMap: Record<string, string> = {
        workflow_failure: 'rss_processor',
        rss_processing_updates: 'rss_processor',
        rss_processing_incomplete: 'rss_processor',
        health_check_alerts: 'health_monitor',
        system_errors: 'error_handler',
        email_delivery_updates: 'mailerlite',
        scheduled_send_failure: 'mailerlite',
      }
      const mappedSource = notificationType ? sourceMap[notificationType] : undefined
      if (mappedSource) {
        query = query.eq('source', mappedSource)
      }
    }

    const { data } = await query
    return (data || []).map((row: any) => ({
      level: row.level,
      message: row.message,
      created_at: row.timestamp,
    }))
  } catch {
    return []
  }
}

/**
 * Triage an alert using AI. Returns null if triage fails or times out
 * (caller should send the alert normally in that case).
 */
export async function triageAlert(
  message: string,
  level: string,
  notificationType?: string,
  publicationId?: string
): Promise<TriageResult | null> {
  const startMs = Date.now()

  try {
    // Fetch context in parallel with a safety timeout
    const recentLogs = await fetchRecentContext(notificationType)
    const recentLogsText = recentLogs.length > 0
      ? recentLogs.map(l => `[${l.level}] ${l.message}`).join('\n')
      : '(no recent logs)'

    // Use a "dummy" publication ID for global prompts — getPromptJSON falls back to app_settings
    const pubId = publicationId || '00000000-0000-0000-0000-000000000000'

    // Race against timeout
    const aiPromise = callAIWithPrompt(
      'ai_triage_alert',
      pubId,
      {
        alert_message: message,
        alert_level: level,
        notification_type: notificationType || 'unknown',
        recent_logs: recentLogsText,
      },
      FALLBACK_PROMPT
    )

    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), TRIAGE_TIMEOUT_MS)
    })

    const aiResult = await Promise.race([aiPromise, timeoutPromise])

    if (!aiResult) {
      // Timed out
      await logTriageResult(message, level, notificationType, 'triage_failed', 'Timeout', recentLogs, Date.now() - startMs)
      return null
    }

    // Parse AI response
    const parsed = parseTriageResponse(aiResult)
    if (!parsed) {
      await logTriageResult(message, level, notificationType, 'triage_failed', 'Unparseable response', recentLogs, Date.now() - startMs)
      return null
    }

    await logTriageResult(message, level, notificationType, parsed.classification, parsed.reasoning, recentLogs, Date.now() - startMs)

    return parsed
  } catch (error) {
    // Fail-open: any error means we send the alert normally
    const durationMs = Date.now() - startMs
    const reason = error instanceof Error ? error.message : 'Unknown error'
    await logTriageResult(message, level, notificationType, 'triage_failed', reason, [], durationMs).catch(() => {})
    return null
  }
}

/**
 * Parse the AI response into a structured TriageResult.
 * Handles both raw string and already-parsed object responses.
 */
function parseTriageResponse(aiResult: any): TriageResult | null {
  try {
    let parsed: any

    if (typeof aiResult === 'string') {
      // Try to extract JSON from the response
      const jsonMatch = aiResult.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null
      parsed = JSON.parse(jsonMatch[0])
    } else if (typeof aiResult === 'object') {
      // Handle { raw: string } pattern from callAIWithPrompt
      if (aiResult.raw) {
        const jsonMatch = aiResult.raw.match(/\{[\s\S]*\}/)
        if (!jsonMatch) return null
        parsed = JSON.parse(jsonMatch[0])
      } else {
        parsed = aiResult
      }
    } else {
      return null
    }

    const classification = parsed.classification?.toLowerCase()
    if (!['auto_resolve', 'investigate', 'critical'].includes(classification)) {
      return null
    }

    return {
      classification: classification as TriageClassification,
      reasoning: parsed.reasoning || '',
      suggestedAction: parsed.suggested_action || parsed.suggestedAction || undefined,
    }
  } catch {
    return null
  }
}

/**
 * Log triage outcome to alert_triage_log table.
 */
async function logTriageResult(
  alertMessage: string,
  alertLevel: string,
  notificationType: string | undefined,
  triageResult: string,
  reasoning: string,
  recentContext: any[],
  durationMs: number
): Promise<void> {
  try {
    await supabaseAdmin
      .from('alert_triage_log')
      .insert({
        alert_message: alertMessage.substring(0, 2000),
        alert_level: alertLevel,
        notification_type: notificationType || null,
        triage_result: triageResult,
        ai_reasoning: reasoning?.substring(0, 1000) || null,
        recent_context: recentContext,
        triage_duration_ms: durationMs,
      })
  } catch (error) {
    console.error('[AlertTriage] Failed to log triage result:', error)
  }
}
