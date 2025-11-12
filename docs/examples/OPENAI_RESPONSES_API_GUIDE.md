# OpenAI Responses API Migration Guide

**Last Updated:** 2025-01-22
**Status:** Active - All code migrated to Responses API

---

## 🎯 Overview

This guide explains the migration from OpenAI's **Chat Completions API** to the newer **Responses API**, including how to handle both APIs during a transition period.

### What Changed?

OpenAI introduced the Responses API as a more structured way to interact with their models. The key differences:

| Aspect | Chat Completions API (Old) | Responses API (New) |
|--------|---------------------------|---------------------|
| **Method** | `openai.chat.completions.create()` | `openai.responses.create()` |
| **Input** | `messages` array | `input` array (same structure) |
| **Output** | `choices[0].message.content` | `output[0].content` |
| **Structure** | Simpler, text-focused | Structured, multi-content support |
| **JSON Mode** | `response_format: {type: "json"}` | `response_format: {type: "json_schema", json_schema: {...}}` |

---

## 🔄 Migration Steps

### Step 1: Update the API Call

**Before (Chat Completions):**
```typescript
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ],
  temperature: 0.7,
  max_tokens: 1000,
  response_format: { type: "json_object" }
})

const content = response.choices[0]?.message?.content
```

**After (Responses API):**
```typescript
const response = await (openai as any).responses.create({
  model: 'gpt-4o',
  input: [  // Changed from "messages" to "input"
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ],
  temperature: 0.7,
  max_output_tokens: 1000,  // Changed from "max_tokens"
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "ResponseSchema",
      schema: {
        type: "object",
        properties: {
          // Define your schema here
        },
        required: ["field1"],
        additionalProperties: false
      },
      strict: true
    }
  }
})

// Changed response extraction
const content = response.output?.[0]?.content
```

**Key Changes:**
1. Method: `chat.completions.create()` → `responses.create()`
2. Parameter: `messages` → `input`
3. Parameter: `max_tokens` → `max_output_tokens`
4. Response: `choices[0].message.content` → `output[0].content`
5. JSON Mode: Now requires full JSON schema (more strict)

---

### Step 2: Handle Response Content

The Responses API returns more structured content with multiple possible locations:

```typescript
// Extract content from Responses API format
const outputArray = response.output?.[0]?.content

// For structured (JSON schema) responses
const jsonSchemaItem = outputArray?.find((c: any) => c.type === "json_schema")
const structuredData = jsonSchemaItem?.json ?? jsonSchemaItem?.input_json

// For text responses
const textItem = outputArray?.find((c: any) => c.type === "text")
const textContent = textItem?.text

// Fallback chain (handles different response formats)
let rawContent = jsonSchemaItem?.json ??
  jsonSchemaItem?.input_json ??
  response.output?.[0]?.content?.[0]?.json ??
  response.output?.[0]?.content?.[0]?.input_json ??
  textItem?.text ??
  response.output?.[0]?.content?.[0]?.text ??
  response.output_text ??
  response.text ??
  ""
```

---

## 🏗️ Project Implementation Pattern

### Current Implementation: `callWithStructuredPrompt()`

Located in: `src/lib/openai.ts`

This function handles both OpenAI and Claude providers, with full Responses API support:

```typescript
async function callWithStructuredPrompt(
  promptJSON: any,
  placeholders: Record<string, string> = {},
  provider: 'openai' | 'claude' = 'openai',
  promptKey?: string
): Promise<any> {
  // ... (setup code)

  if (provider === 'openai') {
    // Convert messages → input for Responses API
    const processedRequest = {
      ...promptJSON,
      input: promptJSON.messages,  // Rename messages to input
    }
    delete processedRequest.messages

    // Call Responses API
    const response = await (openai as any).responses.create(processedRequest, {
      signal: controller.signal
    })

    // Extract content with fallback chain
    const outputArray = response.output?.[0]?.content
    const jsonSchemaItem = outputArray?.find((c: any) => c.type === "json_schema")
    const textItem = outputArray?.find((c: any) => c.type === "text")

    let rawContent = jsonSchemaItem?.json ??
      jsonSchemaItem?.input_json ??
      response.output?.[0]?.content?.[0]?.json ??
      textItem?.text ??
      ""

    // Handle parsed objects vs strings
    if (typeof rawContent === 'object' && rawContent !== null) {
      return rawContent  // Already parsed
    }

    // Parse string content
    return JSON.parse(rawContent)
  }
}
```

