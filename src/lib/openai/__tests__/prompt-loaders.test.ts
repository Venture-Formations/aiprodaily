import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted runs before the hoisted vi.mock factory, so the chain symbols
// are available at mock-construction time.
const mocks = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn()
  const mockEq = vi.fn()
  const mockChain: any = {}
  mockChain.select = (..._args: any[]) => mockChain
  mockChain.eq = (...args: any[]) => { mockEq(...args); return mockChain }
  mockChain.maybeSingle = mockMaybeSingle

  return {
    mockChain,
    mockMaybeSingle,
    mockEq,
    mockFrom: vi.fn(() => mockChain),
    mockGetPrompt: vi.fn(),
    mockCallStructured: vi.fn(),
  }
})

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mocks.mockFrom },
}))

vi.mock('../prompt-repository', () => ({
  getPrompt: mocks.mockGetPrompt,
}))

vi.mock('../core', () => ({
  callWithStructuredPrompt: mocks.mockCallStructured,
}))

import { AI_PROMPTS, clearPromptCache } from '../prompt-loaders'

beforeEach(() => {
  vi.clearAllMocks()
  // Cache is module-scoped; reset between tests so mockResolvedValueOnce
  // sequencing isn't short-circuited by hits from prior tests.
  clearPromptCache()
})

// ---------------------------------------------------------------------------
describe('AI_PROMPTS.contentEvaluator (plain-text via fetchPromptRow)', () => {
  it('returns DB template with substitutions when publication_settings has the key', async () => {
    // First call (publication_settings) returns the override
    mocks.mockMaybeSingle.mockResolvedValueOnce({
      data: { value: 'Title is {{title}} and image: {{imagePenalty}}' },
      error: null,
    })

    const result = await AI_PROMPTS.contentEvaluator(
      { title: 'My Story', description: 'desc', hasImage: true },
      'pub-123',
    )

    expect(result).toContain('Title is My Story')
    expect(result).toContain('This post HAS an image.')
    expect(mocks.mockFrom).toHaveBeenCalledWith('publication_settings')
    // Guards against typos in the key string
    expect(mocks.mockEq).toHaveBeenCalledWith('key', 'ai_prompt_content_evaluator')
    expect(mocks.mockEq).toHaveBeenCalledWith('publication_id', 'pub-123')
  })

  it('falls back to app_settings when publication_settings has no row', async () => {
    mocks.mockMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: { value: 'Global: {{title}}', ai_provider: null },
        error: null,
      })

    const result = await AI_PROMPTS.contentEvaluator(
      { title: 'X', description: '', hasImage: false },
      'pub-123',
    )
    expect(result).toBe('Global: X')
  })

  it('returns FALLBACK when both publication and app settings miss', async () => {
    mocks.mockMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null })

    const result = await AI_PROMPTS.contentEvaluator(
      { title: 'X', description: '', hasImage: false },
      'pub-123',
    )
    // Fallback already has values inlined (no {{title}} placeholders left)
    expect(result).toContain('Article Title: X')
    expect(result).not.toContain('{{title}}')
  })

  it('skips publication_settings query when no publicationId is provided (debug-handler path)', async () => {
    mocks.mockMaybeSingle.mockResolvedValueOnce({
      data: { value: 'App: {{title}}', ai_provider: null },
      error: null,
    })

    const result = await AI_PROMPTS.contentEvaluator(
      { title: 'Z', description: '', hasImage: false },
    )
    expect(result).toBe('App: Z')
    expect(mocks.mockFrom).toHaveBeenCalledWith('app_settings')
    expect(mocks.mockFrom).not.toHaveBeenCalledWith('publication_settings')
  })
})

