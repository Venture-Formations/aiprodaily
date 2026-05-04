import { getPromptJSON } from './prompt-repository'
import { callWithStructuredPrompt } from './core'

/**
 * Universal AI caller - loads prompt from database and calls AI
 * This is the NEW standard way to call AI - prompts are complete JSON stored in database
 *
 * @param promptKey - Key in app_settings table (e.g. 'ai_prompt_primary_article_title')
 * @param placeholders - Object with placeholder values (e.g. {title: '...', content: '...'})
 * @param fallbackText - Optional fallback text if prompt not in database
 * @returns Parsed JSON response from AI
 */
export async function callAIWithPrompt(
  promptKey: string,
  newsletterId: string,
  placeholders: Record<string, string> = {},
  fallbackText?: string
): Promise<any> {
  const startMs = Date.now()

  // Load complete JSON prompt from database
  const promptJSON = await getPromptJSON(promptKey, newsletterId, fallbackText)

  // Extract provider info
  const provider = promptJSON._provider || 'openai'
  const model = promptJSON.model || 'unknown'

  // Remove internal fields before sending to API
  delete promptJSON._provider

  // Call AI with complete structured prompt (pass promptKey for subject line logging)
  const result = await callWithStructuredPrompt(promptJSON, placeholders, provider, promptKey)

  // Record AI latency metric (non-blocking)
  try {
    const { MetricsRecorder } = await import('@/lib/monitoring/metrics-recorder')
    const metrics = new MetricsRecorder(newsletterId)
    await metrics.recordTiming('ai_api_latency_ms', startMs, { provider, model, promptKey })
  } catch {
    // Metrics recording should never break AI calls
  }

  return result
}
