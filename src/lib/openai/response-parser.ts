/**
 * Shared helpers for extracting and parsing AI response content.
 * Used by both core.ts (callWithStructuredPrompt) and legacy.ts (callOpenAI).
 */

/**
 * Extract text/JSON content from an OpenAI Responses API response object.
 * Handles GPT-4o, GPT-5, json_schema items, text items, and response wrappers.
 *
 * Returns the extracted value directly (parsed object/array) when the response
 * is already structured, or a string when further parsing is needed.
 * Throws if no content is found.
 */
export function extractResponseContent(response: any): any {
  const outputArray = response.output?.[0]?.content
  const jsonSchemaItem = outputArray?.find((c: any) => c.type === 'json_schema')
  const textItem = outputArray?.find((c: any) => c.type === 'text')

  let rawContent =
    jsonSchemaItem?.json ??
    jsonSchemaItem?.input_json ??
    response.output?.[0]?.content?.[0]?.json ??
    response.output?.[0]?.content?.[0]?.input_json ??
    textItem?.text ??
    response.output?.[0]?.content?.[0]?.text ??
    response.output_text ??
    response.text ??
    ''

  if (!rawContent || (typeof rawContent === 'string' && rawContent === '')) {
    console.error('[AI] No content found in OpenAI response:', JSON.stringify({
      hasOutput: !!response.output,
      outputLength: response.output?.length,
      outputText: response.output_text,
      responseKeys: Object.keys(response || {})
    }, null, 2))
    throw new Error('No response from OpenAI')
  }

  // If rawContent is already a parsed object (from JSON schema), unwrap or return it
  if (typeof rawContent === 'object' && !Array.isArray(rawContent)) {
    if ('output' in rawContent || 'output_text' in rawContent || 'id' in rawContent) {
      // Response wrapper — try to extract actual content
      const extracted = rawContent.output_text ?? rawContent.text
      if (extracted && typeof extracted !== 'object') {
        return extracted // string, will be parsed downstream
      } else if (extracted && typeof extracted === 'object') {
        return extracted // already parsed
      }
      return rawContent // can't unwrap further
    }
    return rawContent // already the parsed AI response content
  }

  if (Array.isArray(rawContent)) {
    return rawContent // already a parsed array
  }

  // Return as string for downstream JSON parsing
  return typeof rawContent === 'string' ? rawContent : String(rawContent)
}

/**
 * Parse a string that may contain JSON into a structured object.
 * Pipeline: strip code fences -> extract object/array via regex -> JSON.parse -> { raw } fallback.
 */
export function parseAIResponseJSON(content: string): any {
  try {
    if (!content || typeof content !== 'string') {
      return { raw: content }
    }

    // Strip markdown code fences (```json ... ``` or ``` ... ```)
    let cleaned: string = content
    const codeFenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (codeFenceMatch && codeFenceMatch[1] !== undefined) {
      cleaned = codeFenceMatch[1]
    }

    if (!cleaned || typeof cleaned !== 'string') {
      return { raw: content }
    }

    // Extract JSON object or array
    const objectMatch = cleaned.match(/\{[\s\S]*\}/)
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/)

    if (objectMatch?.[0]) {
      return JSON.parse(objectMatch[0])
    } else if (arrayMatch?.[0]) {
      return JSON.parse(arrayMatch[0])
    } else {
      return JSON.parse(cleaned.trim())
    }
  } catch {
    // Not an error — many prompts return plain text, not JSON
    return { raw: content }
  }
}
