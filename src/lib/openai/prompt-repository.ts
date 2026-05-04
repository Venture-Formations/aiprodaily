import { supabaseAdmin } from '@/lib/supabase'

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
      // Auto-detect provider from model name (same logic as publication_settings path)
      const fallbackModelName = (promptJSON.model || '').toLowerCase()
      if (fallbackModelName.includes('claude') || fallbackModelName.includes('sonnet') || fallbackModelName.includes('opus') || fallbackModelName.includes('haiku')) {
        promptJSON._provider = 'claude'
        console.log(`[AI] Auto-detected Claude provider from model: ${promptJSON.model} (app_settings fallback)`)
      } else {
        promptJSON._provider = 'openai'
      }
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
