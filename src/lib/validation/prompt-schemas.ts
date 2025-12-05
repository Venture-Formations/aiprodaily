import { z } from 'zod'

/**
 * Schema for OpenAI JSON prompt structure (stored in app_settings)
 * Validates the complete API request structure
 */
export const OpenAIPromptSchema = z.object({
  model: z.enum([
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-3.5-turbo'
  ]),
  temperature: z.number()
    .min(0, 'Temperature must be at least 0')
    .max(2, 'Temperature must be at most 2'),
  max_output_tokens: z.number()
    .int('max_output_tokens must be an integer')
    .min(1, 'max_output_tokens must be at least 1')
    .max(16000, 'max_output_tokens must be at most 16000'),
  response_format: z.object({
    type: z.enum(['json_schema', 'text']),
    json_schema: z.object({
      name: z.string(),
      strict: z.boolean().optional(),
      schema: z.record(z.string(), z.any()) // JSON Schema object
    }).optional()
  }).optional(),
  messages: z.array(
    z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string()
    })
  ).min(1, 'At least one message is required')
})

/**
 * Schema for Claude prompt structure
 */
export const ClaudePromptSchema = z.object({
  model: z.enum([
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229'
  ]),
  temperature: z.number().min(0).max(1),
  max_tokens: z.number().int().min(1).max(8192),
  system: z.string().optional(),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string()
    })
  ).min(1)
})

/**
 * Schema for criteria configuration
 */
export const CriteriaConfigSchema = z.object({
  criteria_enabled_count: z.number().int().min(1).max(5),
  criteria_1_name: z.string().min(1).max(100),
  criteria_1_weight: z.number().min(0.1).max(10),
  criteria_2_name: z.string().min(1).max(100).optional(),
  criteria_2_weight: z.number().min(0.1).max(10).optional(),
  criteria_3_name: z.string().min(1).max(100).optional(),
  criteria_3_weight: z.number().min(0.1).max(10).optional(),
  criteria_4_name: z.string().min(1).max(100).optional(),
  criteria_4_weight: z.number().min(0.1).max(10).optional(),
  criteria_5_name: z.string().min(1).max(100).optional(),
  criteria_5_weight: z.number().min(0.1).max(10).optional(),
})

/**
 * Helper: Validate prompt from app_settings
 * Use this when loading prompts from database
 */
export function validateOpenAIPrompt(jsonValue: any) {
  try {
    return OpenAIPromptSchema.parse(jsonValue)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[Validation] Invalid OpenAI prompt structure:', error.issues)
      throw new Error(`Invalid prompt configuration: ${error.issues.map(e => e.message).join(', ')}`)
    }
    throw error
  }
}

/**
 * Helper: Validate criteria config
 */
export function validateCriteriaConfig(config: any) {
  try {
    return CriteriaConfigSchema.parse(config)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[Validation] Invalid criteria config:', error.issues)
      throw new Error(`Invalid criteria configuration: ${error.issues.map(e => e.message).join(', ')}`)
    }
    throw error
  }
}

/**
 * TypeScript types
 */
export type OpenAIPrompt = z.infer<typeof OpenAIPromptSchema>
export type ClaudePrompt = z.infer<typeof ClaudePromptSchema>
export type CriteriaConfig = z.infer<typeof CriteriaConfigSchema>
