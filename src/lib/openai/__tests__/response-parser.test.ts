import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseAIResponseJSON, extractResponseContent } from '../response-parser'

// Suppress production console.error called by extractResponseContent's
// "no content found" diagnostic logging — keeps CI logs clean.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('parseAIResponseJSON', () => {
  it('parses a plain JSON object string', () => {
    expect(parseAIResponseJSON('{"a":1,"b":"x"}')).toEqual({ a: 1, b: 'x' })
  })

  it('parses a plain JSON array string', () => {
    expect(parseAIResponseJSON('[1,2,3]')).toEqual([1, 2, 3])
  })

  it('strips a json-labeled markdown code fence', () => {
    const input = '```json\n{"a":1}\n```'
    expect(parseAIResponseJSON(input)).toEqual({ a: 1 })
  })

  it('strips an unlabeled markdown code fence', () => {
    const input = '```\n{"a":1}\n```'
    expect(parseAIResponseJSON(input)).toEqual({ a: 1 })
  })

  it('handles leading/trailing whitespace', () => {
    expect(parseAIResponseJSON('  {"a":1}  ')).toEqual({ a: 1 })
  })

  it('extracts the JSON block when prose precedes it (mixed content)', () => {
    const input = 'Here is the data:\n```json\n{"a":1}\n```\nThanks!'
    expect(parseAIResponseJSON(input)).toEqual({ a: 1 })
  })

  it('returns {raw} for empty string', () => {
    expect(parseAIResponseJSON('')).toEqual({ raw: '' })
  })

  it('returns {raw} for null input', () => {
    expect(parseAIResponseJSON(null as any)).toEqual({ raw: null })
  })

  it('returns {raw} for undefined input', () => {
    expect(parseAIResponseJSON(undefined as any)).toEqual({ raw: undefined })
  })

  it('returns {raw} for non-string input (e.g. number)', () => {
    expect(parseAIResponseJSON(42 as any)).toEqual({ raw: 42 })
  })

  it('returns {raw: <original>} for invalid JSON inside braces', () => {
    expect(parseAIResponseJSON('{not json}')).toEqual({ raw: '{not json}' })
  })

  it('returns {raw: <original>} for plain prose with no JSON', () => {
    expect(parseAIResponseJSON('This is just text.')).toEqual({ raw: 'This is just text.' })
  })

  it('locks current behavior: double-stringified input returns {raw}', () => {
    // Known limitation: '"{\\"a\\":1}"' isn't unwrapped automatically.
    // Locks the current contract; any future fix to auto-unwrap will break
    // this test and force a deliberate decision.
    const input = '"{\\"a\\":1}"'
    const result = parseAIResponseJSON(input)
    expect(result).toEqual({ raw: input })
  })
})

describe('extractResponseContent', () => {
  it('returns parsed object from json_schema item directly', () => {
    const response = {
      output: [{
        content: [
          { type: 'json_schema', json: { a: 1, b: 'x' } },
        ],
      }],
    }
    expect(extractResponseContent(response)).toEqual({ a: 1, b: 'x' })
  })

  it('falls back to json_schema item.input_json when .json is absent', () => {
    const response = {
      output: [{
        content: [
          { type: 'json_schema', input_json: { a: 1 } },
        ],
      }],
    }
    expect(extractResponseContent(response)).toEqual({ a: 1 })
  })

  it('falls back to positional content[0].json when no item type-tag matches', () => {
    const response = {
      output: [{
        content: [
          { json: { a: 1 } }, // no type field — positional fallback
        ],
      }],
    }
    expect(extractResponseContent(response)).toEqual({ a: 1 })
  })

  it('unwraps a response wrapper that has text but not output_text', () => {
    const response = {
      output: [{
        content: [
          { type: 'json_schema', json: { id: 'wrapper-1', text: 'inner via text' } },
        ],
      }],
    }
    expect(extractResponseContent(response)).toBe('inner via text')
  })

  it('returns text item content as a string for downstream parsing', () => {
    const response = {
      output: [{
        content: [
          { type: 'text', text: '{"a":1}' },
        ],
      }],
    }
    expect(extractResponseContent(response)).toBe('{"a":1}')
  })

  it('falls back to response.output_text when output array is missing', () => {
    const response = { output_text: 'hello' }
    expect(extractResponseContent(response)).toBe('hello')
  })

  it('falls back to response.text as last resort', () => {
    const response = { text: 'hello' }
    expect(extractResponseContent(response)).toBe('hello')
  })

  it('returns parsed array directly when content is already an array', () => {
    const response = {
      output: [{
        content: [
          { type: 'json_schema', json: [1, 2, 3] },
        ],
      }],
    }
    expect(extractResponseContent(response)).toEqual([1, 2, 3])
  })

  it('unwraps a response wrapper that has output_text', () => {
    const response = {
      output: [{
        content: [
          { type: 'json_schema', json: { id: 'wrapper-1', output_text: 'inner content' } },
        ],
      }],
    }
    expect(extractResponseContent(response)).toBe('inner content')
  })

  it('throws when no content is found anywhere', () => {
    const response = { output: [] }
    expect(() => extractResponseContent(response)).toThrow(/No response from OpenAI/)
  })

  it('throws when output_text is empty string and no other source', () => {
    const response = { output_text: '' }
    expect(() => extractResponseContent(response)).toThrow(/No response from OpenAI/)
  })
})