// ---------------------------------------------------------------------------
describe('fetchPromptRow caching behavior', () => {
  it('second call with same key+publicationId is a cache hit (no DB roundtrip)', async () => {
    mocks.mockMaybeSingle.mockResolvedValueOnce({
      data: { value: 'Cached: {{title}}' },
      error: null,
    })

    const a = await AI_PROMPTS.contentEvaluator(
      { title: 'First', description: '', hasImage: false },
      'pub-cache',
    )
    const b = await AI_PROMPTS.contentEvaluator(
      { title: 'Second', description: '', hasImage: false },
      'pub-cache',
    )

    expect(a).toContain('Cached: First')
    expect(b).toContain('Cached: Second')
    // Only one DB call across both AI_PROMPTS invocations
    expect(mocks.mockMaybeSingle).toHaveBeenCalledTimes(1)
  })

  it('different publicationIds do not collide in the cache', async () => {
    mocks.mockMaybeSingle
      .mockResolvedValueOnce({ data: { value: 'Pub A: {{title}}' }, error: null })
      .mockResolvedValueOnce({ data: { value: 'Pub B: {{title}}' }, error: null })

    const a = await AI_PROMPTS.contentEvaluator(
      { title: 'X', description: '', hasImage: false },
      'pub-A',
    )
    const b = await AI_PROMPTS.contentEvaluator(
      { title: 'X', description: '', hasImage: false },
      'pub-B',
    )

    expect(a).toContain('Pub A: X')
    expect(b).toContain('Pub B: X')
    expect(mocks.mockMaybeSingle).toHaveBeenCalledTimes(2)
  })

  it('caches the "no row" result so double-misses are not repeated', async () => {
    // Both publication and app reads return null on the first call
    mocks.mockMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null })

    await AI_PROMPTS.contentEvaluator(
      { title: 'X', description: '', hasImage: false },
      'pub-empty',
    )
    await AI_PROMPTS.contentEvaluator(
      { title: 'Y', description: '', hasImage: false },
      'pub-empty',
    )

    // Two DB queries on the first call (pub miss → app miss); zero on the second
    expect(mocks.mockMaybeSingle).toHaveBeenCalledTimes(2)
  })

  it('does NOT cache when the app_settings query errors (transient blip retries)', async () => {
    // First call: pub miss, app errors
    mocks.mockMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'connection reset' } as any })
      // Second call: pub miss, app returns a real row
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { value: 'Recovered: {{title}}', ai_provider: null }, error: null })

    const first = await AI_PROMPTS.contentEvaluator(
      { title: 'X', description: '', hasImage: false },
      'pub-blip',
    )
    // Error → fell through to fallback
    expect(first).toContain('Article Title: X')

    const second = await AI_PROMPTS.contentEvaluator(
      { title: 'Y', description: '', hasImage: false },
      'pub-blip',
    )
    // Second call retried both queries (error wasn't cached) and got the recovered prompt
    expect(second).toBe('Recovered: Y')
    expect(mocks.mockMaybeSingle).toHaveBeenCalledTimes(4)
  })

  it('clearPromptCache() forces the next call to hit the DB', async () => {
    mocks.mockMaybeSingle
      .mockResolvedValueOnce({ data: { value: 'V1: {{title}}' }, error: null })
      .mockResolvedValueOnce({ data: { value: 'V2: {{title}}' }, error: null })

    const a = await AI_PROMPTS.contentEvaluator(
      { title: 'X', description: '', hasImage: false },
      'pub-clear',
    )
    expect(a).toContain('V1: X')

    clearPromptCache()

    const b = await AI_PROMPTS.contentEvaluator(
      { title: 'X', description: '', hasImage: false },
      'pub-clear',
    )
    expect(b).toContain('V2: X')
    expect(mocks.mockMaybeSingle).toHaveBeenCalledTimes(2)
  })
})

// ---------------------------------------------------------------------------
describe('AI_PROMPTS.imageAnalyzer (delegates to getPrompt)', () => {
  it('forwards publicationId to getPrompt', async () => {
    mocks.mockGetPrompt.mockResolvedValueOnce('analyze image content')
    const result = await AI_PROMPTS.imageAnalyzer('pub-1')
    expect(result).toBe('analyze image content')
    expect(mocks.mockGetPrompt).toHaveBeenCalledWith(
      'ai_prompt_image_analyzer',
      expect.any(String),
      'pub-1',
    )
  })

  it('passes undefined publicationId through', async () => {
    mocks.mockGetPrompt.mockResolvedValueOnce('analyze image content')
    await AI_PROMPTS.imageAnalyzer()
    expect(mocks.mockGetPrompt).toHaveBeenCalledWith(
      'ai_prompt_image_analyzer',
      expect.any(String),
      undefined,
    )
  })
})