---

## 📋 Migration Checklist

### For Each API Call:

- [ ] Replace `openai.chat.completions.create()` with `(openai as any).responses.create()`
- [ ] Change parameter: `messages` → `input`
- [ ] Change parameter: `max_tokens` → `max_output_tokens`
- [ ] Update response extraction: `choices[0].message.content` → `output[0].content`
- [ ] Handle structured content (see content extraction pattern)
- [ ] Update JSON schema (if using JSON mode)
- [ ] Test with actual API calls

---

## 🎨 Response Content Types

The Responses API can return multiple content types in a single response:

### 1. JSON Schema Content

For structured JSON responses:

```typescript
const jsonSchemaItem = outputArray?.find((c: any) => c.type === "json_schema")
const data = jsonSchemaItem?.json  // Parsed JSON object
```

**Example Response:**
```json
{
  "output": [{
    "content": [{
      "type": "json_schema",
      "json": {
        "headline": "Your Article Title",
        "summary": "Article summary here"
      }
    }]
  }]
}
```

### 2. Text Content

For plain text responses:

```typescript
const textItem = outputArray?.find((c: any) => c.type === "text")
const text = textItem?.text  // Plain string
```

**Example Response:**
```json
{
  "output": [{
    "content": [{
      "type": "text",
      "text": "This is the response text"
    }]
  }]
}
```

### 3. Reasoning Content (GPT-5/o1/o3)

For reasoning models, there may be a reasoning block:

```typescript
const reasoningItem = outputArray?.find((c: any) => c.type === "reasoning")
const reasoning = reasoningItem?.text  // Often empty/redacted
```

**Pattern for GPT-5:**
```typescript
// GPT-5 may have empty reasoning block, then actual content
// Always search for json_schema item explicitly
const outputArray = response.output?.[0]?.content
const jsonSchemaItem = outputArray?.find((c: any) => c.type === "json_schema")
const textItem = outputArray?.find((c: any) => c.type === "text")

// Use whichever is present
const content = jsonSchemaItem?.json ?? textItem?.text
```

---

## 🔧 Common Patterns

### Pattern 1: Simple Text Generation

```typescript
const response = await (openai as any).responses.create({
  model: 'gpt-4o',
  input: [
    { role: 'user', content: 'Write a short poem about AI' }
  ],
  temperature: 0.7,
  max_output_tokens: 500
})

const poem = response.output?.[0]?.content?.[0]?.text
```

### Pattern 2: Structured JSON Response

```typescript
const response = await (openai as any).responses.create({
  model: 'gpt-4o',
  input: [
    { role: 'system', content: 'You are a JSON generator' },
    { role: 'user', content: 'Generate a user profile' }
  ],
  temperature: 0.3,
  max_output_tokens: 1000,
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "UserProfile",
      schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
          email: { type: "string" }
        },
        required: ["name", "email"],
        additionalProperties: false
      },
      strict: true
    }
  }
})

// Extract JSON
const outputArray = response.output?.[0]?.content
const jsonItem = outputArray?.find((c: any) => c.type === "json_schema")
const profile = jsonItem?.json  // { name: "...", age: 30, email: "..." }
```

### Pattern 3: Web Search (Responses API Feature)

```typescript
const response = await (openai as any).responses.create({
  model: 'gpt-4o',
  tools: [{ type: 'web_search_preview' }],
  input: [
    { role: 'system', content: 'You are a research assistant' },
    { role: 'user', content: 'What are the latest AI trends in 2025?' }
  ],
  temperature: 0
})

const content = response.output?.[0]?.content?.[0]?.text
```

