import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockSingle = vi.fn()
const mockChain: Record<string, any> = {
  select: vi.fn(() => mockChain),
  eq: vi.fn(() => mockChain),
  order: vi.fn(() => mockChain),
  limit: vi.fn(() => mockChain),
  single: mockSingle,
  insert: vi.fn(() => ({ error: null })),
}

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => mockChain),
  },
}))

// Mock callAIWithPrompt
const mockCallAI = vi.fn()
vi.mock('@/lib/openai/core', () => ({
  callAIWithPrompt: (...args: any[]) => mockCallAI(...args),
}))

import { triageAlert, isTriageEnabled } from '../alert-triage'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('isTriageEnabled', () => {
  it('returns false when setting does not exist', async () => {
    mockSingle.mockResolvedValue({ data: null })
    expect(await isTriageEnabled()).toBe(false)
  })

  it('returns true when setting is "true"', async () => {
    mockSingle.mockResolvedValue({ data: { value: 'true' } })
    expect(await isTriageEnabled()).toBe(true)
  })

  it('returns false when setting is "false"', async () => {
    mockSingle.mockResolvedValue({ data: { value: 'false' } })
    expect(await isTriageEnabled()).toBe(false)
  })

  it('returns false on database error', async () => {
    mockSingle.mockRejectedValue(new Error('DB down'))
    expect(await isTriageEnabled()).toBe(false)
  })
})

describe('triageAlert', () => {
  it('returns auto_resolve classification', async () => {
    // Mock recent context fetch (system_logs query returns data array, not single)
    mockChain.limit.mockReturnValue({ data: [] })

    mockCallAI.mockResolvedValue(
      '{"classification":"auto_resolve","reasoning":"Transient 429 rate limit","suggested_action":"Wait for cooldown"}'
    )

    const result = await triageAlert('Rate limited', 'warn', 'system_errors')

    expect(result).not.toBeNull()
    expect(result!.classification).toBe('auto_resolve')
    expect(result!.reasoning).toBe('Transient 429 rate limit')
  })

  it('returns investigate classification', async () => {
    mockChain.limit.mockReturnValue({ data: [] })
    mockCallAI.mockResolvedValue(
      '{"classification":"investigate","reasoning":"Feed errors increasing but not critical"}'
    )

    const result = await triageAlert('Feed errors above threshold', 'warn')

    expect(result).not.toBeNull()
    expect(result!.classification).toBe('investigate')
  })

  it('returns critical classification', async () => {
    mockChain.limit.mockReturnValue({ data: [] })
    mockCallAI.mockResolvedValue(
      '{"classification":"critical","reasoning":"Database connection failed"}'
    )

    const result = await triageAlert('Database error', 'error', 'system_errors')

    expect(result).not.toBeNull()
    expect(result!.classification).toBe('critical')
  })

  it('returns null when AI returns unparseable response', async () => {
    mockChain.limit.mockReturnValue({ data: [] })
    mockCallAI.mockResolvedValue('I cannot classify this alert.')

    const result = await triageAlert('Some alert', 'info')

    expect(result).toBeNull()
  })

  it('returns null when AI call throws', async () => {
    mockChain.limit.mockReturnValue({ data: [] })
    mockCallAI.mockRejectedValue(new Error('API key invalid'))

    const result = await triageAlert('Some alert', 'error')

    expect(result).toBeNull()
  })

  it('handles { raw: string } response from callAIWithPrompt', async () => {
    mockChain.limit.mockReturnValue({ data: [] })
    mockCallAI.mockResolvedValue({
      raw: '{"classification":"critical","reasoning":"Real problem"}'
    })

    const result = await triageAlert('Workflow failed', 'error')

    expect(result).not.toBeNull()
    expect(result!.classification).toBe('critical')
  })

  it('handles already-parsed object response', async () => {
    mockChain.limit.mockReturnValue({ data: [] })
    mockCallAI.mockResolvedValue({
      classification: 'auto_resolve',
      reasoning: 'Transient error',
    })

    const result = await triageAlert('Transient blip', 'info')

    expect(result).not.toBeNull()
    expect(result!.classification).toBe('auto_resolve')
  })

  it('returns null for invalid classification value', async () => {
    mockChain.limit.mockReturnValue({ data: [] })
    mockCallAI.mockResolvedValue(
      '{"classification":"unknown_value","reasoning":"test"}'
    )

    const result = await triageAlert('Test', 'info')

    expect(result).toBeNull()
  })

  it('respects 5-second timeout', async () => {
    mockChain.limit.mockReturnValue({ data: [] })

    // AI call hangs for 10 seconds
    mockCallAI.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve('too late'), 10_000))
    )

    const start = Date.now()
    const result = await triageAlert('Slow alert', 'warn')
    const elapsed = Date.now() - start

    expect(result).toBeNull()
    // Should resolve in ~5s, not 10s
    expect(elapsed).toBeLessThan(7_000)
  }, 15_000)
})
