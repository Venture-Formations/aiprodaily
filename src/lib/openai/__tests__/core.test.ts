import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

type SupaResponse = { data: any; error: any }
const supabase = vi.hoisted(() => ({
  responseQueue: [] as SupaResponse[],
}))

function makeSupaChain(response: SupaResponse): any {
  const chain: any = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.single = vi.fn(() => Promise.resolve(response))
  return chain
}

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => {
      const response = supabase.responseQueue.shift() ?? { data: null, error: null }
      return makeSupaChain(response)
    }),
  },
}))

const mockOpenAI = vi.hoisted(() => ({
  responses: { create: vi.fn() },
}))
const mockAnthropic = vi.hoisted(() => ({
  messages: { create: vi.fn() },
}))

vi.mock('../clients', () => ({
  openai: mockOpenAI,
  anthropic: mockAnthropic,
}))

// MetricsRecorder is dynamically imported inside callAIWithPrompt, so the
// mock must expose a class shim with the recordTiming method.
vi.mock('@/lib/monitoring/metrics-recorder', () => ({
  MetricsRecorder: class {
    constructor(_publicationId: string) {}
    recordTiming = vi.fn().mockResolvedValue(undefined)
  },
}))

import {
  getPrompt,
  getPromptJSON,
  callWithStructuredPrompt,
  callAIWithPrompt,
} from '../core'

beforeEach(() => {
  // Suppress production console output.
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})

  supabase.responseQueue.length = 0
  mockOpenAI.responses.create.mockReset()
  mockAnthropic.messages.create.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getPrompt', () => {
  it('returns publication_settings value when publicationId provided and key exists', async () => {
    supabase.responseQueue.push({ data: { value: 'pub-specific-prompt' }, error: null })

    const result = await getPrompt('my_key', 'fallback', 'pub-1')

    expect(result).toBe('pub-specific-prompt')
  })

  it('falls back to app_settings when publication_settings has no row', async () => {
    supabase.responseQueue.push({ data: null, error: { message: 'not found' } }) // pub_settings miss
    supabase.responseQueue.push({ data: { value: 'app-default-prompt' }, error: null }) // app_settings hit

    const result = await getPrompt('my_key', 'fallback', 'pub-1')

    expect(result).toBe('app-default-prompt')
  })

  it('returns the provided fallback when both publication_settings and app_settings miss', async () => {
    supabase.responseQueue.push({ data: null, error: { message: 'not found' } })
    supabase.responseQueue.push({ data: null, error: { message: 'not found' } })

    const result = await getPrompt('my_key', 'CODE_FALLBACK', 'pub-1')

    expect(result).toBe('CODE_FALLBACK')
  })
})

describe('getPromptJSON', () => {
  it('returns parsed JSON when stored as a string in publication_settings', async () => {
    const stored = JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hi' }],
    })
    supabase.responseQueue.push({ data: { value: stored }, error: null })

    const result = await getPromptJSON('my_key', 'pub-1')

    expect(result.model).toBe('gpt-4o')
    expect(result.messages).toEqual([{ role: 'user', content: 'hi' }])
    expect(result._provider).toBe('openai')
  })

  it('falls back to app_settings when publication_settings is empty', async () => {
    const stored = JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'app default' }],
    })
    supabase.responseQueue.push({ data: null, error: { message: 'not found' } })
    supabase.responseQueue.push({ data: { value: stored }, error: null })

    const result = await getPromptJSON('my_key', 'pub-1')

    expect(result.messages[0].content).toBe('app default')
  })

  it('throws when stored value is not valid JSON and no fallback provided', async () => {
    supabase.responseQueue.push({ data: { value: '{this is not json}' }, error: null })

    await expect(getPromptJSON('my_key', 'pub-1')).rejects.toThrow(
      /not valid JSON/
    )
  })

  it('throws when stored JSON is missing both messages and input arrays', async () => {
    const stored = JSON.stringify({ model: 'gpt-4o', temperature: 0.5 })
    supabase.responseQueue.push({ data: { value: stored }, error: null })

    await expect(getPromptJSON('my_key', 'pub-1')).rejects.toThrow(
      /missing 'messages' or 'input'/
    )
  })

  it('auto-detects Claude provider from a Claude model name', async () => {
    const stored = {
      model: 'claude-3-5-sonnet-20241022',
      messages: [{ role: 'user', content: 'hi' }],
    }
    supabase.responseQueue.push({ data: { value: stored }, error: null })

    const result = await getPromptJSON('my_key', 'pub-1')

    expect(result._provider).toBe('claude')
  })

  it('normalizes input array to messages when only input is provided (Responses API format)', async () => {
    const stored = {
      model: 'gpt-4o',
      input: [{ role: 'user', content: 'via input field' }],
    }
    supabase.responseQueue.push({ data: { value: stored }, error: null })

    const result = await getPromptJSON('my_key', 'pub-1')

    expect(result.messages).toEqual([{ role: 'user', content: 'via input field' }])
  })
})

