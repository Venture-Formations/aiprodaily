import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mocks declared before importing the module under test so vi.mock hoisting
// resolves them correctly.

type SupaResponse = { data: any; error: any }

const responseQueue: SupaResponse[] = []
const fromCalls: string[] = []
const insertCalls: any[] = []
const updateCalls: any[] = []
const eqCalls: Array<[string, any]> = []

function makeChain(response: SupaResponse): any {
  const chain: any = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn((col: string, val: any) => {
    eqCalls.push([col, val])
    return chain
  })
  chain.not = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.insert = vi.fn((payload: any) => {
    insertCalls.push(payload)
    return chain
  })
  chain.update = vi.fn((payload: any) => {
    updateCalls.push(payload)
    return chain
  })
  chain.maybeSingle = vi.fn(() => Promise.resolve(response))
  chain.single = vi.fn(() => Promise.resolve(response))
  // Make chain awaitable for queries that resolve directly (.order(),
  // .insert(), .update().eq()).
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(response).then(resolve, reject)
  return chain
}

vi.mock('../supabase', () => ({
  supabaseAdmin: {
    from: vi.fn((table: string) => {
      fromCalls.push(table)
      const response = responseQueue.shift() ?? { data: null, error: null }
      return makeChain(response)
    }),
  },
}))

vi.mock('../publication-settings', () => ({
  getAdSettings: vi.fn(),
  updateNextAdPosition: vi.fn(),
}))

import { AdScheduler } from '../ad-scheduler'
import { getAdSettings, updateNextAdPosition } from '../publication-settings'

const mockedGetAdSettings = vi.mocked(getAdSettings)
const mockedUpdateNextAdPosition = vi.mocked(updateNextAdPosition)

function makeAd(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? 'ad-default',
    title: overrides.title ?? 'Default Ad',
    display_order: 1,
    status: 'active',
    publication_id: 'pub-1',
    times_used: 0,
    last_used_date: null,
    ...overrides,
  }
}

// Pushes the 5 supabase responses recordAdUsage's happy path consumes, in order:
// fetch used ad → lookup existing assignment → write assignment → update ad
// → fetch active ads for next-position calc.
function pushRecordAdUsageMocks(opts: {
  usedAd: { display_order: number; times_used: number | null }
  existingAssignment?: { id: string } | null
  activeAds: Array<{ display_order: number }>
}) {
  responseQueue.push({ data: opts.usedAd, error: null })
  responseQueue.push({ data: opts.existingAssignment ?? null, error: null })
  responseQueue.push({ data: null, error: null })
  responseQueue.push({ data: null, error: null })
  responseQueue.push({ data: opts.activeAds, error: null })
}

beforeEach(() => {
  responseQueue.length = 0
  fromCalls.length = 0
  insertCalls.length = 0
  updateCalls.length = 0
  eqCalls.length = 0
  vi.clearAllMocks()
})

