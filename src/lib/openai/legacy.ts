import { openai, anthropic } from './clients'
import type { OpenAICallOptions } from './types'

// This function is no longer needed since we use web scraping instead of AI
export async function callOpenAIWithWeb(userPrompt: string, maxTokens = 1000, temperature = 0) {
  throw new Error('Web-enabled AI calls have been replaced with direct web scraping. Use wordle-scraper.ts instead.')
}

export async function callOpenAIStructured(options: OpenAICallOptions) {
  try {
    const {
      systemPrompt,
      examples = [],
      userPrompt,
      maxTokens = 1000,
      temperature = 0.3,
      topP,
      presencePenalty,
      frequencyPenalty
    } = options

    // Build messages array
    const messages: Array<{ role: 'system' | 'assistant' | 'user', content: string }> = []

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }

    // Add few-shot examples
    examples.forEach(example => {
      messages.push(example)
    })

    if (userPrompt) {
      messages.push({ role: 'user', content: userPrompt })
    }

    // Add timeout to prevent hanging
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 180000) // 180s (3min) for GPT-5 // 30 second timeout

    try {
      const requestOptions: any = {
        model: 'gpt-4o',
        messages,
        max_output_tokens: maxTokens,
        temperature
      }

      // Add optional parameters if provided
      if (topP !== undefined) requestOptions.top_p = topP
      if (presencePenalty !== undefined) requestOptions.presence_penalty = presencePenalty
      if (frequencyPenalty !== undefined) requestOptions.frequency_penalty = frequencyPenalty

      // Debug: Log what we're actually sending to OpenAI
      console.log('[AI] Sending to OpenAI - messages count:', messages.length)
      messages.forEach((msg, i) => {
        console.log(`[AI] Final message ${i} - role: ${msg.role}, content type: ${typeof msg.content}, content preview:`,
          typeof msg.content === 'string' ? msg.content.substring(0, 50) : JSON.stringify(msg.content).substring(0, 50))
      })

      // Convert messages format to input format for Responses API
      const inputMessages = requestOptions.messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      }))

      const response = await (openai as any).responses.create({
        model: requestOptions.model,
        input: inputMessages,
        temperature: requestOptions.temperature,
        max_output_tokens: requestOptions.max_output_tokens,
        ...(requestOptions.top_p !== undefined && { top_p: requestOptions.top_p }),
        ...(requestOptions.presence_penalty !== undefined && { presence_penalty: requestOptions.presence_penalty }),
        ...(requestOptions.frequency_penalty !== undefined && { frequency_penalty: requestOptions.frequency_penalty })
      }, {
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // Extract content from Responses API format
      // For GPT-5 (reasoning model), search for json_schema content item explicitly
      // since reasoning block may be first item (empty, redacted)
      const outputArray = response.output?.[0]?.content
      const jsonSchemaItem = outputArray?.find((c: any) => c.type === "json_schema")
      const textItem = outputArray?.find((c: any) => c.type === "text")

      let rawContent = jsonSchemaItem?.json ??                    // JSON schema response (GPT-5 compatible)
        jsonSchemaItem?.input_json ??                             // Alternative JSON location
        response.output?.[0]?.content?.[0]?.json ??              // Fallback: first content item (GPT-4o)
        response.output?.[0]?.content?.[0]?.input_json ??        // Fallback: first input_json
        textItem?.text ??                                         // Text from text content item
        response.output?.[0]?.content?.[0]?.text ??              // Fallback: first text
        response.output_text ??                                   // Legacy location
        response.text ??
        ""

      if (!rawContent || (typeof rawContent === 'string' && rawContent === '')) {
        console.error('[AI] No content found in OpenAI response:', JSON.stringify({
          hasOutput: !!response.output,
          outputLength: response.output?.length,
          outputText: response.output_text,
          responseKeys: Object.keys(response || {})
        }, null, 2))
        throw new Error('No response from OpenAI')
      }

      // If rawContent is already a parsed object/array (from JSON schema), use it directly
      if (typeof rawContent === 'object' && rawContent !== null && !Array.isArray(rawContent)) {
        // Check if it's the response wrapper (has 'output', 'output_text', 'id')
        if ('output' in rawContent || 'output_text' in rawContent || 'id' in rawContent) {
          // This is the response wrapper - try to extract actual content
          const extracted = rawContent.output_text ?? rawContent.text
          if (extracted && typeof extracted !== 'object') {
            rawContent = extracted
          } else if (extracted && typeof extracted === 'object') {
            return extracted
          } else {
            return rawContent
          }
        } else {
          // Already the parsed AI response content (from JSON schema)
          return rawContent
        }
      } else if (Array.isArray(rawContent)) {
        // Already a parsed array (from JSON schema)
        return rawContent
      }

      // Otherwise, it's a string that needs parsing
      const content = typeof rawContent === 'string' ? rawContent : String(rawContent)

      // Try to parse as JSON, fallback to raw content
      try {
        // Validate content is a string
        if (!content || typeof content !== 'string') {
          console.error('[AI] Invalid content type for parsing:', typeof content, content)
          return { raw: content }
        }

        // Strip markdown code fences first
        let cleanedContent: string = String(content) // Ensure it's definitely a string
        try {
          const codeFenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
          if (codeFenceMatch && codeFenceMatch[1] !== undefined) {
            cleanedContent = codeFenceMatch[1]
          }
        } catch (matchError) {
          // If regex matching fails, use original content
          console.warn('[AI] Regex match failed in callOpenAIWithStructuredOptions, using original content:', matchError)
          cleanedContent = String(content)
        }

        // Validate cleanedContent is still a string
        if (!cleanedContent || typeof cleanedContent !== 'string') {
          console.error('[AI] Invalid cleanedContent after code fence removal:', typeof cleanedContent, cleanedContent)
          return { raw: content }
        }

        // Ensure cleanedContent is still a valid string before calling .match()
        if (!cleanedContent || typeof cleanedContent !== 'string') {
          console.error('[AI] cleanedContent is not a string before regex matching in callOpenAI:', typeof cleanedContent, cleanedContent)
          return { raw: content }
        }

        let objectMatch: RegExpMatchArray | null = null
        let arrayMatch: RegExpMatchArray | null = null

        try {
          objectMatch = cleanedContent.match(/\{[\s\S]*\}/)
        } catch (matchError) {
          console.warn('[AI] Object match failed in callOpenAI:', matchError)
        }

        try {
          arrayMatch = cleanedContent.match(/\[[\s\S]*\]/)
        } catch (matchError) {
          console.warn('[AI] Array match failed in callOpenAI:', matchError)
        }

        if (objectMatch && Array.isArray(objectMatch) && objectMatch[0]) {
          // Prefer object match to preserve full response structure
          return JSON.parse(objectMatch[0])
        } else if (arrayMatch && Array.isArray(arrayMatch) && arrayMatch[0]) {
          return JSON.parse(arrayMatch[0])
        } else {
          return JSON.parse(cleanedContent.trim())
        }
      } catch (parseError) {
        // Return plain text wrapped in object
        return { raw: content }
      }
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  } catch (error) {
    const errorMsg = error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null
        ? JSON.stringify(error, null, 2)
        : String(error)
    console.error('OpenAI API error (structured):', errorMsg)
    throw error
  }
}

