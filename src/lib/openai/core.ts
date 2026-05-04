import { openai, anthropic } from './clients'
import type { StructuredPromptConfig } from './types'
import { extractResponseContent, parseAIResponseJSON } from './response-parser'

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

      // Translate max_tokens → max_output_tokens for OpenAI Responses API
      if ('max_tokens' in processedRequest) {
        processedRequest.max_output_tokens = processedRequest.max_tokens
        delete processedRequest.max_tokens
      }

      // Remove 'system' field — Responses API uses system messages in the input array
      if ('system' in processedRequest && processedRequest.input) {
        processedRequest.input = [
          { role: 'system', content: processedRequest.system },
          ...processedRequest.input
        ]
        delete processedRequest.system
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