describe('AdScheduler.selectAdForissue', () => {
  const ctx = { issueDate: '2026-01-01', issueId: 'issue-1', newsletterId: 'pub-1' }

  it('returns null when no active ads exist', async () => {
    mockedGetAdSettings.mockResolvedValue({ next_ad_position: 1 })
    responseQueue.push({ data: [], error: null })

    const result = await AdScheduler.selectAdForissue(ctx)

    expect(result).toBeNull()
  })

  it('returns null when supabase returns an error', async () => {
    mockedGetAdSettings.mockResolvedValue({ next_ad_position: 1 })
    responseQueue.push({ data: null, error: { message: 'boom' } })

    const result = await AdScheduler.selectAdForissue(ctx)

    expect(result).toBeNull()
  })

  it('returns the ad at the exact next_ad_position', async () => {
    const ad1 = makeAd({ id: 'ad-1', display_order: 1 })
    const ad2 = makeAd({ id: 'ad-2', display_order: 2 })
    const ad3 = makeAd({ id: 'ad-3', display_order: 3 })
    mockedGetAdSettings.mockResolvedValue({ next_ad_position: 2 })
    responseQueue.push({ data: [ad1, ad2, ad3], error: null })

    const result = await AdScheduler.selectAdForissue(ctx)

    expect(result?.id).toBe('ad-2')
  })

  it('skips gaps and returns the next available position', async () => {
    // Positions [1, 3, 5]; next_ad_position points to missing 2.
    const ad1 = makeAd({ id: 'ad-1', display_order: 1 })
    const ad3 = makeAd({ id: 'ad-3', display_order: 3 })
    const ad5 = makeAd({ id: 'ad-5', display_order: 5 })
    mockedGetAdSettings.mockResolvedValue({ next_ad_position: 2 })
    responseQueue.push({ data: [ad1, ad3, ad5], error: null })

    const result = await AdScheduler.selectAdForissue(ctx)

    expect(result?.id).toBe('ad-3')
  })

  it('loops back to the first ad when next_ad_position is past the end', async () => {
    const ad1 = makeAd({ id: 'ad-1', display_order: 1 })
    const ad2 = makeAd({ id: 'ad-2', display_order: 2 })
    mockedGetAdSettings.mockResolvedValue({ next_ad_position: 99 })
    responseQueue.push({ data: [ad1, ad2], error: null })

    const result = await AdScheduler.selectAdForissue(ctx)

    expect(result?.id).toBe('ad-1')
  })

  it('filters by publication_id and active status', async () => {
    const ad1 = makeAd({ id: 'ad-1', display_order: 1 })
    mockedGetAdSettings.mockResolvedValue({ next_ad_position: 1 })
    responseQueue.push({ data: [ad1], error: null })

    await AdScheduler.selectAdForissue(ctx)

    expect(fromCalls).toContain('advertisements')
    expect(eqCalls).toContainEqual(['publication_id', 'pub-1'])
    expect(eqCalls).toContainEqual(['status', 'active'])
  })

  it('returns null when getAdSettings throws', async () => {
    mockedGetAdSettings.mockRejectedValue(new Error('settings unavailable'))

    const result = await AdScheduler.selectAdForissue(ctx)

    expect(result).toBeNull()
  })
})

describe('AdScheduler.assignAdToIssue', () => {
  it('skips insert when ad is already assigned to the issue', async () => {
    responseQueue.push({ data: { id: 'existing-1' }, error: null })

    await AdScheduler.assignAdToIssue('issue-1', 'ad-1', '2026-01-01')

    expect(insertCalls).toHaveLength(0)
  })

  it('inserts assignment without used_at when not yet assigned', async () => {
    responseQueue.push({ data: null, error: null })
    responseQueue.push({ data: null, error: null })

    await AdScheduler.assignAdToIssue('issue-1', 'ad-1', '2026-01-01')

    expect(insertCalls).toHaveLength(1)
    expect(insertCalls[0]).toEqual({
      issue_id: 'issue-1',
      advertisement_id: 'ad-1',
      issue_date: '2026-01-01',
    })
    // used_at must NOT be set here — it's set later at send-final.
    expect(insertCalls[0]).not.toHaveProperty('used_at')
  })

  it('throws when insert fails', async () => {
    responseQueue.push({ data: null, error: null })
    responseQueue.push({ data: null, error: { message: 'insert failed' } })

    await expect(
      AdScheduler.assignAdToIssue('issue-1', 'ad-1', '2026-01-01')
    ).rejects.toMatchObject({ message: 'insert failed' })
  })
})