---

## 🚨 Common Gotchas

### 1. TypeScript Typing Issue

The Responses API is not yet in OpenAI's TypeScript types, so you need to cast:

```typescript
// Required:
const response = await (openai as any).responses.create(...)

// Will fail:
const response = await openai.responses.create(...)  // TS error
```

### 2. Response Structure Varies by Model

Different models return content in slightly different structures:

```typescript
// GPT-4o: Usually straightforward
response.output[0].content[0].json

// GPT-5: May have empty reasoning block first
const jsonItem = response.output[0].content.find(c => c.type === "json_schema")
jsonItem.json
```

**Solution:** Always use the fallback chain (see content extraction pattern).

### 3. JSON Schema is Strict

The `response_format` now requires a full JSON schema:

```typescript
// ❌ OLD (no longer works)
response_format: { type: "json_object" }

// ✅ NEW (required)
response_format: {
  type: "json_schema",
  json_schema: {
    name: "ResponseSchema",
    schema: {
      type: "object",
      properties: { /* define all fields */ },
      required: ["field1"],
      additionalProperties: false
    },
    strict: true
  }
}
```

### 4. Already Parsed JSON

Unlike Chat Completions (which returns strings), Responses API may return already-parsed JSON:

```typescript
// Chat Completions: Always string
const data = JSON.parse(response.choices[0].message.content)

// Responses API: May already be parsed
const rawContent = response.output[0].content[0].json  // Already an object!
if (typeof rawContent === 'object') {
  return rawContent  // Use directly
} else {
  return JSON.parse(rawContent)  // Parse if string
}
```

---

## 🔍 Debugging Tips

### 1. Log Full Response Structure

```typescript
console.log('[DEBUG] Full OpenAI response:', JSON.stringify(response, null, 2))
console.log('[DEBUG] Output array:', JSON.stringify(response.output?.[0]?.content, null, 2))
```

### 2. Check Content Types

```typescript
const contentTypes = response.output?.[0]?.content?.map((c: any) => c.type)
console.log('[DEBUG] Content types present:', contentTypes)
// Example: ["reasoning", "json_schema"] or ["text"]
```

### 3. Validate Schema Matches

```typescript
// If getting empty/null responses, check:
console.log('[DEBUG] Has output?', !!response.output)
console.log('[DEBUG] Output length:', response.output?.length)
console.log('[DEBUG] Response keys:', Object.keys(response || {}))
```

---

## 📚 Reference: Complete Parameter Mapping

| Chat Completions | Responses API | Notes |
|-----------------|---------------|-------|
| `messages` | `input` | Same structure, different name |
| `max_tokens` | `max_output_tokens` | Renamed for clarity |
| `n` | Not supported | Generate 1 response per call |
| `stream` | `stream` | Both support streaming |
| `stop` | `stop` | Same |
| `temperature` | `temperature` | Same (0-2) |
| `top_p` | `top_p` | Same |
| `presence_penalty` | `presence_penalty` | Same |
| `frequency_penalty` | `frequency_penalty` | Same |
| `logit_bias` | `logit_bias` | Same |
| `user` | `metadata.user_id` | Restructured |
| `response_format` | `response_format` | Now requires full schema |
| N/A | `tools` | New: web_search, etc. |

---

## 🎯 Quick Migration Example

**Before (complete example):**
```typescript
import OpenAI from 'openai'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function generateSummary(text: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are a summarizer' },
      { role: 'user', content: `Summarize: ${text}` }
    ],
    temperature: 0.3,
    max_tokens: 500
  })

  const summary = response.choices[0]?.message?.content
  return summary
}
```

