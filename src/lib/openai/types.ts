// Enhanced OpenAI call with support for structured prompts (system + examples + user)
export interface OpenAICallOptions {
  systemPrompt?: string
  examples?: Array<{ role: 'assistant', content: string }>
  userPrompt?: string
  maxTokens?: number
  temperature?: number
  topP?: number
  presencePenalty?: number
  frequencyPenalty?: number
}

// Interface for structured prompt stored in database
export interface StructuredPromptConfig {
  model?: string
  max_output_tokens?: number
  temperature?: number
  top_p?: number
  response_format?: any  // Allow any response_format structure
  text?: any  // OpenAI Responses API format (for JSON schema, etc.)
  messages?: Array<{
    role: 'system' | 'assistant' | 'user'
    content: string | any  // Allow string or array (Responses API format)
  }>
  input?: Array<{
    role: 'system' | 'assistant' | 'user'
    content: string | any  // Responses API uses content as array
  }>  // OpenAI Responses API uses 'input' instead of 'messages'
}
