// @ts-nocheck

/**
 * Example: How to add Zod validation to openai.ts
 * This shows how to validate AI prompts from app_settings
 */

import { validateOpenAIPrompt } from '@/lib/validation/prompt-schemas'

// ============================================
// BEFORE (Current code - no validation)
// ============================================

async function getPromptJSON_BEFORE(key: string, newsletterId: string): Promise<any> {
  const { data, error } = await supabaseAdmin
    .from('app_settings')
    .select('value, ai_provider')
    .eq('newsletter_id', newsletterId)
    .eq('key', key)
    .single()

  if (error || !data) {
    throw new Error(`Prompt ${key} not found`)
  }

  // ❌ No validation - could have wrong structure
  const promptJSON = typeof data.value === 'string'
    ? JSON.parse(data.value)
    : data.value

  // ❌ These could fail at runtime
  // - missing 'messages' array
  // - invalid model name
  // - temperature out of range (e.g., 10)
  // - max_output_tokens too high (e.g., 999999)

  return promptJSON
}

// ============================================
// AFTER (With Zod validation)
// ============================================

async function getPromptJSON_AFTER(key: string, newsletterId: string): Promise<any> {
  const { data, error } = await supabaseAdmin
    .from('app_settings')
    .select('value, ai_provider')
    .eq('newsletter_id', newsletterId)
    .eq('key', key)
    .single()

  if (error || !data) {
    throw new Error(`Prompt ${key} not found`)
  }

  // Parse JSON
  const promptJSON = typeof data.value === 'string'
    ? JSON.parse(data.value)
    : data.value

  // ✅ Validate with Zod (throws clear error if invalid)
  try {
    const validated = validateOpenAIPrompt(promptJSON)

    // ✅ TypeScript now knows the exact structure:
    // validated.model - Type: 'gpt-4o' | 'gpt-4o-mini' | ...
    // validated.temperature - Type: number (0-2)
    // validated.max_output_tokens - Type: number (1-16000)
    // validated.messages - Type: Array<{role, content}>

    return validated

  } catch (validationError) {
    // Clear error message for debugging
    console.error(`[Validation] Invalid prompt structure for ${key}:`, validationError)
    throw new Error(`Prompt ${key} has invalid structure. Please check the configuration.`)
  }
}

// ============================================
// REAL-WORLD BENEFIT: Catch config errors early
// ============================================

/**
 * Scenario: Someone accidentally saves a bad prompt config
 */

// BAD CONFIG in database:
const badConfig = {
  model: 'gpt-5',  // ❌ Invalid model (doesn't exist)
  temperature: 10,  // ❌ Out of range (max is 2)
  max_output_tokens: 999999,  // ❌ Too high (max is 16000)
  messages: 'invalid'  // ❌ Should be array
}

// ❌ WITHOUT Zod: Fails later when calling OpenAI API
// - Wastes API call
// - Cryptic OpenAI error message
// - Hard to debug which prompt is wrong

// ✅ WITH Zod: Fails immediately with clear error
// Error: Validation failed
// - field: model, message: Invalid enum value. Expected 'gpt-4o' | 'gpt-4o-mini' | ..., received 'gpt-5'
// - field: temperature, message: Temperature must be at most 2
// - field: max_output_tokens, message: max_output_tokens must be at most 16000
// - field: messages, message: Expected array, received string

// ============================================
// BONUS: Validate on save (prevent bad configs)
// ============================================

/**
 * Add to your settings update API route
 * Validates BEFORE saving to database
 */
export async function POST_savePromptConfig(request: Request) {
  const { key, value, newsletterId } = await request.json()

  // ✅ Validate before saving
  try {
    validateOpenAIPrompt(value)
  } catch (error) {
    return Response.json({
      error: 'Invalid prompt configuration',
      details: error.errors
    }, { status: 400 })
  }

  // Only save if validation passes
  await supabaseAdmin
    .from('app_settings')
    .upsert({ key, value, newsletter_id: newsletterId })

  return Response.json({ success: true })
}

// ============================================
// MIGRATION HELPER: Validate existing prompts
// ============================================

/**
 * Run this to check all existing prompts in database
 * Finds any with invalid structure
 */
async function auditAllPrompts(newsletterId: string) {
  const { data: prompts } = await supabaseAdmin
    .from('app_settings')
    .select('key, value, ai_provider')
    .eq('newsletter_id', newsletterId)
    .like('key', 'ai_prompt_%')

  const results = []

  for (const prompt of prompts || []) {
    try {
      if (prompt.ai_provider === 'openai') {
        validateOpenAIPrompt(prompt.value)
        results.push({ key: prompt.key, status: '✅ Valid' })
      }
    } catch (error) {
      results.push({
        key: prompt.key,
        status: '❌ Invalid',
        errors: error.errors
      })
    }
  }

  return results
}

// Example output:
// [
//   { key: 'ai_prompt_primary_article_title', status: '✅ Valid' },
//   { key: 'ai_prompt_secondary_article_body', status: '❌ Invalid', errors: [...] },
// ]
