// Re-export shim: all downstream consumers importing from '@/lib/openai' continue to work
export { openai, anthropic } from './clients'
export type { OpenAICallOptions, StructuredPromptConfig } from './types'
export { callWithStructuredPrompt, callAIWithPrompt } from './core'
export { AI_CALL } from './ai-call'
export { callOpenAI } from './legacy'
export { extractResponseContent, parseAIResponseJSON } from './response-parser'
