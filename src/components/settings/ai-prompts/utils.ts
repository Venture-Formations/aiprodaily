/** Detect AI provider from prompt value (auto-detect from model name) */
export function detectProviderFromPrompt(value: any): 'openai' | 'claude' {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    const model = (parsed?.model || '').toLowerCase()
    if (model.includes('claude') || model.includes('sonnet') || model.includes('opus') || model.includes('haiku')) {
      return 'claude'
    }
  } catch (e) {
    // Not valid JSON, default to openai
  }
  return 'openai'
}

/** Format JSON with actual newlines */
export function formatJSON(value: any, prettyPrint: boolean): string {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      const jsonStr = prettyPrint ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed)
      if (prettyPrint) {
        return jsonStr.replace(/\\n/g, '\n')
      }
      return jsonStr
    } catch (e) {
      if (prettyPrint) {
        return value.replace(/\\n/g, '\n')
      }
      return value
    }
  }

  if (typeof value === 'object' && value !== null) {
    const jsonStr = prettyPrint ? JSON.stringify(value, null, 2) : JSON.stringify(value)
    if (prettyPrint) {
      return jsonStr.replace(/\\n/g, '\n')
    }
    return jsonStr
  }

  return String(value)
}

/** Parse AI response against expected outputs */
export function parseResponseOutputs(results: any, expectedOutputs: any): any {
  const parsed: any = {}

  for (const [fieldName, fieldType] of Object.entries(expectedOutputs)) {
    try {
      let responseText = ''
      if (results && typeof results === 'object') {
        const firstResult = Object.values(results)[0] as any
        if (firstResult?.response) {
          if (typeof firstResult.response === 'object' && firstResult.response.raw) {
            responseText = firstResult.response.raw
          } else if (typeof firstResult.response === 'string') {
            responseText = firstResult.response
          } else {
            responseText = JSON.stringify(firstResult.response)
          }
        }
      }

      try {
        const jsonResponse = JSON.parse(responseText)
        if (fieldName in jsonResponse) {
          parsed[fieldName] = { value: jsonResponse[fieldName], error: false }
          continue
        }
      } catch (e) {
        // Not JSON, continue to regex parsing
      }

      const patterns = [
        new RegExp(`"${fieldName}"\\s*:\\s*([^,}]+)`, 'i'),
        new RegExp(`${fieldName}\\s*:\\s*(.+?)(?:\\n|$)`, 'i'),
        new RegExp(`${fieldName}\\s*=\\s*(.+?)(?:\\n|$)`, 'i')
      ]

      let found = false
      for (const pattern of patterns) {
        const match = responseText.match(pattern)
        if (match && match[1]) {
          parsed[fieldName] = { value: match[1].trim().replace(/^["']|["']$/g, ''), error: false }
          found = true
          break
        }
      }

      if (!found) {
        parsed[fieldName] = { value: null, error: true }
      }
    } catch (e) {
      parsed[fieldName] = { value: null, error: true }
    }
  }

  return parsed
}

/** Map prompt keys to their test endpoint type parameter */
export const PROMPT_TYPE_MAP: Record<string, string> = {
  'ai_prompt_content_evaluator': 'contentEvaluator',
  'ai_prompt_newsletter_writer': 'newsletterWriter',
  'ai_prompt_subject_line': 'subjectLineGenerator',
  'ai_prompt_event_summary': 'eventSummarizer',
  'ai_prompt_road_work': 'roadWorkGenerator',
  'ai_prompt_image_analyzer': 'imageAnalyzer',
  'ai_prompt_primary_article_title': 'primaryArticleTitle',
  'ai_prompt_primary_article_body': 'primaryArticleBody',
  'ai_prompt_secondary_article_title': 'secondaryArticleTitle',
  'ai_prompt_secondary_article_body': 'secondaryArticleBody',
  'ai_prompt_fact_checker': 'factChecker',
  'ai_prompt_welcome_section': 'welcomeSection',
  'ai_prompt_topic_deduper': 'topicDeduper'
}
