// Re-export shim: '@/lib/openai' continues to work for all existing consumers.
// New code that doesn't need DB-backed prompt loading should prefer direct
// sub-path imports (e.g. '@/lib/openai/core' for the pure AI dispatcher) to
// avoid the supabase + prompt-repo transitive imports the barrel pulls in.
export { openai, anthropic } from './clients'
export type { OpenAICallOptions, StructuredPromptConfig } from './types'
export { callWithStructuredPrompt } from './core'
export { callAIWithPrompt } from './with-prompt'
export { AI_CALL } from './ai-call'
export { callOpenAI } from './legacy'
export { extractResponseContent, parseAIResponseJSON } from './response-parser'