describe('AdScheduler.recordAdUsage', () => {
  it('throws when fetching the used ad fails', async () => {
    responseQueue.push({ data: null, error: { message: 'not found' } })

    await expect(
      AdScheduler.recordAdUsage('issue-1', 'ad-1', '2026-01-01', 'pub-1')
    ).rejects.toMatchObject({ message: 'not found' })
  })

  it('updates an existing assignment with used_at timestamp', async () => {
    pushRecordAdUsageMocks({
      usedAd: { display_order: 1, times_used: 0 },
      existingAssignment: { id: 'asgn-1' },
      activeAds: [{ display_order: 1 }, { display_order: 2 }],
    })
    mockedUpdateNextAdPosition.mockResolvedValue({ success: true })

    await AdScheduler.recordAdUsage('issue-1', 'ad-1', '2026-01-01', 'pub-1')

    // updateCalls[0] is the assignment update; used_at must be an ISO timestamp.
    expect(updateCalls[0].used_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('inserts a new assignment when none exists', async () => {
    pushRecordAdUsageMocks({
      usedAd: { display_order: 1, times_used: 0 },
      existingAssignment: null,
      activeAds: [{ display_order: 1 }, { display_order: 2 }],
    })
    mockedUpdateNextAdPosition.mockResolvedValue({ success: true })

    await AdScheduler.recordAdUsage('issue-1', 'ad-1', '2026-01-01', 'pub-1')

    expect(insertCalls).toHaveLength(1)
    expect(insertCalls[0]).toMatchObject({
      issue_id: 'issue-1',
      advertisement_id: 'ad-1',
      issue_date: '2026-01-01',
    })
    expect(insertCalls[0].used_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })

  it('increments times_used by 1', async () => {
    pushRecordAdUsageMocks({
      usedAd: { display_order: 2, times_used: 5 },
      existingAssignment: { id: 'asgn-1' },
      activeAds: [{ display_order: 1 }, { display_order: 2 }, { display_order: 3 }],
    })
    mockedUpdateNextAdPosition.mockResolvedValue({ success: true })

    await AdScheduler.recordAdUsage('issue-1', 'ad-1', '2026-01-01', 'pub-1')

    // updateCalls[1] is the advertisement update.
    expect(updateCalls[1].times_used).toBe(6)
  })

  it('treats null times_used as 0 when incrementing', async () => {
    pushRecordAdUsageMocks({
      usedAd: { display_order: 1, times_used: null },
      existingAssignment: { id: 'asgn-1' },
      activeAds: [{ display_order: 1 }, { display_order: 2 }],
    })
    mockedUpdateNextAdPosition.mockResolvedValue({ success: true })

    await AdScheduler.recordAdUsage('issue-1', 'ad-1', '2026-01-01', 'pub-1')

    expect(updateCalls[1].times_used).toBe(1)
  })

  it('sets last_used_date to the issue date', async () => {
    pushRecordAdUsageMocks({
      usedAd: { display_order: 1, times_used: 0 },
      existingAssignment: { id: 'asgn-1' },
      activeAds: [{ display_order: 1 }, { display_order: 2 }],
    })
    mockedUpdateNextAdPosition.mockResolvedValue({ success: true })

    await AdScheduler.recordAdUsage('issue-1', 'ad-1', '2026-03-15', 'pub-1')

    expect(updateCalls[1].last_used_date).toBe('2026-03-15')
  })

  it('advances next position to currentPosition + 1', async () => {
    pushRecordAdUsageMocks({
      usedAd: { display_order: 2, times_used: 0 },
      existingAssignment: { id: 'asgn-1' },
      activeAds: [{ display_order: 1 }, { display_order: 2 }, { display_order: 3 }],
    })
    mockedUpdateNextAdPosition.mockResolvedValue({ success: true })

    await AdScheduler.recordAdUsage('issue-1', 'ad-1', '2026-01-01', 'pub-1')

    expect(mockedUpdateNextAdPosition).toHaveBeenCalledWith('pub-1', 3)
  })

  it('loops next position back to 1 when past the max position', async () => {
    // Used ad is at the last position (3); next should wrap to 1.
    pushRecordAdUsageMocks({
      usedAd: { display_order: 3, times_used: 0 },
      existingAssignment: { id: 'asgn-1' },
      activeAds: [{ display_order: 1 }, { display_order: 2 }, { display_order: 3 }],
    })
    mockedUpdateNextAdPosition.mockResolvedValue({ success: true })

    await AdScheduler.recordAdUsage('issue-1', 'ad-1', '2026-01-01', 'pub-1')

    expect(mockedUpdateNextAdPosition).toHaveBeenCalledWith('pub-1', 1)
  })

  it('throws when updateNextAdPosition reports failure', async () => {
    pushRecordAdUsageMocks({
      usedAd: { display_order: 1, times_used: 0 },
      existingAssignment: { id: 'asgn-1' },
      activeAds: [{ display_order: 1 }, { display_order: 2 }],
    })
    mockedUpdateNextAdPosition.mockResolvedValue({
      success: false,
      error: 'settings write failed',
    })

    await expect(
      AdScheduler.recordAdUsage('issue-1', 'ad-1', '2026-01-01', 'pub-1')
    ).rejects.toThrow(/settings write failed/)
  })
})