describe('callWithStructuredPrompt', () => {
  it('throws when promptConfig is null', async () => {
    await expect(callWithStructuredPrompt(null as any)).rejects.toThrow(
      /Invalid promptConfig/
    )
  })

  it('throws when promptConfig has neither messages nor input array', async () => {
    await expect(
      callWithStructuredPrompt({ model: 'gpt-4o' } as any)
    ).rejects.toThrow(/must have either "messages" or "input" array/)
  })

  it('routes to anthropic.messages.create when provider="claude"', async () => {
    mockAnthropic.messages.create.mockResolvedValue({
      content: [{ type: 'text', text: '{"ok":true}' }],
    })

    const config: any = {
      model: 'claude-3-5-sonnet',
      messages: [{ role: 'user', content: 'hi' }],
    }
    const result = await callWithStructuredPrompt(config, {}, 'claude')

    expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(1)
    expect(mockOpenAI.responses.create).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: true })
  })

  it('routes to openai.responses.create when provider="openai" and translates messages→input', async () => {
    mockOpenAI.responses.create.mockResolvedValue({
      output: [{ content: [{ type: 'text', text: '{"ok":true}' }] }],
    })

    const config: any = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hi' }],
    }
    const result = await callWithStructuredPrompt(config, {}, 'openai')

    expect(mockOpenAI.responses.create).toHaveBeenCalledTimes(1)
    expect(mockAnthropic.messages.create).not.toHaveBeenCalled()
    // OpenAI Responses API uses 'input', not 'messages'.
    const sentRequest = mockOpenAI.responses.create.mock.calls[0]?.[0]
    expect(sentRequest.input).toEqual([{ role: 'user', content: 'hi' }])
    expect(sentRequest.messages).toBeUndefined()
    expect(result).toEqual({ ok: true })
  })

  it('replaces named placeholders ({{key}}) recursively in the request payload', async () => {
    mockOpenAI.responses.create.mockResolvedValue({
      output: [{ content: [{ type: 'text', text: '{"ok":true}' }] }],
    })

    const config: any = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hello {{name}}, your topic is {{topic}}.' }],
    }
    await callWithStructuredPrompt(config, { name: 'Jake', topic: 'AI' }, 'openai')

    const sent = mockOpenAI.responses.create.mock.calls[0]?.[0]
    expect(sent.input[0].content).toBe('Hello Jake, your topic is AI.')
  })

  it('strips custom application fields (provider, response_field) before calling the API', async () => {
    mockOpenAI.responses.create.mockResolvedValue({
      output: [{ content: [{ type: 'text', text: '{}' }] }],
    })

    const config: any = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hi' }],
      provider: 'openai',
      response_field: 'content',
    }
    await callWithStructuredPrompt(config, {}, 'openai')

    const sent = mockOpenAI.responses.create.mock.calls[0]?.[0]
    expect(sent.provider).toBeUndefined()
    expect(sent.response_field).toBeUndefined()
  })
})

describe('callAIWithPrompt (integration: getPromptJSON + callWithStructuredPrompt)', () => {
  it('end-to-end: loads prompt, dispatches via correct provider, returns parsed JSON', async () => {
    const stored = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Generate {{topic}}' }],
    }
    supabase.responseQueue.push({ data: { value: stored }, error: null })

    mockOpenAI.responses.create.mockResolvedValue({
      output: [{ content: [{ type: 'text', text: '{"title":"hello"}' }] }],
    })

    const result = await callAIWithPrompt('article_title_prompt', 'pub-1', { topic: 'AI' })

    expect(result).toEqual({ title: 'hello' })
    const sent = mockOpenAI.responses.create.mock.calls[0]?.[0]
    expect(sent.input[0].content).toBe('Generate AI')
    // Internal _provider field must NOT leak to the API request.
    expect(sent._provider).toBeUndefined()
  })
})
