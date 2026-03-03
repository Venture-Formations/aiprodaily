import { supabaseAdmin } from '@/lib/supabase'
import { openai, anthropic } from './clients'
import type { StructuredPromptConfig } from './types'
import { extractResponseContent, parseAIResponseJSON } from './response-parser'

// Helper function to fetch prompt from database with code fallback
// When publicationId is provided, tries publication_settings first (per-tenant), then falls back to app_settings
export async function getPrompt(key: string, fallback: string, publicationId?: string): Promise<string> {
  try {
    // Try publication_settings first if publicationId is provided
    if (publicationId) {
      const { data: pubData, error: pubError } = await supabaseAdmin
        .from('publication_settings')
        .select('value')
        .eq('publication_id', publicationId)
        .eq('key', key)
        .single()

      if (!pubError && pubData) {
        return typeof pubData.value === 'string' ? pubData.value : JSON.stringify(pubData.value)
      }
    }

    // Fall back to app_settings (global)
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .single()

    if (error || !data) {
      console.warn(`⚠️  [AI-PROMPT] FALLBACK USED: ${key} (not found in database)`)
      if (!publicationId) {
        console.warn(`⚠️  [AI-PROMPT] No publicationId provided — prompt lookup is not per-tenant`)
      }
      return fallback
    }

    return data.value
  } catch (error) {
    console.error(`❌ [AI-PROMPT] ERROR fetching ${key}, using fallback:`, error)
    return fallback
  }
}

// Helper function to fetch complete JSON API request from database
// Returns the prompt exactly as stored (complete JSON with model, messages, temperature, etc.)
export async function getPromptJSON(key: string, newsletterId: string, fallbackText?: string): Promise<any> {
  try {
    // Try publication_settings first (with ai_provider column)
    const { data, error } = await supabaseAdmin
      .from('publication_settings')
      .select('value')
      .eq('publication_id', newsletterId)
      .eq('key', key)
      .single()

    if (error || !data) {
      // Fallback to app_settings with WARNING log
      const { data: fallbackData, error: fallbackError } = await supabaseAdmin
        .from('app_settings')
        .select('value')
        .eq('key', key)
        .single()

      if (fallbackError || !fallbackData) {
        console.warn(`⚠️  [AI-PROMPT] FALLBACK USED: ${key} (not found in database)`)
        console.warn(`⚠️  [AI-PROMPT] Run migration: GET /api/debug/migrate-ai-prompts?dry_run=false`)

        if (!fallbackText) {
          throw new Error(`Prompt ${key} not found and no fallback provided`)
        }

        // Wrap fallback text in minimal JSON structure
        return {
          model: 'gpt-4o',
          messages: [{ role: 'user', content: fallbackText }],
          _provider: 'openai'
        }
      }

      console.warn(`[SETTINGS FALLBACK] Using app_settings for key="${key}" (publication=${newsletterId}). Migrate this setting!`)
      // Use fallback data
      const valueToProcess = fallbackData.value
      let promptJSON: any
      if (typeof valueToProcess === 'string') {
        try {
          promptJSON = JSON.parse(valueToProcess)
        } catch (parseError) {
          throw new Error(`Prompt ${key} is not valid JSON. It must be structured JSON with a 'messages' array. Error: ${parseError instanceof Error ? parseError.message : 'Parse failed'}`)
        }
      } else if (typeof valueToProcess === 'object' && valueToProcess !== null) {
        promptJSON = valueToProcess
      } else {
        throw new Error(`Prompt ${key} has invalid format. Expected structured JSON with a 'messages' array, got ${typeof valueToProcess}`)
      }

      if (!promptJSON.messages && !promptJSON.input) {
        throw new Error(`Prompt ${key} is missing 'messages' or 'input' array.`)
      }
      if (promptJSON.input && !promptJSON.messages) {
        promptJSON.messages = promptJSON.input
      }
      promptJSON._provider = 'openai'
      return promptJSON
    }

    // Parse value - must be valid structured JSON
    let promptJSON: any
    if (typeof data.value === 'string') {
      try {
        promptJSON = JSON.parse(data.value)
      } catch (parseError) {
        // Not JSON - this is an error, prompt must be structured
        throw new Error(`Prompt ${key} is not valid JSON. It must be structured JSON with a 'messages' array. Error: ${parseError instanceof Error ? parseError.message : 'Parse failed'}`)
      }
    } else if (typeof data.value === 'object' && data.value !== null) {
      // Already an object (JSONB was auto-parsed)
      promptJSON = data.value
    } else {
      // Unknown format - this is an error
      throw new Error(`Prompt ${key} has invalid format. Expected structured JSON with a 'messages' array, got ${typeof data.value}`)
    }

    // Validate structure - must have messages OR input array (OpenAI Responses API uses 'input', we normalize to 'messages')
    // Check for both 'messages' (standard format) and 'input' (OpenAI Responses API format)
    if (!promptJSON.messages && !promptJSON.input) {
      throw new Error(`Prompt ${key} is missing 'messages' or 'input' array. It must be structured JSON like: { "model": "...", "messages": [...] } or { "model": "...", "input": [...] }`)
    }

    if (promptJSON.messages && !Array.isArray(promptJSON.messages)) {
      throw new Error(`Prompt ${key} has 'messages' but it's not an array. It must be an array of message objects.`)
    }

    if (promptJSON.input && !Array.isArray(promptJSON.input)) {
      throw new Error(`Prompt ${key} has 'input' but it's not an array. It must be an array of message objects.`)
    }

    // Normalize: If it has 'input' but not 'messages', convert 'input' to 'messages' for internal use
    // This allows database to store either format (Settings saves with 'input', but we use 'messages' internally)
    if (promptJSON.input && !promptJSON.messages) {
      promptJSON.messages = promptJSON.input
      // Don't delete 'input' - keep it so it can be used directly if needed
    }

    // Auto-detect provider from model name
    const modelName = (promptJSON.model || '').toLowerCase()
    if (modelName.includes('claude') || modelName.includes('sonnet') || modelName.includes('opus') || modelName.includes('haiku')) {
      promptJSON._provider = 'claude'
      console.log(`[AI] Auto-detected Claude provider from model: ${promptJSON.model}`)
    } else {
      promptJSON._provider = 'openai'
    }

    return promptJSON
  } catch (error) {
    console.error(`❌ [AI-PROMPT] ERROR fetching ${key}:`, error)

    if (!fallbackText) {
      throw error
    }

    // Return fallback wrapped in minimal JSON
    return {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: fallbackText }],
      _provider: 'openai'
    }
  }
}

