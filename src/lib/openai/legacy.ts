import { openai } from './clients'
import { extractResponseContent, parseAIResponseJSON } from './response-parser'

// Original function - kept for backward compatibility
export async function callOpenAI(prompt: string, maxTokens = 1000, temperature = 0.3) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 180000) // 180s (3min) for GPT-5

  try {
    const response = await (openai as any).responses.create({
      model: 'gpt-4o',
      input: [{ role: 'user', content: prompt }],
      max_output_tokens: maxTokens,
      temperature: temperature,
    }, {
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    const rawContent = extractResponseContent(response)

    // If already parsed (object/array from JSON schema), return directly
    if (typeof rawContent !== 'string') {
      return rawContent
    }

    return parseAIResponseJSON(rawContent)
  } catch (error) {
    clearTimeout(timeoutId)
    console.error('OpenAI API error:', error instanceof Error ? error.message : String(error))
    throw error
  }
}
