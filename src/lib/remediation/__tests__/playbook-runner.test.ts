import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockSingle = vi.fn()
const mockChain: Record<string, any> = {
  select: vi.fn(() => mockChain),
  eq: vi.fn(() => mockChain),
  in: vi.fn(() => mockChain),
  gte: vi.fn(() => mockChain),
  lt: vi.fn(() => mockChain),
  limit: vi.fn(() => mockChain),
  single: mockSingle,
  insert: vi.fn(() => ({ error: null })),
  update: vi.fn(() => mockChain),
  upsert: vi.fn(() => ({ error: null })),
  delete: vi.fn(() => mockChain),
}

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => mockChain),
  },
}))

vi.mock('@/lib/logger', () => {
  const log = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    correlationId: 'test-id',
  }
  return { createLogger: vi.fn(() => log) }
})

import { createLogger } from '@/lib/logger'
import { PlaybookRunner } from '../playbook-runner'

const PUB_ID = 'pub-test-123'
const ISSUE_ID = 'issue-test-456'
const logger = createLogger({ publicationId: PUB_ID })

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PlaybookRunner.runStuckWorkflow', () => {
  it('resets a stuck issue to previous pending state', async () => {
    // Mock: issue found with auto_retry_count=0
    mockSingle.mockResolvedValueOnce({
      data: { id: ISSUE_ID, auto_retry_count: 0, workflow_state: 'generating' },
    })
    // Mock: update succeeds (no error on chain)
    mockChain.update.mockReturnValue(mockChain)

    const runner = new PlaybookRunner(PUB_ID, logger)
    const result = await runner.runStuckWorkflow(ISSUE_ID, 'generating', 20)

    expect(result.result).toBe('success')
    expect(result.action).toContain('pending_generate')
  })

  it('skips when auto_retry_count already at max', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: ISSUE_ID, auto_retry_count: 1, workflow_state: 'generating' },
    })

    const runner = new PlaybookRunner(PUB_ID, logger)
    const result = await runner.runStuckWorkflow(ISSUE_ID, 'generating', 20)

    expect(result.result).toBe('skipped')
    expect(result.action).toContain('Max auto-retries')
  })

  it('skips for non-active states', async () => {
    const runner = new PlaybookRunner(PUB_ID, logger)
    const result = await runner.runStuckWorkflow(ISSUE_ID, 'pending_archive', 20)

    expect(result.result).toBe('skipped')
    expect(result.action).toContain('not an active state')
  })

  it('skips when state changed before remediation', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: ISSUE_ID, auto_retry_count: 0, workflow_state: 'complete' },
    })

    const runner = new PlaybookRunner(PUB_ID, logger)
    const result = await runner.runStuckWorkflow(ISSUE_ID, 'generating', 20)

    expect(result.result).toBe('skipped')
    expect(result.action).toContain('State changed')
  })
})

describe('PlaybookRunner.runRSSFeedDown', () => {
  it('deactivates a feed with too many errors', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'feed-1', name: 'Test Feed', active: true, publication_id: PUB_ID },
    })

    const runner = new PlaybookRunner(PUB_ID, logger)
    const result = await runner.runRSSFeedDown('feed-1', 6)

    expect(result.result).toBe('success')
    expect(result.action).toContain('Deactivated')
  })

  it('skips when error count below threshold', async () => {
    const runner = new PlaybookRunner(PUB_ID, logger)
    const result = await runner.runRSSFeedDown('feed-1', 3)

    expect(result.result).toBe('skipped')
  })

  it('skips when feed already inactive', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: 'feed-1', name: 'Test Feed', active: false, publication_id: PUB_ID },
    })

    const runner = new PlaybookRunner(PUB_ID, logger)
    const result = await runner.runRSSFeedDown('feed-1', 6)

    expect(result.result).toBe('skipped')
    expect(result.action).toContain('already deactivated')
  })
})

describe('PlaybookRunner.runAIRefusalSpike', () => {
  it('activates fallback model on refusal spike', async () => {
    // Mock: no existing fallback flag
    mockSingle.mockResolvedValueOnce({ data: null })

    const runner = new PlaybookRunner(PUB_ID, logger)
    const result = await runner.runAIRefusalSpike(ISSUE_ID, 3)

    expect(result.result).toBe('success')
    expect(result.action).toContain('Fallback AI model activated')
  })

  it('skips when refusal count below threshold', async () => {
    const runner = new PlaybookRunner(PUB_ID, logger)
    const result = await runner.runAIRefusalSpike(ISSUE_ID, 2)

    expect(result.result).toBe('skipped')
  })
})