// Legacy function - DEPRECATED, use getPromptJSON instead
export async function getPromptWithProvider(key: string, fallback: string): Promise<{ prompt: string; provider: 'openai' | 'claude' }> {
  console.warn(`⚠️  [DEPRECATED] getPromptWithProvider() is deprecated. Use getPromptJSON() instead for ${key}`)
  try {
    const promptJSON = await getPromptJSON(key, fallback)
    const provider = promptJSON._provider || 'openai'

    // Return just the content from first user message for backward compat
    let promptText = fallback
    if (promptJSON.messages && promptJSON.messages.length > 0) {
      const userMsg = promptJSON.messages.find((m: any) => m.role === 'user')
      promptText = userMsg?.content || fallback
    }

    return { prompt: promptText, provider }
  } catch (error) {
    return { prompt: fallback, provider: 'openai' }
  }
}

// Helper function to call OpenAI or Claude with structured prompt from database
// Sends the JSON prompt EXACTLY as-is (with placeholder replacement only)
export async function callWithStructuredPrompt(
  promptConfig: StructuredPromptConfig,
  placeholders: Record<string, string> = {},
  provider: 'openai' | 'claude' = 'openai',
  promptKey?: string
): Promise<any> {
  // Validate promptConfig structure
  if (!promptConfig || typeof promptConfig !== 'object') {
    throw new Error('Invalid promptConfig: must be an object')
  }

  // Accept either 'input' (Responses API format) or 'messages' (standard format)
  // Normalize to 'messages' internally for processing
  const messagesArray = promptConfig.messages || promptConfig.input
  if (!messagesArray || !Array.isArray(messagesArray)) {
    throw new Error('Invalid promptConfig: must have either "messages" or "input" array')
  }

  // If promptConfig has 'input' but not 'messages', normalize it to 'messages' for internal use
  // We'll convert back to 'input' when sending to Responses API if needed
  if (!promptConfig.messages && promptConfig.input) {
    promptConfig.messages = promptConfig.input
  }


  // Deep clone the entire config to avoid mutating the original
  const apiRequest = JSON.parse(JSON.stringify(promptConfig))

  // Replace placeholders recursively in the entire object
  function replacePlaceholders(obj: any): any {
    if (typeof obj === 'string') {
      // First replace named placeholders
      let result = Object.entries(placeholders).reduce(
        (str, [key, value]) => str.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value),
        obj
      )
      // Then replace random integer placeholders: {{random_X-Y}}
      result = result.replace(/\{\{random_(\d+)-(\d+)\}\}/g, (match, minStr, maxStr) => {
        const min = parseInt(minStr, 10)
        const max = parseInt(maxStr, 10)
        if (isNaN(min) || isNaN(max) || min > max) {
          console.warn(`[AI] Invalid random placeholder: ${match}`)
          return match // Return unchanged if invalid
        }
        return String(Math.floor(Math.random() * (max - min + 1)) + min)
      })
      return result
    }
    if (Array.isArray(obj)) {
      return obj.map(item => replacePlaceholders(item))
    }
    if (typeof obj === 'object' && obj !== null) {
      const result: any = {}
      for (const key in obj) {
        result[key] = replacePlaceholders(obj[key])
      }
      return result
    }
    return obj
  }

  // Replace all placeholders in the entire config
  const processedRequest = replacePlaceholders(apiRequest)

  // Remove custom application fields that are not valid API parameters
  // These fields are used by our application logic but should not be sent to the API
  const customFields = ['response_field', 'provider', 'input'] // 'input' is handled separately below
  for (const field of customFields) {
    if (field in processedRequest) {
      delete processedRequest[field]
    }
  }

  // Add timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 180000) // 180s (3min) for GPT-5

  try {
    let content: string = ''

    if (provider === 'claude') {
      // Claude API - send exactly as-is (messages stays as messages)
      console.log(`[AI] Using Claude API for prompt (provider: ${provider})`)

      const response = await anthropic.messages.create(processedRequest, {
        signal: controller.signal
      } as any)

      clearTimeout(timeoutId)

      // Extract content from Claude response
      const textContent = response.content.find((c: any) => c.type === 'text')
      content = textContent && 'text' in textContent ? textContent.text : ''

      // Debug: Log raw Claude response to check for newlines
      console.log(`[AI][Claude] Raw response length: ${content.length}`)
      console.log(`[AI][Claude] Contains \\n: ${content.includes('\n')}`)
      console.log(`[AI][Claude] Contains \\n\\n: ${content.includes('\n\n')}`)
      console.log(`[AI][Claude] Contains literal backslash-n: ${content.includes('\\n')}`)
      console.log(`[AI][Claude] First 500 chars: ${content.substring(0, 500)}`)

      if (!content) {
        throw new Error('No response from Claude')
      }
    } else {
      // OpenAI Responses API - only rename messages to input (API requirement)
      console.log(`[AI] Using OpenAI API for prompt (provider: ${provider})`)
      if (processedRequest.messages) {
        processedRequest.input = processedRequest.messages
        delete processedRequest.messages
      }

      const response = await (openai as any).responses.create(processedRequest, {
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const rawContent = extractResponseContent(response)

      // If already parsed (object/array from JSON schema), return directly
      if (typeof rawContent !== 'string') {
        return rawContent
      }

      content = rawContent
    }

    // Parse string content as JSON (same for both providers)
    return parseAIResponseJSON(content)
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

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
  // Load complete JSON prompt from database
  const promptJSON = await getPromptJSON(promptKey, newsletterId, fallbackText)

  // Extract provider info
  const provider = promptJSON._provider || 'openai'

  // Remove internal fields before sending to API
  delete promptJSON._provider

  // Call AI with complete structured prompt (pass promptKey for subject line logging)
  return await callWithStructuredPrompt(promptJSON, placeholders, provider, promptKey)
}