**After (complete example):**
```typescript
import OpenAI from 'openai'
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function generateSummary(text: string) {
  const response = await (openai as any).responses.create({
    model: 'gpt-4o',
    input: [  // Changed from messages
      { role: 'system', content: 'You are a summarizer' },
      { role: 'user', content: `Summarize: ${text}` }
    ],
    temperature: 0.3,
    max_output_tokens: 500  // Changed from max_tokens
  })

  // Changed response extraction
  const outputArray = response.output?.[0]?.content
  const textItem = outputArray?.find((c: any) => c.type === "text")
  const summary = textItem?.text ?? response.output?.[0]?.content?.[0]?.text

  return summary
}
```

---

## 🔄 Handling Both APIs (Transition Period)

If you need to support both APIs during migration:

```typescript
async function callAI(config: {
  model: string
  messages: Array<{ role: string, content: string }>
  temperature?: number
  maxTokens?: number
  useResponsesAPI?: boolean
}) {
  const { model, messages, temperature = 0.7, maxTokens = 1000, useResponsesAPI = true } = config

  if (useResponsesAPI) {
    // New Responses API
    const response = await (openai as any).responses.create({
      model,
      input: messages,
      temperature,
      max_output_tokens: maxTokens
    })

    const outputArray = response.output?.[0]?.content
    const textItem = outputArray?.find((c: any) => c.type === "text")
    return textItem?.text ?? response.output?.[0]?.content?.[0]?.text
  } else {
    // Old Chat Completions API
    const response = await openai.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    })

    return response.choices[0]?.message?.content
  }
}
```

---

## 📖 Additional Resources

- **OpenAI Responses API Docs:** [platform.openai.com/docs/api-reference/responses](https://platform.openai.com/docs/api-reference/responses)
- **Project Implementation:** `src/lib/openai.ts` (see `callWithStructuredPrompt()`)
- **Example Usage:** `src/lib/rss-processor.ts` (see AI calls)
- **Test Endpoint:** `src/app/api/ai/test-prompt/route.ts`

---

## 🎓 Best Practices

### 1. Always Use Fallback Chain

```typescript
// ✅ GOOD: Multiple fallbacks
const content = jsonItem?.json ??
  textItem?.text ??
  response.output?.[0]?.content?.[0]?.text ??
  ""

// ❌ BAD: Single location (brittle)
const content = response.output[0].content[0].json
```

### 2. Type Check Before Parsing

```typescript
// ✅ GOOD: Check if already parsed
if (typeof rawContent === 'object' && rawContent !== null) {
  return rawContent  // Already parsed
}
return JSON.parse(rawContent)  // Parse string

// ❌ BAD: Always parse
return JSON.parse(rawContent)  // Fails if already object
```

### 3. Provide Detailed JSON Schemas

```typescript
// ✅ GOOD: Full schema with all fields
response_format: {
  type: "json_schema",
  json_schema: {
    name: "ArticleSummary",
    schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Article title" },
        summary: { type: "string", description: "Brief summary" },
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Key topics"
        }
      },
      required: ["title", "summary"],
      additionalProperties: false
    },
    strict: true
  }
}

// ❌ BAD: Minimal schema (AI may not follow)
response_format: { type: "json_object" }  // Deprecated
```

### 4. Handle Timeouts

```typescript
// ✅ GOOD: Use AbortController
const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 180000)  // 3 minutes

try {
  const response = await (openai as any).responses.create(request, {
    signal: controller.signal
  })
  clearTimeout(timeoutId)
  return response
} catch (error) {
  clearTimeout(timeoutId)
  throw error
}
```

---

## ✅ Migration Verification

### Checklist for Completed Migration:

- [ ] All `chat.completions.create()` replaced with `responses.create()`
- [ ] All `messages` changed to `input`
- [ ] All `max_tokens` changed to `max_output_tokens`
- [ ] All response extractions updated to use `output[0].content`
- [ ] JSON schemas updated (if using structured output)
- [ ] Fallback chains implemented for content extraction
- [ ] Type checks added before JSON parsing
- [ ] All API calls tested with actual requests
- [ ] Error handling verified
- [ ] Logs updated to reflect new API

---

**Document Version:** 1.0
**Last Updated:** 2025-01-22
**Migration Status:** ✅ Complete (all code migrated)
