export type Provider = 'openai' | 'claude'
export type PromptType = string // Dynamic: 'module-{id}-title', 'module-{id}-body', 'post-scorer', 'subject-line', 'custom'

export interface ArticleModule {
  id: string
  name: string
  display_order: number
  is_active: boolean
}

export interface RSSPost {
  id: string
  title: string
  description: string | null
  full_article_text: string | null
  source_url: string | null
  publication_date: string | null
  used_in_issue_date?: string
  generated_headline?: string
  total_score?: number
}

export interface TestResult {
  timestamp: Date
  provider: Provider
  model: string
  promptType: PromptType
  response: string | { raw?: string; [key: string]: any }
  tokensUsed?: number
  duration: number
  apiRequest?: any
  isMultiple?: boolean
  responses?: string[]
  fullApiResponse?: any
  fullApiResponses?: any[]
  sourcePosts?: Array<{
    id: string
    title: string
    description: string | null
    content: string | null
    source_url: string | null
    publication_date: string | null
  }>
  sourceIssues?: Array<{
    id: string
    date: string
    sent_at: string
  }>
  isCustomFreeform?: boolean
}

export interface SavedPrompt {
  id: string
  prompt: string
  updated_at: string
}

export const OPENAI_MODELS = [
  'gpt-5',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-4',
  'gpt-3.5-turbo'
]

export const CLAUDE_MODELS = [
  'claude-sonnet-4-5-20250929',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307'
]

/** Extract module ID from prompt type like 'module-{id}-title' */
export function getModuleIdFromPromptType(type: PromptType): string | null {
  const match = type.match(/^module-(.+)-(title|body)$/)
  return match ? match[1] : null
}

/** Get prompt category (title or body) from prompt type */
export function getPromptCategory(type: PromptType): 'title' | 'body' | 'other' {
  if (type.endsWith('-title')) return 'title'
  if (type.endsWith('-body')) return 'body'
  return 'other'
}

/** Get expected response hint based on prompt type */
export function getExpectedResponseHint(type: PromptType): string | null {
  if (type.endsWith('-title')) {
    return 'Expects: Plain text OR { "headline": "<text>" }'
  }
  if (type.endsWith('-body')) {
    return 'Expects: { "content": "<text>", "word_count": <integer> }'
  }
  if (type === 'post-scorer') {
    return 'Expects: { "score": <0-10>, "reason": "<explanation>" }'
  }
  if (type === 'subject-line') {
    return 'Expects: Plain text (max 40 characters)'
  }
  if (type === 'custom') {
    return 'Expects: User-defined response format'
  }
  return null
}

/** Sanitize JSON string to fix common copy-paste issues.
 *  JSON strings cannot contain actual newlines/control chars - they must be escaped. */
export function sanitizeJsonString(input: string): string {
  let result = input
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()

  const firstBrace = result.indexOf('{')
  const lastBrace = result.lastIndexOf('}')

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    result = result.slice(firstBrace, lastBrace + 1)
  }

  let fixed = ''
  let inString = false
  let i = 0

  while (i < result.length) {
    const char = result[i]

    if (char === '\\' && inString && i + 1 < result.length) {
      const nextChar = result[i + 1]
      const nextCode = nextChar.charCodeAt(0)
      if (nextCode >= 0x20 && nextCode !== 0x7F) {
        fixed += char + nextChar
        i += 2
        continue
      }
      fixed += char
      i++
      continue
    }

    if (char === '"') {
      inString = !inString
      fixed += char
      i++
      continue
    }

    if (inString) {
      const code = char.charCodeAt(0)
      if (code === 0x0A) {
        fixed += '\\n'
      } else if (code === 0x0D) {
        fixed += '\\r'
      } else if (code === 0x09) {
        fixed += '\\t'
      } else if (code < 0x20 || code === 0x7F) {
        fixed += '\\u' + code.toString(16).padStart(4, '0')
      } else {
        fixed += char
      }
    } else {
      fixed += char
    }
    i++
  }

  return fixed
}
