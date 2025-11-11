# AI Prompt System Guide

_Last updated: 2025-11-11_

## When to use this
- You are adding or modifying prompts that power article generation, scoring, subject lines, or welcome copy.
- You need to debug AI output or switch between OpenAI/Claude providers.
- You are onboarding a new publication and must provision prompts in `app_settings`.

Related references:
- @docs/workflows/rss-processing.md — How prompts map to workflow steps
- @docs/workflows/MULTI_CRITERIA_SCORING_GUIDE.md — Criteria prompts and weighting strategy
- @docs/recipes/quick-actions.md — Step-by-step prompt provisioning checklists

## Prompt Storage Model
- Prompts live in Supabase `app_settings` table (`key`, `value`, `newsletter_id`, `ai_provider`).
- The `value` column stores the full JSON payload sent to the AI provider (model, temperature, messages, response format).
- Criteria prompts (for scoring) remain plain text but still reside in `app_settings` (`ai_prompt_criteria_1`, etc.).
- Each tenant maintains its own set keyed by `newsletter_id`; defaults fall back to global entries when tenant-specific key missing.

### Example JSON payload
```jsonc
{
  "model": "gpt-4o",
  "temperature": 0.7,
  "max_output_tokens": 500,
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "title": "PrimaryArticleTitle",
      "type": "object",
      "properties": {
        "headline": { "type": "string" }
      },
      "required": ["headline"]
    }
  },
  "messages": [
    { "role": "system", "content": "You are a concise newsletter editor..." },
    { "role": "user", "content": "Title: {{title}}\nSummary: {{description}}" }
  ]
}
```

## Access Pattern in Code
- Use `callAIWithPrompt(promptKey, newsletterId, variables)` from `src/lib/openai.ts`.
- Internally this:
  1. Resolves `app_settings` record by key + `newsletter_id` (fallback to global key without tenant).
  2. Injects template variables (`{{placeholder}}`) into the prompt JSON.
  3. Invokes OpenAI/Claude client (provider chosen via `ai_provider` column or function override).
  4. Parses JSON response (throws on malformed output).

### Guardrails enforced in code
- Automatic retries for rate limits/transient errors (with backoff).
- Logging limited to high-level messages (`[AI] Batch 1/3: ...`) to meet 10MB cap.
- Provider selection default is OpenAI; override by storing `ai_provider = 'anthropic'` per key.

## Naming Conventions
| Category | Key Prefix | Example |
|----------|------------|---------|
| Article titles | `ai_prompt_primary_article_title` | Title prompt for primary articles |
| Article bodies | `ai_prompt_primary_article_body` | Body generation prompt |
| Secondary content | `ai_prompt_secondary_article_body` | |
| Welcome section | `ai_prompt_welcome_section` | |
| Subject lines | `ai_prompt_subject_line` | |
| Scoring criteria | `ai_prompt_criteria_1` .. `ai_prompt_criteria_5` | Plain text requests |
| Advertorial | `ai_prompt_advertorial_copy` | Optional enhancements |

## Checklist for Adding a New Prompt
1. Define the JSON payload (model, messages, schema) and store in `app_settings` with tenant-specific `newsletter_id` where appropriate.
2. Update code to reference the new key via `callAIWithPrompt`.
3. Add fallback logic if the prompt is optional (avoid hard failures).
4. Document the prompt and its purpose in the relevant feature guide (e.g., @docs/guides/SECONDARY_ARTICLES_IMPLEMENTATION_GUIDE.md).
5. Test locally or in staging; verify structured output matches expected schema.

## Troubleshooting AI Responses
- **Malformed JSON:** Ensure `response_format` schema matches fields parsed in code; if provider outputs plain text, add post-processing or adjust instructions.
- **Rate limits:** Reduce batch size, add `await sleep(2000)` between calls, or use streaming when possible.
- **Unexpected tone:** Update system message and ensure placeholder data (`{{content}}`) is sanitized.
- **Prompt not found:** Confirm `newsletter_id` is passed; fallback global key must exist.

Keeping these rules explicit ensures Claude (and humans) know exactly how to configure and update the AI layer without breaking downstream workflows.
