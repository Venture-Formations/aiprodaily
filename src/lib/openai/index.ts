// Re-export shim: all downstream consumers importing from '@/lib/openai' continue to work
export { openai, anthropic } from './clients'
export type { OpenAICallOptions, StructuredPromptConfig } from './types'
export { AI_PROMPTS } from './prompt-loaders'
export { callWithStructuredPrompt, callAIWithPrompt } from './core'
export { AI_CALL } from './ai-call'
export { callOpenAI, callOpenAIStructured, callAI, callOpenAIWithWeb } from './legacy'
export { callOpenAIWithWebSearch } from './web-search'