// Original function - kept for backward compatibility
export async function callOpenAI(prompt: string, maxTokens = 1000, temperature = 0.3) {
  try {
    // console.log('Calling OpenAI API...') // Commented out to reduce log count

    // Add timeout to prevent hanging
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 180000) // 180s (3min) for GPT-5 // 30 second timeout

    try {
      // console.log('Using GPT-4o model with improved JSON parsing...') // Commented out to reduce log count
      const response = await (openai as any).responses.create({
        model: 'gpt-4o',
        input: [{ role: 'user', content: prompt }],
        max_output_tokens: maxTokens,
        temperature: temperature,
      }, {
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      // Extract content from Responses API format
      // For GPT-5 (reasoning model), search for json_schema content item explicitly
      // since reasoning block may be first item (empty, redacted)
      const outputArray = response.output?.[0]?.content
      const jsonSchemaItem = outputArray?.find((c: any) => c.type === "json_schema")
      const textItem = outputArray?.find((c: any) => c.type === "text")

      let rawContent = jsonSchemaItem?.json ??                    // JSON schema response (GPT-5 compatible)
        jsonSchemaItem?.input_json ??                             // Alternative JSON location
        response.output?.[0]?.content?.[0]?.json ??              // Fallback: first content item (GPT-4o)
        response.output?.[0]?.content?.[0]?.input_json ??        // Fallback: first input_json
        textItem?.text ??                                         // Text from text content item
        response.output?.[0]?.content?.[0]?.text ??              // Fallback: first text
        response.output_text ??                                   // Legacy location
        response.text ??
        ""

      if (!rawContent || (typeof rawContent === 'string' && rawContent === '')) {
        console.error('[AI] No content found in OpenAI response:', JSON.stringify({
          hasOutput: !!response.output,
          outputLength: response.output?.length,
          outputText: response.output_text,
          responseKeys: Object.keys(response || {})
        }, null, 2))
        throw new Error('No response from OpenAI')
      }

      // If rawContent is already a parsed object/array (from JSON schema), use it directly
      // This matches the test endpoint behavior - if it's an object, use it as-is
      if (typeof rawContent === 'object' && rawContent !== null && !Array.isArray(rawContent)) {
        // Check if it's the response wrapper (has 'output', 'output_text', 'id')
        if ('output' in rawContent || 'output_text' in rawContent || 'id' in rawContent) {
          // This is the response wrapper - try to extract actual content
          const extracted = rawContent.output_text ?? rawContent.text
          if (extracted && typeof extracted !== 'object') {
            // Extracted content is a string, continue to parsing
            rawContent = extracted
          } else if (extracted && typeof extracted === 'object') {
            // Extracted content is already parsed, use it
            return extracted
          } else {
            // Can't extract, might be valid response structure
            return rawContent
          }
        } else {
          // Already the parsed AI response content (from JSON schema)
          return rawContent
        }
      } else if (Array.isArray(rawContent)) {
        // Already a parsed array (from JSON schema)
        return rawContent
      }

      // console.log('OpenAI response received') // Commented out to reduce log count

      // Otherwise, it's a string that needs parsing
      const content = typeof rawContent === 'string' ? rawContent : String(rawContent)

      // Try to parse as JSON, fallback to raw content
      try {
        // Validate content is a string
        if (!content || typeof content !== 'string') {
          console.error('[AI] Invalid content type for parsing:', typeof content, content)
          return { raw: content }
        }

        // Strip markdown code fences first (```json ... ``` or ``` ... ```)
        // Match test endpoint logic exactly - it doesn't validate codeFenceMatch[1]
        let cleanedContent: string = String(content) // Ensure it's definitely a string
        try {
          const codeFenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
          if (codeFenceMatch && codeFenceMatch[1] !== undefined) {
            cleanedContent = codeFenceMatch[1]
          }
        } catch (matchError) {
          // If regex matching fails, use original content
          console.warn('[AI] Regex match failed in callOpenAI, using original content:', matchError)
          cleanedContent = String(content)
        }

        // Validate cleanedContent is still a string
        if (!cleanedContent || typeof cleanedContent !== 'string') {
          console.error('[AI] Invalid cleanedContent after code fence removal:', typeof cleanedContent, cleanedContent)
          return { raw: content }
        }

        // Clean the content - remove any text before/after JSON (support both objects {} and arrays [])
        // Match test endpoint logic exactly
        // Ensure cleanedContent is still a valid string before calling .match()
        if (!cleanedContent || typeof cleanedContent !== 'string') {
          console.error('[AI] cleanedContent is not a string before regex matching:', typeof cleanedContent, cleanedContent)
          return { raw: content }
        }

        let objectMatch: RegExpMatchArray | null = null
        let arrayMatch: RegExpMatchArray | null = null

        try {
          objectMatch = cleanedContent.match(/\{[\s\S]*\}/)
        } catch (matchError) {
          console.warn('[AI] Object match failed in callWithStructuredPrompt:', matchError)
        }

        try {
          arrayMatch = cleanedContent.match(/\[[\s\S]*\]/)
        } catch (matchError) {
          console.warn('[AI] Array match failed in callWithStructuredPrompt:', matchError)
        }

        if (objectMatch && Array.isArray(objectMatch) && objectMatch[0]) {
          // Prefer object match to preserve full response structure (e.g., {"bullet_hooks":[],"summary":""})
          return JSON.parse(objectMatch[0])
        } else if (arrayMatch && Array.isArray(arrayMatch) && arrayMatch[0]) {
          // Use array match only if no object wraps it
          return JSON.parse(arrayMatch[0])
        } else {
          // Try parsing the entire content
          return JSON.parse(cleanedContent.trim())
        }
      } catch (parseError) {
        // Not an error - many prompts return plain text, not JSON
        // Wrap in { raw: content } for calling code to extract
        return { raw: content }
      }
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
  } catch (error) {
    console.error('OpenAI API error with GPT-5:', error)
    if (error instanceof Error) {
      console.error('Error details:', error.message)
      console.error('Error name:', error.name)
      console.error('Error stack:', error.stack)
    }
    // Log additional error details for debugging
    if (typeof error === 'object' && error !== null) {
      console.error('Full error object:', JSON.stringify(error, null, 2))
    }
    throw error
  }
}

// Unified AI caller - routes to OpenAI or Claude based on provider
export async function callAI(prompt: string, maxTokens = 1000, temperature = 0.3, provider: 'openai' | 'claude' = 'openai') {
  if (provider === 'claude') {
    // Claude API call
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: maxTokens,
        temperature: temperature,
        messages: [{ role: 'user', content: prompt }]
      })

      const textContent = response.content.find(c => c.type === 'text')
      const content = textContent && 'text' in textContent ? textContent.text : ''

      if (!content) {
        throw new Error('No response from Claude')
      }

      // Try to parse as JSON, fallback to raw content (same logic as OpenAI)
      try {
        // Validate content is a string
        if (!content || typeof content !== 'string') {
          console.error('[AI] Invalid content type for parsing in callAI (Claude):', typeof content, content)
          return { raw: content }
        }

        // Strip markdown code fences first
        let cleanedContent: string = String(content) // Ensure it's definitely a string
        try {
          const codeFenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
          if (codeFenceMatch && codeFenceMatch[1] !== undefined) {
            cleanedContent = codeFenceMatch[1]
          }
        } catch (matchError) {
          console.warn('[AI] Regex match failed in callAI (Claude), using original content:', matchError)
          cleanedContent = String(content)
        }

        // Validate cleanedContent is still a string
        if (!cleanedContent || typeof cleanedContent !== 'string') {
          console.error('[AI] Invalid cleanedContent after code fence removal in callAI (Claude):', typeof cleanedContent, cleanedContent)
          return { raw: content }
        }

        // Ensure cleanedContent is still a valid string before calling .match()
        if (!cleanedContent || typeof cleanedContent !== 'string') {
          console.error('[AI] cleanedContent is not a string before regex matching in callAI (Claude):', typeof cleanedContent, cleanedContent)
          return { raw: content }
        }

        let objectMatch: RegExpMatchArray | null = null
        let arrayMatch: RegExpMatchArray | null = null

        try {
          objectMatch = cleanedContent.match(/\{[\s\S]*\}/)
        } catch (matchError) {
          console.warn('[AI] Object match failed in callAI (Claude):', matchError)
        }

        try {
          arrayMatch = cleanedContent.match(/\[[\s\S]*\]/)
        } catch (matchError) {
          console.warn('[AI] Array match failed in callAI (Claude):', matchError)
        }

        if (objectMatch && Array.isArray(objectMatch) && objectMatch[0]) {
          // Prefer object match to preserve full response structure
          return JSON.parse(objectMatch[0])
        } else if (arrayMatch && Array.isArray(arrayMatch) && arrayMatch[0]) {
          return JSON.parse(arrayMatch[0])
        } else {
          return JSON.parse(cleanedContent.trim())
        }
      } catch (parseError) {
        // Return raw content wrapped in object
        return { raw: content }
      }
    } catch (error) {
      const errorMsg = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null
          ? JSON.stringify(error, null, 2)
          : String(error)
      console.error('Claude API error:', errorMsg)
      throw error
    }
  } else {
    // OpenAI API call (default)
    return callOpenAI(prompt, maxTokens, temperature)
  }
}
